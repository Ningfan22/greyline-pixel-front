import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  towMissileCarrierFrame, towMissileCarrierWreckFrame, TOW_SPRITE_SIZE, TOW_WRECK_SIZE,
} from '../game/tow-vehicle-art.ts';

const { createCanvas, loadImage } = createRequire(import.meta.url)('@napi-rs/canvas');
const asset = (name) => fileURLToPath(new URL(`../public/art/v196-tow/${name}`, import.meta.url));
globalThis.document = { createElement: () => createCanvas(1, 1) };

test('dedicated TOW assets are distinct complete paintings and the served card preserves its generated original', async () => {
  const names = ['tow-sprite.png', 'tow-wreck.png', 'tow-card-original.png'];
  const hashes = names.map((name) => createHash('sha256').update(readFileSync(asset(name))).digest('hex'));
  assert.equal(new Set(hashes).size, 3);
  const [raw, served] = await Promise.all([
    loadImage(asset('tow-card-original.png')), loadImage(asset('tow-card.webp')),
  ]);
  assert.equal(raw.width, raw.height);
  assert(raw.width >= 1024);
  assert.equal(served.width, raw.width);
  assert.equal(served.height, raw.height);
  const pixels = (image) => {
    const canvas = createCanvas(image.width, image.height);
    canvas.getContext('2d').drawImage(image, 0, 0);
    return canvas.getContext('2d').getImageData(0, 0, image.width, image.height).data;
  };
  assert(Buffer.from(pixels(served)).equals(Buffer.from(pixels(raw))));
});

// v196 source paintings stay archived; production geometry and selectors are
// checked against their replacement paintings in v197-vehicle-art.test.mjs.
for (const [kind, build, size] of [
  ['sprite', towMissileCarrierFrame, TOW_SPRITE_SIZE],
  ['wreck', towMissileCarrierWreckFrame, TOW_WRECK_SIZE],
]) test(`archived v196 ${kind} keeps its authored transparent border and original baseline`, async () => {
  const frame = build(await loadImage(asset(`tow-${kind}.webp`)));
  assert.deepEqual([frame.width, frame.height], [...size]);
  const data = frame.getContext('2d').getImageData(0, 0, frame.width, frame.height).data;
  assert.equal(data[3], 0);
  assert.equal(data[(frame.width - 1) * 4 + 3], 0);
  let ground = -1;
  for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++)
    if (data[(y * frame.width + x) * 4 + 3] > 200) ground = y;
  assert(ground >= frame.height - 2);
});
