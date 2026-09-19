import type { GameState, Unit } from './engine';
import { squadMates } from './spatial';

/** Member roles are independent of the card's shared model/infantry traits. */
export function isPrecisionObserver(u: { id: string; member: number }) {
  return u.id === 'sniper_team' && u.member === 1;
}

export function precisionObserverReady(u: Unit) {
  return isPrecisionObserver(u) && u.hp > 0 && !u.wounded && !u.surrendered &&
    u.motion === 'ground' && !u.parachuting && !u.rappelling && u.climbing <= 0 &&
    !u.moving && u.poseAnimProgress === undefined && (u.stillFor ?? 0) >= 0.65 && u.suppression < 55 &&
    u.tactic !== 'retreat' && u.squadOrder !== 'retreat' &&
    !u.tending && !u.withdrawStandby && u.draggingUid === undefined &&
    u.firstAidTargetUid === undefined;
}

export function precisionPartner(s: GameState, u: Unit) {
  if (u.id !== 'sniper_team') return undefined;
  return squadMates(s, u.side, u.squad).find(v => v.id === u.id && v.member !== u.member &&
    v.hp > 0 && !v.wounded && !v.surrendered);
}

export function pairedPrecisionRange(s: GameState, u: Unit) {
  if (u.id !== 'sniper_team' || u.member !== 0) return false;
  const partner = precisionPartner(s, u);
  return !!partner && precisionObserverReady(partner) && Math.abs(partner.x - u.x) <= 120;
}
