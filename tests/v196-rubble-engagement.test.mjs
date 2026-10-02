import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, spawnUnit, tick, refreshVision, W, muzzlePoint } from '../game/engine.ts';
import { cloneScenery, buildingStage, obstacleBoxes } from '../game/world.ts';
import { setSquadOrder } from '../game/squad-orders.ts';

const DT = 1 / 60;
const toward = side => side ? -1 : 1;
const mirrored = (side, value) => side ? W - value : value;
function arena(seed = 196) {
  const s = createGame(seed, undefined, undefined, undefined, { weather: false });
  startGame(s);
  Object.assign(s, { units: [], walls: [], scenery: [], wrecks: [], aiIn: 1e9 });
  s.terrain.fill(374); s.original.fill(374); s.terrainVersion++;
  return s;
}
function single(s, side, at, pose = 'idle', id = 'infantry', member = 0) {
  const count = s.units.length;
  spawnUnit(s, side, id, at);
  const u = s.units[count + member];
  s.units = s.units.slice(0, count).concat(u);
  Object.assign(u, { pose, tactic: pose === 'idle' ? 'advance' : pose,
    x: at, y: 374,
    decisionIn: 1e9, stanceLockUntil: 100, readyAt: -10, aimUntil: 100,
    poseAnimFrom: undefined, poseAnimAt: undefined, poseAnimProgress: undefined,
    poseAnimSeen: pose === 'idle' ? 'stand' : pose, pace: 1,
    personalMorale: 100, hp: 10000, maxHp: 10000,
    cooldown: 0, shots: 0, rifleReady: 1, fragCooldown: 1e9 });
  return u;
}
function ruin(s, at, building = 0, partial = false) {
  const original = createGame(37).scenery.find(p => p.kind === 'house' && p.building === building) ??
    createGame(37).scenery.find(p => p.kind === 'house');
  const prop = cloneScenery(original);
  const dx = at - prop.x, dy = 374 - prop.y;
  prop.x = at; prop.y = 374; prop.building = building;
  for (const part of prop.parts) {
    part.x += dx; part.y += dy;
    part.hp = partial && part.kind === 'wall' ? part.maxHp * 0.35 : 0;
  }
  s.scenery = [prop];
  assert.equal(buildingStage(prop), partial ? 2 : 3);
  return prop;
}
function run(s, seconds, inspect) {
  for (let i = 0; i < Math.round(seconds / DT); i++) { tick(s, DT); inspect?.(); }
}

for (const side of [0, 1]) {
  test(`side ${side}: lying riflemen hit the exposed upper body at a settled ruin edge`, () => {
    const s = arena();
    ruin(s, mirrored(side, 1100));
    const shooter = single(s, side, mirrored(side, 800), 'prone');
    const target = single(s, 1 - side, mirrored(side, 1100), 'crouch');
    target.cooldown = 1e9;
    s.players[side].order = 'prone'; s.players[1 - side].order = 'hold';
    const hp = target.hp, start = shooter.x;
    refreshVision(s);
    const aims = [];
    run(s, 4, () => {
      for (const p of s.projectiles) if (p.sourceUid === shooter.uid) aims.push(p.ty);
    });
    assert(shooter.shots > 3, 'the exposed target does not silence the rifleman');
    assert(target.hp < hp - 1, 'real projectiles reach and damage the body');
    assert.equal(shooter.x, start, 'a valid elevated aim point avoids an unnecessary charge');
    assert(aims.some(y => y < 348), `uses the exposed point rather than the low centre: ${aims}`);
  });

  test(`side ${side}: a full squad returns real fire against one defender in a ruin`, () => {
    const s = arena();
    ruin(s, mirrored(side, 1100));
    const own = [];
    for (let member = 0; member < 6; member++) {
      const u = single(s, side, mirrored(side, 820 + member * 12), 'prone');
      own.push(u);
      u.squad = own[0].squad; u.member = member; u.lane = 0;
    }
    const defender = single(s, 1 - side, mirrored(side, 1100), 'crouch');
    defender.lane = 0;
    s.players[side].order = 'prone'; s.players[1 - side].order = 'hold';
    const ownHp = own.reduce((sum, u) => sum + u.hp, 0), hp = defender.hp;
    refreshVision(s);
    run(s, 4);
    assert(own.every(u => u.shots >= 3), `every rifleman takes a usable shot: ${own.map(u => u.shots)}`);
    assert(defender.hp < hp - 1, 'the squad deals actual damage through exposed-body shots');
    assert(defender.shots > 0, 'the defender also shoots from its actual clear muzzle');
    assert(own.reduce((sum, u) => sum + u.hp, 0) < ownHp, 'both directions connect real projectiles');
  });

  test(`side ${side}: a rifleman inside a partial collapse leaves the opaque wall before firing`, () => {
    const s = arena();
    ruin(s, mirrored(side, 1000), 0, true);
    const shooter = single(s, side, mirrored(side, side ? 1030 : 960));
    const enemy = single(s, 1 - side, mirrored(side, 1380));
    enemy.cooldown = 1e9;
    s.players[side].order = 'advance'; s.players[1 - side].order = 'hold';
    const start = shooter.x, hp = enemy.hp;
    refreshVision(s);
    let firstShotAt = null, invalidShot = false;
    let seenShots = shooter.shots;
    run(s, 12, () => {
      if (shooter.shots > seenShots) {
        firstShotAt ??= s.time;
        const p = muzzlePoint(shooter, enemy.x);
        invalidShot ||= obstacleBoxes(s).some(part => !part.foliage &&
          p.x > part.x && p.x < part.x + part.w && p.y > part.y && p.y < part.y + part.h);
      }
      seenShots = shooter.shots;
    });
    assert(Math.abs(shooter.x - start) > 24, `an obstructed firing post is vacated: ${JSON.stringify({start,x:shooter.x,goal:shooter.firingGoal,pose:shooter.pose,shots:shooter.shots,target:shooter.lastThreat,cover:shooter.cover})}`);
    assert(firstShotAt !== null && firstShotAt < 12, 'does not wait for the 35-second timeout');
    assert.equal(invalidShot, false, 'a barrel embedded in an opaque wall never fires through it');
    assert(enemy.hp < hp, 'the new position really connects fire');
  });

  test(`side ${side}: hold and watch keep their post when no local firing angle exists`, () => {
    for (const order of ['hold', 'watch']) {
      const s = arena();
      ruin(s, mirrored(side, 1000), 0, true);
      const shooter = single(s, side, mirrored(side, 940));
      const enemy = single(s, 1 - side, mirrored(side, 1320));
      enemy.cooldown = 1e9;
      s.players[1 - side].order = 'hold';
      if (order === 'watch') setSquadOrder(s, side, shooter.squad, 'watch');
      else { s.players[side].order = 'hold'; shooter.squadOrder = 'hold'; shooter.squadOrderUntil = Infinity; }
      const start = shooter.x;
      refreshVision(s);
      run(s, 40);
      assert.equal(shooter.squadOrder, order);
      assert(Math.abs(shooter.x - start) <= 32.01, 'never pursues the contact outside its post');
      assert(!shooter.stalemateCloseUntil || shooter.stalemateCloseUntil < s.time,
        'the timeout cannot silently turn a hold into an assault');
    }
  });

  test(`side ${side}: watch clears a nearby wall edge without abandoning its original post`, () => {
    const s = arena();
    const prop = ruin(s, mirrored(side, 1000), 0, true);
    const at = side === 0 ? prop.x - 5 : prop.x - 75;
    const shooter = single(s, side, at);
    const enemy = single(s, 1 - side, mirrored(side, 1360));
    enemy.cooldown = 1e9;
    s.players[1 - side].order = 'hold';
    setSquadOrder(s, side, shooter.squad, 'watch');
    refreshVision(s);
    const start = shooter.x, anchor = shooter.squadOrderX, hp = enemy.hp;
    let furthest = 0;
    run(s, 8, () => { furthest = Math.max(furthest, Math.abs(shooter.x - start)); });
    assert(furthest > 5 && furthest <= 32.01, `uses a bounded local firing step: ${furthest}`);
    assert.equal(shooter.squadOrder, 'watch');
    assert.equal(shooter.squadOrderX, anchor);
    assert(shooter.shots > 0 && enemy.hp < hp, 'the newly cleared angle actually fires and hits');
  });
}

