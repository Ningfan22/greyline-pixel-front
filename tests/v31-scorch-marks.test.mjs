import assert from 'node:assert/strict';
import { createGame, startGame, tick, explode, ground } from '../game/engine.ts';

const DT = 1 / 60;
const results = [];
function test(name, fn) {
  try {
    const value = fn();
    results.push({ name, ok: true, ...value });
    console.log('PASS', name);
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
    console.error('FAIL', name, error.message);
  }
}

function arena() {
  const s = createGame(31001);
  startGame(s);
  Object.assign(s, { units: [], scenery: [], walls: [], blasts: [], particles: [] });
  return s;
}

test('soil blast leaves a persistent scorch', () => {
  const s = arena();
  const x = 500;
  const before = s.scorches.length;
  explode(s, x, ground(s, x), 40, 0, 0);
  assert.equal(s.scorches.length, before + 1);
  const sc = s.scorches[s.scorches.length - 1];
  assert.ok(sc.radius > 0);
  assert.equal(Math.round(sc.x), Math.round(x));
});

test('air burst leaves no scorch', () => {
  const s = arena();
  const before = s.scorches.length;
  explode(s, 500, ground(s, 500) - 200, 20, 0, 0, 1, 1, 'air');
  assert.equal(s.scorches.length, before);
});

test('scorch count capped at 64', () => {
  const s = arena();
  for (let i = 0; i < 80; i++) {
    explode(s, 200 + i * 12, ground(s, 200 + i * 12), 30, 0, 0);
  }
  assert.ok(s.scorches.length <= 64);
});

test('scorch marks persist over time', () => {
  const s = arena();
  explode(s, 500, ground(s, 500), 40, 0, 0);
  const count = s.scorches.length;
  for (let i = 0; i < 600; i++) tick(s, DT);
  assert.equal(s.scorches.length, count);
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error(failed.map((f) => f.error).join('\n'));
  process.exit(1);
}
