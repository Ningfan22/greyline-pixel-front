/**
 * Speed-of-sound model for battlefield audio.
 *
 * In a real firefight the muzzle flash arrives before the shot, and the
 * brain reads that gap as distance. Every positional sound goes through
 * `soundDelay` so distant booms lag behind their visuals, which is what
 * makes a wide front *feel* wide.
 */

/** Pixels per second (1 px ≈ 0.13 m, so this is roughly 340 m/s). */
export const SOUND_SPEED = 2600;

/** Inside this radius (px) the sound is effectively instantaneous. */
export const NEAR_FIELD = 220;

/** Longest lag (s) we allow — beyond this it stops sounding like distance. */
export const MAX_DELAY = 0.8;

/** Horizontal distance from a sound source to the listener (screen centre). */
export function listenerDistance(
  x: number,
  camera: number,
  width: number,
): number {
  return Math.abs(x - (camera + width / 2));
}

/** Travel time (s) for a sound at `distance` px, clamped to the near field. */
export function soundDelay(distance: number): number {
  return Math.min(
    Math.max((distance - NEAR_FIELD) / SOUND_SPEED, 0),
    MAX_DELAY,
  );
}
