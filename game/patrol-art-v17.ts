import { assetUrl } from './asset-url';
import type { AdultFrameChoice, AdultIdentity } from './adult-animation';
import type { Unit } from './engine';

export interface PatrolSpritesV17 {
  walk8: HTMLCanvasElement[];
  lowIdle: HTMLCanvasElement;
  raise3: HTMLCanvasElement[];
}
export type PatrolArtV17 = Record<AdultIdentity, PatrolSpritesV17>;
export type PatrolModeV17 = 'walk' | 'idle' | 'raise' | 'fire';
export const PATROL_CELL = 96;
export const PATROL_RAISE_DURATION = 0.24;
export const PATROL_RAISE_FRAME_TIME = 0.08;
export const PATROL_WALK_FPS = 8;

/** Whole-body patrol poses must never freeze or replace an active combat gait. */
export function patrolModeForUnit(
  u: Unit, choice: AdultFrameChoice, time: number,
): PatrolModeV17 | null {
  const plain = choice.group === 'walk8' ||
    (choice.group === 'actions20' && choice.index === 0);
  if (!plain || u.hp <= 0 || u.wounded || u.surrendered || u.rappelling ||
      u.backpedaling || u.motion !== 'ground' || u.climbing ||
      !['idle', 'walk'].includes(u.pose) || (u.reloadingUntil ?? 0) > time)
    return null;
  // adult.walk8 already carries a shouldered rifle. Raising a static patrol
  // body here used to hide all eight moving-leg cels until aimUntil expired.
  if (u.moving)
    return u.fire > 0 || u.secondaryFire > 0 || (u.aimUntil ?? 0) > time ? null : 'walk';
  if (u.fire > 0 || u.secondaryFire > 0) return 'fire';
  return (u.aimUntil ?? 0) > time ? 'raise' : 'idle';
}

/** Original poses were generated individually, then uniformly packed around a fixed foot anchor. */
export function patrolFramesV17(image: HTMLImageElement): PatrolSpritesV17 {
  const frames = Array.from({ length: 12 }, (_, index) => {
    const out = document.createElement('canvas');
    out.width = out.height = PATROL_CELL;
    const ctx = out.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      image,
      (index % 4) * 96,
      Math.floor(index / 4) * 96,
      96,
      96,
      0,
      0,
      96,
      96,
    );
    return out;
  });
  return {
    walk8: frames.slice(0, 8),
    lowIdle: frames[8],
    raise3: frames.slice(9, 12),
  };
}

/** walk uses the existing distance-based u.walk phase. raiseElapsed is in seconds.
 * raise plays the three-frame bring-up then holds the final aimed pose. */
export function patrolFrameV17(
  art: PatrolArtV17,
  identity: AdultIdentity,
  mode: PatrolModeV17,
  walk = 0,
  raiseElapsed = 0,
): HTMLCanvasElement | null {
  const sprites = art[identity];
  if (mode === 'idle') return sprites.lowIdle;
  if (mode === 'walk') return sprites.walk8[((Math.floor(walk) % 8) + 8) % 8];
  // The final raise frame is a standing aimed-rifle pose, so reuse it for firing.
  if (mode === 'fire') return sprites.raise3[2];
  // Hold the aimed pose after the raise transition instead of dropping the
  // rifle, so the whole front line keeps guns on the enemy between shots.
  if (raiseElapsed >= PATROL_RAISE_DURATION) return sprites.raise3[2];
  return sprites.raise3[
    Math.min(2, Math.floor(Math.max(0, raiseElapsed) / PATROL_RAISE_FRAME_TIME))
  ];
}

/** Returns false after the raise transition so the caller draws the original combat frame. */
export function drawPatrolSprite(
  ctx: CanvasRenderingContext2D,
  art: PatrolArtV17,
  identity: AdultIdentity,
  mode: PatrolModeV17,
  walk: number,
  raiseElapsed: number,
  x: number,
  y: number,
  flip = false,
  scale = 1,
) {
  const frame = patrolFrameV17(art, identity, mode, walk, raiseElapsed);
  if (!frame) return false;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(x), Math.round(y));
  ctx.scale((flip ? -1 : 1) * scale, scale);
  ctx.drawImage(frame, -48, -96);
  ctx.restore();
  return true;
}

let pending: Promise<PatrolArtV17> | undefined;
export function loadPatrolArtV17(): Promise<PatrolArtV17> {
  const identities: AdultIdentity[] = [
    'infantry',
    'marines',
    'police',
    'militia',
  ];
  return (pending ??= Promise.all(
    identities.map(
      (identity) =>
        new Promise<[AdultIdentity, PatrolSpritesV17]>((resolve, reject) => {
          const image = new Image();
          image.onload = () => resolve([identity, patrolFramesV17(image)]);
          image.onerror = () =>
            reject(new Error(`Unable to load patrol art: ${identity}`));
          image.src = assetUrl(`/art/v17-patrol/${identity}.png`);
        }),
    ),
  )
    .then((entries) => Object.fromEntries(entries) as PatrolArtV17)
    .catch((error) => {
      pending = undefined;
      throw error;
    }));
}
