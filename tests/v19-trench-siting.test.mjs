import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createGame, startGame, spawnUnit, tick } from '../game/engine.ts';
import { setSquadOrder } from '../game/squad-orders.ts';
import { createScenery, obstacleBoxes, pointVisible } from '../game/world.ts';

const DT = 1 / 60;
function arena(side) {
  const s = createGame(19);
  startGame(s);
  s.aiIn = 1e9;
  s.units = [];
  s.terrain.fill(374);
  s.original.fill(374);
  s.knownTerrain = [s.terrain.slice(), s.terrain.slice()];
  s.scenery = [];
  s.walls = [];
  s.wrecks = [];
  s.knownScenery = [{}, {}];
  s.knownWalls = [{}, {}];
  s.time = 5;
  s.players.forEach((p) => (p.order = 'hold'));
  spawnUnit(s, side, 'infantry', 1800);
  return s;
}
const centroid = (s) => s.units.reduce((n, u) => n + u.x, 0) / s.units.length;
const hold = (s, side) => setSquadOrder(s, side, s.units[0].squad, 'hold');
function wreck(s, side, cardId, x, extra = {}) {
  const w = {
    id: ++s.uid,
    cardId,
    side,
    x,
    y: 374,
    angle: 0,
    age: 20,
    falling: false,
    vx: 0,
    vy: 0,
    facing: side ? -1 : 1,
    ...extra,
  };
  s.wrecks.push(w);
  return w;
}
function occupied(s) {
  const groups = new Map();
  for (const b of obstacleBoxes(s)) {
    if (b.foliage && !b.rubble) continue;
    const key = b.wreck ? `wreck:${b.wreck.id}` : `prop:${b.prop.id}`;
    const old = groups.get(key);
    groups.set(key, {
      left: Math.min(old?.left ?? Infinity, b.x),
      right: Math.max(old?.right ?? -Infinity, b.x + b.w),
    });
  }
  return [...groups.values()];
}
const clear = (p, b) =>
  p.x + p.radius + 6 <= b.left || p.x - p.radius - 6 >= b.right;
function run(s, seconds, sample = () => {}, until = () => false) {
  for (let i = 0; i < seconds / DT && !until(); i++) {
    tick(s, DT);
    sample();
  }
}
function walkingMonitor(s) {
  const previous = new Map(s.units.map((u) => [u.uid, u.x]));
  return () => {
    for (const u of s.units) {
      assert.ok(
        Math.abs(u.x - previous.get(u.uid)) < 3,
        'construction never teleports members',
      );
      previous.set(u.uid, u.x);
      assert.equal(
        u.climbing,
        0,
        'wrecks are depth-passable, not climbing walls',
      );
    }
  };
}

