import type { Unit } from './engine';
import { crouchTravelAmount } from './crouch-locomotion';
/** Adult atlas dimensions measured from the shared (48,96) foot anchor.
 * Heights account for render's +3px foot inset; lane remains a visual depth offset.
 */
const STANDING = { muzzleX: 31, muzzleHeight: 47, bodyHeight: 34 };
const CROUCH_WALK = { muzzleX: 32, muzzleHeight: 37, bodyHeight: 28 };
const CROUCH = { muzzleX: 28, muzzleHeight: 28, bodyHeight: 23 };
const PRONE = { muzzleX: 43, muzzleHeight: 7, bodyHeight: 11 };
const PRONE_CRAWL = {...PRONE,bodyHeight:17};
function proneGeometry(travel=0) {
  return travel>=1 ? PRONE_CRAWL : travel>0 ? {...PRONE,bodyHeight:11+6*travel} : PRONE;
}
function lowGeometry(p: number) {
  if (p <= 0) return CROUCH;
  if (p >= 1) return CROUCH_WALK;
  return {muzzleX:CROUCH.muzzleX+(CROUCH_WALK.muzzleX-CROUCH.muzzleX)*p,
    muzzleHeight:CROUCH.muzzleHeight+(CROUCH_WALK.muzzleHeight-CROUCH.muzzleHeight)*p,
    bodyHeight:CROUCH.bodyHeight+(CROUCH_WALK.bodyHeight-CROUCH.bodyHeight)*p};
}
export function infantryGeometry(
  u: Pick<Unit, 'pose'> & Partial<Pick<Unit, 'moving' | 'poseAnimProgress' | 'poseAnimFrom' | 'poseAnimSeen' | 'poseAnimFromTravel' | 'poseAnimToTravel' | 'crouchTravel' | 'proneTravel'>>,
) {
  const p = u.poseAnimProgress;
  if (p !== undefined && u.poseAnimFrom && u.poseAnimSeen && p < 1) {
    const shapes = { stand: STANDING, crouch: CROUCH, prone: PRONE };
    const full = (u.poseAnimFrom === 'stand' && u.poseAnimSeen === 'prone') ||
      (u.poseAnimFrom === 'prone' && u.poseAnimSeen === 'stand');
    const from = full && p >= .5 ? CROUCH : u.poseAnimFrom === 'crouch' ? lowGeometry(u.poseAnimFromTravel??0) : u.poseAnimFrom==='prone' ? proneGeometry(u.poseAnimFromTravel) : shapes[u.poseAnimFrom];
    const to = full && p < .5 ? CROUCH : u.poseAnimSeen === 'crouch' ? lowGeometry(u.poseAnimToTravel??0) : u.poseAnimSeen==='prone' ? proneGeometry(u.poseAnimToTravel) : shapes[u.poseAnimSeen];
    const blend = full ? p < .5 ? p*2 : (p-.5)*2 : p;
    // Hit geometry descends with the body, not instantly on the AI decision.
    return { muzzleX: from.muzzleX + (to.muzzleX-from.muzzleX)*blend,
      muzzleHeight: from.muzzleHeight + (to.muzzleHeight-from.muzzleHeight)*blend,
      bodyHeight: from.bodyHeight + (to.bodyHeight-from.bodyHeight)*blend };
  }
  return u.pose === 'prone'
    ? proneGeometry(u.proneTravel)
    : u.pose === 'crouch' || u.pose === 'hunker'
      ? lowGeometry(crouchTravelAmount(u))
    : u.pose === 'land'
      ? u.moving ? CROUCH_WALK : CROUCH
      : STANDING;
}
