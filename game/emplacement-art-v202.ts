import type { PaintedGunParts } from './gun-art';

/** Articulate the original painted guns; no replacement pixels are drawn.
 * Masks follow the existing breech / recoil cylinders / barrel silhouettes,
 * leaving wheels, trails and the anti-tank shield on their fixed carriage. */
type Point = readonly [number, number];
type EmplacementName = 'howitzer' | 'at_gun';
interface Cut {
  pivot: Point;
  muzzle: Point;
  outlines: readonly (readonly Point[])[];
}
export const EMPLACEMENT_CUTS: Record<EmplacementName, Cut> = {
  howitzer: {
    pivot: [84, 62], muzzle: [188, 41],
    outlines: [[
      [54, 59], [67, 57], [67, 49], [106, 47], [112, 52],
      [177, 37], [190, 36], [190, 47], [112, 66], [110, 70],
      [92, 70], [91, 68], [78, 68], [78, 72], [56, 72],
    ]],
  },
  at_gun: {
    pivot: [85, 64.5], muzzle: [188, 64.5],
    // The middle of the weapon is hidden by the original fixed shield.
    outlines: [
      [[59, 60], [69, 58], [69, 53], [75, 53], [75, 60], [80, 60],
        [80, 71], [70, 73], [60, 70]],
      [[97, 61], [190, 60], [190, 69], [113, 70], [99, 70]],
    ],
  },
};
function inside(x: number, y: number, points: readonly Point[]) {
  let hit = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [ax, ay] = points[i], [bx, by] = points[j];
    if ((ay > y) !== (by > y) && x < (bx - ax) * (y - ay) / (by - ay) + ax) hit = !hit;
  }
  return hit;
}
function canvas(width: number, height: number) {
  const out = document.createElement('canvas'); out.width = width; out.height = height;
  return out;
}
export function splitEmplacement(frame: HTMLCanvasElement, name: EmplacementName): PaintedGunParts {
  const cut = EMPLACEMENT_CUTS[name];
  const body = canvas(frame.width, frame.height), bodyContext = body.getContext('2d')!;
  const source = frame.getContext('2d')!.getImageData(0, 0, frame.width, frame.height);
  const bodyPixels = bodyContext.createImageData(frame.width, frame.height);
  const mask = new Uint8Array(frame.width * frame.height);
  let left = frame.width, top = frame.height, right = 0, bottom = 0;
  for (let y = 0; y < frame.height; y++) for (let x = 0; x < frame.width; x++) {
    const at = y * frame.width + x, offset = at * 4;
    if (source.data[offset + 3] && cut.outlines.some(points => inside(x + .5, y + .5, points))) {
      mask[at] = 1; left = Math.min(left, x); top = Math.min(top, y);
      right = Math.max(right, x + 1); bottom = Math.max(bottom, y + 1);
    } else bodyPixels.data.set(source.data.subarray(offset, offset + 4), offset);
  }
  const barrel = canvas(right - left, bottom - top), barrelContext = barrel.getContext('2d')!;
  const barrelPixels = barrelContext.createImageData(barrel.width, barrel.height);
  for (let y = top; y < bottom; y++) for (let x = left; x < right; x++) {
    if (!mask[y * frame.width + x]) continue;
    const sourceAt = (y * frame.width + x) * 4;
    barrelPixels.data.set(source.data.subarray(sourceAt, sourceAt + 4), ((y - top) * barrel.width + x - left) * 4);
  }
  bodyContext.putImageData(bodyPixels, 0, 0);
  barrelContext.putImageData(barrelPixels, 0, 0);
  return {
    body, barrel,
    barrelPivot: [cut.pivot[0] - left, cut.pivot[1] - top],
    sourceElevation: Math.atan2(cut.pivot[1] - cut.muzzle[1], cut.muzzle[0] - cut.pivot[0]),
    barrelBehindBody: true,
  };
}
export function buildEmplacementParts(frames: Record<string, HTMLCanvasElement[]>) {
  return Object.fromEntries((['howitzer', 'at_gun'] as const).map(name => [name, splitEmplacement(frames[name][0], name)])) as Record<EmplacementName, PaintedGunParts>;
}
