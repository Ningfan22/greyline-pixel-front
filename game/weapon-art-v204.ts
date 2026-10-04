import {
  WEAPON_LAYOUT,
  weaponLayout,
  HELI_LAYOUT,
  MLRS_WRECK,
  type ModularGunId,
} from './weapon-layout-v204';
import { gunPose, type GunBody } from './gun-geometry';
import type { PaintedGunParts } from './gun-art';
export interface HelicopterParts {
  body: HTMLCanvasElement;
  rotor: HTMLCanvasElement;
  pod: HTMLCanvasElement;
  gun: HTMLCanvasElement;
  rotorPivot: [number, number];
  podPivot: [number, number];
  gunPivot: [number, number];
}
export interface WeaponEffects {
  flame: HTMLCanvasElement[];
  flameOrigins: number[];
  rocket: HTMLCanvasElement;
}
function crop(
  image: HTMLImageElement,
  rect: readonly number[],
  width: number,
  height?: number,
) {
  const c = document.createElement('canvas');
  c.width = Math.round(width);
  c.height = height ?? Math.ceil((rect[3] * width) / rect[2]);
  const ctx = c.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(
    image,
    rect[0],
    rect[1],
    rect[2],
    rect[3],
    0,
    c.height - (rect[3] * width) / rect[2],
    width,
    (rect[3] * width) / rect[2],
  );
  return c;
}
export function modularGunParts(
  id: ModularGunId,
  image: HTMLImageElement,
): PaintedGunParts {
  const a = weaponLayout(id);
  return {
    body: crop(image, a.body, a.bodyWidth, a.bodyHeight),
    barrel: crop(image, a.barrel, a.barrelWidth),
    barrelPivot: [
      a.barrelPivot[0],
      a.barrelPivot[1] +
        Math.ceil(a.barrel[3] * a.gunScale) -
        a.barrel[3] * a.gunScale,
    ],
    sourceElevation: a.sourceElevation,
    barrelBehindBody: id !== 'mlrs',
  };
}
export function helicopterParts(image: HTMLImageElement): HelicopterParts {
  const a = HELI_LAYOUT;
  const pivot = (
    rect: readonly number[],
    p: readonly number[],
    w: number,
  ): [number, number] => [
    ((p[0] - rect[0]) * w) / rect[2],
    ((p[1] - rect[1]) * w) / rect[2] +
      Math.ceil((rect[3] * w) / rect[2]) -
      (rect[3] * w) / rect[2],
  ];
  return {
    body: crop(image, a.body, a.width, a.height),
    rotor: crop(image, a.rotor, a.rotorWidth),
    pod: crop(image, a.pod, a.podWidth),
    gun: crop(image, a.gun, a.gunWidth),
    rotorPivot: pivot(a.rotor, a.rotorPivot, a.rotorWidth),
    podPivot: pivot(a.pod, a.podPivot, a.podWidth),
    gunPivot: pivot(a.gun, a.gunPivot, a.gunWidth),
  };
}
export function weaponEffects(
  flame: HTMLImageElement,
  rocketSheet: HTMLImageElement,
): WeaponEffects {
  return {
    flame: [0, 1, 2, 3].map((row) =>
      crop(flame, [32, row * 256, 1473, 256], 192),
    ),
    flameOrigins: [170, 170, 166, 151].map((y) => (y * 192) / 1473),
    rocket: crop(rocketSheet, [150, 877, 1160, 114], 34),
  };
}
export function drawHelicopter(
  ctx: CanvasRenderingContext2D,
  parts: HelicopterParts,
  u: GunBody,
  time: number,
  dead = false,
) {
  const dir = (u.gunFacing ?? u.facing ?? 1) < 0 ? -1 : 1,
    scale = HELI_LAYOUT.width / HELI_LAYOUT.body[2];
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.translate(u.x, u.y);
  ctx.rotate(u.hullAngle ?? 0);
  ctx.scale(dir, 1);
  ctx.drawImage(parts.body, -parts.body.width / 2, -parts.body.height);
  const rotorX =
    (HELI_LAYOUT.socket[0] - HELI_LAYOUT.body[0]) * scale -
    parts.body.width / 2;
  const rotorY =
    -(HELI_LAYOUT.body[1] + HELI_LAYOUT.body[3] - HELI_LAYOUT.socket[1]) *
    scale;
  ctx.save();
  ctx.translate(rotorX, rotorY);
  ctx.scale(dead ? 1 : 0.78 + 0.22 * Math.cos(time * 82), 1);
  ctx.drawImage(parts.rotor, -parts.rotorPivot[0], -parts.rotorPivot[1]);
  ctx.restore();
  ctx.restore();
  for (const rocket of [true, false]) {
    const active = rocket ? u.id === 'rocket_heli' : u.id !== 'rocket_heli';
    const pose = gunPose(
      { ...u, id: rocket ? 'rocket_heli' : 'helicopter' },
      active ? u.gunElevation : 0,
      dir,
    )!;
    const image = rocket ? parts.pod : parts.gun,
      pivot = rocket ? parts.podPivot : parts.gunPivot;
    ctx.save();
    ctx.translate(pose.pivot.x, pose.pivot.y);
    ctx.rotate(pose.angle);
    ctx.scale(1, dir);
    ctx.drawImage(image, -pivot[0], -pivot[1]);
    ctx.restore();
  }
  ctx.restore();
}
export function drawFlameStream(
  ctx: CanvasRenderingContext2D,
  effects: WeaponEffects,
  x: number,
  y: number,
  tx: number,
  ty: number,
  time: number,
  uid: number,
) {
  const dx = tx - x,
    dy = ty - y,
    length = Math.hypot(dx, dy);
  if (length < 3) return;
  const index = Math.floor(time * 13 + uid) % effects.flame.length,
    frame = effects.flame[index];
  const scale = length / frame.width;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x), Math.round(y));
  ctx.rotate(Math.atan2(dy, dx));
  ctx.drawImage(
    frame,
    0,
    -effects.flameOrigins[index] * scale,
    length,
    frame.height * scale,
  );
  ctx.restore();
}

export function mlrsWreckFrame(image: HTMLImageElement) {
  return crop(image, MLRS_WRECK.crop, MLRS_WRECK.width, MLRS_WRECK.height);
}
