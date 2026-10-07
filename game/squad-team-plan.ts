import {CARDS} from './cards';
import type {GameState,Unit} from './engine';
import {visibleToSide,contactIsStale} from './world';
import {nearUnits} from './spatial';
import {infantryAtFirePost} from './infantry-fire-post';
export type TeamRole='overwatch'|'bound'|'probe';
const plans=new WeakMap<GameState,Map<number,{at:number,phase:number,contact:number,lastMove:number}>>();
const plannedAt=new WeakMap<GameState,number>();
const neighbors:Unit[]=[];
const alive=(u:Unit)=>u.hp>0&&!u.wounded&&!u.surrendered&&!u.parachuting&&!u.rappelling;
/** One order for two fire teams. A usable weapon covers a short committed
 * bound; a remembered contact prompts one cautious probe, never a squad-wide
 * invisible wall. Explicit orders, supply and emergency withdrawal own travel. */
export function updateFireTeams(s:GameState){
 if(s.time-(plannedAt.get(s)??-Infinity)<.3)return;
 plannedAt.set(s,s.time);
 const cache=plans.get(s)??new Map();plans.set(s,cache);
 for(const [key,group] of s.squadIndex??[]){
  const foot=group.filter(u=>alive(u)&&CARDS[u.id].members&&!CARDS[u.id].indirect);
  if(!foot.length)continue;
  const side=foot[0].side,dir=side===0?1:-1;
  const eligible=foot.filter(u=>(!u.squadOrder||u.squadOrder==='attack'&&u.squadOrderX===undefined)&&s.players[side].order==='advance'&&!u.resupplyState&&!u.logisticsOrder&&!u.withdrawStandby&&(u.withdrawUntil??0)<=s.time&&u.tactic!=='retreat'&&!u.tending&&!u.digging&&!CARDS[u.id].armorOnly);
  for(const u of foot)if(!eligible.includes(u)){u.teamMoveGoal=undefined;u.teamRole=undefined;}
  if(!eligible.length)continue;
  const front=eligible.reduce((a,u)=>(u.x-a.x)*dir>0?u:a),range=CARDS[front.id].range??380;
  const threat=nearUnits(s,front.x,720,neighbors).filter(v=>v.side!==side&&alive(v)&&!CARDS[v.id].air&&visibleToSide(s,side,v)&&Math.abs(v.x-front.x)<720).sort((a,b)=>Math.abs(a.x-front.x)-Math.abs(b.x-front.x))[0];
  const memory=!threat?(s.groundContacts?.[side]??[]).filter(c=>!contactIsStale(s.time,c)&&c.clearSince===undefined&&(c.x-front.x)*dir>0&&Math.abs(c.x-front.x)<640).sort((a,b)=>Math.abs(a.x-front.x)-Math.abs(b.x-front.x))[0]:undefined;
  if(!threat&&!memory){for(const u of eligible){u.teamMoveGoal=undefined;u.teamRole=undefined;}cache.delete(key);continue;}
  const contact=threat?.x??memory!.x,record=cache.get(key)??{at:s.time,phase:0,contact,lastMove:-Infinity};cache.set(key,record);
  if(s.time-record.at>4.8){record.phase++;record.at=s.time;}
  const shooters=eligible.filter(u=>u.ammo!==0&&infantryAtFirePost(u,s.time)&&threat&&Math.abs(threat.x-u.x)<(CARDS[u.id].range??380)&&s.time-(u.lastCombatShotAt??-Infinity)<2.5);
  const threatenedArmor=threat&&((CARDS[threat.id].armorTier??0)>0);
  const loneProbe=eligible.reduce((a,u)=>u.member<a.member?u:a);
  for(const u of eligible){
   if(u.teamMoveGoal!==undefined&&Math.abs(u.x-u.teamMoveGoal)<2)u.teamMoveGoal=undefined;
   const covers=shooters.some(v=>v!==u);
   const outOfRange=Math.abs(contact-u.x)>(CARDS[u.id].range??range)*.88;
   const mover=memory?u===loneProbe:((u.member+record.phase)%2===1&&covers&&outOfRange);
   u.teamRole=memory?(u===loneProbe?'probe':'overwatch'):mover?'bound':'overwatch';
   // Never order a rifle to assault armour, or stampede through unobserved
   // positions. A short probe remains behind the last observed enemy.
   if(mover&&!threatenedArmor&&u.suppression<35&&u.personalMorale>=45&&u.teamMoveGoal===undefined&&s.time-record.lastMove>1.6){
    const available=(contact-u.x)*dir-(memory?150:Math.max(180,(CARDS[u.id].range??range)*.7));
    if(available>12){u.teamMoveGoal=u.x+dir*Math.min(memory?28:54,available);u.teamMoveUntil=s.time+3.2;record.lastMove=s.time;}
   }
   if((u.teamMoveUntil??0)<s.time)u.teamMoveGoal=undefined;
   if(u===loneProbe&&s.time-record.at<.8){u.teamSignal=memory?'halt':record.phase%2?'advance':'spread';u.teamSignalUntil=record.at+.8;}
  }
 }
}
