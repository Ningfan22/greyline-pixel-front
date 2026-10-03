import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, spawnUnit, tick, refreshVision, visibleToSide, unitRange, W } from '../game/engine.ts';
import { obstacleBoxes } from '../game/world.ts';
import { initializeAmmo, ammoProfile } from '../game/ammo-logistics.ts';
import { stanceTransitionActive } from '../game/infantry-action-timing.ts';
import { crouchMotionActive } from '../game/crouch-locomotion.ts';
import { proneMotionActive } from '../game/prone-locomotion.ts';

const DT = 1 / 60;
function village(side) {
  // Keep the same match RNG and authored village as the actual browser report.
  const s = createGame(198, undefined, undefined, undefined,
    { weather: false, difficulty: 'standard', mapSeed: 119 });
  startGame(s);
  Object.assign(s, { units: [], wrecks: [], aiIn: 1e9, night: false });
  for (const p of s.players)
    Object.assign(p, { order: 'advance', hand: [], deck: [], discard: [], energy: 0 });
  const at = side ? W - 1500 : 1500, dir = side ? -1 : 1;
  spawnUnit(s, side, 'antiarmor', at);
  spawnUnit(s, 1 - side, 'tank', at + dir * 650);
  refreshVision(s);
  return { s, dir, own: s.units.filter(u => u.side === side),
    tank: s.units.find(u => u.side !== side) };
}
const sceneryHealth = s => s.scenery.reduce((sum, prop) =>
  sum + prop.parts.reduce((n, part) => n + part.hp, 0), 0);
const bodyDistance = (u, x, y) => Math.hypot(u.x - x, u.y - 20 - y);
const alive = u => u.hp > 0 && !u.surrendered;

