import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, startGame, spawnUnit, tick, refreshVision, playCard, pointVisible, W } from '../game/engine.ts';
import { setSquadOrder } from '../game/squad-orders.ts';
import { CARDS } from '../game/cards.ts';
import { ammoProfile, ammoSummary, initializeAmmo, AMMO_CRATE_STOCK, AMMO_CRATE_LIFE } from '../game/ammo-logistics.ts';

const DT = 1 / 60;
const dir = side => side ? -1 : 1;
const x = (side, value) => side ? W - value : value;
function arena(side = 0) {
  const s = createGame(195028, undefined, undefined, undefined, { difficulty: 'standard', weather: false });
  startGame(s);
  Object.assign(s, { units: [], walls: [], scenery: [], wrecks: [], aiIn: 1e9 });
  s.terrain.fill(374); s.original.fill(374);
  for (const p of s.players) {
    p.hand = []; p.deck = []; p.discard = []; p.energy = 10; p.order = 'hold';
  }
  s.players[side].order = 'advance';
  return s;
}
function add(s, side, id, value, oneMember = false) {
  const n = s.units.length;
  spawnUnit(s, side, id, x(side, value));
  const units = s.units.slice(n);
  if (oneMember) s.units.splice(n + 1, units.length - 1);
  const u = units[0];
  u.pace = 1; u.personalMorale = 100;
  initializeAmmo(u);
  return u;
}
function enemy(s, side, value, id = 'infantry') {
  const u = add(s, 1 - side, id, W - value, true);
  u.squadOrder = 'watch'; u.squadOrderUntil = Infinity;
  u.hp = u.maxHp = 1e6;
  u.cooldown = u.secondaryCooldown = 1e9;
  refreshVision(s);
  return u;
}
function run(s, seconds) {
  const end = s.time + seconds;
  while (s.time < end - 1e-8) tick(s, Math.min(DT, end - s.time));
}
function token(s, side, id) {
  const h = { id, uid: ++s.uid, readyAt: 0 };
  s.players[side].hand.push(h);
  return h;
}
function total(u, channel = 'primary') {
  return ammoSummary(u).find(row => row.channel === channel)?.total;
}
function lowRifle(u) {
  const spec = ammoProfile(u).primary;
  const total = Math.floor((spec.mag + spec.reserve) * 0.3);
  u.ammo = Math.min(spec.mag, total);
  u.ammoReserve = total - u.ammo;
  u.reloadingUntil = 0;
}

