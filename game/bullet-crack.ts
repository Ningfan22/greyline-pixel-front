import type { Projectile } from './engine';

/**
 * Supersonic ammunition — the only rounds that produce a ballistic crack
 * as they pass the listener. Speeds live in FLIGHT (ballistics.ts):
 * rifle 3800, machinegun 3400, autocannon 2600, ap 2300 px/s.
 */
export const SUPERSONIC_AMMO: ReadonlySet<string> = new Set([
  'rifle',
  'machinegun',
  'autocannon',
  'ap',
]);

/** A crack fires when the bullet comes within this radius of the listener. */
export const CRACK_RADIUS = 220;

export interface CrackEvent {
  /** 0 (edge of hearing) to 1 (point-blank pass). */
  closeness: number;
  /** Stereo pan, -1 (left) to 1 (right). */
  pan: number;
  /** Deterministic pitch seed derived from the projectile identity. */
  seed: number;
}

/**
 * Pure near-miss test for a single supersonic projectile. Returns the crack
 * parameters when the bullet is currently inside the listener radius, or
 * null for subsonic rounds, distant rounds, or non-projectile data.
 *
 * The listener sits at the camera centre (the whole 480px battlefield is
 * on screen, so screen-centre is the natural ear position). At 60 fps the
 * slowest supersonic round (ap, 2300 px/s) still spends ~5 frames inside a
 * 220px radius, so current-position sampling never tunnels past the trigger.
 */
export function nearMissCrack(
  p: Projectile,
  listenerX: number,
  listenerY: number,
  width: number,
): CrackEvent | null {
  const ammo = p.ammunition;
  if (!ammo || !SUPERSONIC_AMMO.has(ammo)) return null;
  const dx = p.x - listenerX,
    dy = p.y - listenerY,
    dist = Math.hypot(dx, dy);
  if (dist >= CRACK_RADIUS) return null;
  return {
    closeness: 1 - dist / CRACK_RADIUS,
    pan: Math.max(-1, Math.min(1, dx / (width * 0.65))),
    seed: (p.uid ?? p.sourceUid ?? 0) % 8,
  };
}

/**
 * Tracks which projectiles have already cracked so each round fires exactly
 * once. A WeakSet keys on the projectile object itself — the engine replaces
 * the `s.projectiles` array every tick but keeps the same object references
 * for surviving rounds, so a WeakSet survives the array churn.
 */
export class CrackTracker {
  private cracked = new WeakSet<Projectile>();

  /** Returns a crack event the first time a supersonic round passes close. */
  consider(
    p: Projectile,
    listenerX: number,
    listenerY: number,
    width: number,
  ): CrackEvent | null {
    if (this.cracked.has(p)) return null;
    const event = nearMissCrack(p, listenerX, listenerY, width);
    if (!event) return null;
    this.cracked.add(p);
    return event;
  }

  /** Call when the battle state changes so stale rounds don't carry over. */
  reset() {
    this.cracked = new WeakSet();
  }
}
