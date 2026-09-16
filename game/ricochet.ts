import { SUPERSONIC_AMMO } from './bullet-crack';
import type { Ammunition } from './ballistics';

/**
 * v95: supersonic rounds that strike armour skip off it with a spark and a
 * descending "zzzip". One of the two signature sounds of a real firefight
 * (the other is the v93 ballistic crack). Pure render-layer state — the
 * simulation never knows these exist, and no simulation randomness is used.
 */
export interface Ricochet {
  x: number;
  y: number;
  /** Direction the round flew off in, radians. */
  angle: number;
  age: number;
  seed: number;
  side: number;
}

/** A ricochet reads in a fraction of a second — spark, whine, gone. */
export const RICOCHET_LIFE = 0.3;

/** Only supersonic ammunition skips; subsonic rounds thud or punch through. */
export function canRicochet(ammo?: string): ammo is Ammunition {
  return !!ammo && SUPERSONIC_AMMO.has(ammo);
}

/**
 * Heavy, fast penetrators skip more often than rifle rounds: an AP shell or
 * autocannon bolt carries enough energy to bounce rather than deform.
 */
export function ricochetChance(ammo?: string): number {
  if (ammo === 'ap' || ammo === 'autocannon') return 0.55;
  if (ammo === 'rifle' || ammo === 'machinegun') return 0.32;
  return 0;
}

/**
 * Mirror the incoming angle across the armour face, with a scatter term for
 * the plate's slope and surface irregularities.
 */
export function reflectAngle(incoming: number, scatter: number): number {
  return -incoming + scatter;
}

/** The landing flash only shows for the first 70 ms. */
const FLASH_LIFE = 0.07;

/**
 * Renders one ricochet in world space (the caller's transform already
 * includes the camera offset). Additive blending makes the flash and the
 * hot streak core stack like real spark-lit steel.
 */
export function drawRicochet(ctx: CanvasRenderingContext2D, r: Ricochet) {
  const fade = Math.max(0, 1 - r.age / RICOCHET_LIFE);
  if (fade <= 0) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  if (r.age < FLASH_LIFE) {
    const flash = 1 - r.age / FLASH_LIFE;
    // 3px orange halo, then the 2px white-yellow hot core.
    ctx.globalAlpha = flash * 0.7;
    ctx.fillStyle = '#ff9a3c';
    ctx.fillRect(Math.round(r.x) - 1, Math.round(r.y) - 1, 3, 3);
    ctx.globalAlpha = flash;
    ctx.fillStyle = '#fff3c4';
    ctx.fillRect(Math.round(r.x), Math.round(r.y), 2, 2);
  }
  const dx = Math.cos(r.angle),
    dy = Math.sin(r.angle);
  const len = Math.round(26 * (1 - r.age / RICOCHET_LIFE));
  if (len > 0) {
    const alpha = fade * 0.85;
    // Short 2px orange underlay, then the 1px hot core — same pixel
    // language as the whip streaks and tracers.
    ctx.globalAlpha = alpha * 0.5;
    ctx.fillStyle = '#ff9a3c';
    for (let i = 0; i < Math.min(len, 8); i++)
      ctx.fillRect(
        Math.round(r.x + dx * i),
        Math.round(r.y + dy * i),
        2,
        2,
      );
    ctx.globalAlpha = alpha;
    ctx.fillStyle = '#ffe9a8';
    for (let i = 0; i < len; i++)
      ctx.fillRect(
        Math.round(r.x + dx * i),
        Math.round(r.y + dy * i),
        1,
        1,
      );
  }
  ctx.restore();
}

/** Draws every live ricochet; expired ones are skipped. */
export function drawRicochets(
  ctx: CanvasRenderingContext2D,
  list: readonly Ricochet[],
) {
  for (const r of list) drawRicochet(ctx, r);
}
