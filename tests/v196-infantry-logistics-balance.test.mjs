import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, startGame, spawnUnit, tick, refreshVision, W } from '../game/engine.ts';
import { CARDS, weaponCard } from '../game/cards.ts';
import { ammoProfile, ammoSummary, ammoRatio, initializeAmmo } from '../game/ammo-logistics.ts';
import { setSquadOrder } from '../game/squad-orders.ts';

const DT = 1 / 60;
const direction = side => side ? -1 : 1;
const position = (side, x) => side ? W - x : x;
function arena(side = 0) {
  const s = createGame(196301 + side, undefined, undefined, undefined,
    { difficulty: 'standard', weather: false });
  startGame(s);
  Object.assign(s, { units: [], scenery: [], walls: [], wrecks: [], aiIn: 1e9, night: false });
  s.terrain.fill(374); s.original.fill(374); s.weather.disabled = true;
  for (const p of s.players) Object.assign(p, { order: 'hold', hand: [], deck: [], discard: [], energy: 0 });
  return s;
}
function one(s, side, id, x, member = 0) {
  const before = s.units.length;
  spawnUnit(s, side, id, x, { member });
  const u = s.units[before]; s.units.splice(before + 1);
  Object.assign(u, { x, y: 374, lane: 0, pace: 1, motion: 'ground',
    pose: CARDS[id].members ? 'crouch' : 'idle', poseAnimSeen: CARDS[id].members ? 'crouch' : 'stand',
    squadOrder: 'watch', squadOrderX: x, squadOrderUntil: Infinity,
    cooldown: 0, secondaryCooldown: 0, decisionIn: 1e9, tactic: 'advance',
    shots: 0, secondaryShots: 0, fragLeft: 0, personalMorale: 100, readyAt: -100, stillFor: 10 });
  initializeAmmo(u);
  return u;
}
// Enemy bodies are deliberately silent: normal-health friendly soldiers must
// withdraw because of spent ammunition, never because an artificial firefight
// killed or suppressed them. Huge target HP keeps one stable aim point alive.
function silentFoe(s, side, x, id = 'infantry') {
  const foe = one(s, 1 - side, id, x);
  foe.hp = foe.maxHp = 1e8;
  foe.cooldown = foe.secondaryCooldown = 1e9;
  refreshVision(s);
  return foe;
}
function run(s, seconds, capture) {
  const end = s.time + seconds;
  while (s.time < end - 1e-8) {
    tick(s, Math.min(DT, end - s.time));
    capture?.();
  }
}
function until(s, predicate, timeout, capture) {
  const end = s.time + timeout;
  while (s.time < end - 1e-8) {
    tick(s, Math.min(DT, end - s.time)); capture?.();
    if (predicate()) return s.time;
  }
  return null;
}
const total = (u, channel = 'primary') => ammoSummary(u).find(row => row.channel === channel)?.total;
function shotsSeen(s, u) {
  const projectiles = new Map();
  return { projectiles, capture: () => {
    for (const p of s.projectiles) if (p.sourceUid === u.uid && !projectiles.has(p)) projectiles.set(p, { ...p });
  } };
}