for (const side of [0, 1]) {
  for (const kind of ['tank', 'helicopter', 'house', 'fallen-tree']) {
    test(`side ${side}: ${kind} occupies the entire footprint; squad walks to the nearest clear trench`, () => {
      const s = arena(side),
        origin = centroid(s),
        before = s.units.map((u) => u.x);
      if (kind === 'tank' || kind === 'helicopter') {
        wreck(s, side, kind, origin, { angle: side ? -0.1 : 0.1 });
      } else {
        const prop = createScenery(s.terrain, [
          {
            x: origin,
            kind: kind === 'house' ? 'house' : 'tree',
            seed: 4,
            building: 0,
          },
        ])[0];
        for (const part of prop.parts) {
          part.hp = 0;
          part.brokenAt = 0;
        }
        s.scenery = [prop];
        s.knownScenery[side][prop.id] = structuredClone(prop);
      }
      const blocks = occupied(s);
      assert.ok(hold(s, side).ok);
      const p = s.entrenchments[0];
      assert.deepEqual(
        s.units.map((u) => u.x),
        before,
      );
      assert.equal(
        p.radius * 2,
        102.5,
        'site selection preserves the compact shared geometry',
      );
      assert.ok(
        blocks.every((b) => clear(p, b)),
        'both banks, not only the chamber, clear debris',
      );
      assert.ok(Math.abs(p.x - origin) <= 240);
      // Independent fine-grained search catches choosing a legal but unnecessarily distant site.
      let nearest = Infinity;
      for (let x = origin - 240; x <= origin + 240; x += 0.1)
        if (blocks.every((b) => clear({ ...p, x }, b)))
          nearest = Math.min(nearest, Math.abs(x - origin));
      assert.ok(Math.abs(p.x - origin) <= nearest + 0.11);
      run(s, 18, walkingMonitor(s), () => p.built);
      assert.ok(
        p.built,
        'real movement and actual digging complete the selected trench',
      );
      assert.equal(s.entrenchments.length, 1);
      assert.equal(s.mines.length, 2);
      for (const b of blocks)
        for (let x = Math.ceil(b.left); x <= b.right; x++)
          assert.equal(
            s.terrain[x],
            374,
            'no earth is excavated underneath debris',
          );
    });
  }

  test(`side ${side}: unknown enemy wreck does not change construction choice`, () => {
    const s = arena(side);
    for (const u of s.units) u.x = 1800;
    const dir = side ? -1 : 1;
    wreck(s, side, 'helicopter', 1800 - dir * 35);
    const control = structuredClone(s);
    assert.ok(hold(control, side).ok);
    const desired = control.entrenchments[0].x;
    const hiddenX = 1800 + Math.sign(desired - 1800) * 245;
    s.smokes.push({ x: (1800 + hiddenX) / 2, life: 20, side: 1 - side });
    wreck(s, 1 - side, 'tank', hiddenX);
    assert.equal(pointVisible(s, side, hiddenX, 362), false);
    assert.ok(hold(s, side).ok);
    assert.equal(s.entrenchments[0].x, desired);
  });

  test(`side ${side}: no space within 240px gives an own-side warning and watch, never a fake completed pit`, () => {
    const s = arena(side),
      origin = centroid(s),
      soil = s.terrain.slice();
    for (let i = -4; i <= 4; i++) wreck(s, side, 'tank', origin + i * 80);
    for (let attempt = 0; attempt < 3; attempt++) {
      const result = hold(s, side);
      assert.equal(result.ok, false);
      assert.match(result.message, /没有可施工空地/);
      assert.ok(s.units.every((u) => u.squadOrder === 'watch' && !u.digging));
      assert.deepEqual(s.notices[0].audience, [side]);
      run(s, 0.1);
    }
    assert.equal(s.entrenchments.length, 0);
    assert.equal(s.mines.length, 0);
    assert.deepEqual(s.terrain, soil);
  });

  test(`side ${side}: a newly grounded wreck relocates an untouched plan without excavation or teleporting`, () => {
    const s = arena(side);
    assert.ok(hold(s, side).ok);
    const p = s.entrenchments[0],
      originalX = p.x,
      soil = s.terrain.slice();
    const aircraft = wreck(s, side, 'helicopter', p.x, {
      falling: true,
      y: 100,
    });
    // An airborne hull has no construction footprint; the same plan remains valid.
    setSquadOrder(s, side, s.units[0].squad, 'watch');
    assert.ok(hold(s, side).ok);
    assert.equal(p.x, originalX);
    Object.assign(aircraft, { falling: false, y: 374 });
    run(s, 5, walkingMonitor(s), () => p.x !== originalX);
    assert.notEqual(p.x, originalX);
    assert.equal(s.entrenchments[0], p);
    assert.equal(s.entrenchments.length, 1);
    assert.equal(p.progress, 0);
    assert.deepEqual(s.terrain, soil);
    assert.match(s.notices[0].text, /转移到附近空地/);
    run(s, 18, walkingMonitor(s), () => p.built);
    assert.ok(p.built);
    assert.equal(s.mines.length, 2);
  });

  test(`side ${side}: debris pauses partial work; cancellation and resumption retain one pit and two mines`, () => {
    const s = arena(side);
    assert.ok(hold(s, side).ok);
    const p = s.entrenchments[0];
    run(
      s,
      8,
      () => {},
      () => p.progress >= 0.2,
    );
    assert.ok(p.progress >= 0.2 && !p.built);
    const progress = p.progress,
      soil = s.terrain.slice(),
      oldX = p.x;
    const debris = wreck(s, side, 'tank', p.x);
    run(s, 1);
    assert.equal(p.progress, progress);
    assert.deepEqual(s.terrain, soil);
    assert.ok(s.units.every((u) => u.squadOrder === 'watch' && !u.digging));
    assert.match(s.notices[0].text, /已暂停并警戒/);
    assert.equal(hold(s, side).ok, false);
    assert.equal(p.built, false);
    assert.equal(s.mines.length, 0);
    // Removal is a controlled test fixture; resume must never reset or duplicate the old work.
    s.wrecks = s.wrecks.filter((w) => w !== debris);
    assert.ok(hold(s, side).ok);
    assert.equal(p.x, oldX);
    assert.equal(p.progress, progress);
    run(s, 15, walkingMonitor(s), () => p.built);
    assert.ok(p.built);
    for (let attempt = 0; attempt < 3; attempt++) {
      assert.ok(hold(s, side).ok);
      assert.ok(setSquadOrder(s, side, s.units[0].squad, 'watch').ok);
      assert.ok(hold(s, side).ok);
    }
    run(s, 1);
    assert.equal(s.entrenchments[0], p);
    assert.equal(s.entrenchments.length, 1);
    assert.equal(s.mines.length, 2);
  });

  test(`side ${side}: repeated and cancelled travel keeps the original selected site`, () => {
    const s = arena(side),
      origin = centroid(s);
    wreck(s, side, 'tank', origin);
    assert.ok(hold(s, side).ok);
    const p = s.entrenchments[0],
      site = p.x,
      radius = p.radius;
    run(s, 0.25, walkingMonitor(s));
    assert.equal(p.progress, 0);
    assert.ok(hold(s, side).ok);
    assert.ok(setSquadOrder(s, side, s.units[0].squad, 'watch').ok);
    assert.ok(hold(s, side).ok);
    assert.equal(p.x, site);
    assert.equal(p.radius, radius);
    assert.equal(s.entrenchments.length, 1);
    run(s, 18, walkingMonitor(s), () => p.built);
    assert.ok(p.built);
    assert.equal(s.mines.length, 2);
  });
}
