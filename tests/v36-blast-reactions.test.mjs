import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  setOrder,
  explode,
} from '../game/engine.ts';
import { isRotorcraft } from '../game/rotor-wash.ts';
import { suppressNearMiss } from '../game/projectile-depth.ts';

const DT = 1 / 60;
const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log('PASS', name);
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
    console.error('FAIL', name, error.message);
  }
}

function arena() {
  const s = createGame(32001);
  startGame(s);
  return s;
}

function run(s, frames) {
  for (let i = 0; i < frames; i++) tick(s, DT);
}

function infantry(s, x) {
  spawnUnit(s, 1, 'infantry', x);
  return s.units.find((u) => u.side === 1 && Math.abs(u.x - x) < 4);
}

// --- base helicopter rotor wash ----------------------------------------------

test('base attack helicopter counts as rotorcraft', () => {
  assert.ok(
    isRotorcraft({ id: 'helicopter' }),
    'the air:true helicopter without an airframe still kicks up wash',
  );
});

test('low-flying base helicopter stirs ground dust', () => {
  const s = arena();
  spawnUnit(s, 0, 'helicopter', 200);
  let sawWash = false;
  for (let i = 0; i < 120; i++) {
    tick(s, DT);
    if (s.particles.some((p) => p.kind === 'dust' && p.size >= 5)) sawWash = true;
  }
  assert.ok(sawWash, 'the attack helicopter should blow dust beneath its rotors');
});

// --- blast near-miss flinch ---------------------------------------------------

test('a blast just outside the kill radius makes infantry flinch', () => {
  const s = arena();
  const u = infantry(s, 340);
  setOrder(s, 1, 'hold');
  const sup0 = u.suppression;
  // inner = radius + 12 = 42; a detonation 50px away is a near miss.
  explode(s, u.x + 50, u.y - 20, 30, 80, 0);
  assert.ok(u.flinchUntil !== undefined && u.flinchUntil > s.time, 'flinch window opens');
  assert.equal(u.flinchProne, true, 'a close near miss drops the soldier prone');
  assert.ok(u.suppression > sup0 + 20, 'suppression jumps from the close blast');
  assert.ok(u.hp === u.maxHp, 'the near miss deals no direct damage');
});

test('a farther near miss only crouches the soldier', () => {
  const s = arena();
  const u = infantry(s, 340);
  setOrder(s, 1, 'hold');
  // 70px away is inside the 2.1x outer band but beyond the 1.35x prone band.
  explode(s, u.x + 70, u.y - 20, 30, 80, 0);
  assert.ok(u.flinchUntil !== undefined && u.flinchUntil > s.time, 'flinch window opens');
  assert.equal(u.flinchProne, false, 'a distant near miss only crouches');
  assert.ok(u.hp === u.maxHp, 'no direct damage');
});

test('a blast inside the kill radius still wounds normally', () => {
  const s = arena();
  const u = infantry(s, 340);
  explode(s, u.x, u.y - 20, 30, 100, 0);
  assert.ok(u.hp < u.maxHp, 'a direct hit deals damage');
});

test('a flinching soldier stays pinned for the window, then recovers', () => {
  const s = arena();
  const u = infantry(s, 340);
  setOrder(s, 1, 'hold');
  explode(s, u.x + 70, u.y - 20, 30, 80, 0);
  const until = u.flinchUntil;
  run(s, 10);
  assert.equal(
    u.pose,
    'crouch',
    'the soldier hugs the dirt while the flinch window is open',
  );
  // Run well past the flinch window (0.4-0.85s).
  while (s.time < until + 1) tick(s, DT);
  assert.ok(u.flinchUntil <= s.time, 'the flinch window has expired');
  assert.ok(
    u.pose === 'idle' || u.pose === 'walk' || u.pose === 'run',
    `the soldier resumes a normal pose after flinching (was ${u.pose})`,
  );
});

// --- near-miss dust puffs ------------------------------------------------------

test('suppressing near-miss bullets kick up dust at the ground below', () => {
  const s = arena();
  const u = infantry(s, 380);
  const chest = u.y - (u.pose === 'prone' ? 9 : u.pose === 'crouch' ? 22 : 36);
  // Real bullets pass through aimProjectileDepth first, which sets the lanes.
  const p = {
    uid: 9001,
    side: 0,
    damage: 10,
    startX: 100,
    tx: 700,
    startLane: u.lane,
    targetLane: u.lane,
  };
  const before = s.particles.length;
  suppressNearMiss(s, p, 100, chest, 700, chest);
  const dust = s.particles.slice(before).filter((pt) => pt.kind === 'dust');
  assert.ok(dust.length >= 1, 'at least one dust puff spawns');
  // startGame garrisons several soldiers; near-miss dust can kick up under any
  // of them, so assert the round struck dirt beneath *this* soldier too.
  const mine = dust.filter((d) => Math.abs(d.x - u.x) < 14);
  assert.ok(mine.length >= 1, 'dust spawns below the bullet path near the soldier');
  for (const d of mine) {
    assert.ok(d.vy < 0, 'dust is flung upward');
    assert.ok(d.y <= u.y + 1, 'dust spawns at ground level');
  }
  assert.ok(
    p.suppressedUids?.includes(u.uid),
    'the soldier is still marked suppressed by the near miss',
  );
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error(failed.map((f) => f.error).join('\n'));
  process.exit(1);
}
