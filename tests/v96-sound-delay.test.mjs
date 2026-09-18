import assert from 'node:assert/strict';
import { createGame, startGame, spawnUnit } from '../game/engine.ts';
import {
  SOUND_SPEED,
  NEAR_FIELD,
  MAX_DELAY,
  listenerDistance,
  soundDelay,
} from '../game/acoustics.ts';

const results = [],
  failures = [];

function check(name, fn) {
  try {
    const details = fn();
    results.push({ name, ...details });
    console.log('PASS', name);
  } catch (e) {
    failures.push({ name, error: e.stack });
    results.push({ name, ok: false, error: e.message });
    console.log('FAIL', name, e.message);
  }
}

// Flat open arena, AI director disabled (mirrors v91/v92/v95 harness).
function arena(seed = 96014) {
  const s = createGame(seed);
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
  s.aiIn = 1e9;
  return s;
}

// ---------------------------------------------------------------- pure

check('soundDelay: zero at the listener', () => {
  assert.equal(soundDelay(0), 0);
});

check('soundDelay: zero across the whole near field', () => {
  assert.equal(soundDelay(NEAR_FIELD), 0);
  assert.equal(soundDelay(NEAR_FIELD - 1), 0);
});

check('soundDelay: linear travel time beyond the near field', () => {
  // 1300 px outside the near field takes exactly 0.5 s at 2600 px/s.
  assert.ok(Math.abs(soundDelay(NEAR_FIELD + 1300) - 0.5) < 1e-9);
});

check('soundDelay: clamped at MAX_DELAY', () => {
  // One full second of travel time clamps down to 0.8 s.
  assert.equal(soundDelay(NEAR_FIELD + SOUND_SPEED), MAX_DELAY);
  assert.equal(soundDelay(100000), MAX_DELAY);
});

check('soundDelay: monotonic non-decreasing with distance', () => {
  let prev = -1;
  for (let d = 0; d <= 5000; d += 37) {
    const v = soundDelay(d);
    assert.ok(v >= prev, `decreased at d=${d}`);
    prev = v;
  }
});

check('soundDelay: always bounded to [0, MAX_DELAY]', () => {
  for (let d = 0; d <= 8000; d += 53) {
    const v = soundDelay(d);
    assert.ok(v >= 0 && v <= MAX_DELAY, `out of range at d=${d}: ${v}`);
  }
});

check('listenerDistance: zero at the screen centre', () => {
  assert.equal(listenerDistance(840, 200, 1280), 0);
});

check('listenerDistance: symmetric around the listener', () => {
  const cam = 200,
    w = 1280,
    c = cam + w / 2;
  assert.equal(listenerDistance(c + 500, cam, w), 500);
  assert.equal(
    listenerDistance(c + 500, cam, w),
    listenerDistance(c - 500, cam, w),
  );
});

// ------------------------------------------------------- engine integration

const CAMERA = 1400,
  WIDTH = 1280,
  LISTENER_X = CAMERA + WIDTH / 2;

check('integration: a unit under the camera is heard instantly', () => {
  const s = arena();
  spawnUnit(s, 0, 'tank', LISTENER_X);
  const u = s.units[s.units.length - 1];
  const delay = soundDelay(listenerDistance(u.x, CAMERA, WIDTH));
  assert.equal(delay, 0);
});

check('integration: a unit a screen and a half away lags ~0.5 s', () => {
  const s = arena();
  spawnUnit(s, 1, 'tank', LISTENER_X + 1500);
  const u = s.units[s.units.length - 1];
  const delay = soundDelay(listenerDistance(u.x, CAMERA, WIDTH));
  assert.ok(delay > 0.4 && delay < 0.6, `expected ~0.5 s, got ${delay}`);
});

check('integration: equidistant units on both flanks lag equally', () => {
  const s = arena();
  spawnUnit(s, 0, 'tank', LISTENER_X - 900);
  spawnUnit(s, 1, 'tank', LISTENER_X + 900);
  const [left, right] = s.units.slice(-2);
  const dLeft = soundDelay(listenerDistance(left.x, CAMERA, WIDTH));
  const dRight = soundDelay(listenerDistance(right.x, CAMERA, WIDTH));
  assert.ok(dLeft > 0 && dRight > 0, 'both flanks should lag');
  assert.equal(dLeft, dRight);
});

// ------------------------------------------------------------------ report

console.log(`\n${results.length - failures.length}/${results.length} passed`);
if (failures.length) {
  for (const f of failures) console.log('\n' + f.error);
  process.exit(1);
}
