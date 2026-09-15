import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
} from '../game/engine.ts';
import { unitSynergy, synergyProviderUid } from '../game/synergy.ts';

const DT = 1 / 60;
const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}

function battle(seed = 48001) {
  const s = createGame(seed);
  startGame(s);
  Object.assign(s, { scenery: [], walls: [], wrecks: [] });
  s.players.forEach((p) => (p.order = 'hold'));
  return s;
}

function spawnOne(s, side, id, x) {
  const before = s.units.length;
  spawnUnit(s, side, id, x);
  const u = s.units.slice(before).find((v) => v.id === id);
  u.x = x;
  return u;
}

function makeWounded(u) {
  u.wounded = true;
  u.hp = Math.floor(u.maxHp * 0.25);
  u.woundedTime = 3;
  u.bleedOut = 30;
  u.draggedByUid = undefined;
  u.rescuedAt = -99;
}

// --- armor_assault ----------------------------------------------------------

test('armor_assault: tank near infantry activates; moving away deactivates', () => {
  const s = battle();
  const tank = spawnOne(s, 0, 'tank', 400);
  const inf = spawnOne(s, 0, 'infantry', 500);
  tick(s, DT);
  assert.equal(unitSynergy(s, inf, s.time).armor_assault, true);
  assert.equal(
    synergyProviderUid(s, inf, 'armor_assault', s.time),
    tank.uid,
  );
  tank.x = 2000;
  tick(s, DT);
  s.time += 1; // force cache expiry past the 0.4-0.6s stagger
  assert.equal(unitSynergy(s, inf, s.time).armor_assault, false);
});

test('armor_assault: unarmored pickup does not activate', () => {
  const s = battle();
  spawnOne(s, 0, 'pickup', 400);
  const inf = spawnOne(s, 0, 'infantry', 500);
  tick(s, DT);
  assert.equal(unitSynergy(s, inf, s.time).armor_assault, false);
});

test('armor_assault: deactivates when the tank dies', () => {
  const s = battle();
  const tank = spawnOne(s, 0, 'tank', 400);
  const inf = spawnOne(s, 0, 'infantry', 500);
  tick(s, DT);
  assert.equal(unitSynergy(s, inf, s.time).armor_assault, true);
  tank.hp = 0;
  s.time += 1;
  assert.equal(unitSynergy(s, inf, s.time).armor_assault, false);
});

// --- fire_base ---------------------------------------------------------------

test('fire_base: MG team covers nearby infantry but never itself', () => {
  const s = battle();
  const mg = spawnOne(s, 0, 'machinegun', 400);
  const inf = spawnOne(s, 0, 'infantry', 600);
  tick(s, DT);
  assert.equal(unitSynergy(s, inf, s.time).fire_base, true);
  assert.equal(unitSynergy(s, mg, s.time).fire_base, false);
});

// --- medevac_chain -----------------------------------------------------------

test('medevac_chain: only active for wounded infantry near a medic', () => {
  const s = battle();
  spawnOne(s, 0, 'medic', 450);
  const inf = spawnOne(s, 0, 'infantry', 615);
  tick(s, DT);
  assert.equal(unitSynergy(s, inf, s.time).medevac_chain, false);
  makeWounded(inf);
  s.time += 1;
  assert.equal(unitSynergy(s, inf, s.time).medevac_chain, true);
});

// --- behavioural effects ------------------------------------------------------

test('armor_assault: infantry sheds suppression 1.6x faster near armor', () => {
  const withTank = battle(48006);
  spawnOne(withTank, 0, 'tank', 400);
  const infA = spawnOne(withTank, 0, 'infantry', 500);
  tick(withTank, DT);
  infA.suppression = 50;

  const noTank = battle(48007);
  const infB = spawnOne(noTank, 0, 'infantry', 500);
  tick(noTank, DT);
  infB.suppression = 50;

  for (let i = 0; i < 10; i++) {
    tick(withTank, DT);
    tick(noTank, DT);
  }
  assert.ok(
    infA.suppression < infB.suppression,
    `expected ${infA.suppression.toFixed(2)} < ${infB.suppression.toFixed(2)}`,
  );
  assert.ok(
    infB.suppression - infA.suppression > 0.4,
    `difference ${(infB.suppression - infA.suppression).toFixed(2)} too small`,
  );
});

test('medevac_chain: wounded infantry crawls 1.35x faster near a medic', () => {
  const withMedic = battle(48008);
  spawnOne(withMedic, 0, 'medic', 450);
  const infA = spawnOne(withMedic, 0, 'infantry', 615);
  tick(withMedic, DT);
  makeWounded(infA);
  withMedic.time += 1; // force synergy recompute now that inf is wounded
  const x0a = infA.x;
  for (let i = 0; i < 30; i++) tick(withMedic, DT);
  const crawledA = x0a - infA.x;

  const noMedic = battle(48009);
  const infB = spawnOne(noMedic, 0, 'infantry', 615);
  tick(noMedic, DT);
  makeWounded(infB);
  noMedic.time += 1;
  const x0b = infB.x;
  for (let i = 0; i < 30; i++) tick(noMedic, DT);
  const crawledB = x0b - infB.x;

  assert.ok(
    crawledA > 5.5,
    `with medic crawled ${crawledA.toFixed(2)}, expected > 5.5`,
  );
  assert.ok(
    crawledB >= 4.0 && crawledB <= 5.0,
    `no medic crawled ${crawledB.toFixed(2)}, expected 4.0-5.0`,
  );
});

// --- cache --------------------------------------------------------------------

test('synergy cache returns the same object within the refresh window', () => {
  const s = battle();
  spawnOne(s, 0, 'tank', 400);
  const inf = spawnOne(s, 0, 'infantry', 500);
  tick(s, DT);
  const a = unitSynergy(s, inf, s.time);
  const b = unitSynergy(s, inf, s.time);
  assert.equal(a, b);
});

// --- report -------------------------------------------------------------------

let failed = 0;
for (const r of results) {
  if (r.ok) console.log(`ok - ${r.name}`);
  else {
    failed++;
    console.error(`FAIL - ${r.name}: ${r.error}`);
  }
}
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
