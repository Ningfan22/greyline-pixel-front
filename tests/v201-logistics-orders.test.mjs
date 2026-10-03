import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, startGame, spawnUnit, tick, refreshVision, W } from '../game/engine.ts';
import { ammoRatio, initializeAmmo, planAmmoResupply } from '../game/ammo-logistics.ts';
import { issueLogisticsOrder, logisticsAlert, logisticsNeedsDecision } from '../game/logistics-orders.ts';
import { VEHICLE_FUEL_RANGE } from '../game/vehicle-logistics.ts';

const DT = 1 / 30;
const direction = side => side ? -1 : 1;
const position = (side, distance) => side ? W - distance : distance;
function arena() {
  const s = createGame(201301, undefined, undefined, undefined, { difficulty: 'standard', weather: false });
  startGame(s);
  Object.assign(s, { units: [], scenery: [], walls: [], wrecks: [], ammoCrates: [], aiIn: 1e9, night: false });
  s.terrain.fill(374); s.original.fill(374); s.weather.disabled = true;
  for (const p of s.players) Object.assign(p, { order: 'advance', hand: [], deck: [], discard: [], energy: 0 });
  return s;
}
function one(s, side = 0, id = 'tank', distance = 1200, patch = {}) {
  const before = s.units.length, x = position(side, distance);
  spawnUnit(s, side, id, x, { member: 0 });
  const u = s.units[before]; s.units.splice(before + 1);
  Object.assign(u, { x, y: 374, lane: 0, pace: 1, motion: 'ground',
    squadOrder: 'attack', squadOrderUntil: Infinity, cooldown: 1e9, secondaryCooldown: 1e9,
    decisionIn: 1e9, tactic: 'advance', shots: 0, secondaryShots: 0, fragLeft: 0,
    personalMorale: 100, readyAt: -100, stillFor: 10, ...patch });
  initializeAmmo(u); return u;
}
function run(s, seconds) {
  const end = s.time + seconds;
  while (s.time < end - 1e-8) tick(s, Math.min(DT, end - s.time));
}
function crate(s, u, stock = 1800) {
  const box = { uid: ++s.uid, side: u.side, x: u.x, stock, maxStock: 1800, landAt: s.time, expiresAt: s.time + 300 };
  s.ammoCrates.push(box); return box;
}
function target(s, u, distance = 370) {
  const foe = one(s, 1 - u.side, u.id === 'infantry' ? 'infantry' : 'tank', W - (u.side === 0 ? u.x : W - u.x) - distance,
    { hp: 1e7, maxHp: 1e7, squadOrder: 'watch' });
  foe.squadOrderX = foe.x; refreshVision(s); return foe;
}

test('half fuel warns without changing the previous advance or spending shells', () => {
  const s = arena(), u = one(s, 0, 'tank', 1900, { fuel: 50.01 });
  assert.equal(logisticsAlert(u), null);
  u.fuel = 50; const x = u.x, shells = u.ammo;
  assert.deepEqual(logisticsAlert(u), { fuel: true, ammo: false, stock: false, reason: '燃油不足' });
  assert.equal(logisticsNeedsDecision(u), true);
  run(s, 3);
  assert(u.x > x + 60); assert.equal(u.resupplyState, undefined);
  assert.equal(u.squadOrder, 'attack'); assert.equal(u.ammo, shells);
  assert(Math.abs(u.fuel - (50 - (u.x - x) / VEHICLE_FUEL_RANGE * 100)) < 1e-7);
});

test('an unanswered low-ammo warning preserves an existing watch position', () => {
  const s = arena(), u = one(s, 0, 'infantry', 1400,
    { ammo: 27, ammoReserve: 0, squadOrder: 'watch', squadOrderX: 1400 });
  run(s, 3);
  assert.equal(u.x, 1400); assert.equal(u.squadOrder, 'watch');
  assert.equal(u.resupplyState, undefined); assert.equal(logisticsNeedsDecision(u), true);
  assert.equal(logisticsAlert(u).ammo, true);
});

for (const id of ['tank', 'infantry']) {
  test(`${id}: continue advance acknowledges the warning and stays out of automatic supply retreat`, () => {
    const s = arena(), u = one(s, 0, id, 1400,
      id === 'tank' ? { fuel: 31, ammo: 3 } : { ammo: 27, ammoReserve: 0 });
    assert(issueLogisticsOrder(s, u.uid, 'advance'));
    const x = u.x; run(s, 4);
    assert(u.x > x + 30); assert.equal(u.resupplyState, undefined);
    assert.equal(u.logisticsOrder, 'advance'); assert.equal(logisticsNeedsDecision(u), false);
    assert(logisticsAlert(u), 'the acknowledged marker remains available for another choice');
  });

  test(`${id}: hold remains stationary while still firing at a real target`, () => {
    const s = arena(), u = one(s, 0, id, 1400,
      id === 'tank' ? { fuel: 40, cooldown: 0 } : { ammo: 27, ammoReserve: 0, cooldown: 0 });
    target(s, u, id === 'tank' ? 370 : 270);
    assert(issueLogisticsOrder(s, u.uid, 'hold'));
    const x = u.x; run(s, 5);
    assert.equal(u.x, x); assert(u.shots > 0, 'hold must retain the firing path');
    assert.equal(u.resupplyState, undefined); assert.equal(u.logisticsOrder, 'hold');
    assert.equal(logisticsNeedsDecision(u), false);
  });
}

