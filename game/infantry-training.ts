import {CARDS,modelOf,type CardId} from './cards';

export type InfantryTraining = 'regular' | 'trained' | 'elite';
type Soldier = {id?:CardId;training?:InfantryTraining;kills?:number};
/** Recruitment training and earned experience change skill, never body health. */
export function infantryTraining(u:Soldier):InfantryTraining {
  if(u.training)return u.training;
  const c=u.id?CARDS[u.id]:undefined;
  if(!c?.members)return 'regular';
  if(modelOf(c.id)==='sniper'||c.infantryAbility==='elite'||
      ['special_forces','glider_assault','ambush_squad'].includes(c.id))return 'elite';
  return c.airdrop||(c.discipline??0)>=85||c.uniform==='assault'?'trained':'regular';
}
export function tacticalActionScale(u:Soldier){
  return {regular:1,trained:.8,elite:.62}[infantryTraining(u)];
}
export function soldierHitChance(u:Soldier,precision=false){
  if(precision)return .98;
  const base={regular:1/3,trained:.58,elite:.82}[infantryTraining(u)];
  return Math.min(.94,base+Math.min(3,Math.floor((u.kills??0)/3))*.035);
}
