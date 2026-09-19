import type {GameState,Unit} from './engine';
import {CARDS} from './cards';
import {magazine} from './ballistics';
import {squadMates} from './spatial';
import {magazineReloadActive,stanceTransitionActive} from './infantry-action-timing';
import {crouchTravelAmount,startMagazineDrill} from './crouch-locomotion';

/** A loaded weapon is not covering fire if its operator is doing another job. */
export function veteranAtPost(u: Unit, time: number) {
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

/** One voluntary magazine at a time. Geometry/visibility is checked by caller. */
export function tryVeteranReload(s:GameState,u:Unit,canCover:(v:Unit)=>boolean) {
  if(CARDS[u.id].infantryAbility!=='fire_discipline' || !veteranAtPost(u,s.time) ||
    (u.ammo??0)<=0 || (u.ammo??0)>12 || (u.ammoReserve??0)<=0 || magazineReloadActive(u,s.time))return false;
  const spec=magazine(u.id,u.member);if(!spec)return false;
  let covering=0;
  for(const v of squadMates(s,u.side,u.squad)) {
    if(v===u || v.hp<=0 || v.wounded || v.surrendered)continue;
    // Do not start a planned drill while a mate is already dry or reloading.
    if(v.ammo===0 || magazineReloadActive(v,s.time))return false;
    if(covering<2 && Math.abs(v.x-u.x)<=120 && Math.abs(v.lane-u.lane)<=32 && (v.ammo??0)>=3 &&
      veteranAtPost(v,s.time) &&
      s.time-(v.lastCombatShotAt??-Infinity)<=Math.max(.8,(CARDS[v.id].rate??1)*1.35) &&
      canCover(v))covering++;
  }
  if(covering<2)return false;
  startMagazineDrill(u,s.time,spec.reload);
  u.tacticalReload=true;u.relayReload=true;
  return true;
}

export function relayReloadActive(u:Unit,time:number) {
  return !!u.relayReload && !!u.tacticalReload && magazineReloadActive(u,time);
}