test('concealed enemy coordinates do not create a firing-position maneuver', () => {
  const s = arena();
  ruin(s, 1000, 0, true);
  const shooter = single(s, 0, 940);
  single(s, 1, 1600).cooldown = 1e9;
  s.players[0].order = 'hold'; s.players[1].order = 'hold';
  s.players[0].sensorBlindUntil = 100;
  refreshVision(s);
  const start = shooter.x;
  run(s, 3);
  assert.equal(shooter.x, start);
  assert.equal(shooter.shots, 0);
  assert.equal(shooter.firingGoal, null);
  assert.equal(shooter.blockedFireTargetUid, undefined);
});

for (const side of [0, 1]) test(`side ${side}: a close obstructed contact is approached before the old timeout`, () => {
  const s = arena();
  ruin(s, mirrored(side, 1000), 0, true);
  const shooter = single(s, side, mirrored(side, side === 0 ? 960 : 1040));
  const enemy = single(s, 1 - side, mirrored(side, side === 0 ? 1100 : 1190));
  enemy.cooldown = 1e9;
  s.players[side].order = 'advance'; s.players[1 - side].order = 'hold';
  const start = shooter.x;
  refreshVision(s);
  run(s, 4);
  assert((shooter.x - start) * toward(side) > 15, 'the old 140px standoff does not freeze a blocked contact');
  assert(Math.abs(enemy.x - shooter.x) >= 55, 'the firing bound never runs through the defender');
});

for (const side of [0, 1]) test(`side ${side}: the light-mortar rifle escort never inherits indirect fire through a wall`, () => {
  const s = arena();
  ruin(s, mirrored(side, 1000), 0, true);
  const at = mirrored(side, side === 0 ? 950 : 1030);
  const guard = single(s, side, at, 'idle', 'light_mortar', 1);
  const enemy = single(s, 1 - side, mirrored(side, 1290));
  enemy.cooldown = 1e9;
  s.players[1 - side].order = 'hold';
  setSquadOrder(s, side, guard.squad, 'watch');
  refreshVision(s);
  run(s, 3);
  assert.equal(guard.shots, 0, 'the rifle cannot use the mortar card’s curve-fire permission');
  setSquadOrder(s, side, guard.squad, 'attack');
  const hp = enemy.hp;
  let solidBarrelShot = false, previous = guard.shots;
  run(s, 10, () => {
    if (guard.shots > previous) solidBarrelShot ||= obstacleBoxes(s).some(box =>
      !box.foliage && guard.muzzleX > box.x && guard.muzzleX < box.x + box.w &&
      guard.muzzleY > box.y && guard.muzzleY < box.y + box.h);
    previous = guard.shots;
  });
  assert(guard.shots > 0 && enemy.hp < hp, 'the escort moves into a real rifle firing lane');
  assert.equal(guard.lastAmmo, 'rifle');
  assert.equal(solidBarrelShot, false);
});
