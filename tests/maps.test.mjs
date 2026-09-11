import { registerHooks } from 'node:module';
registerHooks({
  resolve(specifier, context, nextResolve) {
    try {
      return nextResolve(specifier, context);
    } catch (error) {
      if (specifier.startsWith('.') && !/\.[cm]?[jt]s$/.test(specifier))
        return nextResolve(specifier + '.ts', context);
      throw error;
    }
  },
});
const assert = (await import('node:assert/strict')).default;
const {
  MAP_IDS,
  MAPS,
  DEFAULT_MAP,
  createMapLayout,
  mapTerrain,
  isMapId,
  mapDefinition,
} = await import('../game/maps.ts');
const { createScenery, observationPenalty, clearSight } =
  await import('../game/world.ts');
const E = await import('../game/engine.ts');
const results = [];
const metrics = [];
function check(name, fn) {
  fn();
  results.push(name);
  console.log('✓ ' + name);
}
check('原灰线村镇保留逐像素地形、成对树木及旧物件标识', () => {
  const map = createMapLayout();
  assert.equal(map.id, DEFAULT_MAP);
  assert.deepEqual(
    map.terrain,
    Array.from({ length: E.W }, (_, x) =>
      x < 125 || x > E.W - 125
        ? 374
        : 374 + Math.round(Math.sin(x * 0.004) * 13 + Math.sin(x * 0.013) * 5),
    ),
  );
  const scenery = createScenery(map.terrain),
    withSites = createScenery(map.terrain, map.scenerySites);
  assert.deepEqual(scenery, withSites);
  assert.equal(scenery.length, 21);
  assert.equal(scenery.filter((p) => p.kind === 'house').length, 5);
  for (const [id, x, seed] of [
    [0, 620, 119],
    [2, 820, 166],
    [3, 892, 173],
    [6, 1250, 260],
  ]) {
    const p = scenery.find((p) => p.id === id);
    assert.equal(p.x, x);
    assert.equal(p.seed, seed);
  }
});
check('四图布局可重复、互不共享可变地形，地图标识正确降级', () => {
  assert.equal(MAP_IDS.length, 4);
  assert.equal(isMapId('toString'), false);
  assert.equal(mapDefinition('unknown').id, 'greyline');
  const shapes = new Set();
  for (const id of MAP_IDS) {
    const a = createMapLayout(id),
      b = createMapLayout(id);
    assert.deepEqual(a, b);
    assert.equal(a.seed, MAPS[id].layoutSeed);
    a.terrain[1000] = 900;
    assert.notEqual(b.terrain[1000], 900);
    assert.equal(b.terrain.length, E.W);
    assert(b.terrain.every((y) => Number.isFinite(y) && y >= 310 && y <= 430));
    shapes.add(b.terrain.join(','));
    const scenery = createScenery(b.terrain, b.scenerySites);
    assert.equal(new Set(scenery.map((p) => p.id)).size, scenery.length);
    assert(
      scenery.every(
        (p) =>
          p.y === b.terrain[p.x] &&
          p.parts.every((part) => part.hp > 0 && part.w > 0 && part.h > 0),
      ),
    );
    assert(b.wallSites.every((w) => w.height < 40));
  }
  assert.equal(shapes.size, 4);
});
check('新图两侧出生地与树屋布局镜像，山坡不会形成攀爬级台阶', () => {
  for (const id of MAP_IDS.filter((id) => id !== 'greyline')) {
    const map = createMapLayout(id),
      t = map.terrain;
    assert(t.slice(0, 221).every((y) => y === 374));
    assert(t.slice(-221).every((y) => y === 374));
    assert(t.every((y, x) => y === t[t.length - 1 - x]));
    let adjacent = 0,
      across36 = 0;
    for (let x = 1; x < t.length; x++) {
      adjacent = Math.max(adjacent, Math.abs(t[x] - t[x - 1]));
      if (x >= 36) across36 = Math.max(across36, Math.abs(t[x] - t[x - 36]));
    }
    assert(adjacent <= 1);
    assert(across36 <= 9, `${id} 36px vertical span ${across36}`);
    for (const site of map.scenerySites)
      assert(
        map.scenerySites.some(
          (p) =>
            p.x === E.W - 1 - site.x &&
            p.kind === site.kind &&
            p.seed === site.seed,
        ),
      );
    metrics.push({
      id,
      min: Math.min(...t),
      max: Math.max(...t),
      adjacentStep: adjacent,
      heightAcross36: across36,
      trees: map.scenerySites.filter((p) => p.kind === 'tree').length,
      houses: map.scenerySites.filter((p) => p.kind === 'house').length,
    });
  }
});
check('雨林增加实体植被但仍允许中距离观察，遮挡惩罚保持原上限', () => {
  const jungle = createMapLayout('jungle'),
    desert = createMapLayout('desert'),
    village = createMapLayout();
  const trees = (m) => m.scenerySites.filter((p) => p.kind === 'tree').length;
  assert(trees(jungle) > trees(village));
  assert(trees(desert) < trees(village));
  const s = E.createGame(1624);
  E.startGame(s);
  s.aiIn = 1e6;
  s.terrain = [...jungle.terrain];
  s.original = [...jungle.terrain];
  s.scenery = createScenery(s.terrain, jungle.scenerySites);
  s.walls = [];
  E.spawnUnit(s, 0, 'infantry', 980);
  E.spawnUnit(s, 1, 'infantry', 1300);
  E.refreshVision(s);
  assert(
    s.visible[0].some((uid) =>
      s.units.some((u) => u.uid === uid && u.side === 1),
    ),
    'dense vegetation must not force melee detection',
  );
  const penalty = observationPenalty(s, 650, 334, 1800, 334, 800);
  assert(penalty > 0 && penalty <= 200);
  assert(
    clearSight(s, 980, E.ground(s, 980) - 60, 1300, E.ground(s, 1300) - 60),
    'trees lower range without a hard vision wall',
  );
});
check('步兵双向经过整段山地起伏保持地面移动，不反复攀爬或跳跃', () => {
  const layout = createMapLayout('mountains');
  for (const side of [0, 1]) {
    const s = E.createGame(1642);
    E.startGame(s);
    s.aiIn = 1e6;
    s.units = [];
    s.scenery = [];
    s.walls = [];
    s.terrain = [...layout.terrain];
    s.original = [...layout.terrain];
    E.spawnUnit(s, side, 'infantry', side ? 3200 : 640);
    const u = s.units[0];
    s.units = [u];
    u.pace = 1;
    u.cooldown = 10000;
    u.decisionIn = 10000;
    const x = u.x;
    let traversals = 0;
    for (let n = 0; n < 1500; n++) {
      E.tick(s, 1 / 60);
      if (u.motion === 'bank' || u.motion === 'jump' || u.climbing > 0)
        traversals++;
    }
    assert((u.x - x) * (side ? -1 : 1) > 1200);
    assert.equal(traversals, 0);
    assert(Math.abs(u.y - E.ground(s, u.x)) < 1);
  }
});
console.log(JSON.stringify({ passed: results.length, metrics }, null, 2));
