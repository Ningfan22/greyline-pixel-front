import type { Unit } from './engine';
import { stanceHeightClass } from './infantry-action-timing';

/** Measured empty-hand fingertips in prepared 128×96 cel ten (zero-based). */
export const LOW_GRENADE_RELEASE_HAND = {
  crouch: { x: 87, y: 60 },
  prone: { x: 93, y: 83 },
} as const;

export function grenadeReleaseOrigin(u: Pick<Unit, 'x' | 'y' | 'pose'>, dir: number) {
  const pose = stanceHeightClass(u.pose);
  // Preserve the previously authored standing throw's ballistic origin.
  if (pose === 'stand') return { x: u.x + dir * 21, y: u.y - 51 };
  const hand = LOW_GRENADE_RELEASE_HAND[pose];
  // Bodies register at their canvas center/feet and draw three pixels into
  // the ground strip. Lane depth is projected separately from the frozen
  // projectile startLane, never baked into its physical collision height.
  return { x: u.x + dir * (hand.x - 64), y: u.y + 3 + hand.y - 96 };
}
