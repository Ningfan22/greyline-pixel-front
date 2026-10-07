import {CARDS} from './cards';
import type {GameState,Unit} from './engine';
import {unitByUid} from './spatial';
import {visibleToSide} from './world';

/** Movement direction and combat attention are independent. Only sightings
 * and shared last observations update this point; fog never tracks a hidden foe. */
export function rememberInfantryContact(u:Unit,x:number,until:number){
 if(!CARDS[u.id].members)return;
 u.attentionX=x;u.attentionUntil=until;
}
export function infantryLeavingFight(s:GameState,u:Unit){
 return u.tactic==='retreat'||u.resupplyState==='withdrawing'||u.logisticsOrder==='resupply'||
  u.squadOrder==='retreat'&&(u.squadOrderUntil??Infinity)>s.time||
  u.withdrawHeavyUid!==undefined&&(u.withdrawUntil??0)>s.time;
}
export function infantryAttentionX(s:GameState,u:Unit):number|undefined {
 if(!CARDS[u.id].members||u.hp<=0||u.wounded||u.surrendered||u.parachuting||u.rappelling||
    infantryLeavingFight(s,u)||u.tending||u.digging||u.draggingUid!==undefined||
    (u.firstAidUntil??0)>s.time)return;
 if(u.fire>0 && (u.attentionUntil??0)>s.time)return u.attentionX;
 const contact=unitByUid(s,u.contactUid);
 if((u.contactUntil??0)>s.time&&contact&&contact.hp>0&&!contact.wounded&&!contact.surrendered&&
    contact.side!==u.side&&!CARDS[contact.id].air&&visibleToSide(s,u.side,contact)){
  rememberInfantryContact(u,contact.x,s.time+4);
 }
 return (u.attentionUntil??0)>s.time?u.attentionX:undefined;
}
export function infantryAttentionDirection(s:GameState,u:Unit){
 const x=infantryAttentionX(s,u);
 // A point within one step is not an instruction to spin in place.
 return x!==undefined&&Math.abs(x-u.x)>12?Math.sign(x-u.x):0;
}
export function faceInfantryContact(s:GameState,u:Unit){
 if(u.motion!=='ground'||u.climbing>0)return;
 const dir=infantryAttentionDirection(s,u);if(!dir)return;
 u.facing=dir;
}
