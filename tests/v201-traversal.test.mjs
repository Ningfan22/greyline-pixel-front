import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, startGame, spawnUnit, tick, refreshVision, ground, vehicleContact, visibleToSide, W } from '../game/engine.ts';
import { initializeAmmo } from '../game/ammo-logistics.ts';
import { issueLogisticsOrder } from '../game/logistics-orders.ts';
import { setSquadOrder } from '../game/squad-orders.ts';
import { CARDS } from '../game/cards.ts';
import { VEHICLE_FUEL_RANGE } from '../game/vehicle-logistics.ts';

const DT = 1 / 30;
const dir = side => side ? -1 : 1;
const pos = (side, x) => side ? W - x : x;
function arena(side = 0, profile = () => 374) {
  const s = createGame(201801 + side, undefined, undefined, undefined, { difficulty: 'standard', weather: false });
  startGame(s);
  Object.assign(s, { units: [], scenery: [], walls: [], wrecks: [], ammoCrates: [], aiIn: 1e9, night: false });
  for (let x = 0; x < W; x++) s.terrain[x] = profile(pos(side, x));
  s.original = [...s.terrain]; s.terrainVersion++;
  s.weather.disabled = true;
  for (const p of s.players) Object.assign(p, { order: 'advance', hand: [], deck: [], discard: [], energy: 0 });
  return s;
}
function one(s, side, id, x, patch = {}) {
  const at = s.units.length;
  spawnUnit(s, side, id, x, { member: 0 });
  const u = s.units[at]; s.units.splice(at + 1);
  const contact = CARDS[id].armored || CARDS[id].vehicle ? vehicleContact(s, x, id) : null;
  Object.assign(u, { x, y: contact?.y ?? ground(s, x), hullAngle: contact?.angle ?? 0,
    pace: 1, lane: 0, pose: 'idle', motion: 'ground', tactic: 'advance', personalMorale: 100,
    squadOrder: 'attack', squadOrderUntil: Infinity, decisionIn: 1e9, cooldown: 1e9,
    secondaryCooldown: 1e9, fragLeft: 0, shots: 0, readyAt: -100, stillFor: 10, ...patch });
  initializeAmmo(u); return u;
}
function run(s, seconds, capture) {
  const end = s.time + seconds;
  while (s.time < end - 1e-8) { tick(s, Math.min(DT, end - s.time)); capture?.(); }
}
const hill = x => 374 - Math.max(0, Math.min(190, (x - 950) * 1.5, (1320 - x) * 1.5));
function blockedHill(side, obstacle) {
  const s = arena(side, obstacle === 'cliff'
    ? x => x >= 950 && x < 1250 ? 184 : 374
    : hill);
  const u = one(s, side, 'tank', pos(side, 900));
  const foe = one(s, 1 - side, 'tank', pos(side, 1420), {
    pace: 0, trackIntegrity: 0, hp: 1e6, maxHp: 1e6, squadOrder: 'watch', squadOrderX: pos(side, 1420),
  });
  // A real scout on the far side supplies shared sight of the blocked target.
  one(s, side, 'scouts', pos(side, 1340), {
    pace: 0, squadOrder: 'watch', squadOrderX: pos(side, 1340),
  });
  if (obstacle === 'wall') s.walls.push({ uid: ++s.uid, x: pos(side, 930), width: 20, height: 90, hp: 1000, maxHp: 1000 });
  refreshVision(s);
  assert(visibleToSide(s, side, foe), 'the forward scout really observes the target');
  return { s, u, foe };
}
for (const side of [0, 1]) {
  test(`side ${side}: tank climbs toward a firing position past the old 64px hill search and fires`, () => {
    const { s, u } = blockedHill(side);
    const start = u.x, fuel = u.fuel;
    let largestStep = 0, previous = start;
    run(s, 6, () => { largestStep = Math.max(largestStep, Math.abs(u.x - previous)); previous = u.x; });
    assert((u.x - start) * dir(side) > 50, `tank must leave its blocked start: ${u.x}`);
    assert(largestStep <= CARDS.tank.speed * .8 * DT + .01, 'ordinary powered steps, never a jump');
    assert(Math.abs(u.fuel - (fuel - Math.abs(u.x - start) / VEHICLE_FUEL_RANGE * 100)) < 1e-7);
    u.cooldown = 0;
    run(s, 1);
    assert(u.shots > 0, 'the chosen slope position actually produces a legal shot');
  });

  for (const obstacle of ['cliff', 'wall']) test(`side ${side}: hill search cannot invent passage through a ${obstacle}`, () => {
    const { s, u } = blockedHill(side, obstacle), x = u.x, fuel = u.fuel;
    run(s, 4);
    assert.equal(u.x, x); assert.equal(u.fuel, fuel);
    if (obstacle === 'wall') assert.equal(s.walls[0].hp, 1000);
  });

  for (const disabled of ['fuel', 'tracks']) test(`side ${side}: hill recovery preserves ${disabled} immobilization`, () => {
    const { s, u } = blockedHill(side);
    if (disabled === 'fuel') u.fuel = 0; else u.trackIntegrity = 0;
    const x = u.x, fuel = u.fuel;
    run(s, 3); assert.equal(u.x, x); assert.equal(u.fuel, fuel);
  });

  for (const id of ['infantry', 'tank']) test(`side ${side}: ${id} crosses a steep passable hill and crater without stopping`, () => {
    const s = arena(side, x => x > 950 && x < 1100 ? 374 - Math.min(90, (x - 950) * 2.2, (1100 - x) * 2.2) : 374);
    // A deformed crater retains the original surface used by the bank drill.
    for (let x = 1160; x <= 1240; x++) s.terrain[Math.floor(pos(side, x))] = 374 + Math.min(44, (x - 1160) * 2.2, (1240 - x) * 2.2);
    s.terrainVersion++;
    const u = one(s, side, id, pos(side, 900));
    let previous = u.x, maxStep = 0;
    run(s, 13, () => {
      assert((u.x - previous) * dir(side) >= -1e-6, 'traversal never oscillates backwards');
      maxStep = Math.max(maxStep, Math.abs(u.x - previous)); previous = u.x;
    });
    assert((u.x - pos(side, 900)) * dir(side) > 350);
    assert(maxStep < 5, 'bank motion and driving stay bounded per simulation step');
    assert(Number.isFinite(u.y));
  });

  for (const mode of ['retreat', 'resupply']) test(`side ${side}: safe ${mode} faces rearward at walking speed`, () => {
    const s = arena(side), u = one(s, side, 'infantry', pos(side, 1400));
    if (mode === 'retreat') setSquadOrder(s, side, u.squad, 'retreat');
    else {
      u.ammo = 1; u.ammoReserve = 0;
      if (side === 0) assert(issueLogisticsOrder(s, u.uid, 'resupply'));
    }
    run(s, 2); const x = u.x; run(s, 2);
    const speed = (x - u.x) * dir(side) / 2;
    assert(speed > 34 && speed < 40, `${mode} should walk normally: ${speed}`);
    assert.equal(u.facing, -dir(side)); assert.equal(u.backpedaling, false);
  });

  test(`side ${side}: resupply covers a close visible threat, then turns after leaving danger`, () => {
    const s = arena(side), u = one(s, side, 'infantry', pos(side, 1400));
    const foe = one(s, 1 - side, 'infantry', pos(side, 1650), { pace: 0, squadOrder: 'watch', squadOrderX: pos(side, 1650) });
    u.ammo = 1; u.ammoReserve = 0;
    if (side === 0) assert(issueLogisticsOrder(s, u.uid, 'resupply'));
    let coveringFrames = 0;
    refreshVision(s); run(s, 4, () => {
      if (u.backpedaling) { coveringFrames++; assert.equal(u.facing, dir(side)); }
    });
    assert(coveringFrames > 10, 'nearby observed danger produces real covering steps after the stance transition');
    const x = u.x; run(s, 1);
    assert((x - u.x) * dir(side) < 27, 'covering steps stay slower than an ordinary walk');
    // No hidden live coordinates: lose the threat behind the hill and wait for the observation to expire.
    foe.x = pos(side, 2800); foe.squadOrderX = foe.x;
    refreshVision(s); run(s, 5);
    assert.equal(u.facing, -dir(side)); assert.equal(u.backpedaling, false);
  });

  test(`side ${side}: a nearby but unobserved enemy does not slow rearward supply travel`, () => {
    const s = arena(side), u = one(s, side, 'infantry', pos(side, 1400));
    const foe = one(s, 1 - side, 'infantry', pos(side, 1660), { pace: 0, squadOrder: 'watch', squadOrderX: pos(side, 1660) });
    for (let x = 1500; x <= 1560; x++) s.terrain[Math.floor(pos(side, x))] = 100;
    s.original = [...s.terrain]; s.terrainVersion++;
    u.ammo = 1; u.ammoReserve = 0;
    if (side === 0) assert(issueLogisticsOrder(s, u.uid, 'resupply'));
    refreshVision(s); assert.equal(visibleToSide(s, side, foe), false);
    run(s, 2); const x = u.x; run(s, 1);
    assert((x - u.x) * dir(side) > 34);
    assert.equal(u.facing, -dir(side)); assert.equal(u.backpedaling, false);
  });
}
