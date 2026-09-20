import type {GameState,Unit} from './engine';
import {CARDS,weaponModel} from './cards';
import {squadMates} from './spatial';
import {magazineReloadActive} from './infantry-action-timing';
import {infantryAtFirePost} from './infantry-fire-post';

/** Actual operators, not every rifle escort sharing a heavy-weapon card. */
export function grenadePriorityTarget(v: Unit) {
  const c=CARDS[v.id];
  return !c.air && !c.armored && !c.vehicle &&
    (!!c.emplacement || (!!c.members && ['machinegun','mortar','rocket'].includes(weaponModel(v))));
}

/** One real throw/flight at a time; at least one nearby rifle remains in action.
 * The caller supplies current sight and firing-ray checks, never hidden intel. */
export function grenadeRelayReady(s:GameState,u:Unit,canCover:(mate:Unit)=>boolean) {
  if(u.id!=='assault_grenadiers' || !infantryAtFirePost(u,s.time))return false;
  const mates=squadMates(s,u.side,u.squad);
  if(mates.some(v=>(v.fragThrow??0)>0) || s.projectiles.some(p=>
    p.ammunition==='grenade' && p.side===u.side && mates.some(v=>v.uid===p.sourceUid)))return false;
  return mates.some(v=>v!==u && Math.abs(v.x-u.x)<=120 && Math.abs(v.lane-u.lane)<=32 &&
    infantryAtFirePost(v,s.time) && !magazineReloadActive(v,s.time) && (v.ammo??0)>=3 &&
    s.time-(v.lastCombatShotAt??-Infinity)<=Math.max(.8,(CARDS[v.id].rate??1)*1.35) && canCover(v));
}
