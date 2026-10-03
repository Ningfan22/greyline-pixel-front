import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, spawnUnit, tick, refreshVision, W, contactSafeX } from '../game/engine.ts';
import { CARDS } from '../game/cards.ts';
import { isAntiTankOperator, antiTankConcealed } from '../game/infantry-specialties.ts';

const DT = 1 / 60;
const dir = side => side ? -1 : 1;
const mirror = (side, value) => side ? W - value : value;
function arena(side = 0) {
  const s = createGame(197, undefined, undefined, undefined, { weather: false });
  startGame(s);
  Object.assign(s, { units: [], walls: [], scenery: [], wrecks: [], aiIn: 1e9 });
  s.terrain.fill(374); s.original.fill(374); s.terrainVersion++;
  s.players[side].order = 'advance'; s.players[1 - side].order = 'hold';
  return s;
}
function single(s, side, id, at, member = 0) {
  const n = s.units.length;
  spawnUnit(s, side, id, at);
  const u = s.units[n + member];
  s.units = s.units.slice(0, n).concat(u);
  Object.assign(u, { x: at, y: 374, pose: 'idle', tactic: 'advance', pace: 1,
    decisionIn: 1e9, readyAt: -10, rifleReady: 1, personalMorale: 100,
    hp: 1e5, maxHp: 1e5, cooldown: 0, secondaryCooldown: 0,
    shots: 0, secondaryShots: 0, fragCooldown: 1e9 });
  return u;
}
function passive(u) {
  Object.assign(u, { squadOrder: 'watch', squadOrderX: u.x, squadOrderUntil: Infinity,
    cooldown: 1e9, secondaryCooldown: 1e9 });
}
function normalHealth(u) {
  u.hp = u.maxHp = CARDS[u.id].hp / (CARDS[u.id].members ?? 1);
}
function run(s, seconds, inspect) {
  for (let i = 0; i < Math.round(seconds / DT); i++) { tick(s, DT); inspect?.(); }
}

