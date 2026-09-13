import assert from 'node:assert/strict';
import fs from 'node:fs';
import { performance } from 'node:perf_hooks';
import {
  createGame,
  startGame,
  tick,
  ground,
  crater,
  explode,
  terrainIntercept,
  W,
} from '../game/engine.ts';
import { heightfieldIntercept } from '../game/terrain-ray.ts';
import {
  obstacleBoxes,
  nearbyObstacles,
  sceneryIntercept,
  segmentBox,
  createScenery,
} from '../game/world.ts';

const out = 'output/v22-performance-qa';
fs.mkdirSync(out, { recursive: true });
const results = [],
  failures = [];
let rays = 0;
function check(name, fn) {
  if (
    process.env.TEST_FILTER &&
    !new RegExp(process.env.TEST_FILTER).test(name)
  )
    return;
  try {
    const details = fn();
    results.push({ name, ...details });
    console.log('PASS', name, JSON.stringify(details));
  } catch (e) {
    failures.push({ name, error: e.stack });
    console.error('FAIL', name, e.stack);
  }
}
function rng(seed) {
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

// Pre-index sceneryIntercept: full ordered traversal, retaining origin and foliage rules.
function oldScenery(
  s,
  sx,
  sy,
  tx,
  ty,
  vision = false,
  includeOrigin = false,
  ignoreProps = false,
) {
  let hit = null;
  for (const box of obstacleBoxes(s, ignoreProps)) {
    if (!vision && box.foliage) continue;
    if (
      !includeOrigin &&
      sx >= box.x &&
      sx <= box.x + box.w &&
      sy >= box.y &&
      sy <= box.y + box.h
    )
      continue;
    const t = segmentBox(sx, sy, tx, ty, box);
    if (t !== null && (!hit || t < hit.t))
      hit = { box, x: sx + (tx - sx) * t, y: sy + (ty - sy) * t, t };
  }
  return hit;
}
// Pre-block-cache terrainIntercept: exactly the original 2px sample arithmetic/order.
function oldTerrain(
  s,
  sx,
  sy,
  tx,
  ty,
  ignoreSoftCover = false,
  ignoreAllCover = false,
) {
  const prop = ignoreAllCover
    ? null
    : oldScenery(s, sx, sy, tx, ty, false, false, ignoreSoftCover);
  const steps = Math.max(1, Math.ceil(Math.abs(tx - sx) / 2));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps,
      x = sx + (tx - sx) * t,
      y = sy + (ty - sy) * t;
    if (y >= ground(s, x) - 1)
      return prop && prop.t < t
        ? { x: prop.x, y: prop.y }
        : { x, y: ground(s, x) - 1 };
  }
  return prop ? { x: prop.x, y: prop.y } : null;
}
function oldHeight(s, sx, sy, tx, ty, limit = 1) {
  const steps = Math.max(1, Math.ceil(Math.abs(tx - sx) / 2));
  for (let i = 1; i <= Math.min(steps, Math.ceil(steps * limit)); i++) {
    const t = i / steps,
      x = sx + (tx - sx) * t,
      y = sy + (ty - sy) * t;
    if (y >= ground(s, x) - 1) return { x, y: ground(s, x) - 1, t };
  }
  return null;
}
function match(s, ray, index = 0) {
  rays++;
  const context = `ray${rays} ${JSON.stringify(ray)} flags${index}`;
  const vision = !!(index & 1),
    origin = !!(index & 2),
    props = !!(index & 4);
  const expected = oldScenery(s, ...ray, vision, origin, props),
    actual = sceneryIntercept(s, ...ray, vision, origin, props);
  assert.deepEqual(
    actual && { x: actual.x, y: actual.y, t: actual.t },
    expected && { x: expected.x, y: expected.y, t: expected.t },
    `scenery ${context}`,
  );
  if (expected)
    assert.ok(
      actual.box === expected.box,
      `nearest box must be the same reference: ${context}`,
    );
  assert.deepEqual(
    terrainIntercept(s, ...ray, !!(index & 1), !!(index & 2)),
    oldTerrain(s, ...ray, !!(index & 1), !!(index & 2)),
    `terrain ${context}`,
  );
  const limit = [1, 0.01, 0.25, 0.51, 0.99][index % 5];
  assert.deepEqual(
    heightfieldIntercept(s, ...ray, limit),
    oldHeight(s, ...ray, limit),
    `heightfield ${context}`,
  );
}
function wreck(s, x, id = 'tank', extra = {}) {
  return {
    id: ++s.uid,
    cardId: id,
    side: 0,
    x,
    y: ground(s, x),
    angle: 0,
    age: 8,
    falling: false,
    vx: 0,
    vy: 0,
    ...extra,
  };
}
function arena(seed = 22049, map = 'greyline') {
  const s = createGame(seed, undefined, undefined, map, {
    difficulty: 'standard',
  });
  startGame(s);
  s.aiIn = 1e9;
  return s;
}
function randomRays(s, random, count) {
  const all = obstacleBoxes(s),
    result = [];
  for (let i = 0; i < count / 2; i++) {
    const box = all[Math.floor(random() * all.length)];
    const x = -80 + random() * (W + 160),
      y = ground(s, x) - 180 + random() * 240;
    let ray;
    if (i % 5 === 0)
      ray = [x, y, x, -20 + random() * 560]; // vertical, including zero horizontal steps
    else if (i % 5 === 1)
      ray = [x, y, x + (random() - 0.5) * 8, y + (random() - 0.5) * 80];
    else if (i % 5 === 2 && box)
      ray = [
        box.x - 3,
        box.y + box.h * random(),
        box.x + box.w + 3,
        box.y + box.h * random(),
      ];
    else if (i % 5 === 3)
      ray = [
        -80 + random() * 120,
        20 + random() * 490,
        W - 40 + random() * 120,
        20 + random() * 490,
      ];
    else
      ray = [
        x,
        y,
        random() * W,
        ground(s, random() * W) - 160 + random() * 220,
      ];
    result.push(ray, [ray[2], ray[3], ray[0], ray[1]]);
  }
  return result;
}

