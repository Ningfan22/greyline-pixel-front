import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { V197_VEHICLE_IDS, VEHICLE_ART_V197, vehicleFrameV197 } from '../game/vehicle-art-v197.ts';
import { tankGeometry } from '../game/vehicle-geometry.ts';
import { wreckGeometry, wreckContact, wreckObstacles } from '../game/wreck-geometry.ts';
import { buildEmplacements, unitFrame, unitSize } from '../game/art.ts';
import { muzzleOffset, muzzleHeight } from '../game/engine.ts';
const { createCanvas, loadImage } = createRequire(import.meta.url)('@napi-rs/canvas');
const sharp = createRequire(import.meta.url)('sharp');
globalThis.document = { createElement: () => createCanvas(1, 1) };
const asset = name => fileURLToPath(new URL(`../public/art/v197-armor/${name}`, import.meta.url));
function nearbyAlpha(frame, x, y) {
  const data = frame.getContext('2d').getImageData(Math.floor(x) - 2, Math.floor(y) - 2, 5, 5).data;
  return Math.max(...Array.from(data).filter((_, index) => index % 4 === 3));
}

test('nine distinct v197 generated paintings survive lossless serving with their original RGBA data', async () => {
  const hashes = new Set();
  for (const id of V197_VEHICLE_IDS) for (const kind of ['sprite', 'card', 'wreck']) {
    const stem = `${VEHICLE_ART_V197[id].stem}-${kind}`;
    const original = `${stem}${kind === 'card' ? '-original' : ''}.png`;
    hashes.add(createHash('sha256').update(readFileSync(asset(original))).digest('hex'));
    // Decode straight RGBA before Canvas premultiplication. Skia's PNG and
    // WebP loaders round translucent RGB differently despite identical source
    // channels; comparing getImageData would test that decoder rounding.
    const [raw, webp] = await Promise.all([original, `${stem}.webp`].map(name =>
      sharp(asset(name)).ensureAlpha().raw().toBuffer({ resolveWithObject: true })));
    assert.deepEqual([webp.info.width, webp.info.height], [raw.info.width, raw.info.height]);
    assert(webp.data.equals(raw.data),
      `${id}/${kind} must preserve generated pixels`);
    assert(readFileSync(asset(`${stem}.prompt.txt`), 'utf8').length > 500);
  }
  assert.equal(hashes.size, 9, 'no model shares a copied source file');
});

for (const id of V197_VEHICLE_IDS) {
  // The old light-tank painting is preserved above as an archival source;
  // its active layered model is covered by v198-tank-barrel-render.test.mjs.
  if (id !== 'light_tank') test(`${id}: compact dedicated sprite selector, true transparency, ground baseline and measured weapon mouths`, async () => {
    const frame = vehicleFrameV197(id, await loadImage(asset(`${VEHICLE_ART_V197[id].stem}-sprite.webp`)));
    const geometry = tankGeometry(id);
    assert.deepEqual([frame.width, frame.height], unitSize(id));
    const art = { generatedSprites: {}, mobileVehicles: { [id]: [frame] } };
    for (let phase = 0; phase < 8; phase++) assert.equal(unitFrame(art, id, phase), frame);
    const mouths = [[geometry.muzzleX, geometry.muzzleY]];
    if (id !== 'mlrs') mouths.push([geometry.coaxX, geometry.coaxY]);
    for (const [x, y] of mouths)
      assert(nearbyAlpha(frame, frame.width / 2 + x - geometry.spriteOffset,
        frame.height - y) > 220, `${id} weapon must emerge from authored tube/barrel`);
    const data = frame.getContext('2d').getImageData(0, 0, frame.width, frame.height).data;
    for (const [x, y] of [[0, 0], [frame.width - 1, 0], [0, frame.height - 1]])
      assert(data[(y * frame.width + x) * 4 + 3] < 16, 'no opaque black rectangular backdrop');
    let ground = -1;
    for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++)
      if (data[(y * frame.width + x) * 4 + 3] > 200) ground = y;
    assert(ground >= frame.height - 2, 'tracks remain on the world ground baseline');
    assert(frame.width < tankGeometry('tank').size[0]);
    if (id === 'tow_ifv') {
      assert.equal(frame.width, 150); assert.equal(geometry.barrelBand, undefined);
    }
    if (id === 'mlrs') {
      assert.deepEqual([frame.width, frame.height], [168, 92],
        'the rocket carrier has a smaller battlefield silhouette');
      assert(geometry.half <= 77,
        'movement clearance must shrink with the visible carrier');
    }
  });
  test(`${id}: dedicated wreck collision follows its new authored metal in both directions`, async () => {
    const frame = vehicleFrameV197(id, await loadImage(asset(`${VEHICLE_ART_V197[id].stem}-wreck.webp`)), true);
    const geometry = wreckGeometry(id);
    assert.equal(geometry.atlas, 'v197');
    assert.deepEqual([frame.width, frame.height], [geometry.width, geometry.height]);
    if (id === 'mlrs') assert.deepEqual([frame.width, frame.height], [168, 91],
      'a destroyed carrier must not suddenly return to its old oversized hull');
    const data = frame.getContext('2d').getImageData(0, 0, frame.width, frame.height).data;
    for (const part of geometry.parts) {
      const [x, y, width, height] = part.map((v, i) => Math.round(v * (i % 2 ? frame.height : frame.width)));
      let solid = 0;
      for (let yy = y; yy < y + height; yy++) for (let xx = x; xx < x + width; xx++)
        solid += data[(yy * frame.width + xx) * 4 + 3] >= 160 ? 1 : 0;
      assert(solid / (width * height) >= .8, `${id}: collision part ${part} must be visible metal`);
    }
    for (const facing of [-1, 1]) {
      const placement = { cardId: id, side: 0, facing, x: 1400, y: 374, angle: 0 };
      assert.deepEqual(wreckContact(() => 374, placement), { y: 374, angle: 0 });
      assert(wreckObstacles(placement).every(box => box.w > 0 && box.h > 0 && box.y + box.h <= 374.001));
    }
  });
}

test('existing gun art is sampled at native world sizes, with stable ground legs and real muzzle alignment', async () => {
  const frames = buildEmplacements(await loadImage(fileURLToPath(new URL('../public/art/artillery-v9.png', import.meta.url))));
  for (const [id, cardId] of [['howitzer', 'artillery'], ['at_gun', 'anti_tank_gun'], ['aa_gun', 'aa_gun']]) {
    const frame = frames[id][0];
    assert.deepEqual([frame.width, frame.height], unitSize(cardId));
    assert(frame.width >= 150 && frame.height >= 95, 'the 80x48 intermediary must not return');
    const x = frame.width / 2 + muzzleOffset({ id: cardId });
    const y = frame.height - muzzleHeight({ id: cardId });
    assert(nearbyAlpha(frame, x, y) > 220, `${id} engine gunmouth matches its painted muzzle`);
    const baseline = frame.getContext('2d').getImageData(0, frame.height - 15, frame.width, 15).data;
    for (const phase of frames[id].slice(1))
      assert.deepEqual(phase.getContext('2d').getImageData(0, phase.height - 15, phase.width, 15).data,
        baseline, 'gun feet and wheels remain fixed during barrel recoil');
  }
});