for (const side of [0, 1]) {
  test(`side ${side}: ordinary walking is about 37 px/s, withdrawal stays slower even with a rush buff`, () => {
    const walking = arena(side), withdrawing = arena(side);
    const a = one(walking, side, 'infantry', position(side, 1400));
    const b = one(withdrawing, side, 'infantry', position(side, 1400));
    setSquadOrder(walking, side, a.squad, 'attack');
    setSquadOrder(withdrawing, side, b.squad, 'retreat');
    withdrawing.players[side].blitzUntil = 20;
    // Exclude the authored rising/turning transition from the speed sample.
    run(walking, 2); run(withdrawing, 2);
    const fromA = a.x, fromB = b.x;
    run(walking, 2); run(withdrawing, 2);
    const advance = (a.x - fromA) * direction(side) / 2;
    const back = (fromB - b.x) * direction(side) / 2;
    assert(advance > 34 && advance < 40, `actual ordinary walking was ${advance} px/s`);
    assert(advance < 54.4 * .8, 'walking must visibly slow from the previous 54.4 px/s');
    assert(back > 20 && back < 26, `actual withdrawal was ${back} px/s`);
    assert(back < advance * .7, 'a forward movement buff cannot turn withdrawal into a sprint');
    assert.equal(a.hp, a.maxHp); assert.equal(b.hp, b.maxHp);
  });

  test(`side ${side}: a normal-health rifleman expends real rounds and needs supply after about a minute of sustained fire`, () => {
    const s = arena(side), u = one(s, side, 'infantry', position(side, 1400));
    silentFoe(s, side, u.x + direction(side) * 270);
    const load = total(u), observed = shotsSeen(s, u), initialHP = u.hp;
    const at = until(s, () => u.resupplyState === 'withdrawing', 90, observed.capture);
    assert(at !== null, 'a minute-long exchange must make logistics relevant');
    assert(at >= 30 && at <= 90, `withdrawal began after ${at} seconds`);
    assert(at >= 60 && at <= 80, 'ordinary fire should consume the new carry around 65–80 seconds');
    assert.equal(load, 90); assert.equal(u.shots, 63);
    assert.equal(load - total(u), u.shots, 'one real round is spent per actual discharge');
    assert.equal(observed.projectiles.size, u.shots, 'the ammunition counter matches actual launched bullets');
    assert([...observed.projectiles.values()].every(p => p.ammunition === 'rifle'));
    assert(ammoRatio(u) <= .3); assert.equal(u.hp, initialHP);
    const x = u.x, beforeShots = u.shots;
    run(s, 4, observed.capture);
    assert((x - u.x) * direction(side) > 20, 'the low-ammo soldier really leaves the firing position');
    assert.equal(u.shots, beforeShots, 'withdrawal preserves the last ammunition instead of firing it away');
  });

  test(`side ${side}: the smaller rifle carry still enforces a real reload and a fully dry weapon cannot fire`, () => {
    const s = arena(side), u = one(s, side, 'infantry', position(side, 1400));
    silentFoe(s, side, u.x + direction(side) * 270);
    u.ammo = 1; u.ammoReserve = 60;
    const observed = shotsSeen(s, u);
    assert(until(s, () => u.ammo === 0 && u.reloadingUntil > s.time, 4, observed.capture) !== null);
    const shots = u.shots, started = s.time;
    run(s, 1, observed.capture);
    assert.equal(u.shots, shots); assert.equal(u.ammo, 0); assert.equal(u.ammoReserve, 60);
    assert(until(s, () => u.ammo > 0, 4, observed.capture) !== null);
    assert(s.time - started >= 2.45, 'the 2.5 second reload cannot disappear with lower reserves');
    assert.equal(u.ammoReserve, 30, 'one actual magazine transfers from the reserve');
    assert.equal(total(u), 61 - u.shots);
    assert.equal(observed.projectiles.size, u.shots);
    u.ammo = u.ammoReserve = 0; u.reloadingUntil = 0;
    const before = u.shots;
    run(s, 2, observed.capture);
    assert.equal(u.shots, before); assert.equal(total(u), 0);
    assert.equal(u.resupplyState, 'withdrawing');
  });

  for (const [id, interval, damage] of [['mortar', 10, 22], ['light_mortar', 6, 26], ['mortar_carrier', 11, 42]]) {
    test(`side ${side}: ${id} actually launches shells at ${interval}s intervals without losing shell damage`, () => {
      const s = arena(side), u = one(s, side, id, position(side, 1400));
      u.squadOrder = undefined; s.players[side].order = 'hold';
      // A nearby silent spotter keeps sight after shells crater the target's
      // ground, so terrain-induced loss of visibility cannot mask gun cadence.
      const spotter = one(s, side, 'scouts', u.x + direction(side) * 280);
      spotter.cooldown = 1e9;
      silentFoe(s, side, u.x + direction(side) * 360);
      const observed = shotsSeen(s, u), times = []; let previous = 0;
      until(s, () => times.length === 3, interval * 3 + 6, () => {
        observed.capture();
        if (u.shots > previous) { times.push(s.time); previous = u.shots; }
      });
      assert.equal(times.length, 3, `${id} must resume fire after each reload`);
      for (let i = 1; i < times.length; i++) {
        const gap = times[i] - times[i - 1];
        assert(gap >= interval - DT && gap <= interval + .1, `actual shell interval was ${gap}`);
      }
      assert.equal(observed.projectiles.size, 3);
      assert([...observed.projectiles.values()].every(p => p.ammunition === 'mortar' && p.damage === damage));
      assert.equal(total(u), 27, 'three real shells consume three rounds from the same finite load');
    });

    test(`side ${side}: ${id} receives actual ammunition from supply troops without bypassing its loading time`, () => {
      const s = arena(side), u = one(s, side, id, position(side, 1400));
      u.squadOrder = undefined; s.players[side].order = 'hold';
      const spotter = one(s, side, 'scouts', u.x + direction(side) * 280);
      const supply = one(s, side, 'supply_team', u.x - direction(side) * 45);
      spotter.cooldown = supply.cooldown = 1e9;
      silentFoe(s, side, u.x + direction(side) * 360);
      const stock = supply.supplyStock, times = []; let previous = 0;
      until(s, () => times.length === 2, interval * 2 + 6, () => {
        if (u.shots > previous) { times.push(s.time); previous = u.shots; }
      });
      assert.equal(times.length, 2, 'support troops cannot disable the gun');
      const gap = times[1] - times[0];
      assert(gap >= interval - DT && gap <= interval + .1, `combined support changed the real interval to ${gap}`);
      assert(supply.supplyStock < stock, 'the supply pack must genuinely hand over expended ammunition');
      assert(total(u) >= 29); assert.equal(u.resupplyState, undefined);
    });
  }

  test(`side ${side}: the rifle and mortar rebalance preserves actual machine-gun damage and cadence`, () => {
    const s = arena(side), gun = one(s, side, 'machinegun', position(side, 1400));
    silentFoe(s, side, gun.x + direction(side) * 320);
    const observed = shotsSeen(s, gun), times = []; let previous = 0;
    until(s, () => times.length === 5, 5, () => {
      observed.capture();
      if (gun.shots > previous) { times.push(s.time); previous = gun.shots; }
    });
    assert.equal(times.length, 5);
    for (let i = 1; i < times.length; i++) {
      const gap = times[i] - times[i - 1];
      assert(gap >= .22 - DT && gap <= .26, `unchanged MG interval was ${gap}`);
    }
    assert.equal(total(gun), 295); assert.equal(observed.projectiles.size, 5);
    assert([...observed.projectiles.values()].every(p => p.ammunition === 'machinegun' && p.damage === 5));
  });

  test(`side ${side}: the rebuilt TOW carrier saves missiles for armour while its independent MG defends against infantry`, () => {
    const s = arena(side), tow = one(s, side, 'tow_ifv', position(side, 1400));
    silentFoe(s, side, tow.x + direction(side) * 300);
    const primary = total(tow), secondary = total(tow, 'secondary');
    const observed = shotsSeen(s, tow);
    run(s, 2.1, observed.capture);
    assert.equal(primary, 8); assert.equal(secondary, 1000);
    assert.equal(tow.shots, 0, 'missiles cannot be wasted against riflemen');
    assert.equal(total(tow), primary);
    assert(tow.secondaryShots > 0, 'the vehicle MG must cover beyond personal-sidearm range');
    assert.equal(secondary - total(tow, 'secondary'), tow.secondaryShots);
    assert.equal(observed.projectiles.size, tow.secondaryShots);
    assert([...observed.projectiles.values()].every(p => p.ammunition === 'machinegun'));
  });

  test(`side ${side}: TOW missiles acquire vehicles, respect the launch dead zone and load for 7.5 seconds`, () => {
    const s = arena(side), tow = one(s, side, 'tow_ifv', position(side, 1400));
    const target = silentFoe(s, side, tow.x + direction(side) * 140, 'tank');
    const targetHP = target.hp;
    run(s, .05);
    assert.equal(tow.shots, 0, 'an armoured contact at 140px is inside the 160px launch dead zone');
    assert.equal(total(tow), 8);
    target.x = tow.x + direction(side) * 450;
    tow.vehicleReverseUntil = 0; tow.vehicleReverseGoal = undefined;
    tow.squadOrderX = tow.x; refreshVision(s);
    const observed = shotsSeen(s, tow), times = []; let previous = tow.shots;
    until(s, () => times.length === 2, 12, () => {
      observed.capture();
      if (tow.shots > previous) { times.push(s.time); previous = tow.shots; }
    });
    assert.equal(times.length, 2, 'the vehicle must actually engage visible armour');
    assert(times[1] - times[0] >= 7.5 - DT);
    assert.equal(total(tow), 6); assert.equal(total(tow, 'secondary'), 1000);
    assert.equal(tow.secondaryShots, 0, 'the MG cannot consume its pool by firing on a tank');
    assert.equal(observed.projectiles.size, 2);
    assert([...observed.projectiles.values()].every(p => p.ammunition === 'rocket' && p.damage === 96 && p.targetUid === target.uid));
    assert(target.hp < targetHP, 'a launched guided missile must actually damage the armoured contact');
  });
}