for (const [map, n] of ['greyline', 'jungle', 'mountains', 'desert'].map(
  (m, i) => [m, i],
))
  check(
    `${map}: 640 fixed random rays match both legacy algorithms with mixed scenery and 32 wrecks`,
    () => {
      const s = arena(22049 + n, map),
        random = rng(70831 + n);
      for (let i = 0; i < 32; i++)
        s.wrecks.push(
          wreck(
            s,
            140 + random() * (W - 280),
            ['tank', 'ifv', 'helicopter', 'bomber'][i % 4],
            {
              side: i % 2,
              angle: (random() - 0.5) * 0.7,
              falling: i % 11 === 0,
            },
          ),
        );
      // Exercise intact, damaged, partial and collapsed buildings, plus fallen tree shapes.
      for (const [i, p] of s.scenery.entries()) {
        if (p.kind === 'house') {
          if (i % 4 === 1) p.parts.forEach((part) => (part.hp *= 0.7));
          if (i % 4 === 2) p.parts[0].hp = 0;
          if (i % 4 === 3)
            p.parts.forEach((part) => {
              part.hp = 0;
              part.brokenAt = 0;
            });
        } else if (i % 5 === 0)
          p.parts.forEach((part) => {
            part.hp = 0;
            part.brokenAt = 0;
          });
      }
      s.time = 8;
      const list = randomRays(s, random, 640),
        start = performance.now();
      list.forEach((ray, i) => match(s, ray, i));
      const all = obstacleBoxes(s);
      for (let i = 0; i < 80; i++) {
        const left = random() * W,
          right = left + (random() - 0.5) * 400,
          ignoreProps = !!(i % 2);
        const boxes = obstacleBoxes(s, ignoreProps),
          near = nearbyObstacles(s, left, right, ignoreProps);
        assert.ok(
          near.every(
            (box, j) =>
              boxes.includes(box) &&
              (!j || boxes.indexOf(near[j - 1]) < boxes.indexOf(box)),
          ),
        );
        for (const box of boxes)
          if (
            box.x <= Math.max(left, right) &&
            box.x + box.w >= Math.min(left, right)
          )
            assert.ok(
              near.includes(box),
              'broad phase must retain every horizontally overlapping obstacle',
            );
      }
      return {
        rays: list.length,
        boxes: all.length,
        comparisonMilliseconds: +(performance.now() - start).toFixed(2),
      };
    },
  );
