import test from 'node:test';
import assert from 'node:assert/strict';
import { gunMount, gunPose, aimedGunSolution, indirectArc } from '../game/gun-geometry.ts';
import { lobY } from '../game/lob-trajectory.ts';
import { createGame, startGame, spawnUnit, tick, refreshVision, W } from '../game/engine.ts';

const DT = 1 / 120;
const near = (a, b, label) => assert(Math.abs(a - b) < 1e-7, `${label}: ${a} versus ${b}`);
function field(seed = 202400) {
  const s = createGame(seed, undefined, undefined, undefined, { difficulty: 'standard', weather: false });
  startGame(s);
  Object.assign(s, { units: [], scenery: [], walls: [], wrecks: [], aiIn: 1e9, night: false });
  s.terrain.fill(374); s.original.fill(374); s.terrainVersion++;
  for (const p of s.players) Object.assign(p, { order: 'hold', hand: [], deck: [], discard: [], energy: 0, recon: 100 });
  return s;
}
function unit(s, side, id, x) {
  const n = s.units.length;
  spawnUnit(s, side, id, x); s.units.splice(n + 1);
  const u = s.units[n];
  Object.assign(u, { x, y: 374, hullAngle: 0, buildUntil: 0, cooldown: 0, secondaryCooldown: 1e9,
    squadOrder: 'watch', squadOrderX: x, squadOrderUntil: Infinity, logisticsOrder: 'hold',
    decisionIn: 1e9, tactic: 'advance', stillFor: 10, emplaced: true, emplacementSetupUntil: 0 });
  return u;
}
function shell(s, u) {
  refreshVision(s);
  for (let i = 0; i < 6 / DT; i++) {
    tick(s, DT);
    const p = s.projectiles.find(p => p.sourceUid === u.uid && p.weapon !== 'coax');
    if (p) return p;
  }
  assert.fail(`${u.id} did not launch a round: ${JSON.stringify({ x: u.x, y: u.y, shots: u.shots, hp: u.hp })}`);
}

for (const side of [0, 1]) {
  const dir = side ? -1 : 1;
  test(`side ${side}: all tank limits follow the sloping hull and the shell leaves its visible barrel`, () => {
    for (const id of ['light_tank', 'tank', 'heavy_tank']) {
      const mount = gunMount(id);
      for (const hullAngle of [-.2, 0, .2]) {
        const body = { id, x: 1700, y: 374, side, facing: dir, hullAngle };
        for (const e of [mount.minElevation, 0, mount.maxElevation]) {
          const pose = gunPose(body, e), tx = pose.pivot.x + Math.cos(pose.angle) * 600,
            ty = pose.pivot.y + Math.sin(pose.angle) * 600;
          const aim = aimedGunSolution(body, tx, ty);
          assert(aim.canFire, `${id} can reach its exact legal endpoint`);
          near(aim.elevation, e, 'relative elevation');
          near(Math.atan2(ty - aim.muzzle.y, tx - aim.muzzle.x), Math.atan2(Math.sin(aim.angle), Math.cos(aim.angle)), 'launch tangent');
          near(Math.hypot(aim.muzzle.x - aim.pivot.x, aim.muzzle.y - aim.pivot.y), mount.barrelLength, 'barrel length');
        }
        for (const e of [mount.minElevation - .15, mount.maxElevation + .15]) {
          const baseline = hullAngle + (side ? Math.PI : 0), angle = baseline - dir * e;
          const pose = gunPose(body), aim = aimedGunSolution(body,
            pose.pivot.x + Math.cos(angle) * 600, pose.pivot.y + Math.sin(angle) * 600);
          assert.equal(aim.canFire, false, `${id} cannot shoot beyond its elevation stops`);
          assert(aim.elevation >= mount.minElevation && aim.elevation <= mount.maxElevation);
        }
      }
    }
  });

  test(`side ${side}: actual tank and howitzer shells share rendered muzzle and launch tangent`, () => {
    for (const id of ['light_tank', 'tank', 'heavy_tank', 'field_gun', 'artillery']) {
      const s = field(), x = side ? W - 1400 : 1400;
      const u = unit(s, side, id, x), v = unit(s, 1 - side, 'artillery', x + dir * 480);
      unit(s, side, 'scouts', x + dir * 280).cooldown = 1e9;
      v.cooldown = 1e9;
      const p = shell(s, u), pose = gunPose(u);
      near(p.startX, pose.muzzle.x, `${id} muzzle x`);
      near(p.startY, pose.muzzle.y, `${id} muzzle y`);
      const tangent = Math.atan2(p.ty - p.startY - 4 * p.arc, p.tx - p.startX);
      near(Math.sin(tangent), Math.sin(pose.angle), `${id} barrel / flight angle`);
      near(Math.cos(tangent), Math.cos(pose.angle), `${id} mirrored barrel / flight angle`);
      near(u.shotAngle, tangent, `${id} flash tangent`);
      assert(p.total < 2, 'nearby field-gun rounds do not artificially float for two seconds');
    }
  });

  test(`side ${side}: a tank cannot fire down a cliff through its elevation stop`, () => {
    const s = field(), x = side ? W - 1400 : 1400;
    const u = unit(s, side, 'tank', x), v = unit(s, 1 - side, 'artillery', x + dir * 310);
    for (let i = 0; i < s.terrain.length; i++) {
      const y = (i - x) * dir < 180 ? 250 : 470;
      s.terrain[i] = s.original[i] = y;
    }
    Object.assign(u, { y: 250, hullAngle: 0 });
    Object.assign(v, { y: 470, cooldown: 1e9 });
    s.terrainVersion++;
    refreshVision(s);
    assert.equal(aimedGunSolution(u, v.x, v.y - 27).canFire, false);
    for (let i = 0; i < 3 / DT; i++) tick(s, DT);
    assert.equal(u.shots, 0, 'an unreachable visible target consumes no main-gun ammunition');
  });
}

