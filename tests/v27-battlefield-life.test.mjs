import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  CARDS,
} from '../game/engine.ts';

const results = [];
function test(name, fn) {
  try {
    const value = fn();
    results.push({ name, ok: true, ...value });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}

function arena() {
  const s = createGame(1);
  startGame(s);
  s.terrain.fill(374);
  s.original.fill(374);
  s.walls = [];
  s.scenery = [];
  s.players[1].deck = [];
  s.players[1].discard = [];
  s.players[1].hand = [];
  s.players[1].energy = 0;
  s.players[1].played = 0;
  s.aiIn = 1e6;
  return s;
}

function squad(s, side, id, x) {
  const at = s.units.length;
  spawnUnit(s, side, id, x);
  return s.units.slice(at);
}

// Counts dust particles spawned while the predicate holds.
function dustWhile(s, seconds, predicate) {
  let dust = 0;
  const dt = 0.05;
  for (let t = 0; t < seconds; t += dt) {
    tick(s, dt);
    if (predicate())
      for (const p of s.particles) if (p.kind === 'dust') dust++;
  }
  return dust;
}

test('moving infantry kick up footstep dust', () => {
  const s = arena();
  const inf = squad(s, 0, 'infantry', 300);
  for (const u of inf) u.squadOrder = 'advance';
  const startX = inf[0].x;
  const dust = dustWhile(s, 6, () => inf.some((u) => u.moving));
  const moved = inf.some((u) => u.x > startX + 40);
  assert.ok(moved, 'infantry should have advanced');
  assert.ok(dust > 20, `expected footstep dust, got ${dust}`);
  return { dust, moved: inf[0].x.toFixed(0) };
});

test('stationary infantry do not kick up footstep dust', () => {
  const s = arena();
  const inf = squad(s, 0, 'infantry', 300);
  for (const u of inf) {
    u.squadOrder = 'hold';
    u.holdLane = u.lane;
  }
  // No enemy, no advance order: units should stand still.
  const dust = dustWhile(s, 4, () => !inf.some((u) => u.moving));
  assert.ok(dust === 0, `expected no footstep dust while idle, got ${dust}`);
  return { dust };
});

test('moving vehicles kick up heavier dust trails', () => {
  const s = arena();
  const veh = squad(s, 0, 'ifv', 300);
  // Ground vehicles use the 'attack' (前进) order to move forward; 'advance'
  // is infantry-only and would park the vehicle under stepUnitControl.
  for (const u of veh) u.squadOrder = 'attack';
  const startX = veh[0].x;
  const dust = dustWhile(s, 6, () => veh.some((u) => u.moving));
  const moved = veh.some((u) => u.x > startX + 40);
  assert.ok(moved, 'vehicle should have advanced');
  assert.ok(dust > 20, `expected vehicle dust, got ${dust}`);
  return { dust, moved: veh[0].x.toFixed(0) };
});

test('particle count stays within budget under dust load', () => {
  const s = arena();
  // Two full infantry squads advancing at each other to maximise footsteps.
  squad(s, 0, 'infantry', 300).forEach((u) => (u.squadOrder = 'advance'));
  squad(s, 1, 'infantry', 1500).forEach((u) => (u.squadOrder = 'advance'));
  let peak = 0;
  const dt = 0.05;
  for (let t = 0; t < 8; t += dt) {
    tick(s, dt);
    peak = Math.max(peak, s.particles.length);
  }
  assert.ok(peak <= 700, `particle budget exceeded: ${peak}`);
  return { peak };
});

console.log(JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.ok);
if (failed.length) {
  console.error(`${failed.length} test(s) failed`);
  process.exit(1);
}
