import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, startGame, spawnUnit, tick, refreshVision, visibleToSide, unitRange, droneRecon, W } from '../game/engine.ts';
import { CARDS, weaponCard } from '../game/cards.ts';
import { ammoSummary } from '../game/ammo-logistics.ts';
import { antiTankConcealed, isAntiTankOperator } from '../game/infantry-specialties.ts';

const DT = 1 / 60;
const direction = side => side ? -1 : 1;
const position = (side, local) => side ? W - local : local;
function arena(side) {
  const s = createGame(197301 + side, undefined, undefined, undefined,
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
  Object.assign(u, { x, y: CARDS[id].air ? CARDS[id].altitude : 374,
    lane: 0, pace: 1, motion: 'ground', cooldown: 0, secondaryCooldown: 0,
    shots: 0, secondaryShots: 0, readyAt: -100, stillFor: 0,
    decisionIn: 1e9, tactic: 'advance', personalMorale: 100, fragLeft: 0,
    parachuting: undefined, rappelling: undefined,
    pose: CARDS[id].members ? 'crouch' : 'idle',
    poseAnimSeen: CARDS[id].members ? 'crouch' : 'stand' });
  if (!CARDS[id].air) Object.assign(u, {
    squadOrder: 'watch', squadOrderX: x, squadOrderUntil: Infinity,
  });
  return u;
}
function run(s, seconds, capture = () => {}) {
  const end = s.time + seconds;
  while (s.time < end - 1e-8) { tick(s, Math.min(DT, end - s.time)); capture(); }
}
function until(s, condition, seconds, capture = () => {}) {
  const end = s.time + seconds;
  while (!condition() && s.time < end - 1e-8) { tick(s, Math.min(DT, end - s.time)); capture(); }
  assert(condition(), `condition not reached at ${s.time.toFixed(2)} seconds`);
}
const total = (u, channel = 'primary') => ammoSummary(u).find(row => row.channel === channel)?.total;
function record(s, source) {
  const seen = new Map();
  return { seen, capture: () => {
    for (const p of s.projectiles)
      if (p.sourceUid === source.uid && !seen.has(p)) seen.set(p, { ...p });
  } };
}

for (const side of [0, 1]) {
  test(`side ${side}: RPG, Javelin and landed airborne launchers acquire and damage a real tank before entering its gun range`, () => {
    for (const id of ['antiarmor', 'javelin', 'airborne_at']) {
      const s = arena(side), u = one(s, side, id, position(side, 1300));
      const tank = one(s, 1 - side, 'tank', u.x + direction(side) * 625);
      const hp = tank.hp, observed = record(s, u), loaded = total(u);
      refreshVision(s);
      assert(visibleToSide(s, side, tank), `${id} must obtain its own ordinary daytime observation`);
      until(s, () => tank.hp < hp, 5, observed.capture);
      assert(u.shots > 0, `${id} actually launches its primary weapon`);
      assert.equal(total(u), loaded - u.shots, `${id} spends one real rocket per launch`);
      assert([...observed.seen.values()].some(p => p.ammunition === 'rocket' && p.targetUid === tank.uid));
      assert.equal(tank.shots, 0, '625px is outside the normal 600px tank main-gun range');
      assert.equal(u.hp, u.maxHp, 'the first-shot improvement comes from observation and range');
      assert(hp - tank.hp >= 50, `${id} must cause useful actual armour damage, got ${hp - tank.hp}`);
    }
  });

  test(`side ${side}: improved infantry HP retains the tank counter instead of granting several free hits`, () => {
    const s = arena(side), rpg = one(s, side, 'antiarmor', position(side, 1400));
    Object.assign(rpg, { pose: 'idle', poseAnimSeen: 'stand', stanceLockUntil: 100,
      cooldown: 1e9, secondaryCooldown: 1e9 });
    const tank = one(s, 1 - side, 'tank', rpg.x + direction(side) * 450);
    assert.equal(rpg.hp, 50);
    refreshVision(s); until(s, () => rpg.wounded || rpg.destroyed || rpg.hp <= 0, 3);
    assert.equal(tank.shots, 1, 'one real high-explosive round still puts down an exposed RPG launcher');
    assert.equal(CARDS.javelin.hp / CARDS.javelin.members, 90);
    assert(CARDS.tank.damage < 90 && CARDS.heavy_tank.damage > 90,
      'Javelin durability permits one main-tank HE hit, but does not absorb a heavy-tank HE hit');
  });

  test(`side ${side}: prepared low AT operators get their first launch, reveal themselves and receive real tank return fire`, () => {
    for (const id of ['antiarmor', 'javelin', 'airborne_at']) {
      const s = arena(side), u = one(s, side, id, position(side, 1300));
      u.tactic = 'crouch';
      run(s, 1.6);
      assert(antiTankConcealed(u, s.time), `${id} must complete real stationary preparation`);
      const tank = one(s, 1 - side, 'tank', u.x + direction(side) * 500);
      const hp = u.hp; refreshVision(s);
      assert.equal(visibleToSide(s, 1 - side, u), false, 'an unassisted distant tank cannot see a prepared low launcher');
      until(s, () => u.shots > 0, 3);
      assert.equal(tank.shots, 0, `${id} must launch before tank acquisition, not just gain more HP`);
      assert.equal(antiTankConcealed(u, s.time), false, 'the real missile launch breaks concealment');
      run(s, DT * 2); assert(visibleToSide(s, 1 - side, u), 'the launched missile exposes its operator');
      until(s, () => tank.shots > 0 && (u.hp < hp || u.wounded), 4);
      assert.equal(isAntiTankOperator({ id: 'antiarmor', member: 1 }), false);
      assert.equal(isAntiTankOperator({ id: 'airborne_at', member: 2 }), false);
    }
  });

  test(`side ${side}: recon drone observes a distant tank and enables a real Javelin launch beyond unaided observation`, () => {
    const s = arena(side), launcher = one(s, side, 'javelin', position(side, 1300));
    const tank = one(s, 1 - side, 'tank', launcher.x + direction(side) * 900);
    refreshVision(s); assert.equal(visibleToSide(s, side, tank), false);
    const scout = one(s, side, 'scout_drone', launcher.x + direction(side) * 180);
    const hp = tank.hp; refreshVision(s);
    assert(visibleToSide(s, side, tank)); assert(droneRecon(s, side, launcher.x));
    assert(unitRange(s, launcher) >= 900);
    until(s, () => tank.hp < hp, 6);
    assert(launcher.shots > 0); assert.equal(scout.shots, 0, 'the scout itself remains unarmed');
    s.players[side].jam = 8;
    assert.equal(droneRecon(s, side, launcher.x), false, 'communications interference still stops the range relay');
    assert.equal(unitRange(s, launcher), weaponCard(launcher).range);
  });

  test(`side ${side}: armed UAV stays in forward flight, launches a real guided missile and causes meaningful armour damage`, () => {
    const s = arena(side), uav = one(s, side, 'attack_drone', position(side, 1000));
    const tank = one(s, 1 - side, 'heavy_tank', position(side, 1700));
    const hp = tank.hp, start = uav.x, observed = record(s, uav);
    refreshVision(s); run(s, 8, observed.capture);
    assert(tank.hp < hp, JSON.stringify({ drone: { x: uav.x, y: uav.y, hp: uav.hp, shots: uav.shots },
      tank: { x: tank.x, y: tank.y, hp: tank.hp }, missiles: [...observed.seen.values()] }));
    assert((uav.x - start) * direction(side) > 150, 'the attack window cannot be created by hovering');
    assert(uav.shots > 0);
    assert([...observed.seen.values()].some(p => p.ammunition === 'rocket' && p.guided && p.targetUid === tank.uid));
    assert(hp - tank.hp >= 90, `an actual anti-armour hit should matter, got ${hp - tank.hp}`);
    assert.equal(CARDS.attack_drone.returnCost, 1); assert.equal(CARDS.attack_drone.sortieCooldown, 16);
  });

  test(`side ${side}: dedicated guided AT missiles can damage heavy armour while ordinary RPG remains below its penetration tier`, () => {
    for (const id of ['javelin', 'tow_ifv']) {
      const s = arena(side), u = one(s, side, id, position(side, 1400));
      const tank = one(s, 1 - side, 'heavy_tank', u.x + direction(side) * 625);
      if (id === 'tow_ifv') one(s, side, 'scout_drone', u.x + direction(side) * 180);
      const hp = tank.hp, observed = record(s, u); refreshVision(s);
      until(s, () => tank.hp < hp, 6, observed.capture);
      assert([...observed.seen.values()].some(p => p.guided && p.targetUid === tank.uid));
      assert(hp - tank.hp >= 90, `${id} should cause real heavy-armour damage, got ${hp - tank.hp}`);
    }
    const s = arena(side), rpg = one(s, side, 'antiarmor', position(side, 1400));
    one(s, 1 - side, 'heavy_tank', rpg.x + direction(side) * 625);
    refreshVision(s); run(s, 2);
    assert.equal(rpg.shots, 0, 'an ordinary direct RPG does not inherit the specialist guided penetration');
  });

  test(`side ${side}: FPV and loitering munitions use distinct real acquisition windows and one physical warhead`, () => {
    for (const id of ['fpv_drone', 'loiter_drone']) {
      const s = arena(side), drone = one(s, side, id, position(side, 1200));
      if (id === 'loiter_drone') Object.assign(drone, {
        squadOrder: 'watch', squadOrderX: drone.x, squadOrderUntil: Infinity,
      });
      const tank = one(s, 1 - side, 'heavy_tank', drone.x + direction(side) * 520);
      const hp = tank.hp, observed = record(s, drone); refreshVision(s);
      until(s, () => drone.fpvLock || drone.loiterFlight?.candidateUid !== undefined, 2);
      if (id === 'loiter_drone') {
        const acquired = s.time;
        until(s, () => !!drone.loiterFlight?.lock, 4);
        assert(s.time - acquired >= 2 - DT, 'the stronger loitering card still needs continuous two-second confirmation');
      }
      until(s, () => drone.destroyed, 7, observed.capture);
      assert(hp - tank.hp >= 170, `${id} actual warhead should damage armour, got ${hp - tank.hp}`);
      assert.equal(observed.seen.size, 0, 'the munition aircraft itself must impact, not a remote projectile');
      const wreck = s.wrecks.find(w => w.id === drone.uid);
      assert(wreck?.spentWarhead); const after = tank.hp, blasts = s.explosions;
      run(s, 4); assert.equal(tank.hp, after); assert.equal(s.explosions, blasts);
      assert.deepEqual(s.players.map(p => p.hp), [1000, 1000], 'one-way drones still cannot bomb headquarters');
    }
  });

  test(`side ${side}: stronger drones can still be intercepted before delivering their warhead`, () => {
    for (const id of ['fpv_drone', 'loiter_drone']) {
      const s = arena(side), drone = one(s, side, id, position(side, 1200));
      const tank = one(s, 1 - side, 'heavy_tank', position(side, 1700));
      const sam = one(s, 1 - side, 'sam_vehicle', position(side, 1510));
      const hp = tank.hp; refreshVision(s);
      until(s, () => drone.destroyed, 5);
      assert(sam.shots > 0, 'a real air-defence projectile must be launched');
      assert.equal(tank.hp, hp, `${id} cannot deliver damage after its interception`);
    }
  });

  test(`side ${side}: TOW saves all primary missiles against infantry while its separate 500-round MG fires`, () => {
    const s = arena(side), tow = one(s, side, 'tow_ifv', position(side, 1500));
    const foot = one(s, 1 - side, 'infantry', tow.x + direction(side) * 300);
    const observed = record(s, tow), hp = foot.hp;
    refreshVision(s); run(s, 2, observed.capture);
    assert.equal(tow.shots, 0); assert.equal(total(tow), 8);
    assert(tow.secondaryShots > 0); assert(foot.hp < hp,
      JSON.stringify({ foot: { x: foot.x, y: foot.y, pose: foot.pose, hp: foot.hp }, bullets: [...observed.seen.values()] }));
    assert.equal(total(tow, 'secondary'), 500 - tow.secondaryShots);
    assert([...observed.seen.values()].every(p => p.ammunition === 'machinegun' && p.targetUid === foot.uid));
    assert.equal(observed.seen.size, tow.secondaryShots);
  });
}
