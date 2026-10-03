import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, startGame, spawnUnit, tick, refreshVision, W } from '../game/engine.ts';
import { initializeAmmo, ammoSummary, ammoRatio, logisticsRatio, planAmmoResupply } from '../game/ammo-logistics.ts';
import { vehicleTravelX, hasVehicleFuel, VEHICLE_FUEL_RANGE } from '../game/vehicle-logistics.ts';

const DT = 1 / 30;
const direction = side => side ? -1 : 1;
const position = (side, x) => side ? W - x : x;
function arena(side = 0) {
  const s = createGame(197701 + side, undefined, undefined, undefined, { difficulty: 'standard', weather: false });
  startGame(s);
  Object.assign(s, { units: [], scenery: [], walls: [], wrecks: [], ammoCrates: [], aiIn: 1e9, night: false });
  s.terrain.fill(374); s.original.fill(374); s.weather.disabled = true;
  for (const p of s.players) Object.assign(p, { order: 'advance', hand: [], deck: [], discard: [], energy: 0 });
  return s;
}
function one(s, side, id = 'tank', distance = 1200, patch = {}) {
  const before = s.units.length, x = position(side, distance);
  spawnUnit(s, side, id, x, { member: 0 });
  const u = s.units[before]; s.units.splice(before + 1);
  Object.assign(u, { x, y: 374, lane: 0, pace: 1, motion: 'ground',
    squadOrder: 'attack', squadOrderUntil: Infinity, cooldown: 1e9, secondaryCooldown: 1e9,
    decisionIn: 1e9, tactic: 'advance', shots: 0, secondaryShots: 0, fragLeft: 0,
    personalMorale: 100, readyAt: -100, stillFor: 10, ...patch });
  initializeAmmo(u); return u;
}
function run(s, seconds, capture) {
  const end = s.time + seconds;
  while (s.time < end - 1e-8) { tick(s, Math.min(DT, end - s.time)); capture?.(); }
}
function crate(s, side, x, stock = 1800) {
  const c = { uid: ++s.uid, side, x, stock, maxStock: 1800, landAt: s.time, expiresAt: s.time + 300 };
  s.ammoCrates.push(c); return c;
}
const close = (a, b, message) => assert(Math.abs(a - b) < 1e-7, `${message}: ${a} versus ${b}`);

test('tank loads are finite and smaller, while fuel shares the thin indicator without consuming shells', () => {
  for (const [id, shells] of [['tank', 12], ['light_tank', 14], ['heavy_tank', 10], ['tow_ifv', 8]]) {
    const u = one(arena(), 0, id);
    assert.equal(ammoSummary(u)[0].total, shells);
    assert.equal(ammoSummary(u)[1].total, 500);
    u.fuel = 42; assert.equal(logisticsRatio(u), .42); assert.equal(ammoRatio(u), 1);
    u.ammo = 1; assert.equal(logisticsRatio(u), 1 / shells);
    initializeAmmo(u); assert.equal(u.fuel, 42, 'initialization cannot create fuel');
  }
  for (const id of ['infantry', 'artillery', 'anti_tank_gun', 'helicopter', 'attack_drone']) {
    const u = one(arena(), 0, id);
    assert.equal(hasVehicleFuel(u), false, id);
    assert.equal(vehicleTravelX(u, u.x + 100), u.x + 100); assert.equal(u.fuel, undefined);
  }
});

