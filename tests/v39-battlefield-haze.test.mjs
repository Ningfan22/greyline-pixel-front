import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  spawnUnit,
  setOrder,
  tick,
  refreshVision,
  W,
} from '../game/engine.ts';

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

function arena(seed = 39001) {
  const s = createGame(seed);
  startGame(s);
  s.aiIn = 1e6;
  s.terrain.fill(374);
  s.original.fill(374);
  s.scenery = [];
  s.walls = [];
  return s;
}

function solo(s, side, id, x) {
  const before = s.units.length;
  spawnUnit(s, side, id, x);
  const u = s.units[before];
  Object.assign(u, {
    x,
    y: 374,
    cooldown: 0,
    decisionIn: 1e6,
    pace: 1,
    tactic: 'advance',
  });
  return u;
}

function run(s, seconds) {
  for (let i = 0; i < Math.round(seconds * 60); i++) tick(s, DT);
}

function duel(s, shooterId, x0 = 400, gap = 250) {
  const a = solo(s, 0, shooterId, x0);
  const enemyStart = s.units.length;
  const b = solo(s, 1, 'infantry', x0 + gap);
  // Pacify every member of the enemy squad, not just the first: stray
  // rifle fire would suppress the gun team and skew the haze timeline.
  for (let i = enemyStart; i < s.units.length; i++) {
    const e = s.units[i];
    e.cooldown = 1e6;
    e.hp = e.maxHp = 100000;
  }
  for (const side of [0, 1]) setOrder(s, side, 'hold');
  refreshVision(s);
  tick(s, DT);
  return a;
}

const haze = (s) => s.particles.filter((p) => p.kind === 'haze');
const sturdiest = (s) =>
  haze(s).reduce((best, p) => (p.life > (best?.life ?? -1) ? p : best), null);

// --- sustained fire builds lingering gunsmoke --------------------------------

test('sustained machinegun fire spawns long-lived haze palls', () => {
  const s = arena();
  duel(s, 'machinegun');
  run(s, 5);
  const palls = haze(s);
  assert.ok(palls.length > 0, 'a sustained MG burst should leave haze over the position');
  for (const p of palls) {
    assert.ok(p.maxLife >= 6, `haze should linger for seconds, got maxLife ${p.maxLife}`);
    assert.ok(p.life > 1, 'haze should still be alive well after the burst');
  }
});

test('a brief rifle exchange produces no haze', () => {
  const s = arena();
  duel(s, 'infantry');
  run(s, 1.5);
  assert.equal(
    haze(s).length,
    0,
    'a shot or two of rifle fire should not build a smoke pall',
  );
});

test('a long firefight accumulates multiple drifting palls', () => {
  const s = arena();
  duel(s, 'machinegun');
  run(s, 14);
  assert.ok(
    haze(s).length >= 3,
    `a 14s firefight should stack several haze palls, got ${haze(s).length}`,
  );
});

// --- haze physics --------------------------------------------------------------

test('haze drifts downwind across the battlefield', () => {
  const s = arena();
  // Pin the wind system so the gust does not decay mid-measurement.
  s.wind = 46;
  s.windTarget = 46;
  s.windIn = 1e6;
  duel(s, 'machinegun');
  run(s, 7);
  const pall = sturdiest(s);
  assert.ok(pall, 'need haze to measure drift');
  const x0 = pall.x;
  run(s, 2);
  const moved = pall.x - x0;
  assert.ok(
    moved > 40,
    `strong wind should carry haze well downwind, moved ${moved.toFixed(1)}px`,
  );
});

test('haze rises slowly as it lingers', () => {
  const s = arena();
  s.wind = 0;
  s.windTarget = 0;
  s.windIn = 1e6;
  duel(s, 'machinegun');
  run(s, 7);
  const pall = sturdiest(s);
  assert.ok(pall, 'need haze to measure rise');
  const y0 = pall.y;
  run(s, 2);
  assert.ok(
    pall.y < y0 - 2,
    `haze should buoy upward over time, y ${y0.toFixed(1)} -> ${pall.y.toFixed(1)}`,
  );
});

// --- heat model -----------------------------------------------------------------

test('gunsmoke heat decays during lulls so a later burst starts fresh', () => {
  const s = arena();
  const gun = duel(s, 'machinegun');
  run(s, 4);
  assert.ok(haze(s).length > 0, 'the first burst should have built haze');
  // Silence the guns: remove the target so the team stops firing.
  s.units = s.units.filter((u) => u.side === 0);
  run(s, 9);
  const staleHeat = gun.heat ?? 0;
  // A fresh target appears. Heat decayed lazily, so the first shots must not haze.
  const b = solo(s, 1, 'infantry', gun.x + 250);
  b.cooldown = 1e6;
  b.hp = b.maxHp = 100000;
  setOrder(s, 1, 'hold');
  refreshVision(s);
  run(s, 1.2);
  const decayed =
    (gun.heat ?? 0) < staleHeat * 0.6 + 0.5
      ? true
      : (gun.heat ?? 0) < 3;
  assert.ok(
    decayed,
    `heat should decay through the lull (stale ${staleHeat.toFixed(2)}, now ${(gun.heat ?? 0).toFixed(2)})`,
  );
});

const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `\n${failed.length}/${results.length} failed`
    : `\n${results.length}/${results.length} passed`,
);
process.exit(failed.length ? 1 : 0);
