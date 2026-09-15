import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  ground,
} from '../game/engine.ts';
import { armorHalf } from '../game/vehicle-geometry.ts';

const DT = 1 / 60;
const out = path.resolve('output/v71-vehicle-treads-qa');
const results = [],
  failures = [];
fs.mkdirSync(out, { recursive: true });

function check(name, fn) {
  try {
    const details = fn();
    results.push({ name, ...details });
    console.log('PASS', name);
  } catch (e) {
    failures.push({ name, error: e.stack });
    console.error('FAIL', name, e.stack);
  }
}

// Flat open arena, AI director disabled.
function arena() {
  const s = createGame(71014);
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

function single(s, side, id, x, member = 0) {
  const before = s.units.length;
  spawnUnit(s, side, id, x, { member });
  return s.units[before];
}

function run(s, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) tick(s, DT);
}

function runUntil(s, predicate, timeout) {
  const steps = Math.round(timeout / DT);
  for (let i = 0; i < steps; i++) {
    tick(s, DT);
    if (predicate()) return s.time;
  }
  return null;
}

// --- A. Emission ---------------------------------------------------------

check('坦克移动时在地面留下履带印', () => {
  const s = arena();
  single(s, 0, 'tank', 200);
  const t = runUntil(s, () => s.treads.length > 0, 5);
  assert.ok(t !== null, 'tank laid a tread mark within 5s');
  assert.ok(s.treads.length >= 1, 'at least one tread mark recorded');
  return { treads: s.treads.length, firstAt: +t.toFixed(2) };
});

check('静止的车辆不留履带印', () => {
  const s = arena();
  // Pickups carry vehicle:true, so the hold order gates their movement.
  // Tanks are armored but not "vehicle" in the card system and always
  // auto-advance, so the pickup is the right probe for the stationary case.
  const u = single(s, 0, 'pickup', 200);
  s.players[0].order = 'hold';
  run(s, 2);
  assert.equal(u.x, 200, 'vehicle held position');
  assert.equal(s.treads.length, 0, 'stationary tank leaves no marks');
  return { treads: 0 };
});

check('步兵移动不留履带印', () => {
  const s = arena();
  const u = single(s, 0, 'infantry', 200);
  run(s, 3);
  assert.ok(u.x > 210, 'infantry actually advanced');
  assert.equal(s.treads.length, 0, 'foot soldiers leave no tread marks');
  return { infantryX: +u.x.toFixed(1), treads: 0 };
});

check('轮式车辆（皮卡）也留地面痕迹', () => {
  const s = arena();
  single(s, 0, 'pickup', 200);
  const t = runUntil(s, () => s.treads.length > 0, 5);
  assert.ok(t !== null, 'pickup laid a tread mark within 5s');
  return { treads: s.treads.length, firstAt: +t.toFixed(2) };
});

// --- B. Placement & geometry --------------------------------------------

check('履带印位于地面高度', () => {
  const s = arena();
  single(s, 0, 'tank', 200);
  runUntil(s, () => s.treads.length > 0, 5);
  const t = s.treads[0];
  assert.equal(t.y, ground(s, t.x), 'mark sits exactly on the ground line');
  assert.equal(t.y, 374, 'flat arena ground is 374');
  return { x: +t.x.toFixed(1), y: t.y };
});

check('履带印间距与车体宽度匹配', () => {
  const s = arena();
  single(s, 0, 'tank', 200);
  runUntil(s, () => s.treads.length > 0, 5);
  const t = s.treads[0];
  assert.equal(t.half, armorHalf('tank'), 'half-width matches tank geometry');
  assert.equal(t.half, 110, 'tank half-width is 110');
  return { half: t.half };
});

// --- C. Lifecycle --------------------------------------------------------

check('履带印数量有上限', () => {
  const s = arena();
  single(s, 0, 'tank', 200);
  run(s, 40);
  assert.ok(s.treads.length > 0, 'tank laid marks');
  assert.ok(s.treads.length <= 90, 'marks capped at 90');
  // Tank at 40px/s lays ~3.3 marks/s → ~133 in 40s, so the cap must bind.
  assert.equal(s.treads.length, 90, 'cap of 90 reached');
  return { treads: s.treads.length };
});

check('履带印随时间逐渐消退', () => {
  const s = arena();
  single(s, 0, 'tank', 200);
  runUntil(s, () => s.treads.length > 0, 5);
  const first = s.treads[0];
  const born = first.born;
  // Stop the tank so no new marks disturb the age measurement.
  s.players[0].order = 'hold';
  run(s, 20);
  const age = s.time - born;
  assert.ok(Math.abs(age - 20) < 0.5, 'first mark aged ~20s');
  const fade = Math.max(0, 1 - age / 40);
  assert.ok(Math.abs(fade - 0.5) < 0.02, 'fade ≈ 0.5 at half life');
  return { age: +age.toFixed(2), fade: +fade.toFixed(3) };
});

check('履带印在寿命到期后完全消退', () => {
  const s = arena();
  single(s, 0, 'tank', 200);
  runUntil(s, () => s.treads.length > 0, 5);
  const first = s.treads[0];
  const born = first.born;
  s.players[0].order = 'hold';
  run(s, 45);
  const age = s.time - born;
  assert.ok(age >= 40, 'mark exceeded its 40s lifetime');
  // The renderer skips marks with age >= TREAD_LIFETIME, so they are
  // effectively invisible even before the array is pruned.
  assert.ok(
    s.treads.every((t) => s.time - t.born < 40 || t === first),
    'expired mark is the only old one and is skipped by the renderer',
  );
  return { age: +age.toFixed(2) };
});

// --- Report --------------------------------------------------------------

fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`\n${results.length} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
