import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  refreshVision,
  visibleToSide,
  snapshot,
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

function arena(night = false) {
  const s = createGame(1, undefined, undefined, undefined, { night });
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

function squad(s, side, id, x) {
  const at = s.units.length;
  spawnUnit(s, side, id, x);
  return s.units.slice(at);
}

function flareAt(s, x, life = 10) {
  s.flares.push({
    x,
    y: 374 - 200,
    life,
    maxLife: 10,
    side: 0,
    seed: 42,
  });
}

// --- Darkness shrinks every eye on the field ---

test('night vision cuts sight range so a distant enemy disappears', () => {
  const day = arena(false);
  squad(day, 0, 'infantry', 600);
  const [dayEnemy] = squad(day, 1, 'infantry', 950);
  refreshVision(day);
  assert.equal(
    visibleToSide(day, 0, dayEnemy),
    true,
    '350px away should be seen in daylight (infantry sight 480)',
  );

  const night = arena(true);
  squad(night, 0, 'infantry', 600);
  const [nightEnemy] = squad(night, 1, 'infantry', 950);
  refreshVision(night);
  assert.equal(
    visibleToSide(night, 0, nightEnemy),
    false,
    '350px away must be hidden at night (night sight ~216)',
  );
});

// --- A shot in the dark betrays the shooter ---

test('muzzle flash exposes a shooter beyond night sight range', () => {
  const s = arena(true);
  squad(s, 0, 'infantry', 600);
  const [shooter] = squad(s, 1, 'infantry', 900);
  refreshVision(s);
  assert.equal(
    visibleToSide(s, 0, shooter),
    false,
    'enemy 300px away should be hidden before firing',
  );
  shooter.flashUntil = s.time + 0.9;
  refreshVision(s);
  assert.equal(
    visibleToSide(s, 0, shooter),
    true,
    'muzzle flash within 560px should expose the shooter',
  );
  // The flash fades fast — once it dies, the dark swallows him again.
  shooter.flashUntil = s.time - 0.01;
  refreshVision(s);
  assert.equal(
    visibleToSide(s, 0, shooter),
    false,
    'enemy should vanish again once the flash fades',
  );
});

test('firing stamps a muzzle flash timer only at night', () => {
  const night = arena(true);
  spawnUnit(night, 0, 'infantry', 620);
  spawnUnit(night, 1, 'infantry', 740);
  let flashed = false;
  for (let i = 0; i < 90; i++) {
    tick(night, 1 / 60);
    if (night.units.some((u) => (u.flashUntil ?? 0) > night.time)) flashed = true;
  }
  assert.equal(
    night.units.some((u) => u.shots > 0),
    true,
    'sanity: the infantry should have traded shots at 120px',
  );
  assert.equal(
    flashed,
    true,
    'night firefight must stamp flashUntil on the shooters',
  );

  const day = arena(false);
  spawnUnit(day, 0, 'infantry', 620);
  spawnUnit(day, 1, 'infantry', 740);
  for (let i = 0; i < 90; i++) tick(day, 1 / 60);
  assert.equal(
    day.units.some((u) => u.shots > 0),
    true,
    'sanity: the daytime duel should also produce shots',
  );
  assert.equal(
    day.units.every((u) => (u.flashUntil ?? 0) === 0),
    true,
    'daylight shots must not set a night flash timer',
  );
});

// --- Flares own the night ---

test('illumination flare reveals enemies hidden by darkness', () => {
  const s = arena(true);
  squad(s, 0, 'infantry', 600);
  const [enemy] = squad(s, 1, 'infantry', 950);
  refreshVision(s);
  assert.equal(
    visibleToSide(s, 0, enemy),
    false,
    'enemy should be hidden before the flare',
  );
  flareAt(s, 950);
  refreshVision(s);
  assert.equal(
    visibleToSide(s, 0, enemy),
    true,
    'flare within 260px should reveal the enemy at night',
  );
});

// --- The flag travels through the snapshot ---

test('snapshot carries the night flag', () => {
  assert.equal(snapshot(arena(true)).night, true);
  assert.equal(snapshot(arena(false)).night, false);
});

const failed = results.filter((r) => !r.ok);
for (const r of results) console.log(r.ok ? 'PASS' : 'FAIL', r.name, r.error ?? '');
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