test('a chosen return can be changed to hold and then advance while resources remain low', () => {
  const s = arena(), u = one(s, 0, 'tank', 1200, { fuel: 40 });
  assert(issueLogisticsOrder(s, u.uid, 'resupply')); run(s, 2);
  assert(u.x < 1200); assert.equal(u.resupplyState, 'withdrawing');
  assert(issueLogisticsOrder(s, u.uid, 'hold')); const stopped = u.x; run(s, 2);
  assert.equal(u.x, stopped); assert.equal(u.resupplyState, undefined);
  assert(issueLogisticsOrder(s, u.uid, 'advance')); run(s, 2);
  assert(u.x > stopped + 30); assert.equal(u.resupplyState, undefined);
});

for (const side of [0, 1]) {
  test(`side ${side}: ${side ? 'AI automatic' : 'player chosen'} supply return reaches base, fills both stores and resumes`, () => {
    const s = arena(), u = one(s, side, 'tank', 700, { fuel: 25, ammo: 1 });
    if (!side) assert(issueLogisticsOrder(s, u.uid, 'resupply'));
    let arrived, released;
    for (let i = 0; i < 70 / DT; i++) {
      tick(s, DT);
      if (u.resupplyState === 'supplying') arrived ??= u.x;
      if (arrived !== undefined && !u.resupplyState) { released = u.x; break; }
    }
    assert(arrived !== undefined); assert(Math.abs(arrived - position(side, 110)) <= 141);
    assert(released !== undefined); assert(u.fuel > 99.9); assert.equal(ammoRatio(u), 1);
    assert.equal(u.logisticsOrder, undefined); assert.equal(u.logisticsWarning, undefined);
    assert.equal(logisticsAlert(u), null);
    run(s, 2); assert((u.x - released) * direction(side) > 30);
    if (!side) { u.fuel = 50; assert.equal(logisticsNeedsDecision(u), true); }
  });
}

test('a depleted nearby crate cannot prematurely finish the chosen resupply', () => {
  const s = arena(), u = one(s, 0, 'tank', 1400, { fuel: 20.5 });
  const box = crate(s, u, 10);
  assert(issueLogisticsOrder(s, u.uid, 'resupply')); planAmmoResupply(s, u, 1);
  assert.equal(u.fuel, 30.5); assert.equal(box.stock, 0);
  assert.equal(u.resupplyState, 'withdrawing'); assert.equal(u.resupplyGoal, 110);
  assert.equal(u.logisticsOrder, 'resupply'); assert(logisticsAlert(u));
});

test('a static gun offers hold or supply in place, and can never invent ammunition', () => {
  const s = arena(), u = one(s, 0, 'artillery', 1200, { ammo: 0, ammoReserve: 0, cooldown: 0, emplaced: false });
  assert.equal(issueLogisticsOrder(s, u.uid, 'advance'), false);
  assert(issueLogisticsOrder(s, u.uid, 'hold')); run(s, 2);
  assert.equal(u.x, 1200); assert.equal(u.shots, 0);
  assert(issueLogisticsOrder(s, u.uid, 'resupply')); run(s, 2);
  assert.equal(u.x, 1200); assert.equal(u.resupplyState, 'waiting');
  crate(s, u); run(s, 2);
  assert.equal(u.x, 1200); assert.equal(u.resupplyState, 'supplying'); assert(u.ammo > 0);
});

test('a dry tank remains immobile for all three choices and an empty weapon never fires', () => {
  const s = arena(), u = one(s, 0, 'tank', 1400,
    { fuel: 0, ammo: 0, ammoReserve: 0, secondaryAmmo: 0, secondaryAmmoReserve: 0, cooldown: 0, secondaryCooldown: 0 });
  target(s, u);
  for (const order of ['advance', 'hold', 'resupply']) {
    assert(issueLogisticsOrder(s, u.uid, order)); run(s, 1);
    assert.equal(u.x, 1400); assert.equal(u.shots, 0); assert.equal(u.secondaryShots, 0);
  }
  assert.equal(u.resupplyState, 'waiting');
});

test('supply stock is a decision too, while enemy, airborne and dead units cannot take player logistics orders', () => {
  const s = arena(), supply = one(s, 0, 'supply_team', 1200, { supplyStock: 120 });
  assert.equal(logisticsAlert(supply).stock, true); assert(issueLogisticsOrder(s, supply.uid, 'hold'));
  for (const u of [one(s, 1, 'tank', 1400, { fuel: 10 }),
    one(s, 0, 'helicopter'), one(s, 0, 'tank', 1300, { hp: 0, fuel: 10 })]) {
    assert.equal(logisticsAlert(u), null); assert.equal(issueLogisticsOrder(s, u.uid, 'hold'), false);
  }
});