check(
  'boundary, tied obstacles, bin edges, vertical and subpixel rays preserve original box order and exact hit coordinates',
  () => {
    const s = arena();
    s.scenery = [];
    s.wrecks = [];
    s.walls = [];
    s.terrain.fill(374);
    s.original.fill(374);
    // Identical overlapping primitives force the original-order tie rule.
    s.scenery = [0, 1].map((id) => ({
      id,
      kind: 'tree',
      x: 128,
      y: 374,
      seed: 1,
      parts: [
        {
          id: 0,
          kind: 'trunk',
          x: 128,
          y: 220,
          w: 128,
          h: 154,
          hp: 100,
          maxHp: 100,
          brokenAt: -1,
        },
      ],
    }));
    s.wrecks.push(wreck(s, 512));
    const samples = [];
    for (const x of [
      -1,
      0,
      63.99999999999999,
      64,
      127.99999999999999,
      128,
      128.00000000000003,
      255.99999999999997,
      256,
      512,
      W - 1,
      W,
    ])
      for (const y of [219.99999999999997, 220, 373, 374]) {
        samples.push(
          [x, y, x, y + 80],
          [x, y, x + 0.00001, y + 80],
          [x, y, x + 2, y],
          [x + 2, y, x, y],
        );
      }
    samples.forEach((r, i) => match(s, r, i));
    const hit = sceneryIntercept(s, 100, 240, 260, 240, false, true);
    assert.ok(hit);
    assert.equal(hit.box.prop, s.scenery[0]);
    const short = heightfieldIntercept(s, 128, 373, 128, 374);
    assert.deepEqual(short, { x: 128, y: 373, t: 1 });
    return { rays: samples.length, tiedObject: hit.box.prop.id };
  },
);
check(
  'same-frame crater and ground blast keep cached terrain minima conservative, then refresh on the next real tick',
  () => {
    const s = arena();
    s.scenery = [];
    s.wrecks = [];
    s.walls = [];
    s.terrain.fill(374);
    s.original.fill(374);
    const random = rng(76511),
      samples = [];
    for (let i = 0; i < 100; i++) {
      const x = 880 + random() * 240;
      samples.push([
        x,
        350 + random() * 55,
        x + (random() - 0.5) * 140,
        350 + random() * 55,
      ]);
    }
    samples.forEach((r, i) => match(s, r, i)); // Warm both caches before changing the terrain array in place.
    const before = [...s.terrain];
    crater(s, 1000, 44, 18);
    explode(s, 1035, ground(s, 1035) - 3, 40, 0, 0);
    assert.ok(s.terrain.some((y, i) => y !== before[i]));
    samples.forEach((r, i) => match(s, r, i));
    tick(s, 1 / 60);
    samples.forEach((r, i) => match(s, r, i));
    const ray = [1000, ground(s, 1000) - 2, 1000, ground(s, 1000) + 4];
    match(s, ray, 2);
    assert.ok(heightfieldIntercept(s, ...ray));
    // Replacing the array at the same time must invalidate minima even when endpoints agree.
    s.terrain = s.terrain.map((y, i) => (i >= 1024 && i < 1088 ? 300 : y));
    match(s, [1024, 325, 1087, 325], 2);
    assert.ok(heightfieldIntercept(s, 1024, 325, 1087, 325));
    return {
      rays: 302,
      excavatedPixels: s.terrain.filter((y, i) => y !== before[i]).length,
    };
  },
);
check(
  'new wrecks invalidate range lists in the same frame; landed wrecks and destroyed wall hulls are rebuilt by the next tick',
  () => {
    const s = arena();
    s.scenery = [];
    s.wrecks = [];
    s.walls = [];
    s.terrain.fill(374);
    s.original.fill(374);
    assert.equal(sceneryIntercept(s, 800, 355, 1200, 355, false, true), null);
    const added = wreck(s, 1000);
    s.wrecks.push(added);
    let boxes = obstacleBoxes(s, true),
      box = boxes[0];
    let ray = [
      box.x - 2,
      box.y + box.h / 2,
      box.x + box.w + 2,
      box.y + box.h / 2,
    ];
    match(s, ray, 6);
    assert.ok(
      sceneryIntercept(s, ...ray, false, true, true)?.box.wreck === added,
    );
    const falling = wreck(s, 1500, 'helicopter', { falling: true });
    s.wrecks.push(falling);
    assert.equal(
      obstacleBoxes(s, true).some((b) => b.wreck === falling),
      false,
    );
    falling.falling = false;
    tick(s, 1 / 60);
    box = obstacleBoxes(s, true).find((b) => b.wreck === falling);
    assert.ok(box, 'newly landed wreck must be queryable within one tick');
    ray = [box.x - 2, box.y + box.h / 2, box.x + box.w + 2, box.y + box.h / 2];
    match(s, ray, 6);
    assert.ok(
      sceneryIntercept(s, ...ray, false, true, true)?.box.wreck === falling,
    );
    s.scenery = createScenery(s.terrain, [
      { id: 91, kind: 'house', x: 2200, seed: 77, building: 0 },
    ]);
    const house = s.scenery[0];
    boxes = obstacleBoxes(s);
    box = boxes.find((b) => b.prop === house && b.part?.kind === 'wall');
    assert.ok(box);
    ray = [box.x - 2, box.y + box.h / 2, box.x + box.w + 2, box.y + box.h / 2];
    match(s, ray, 2);
    assert.ok(sceneryIntercept(s, ...ray, false, true));
    explode(s, house.x, house.y - 35, 150, 10000, 0);
    tick(s, 1 / 60);
    const rubble = obstacleBoxes(s).find((b) => b.prop === house && b.rubble);
    assert.ok(rubble);
    assert.equal(
      obstacleBoxes(s).some((b) => b.prop === house && !b.rubble),
      false,
      'old standing wall hull must be gone after rebuild',
    );
    ray = [
      rubble.x - 2,
      rubble.y + rubble.h / 2,
      rubble.x + rubble.w + 2,
      rubble.y + rubble.h / 2,
    ];
    match(s, ray, 2);
    assert.ok(
      sceneryIntercept(s, ...ray, false, true)?.box.prop === house,
      'collapsed debris cannot disappear from the spatial index',
    );
    const fresh = structuredClone(s),
      a = sceneryIntercept(s, ...ray, false, true),
      b = oldScenery(fresh, ...ray, false, true);
    assert.deepEqual(
      a && { x: a.x, y: a.y, t: a.t },
      b && { x: b.x, y: b.y, t: b.t },
    );
    assert.equal(a.box.prop.id, b.box.prop.id);
    return {
      rays: 4,
      wrecks: s.wrecks.length,
      ruinBox: { x: rubble.x, y: rubble.y, w: rubble.w, h: rubble.h },
    };
  },
);
fs.writeFileSync(
  `${out}/checks.json`,
  JSON.stringify({ results, failures, rays }, null, 2),
);
console.log(
  `${results.length} passed, ${failures.length} failed; ${rays} rays; timings are informational only`,
);
if (failures.length) process.exitCode = 1;
