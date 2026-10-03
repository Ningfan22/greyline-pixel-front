import { tankLayoutV202, type TankIdV202 } from './tank-layout-v202';
import type { PaintedGunParts } from './gun-art';
import { drawArticulatedGun } from './gun-art';

function canvas(width: number, height: number) {
  const out = document.createElement('canvas');
  out.width = Math.ceil(width); out.height = Math.ceil(height);
  return out;
}
/** No palette conversion, keying, redrawing or intermediate thumbnail: one
 * nearest-neighbour crop of each image-generated part at its world scale. */
export function tankPartsV202(id: TankIdV202, source: HTMLImageElement): PaintedGunParts {
  const a = tankLayoutV202(id), body = canvas(a.width, a.height);
  const bc = body.getContext('2d')!; bc.imageSmoothingEnabled = false;
  const [bx, by, bw, bh] = a.body, [gx, gy, gw, gh] = a.barrel;
  bc.drawImage(source, bx, by, bw, bh, 0, body.height - a.body[3] * a.scale,
    a.width, a.body[3] * a.scale);
  const barrel = canvas(a.barrel[2] * a.scale, a.barrel[3] * a.scale);
  const gc = barrel.getContext('2d')!; gc.imageSmoothingEnabled = false;
  gc.drawImage(source, gx, gy, gw, gh, 0, 0, a.barrel[2] * a.scale, a.barrel[3] * a.scale);
  return { body, barrel, barrelPivot: a.barrelPivot, sourceElevation: 0 };
}
/** Compatibility portrait; the battle renderer always uses the real layers. */
export function tankPreviewV202(id: TankIdV202, parts: PaintedGunParts) {
  const a = tankLayoutV202(id), out = canvas(Math.max(a.width, a.width / 2 + a.pivotX + a.barrelLength + 2), a.height);
  drawArticulatedGun(out.getContext('2d')!, parts, {id, x: a.width / 2, y: out.height, facing: 1});
  return out;
}
