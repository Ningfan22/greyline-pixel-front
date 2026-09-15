import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  setOrder,
} from '../game/engine.ts';
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

// Flat arena with no walls/scenery and the AI brain disabled so near-miss
// geometry is fully deterministic.
function arena() {
  const s = createGame(67014);
  startGame(s);
  s.terrain.fill(374);
  s.original.fill(374);
  s.walls = [];
  s.scenery = [];
  s.players[1].deck = [];
  s.players[1].discard = [];
  s.players[1].hand = [];
  s.players[1].energy = 0;
  s.aiIn = 1e9;
  return s;
}

function run(s, seconds) {
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i++) tick(s, DT);
}

function grunt(s, side = 1, x = 400) {
  spawnUnit(s, side, 'infantry', x);
  return s.units.find((u) => u.side === side && Math.abs(u.x - x) < 4);
}

// Fire a horizontal bullet dy pixels above the soldier's chest.
function crackBullet(s, u, dy) {
  const chest =
    u.y -
    (u.pose === 'prone'
      ? 9
      : u.pose === 'hunker'
        ? 16
        : u.pose === 'crouch'
          ? 22
          : 36);
  const p = {
    uid: 9000 + Math.floor(Math.random() * 1000),
    side: u.side === 0 ? 1 : 0,
    damage: 10,
    startX: 100,
    tx: 700,
    startLane: u.lane,
    targetLane: u.lane,
  };
  suppressNearMiss(s, p, 100, chest + dy, 700, chest + dy);
  return p;
}

// --- core duck trigger -------------------------------------------------------

test('a round cracking within 14px drops a standing soldier into a crouch', () => {
  const s = arena();
  const u = grunt(s);
  setOrder(s, 1, 'hold');
  run(s, 0.2);
  assert.ok(
    u.pose === 'idle' || u.pose === 'walk' || u.pose === 'run',
    `soldier starts in a normal pose (was ${u.pose})`,
  );
  crackBullet(s, u, 0);
  assert.ok(
    u.duckUntil !== undefined && u.duckUntil > s.time,
    'the near miss opens a duck window',
  );
  run(s, 0.05);
  assert.equal(u.pose, 'crouch', 'the soldier ducks under the cracking round');
});

test('a round 20px overhead suppresses but does not duck', () => {
  const s = arena();
  const u = grunt(s);
  setOrder(s, 1, 'hold');
  run(s, 0.2);
  const sup0 = u.suppression;
  crackBullet(s, u, 20);
  assert.ok(u.suppression > sup0, 'suppression still rises inside the 26px band');
  assert.ok(
    u.duckUntil === undefined || u.duckUntil <= s.time,
    'a 20px miss is outside the 14px duck radius',
  );
  run(s, 0.05);
  assert.notEqual(u.pose, 'crouch', 'the soldier stays upright');
});

test('a round 30px away does nothing', () => {
  const s = arena();
  const u = grunt(s);
  setOrder(s, 1, 'hold');
  run(s, 0.2);
  const sup0 = u.suppression;
  crackBullet(s, u, 30);
  assert.equal(u.suppression, sup0, 'no suppression outside the 26px band');
  assert.ok(
    u.duckUntil === undefined || u.duckUntil <= s.time,
    'no duck window opens',
  );
});

// --- recovery ----------------------------------------------------------------

test('the soldier pops back up after the duck window expires', () => {
  const s = arena();
  const u = grunt(s);
  setOrder(s, 1, 'hold');
  run(s, 0.2);
  crackBullet(s, u, 0);
  const until = u.duckUntil;
  run(s, 0.05);
  assert.equal(u.pose, 'crouch', 'ducking while the window is open');
  while (s.time < until + 0.1) tick(s, DT);
  assert.ok(
    u.pose === 'idle' || u.pose === 'walk' || u.pose === 'run',
    `the soldier resumes a normal pose after the window (was ${u.pose})`,
  );
});

// --- pose guards -------------------------------------------------------------

test('an already-crouching soldier is not re-ducked', () => {
  const s = arena();
  const u = grunt(s);
  setOrder(s, 1, 'crouch');
  run(s, 0.3);
  assert.equal(u.pose, 'crouch', 'the soldier is crouching by order');
  crackBullet(s, u, 0);
  // A crouching soldier has no lower pose to drop into, but the near miss
  // still refreshes the duck window so they stay down under sustained fire.
  assert.ok(
    u.duckUntil !== undefined && u.duckUntil > s.time,
    'the duck window refreshes so the soldier stays down',
  );
  assert.equal(u.pose, 'crouch', 'the pose does not change — already crouching');
});

test('a prone soldier is not ducked', () => {
  const s = arena();
  const u = grunt(s);
  setOrder(s, 1, 'prone');
  run(s, 0.3);
  assert.equal(u.pose, 'prone', 'the soldier is prone by order');
  crackBullet(s, u, 0);
  assert.ok(
    u.duckUntil === undefined || u.duckUntil <= s.time,
    'a prone soldier has no lower pose to duck into',
  );
});

// --- combat continuity --------------------------------------------------------

test('ducking does not interrupt an ongoing burst', () => {
  const s = arena();
  const u = grunt(s);
  setOrder(s, 1, 'hold');
  run(s, 0.2);
  u.fire = 0.5;
  crackBullet(s, u, 0);
  run(s, 0.1);
  assert.equal(u.pose, 'crouch', 'the soldier ducks');
  assert.ok(
    u.fire > 0.1,
    `the burst keeps firing while ducking (fire=${u.fire.toFixed(3)})`,
  );
});

// --- sustained fire -----------------------------------------------------------

test('sustained fire keeps the soldier down, then a fresh round re-ducks', () => {
  const s = arena();
  const u = grunt(s);
  setOrder(s, 1, 'hold');
  run(s, 0.2);
  // First crack: soldier ducks.
  crackBullet(s, u, 0);
  run(s, 0.05);
  assert.equal(u.pose, 'crouch', 'first round ducks the soldier');
  const firstUntil = u.duckUntil;
  // Keep the fire coming before the window expires.
  while (s.time < firstUntil - 0.05) {
    crackBullet(s, u, 0);
    tick(s, DT);
  }
  assert.ok(
    u.duckUntil > firstUntil,
    'sustained fire refreshes the duck window',
  );
  assert.equal(u.pose, 'crouch', 'the soldier stays down under sustained fire');
  // Let the fire stop: the soldier should stand back up.
  while (s.time < u.duckUntil + 0.1) tick(s, DT);
  assert.ok(
    u.pose === 'idle' || u.pose === 'walk' || u.pose === 'run',
    `the soldier stands when the fire stops (was ${u.pose})`,
  );
  // A fresh cracking round drops them again.
  crackBullet(s, u, 0);
  run(s, 0.05);
  assert.equal(u.pose, 'crouch', 'a fresh near miss re-ducks the soldier');
});

// --- QA artifact ---------------------------------------------------------------

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);

const out = 'output/v67-near-miss-duck-qa';
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(
  `${out}/checks.json`,
  JSON.stringify({ results, failed: failed.map((f) => f.name) }, null, 2),
);

if (failed.length) {
  console.error(failed.map((f) => f.error).join('\n'));
  process.exit(1);
}
