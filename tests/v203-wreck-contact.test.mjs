import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame, startGame, spawnUnit, tick, refreshVision, directShotIntercept,
  projectileIntercept, isCombatant, W,
} from '../game/engine.ts';
import { obstacleBoxes } from '../game/world.ts';

const DT = 1 / 60;
const at = (side, x) => side ? W - x : x;
const direction = side => side ? -1 : 1;
function arena(seed = 203) {
  const s = createGame(seed, undefined, undefined, undefined, { weather: false });
  startGame(s);
  Object.assign(s, { units: [], walls: [], scenery: [], wrecks: [], aiIn: 1e9 });
  s.terrain.fill(374); s.original.fill(374); s.terrainVersion++;
  return s;
}
function run(s, seconds, inspect) {
  for (let i = 0; i < Math.round(seconds / DT); i++) { tick(s, DT); inspect?.(); }
}
function one(s, side, id, x) {
  const count = s.units.length;
  spawnUnit(s, side, id, x);
  const u = s.units[count];
  s.units = s.units.slice(0, count).concat(u);
  Object.assign(u, { x, y: 374, cooldown: 0, lane: 0, secondaryCooldown: 1e9,
    pace: 1, personalMorale: 90, fragCooldown: 1e9 });
  return u;
}
function wreckWithCrew(s, side) {
  const vehicle = one(s, 1 - side, 'tank', at(side, 1200));
  vehicle.hp = 1; vehicle.cooldown = 1e9;
  // The normal impact/death/bailout path assigns the crew's identity and every
  // status; no hand-made infantry object or manufactured wreck is substituted.
  s.projectiles.push({ uid: ++s.uid, x: vehicle.x, y: 350, startX: vehicle.x,
    startY: 350, tx: vehicle.x, ty: 350, side, targetUid: vehicle.uid, base: null,
    damage: 10, radius: 0, shell: false, ammunition: 'ap', life: .02, total: .02 });
  run(s, .2);
  const crew = s.units.filter(u => u.side !== side && u.bailoutUntil !== undefined);
  assert(crew.length > 0);
  assert(crew.every(u => u.id === 'infantry' && isCombatant(u)), 'survivors are normal targetable infantry');
  assert(obstacleBoxes(s).some(b => b.wreck?.id === vehicle.uid), 'the real hulk remains solid');
  return crew;
}

for (const side of [0, 1]) {
  test(`side ${side}: a nearby tank wreck blocks rifle aim and the actual round in both directions`, () => {
    const s = arena();
    wreckWithCrew(s, side);
    const metal = obstacleBoxes(s).filter(b => b.wreck && b.w > 50 && b.h >= 4)[0];
    assert(metal, 'wide opaque track/hull strip');
    const y = metal.y + metal.h / 2;
    for (const sign of [-1, 1]) {
      const sx = sign > 0 ? metal.x - 10 : metal.x + metal.w + 10;
      const tx = sx + sign * 600;
      assert(directShotIntercept(s, 'rifle', sx, y, tx, y), 'near metal is not exempt from aim checks');
      const p = { ammunition: 'rifle', startX: sx, startY: y, tx, ty: y,
        life: 1, total: 1, passedCover: [] };
      assert(projectileIntercept(s, p, sx, y, sx + sign * 30, y),
        'the travelling bullet hits metal even in the first half of its path');
    }
  });

  test(`side ${side}: twelve riflemen engage a real escaped crewman without a one-way wreck stalemate`, () => {
    const s = arena(), crew = wreckWithCrew(s, side);
    assert.equal(crew.length, 1, 'seed reproduces the single defender screenshot failure');
    // Keep both parties alive long enough to measure every firing position.
    // Weapon, stance, recoil, visibility, collision and decision loops stay real.
    for (const u of crew) Object.assign(u, { hp: 1000, maxHp: 1000, personalMorale: 90, suppression: 0 });
    const squad = [];
    for (let member = 0; member < 12; member++) {
      const u = one(s, side, 'infantry', at(side, 900 + member * 8));
      Object.assign(u, { squad: 777, member: member % 6, lane: member % 3 * 10,
        hp: 10000, maxHp: 10000 });
      squad.push(u);
    }
    const start = squad.map(u => u.x), hp = crew[0].hp;
    refreshVision(s);
    // The defender now walks out of the blocked hull instead of staying fixed.
    run(s, 45);
    assert(squad.filter(u => u.shots >= 3).length >= 8,
      `most of the line finds real shots: ${squad.map(u => u.shots)}`);
    assert(crew[0].hp < hp - 30, 'rounds reach and damage the exposed defender');
    assert(squad.some((u, i) => (u.x - start[i]) * direction(side) > 130),
      'a blocked rifleman moves beyond the old half-range stop to a usable ray');
  });

  test(`side ${side}: two complete infantry squads clear two actual vehicle survivors and resume their advance`, () => {
    const s = arena(209), crew = wreckWithCrew(s, side);
    assert.equal(crew.length, 2);
    for (const u of crew) Object.assign(u, { personalMorale: 90, suppression: 0 });
    const own = [];
    for (let i = 0; i < 2; i++) {
      const count = s.units.length;
      spawnUnit(s, side, 'infantry', at(side, 900 + i * 40));
      for (const u of s.units.slice(count)) {
        // Isolate rifle/positioning behavior; grenades must not mask a blocked
        // firing loop. Health, roster, formation and AI are normal card values.
        u.fragCooldown = 1e9;
        own.push(u);
      }
    }
    assert.equal(own.length, 12);
    // spawnUnit seeds shots with the member index to stagger bursts; only
    // subsequent increments prove a rifle has actually discharged.
    const initialShots = new Map(own.map(u => [u.uid, u.shots]));
    refreshVision(s); run(s, 60);
    assert(crew.every(u => !isCombatant(u)), 'both defenders are actually neutralized');
    assert(own.filter(u => u.shots > initialShots.get(u.uid)).length >= 6,
      'at least half the line actually shoots before the two normal-health defenders are cleared');
    assert(own.filter(isCombatant).length >= 8, 'the protected crew cannot pick off the entire line');
    assert(own.some(u => isCombatant(u) && (u.x - at(side, 1700)) * direction(side) > 0),
      'clearing contact releases the line to advance beyond the wreck');
  });
}