for (const side of [0, 1]) {
  test(`side ${side}: real low-ammo rifleman breaks watch, slowly withdraws and stops firing`, () => {
    const s = arena(side), u = add(s, side, 'infantry', 1200, true);
    setSquadOrder(s, side, u.squad, 'watch');
    lowRifle(u); u.cooldown = 0;
    enemy(s, side, 1500);
    const start = u.x, shots = u.shots;
    // Let the existing authored prone/crouch transition finish before
    // measuring travel. The supply order may not teleport through that pose.
    for (let i = 0; i < 15 * 60 && (start - u.x) * dir(side) <= 30; i++) tick(s, DT);
    assert((start - u.x) * dir(side) > 30, 'the engine actually walks the unit towards supply');
    const beforeSample = u.x;
    run(s, 1);
    const retreat = (beforeSample - u.x) * dir(side);
    assert(retreat > 1, 'the persistent supply retreat keeps moving');
    assert(retreat < CARDS.infantry.speed * 0.8 * 0.7,
      'withdrawal stays below ordinary walking pace');
    assert.equal(u.resupplyState, 'withdrawing');
    assert.equal(u.shots, shots, 'low-ammo withdrawal owns the weapon');
    assert.equal(u.fire, 0);
  });

  test(`side ${side}: without a forward source the rifleman reaches HQ, fills up and advances again`, () => {
    const s = arena(side), u = add(s, side, 'infantry', 700, true);
    setSquadOrder(s, side, u.squad, 'watch');
    lowRifle(u); u.cooldown = 1e9;
    const start = u.x;
    let supplyingX, releasedX;
    for (let i = 0; i < 50 * 60; i++) {
      tick(s, DT);
      if (u.resupplyState === 'supplying') supplyingX ??= u.x;
      if (supplyingX !== undefined && !u.resupplyState) { releasedX = u.x; break; }
    }
    assert(supplyingX !== undefined, 'it really reaches the base supply radius');
    assert(Math.abs(supplyingX - x(side, 110)) <= 141);
    assert(releasedX !== undefined, 'full ammunition releases the persistent retreat');
    assert.equal(total(u), ammoProfile(u).primary.mag + ammoProfile(u).primary.reserve);
    assert((start - releasedX) * dir(side) > 300);
    for (let i = 0; i < 15 * 60 && (u.x - releasedX) * dir(side) <= 20; i++) tick(s, DT);
    assert((u.x - releasedX) * dir(side) > 20, 'the same soldier really advances after refilling');
    assert.equal(u.squadOrder, 'attack');
  });

  test(`side ${side}: a new watch order cannot strand a rifleman already withdrawing for ammunition`, () => {
    const s = arena(side), u = add(s, side, 'infantry', 1200, true);
    lowRifle(u); u.cooldown = 1e9;
    run(s, 1);
    assert.equal(u.resupplyState, 'withdrawing');
    const before = u.x;
    assert.equal(setSquadOrder(s, side, u.squad, 'watch').ok, true);
    assert.equal(u.squadOrder, 'watch', 'the manual order enters the normal command path');
    run(s, 2);
    assert.equal(u.squadOrder, 'attack', 'the persistent supply task retakes movement control');
    assert.equal(u.resupplyState, 'withdrawing');
    assert((before - u.x) * dir(side) > 10, 'the actual engine keeps withdrawing');
  });

  test(`side ${side}: a low-ammo garrison exits its bunker and is never snapped back into it`, () => {
    const s = arena(side), fort = add(s, side, 'fort_bunker', 900);
    fort.buildUntil = 0; fort.cooldown = 1e9;
    const u = add(s, side, 'infantry', 900, true);
    setSquadOrder(s, side, u.squad, 'watch');
    u.cooldown = 1e9;
    run(s, 0.1);
    assert.equal(u.garrisonUid, fort.uid, 'a real completed bunker first accepts the soldier');
    lowRifle(u);
    for (let i = 0; i < 15 * 60 && (fort.x - u.x) * dir(side) <= 95; i++) {
      tick(s, DT);
      assert.equal(u.garrisonUid, undefined, 'maintaining the fort must not reattach a supply retreat');
    }
    assert((fort.x - u.x) * dir(side) > 95, 'the engine really takes him outside the garrison snap radius');
    assert.equal(u.resupplyState, 'withdrawing');
  });

  test(`side ${side}: tank main gun and coax expend their own ammunition, matching actual shots`, () => {
    const s = arena(side), tank = add(s, side, 'tank', 1100);
    tank.cooldown = tank.secondaryCooldown = 0;
    enemy(s, side, 1470);
    const main = total(tank), coax = total(tank, 'secondary');
    const mainShots = tank.shots, coaxShots = tank.secondaryShots;
    assert(main > 0 && coax > main, 'separate shell and machine-gun loads exist');
    run(s, 2.2);
    assert(tank.shots > mainShots, 'the main gun actually launches shells');
    assert(tank.secondaryShots > coaxShots, 'the coax actually launches bullets');
    assert.equal(main - total(tank), tank.shots - mainShots);
    assert.equal(coax - total(tank, 'secondary'), tank.secondaryShots - coaxShots);
  });

  test(`side ${side}: empty rifle and tank loads cannot produce primary or coax shots`, () => {
    for (const id of ['infantry', 'tank']) {
      const s = arena(side), u = add(s, side, id, 1100, true);
      u.ammo = u.ammoReserve = 0;
      if (ammoProfile(u).secondary) u.secondaryAmmo = u.secondaryAmmoReserve = 0;
      u.cooldown = u.secondaryCooldown = 0;
      enemy(s, side, 1430);
      const shots = u.shots, coax = u.secondaryShots;
      run(s, 2);
      assert.equal(u.shots, shots, `${id} cannot fire a dry primary weapon`);
      assert.equal(u.secondaryShots, coax, `${id} cannot fire a dry secondary weapon`);
      assert.equal(u.fire, 0); assert.equal(u.secondaryFire, 0);
    }
  });

  test(`side ${side}: ammo airdrop costs two points and creates a crate without drawing cards`, () => {
    const s = arena(side), p = s.players[side];
    const h = token(s, side, 'ammo');
    const other = token(s, side, 'infantry');
    p.deck = [{ id: 'tank', uid: ++s.uid }, { id: 'infantry', uid: ++s.uid }];
    refreshVision(s);
    const location = x(side, 300);
    assert(pointVisible(s, side, location, 350));
    const beforeDeck = JSON.stringify(p.deck);
    assert.equal(playCard(s, side, h.uid, location).ok, true);
    assert.equal(p.energy, 8);
    assert.deepEqual(p.hand, [other]);
    assert.equal(JSON.stringify(p.deck), beforeDeck);
    assert.equal(s.ammoCrates.length, 1);
    const crate = s.ammoCrates[0];
    assert.equal(crate.side, side); assert.equal(crate.x, location);
    assert.equal(crate.stock, AMMO_CRATE_STOCK);
    assert.equal(crate.landAt, 3);
    assert.equal(crate.expiresAt, 3 + AMMO_CRATE_LIFE);
  });

  test(`side ${side}: a fogged airdrop location is rejected without payment or card loss`, () => {
    const s = arena(side), p = s.players[side];
    const h = token(s, side, 'ammo');
    refreshVision(s);
    const location = x(side, 1800);
    assert(!pointVisible(s, side, location, 350));
    const result = playCard(s, side, h.uid, location);
    assert.equal(result.ok, false);
    assert.match(result.message, /视线|可见/);
    assert.equal(p.energy, 10);
    assert.deepEqual(p.hand, [h]);
    assert.equal(s.ammoCrates?.length ?? 0, 0);
  });

  test(`side ${side}: crate ammunition becomes available only after the three-second descent`, () => {
    const s = arena(side), u = add(s, side, 'infantry', 900, true);
    setSquadOrder(s, side, u.squad, 'watch');
    const spec = ammoProfile(u).primary;
    u.ammo = spec.mag; u.ammoReserve = spec.reserve - 15;
    u.cooldown = 1e9;
    refreshVision(s);
    const h = token(s, side, 'ammo');
    assert.equal(playCard(s, side, h.uid, u.x - dir(side) * 20).ok, true);
    const before = total(u), crate = s.ammoCrates[0];
    run(s, 2.9);
    assert.equal(total(u), before, 'a descending crate has no usable stock');
    assert.equal(crate.stock, AMMO_CRATE_STOCK);
    run(s, 0.2);
    assert(total(u) > before, 'the actual engine refills after landing');
    assert(crate.stock < AMMO_CRATE_STOCK);
  });
}