for (const side of [0, 1]) {
  test(`side ${side}: TOW reverses once and holds a real coax firing line for 50 seconds`, () => {
    const s = arena(side);
    const tow = single(s, side, 'tow_ifv', mirror(side, 1300));
    const foe = single(s, 1 - side, 'infantry', mirror(side, 1500)); passive(foe);
    refreshVision(s);
    const start = tow.x, hp = foe.hp;
    const positions = [], missiles = [];
    run(s, 50, () => {
      positions.push(tow.x);
      missiles.push(...s.projectiles.filter(p => p.sourceUid === tow.uid && p.weapon !== 'coax'));
    });
    assert((start - tow.x) * dir(side) >= 130, 'a close contact causes one deliberate reverse');
    assert(positions.every((x, i) => !i || (x - positions[i - 1]) * dir(side) <= 0.001),
      'never alternates between driving into the contact and reversing');
    assert(tow.vehicleReverseHeld, 'the finished reverse retains its firing line');
    assert(tow.secondaryShots > 20 && foe.hp < hp, 'actual coax projectiles damage infantry');
    assert.equal(tow.shots, 0, 'TOW primary missiles do not target infantry');
    assert.equal(missiles.length, 0);
    const settled = tow.x;
    foe.hp = 0; refreshVision(s);
    run(s, 2); assert.equal(tow.x, settled, 'brief lost contact is not an immediate charge order');
    run(s, 4);
    assert((tow.x - settled) * dir(side) > 10, 'confirmed cleared contact eventually releases the line');
  });

  test(`side ${side}: sidearm-only contact does not drive forward between bursts`, () => {
    const s = arena(side);
    const tow = single(s, side, 'tow_ifv', mirror(side, 1000));
    const foe = single(s, 1 - side, 'infantry', mirror(side, 1380)); passive(foe);
    refreshVision(s);
    const start = tow.x, positions = [];
    run(s, 12, () => positions.push(tow.x));
    assert(tow.secondaryShots > 8);
    assert.equal(tow.shots, 0);
    assert(positions.every(x => Math.abs(x - start) < 0.01), 'coax pauses preserve standoff');
    assert(!tow.vehicleReverseHeld, 'holding an engagement does not require inventing a reverse');
  });

  test(`side ${side}: TOW primary missiles choose armour while its coax chooses infantry`, () => {
    const s = arena(side);
    const tow = single(s, side, 'tow_ifv', mirror(side, 1000));
    const soft = single(s, 1 - side, 'infantry', mirror(side, 1340)); passive(soft);
    const tank = single(s, 1 - side, 'tank', mirror(side, 1450)); passive(tank);
    refreshVision(s);
    const primary = new Map(), coax = new Map();
    run(s, 10, () => {
      for (const p of s.projectiles.filter(p => p.sourceUid === tow.uid)) {
        const launches = p.weapon === 'coax' ? coax : primary;
        // A miss can clear targetUid later in flight. Record the original
        // target selection once, rather than rewriting it on impact frames.
        if (!launches.has(p.uid)) launches.set(p.uid, p.targetUid);
      }
    });
    assert(primary.size > 0 && tow.shots > 0, 'real missiles launch at a visible armoured target');
    assert([...primary.values()].every(uid => uid === tank.uid), 'no soft target is selected for a missile');
    assert(coax.size > 0 && [...coax.values()].every(uid => uid === soft.uid));
  });

  test(`side ${side}: unsupported riflemen hold outside a still-visible tank's firing lane`, () => {
    const s = arena(side);
    const rifleman = single(s, side, 'infantry', mirror(side, 1400));
    normalHealth(rifleman);
    rifleman.decisionIn = 0;
    const tank = single(s, 1 - side, 'tank', mirror(side, 1800)); passive(tank);
    normalHealth(tank);
    const observer = single(s, side, 'pathfinders', mirror(side, 1700)); passive(observer);
    normalHealth(observer);
    refreshVision(s);
    let standbyX, returning = false;
    run(s, 90, () => {
      if (rifleman.withdrawStandby) standbyX ??= rifleman.x;
      if (standbyX !== undefined && (rifleman.x - standbyX) * dir(side) > 1) returning = true;
    });
    assert(standbyX !== undefined, 'the unsupported squad actually completes a fallback bound');
    assert(s.visible[side].includes(tank.uid), 'another genuine observer still sees the threat');
    assert.equal(returning, false, 'a 30-second standby timeout cannot send the rifleman back into a visible kill zone');
    assert(Math.abs(rifleman.x - tank.x) > CARDS.tank.range);
  });

  test(`side ${side}: real loaded AT support holds normal riflemen, an empty launcher does not`, () => {
    for (const loaded of [true, false]) {
      const s = arena(side);
      const rifleman = single(s, side, 'infantry', mirror(side, 1400)); normalHealth(rifleman);
      rifleman.decisionIn = 0;
      const tank = single(s, 1 - side, 'tank', mirror(side, 1800)); normalHealth(tank); passive(tank);
      const operator = single(s, side, 'antiarmor', mirror(side, 1300)); normalHealth(operator);
      Object.assign(operator, { squadOrder: 'watch', squadOrderX: operator.x, squadOrderUntil: Infinity,
        pose: 'crouch', tactic: 'crouch', stanceLockUntil: 60 });
      if (!loaded) operator.ammo = operator.ammoReserve = 0;
      const hp = tank.hp, start = rifleman.x;
      refreshVision(s);
      run(s, loaded ? 6 : 12);
      if (loaded) {
        assert(operator.shots > 0 && tank.hp < hp, 'the support really launches rockets and damages armour');
        assert.equal(rifleman.withdrawHeavyUid, undefined, 'credible support avoids an unnecessary rout');
        assert(Math.abs(rifleman.x - start) < 2, 'riflemen keep the supported firing line');
      } else {
        assert.equal(operator.shots, 0);
        assert.equal(rifleman.withdrawHeavyUid, tank.uid, 'an empty launcher cannot pretend to provide AT cover');
        assert((start - rifleman.x) * dir(side) > 10,
          `unsupported normal riflemen begin an actual fallback: ${JSON.stringify({ x: rifleman.x, start,
            pose: rifleman.pose, goal: rifleman.withdrawGoal, until: rifleman.withdrawUntil })}`);
      }
    }
  });

  test(`side ${side}: a mobile rocket battery clears its dead zone once, fires and does not creep back`, () => {
    const s = arena(side);
    const battery = single(s, side, 'mlrs', mirror(side, 1300));
    const foe = single(s, 1 - side, 'infantry', mirror(side, 1450)); passive(foe);
    // A separate real observer keeps contact while the battery performs its
    // legitimate counter-battery displacement; reacquisition movement is not
    // the minimum-range jitter this regression isolates.
    const observer = single(s, side, 'pathfinders', mirror(side, 1200)); passive(observer);
    refreshVision(s);
    const positions = [], shots = [];
    let previousShots = 0;
    run(s, 38, () => {
      positions.push(battery.x);
      if (battery.shots > previousShots) shots.push(Math.abs(battery.x - foe.x));
      previousShots = battery.shots;
    });
    assert(positions.every((x, i) => !i || (x - positions[i - 1]) * dir(side) <= 0.001),
      'the minimum-range boundary does not produce forward/backward jitter');
    assert(Math.abs(battery.x - foe.x) >= CARDS.mlrs.minRange + 79);
    assert(shots.length >= 2 && shots.every(d => d >= CARDS.mlrs.minRange), 'real rockets fire outside the dead zone');
    const settled = battery.x;
    foe.hp = 0; refreshVision(s);
    run(s, 5);
    assert((battery.x - settled) * dir(side) > 10, 'a dead remembered contact releases the minimum-range hold');
    assert.equal(battery.minimumRangeThreatUid, undefined);
  });

  test(`side ${side}: fresh unseen infantry cannot cause a vehicle retreat or artillery dead-zone hold`, () => {
    const s = arena(side);
    const tow = single(s, side, 'tow_ifv', mirror(side, 1300));
    const battery = single(s, side, 'mlrs', mirror(side, 900));
    const foe = single(s, 1 - side, 'infantry', mirror(side, 1450)); passive(foe);
    s.visible[side] = []; s.visionIn = 100;
    const start = tow.x;
    run(s, 1);
    assert((tow.x - start) * dir(side) > 5);
    assert(!tow.vehicleReverseHeld && !tow.vehicleReverseUntil && !tow.secondaryShots);
    assert.equal(battery.minimumRangeThreatUid, undefined);
    assert.equal(battery.minimumRangeHoldUntil, undefined);
  });

  test(`side ${side}: an explicit rush retains forward initiative at a close contact`, () => {
    const s = arena(side);
    s.players[side].order = 'rush';
    const tow = single(s, side, 'tow_ifv', mirror(side, 1000));
    const foe = single(s, 1 - side, 'infantry', mirror(side, 1190)); passive(foe);
    tow.secondaryCooldown = 1e9;
    refreshVision(s);
    const start = tow.x;
    run(s, 0.5);
    assert(!tow.vehicleReverseUntil, 'a healthy explicitly rushing vehicle is not auto-reversed');
    assert((tow.x - start) * dir(side) > 5);
    assert(Math.abs(tow.x - foe.x) >= 149.9, 'rush still cannot pass an uncleared contact');
  });

  test(`side ${side}: an unavailable weapon does not gain a point-blank charge after 35 seconds`, () => {
    const s = arena(side);
    const own = single(s, side, 'infantry', mirror(side, 1000));
    const foe = single(s, 1 - side, 'infantry', mirror(side, 1250)); passive(foe);
    // An exposed contact and a completely disabled weapon reproduce a
    // no-damage firefight without falsifying terrain or enemy visibility.
    own.cooldown = 1e9; own.fragCooldown = 1e9;
    own.decisionIn = 1e9;
    refreshVision(s);
    const start = own.x;
    run(s, 42);
    assert(Math.abs(own.x - start) < 1, 'elapsed ineffective-fire time does not authorize a blind charge');
    assert.equal(contactSafeX(s, own, foe.x), foe.x - dir(side) * 105,
      'no hidden 30px assault-gap state appears after the timeout');
  });
}

