import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import {
  drawTerrainLayer,
  TERRAIN_TEXTURE_WIDTH,
  TERRAIN_TEXTURE_HEIGHT,
} from '../game/terrain-render.ts';
import { createGame } from '../game/engine.ts';
import { mapDefinition } from '../game/maps.ts';
const require = createRequire(import.meta.url),
  { createCanvas, loadImage } = require('@napi-rs/canvas'),
  ts = require('typescript');
let trace = null;
globalThis.document = {
  createElement: () => {
    const c = createCanvas(1, 1);
    trace?.created.push(c);
    return c;
  },
};
const contextPrototype = Object.getPrototypeOf(
  createCanvas(1, 1).getContext('2d'),
);
for (const method of ['clearRect', 'drawImage']) {
  const original = contextPrototype[method];
  contextPrototype[method] = function (...args) {
    if (trace) trace[method].push({ canvas: this.canvas, args });
    return original.apply(this, args);
  };
}
function traced(fn) {
  const result = { created: [], clearRect: [], drawImage: [] };
  trace = result;
  try {
    fn();
    return result;
  } finally {
    trace = null;
  }
}
// Compare with the exact shipped implementation, not a second rewritten oracle.
const before = execFileSync('git', ['show', 'fbbbc4f:game/terrain-render.ts'], {
  cwd: new URL('..', import.meta.url),
  encoding: 'utf8',
});
const compiled = ts.transpileModule(before, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const { drawTerrainLayer: reference } = await import(
  `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
);
const image = await loadImage(
  new URL('../public/art/terrain-texture.png', import.meta.url).pathname,
);
function texturePair(map, scaled = false) {
  const w = scaled ? TERRAIN_TEXTURE_WIDTH : image.width,
    h = scaled ? TERRAIN_TEXTURE_HEIGHT : image.height;
  const p = mapDefinition(map).palette,
    front = createCanvas(w, h),
    c = front.getContext('2d');
  c.imageSmoothingEnabled = false;
  c.filter = map === 'greyline' ? 'none' : p.terrainFilter;
  c.drawImage(image, 0, 0, w, h);
  c.filter = 'none';
  if (map !== 'greyline') {
    c.globalCompositeOperation = 'color';
    c.globalAlpha = p.tintStrength;
    c.fillStyle = p.terrainTint;
    c.fillRect(0, 0, front.width, front.height);
  }
  const back = createCanvas(w, h),
    b = back.getContext('2d');
  b.filter = 'brightness(0.62) saturate(0.72)';
  b.drawImage(front, 0, 0);
  return { front, back, p };
}
function paint(fn, s, pair, left = 480, right = 1776) {
  const c = createCanvas(3840, 480),
    ctx = c.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  fn(ctx, s, pair.front, pair.back, pair.p, left, right);
  return ctx.getImageData(0, 0, c.width, c.height).data;
}
test('terrain geometry and texture remain matched to the shipped renderer before and after a crater', () => {
  for (const map of ['greyline', 'jungle', 'mountains', 'desert']) {
    const s = createGame(146, undefined, undefined, map, { mapSeed: 146 }),
      pair = texturePair(map);
    s.knownTerrain[0] = s.original.slice();
    for (const crater of [false, true]) {
      if (crater)
        for (let x = 940; x < 1040; x++)
          s.knownTerrain[0][x] += Math.sin(((x - 940) / 100) * Math.PI) * 18;
      const a = paint(reference, s, pair),
        b = paint(drawTerrainLayer, s, pair);
      let colorError = 0,
        opaque = 0,
        alphaErrors = 0;
      for (let i = 0; i < a.length; i += 4) {
        if (a[i + 3] !== b[i + 3]) alphaErrors++;
        if (a[i + 3]) {
          opaque++;
          colorError +=
            Math.abs(a[i] - b[i]) +
            Math.abs(a[i + 1] - b[i + 1]) +
            Math.abs(a[i + 2] - b[i + 2]);
        }
      }
      assert.equal(alphaErrors, 0, `${map}/${crater} geometry changed`);
      const mean = colorError / Math.max(1, opaque * 3);
      console.log(`terrain ${map}/${crater}: mean channel delta ${mean}`);
      assert(mean < 1, `${map}/${crater}: painted texture differs ${mean}`);
    }
  }
});

test('pre-scaled palette textures and camera chunk seams preserve the painted ground', () => {
  for (const map of ['greyline', 'jungle', 'mountains', 'desert']) {
    const s = createGame(146, undefined, undefined, map, { mapSeed: 146 }),
      old = texturePair(map),
      next = texturePair(map, true);
    s.knownTerrain[0] = s.original.map(
      (y, x) => y + Math.max(0, Math.sin(x * 0.018)) * 18,
    );
    for (const [left, right] of [
      [0, 96],
      [185, 385],
      [999, 1287],
      [3651, 3840],
    ]) {
      const a = paint(reference, s, old, left, right),
        b = paint(drawTerrainLayer, s, next, left, right);
      let delta = 0,
        pixels = 0;
      for (let i = 0; i < a.length; i += 4) {
        assert.equal(
          b[i + 3],
          a[i + 3],
          `${map} alpha/seam at ${i / 4}, camera ${left}`,
        );
        if (a[i + 3]) {
          pixels++;
          delta +=
            Math.abs(a[i] - b[i]) +
            Math.abs(a[i + 1] - b[i + 1]) +
            Math.abs(a[i + 2] - b[i + 2]);
        }
      }
      assert(
        delta / Math.max(1, pixels * 3) < 1,
        `${map} terrain color changed`,
      );
    }
  }
});

test('warm terrain does not repaint; remembered boundary craters repaint only both adjoining tiles', () => {
  const s = createGame(146),
    pair = texturePair('greyline', true);
  s.knownTerrain[0] = s.original.slice();
  const cold = traced(() => paint(drawTerrainLayer, s, pair, 0, 576));
  assert.equal(cold.created.length, 3);
  assert(cold.created.every((c) => c.width === 192 && c.height === 480));
  const warm = traced(() => paint(drawTerrainLayer, s, pair, 0, 576));
  assert.equal(warm.clearRect.length, 0);
  assert.equal(warm.created.length, 0);
  s.terrain[192] += 20;
  s.knownTerrain[1][192] += 20;
  const unseen = traced(() => paint(drawTerrainLayer, s, pair, 0, 576));
  assert.equal(
    unseen.clearRect.length,
    0,
    'hidden crater must not reveal itself',
  );
  s.knownTerrain[0][192] = s.terrain[192];
  const visible = traced(() => paint(drawTerrainLayer, s, pair, 0, 576));
  assert.deepEqual(
    visible.clearRect.map((c) => c.args[0]),
    [0, 192],
  );
  assert.equal(visible.created.length, 0);
  assert(
    visible.drawImage.every(
      (c) =>
        c.args[0].width <= TERRAIN_TEXTURE_WIDTH && c.args[0].height <= 480,
    ),
    'a warm crater must never resample the original multi-megapixel texture or copy a world-sized canvas',
  );
});

test('camera panning allocates only newly visited tiles and reuses previously painted tiles', () => {
  const s = createGame(146),
    pair = texturePair('jungle', true);
  paint(drawTerrainLayer, s, pair, 0, 576);
  const pan = traced(() => paint(drawTerrainLayer, s, pair, 480, 768));
  assert.equal(pan.created.length, 1);
  assert.deepEqual(
    pan.clearRect.map((c) => c.args[0]),
    [576],
  );
  const back = traced(() => paint(drawTerrainLayer, s, pair, 0, 576));
  assert.equal(back.created.length, 0);
  assert.equal(back.clearRect.length, 0);
});

test('replacing rear earth, front texture or palette invalidates the tile cache', () => {
  const s = createGame(146),
    pair = texturePair('greyline', true);
  s.knownTerrain[0] = s.original.map((y) => y + 24);
  const first = paint(drawTerrainLayer, s, pair, 0, 384);
  const red = createCanvas(TERRAIN_TEXTURE_WIDTH, TERRAIN_TEXTURE_HEIGHT),
    redCtx = red.getContext('2d');
  redCtx.fillStyle = '#ff0000';
  redCtx.fillRect(0, 0, red.width, red.height);
  const rear = { ...pair, back: red };
  let after;
  assert.equal(
    traced(() => {
      after = paint(drawTerrainLayer, s, rear, 0, 384);
    }).clearRect.length,
    2,
  );
  assert.notDeepEqual(
    after,
    first,
    'replacement rear earth must appear immediately',
  );
  const front = { ...rear, front: red };
  assert.equal(
    traced(() => paint(drawTerrainLayer, s, front, 0, 384)).clearRect.length,
    2,
  );
  const palette = { ...front, p: { ...front.p, disturbed: '#00ffff' } };
  assert.equal(
    traced(() => paint(drawTerrainLayer, s, palette, 0, 384)).clearRect.length,
    2,
  );
});

test('terrain rendering is read-only and large source images are scaled once per texture', () => {
  const s = createGame(146),
    pair = texturePair('desert');
  const saved = {
    terrain: s.terrain.slice(),
    original: s.original.slice(),
    known: s.knownTerrain.map((a) => a.slice()),
  };
  const cold = traced(() => paint(drawTerrainLayer, s, pair, 0, 384));
  assert.equal(
    cold.created.filter(
      (c) =>
        c.width === TERRAIN_TEXTURE_WIDTH &&
        c.height === TERRAIN_TEXTURE_HEIGHT,
    ).length,
    2,
  );
  assert.equal(
    cold.drawImage.filter((c) => c.args[0].width > TERRAIN_TEXTURE_WIDTH)
      .length,
    2,
  );
  const next = traced(() => paint(drawTerrainLayer, s, pair, 384, 768));
  assert.equal(
    next.drawImage.filter((c) => c.args[0].width > TERRAIN_TEXTURE_WIDTH)
      .length,
    0,
  );
  assert.deepEqual(s.terrain, saved.terrain);
  assert.deepEqual(s.original, saved.original);
  assert.deepEqual(s.knownTerrain, saved.known);
});
