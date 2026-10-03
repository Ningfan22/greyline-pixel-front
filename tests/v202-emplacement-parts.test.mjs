import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { buildEmplacements } from '../game/art.ts';
import { buildEmplacementParts, EMPLACEMENT_CUTS } from '../game/emplacement-art-v202.ts';
import { drawArticulatedGun } from '../game/gun-art.ts';
import { gunMount, gunPose } from '../game/gun-geometry.ts';

const { createCanvas, loadImage } = createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document = { createElement: () => createCanvas(1, 1) };
const frames = buildEmplacements(await loadImage(fileURLToPath(new URL('../public/art/artillery-v9.png', import.meta.url))));
const parts = buildEmplacementParts(frames);
const rgba = canvas => Buffer.from(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data);
function alphaNear(canvas, point, radius = 3) {
  const data = canvas.getContext('2d').getImageData(Math.floor(point.x) - radius, Math.floor(point.y) - radius, radius * 2 + 1, radius * 2 + 1).data;
  return data.some((value, index) => index % 4 === 3 && value > 220);
}
for (const [name, id] of [['howitzer', 'artillery'], ['at_gun', 'anti_tank_gun']]) {
  test(`${name}: separate carriage and complete gun retain every original painted pixel`, () => {
    const original = frames[name][0], p = parts[name], cut = EMPLACEMENT_CUTS[name];
    const combined = createCanvas(original.width, original.height), c = combined.getContext('2d');
    c.drawImage(p.barrel, cut.pivot[0] - p.barrelPivot[0], cut.pivot[1] - p.barrelPivot[1]);
    c.drawImage(p.body, 0, 0);
    assert(rgba(combined).equals(rgba(original)), 'separation must neither invent pixels nor remove metal');
    assert(p.barrelPivot[0] > 15, 'the rear breech must move with the barrel, not remain glued to the carriage');
    assert(p.barrel.width > 120, 'the entire breech-to-muzzle gun is a distinct sprite');
    const mount = gunMount(id);
    assert.equal(mount.pivotX, cut.pivot[0] - original.width / 2);
    assert.equal(mount.pivotHeight, original.height - cut.pivot[1]);
    assert(Math.abs(mount.barrelLength - Math.hypot(cut.muzzle[0] - cut.pivot[0], cut.muzzle[1] - cut.pivot[1])) < .01);
  });
  test(`${name}: mirrored visible muzzle follows the same low and elevated gun pose as projectiles`, () => {
    const p = parts[name], mount = gunMount(id);
    for (const facing of [-1, 1]) for (const elevation of [mount.minElevation, p.sourceElevation, Math.min(.5, mount.maxElevation)]) {
      const canvas = createCanvas(480, 220), body = {
        id, x: 240, y: 190, side: facing === 1 ? 0 : 1, facing, gunFacing: facing,
        gunElevation: elevation, hullAngle: .14, fire: 0,
      };
      drawArticulatedGun(canvas.getContext('2d'), p, body);
      assert(alphaNear(canvas, gunPose(body).muzzle), `painted gun mouth must follow elevation ${elevation}, facing ${facing}`);
      // Field guns keep their braced carriage planted; barrel elevation must
      // not tilt the wheels or trails on the ground with it.
      const wheelY = body.y - 4;
      const baseline = canvas.getContext('2d').getImageData(110, wheelY, 260, 4).data;
      assert(baseline.some((value, index) => index % 4 === 3 && value > 220));
    }
  });
}
