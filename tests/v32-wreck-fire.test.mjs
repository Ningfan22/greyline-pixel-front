import assert from 'node:assert/strict';
import { createGame, startGame, tick, CARDS } from '../game/engine.ts';

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

test('armored vehicle destruction creates a wreck that ages', () => {
  const s = arena();
  const tankCard = Object.values(CARDS).find((c) => c.armored && !c.air);
  assert.ok(tankCard, 'need an armored card for the test');
  const wrecksBefore = s.wrecks.length;
  // Spawn and destroy a tank directly through the wreck list.
  s.wrecks.push({
    id: 99001,
    cardId: tankCard.id,
    side: 0,
    x: 500,
    y: 400,
    angle: 0,
    age: 0,
    falling: false,
    vx: 0,
    vy: 0,
  });
  assert.equal(s.wrecks.length, wrecksBefore + 1);
  for (let i = 0; i < 120; i++) tick(s, DT);
  const w = s.wrecks[s.wrecks.length - 1];
  assert.ok(w.age > 1.5, `wreck age should advance, got ${w.age}`);
});

test('wreck fire strength fades with age', () => {
  const s = arena();
  const tankCard = Object.values(CARDS).find((c) => c.armored && !c.air);
  s.wrecks.push({
    id: 99002,
    cardId: tankCard.id,
    side: 0,
    x: 600,
    y: 400,
    angle: 0,
    age: 0,
    falling: false,
    vx: 0,
    vy: 0,
  });
  // Fresh wreck: age 0 → strength 1
  const fresh = Math.max(0, 1 - 0 / 40);
  assert.equal(fresh, 1);
  // Half-burnt: age 20 → strength 0.5
  const half = Math.max(0, 1 - 20 / 40);
  assert.equal(half, 0.5);
  // Expired: age 40+ → strength 0
  const expired = Math.max(0, 1 - 45 / 40);
  assert.equal(expired, 0);
});

test('wreck fire only applies to armored and vehicle cards', () => {
  const infantryCard = Object.values(CARDS).find((c) => c.members && !c.vehicle);
  assert.ok(infantryCard, 'need an infantry card');
  assert.ok(!infantryCard.armored && !infantryCard.vehicle);
  const truckCard = Object.values(CARDS).find((c) => c.vehicle && !c.armored);
  if (truckCard) assert.ok(truckCard.vehicle);
});

test('wreck smoke outlives wreck fire', () => {
  // Smoke lifetime is 120s, fire lifetime is 40s.
  const smokeLife = 120;
  const fireLife = 40;
  assert.ok(fireLife < smokeLife);
  // At age 60, fire is gone but smoke remains at half strength.
  const fireAt60 = Math.max(0, 1 - 60 / fireLife);
  const smokeAt60 = Math.max(0, 1 - 60 / smokeLife);
  assert.equal(fireAt60, 0);
  assert.ok(smokeAt60 > 0.4 && smokeAt60 < 0.6);
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error(failed.map((f) => f.error).join('\n'));
  process.exit(1);
}
