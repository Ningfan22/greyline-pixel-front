import type { Unit } from './engine';
/** Adult atlas dimensions measured from the shared (48,96) foot anchor.
 * Heights account for render's +3px foot inset; lane remains a visual depth offset.
 */
const STANDING = { muzzleX: 31, muzzleHeight: 47, bodyHeight: 34 };
const CROUCH_WALK = { muzzleX: 32, muzzleHeight: 37, bodyHeight: 28 };
const CROUCH = { muzzleX: 28, muzzleHeight: 28, bodyHeight: 23 };
const HUNKER = { muzzleX: 30, muzzleHeight: 24, bodyHeight: 15 };
const PRONE = { muzzleX: 43, muzzleHeight: 7, bodyHeight: 11 };
export function infantryGeometry(
  u: Pick<Unit, 'pose'> & Partial<Pick<Unit, 'moving'>>,
) {
  return u.pose === 'prone'
    ? PRONE
    : u.pose === 'hunker'
      ? HUNKER
    : u.pose === 'crouch' || u.pose === 'land'
      ? u.moving
        ? CROUCH_WALK
        : CROUCH
      : STANDING;
}