test('the rifle tuning applies to escorts without stripping machine-gun belts, sniper ammunition or launcher loads', () => {
  for (const [id, member] of [['infantry', 0], ['machinegun', 1], ['antiarmor', 1],
    ['light_mortar', 1], ['airborne_at', 2]]) {
    const p = ammoProfile({ id, member }).primary;
    assert.equal(p.mag + p.reserve, 90, `${id} member ${member} is a real rifleman`);
  }
  for (const [id, member, expected] of [['machinegun', 0, 300], ['lmg_team', 0, 240],
    ['heavy_mg', 0, 450], ['sniper', 0, 30], ['sniper_team', 0, 30], ['rocket', 0, 6],
    ['mortar', 0, 30], ['tank', 0, 36]]) {
    const p = ammoProfile({ id, member }).primary;
    assert.equal(p.mag + p.reserve, expected, `${id} is not an ordinary rifle load`);
  }
  const s = arena(), observer = one(s, 0, 'sniper_team', 1400, 1);
  silentFoe(s, 0, 1650); run(s, 20);
  assert.equal(weaponCard(observer).damage, 0); assert.equal(ammoProfile(observer).primary, null);
  assert.equal(observer.shots, 0); assert.equal(observer.resupplyState, undefined);
  assert.equal(ammoRatio(observer), 1, 'a binocular observer must never retreat for imaginary ammunition');
});

test('idle infantry and crew do not burn ammunition to make the supply meter look busy', () => {
  for (const [id, member] of [['infantry', 0], ['machinegun', 0], ['mortar', 0], ['light_mortar', 1]]) {
    const s = arena(), u = one(s, 0, id, 1400, member), before = total(u);
    run(s, 30);
    assert.equal(total(u), before); assert.equal(u.shots, 0); assert.equal(u.resupplyState, undefined);
  }
});
