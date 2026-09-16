import { CrackTracker } from './bullet-crack';
import type { Projectile } from './engine';

/**
 * Visual counterpart of the v93 bullet crack: when a supersonic round whips
 * past the camera it leaves a brief white motion streak on the screen.
 * Pure render-layer state — the simulation is never touched.
 */
export interface WhipStreak {
  x: number;
  y: number;
  angle: number;
  born: number;
  len: number;
  closeness: number;
  seed: number;
}

/** Streaks fade fast — a whip past the eye reads in a fraction of a second. */
export const STREAK_LIFE = 0.22;

/** Cap concurrent streaks so a machine-gun burst can't paint the whole screen. */
export const MAX_STREAKS = 6;

export class WhipStreakLayer {
  private tracker = new CrackTracker();
  private streaks: WhipStreak[] = [];

  /**
   * Spawns a streak the first time a supersonic round passes the listener.
   * Returns true when a new streak was created.
   */
  consider(
    p: Projectile,
    listenerX: number,
    listenerY: number,
    width: number,
    now: number,
  ): boolean {
    const event = this.tracker.consider(p, listenerX, listenerY, width);
    if (!event) return false;
    const angle =
      p.heading ?? Math.atan2(p.ty - p.startY, p.tx - p.startX);
    this.streaks.push({
      x: p.x,
      y: p.y,
      angle,
      born: now,
      len: 34 + event.closeness * 56,
      closeness: event.closeness,
      seed: event.seed,
    });
    if (this.streaks.length > MAX_STREAKS) this.streaks.shift();
    return true;
  }

  /** Drops expired streaks. Called automatically by draw and by tests. */
  update(now: number) {
    const cutoff = now - STREAK_LIFE;
    this.streaks = this.streaks.filter((k) => k.born > cutoff);
  }

  /** Call when the battle state changes. */
  reset() {
    this.tracker.reset();
    this.streaks = [];
  }

  /** Active streak count (tests and throttling). */
  get size() {
    return this.streaks.length;
  }

  /**
   * Renders the streaks in world space (the caller's transform already
   * includes the camera offset). Additive blending makes overlapping
   * streaks stack like real muzzle-flash-lit tracer motion.
   */
  draw(ctx: CanvasRenderingContext2D, now: number) {
    this.update(now);
    if (this.streaks.length === 0) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const k of this.streaks) {
      const fade = Math.max(0, 1 - (now - k.born) / STREAK_LIFE);
      const dx = Math.cos(k.angle),
        dy = Math.sin(k.angle);
      const alpha = fade * (0.22 + k.closeness * 0.4);
      // Cool outer glow, one chunky pixel block at a time.
      this.raster(ctx, k.x, k.y, dx, dy, k.len, 3, '#8fb0e6', alpha * 0.4);
      // Bright warm core, slightly shorter.
      this.raster(ctx, k.x, k.y, dx, dy, k.len * 0.75, 1, '#fdfdf2', alpha);
    }
    ctx.restore();
  }

  /** Integer-pixel rasterizer matching the tracer style in ballistics.ts. */
  private raster(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    dx: number,
    dy: number,
    len: number,
    width: number,
    color: string,
    alpha: number,
  ) {
    ctx.fillStyle = color;
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    for (let i = 0; i < len; i++)
      ctx.fillRect(Math.round(x - dx * i), Math.round(y - dy * i), width, width);
  }
}
