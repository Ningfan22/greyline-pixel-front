import type {Point,SoldierWeapon} from './soldier-pose';

/** Landmarks in the cropped part atlas, not the retired whole-soldier cels.
 * The same rigid transform places the pixels, both hands and the shot origin.
 */
export const WEAPON_GRIPS:Record<SoldierWeapon,{
  muzzle:Point;trigger:Point;support:Point;shoulder:Point;feed:Point;
}>={
  rifle:{muzzle:[35,3],trigger:[12,7],support:[21,4.5],shoulder:[1,5],feed:[16,8]},
  lmg:{muzzle:[41,3],trigger:[11,6.5],support:[23,4],shoulder:[1,4.5],feed:[17,3]},
  hmg:{muzzle:[48,6.5],trigger:[11,8],support:[23,8],shoulder:[2,7],feed:[24,9]},
  rocket:{muzzle:[38,4],trigger:[18,9],support:[24,5],shoulder:[8,5],feed:[2,4]},
  manpads:{muzzle:[38,5.5],trigger:[27,10],support:[31,6.5],shoulder:[13,6.5],feed:[2,5.5]},
  sniper:{muzzle:[46,3],trigger:[12,6],support:[25,4],shoulder:[1,5],feed:[16,7]},
  grenade:{muzzle:[29,3.5],trigger:[10,9],support:[18,6],shoulder:[1,6],feed:[17,8]},
  mortar:{muzzle:[18,1.5],trigger:[10,18],support:[13,12],shoulder:[8,20],feed:[18,0]},
  flame:{muzzle:[34,3],trigger:[10,7],support:[21,4.5],shoulder:[1,5],feed:[15,7]},
};
export const rotateWeapon=(p:Point,a:number):Point=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
/** Rear sight/ocular and the eye relief behind it, measured in atlas pixels. */
export const WEAPON_SIGHTS:Record<SoldierWeapon,{rear:Point;relief:number}>={
  rifle:{rear:[12,1.5],relief:3},lmg:{rear:[12,1.5],relief:3},
  rocket:{rear:[17,1.5],relief:4},manpads:{rear:[24,1.5],relief:3},
  sniper:{rear:[13,1],relief:4},grenade:{rear:[12,1.5],relief:3},
  hmg:{rear:[12,4],relief:3},mortar:{rear:[12,10],relief:4},flame:{rear:[12,1.5],relief:3},
};
export function weaponSocket(origin:Point,angle:number,point:Point):Point {
  const p=rotateWeapon(point,angle);return [origin[0]+p[0],origin[1]+p[1]];
}
export function weaponPlacement(weapon:SoldierWeapon,shoulder:Point,low:number,travel:number,ready:number,ground=0,run=0) {
  const grip=WEAPON_GRIPS[weapon],mounted=weapon==='hmg'||weapon==='mortar';
  const carry=mounted?Math.min(1,travel):0;
  const p=Math.max(0,Math.min(1,low-1)),prone=p*p*(3-2*p);
  const launcher=weapon==='rocket'||weapon==='manpads';
  const running=Math.max(0,Math.min(1,run))*(1-Math.max(0,Math.min(1,low)));
  const relaxed=(1-Math.max(0,Math.min(1,ready)))*(1-prone);
  // Aimed stocks keep their established shoulder contact. In low ready the
  // rifle drops away from the cheek and points down; shoulder-fired tubes
  // remain supported on the shoulder instead of hanging from the hands.
  let angle=launcher?Math.max(relaxed,running)*.12:relaxed*.50;
  let socket:Point=[shoulder[0],shoulder[1]+(launcher?-2:0)];
  socket=[socket[0]-prone,socket[1]+(shoulder[1]-5-socket[1])*prone];
  if(prone>0&&!mounted){
    // Rest the stock in the front of the shoulder pocket. The old upper-edge
    // anchor raised both gun and sight-following head. A small forward reach
    // lets the trigger elbow keep pointing down as the gun lowers; dropping
    // vertically alone would force that elbow through the floor.
    const pocket:Point=weapon==='sniper'?[1.5,-.5]:weapon==='lmg'?[3.5,-.6]:
      weapon==='rocket'?[4.8,-1]:weapon==='manpads'?[2,.5]:
      weapon==='grenade'?[4.8,-1.2]:weapon==='flame'?[4.8,-.2]:[4,.5];
    const rest=1-Math.max(0,Math.min(1,travel)),settle=prone*rest*rest*(3-2*rest);
    // Briefly clear the elbow while transferring from crawl carry to the
    // supported position; the two end poses stay exactly on their sockets.
    const clearance=prone*4*rest*(1-rest)*.8;
    socket=[socket[0]+(pocket[0]+1)*settle,socket[1]+(pocket[1]+5)*settle-clearance];
  }
  if(!mounted&&!launcher)socket=[socket[0]-relaxed*3,socket[1]+relaxed*4];
  if(weapon==='hmg'){socket=[shoulder[0]+1,shoulder[1]+7-10*prone];angle=.16*(1-prone);}
  if(weapon==='mortar'){
    socket=[shoulder[0]+7-4*prone,shoulder[1]+15-16*prone];angle=-.48+1.58*prone;
  }
  const anchor=rotateWeapon(grip.shoulder,angle);
  let origin:Point=[socket[0]-anchor[0],socket[1]-anchor[1]];
  if(!mounted&&!launcher&&running>0){
    // Running carries the gun across the chest/waist, away from the shoulder
    // pocket. Both hands follow this one rigid gun, including acceleration.
    const carryAngle=.22,carryTrigger:Point=[shoulder[0]+1,shoulder[1]+13];
    const trigger=rotateWeapon(grip.trigger,carryAngle);
    const carryOrigin:Point=[carryTrigger[0]-trigger[0],carryTrigger[1]-trigger[1]];
    origin=[origin[0]+(carryOrigin[0]-origin[0])*running,origin[1]+(carryOrigin[1]-origin[1])*running];
    angle+=(carryAngle-angle)*running;
  }
  if(mounted){
    // Deployed support feet are on the local ground plane. They do not ride
    // along with the operator's hands, breathing or reload animation.
    // In a settled prone pose the operator is already on the ground; keep the
    // mounted body close to the shoulder instead of lifting the whole support
    // to the upright emplacement height. Upright/carry transforms stay intact.
    const proneMounted=low>=1.9;
    const deployed:Point=weapon==='hmg'
      ?[shoulder[0]+1,ground-(proneMounted?21:28)]
      :[3,ground-(proneMounted?27:35)];
    origin=[deployed[0]+(origin[0]-deployed[0])*carry,deployed[1]+(origin[1]-deployed[1])*carry];
    angle=carry?angle*carry:0;
    // Slide the emplacement horizontally into the operator's reach. Keep its
    // base height and rigid geometry, including during folding/unfolding.
    let left=-Infinity,right=Infinity;
    for(const [point,root] of [[grip.trigger,shoulder],[grip.support,[shoulder[0]+1,shoulder[1]-1]],
      ...(weapon==='mortar'?[[grip.feed,[shoulder[0]+1,shoulder[1]-1]]]:[])] as [Point,Point][]){
      const local=rotateWeapon(point,angle),dy=origin[1]+local[1]-root[1];
      const reach=Math.sqrt(Math.max(0,24.8**2-dy*dy));
      left=Math.max(left,root[0]-local[0]-reach);right=Math.min(right,root[0]-local[0]+reach);
    }
    origin=[Math.max(left,Math.min(right,origin[0])),origin[1]];
  }
  return {origin,angle,carry,muzzle:weaponSocket(origin,angle,grip.muzzle),
    trigger:weaponSocket(origin,angle,grip.trigger),support:weaponSocket(origin,angle,grip.support),
    feed:weaponSocket(origin,angle,grip.feed)};
}