for (const side of [0, 1]) {
  test(`side ${side}: actual advance and manual withdrawal burn distance-proportional fuel, idle and broken tracks do not`, () => {
    const s = arena(side), u = one(s, side), d = direction(side), shells = u.ammo;
    const before = u.x; run(s, 3);
    assert((u.x - before) * d > 80, 'the actual engine must drive forward');
    close(u.fuel, 100 - Math.abs(u.x - before) / VEHICLE_FUEL_RANGE * 100, 'actual powered distance');
    assert.equal(u.ammo, shells); assert.equal(ammoRatio(u), 1); assert(logisticsRatio(u) < 1);
    u.squadOrder = 'watch'; u.squadOrderX = u.x;
    const fuel = u.fuel, idleX = u.x; run(s, 3);
    assert.equal(u.x, idleX); assert.equal(u.fuel, fuel);
    u.squadOrder = 'retreat'; u.squadOrderX = u.x - d * 160;
    run(s, 2);
    assert((idleX - u.x) * d > 20);
    close(u.fuel, fuel - Math.abs(idleX - u.x) / VEHICLE_FUEL_RANGE * 100, 'manual withdrawal distance');
    u.trackIntegrity = 0; const stopped = u.x, stoppedFuel = u.fuel;
    run(s, 2); assert.equal(u.x, stopped); assert.equal(u.fuel, stoppedFuel);
  });

  test(`side ${side}: reserve planning reaches base with fuel remaining, fills both stores, then resumes actual advance`, () => {
    const s = arena(side), u = one(s, side, 'tank', 1900), d = direction(side);
    // 42% is above the generic warning but needed to cover 1650px back to HQ.
    u.fuel = 42; const before = u.x; let arrived, released, arrivalFuel;
    for (let i = 0; i < 160 / DT; i++) {
      tick(s, DT);
      if (u.resupplyState === 'supplying' && arrived === undefined) { arrived = u.x; arrivalFuel = u.fuel; }
      if (arrived !== undefined && !u.resupplyState) { released = u.x; break; }
    }
    assert(arrived !== undefined, 'the vehicle must actually reach a supply circle');
    assert(arrivalFuel > 0, 'it must not exhaust its last fuel before reaching base');
    assert(Math.abs(arrived - position(side, 110)) <= 141);
    assert(released !== undefined, 'full refuelling must release the return order');
    // The release frame also starts a normal powered step, so allow only that
    // step of burn rather than accepting a partial refill in the safety latch.
    assert(u.fuel > 99.9); assert.equal(ammoRatio(u), 1);
    assert((before - released) * d > 1600);
    run(s, 2); assert((u.x - released) * d > 40); assert.equal(u.resupplyState, undefined);
  });

  test(`side ${side}: a dry hull cannot drive on any order but can defend with loaded weapons, then accepts an actual dropped supply`, () => {
    const s = arena(side), u = one(s, side, 'tank', 1200, { fuel: 0, cooldown: 0, secondaryCooldown: 0 });
    one(s, 1 - side, 'tank', W - 1650, { squadOrder: 'watch', squadOrderX: position(side, 1650), hp: 1e7, maxHp: 1e7 });
    refreshVision(s); const x = u.x;
    run(s, .5);
    assert.equal(u.x, x); assert.equal(u.resupplyState, 'waiting'); assert(u.shots > 0);
    u.squadOrder = 'retreat'; u.squadOrderX = x - direction(side) * 200; run(s, .2); assert.equal(u.x, x);
    u.squadOrder = 'watch'; u.squadOrderX = x + direction(side) * 100; run(s, .2); assert.equal(u.x, x);
    s.units = [u]; u.cooldown = 1e9;
    const box = crate(s, side, u.x), shellsMissing = 12 - u.ammo;
    run(s, 3); assert.equal(u.x, x); assert.equal(u.resupplyState, 'supplying');
    assert(u.fuel > 20 && u.fuel < 40); assert.equal(u.ammo, 12);
    close(1800 - box.stock, shellsMissing * 6 + u.fuel, 'box pays for every shell and fuel unit');
    run(s, 8); assert.equal(u.resupplyState, undefined); assert((u.x - x) * direction(side) > 0);
  });

  test(`side ${side}: supplies refill fuel with real stock and a partial or depleted source cannot release the retreat`, () => {
    const s = arena(side), u = one(s, side, 'tank', 1500, { fuel: 20.5 });
    const box = crate(s, side, u.x, 10);
    planAmmoResupply(s, u, 1);
    assert.equal(u.fuel, 30.5); assert.equal(box.stock, 0);
    assert.equal(u.resupplyState, 'withdrawing');
    assert.equal(u.resupplyGoal, position(side, 110));
    const supply = one(s, side, 'supply_team', 1510, { supplyStock: 400 });
    planAmmoResupply(s, u, 1); assert.equal(supply.supplyStock, 390); assert.equal(u.fuel, 40.5);
    assert.equal(u.resupplyState, 'supplying');
    u.fuel = 99.95; u.fuelSupplyProgress = 0;
    planAmmoResupply(s, u, .01); assert.equal(u.resupplyState, 'supplying', 'nearly full must not leave early');
    planAmmoResupply(s, u, .1); assert.equal(u.fuel, 100); assert.equal(u.resupplyState, undefined);
  });
}

test('the final powered step is clipped at the remaining fuel and never produces a negative store', () => {
  const u = { id: 'tank', x: 1000, fuel: .01 };
  u.x = vehicleTravelX(u, 1100);
  close(u.x, 1000.42, 'fuel-limited last step'); close(u.fuel, 0, 'empty fuel');
  assert.equal(vehicleTravelX(u, 1200), u.x);
});

test('AI pays for an actual supply airdrop for low fuel even when both weapons are fully loaded', () => {
  const s = arena(1), u = one(s, 1, 'tank', 1500, { fuel: 15 });
  const p = s.players[1], card = { id: 'ammo', uid: ++s.uid, readyAt: 0 };
  p.hand = [card]; p.energy = 10; p.drawIn = 1e9;
  refreshVision(s); s.aiIn = 0;
  tick(s, DT);
  assert.equal(ammoRatio(u), 1); assert.equal(p.played, 1);
  assert(!p.hand.includes(card)); assert.equal(p.energy, 8);
  assert.equal(s.ammoCrates.length, 1); assert.equal(s.ammoCrates[0].side, 1);
  assert(s.ammoCrates[0].landAt > s.time, 'supply still has its real landing delay');
});
