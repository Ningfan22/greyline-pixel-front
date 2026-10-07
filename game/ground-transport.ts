import {CARDS} from './cards';
import {ammoRatio,supplyCapacity} from './ammo-logistics';
import {nearUnits} from './spatial';
import {visibleToSide} from './world';
import type {GameState,Unit} from './engine';

const living=(u:Unit)=>u.hp>0&&!u.wounded&&!u.surrendered&&!u.parachuting&&!u.rappelling;
const neighbors:Unit[]=[];
/** A carrier delivers its squad behind the contact, never through it. */
export function shouldUnloadTransport(s:GameState,u:Unit){
 if(!CARDS[u.id].groundCargo||u.transportReleased||!living(u))return false;
 const base=u.side===0?110:s.terrain.length-110;
 return Math.abs(u.x-base)>850||nearUnits(s,u.x,520,neighbors).some(v=>
   v.side!==u.side&&living(v)&&!CARDS[v.id].air&&Math.abs(v.x-u.x)<520&&visibleToSide(s,u.side,v))||
   (u.fuel??100)<20;
}
/** Unarmed logistics stays behind fighting units, close enough to replenish
 * them. A tolerance prevents the truck chasing every small front-line step. */
export function supplyTruckGoal(s:GameState,u:Unit){
 const dir=u.side===0?1:-1,base=u.side===0?110:s.terrain.length-110;
 const fighters=s.units.filter(v=>v!==u&&v.side===u.side&&living(v)&&!CARDS[v.id].air&&
   !CARDS[v.id].vehicleSupport&&!supplyCapacity(v)&&(CARDS[v.id].damage??0)>0);
 const needy=fighters.filter(v=>ammoRatio(v)<.85||((v.fuel??100)<65));
 const front=(needy.length?needy:fighters).reduce((x,v)=>(v.x-x)*dir>0?v.x:x,base);
 const desired=Math.max(110,Math.min(s.terrain.length-110,front-dir*(needy.length?125:210)));
 return Math.abs(desired-u.x)>35?desired:u.x;
}
