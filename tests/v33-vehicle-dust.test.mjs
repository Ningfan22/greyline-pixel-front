import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  setOrder,
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

function arena() {
  const s = createGame(32001);
  startGame(s);
  return s;
}

function run(s, frames) {
  for (let i = 0; i < frames; i++) tick(s, DT);
}

function dust(s) {
  return s.particles.filter((p) => p.kind === 'dust');
}

test('moving armored vehicle kicks up heavy v33 dust', () => {
  const s = arena();
  spawnUnit(s, 0, 'tank', 400);
  setOrder(s, 0, 'rush');
  run(s, 300);
  const d = dust(s);
  assert.ok(d.length > 0, 'tank should leave dust particles');
  // v33 vehicle dust: size 8-18, life 0.8-1.5s — far heavier than foot puffs.
  assert.ok(
    d.every((p) => p.size >= 8 && p.maxLife >= 0.8),
    'vehicle dust should be large and long-lived',
  );
});

test('vehicle dust trails behind the direction of travel', () => {
  const s = arena();
  spawnUnit(s, 0, 'tank', 400);
  setOrder(s, 0, 'rush');
  run(s, 300);
  const tank = s.units.find((u) => u.id === 'tank');
  assert.equal(tank.facing, 1);
  const d = dust(s);
  assert.ok(d.length > 0, 'need dust to inspect');
  // Facing right → every dust particle drifts left (vx <= 0) and spawns behind.
  assert.ok(
    d.every((p) => p.vx <= 0.01),
    'dust should drift backward relative to facing',
  );
});

test('vehicle dust is substantially heavier than infantry foot dust', () => {
  const s = arena();
  spawnUnit(s, 0, 'infantry', 400);
  setOrder(s, 0, 'rush');
  run(s, 300);
  const infantryDust = dust(s);
  assert.ok(infantryDust.length > 0, 'infantry should leave foot dust');
  const infantryMaxSize = Math.max(...infantryDust.map((p) => p.size));
  const infantryMaxLife = Math.max(...infantryDust.map((p) => p.maxLife));

  const s2 = arena();
  spawnUnit(s2, 0, 'tank', 400);
  setOrder(s2, 0, 'rush');
  run(s2, 300);
  const vehicleDust = dust(s2);
  assert.ok(vehicleDust.length > 0, 'tank should leave dust');
  const vehicleMinSize = Math.min(...vehicleDust.map((p) => p.size));
  const vehicleMinLife = Math.min(...vehicleDust.map((p) => p.maxLife));

  assert.ok(
    vehicleMinSize > infantryMaxSize,
    `smallest vehicle dust (${vehicleMinSize.toFixed(1)}) should exceed largest foot dust (${infantryMaxSize.toFixed(1)})`,
  );
  assert.ok(
    vehicleMinLife > infantryMaxLife,
    `shortest vehicle dust life (${vehicleMinLife.toFixed(2)}s) should exceed longest foot dust (${infantryMaxLife.toFixed(2)}s)`,
  );
});

test('vehicle on hold order produces no movement dust', () => {
  const s = arena();
  spawnUnit(s, 0, 'pickup', 400);
  setOrder(s, 0, 'hold');
  const before = dust(s).length;
  run(s, 300);
  const after = dust(s).filter((p) => p.size >= 8);
  assert.equal(
    after.length,
    before,
    'held vehicle should not kick up movement dust',
  );
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error(failed.map((f) => f.error).join('\n'));
  process.exit(1);
}
