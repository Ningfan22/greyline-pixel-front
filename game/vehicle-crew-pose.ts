import {soldierPose,solveLimb,type Point,type SoldierPose} from './soldier-pose';
import {gunPose} from './gun-geometry';
import type {Unit} from './engine';

/** Vehicle operators are instances of the infantry rig. Gloves work the gun
 * receiver or reload hatch; they are never painted onto the chassis. */
export function vehicleCrewPose(u:Unit,time:number){
 const reloading=u.id==='tow_ifv'&&(u.reloadingUntil??0)>time;
 if(u.id!=='pickup'&&!reloading)return null;
 const facing=u.facing||1,gun=gunPose(u);
 const socketX=u.id==='pickup'?(gun!.pivot.x-u.x)*facing:0;
 const socketY=u.id==='pickup'?gun!.pivot.y-u.y:-64;
 const x=socketX-17,y=u.id==='pickup'?-31:-34;
 const base=soldierPose({id:'infantry',uid:u.uid*10+7,pose:u.id==='pickup'?'idle':'crouch',hp:100,member:0,
   moving:false,facing,rifleReady:0,fire:0,secondaryFire:0},time);
 const progress=reloading?Math.max(0,Math.min(1,(time-(u.reloadingStartAt??time))/Math.max(.01,(u.reloadingUntil??time)-(u.reloadingStartAt??time)))):0;
 const loading=reloading?Math.sin(progress*Math.PI*4)*4:0;
 const hand:Point=[17,socketY-y+loading];
 const near=solveLimb(base.shoulder,hand,12,13,1),far=solveLimb([base.shoulder[0]+1,base.shoulder[1]-1],[hand[0]-3,hand[1]-1],12,13,1);
 const pose:SoldierPose={...base,action:reloading?'reload':'ready',weaponVisible:false,slung:false,
   nearElbow:near.joint,nearHand:near.end,farElbow:far.joint,farHand:far.end,prop:undefined};
 return {pose,facing,x,y};
}