for (const side of [0, 1]) {
  test(`side ${side}: seed 198 RPG guards leave a real safe breach lane while the enemy returns fire`, t => {
    const { s, own, tank } = village(side), operator = own.find(u => u.member === 0);
    assert.equal(operator.hp, 50); assert.equal(tank.hp, 650);
    const initialHealth = sceneryHealth(s), rounds = new Map(), pending = new Map();
    let firstFire = null, actualSafeImpacts = 0, counterfireDamage = false;
    let minimumSafety = Infinity;
    let readySilence = 0, longestReadySilence = 0, firstTankFire = null, firstCoverDamage = null;
    let firstReloadReadyAt = null, operatorKilledAt = null;
    for (let frame = 0; frame < 40 / DT; frame++) {
      const health = own.map(u => u.hp);
      const previousX = operator.x;
      tick(s, DT);
      if (tank.shots > 0) firstTankFire ??= s.time;
      if (sceneryHealth(s) < initialHealth) firstCoverDamage ??= s.time;
      if (operator.hp <= 0) operatorKilledAt ??= s.time;
      const ready = firstFire === null && operator.shots === 0 && alive(operator) &&
        operator.ammo > 0 && operator.cooldown <= 0 && operator.suppression < 35 &&
        (operator.reloadingUntil ?? 0) <= s.time && visibleToSide(s, side, tank) &&
        Math.abs(operator.x - tank.x) <= unitRange(s, operator);
      const acting = operator.moving || Math.abs(operator.x - previousX) > .001 ||
        operator.motion !== 'ground' || operator.climbing > 0 ||
        (operator.flinchUntil ?? 0) > s.time || stanceTransitionActive(operator, s.time) ||
        crouchMotionActive(operator) || proneMotionActive(operator);
      readySilence = ready && !acting ? readySilence + DT : 0;
      longestReadySilence = Math.max(longestReadySilence, readySilence);
      counterfireDamage ||= own.some((u, i) => u.hp < health[i]);
      for (const p of s.projectiles) if (p.sourceUid === operator.uid &&
          p.ammunition === 'rocket' && !rounds.has(p.uid)) {
        firstFire ??= s.time;
        firstReloadReadyAt ??= s.time + Math.max(0, operator.cooldown);
        rounds.set(p.uid, p);
        assert.equal(p.base, null, 'the rocket is for the visible contact or its obstructing cover');
        assert(Math.abs(operator.x - tank.x) >= 250, 'the crew does not rush into the tank to unlock firing');
        assert(Math.hypot(p.startX - operator.muzzleX, p.startY - operator.muzzleY) < 0.01,
          'the projectile and actual firing-frame muzzle use the same origin');
        assert(!obstacleBoxes(s).some(b => !b.foliage && p.startX > b.x &&
          p.startX < b.x + b.w && p.startY > b.y && p.startY < b.y + b.h),
        'no rocket originates inside an opaque wall or tree');
        if (p.targetUid === null) {
          for (const friend of own.filter(alive)) {
            const distance = bodyDistance(friend, p.tx, p.ty);
            minimumSafety = Math.min(minimumSafety, distance - p.radius);
            assert(distance >= p.radius + 45,
              `a rifle guard must not occupy the actual intended blast lane: ${distance}`);
          }
          pending.set(p.uid, { x: p.tx, y: p.ty, radius: p.radius });
        }
      }
      for (const [uid, aim] of pending) if (!s.projectiles.some(p => p.uid === uid)) {
        // Soil blast visuals sit on the ground; explosive damage still uses
        // the real impact point. Associate this event by tick, X and radius.
        const impact = s.blasts.find(b => b.age <= DT + 1e-8 && b.radius === aim.radius &&
          Math.abs(b.x - aim.x) < 8);
        if (impact) {
          actualSafeImpacts++;
          for (const friend of own.filter(alive))
            assert(bodyDistance(friend, aim.x, aim.y) >= impact.radius + 12,
              'guards remain outside the actual rocket damage radius on impact');
        }
        pending.delete(uid);
      }
    }
    // The v203 visible tank muzzle can breach this village first (6.98s),
    // destroying the RPG's planned wall and requiring a new safe firing ray.
    // Allow one posture commitment plus the ensuing movement/settling drill;
    // separately reject a loaded, calm operator actually standing silent.
    assert(firstFire !== null && firstFire < 16,
      `the live squad must complete its safe firing maneuver within one posture cycle: ${firstFire}`);
    assert(longestReadySilence < 2,
      `a loaded operator must not freeze behind guards without moving or settling: ${longestReadySilence}`);
    const killedBeforeSecondShot = operatorKilledAt !== null && firstReloadReadyAt !== null &&
      operatorKilledAt < firstReloadReadyAt;
    assert((rounds.size >= 2 || (rounds.size === 1 && killedBeforeSecondShot)) && actualSafeImpacts >= 1,
      'real rockets explode safely; a surviving operator keeps firing, while one killed during reload cannot invent a second shot');
    assert(minimumSafety >= 45 && sceneryHealth(s) < initialHealth, 'safe real impacts damage the original cover');
    // At this standoff the main gun can return fire while the coax is out of range.
    assert(tank.shots > 0 && counterfireDamage,
      `normal enemy counterfire: ${JSON.stringify({main: tank.shots, coax: tank.secondaryShots, counterfireDamage, hp: own.map(u => u.hp)})}`);
    // An isolated RPG team may lose this fight. Two unspent rounds on a killed
    // operator are not a firing deadlock and must not be spent artificially.
    if (operator.hp <= 0) assert(operator.ammo > 0);
    t.diagnostic(JSON.stringify({ firstFire, firstTankFire, firstCoverDamage,
      longestReadySilence, rockets: rounds.size, actualSafeImpacts, counterfireDamage,
      firstReloadReadyAt, operatorKilledAt }));
  });

  test(`side ${side}: a temporarily empty AT launcher with reserve still keeps its rifle guards behind it`, () => {
    const { s, own, tank, dir } = village(side), operator = own.find(u => u.member === 0);
    for (const u of own) initializeAmmo(u);
    const capacity = ammoProfile(operator).primary.mag;
    operator.ammo = 0; operator.ammoReserve = capacity;
    operator.reloadingUntil = s.time + 3;
    const initialX = own.map(u => u.x);
    let worstForwardLead = -Infinity, maximumFrameStep = 0;
    for (let frame = 0; frame < 2.8 / DT; frame++) {
      const before = own.map(u => u.x);
      tick(s, DT);
      for (const [i, guard] of own.entries()) if (guard.member > 0 && alive(guard)) {
        maximumFrameStep = Math.max(maximumFrameStep, Math.abs(guard.x - before[i]));
        if (s.time > 1.5)
          worstForwardLead = Math.max(worstForwardLead, (guard.x - operator.x) * dir);
      }
    }
    assert.equal(operator.ammo, 0); assert.equal(operator.ammoReserve, capacity);
    assert(operator.reloadingUntil > s.time, 'the test observes the actual loaded-zero, reserve-positive interval');
    assert(worstForwardLead <= -20, `guards retain the rear post through the reload: ${worstForwardLead}`);
    assert(own.some((u, i) => u.member > 0 && Math.abs(u.x - initialX[i]) > 1),
      'the squad reaches its safe formation by real foot movement');
    assert(maximumFrameStep < 2, 'there is no instantaneous repositioning');
    assert(tank.hp === 650, 'holding the firing lane does not invent AT damage during reload');
  });
}
