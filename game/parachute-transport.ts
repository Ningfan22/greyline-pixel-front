import {CARDS,type CardId} from './cards';
import type {GameState,Side,Unit} from './engine';
export const PARACHUTE_TRANSPORT_SPEED=940;
export const PARACHUTE_RUN_SPEED=420;
const JUMP_SPACING=60;
export interface ParachuteFlight{landingX:number;cargo:CardId;dropped:number;squad?:number;}
export function prepareParachuteTransport(s:GameState,u:Unit,cargo:CardId,landingX:number){
  const dir=u.side===0?1:-1;
  u.x=u.side===0?70:s.terrain.length-70;u.y=160;u.facing=dir;
  u.parachuteFlight={landingX,cargo,dropped:0};
}
export function stepParachuteTransport(s:GameState,u:Unit,dt:number,ops:{
  spawn:(s:GameState,side:Side,id:CardId,x:number,cargo?:{member:number;squad?:number})=>void;
  landing:(s:GameState,x:number)=>number;
}){
  const f=u.parachuteFlight!;const dir=u.side===0?1:-1,count=CARDS[f.cargo].members??1;
  const before=u.x,door=u.x-dir*92;
  const first=f.landingX-dir*(count-1)*JUMP_SPACING/2,last=f.landingX+dir*(count-1)*JUMP_SPACING/2;
  const dropping=(door-first)*dir>=-100&&(door-last)*dir<=100;
  u.x+=dir*(dropping?PARACHUTE_RUN_SPEED:PARACHUTE_TRANSPORT_SPEED)*dt;
  // Keep flying through the release run. Each person leaves the rear door
  // at a different position, then descends independently under a canopy.
  while(f.dropped<count){
    const release=f.landingX+dir*((f.dropped-(count-1)/2)*JUMP_SPACING);
    const door=u.x-dir*92;
    if((door-release)*dir<0)break;
    const n=s.units.length;
    ops.spawn(s,u.side,f.cargo,ops.landing(s,release),{member:f.dropped,squad:f.squad});
    const soldier=s.units[n];f.squad=soldier.squad;
    soldier.y=u.y+24;soldier.parachuting=true;soldier.parachutingStartAt=s.time;
    soldier.cooldown=.65;soldier.rapidUntil=0;soldier.pose='climb';
    f.dropped++;
  }
  u.moving=true;u.vx=(u.x-before)/dt;u.vy=0;u.fire=0;u.secondaryFire=0;
  if(u.x < -260||u.x>s.terrain.length+260){u.hp=0;u.destroyed=true;u.deadFor=0;}
}
