import type { GameState, Side, Unit } from './engine';
import { CARDS } from './cards';
import { buildingHull, sceneryIntercept, segmentBox } from './world';
import { wreckContact, wreckObstacles } from './wreck-geometry';

export interface GliderFlight {
  landingX: number;
  fromX: number;
  fromY: number;
  startedAt: number;
  phase: 'approach' | 'roll' | 'unload';
  phaseAt: number;
  dropped: number;
  nextAt: number;
  squad?: number;
}
const floor = (s: GameState,x: number) => s.terrain[Math.max(0,Math.min(s.terrain.length-1,Math.round(x)))];
const dirOf = (side: Side) => side===0?1:-1;
function flightBlocked(s:GameState,sx:number,sy:number,tx:number,ty:number) {
  for(const dx of [-85,0,85]) {
    if(sceneryIntercept(s,sx+dx,sy-26,tx+dx,ty-26,false,true))return true;
    if(s.walls.some(w=>w.hp>0&&segmentBox(sx+dx,sy-26,tx+dx,ty-26,
      {x:w.x-w.width/2,y:floor(s,w.x)-w.height,w:w.width,h:w.height})!==null))return true;
  }
  return false;
}
export function airborneTarget(u: Unit) {
  return !!CARDS[u.id].air && !(u.glider && u.glider.phase !== 'approach');
}

/** Physical runway constraints, not an enemy-intelligence query. */
export function clearGliderLanding(s: GameState,x: number,side: Side) {
  const dir=dirOf(side),left=x-(dir>0?200:110),right=x+(dir>0?110:200);
  if(left<480||right>s.terrain.length-480)return false;
  let lo=Infinity,hi=-Infinity;
  for(let px=left;px<=right;px+=10){const y=floor(s,px);lo=Math.min(lo,y);hi=Math.max(hi,y);}
  if(hi-lo>20)return false;
  for(const prop of s.scenery){
    if(Math.abs(prop.x-x)>420)continue;
    const parts=prop.kind==='house'?buildingHull(prop,px=>floor(s,px)):
      prop.parts.filter(p=>p.hp>0&&p.kind==='trunk');
    if(parts.some(p=>p.x<right&&p.x+p.w>left&&p.h>10))return false;
  }
  for(const wall of s.walls)if(wall.hp>0&&wall.height>10&&wall.x-wall.width/2<right&&wall.x+wall.width/2>left)return false;
  return !s.wrecks.some(w=>{
    if(w.falling||CARDS[w.cardId].members)return false;
    const parts=wreckObstacles(w).filter(b=>b.x<right&&b.x+b.w>left);
    // A detailed wreck can be many thin contour bands; their individual
    // rectangle height is not the height of the obstruction on the runway.
    return parts.length>0&&Math.max(...parts.map(b=>b.y+b.h))-Math.min(...parts.map(b=>b.y))>10;
  });
}
export function gliderLanding(s: GameState,request: number,side: Side): number | null {
  const desired=Math.max(650,Math.min(s.terrain.length-650,request));
  for(let d=0;d<=320;d+=16)for(const sign of d?[1,-1]:[1]){
    const x=desired+d*sign;
    if(!clearGliderLanding(s,x,side))continue;
    // Reject an already blocked descent, instead of charging for a guaranteed
    // crash into a building beside an otherwise valid runway.
    const dir=dirOf(side),touch=x-dir*90,height=floor(s,touch);
    let px=touch-dir*450,py=70,blocked=false;
    for(let i=1;i<=30;i++){
      const t=i/30,nx=touch-dir*450*(1-t),ny=70+(height-70)*(t*t*(3-2*t));
      if(flightBlocked(s,px,py,nx,ny)){blocked=true;break;}
      px=nx;py=ny;
    }
    if(!blocked)return x;
  }
  return null;
}
export function prepareGlider(s: GameState,u: Unit,landingX: number) {
  u.x=u.side===0?-140:s.terrain.length+140;u.y=70;u.facing=dirOf(u.side);
  u.glider={landingX,fromX:u.x,fromY:u.y,startedAt:s.time,phase:'approach',phaseAt:s.time,dropped:0,nextAt:s.time};
}

