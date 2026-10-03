import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { tankPartsV202 } from '../game/tank-art-v202.ts';
import { TANK_IDS_V202, TANK_ASSET_ROOT, tankLayoutV202 } from '../game/tank-layout-v202.ts';
import { drawArticulatedGun } from '../game/gun-art.ts';
import { gunMount, gunPose } from '../game/gun-geometry.ts';
const { createCanvas, loadImage } = createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document = { createElement: () => createCanvas(1, 1) };
const pixels = canvas => Buffer.from(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data);
const parts = Object.fromEntries(await Promise.all(TANK_IDS_V202.map(async id => [id,
  tankPartsV202(id, await loadImage(fileURLToPath(new URL(`../public${TANK_ASSET_ROOT}/${id}.webp`, import.meta.url))))])));
function paint(id, facing, hullAngle, gunElevation, fire = 0, moving = false) {
  const canvas = createCanvas(640, 280), body = {
    id, x: 320, y: 235, side: facing < 0 ? 1 : 0, facing, gunFacing: facing,
    hullAngle, gunElevation, fire, moving,
  };
  drawArticulatedGun(canvas.getContext('2d'), parts[id], body);
  return { canvas, body };
}
function occupiedNear(canvas, x, y) {
  const rgba = canvas.getContext('2d').getImageData(Math.floor(x) - 3, Math.floor(y) - 3, 7, 7).data;
  return rgba.some((value, index) => index % 4 === 3 && value > 220);
}
for (const id of TANK_IDS_V202) {
  for (const facing of [-1, 1]) {
    test(`${id} facing ${facing}: painted muzzle matches projectile origin through slope and elevation`, () => {
      const mount = gunMount(id);
      for (const [hullAngle, gunElevation] of [[-.14, mount.minElevation], [0, 0], [.14, mount.maxElevation]]) {
        const { canvas, body } = paint(id, facing, hullAngle, gunElevation);
        const tip = gunPose(body).muzzle;
        assert(occupiedNear(canvas, tip.x, tip.y), `${id}: projectile muzzle must touch the painted gun mouth`);
        assert(parts[id].barrel !== parts[id].body, 'gun elevation uses its own image, not a clipped muzzle band');
      }
    });
    test(`${id} facing ${facing}: recoil keeps the whole gun and leaves the planted hull unchanged`, () => {
      const resting = paint(id, facing, 0, .08), firing = paint(id, facing, 0, .08, .25);
      const a = pixels(resting.canvas), b = pixels(firing.canvas);
      // Wheels and tracks lie below the gun sweep; recoil must leave their
      // actual painted hull pixels unchanged.
      const lower = 225 * resting.canvas.width * 4;
      assert(a.subarray(lower).equals(b.subarray(lower)), 'gun recoil cannot shift or punch holes in the tracks');
      const pose = gunPose(firing.body);
      const tip = { x: pose.muzzle.x - Math.cos(pose.angle) * 5, y: pose.muzzle.y - Math.sin(pose.angle) * 5 };
      assert(occupiedNear(firing.canvas, tip.x, tip.y), 'recoiled mouth remains visible instead of disappearing into a clip');
      let changed = 0;
      for (let i = 0; i < a.length; i += 4) changed += a[i + 3] !== b[i + 3] ? 1 : 0;
      assert(changed > 10, 'the separate barrel visibly recoils');
      const moving = paint(id, facing, 0, .08, .25, true);
      assert(pixels(moving.canvas).equals(a), 'travel never cycles the gun in and out');
      assert.equal(parts[id].body.width, tankLayoutV202(id).width);
    });
  }
}