test('empty fronts still advance infantry, armour and indirect fire units', () => {
  for (const side of [0, 1]) for (const id of ['infantry', 'tank', 'tow_ifv', 'mlrs']) {
    const s = arena(side), own = single(s, side, id, mirror(side, 1000));
    const start = own.x;
    run(s, 4);
    assert((own.x - start) * dir(side) > 20, `${side}:${id} makes forward progress on clear ground`);
  }
});

test('only actual anti-tank rocket operators can prepare concealment', () => {
  const s = arena();
  for (const [id, member, expected] of [['antiarmor', 0, true], ['antiarmor', 1, false],
    ['javelin', 0, true], ['javelin', 1, true], ['airborne_at', 0, true],
    ['airborne_at', 1, true], ['airborne_at', 2, false], ['rocket', 4, true]]) {
    const u = single(s, 0, id, 1000, member);
    Object.assign(u, { pose: 'crouch', tactic: 'crouch', moving: false, fire: 0,
      secondaryFire: 0, antiTankConcealFor: 2, antiTankRevealedUntil: 0 });
    assert.equal(isAntiTankOperator(u), expected, `${id}:${member} matches the real weapon`);
    assert.equal(antiTankConcealed(u, s.time), expected);
    u.moving = true;
    assert.equal(antiTankConcealed(u, s.time), false, 'moving immediately ends concealment');
    u.moving = false; u.pose = 'idle';
    assert.equal(antiTankConcealed(u, s.time), false, 'standing is not a prepared low firing position');
  }
});
