import type {Unit} from './engine';
import {stanceTransitionActive} from './infantry-action-timing';
import {crouchTravelAmount} from './crouch-locomotion';

/** Shared physical readiness for a planned, covered infantry drill. */
export function infantryAtFirePost(u: Unit, time: number) {
  return u.hp>0 && !u.wounded && !u.surrendered && !u.moving &&
    !u.parachuting && !u.rappelling && u.motion==='ground' && u.climbing<=0 &&
    !stanceTransitionActive(u,time) && crouchTravelAmount(u)===0 &&
    (u.stillFor??0)>=.65 && u.suppression<55 && u.personalMorale>=40 &&
    (u.coverGoal==null || Math.abs(u.coverGoal-u.x)<=.5) &&
    (u.firingGoal==null || Math.abs(u.firingGoal-u.x)<=.5) &&
    u.tactic!=='retreat' && u.squadOrder!=='retreat' && (u.withdrawUntil??0)<=time &&
    !u.withdrawStandby && !u.tending && !u.digging && u.draggingUid===undefined &&
    (u.firstAidUntil??0)<=time && (u.fragThrow??0)<=0 && (u.evadeUntil??0)<=time;
}
