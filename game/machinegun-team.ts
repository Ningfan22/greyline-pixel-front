import type { GameState, Unit } from './engine';
import { CARDS } from './cards';
import { nearUnits } from './spatial';
import { POSE_TRANSITION_S } from './infantry-action-timing';

export const HEAVY_MG_SETUP = 2.4;
export function isHeavyGunner(u: Pick<Unit, 'id' | 'member'>) {
  return u.id === 'heavy_mg' && u.member === 0;
}
export function isLightGunner(u: Pick<Unit, 'id' | 'member'>) {
  return u.id === 'lmg_team' && u.member === 0;
}
export function heavyMGReady(s: GameState, u: Unit) {
  return isHeavyGunner(u) && u.hp > 0 && !u.wounded && !u.surrendered &&
    !u.moving && u.motion === 'ground' && !u.parachuting && !u.rappelling &&
    u.climbing <= 0 && (u.stillFor ?? 0) >= HEAVY_MG_SETUP &&
    ['crouch','hunker','prone'].includes(u.pose) &&
    s.time - (u.poseAnimAt ?? -Infinity) >= POSE_TRANSITION_S;
}
export function machinegunBurst(u: Pick<Unit, 'id' | 'member'>) {
  return isLightGunner(u) ? { rounds: 4, pause: .8 }
    : isHeavyGunner(u) ? { rounds: 8, pause: .8 } : null;
}

const coverScratch: Unit[] = [];
/** A light gun may move only during its burst pause with real covering fire.
 * Not a generic speed buff: without a firing buddy it holds the contact.
 */
export function lightMGBound(s: GameState, u: Unit, target: Unit | undefined | null, order: string) {
  if (!isLightGunner(u) || order !== 'advance' || !target || CARDS[target.id].air ||
      (target.x-u.x)*(u.side===0?1:-1) < 220 ||
      (u.mgBurstRestUntil ?? 0) <= s.time ||
      u.suppression >= 40 || u.tactic === 'retreat' || u.squadOrder === 'retreat' ||
      u.motion !== 'ground' || u.climbing > 0 || u.ammo === 0 ||
      (u.reloadingUntil ?? 0) > s.time || u.hp <= 0 || u.wounded || u.surrendered)
    return false;
  return nearUnits(s,u.x,180,coverScratch).some(v => v !== u && v.side===u.side &&
    CARDS[v.id].members && v.hp>0 && !v.wounded && !v.surrendered && !v.moving &&
    v.motion==='ground' && v.suppression<55 && Math.abs(v.x-u.x)<=180 &&
    s.time-(v.lastCombatShotAt ?? -Infinity)<1.5);
}
