import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, spawnUnit, tick, refreshVision, muzzlePoint, CARDS, W } from '../game/engine.ts';
import { obstacleBoxes } from '../game/world.ts';
import { setSquadOrder } from '../game/squad-orders.ts';

const DT = 1 / 60;
const toward = side => side ? -1 : 1;
function battlefield(seed = 119) {
  const s = createGame(seed, undefined, undefined, undefined,
    { weather: false, difficulty: 'standard', mapSeed: seed });
  startGame(s);
  s.aiIn = 1e9; s.units = [];
  for (const p of s.players)
    Object.assign(p, { order: 'advance', hand: [], deck: [], discard: [], energy: 0 });
  return s;
}
function run(s, seconds, inspect) {
  for (let i = 0; i < Math.round(seconds / DT); i++) { tick(s, DT); inspect?.(); }
}
function buried(s, x, y) {
  return obstacleBoxes(s).some(b => !b.foliage && x > b.x && x < b.x + b.w &&
    y > b.y && y < b.y + b.h);
}

for (const side of [0, 1]) {
  test(`side ${side}: a watched tank clears its barrel locally without drifting beyond its post`, () => {
    const s = battlefield(119);
    s.terrain.fill(374); s.original.fill(374); s.terrainVersion++;
    s.scenery = []; s.walls = []; s.wrecks = [];
    const at = side ? W - 1200 : 1200, d = toward(side);
    spawnUnit(s, side, 'tank', at);
    spawnUnit(s, 1 - side, 'light_tank', at + d * 360);
    const own = s.units[0], foe = s.units[1];
    const point = muzzlePoint(own, foe.x);
    s.scenery = [{ id: 991, kind: 'tree', x: point.x, y: 374, seed: 0,
      parts: [{ id: 0, x: point.x - 15, y: 300, w: 30, h: 74,
        hp: 60, maxHp: 60, kind: 'trunk', brokenAt: -1 }] }];
    assert(buried(s, point.x, point.y), 'the original watched muzzle is actually obstructed');
    assert(setSquadOrder(s, side, own.squad, 'watch').ok);
    assert(setSquadOrder(s, 1 - side, foe.squad, 'watch').ok);
    const anchor = own.squadOrderX;
    let furthest = 0, illegalOrigin = false, actualShots = 0;
    const launches = new Set();
    refreshVision(s);
    run(s, 18, () => {
      furthest = Math.max(furthest, Math.abs(own.x - anchor));
      for (const p of s.projectiles) if (p.sourceUid === own.uid && p.weapon !== 'coax' &&
          !launches.has(p.uid)) {
        launches.add(p.uid); actualShots++;
        illegalOrigin ||= buried(s, p.startX, p.startY);
      }
    });
    assert(own.shots > 0 && foe.shots > 0 && actualShots > 0, 'both normal crews actually fire');
    assert(furthest > 5 && furthest <= 32.01, `uses only a bounded local firing step: ${furthest}`);
    assert.equal(own.squadOrderX, anchor, 'the original post never drifts with each adjustment');
    assert.equal(own.squadOrder, 'watch');
    assert.equal(illegalOrigin, false, 'the real barrel leaves the opaque tree before firing');
    assert.equal(own.facing, d, 'a backward adjustment retains the hull facing toward contact');
  });

  test(`side ${side}: normal advancing tanks breach a real village firing lane and both shoot`, () => {
    const s = battlefield(119);
    const at = side ? W - 1500 : 1500;
    spawnUnit(s, side, 'tank', at);
    spawnUnit(s, 1 - side, 'tank', at + toward(side) * 650);
    const actors = [...s.units];
    tick(s, DT);
    assert(actors.every(u => u.hp === CARDS.tank.hp && u.ammo === 12));
    const propHealth = s.scenery.reduce((n, p) => n + p.parts.reduce((sum, part) => sum + part.hp, 0), 0);
    const shells = new Map();
    let embedded = false, nearest = Infinity;
    refreshVision(s);
    run(s, 32, () => {
      if (actors.every(u => u.hp > 0)) nearest = Math.min(nearest, Math.abs(actors[0].x - actors[1].x));
      for (const p of s.projectiles) if (actors.some(u => u.uid === p.sourceUid) && p.weapon !== 'coax' &&
          !shells.has(p.uid)) {
        shells.set(p.uid, { side: p.side, kind: p.ammunition, target: p.targetUid, base: p.base });
        embedded ||= buried(s, p.startX, p.startY);
      }
    });
    for (const u of actors)
      assert(u.shots > 0, `both sides return actual main-gun fire, side ${u.side}: ${u.shots}`);
    assert([...shells.values()].some(p => p.target === null && p.base === null && p.kind === 'cannon'),
      'actual HE shells deliberately strike neutral cover before armour-piercing shots');
    assert(s.scenery.reduce((n, p) => n + p.parts.reduce((sum, part) => sum + part.hp, 0), 0) < propHealth,
      'the firing lane opens through real damage to village cover');
    assert(actors.some(u => u.hp < CARDS.tank.hp), 'neither opponent is muted: actual main rounds damage a tank');
    assert.equal(embedded, false, 'no shell begins inside an opaque wall or tree trunk');
    assert(nearest >= 260, `blocked guns find a local lane instead of ramming the opponent: ${nearest}`);
  });

  test(`side ${side}: a mobile MLRS backs out of the enemy HQ dead zone and hits the base`, () => {
    const s = battlefield(198);
    const base = side ? 70 : W - 70;
    spawnUnit(s, side, 'mlrs', base - toward(side) * 230);
    tick(s, DT);
    const launcher = s.units[0], start = launcher.x, initialHP = s.players[1 - side].hp;
    assert.equal(launcher.ammo, 12);
    const launches = new Map();
    let nearestLaunch = Infinity;
    refreshVision(s);
    run(s, 24, () => {
      for (const p of s.projectiles) if (p.sourceUid === launcher.uid && !launches.has(p.uid)) {
        launches.set(p.uid, p.base);
        nearestLaunch = Math.min(nearestLaunch, Math.abs(p.startX - base));
      }
    });
    assert((start - launcher.x) * toward(side) > 100, 'a known fixed HQ also counts as a minimum-range obstruction');
    assert(launcher.shots >= 2, 'the complete normal reload cycle continues after the fallback');
    assert([...launches.values()].every(target => target === 1 - side));
    assert(nearestLaunch >= CARDS.mlrs.minRange - 35, 'rockets launch outside the actual dead zone');
    assert(s.players[1 - side].hp < initialHP, 'real rockets reach and damage the enemy headquarters');
  });
}
