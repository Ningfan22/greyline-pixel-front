import {CARDS} from './cards';
import type {GameState,Unit} from './engine';
import {infantryGeometry} from './infantry-geometry';
import {nearUnits} from './spatial';

type Lane={source:number;side:number;sx:number;sy:number;tx:number;ty:number;fromLane:number;toLane:number;until:number};
const lanes=new WeakMap<GameState,Map<string,Lane>>();
const neighbors:Unit[]=[];
const alive=(u:Unit)=>u.hp>0&&!u.wounded&&!u.surrendered&&!u.parachuting&&!u.rappelling;
export const friendlyBodyHeight=(u:Unit)=>infantryGeometry(u).bodyHeight*1.55;
function at(line:Lane,x:number){const t=(x-line.sx)/(line.tx-line.sx);return {t,y:line.sy+(line.ty-line.sy)*t,lane:line.fromLane+(line.toLane-line.fromLane)*t};}
/** The shooter warns before sending a round, and infantry retain the lane
 * between burst rounds. This never disables actual projectile friendly fire. */
export function warnFriendlyLane(s:GameState,u:Unit,sx:number,sy:number,tx:number,ty:number,targetLane:number,secondary=false){
 if(Math.abs(tx-sx)<8)return;
 const map=lanes.get(s)??new Map<string,Lane>();lanes.set(s,map);
 map.set(`${u.uid}:${secondary?1:0}`,{source:u.uid,side:u.side,sx,sy,tx,ty,fromLane:u.lane,toLane:targetLane,until:s.time+.65});
}
export function refreshFriendlyLanes(s:GameState){
 const map=lanes.get(s);if(!map)return;
 for(const [key,line] of map)if(line.until<s.time)map.delete(key);
}
export function friendlyLineBlocked(s:GameState,u:Unit,sx:number,sy:number,tx:number,ty:number,targetLane=u.lane){
 if(Math.abs(tx-sx)<8)return false;
 const line:Lane={source:u.uid,side:u.side,sx,sy,tx,ty,fromLane:u.lane,toLane:targetLane,until:s.time};
 for(const ally of nearUnits(s,(sx+tx)/2,Math.abs(tx-sx)/2+8,neighbors)){
  if(ally===u||ally.side!==u.side||!alive(ally)||!CARDS[ally.id].members)continue;
  const p=at(line,ally.x);
  if(p.t<=0||p.t>=1||Math.abs(p.lane-ally.lane)>8)continue;
  if(p.y>=ally.y-friendlyBodyHeight(ally)-3&&p.y<=ally.y-1)return true;
 }
 return false;
}
export function friendlyCrossing(s:GameState,u:Unit,nextX=u.x){
 if(!CARDS[u.id].members||!alive(u)||u.motion!=='ground')return null;
 const map=lanes.get(s);if(!map?.size)return null;
 let result:{pose:'crouch'|'prone';blocked:boolean;lane?:number}|null=null;
 for(const line of map.values()){
  if(line.source===u.uid||line.side!==u.side||line.until<s.time)continue;
  const p=at(line,nextX);
  if(p.t<=0||p.t>=1||Math.abs(p.lane-u.lane)>8||p.y>u.y-1||p.y<u.y-61)continue;
  const height=u.y-p.y,pose=height>45?'crouch':'prone';
  const blocked=p.y>=u.y-friendlyBodyHeight(u)-3;
  // A low grazing burst cannot be crawled under. Cross in a committed depth
  // lane instead of stopping in the stream or turning back toward home.
  const crawlTooHigh=height<30;
  const lane=crawlTooHigh?Math.max(-24,Math.min(24,p.lane+(u.lane>=p.lane?1:-1)*16)):undefined;
  if(!result||pose==='prone')result={pose,blocked,lane};
 }
 return result;
}
