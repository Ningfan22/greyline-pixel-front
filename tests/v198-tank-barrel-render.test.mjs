import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { loadArt, unitFrame, drawSprite, drawTankSprite } from '../game/art.ts';
import { tankGeometry } from '../game/vehicle-geometry.ts';
const { createCanvas, Image } = createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document = { createElement: () => createCanvas(1, 1) };
globalThis.Image = class extends Image {
  set src(value) {
    const loaded = this.onload;
    this.onload = () => { this.decode().then(() => { loaded?.(); }); };
    super.src = resolve('public', String(value).replace(/^\//, ''));
  }
  get src() { return super.src; }
};
const art = await loadArt();
const pixels = canvas => Buffer.from(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data);
function paint(id, flip, rotation, recoil, whole = false) {
  const canvas = createCanvas(500, 220), ctx = canvas.getContext('2d');
  const frame = unitFrame(art, id, 0), g = tankGeometry(id);
  const args = [ctx, frame, 250, 180, ...g.size, flip, 1, rotation];
  if (whole) drawSprite(...args);
  else drawTankSprite(...args, g.barrelBand, recoil);
  return canvas;
}
for (const id of ['light_tank', 'tank', 'heavy_tank']) {
  for (const flip of [false, true]) {
    test(`${id} ${flip ? 'left' : 'right'}: resting barrel preserves every authored pixel, including on slopes`, () => {
      for (const rotation of [0, -.08, .08]) {
        assert(pixels(paint(id, flip, rotation, 0)).equals(pixels(paint(id, flip, rotation, 0, true))),
          'a stationary barrel must render as the complete original frame');
      }
    });
    test(`${id} ${flip ? 'left' : 'right'}: recoil keeps a continuous visible gun and leaves the hull unchanged`, () => {
      const g = tankGeometry(id), [x0, y0, x1, y1] = g.barrelBand;
      const maximum = Math.min(15, (x1 - x0) * .3);
      const original = pixels(paint(id, flip, 0, 0));
      const originalAt = (x, y) => {
        const worldX = flip ? 249 - x : 250 + x;
        return ((180 + y) * 500 + worldX) * 4;
      };
      for (const recoil of [maximum / 2, maximum]) {
        const shot = pixels(paint(id, flip, 0, recoil));
        let barrelPixels = 0, referencePixels = 0;
        // Each occupied source column, shifted into the moving band, must
        // still contain actual painted metal. This catches the vanished band
        // even if an unchanged muzzle tip remains visible past its boundary.
        for (let x = Math.ceil(x0) + 1; x < Math.min(x1 - recoil - 2, Math.floor(g.size[0] / 2) - recoil - 2); x++) {
          let sourceAlpha = 0, renderedAlpha = 0;
          for (let y = Math.ceil(y0) + 1; y < Math.floor(y1) - 1; y++) {
            const p = originalAt(x, y), source = originalAt(Math.round(x + recoil), y);
            sourceAlpha += original[source + 3]; renderedAlpha += shot[p + 3];
            referencePixels += original[p + 3] > 128 ? 1 : 0;
            barrelPixels += shot[p + 3] > 128 ? 1 : 0;
          }
          if (sourceAlpha > 255) assert(renderedAlpha > 128, `${id}: missing gun column at ${x}, recoil ${recoil}`);
        }
        assert(referencePixels > 12, 'the regression samples a real authored barrel');
        assert(barrelPixels > referencePixels * .5, 'recoil must not erase the thin gun section');
        for (let y = -Math.floor(g.size[1]); y < 0; y++) for (let x = -Math.floor(g.size[0] / 2); x < Math.floor(g.size[0] / 2); x++) {
          if (x >= Math.floor(x0) - 1 && x <= Math.ceil(x1) + 1 && y >= Math.floor(y0) - 1 && y <= Math.ceil(y1) + 1) continue;
          const p = originalAt(x, y);
          assert(shot.subarray(p, p + 4).equals(original.subarray(p, p + 4)), 'barrel recoil cannot cut or shift the hull');
        }
      }
    });
  }
}