export function gliderArtIndex(u: Unit,time: number) {
  const f=u.glider;if(!f)return 0;
  if(f.phase==='approach')return Math.floor((time-f.startedAt)*4)%2;
  if(f.phase==='roll')return 2;
  // Cels 4/5 contain damaged skin, not additional healthy door poses.
  return u.hp<u.maxHp*.5?5:3;
}
export function gliderDust(s: GameState,x: number,y: number,count=8) {
  // Deterministic particles, no blast/fire/ground damage from an unpowered hull.
  for(let i=0;i<count;i++)s.particles.push({kind:'dust',x:x+(i-count/2)*3,y:y-2,
    vx:(i-count/2)*5,vy:-12-(i%3)*6,life:.55,maxLife:.55,color:'#94876b',size:4+(i%3)});
}

export function stepGlider(s: GameState,u: Unit,dt: number,ops: {
  spawn: (s:GameState,side:Side,id:Unit['id'],x:number,cargo?:{member:number;squad?:number})=>void;
  crash: (u:Unit)=>void;
}) {
  const f=u.glider;if(!f)return;
  const dir=dirOf(u.side),oldX=u.x,oldY=u.y;
  u.fire=0;u.secondaryFire=0;u.facing=dir;
  if(f.phase==='approach'){
    const touch=f.landingX-dir*90,distance=Math.abs(touch-f.fromX);
    const traveled=Math.min(distance,(s.time-f.startedAt)*360);
    u.x=f.fromX+dir*traveled;
    const t=Math.max(0,Math.min(1,(traveled-(distance-450))/450));
    u.y=f.fromY+(floor(s,touch)-f.fromY)*(t*t*(3-2*t));
    u.hullAngle=Math.atan2(u.y-oldY,Math.abs(u.x-oldX)||1)*dir*.25;
    // A late terrain/obstacle change can ruin the approach. Never teleport over it.
    const obstruction=flightBlocked(s,oldX,oldY,u.x,u.y);
    if(obstruction || (traveled<distance-1&&u.y>floor(s,u.x)+6)) {ops.crash(u);return;}
    if(traveled>=distance){f.phase='roll';f.phaseAt=s.time;u.y=floor(s,u.x);gliderDust(s,u.x,u.y);}
  }else if(f.phase==='roll'){
    const t=Math.min(1,(s.time-f.phaseAt)/1.2);
    u.x=f.landingX-dir*90+dir*90*(2*t-t*t);
    const contact=wreckContact(px=>floor(s,px),{cardId:u.id,side:u.side,facing:dir,x:u.x});
    u.y=contact.y;u.hullAngle=contact.angle;
    if(flightBlocked(s,oldX,oldY,u.x,u.y)){ops.crash(u);return;}
    if(Math.floor((s.time-f.phaseAt)*10)!==Math.floor((s.time-f.phaseAt-dt)*10))gliderDust(s,u.x-dir*30,u.y,3);
    if(t>=1){f.phase='unload';f.phaseAt=s.time;f.nextAt=s.time+1.05;}
  }else{
    // The hull stays grounded while the door opens and four people leave it.
    const contact=wreckContact(px=>floor(s,px),{cardId:u.id,side:u.side,facing:dir,x:u.x});
    u.y=contact.y;u.hullAngle=contact.angle;
    if(s.time>=f.nextAt&&f.dropped<4){
      const n=s.units.length;
      ops.spawn(s,u.side,'glider_assault',u.x+dir*60,{member:f.dropped,squad:f.squad});
      const soldier=s.units[n];f.squad=soldier.squad;
      soldier.cooldown=.65; soldier.rapidUntil=0; soldier.ambushFor=0;
      soldier.pose='land';soldier.motion='land';soldier.motionDuration=.3; soldier.motionTime=0;
      f.dropped++;f.nextAt=s.time+.45;
    }
    if(f.dropped===4){
      u.hp=0;u.destroyed=true;u.deadFor=0;
      const w={id:u.uid,cardId:u.id,side:u.side,x:u.x,y:u.y,angle:u.hullAngle,
        age:0,falling:false,vx:0,vy:0,facing:u.facing,abandoned:true};
      Object.assign(w,wreckContact(px=>floor(s,px),w));s.wrecks.push(w);
      s.visionIn=0;
    }
  }
  u.moving=Math.abs(u.x-oldX)>.01;u.vx=(u.x-oldX)/dt;u.vy=(u.y-oldY)/dt;
}