test('paused ammunition drops keep their landing and expiry clocks; crates expire 180 seconds after landing', () => {
  const s = arena(), h = token(s, 0, 'ammo');
  refreshVision(s);
  assert.equal(playCard(s, 0, h.uid, 300).ok, true);
  run(s, 1);
  s.status = 'paused';
  const time = s.time, original = JSON.stringify(s.ammoCrates);
  for (let i = 0; i < 2000; i++) tick(s, 0.05);
  assert.equal(s.time, time);
  assert.equal(JSON.stringify(s.ammoCrates), original);
  s.status = 'playing';
  run(s, 181.9);
  assert.equal(s.ammoCrates.length, 1, 'the landed crate lasts its full 180 seconds');
  run(s, 0.2);
  assert.equal(s.ammoCrates.length, 0, 'the expired crate is removed by the live tick');
});

test('a depleted forward crate cannot trap a partly refilled soldier at the empty position', () => {
  const s = arena(), u = add(s, 0, 'infantry', 900, true);
  lowRifle(u); u.cooldown = 1e9;
  const crate = { uid: ++s.uid, side: 0, x: 850, stock: 15, maxStock: 15, landAt: 0, expiresAt: 180 };
  s.ammoCrates = [crate];
  run(s, 4);
  assert.equal(crate.stock, 0);
  assert(total(u) < ammoProfile(u).primary.mag + ammoProfile(u).primary.reserve);
  assert.equal(u.resupplyState, 'withdrawing');
  assert.equal(u.resupplyGoal, 110);
  const before = u.x;
  run(s, 2);
  assert(u.x < before - 20, 'the engine continues the same slow retreat to HQ');
});

test('stock that cannot buy even one needed shell is unusable and cannot trap a tank', () => {
  const s = arena(), tank = add(s, 0, 'tank', 1000);
  tank.ammo = Math.floor(ammoProfile(tank).primary.mag * .3); tank.ammoReserve = 0;
  tank.cooldown = tank.secondaryCooldown = 1e9;
  s.ammoCrates = [{ uid: ++s.uid, side: 0, x: 1000, stock: 5, maxStock: 5, landAt: 0, expiresAt: 180 }];
  run(s, 2);
  assert.equal(tank.resupplyState, 'withdrawing');
  assert.equal(tank.resupplyGoal, 110);
  assert(tank.x < 980, 'five supply units cannot buy a six-unit shell, so HQ remains the useful source');
});
