import type { Unit } from './engine';
import { stanceHeightClass } from './infantry-action-timing';
import {soldierPose} from './soldier-pose';
import {GRENADE_RELEASE_S,GRENADE_THROW_S} from './infantry-action-timing';

/** Measured empty-hand fingertips in prepared 128×96 cel ten (zero-based). */
export const LOW_GRENADE_RELEASE_HAND = {
  crouch: { x: 87, y: 60 },
  prone: { x: 93, y: 83 },
} as const;

export function grenadeReleaseOrigin(u: Pick<Unit, 'x' | 'y' | 'pose'> & Partial<Unit>, dir: number) {
  // Full runtime soldiers release from the same solved hand that is drawn.
  // The minimal legacy shape is retained for old replay/geometry fixtures.
  if(u.id){
    const pose=soldierPose({...u,id:u.id,hp:1,wounded:false,surrendered:false,
      poseAnimAt:undefined,poseAnimProgress:undefined,
      fragThrow:GRENADE_THROW_S-GRENADE_RELEASE_S,fragThrowStartedAt:0},GRENADE_RELEASE_S);
    return {x:u.x+dir*pose.nearHand[0],y:u.y+3+pose.nearHand[1]};
  }
  const pose = stanceHeightClass(u.pose);
  // Preserve the previously authored standing throw's ballistic origin.
  if (pose === 'stand') return { x: u.x + dir * 21, y: u.y - 51 };
  const hand = LOW_GRENADE_RELEASE_HAND[pose];
  // Bodies register at their canvas center/feet and draw three pixels into
  // the ground strip. Lane depth is projected separately from the frozen
  // projectile startLane, never baked into its physical collision height.
  return { x: u.x + dir * (hand.x - 64), y: u.y + 3 + hand.y - 96 };
}