test('near howitzer fire is shallow, grows with distance, and obeys the exact visible launch direction', () => {
  const body = { id: 'artillery', x: 1000, y: 374, hullAngle: 0, side: 0 };
  const nearShot = aimedGunSolution(body, 1300, 366), farShot = aimedGunSolution(body, 2200, 366);
  assert(nearShot.arc < 28, `nearby shell should not use the old 170px mortar arc: ${nearShot.arc}`);
  assert(farShot.arc > nearShot.arc * 3, 'elevation visibly grows for a long shot');
  for (const shot of [nearShot, farShot]) {
    const tx = shot === nearShot ? 1300 : 2200;
    near(lobY(shot.muzzle.y, 366, shot.arc, 0), shot.muzzle.y, 'first trajectory point');
    near(lobY(shot.muzzle.y, 366, shot.arc, 1), 366, 'impact point');
    near(Math.atan2(366 - shot.muzzle.y - 4 * shot.arc, tx - shot.muzzle.x), shot.angle, 'analytic launch tangent');
  }
  assert(indirectArc('mlrs', 0, 250, 400, 340) < 65, 'rockets do not inherit the mortar arc');
  for (const side of [0, 1]) for (const hull of [-.08, 0, .08]) {
    const dir = side ? -1 : 1, dx = dir * 600;
    const arc = indirectArc('mlrs', 0, 250, dx, 340, hull);
    const tangent = Math.atan2(90 - 4 * arc, dx);
    near(Math.sin(tangent), Math.sin(hull + (side ? Math.PI : 0) - dir * Math.PI / 15), 'fixed rocket rack tangent');
  }
});

test('ordinary, light and vehicle mortars retain their previous arc and two-second minimum flight', () => {
  for (const id of ['mortar', 'light_mortar', 'mortar_carrier']) {
    const s = field(), u = unit(s, 0, id, 1400);
    unit(s, 1, 'artillery', 1880).cooldown = 1e9;
    unit(s, 0, 'scouts', 1680).cooldown = 1e9;
    const p = shell(s, u);
    assert.equal(p.arc, 170, `${id} keeps its original high-angle trajectory`);
    assert.equal(p.total, 2, `${id} retains its original airtime`);
  }
});
