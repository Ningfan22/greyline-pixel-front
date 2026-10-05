import type { PaintedGunParts } from './gun-art';
import { drawArticulatedGun } from './gun-art';
/** Measured parts of the image-generated IFV. One world/source scale keeps
 * armour, road wheels, barrel socket and muzzle in the same pixel density. */
export const IFV_ART_V220 = {
  source: '/art/v220-ifv/ifv.png',
  body: [48, 42, 1548, 708], barrel: [490, 800, 715, 117],
  width: 185, height: 90,
  socket: [1029, 316], breech: [571, 860], muzzle: [1192, 860],
} as const;
export function ifvLayoutV220() {
  const a = IFV_ART_V220, scale = a.width / a.body[2];
  return { ...a, scale,
    pivotX: (a.socket[0] - a.body[0]) * scale - a.width / 2,
    pivotHeight: (a.body[1] + a.body[3] - a.socket[1]) * scale,
    barrelLength: (a.muzzle[0] - a.breech[0]) * scale,
    barrelPivot: [(a.breech[0] - a.barrel[0]) * scale, (a.breech[1] - a.barrel[1]) * scale] as [number, number],
  };
}
function canvas(w: number, h: number) {
  const out = document.createElement('canvas'); out.width = Math.ceil(w); out.height = Math.ceil(h); return out;
}
export function ifvPartsV220(source: HTMLImageElement): PaintedGunParts {
  const a = ifvLayoutV220(), body = canvas(a.width, a.height), barrel = canvas(a.barrel[2] * a.scale, a.barrel[3] * a.scale);
  for (const [out, crop, y] of [[body, a.body, a.height - a.body[3] * a.scale], [barrel, a.barrel, 0]] as const) {
    const ctx = out.getContext('2d')!; ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, crop[0], crop[1], crop[2], crop[3], 0, y, crop[2] * a.scale, crop[3] * a.scale);
  }
  return { body, barrel, barrelPivot: a.barrelPivot, sourceElevation: 0 };
}
export function ifvPreviewV220(parts: PaintedGunParts) {
  const a = ifvLayoutV220(), out = canvas(Math.max(a.width, a.width / 2 + a.pivotX + a.barrelLength + 2), a.height);
  drawArticulatedGun(out.getContext('2d')!, parts, {id:'ifv',x:a.width/2,y:a.height,facing:1}); return out;
}
