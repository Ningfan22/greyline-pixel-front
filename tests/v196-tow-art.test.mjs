import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  towMissileCarrierFrame, towMissileCarrierWreckFrame,
} from '../game/tow-vehicle-art.ts';
import { tankGeometry } from '../game/vehicle-geometry.ts';
import { wreckGeometry, wreckContact, wreckObstacles } from '../game/wreck-geometry.ts';
import { MOBILE_FRAMES } from '../game/mobile-vehicle-art.ts';
import { unitFrame, unitSize } from '../game/art.ts';

const { createCanvas, loadImage } = createRequire(import.meta.url)('@napi-rs/canvas');
const asset = (name) => fileURLToPath(new URL(`../public/art/v196-tow/${name}`, import.meta.url));
globalThis.document = { createElement: () => createCanvas(1, 1) };
function opacityNear(frame, x, y, radius = 2) {
  const context = frame.getContext('2d');
  const data = context.getImageData(Math.floor(x) - radius, Math.floor(y) - radius,
    radius * 2 + 1, radius * 2 + 1).data;
  return Math.max(...Array.from(data).filter((_, index) => index % 4 === 3));
}

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
  assert.deepEqual(pixels(served), pixels(raw));
});

test('TOW selection uses the dedicated tracked sprite at every phase and both weapon sockets touch the authored weapons', async () => {
  const frame = towMissileCarrierFrame(await loadImage(asset('tow-sprite.webp')));
  const geometry = tankGeometry('tow_ifv');
  assert.deepEqual([frame.width, frame.height], unitSize('tow_ifv'));
  assert.equal(MOBILE_FRAMES.tow_ifv, undefined);
  assert.equal(geometry.barrelBand, undefined);
  const art = { generatedSprites: {}, mobileVehicles: { tow_ifv: [frame] } };
  for (let phase = 0; phase < 12; phase++) assert.equal(unitFrame(art, 'tow_ifv', phase), frame);
  for (const [x, y] of [
    [geometry.muzzleX, geometry.muzzleY], [geometry.coaxX, geometry.coaxY],
  ]) {
    assert(opacityNear(frame, frame.width / 2 + x - geometry.spriteOffset,
      frame.height - y) > 220, 'weapon socket must sit on visible authored hardware');
  }
  assert(geometry.muzzleY > geometry.coaxY + 15);
  assert(geometry.hullHeight < geometry.muzzleY - 20);
  assert.equal(frame.getContext('2d').getImageData(0, 0, 1, 1).data[3], 0);
  assert.equal(frame.getContext('2d').getImageData(frame.width - 1, 0, 1, 1).data[3], 0);
  let lastContactRow = -1;
  const data = frame.getContext('2d').getImageData(0, 0, frame.width, frame.height).data;
  for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++)
    if (data[(y * frame.width + x) * 4 + 3] > 200) lastContactRow = y;
  assert(lastContactRow >= frame.height - 2, 'tracks must touch the ground anchor');
});

test('TOW wreck cover follows the new visible metal and its ground support works in both directions', async () => {
  const frame = towMissileCarrierWreckFrame(await loadImage(asset('tow-wreck.webp')));
  const geometry = wreckGeometry('tow_ifv');
  assert.equal(geometry.atlas, 'tow');
  assert.deepEqual([frame.width, frame.height], [geometry.width, geometry.height]);
  const data = frame.getContext('2d').getImageData(0, 0, frame.width, frame.height).data;
  for (const part of geometry.parts) {
    const [x, y, width, height] = part.map((value, index) => Math.round(value * (index % 2 ? frame.height : frame.width)));
    let solid = 0;
    for (let yy = y; yy < y + height; yy++) for (let xx = x; xx < x + width; xx++)
      solid += data[(yy * frame.width + xx) * 4 + 3] >= 160 ? 1 : 0;
    assert(solid / (width * height) >= .8, 'cover rectangle must mostly contain actual visible wreck metal');
  }
  for (const facing of [-1, 1]) {
    const placement = { cardId: 'tow_ifv', side: 0, facing, x: 1200, y: 374, angle: 0 };
    assert.deepEqual(wreckContact(() => 374, placement), { y: 374, angle: 0 });
    const boxes = wreckObstacles(placement);
    assert.equal(boxes.length, geometry.parts.length);
    assert(boxes.every((box) => box.w > 0 && box.h > 0 && box.y + box.h <= 374.001));
  }
});
