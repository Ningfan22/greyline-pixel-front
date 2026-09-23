/** One anatomical model for every soldier and every action. Coordinates are
 * local to the boot anchor, facing right; facing NEVER changes limb identity.
 * No canvases, frame fitting, random sizes or render-time state writes here.
 */
import type {Unit} from './engine';
import {CARDS,weaponModel} from './cards';
import {adultIdentity} from './adult-animation';
import {isPrecisionObserver} from './precision-team';
import {infantryGeometry} from './infantry-geometry';
import {infantryWeaponMuzzle} from './infantry-weapon-geometry';
import {stanceHeightClass,stanceTransitionProgress,magazineReloadActive,
  grenadeElapsed,GRENADE_THROW_S,GRENADE_RELEASE_S} from './infantry-action-timing';

export type Point = readonly [number,number];
export type SoldierBody = Pick<Unit,'id'|'pose'> & Partial<Unit>;
export type SoldierWeapon = 'rifle'|'lmg'|'hmg'|'rocket'|'manpads'|'sniper'|'grenade'|'mortar'|'flame';
export type SoldierAction = 'ready'|'reload'|'throw'|'medical'|'repair'|'dig'|'drag'|'share'|
  'scavenge'|'signal'|'observe'|'deploy'|'barrel'|'cycle'|'casualty'|'surrender'|'rappel'|'parachute'|'vault';
export const SOLDIER_BONES = {thigh:17,shin:17,torso:22,upperArm:12,forearm:13} as const;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const lerp=(a:Point,b:Point,t:number):Point=>[mix(a[0],b[0],t),mix(a[1],b[1],t)];
const add=(a:Point,b:Point):Point=>[a[0]+b[0],a[1]+b[1]];
const smooth=(t:number)=>{t=clamp(t);return t*t*(3-2*t);};

export function soldierAppearance(u: Pick<Unit,'id'>) {
  return {identity:adultIdentity(u.id),uniform:CARDS[u.id].uniform??'infantry'};
}
export function soldierWeapon(u: Pick<Unit,'id'> & Partial<Pick<Unit,'member'>>): SoldierWeapon {
  const member=u.member??0,model=weaponModel({id:u.id,member});
  if(u.id==='flame_team'&&member===0)return 'flame';
  if(u.id==='heavy_mg'&&member===0)return 'hmg';
  if(isPrecisionObserver({id:u.id,member}))return 'rifle';
  if(u.id==='grenadiers'||u.id==='assault_grenadiers')return 'grenade';
  if(model==='machinegun')return 'lmg';
  if(model==='rocket')return u.id==='manpads'?'manpads':'rocket';
  if(model==='sniper')return 'sniper';
  if(model==='mortar')return 'mortar';
  return 'rifle';
}
export const SOLDIER_WEAPON_SIZE:Record<SoldierWeapon,Point>={
  rifle:[36,9],lmg:[42,12],hmg:[49,26],rocket:[39,11],manpads:[39,12],
  sniper:[47,11],grenade:[30,12],mortar:[25,33],flame:[35,9],
};
type Stance = {hip:Point;lean:number;nearFoot:Point;farFoot:Point;muzzle:Point;low:number;legBend?:number};
function stanceAt(pose:'stand'|'crouch'|'prone',travel=0):Stance {
  if(pose==='prone')return {hip:[-17,-8-travel*2],lean:1.40,nearFoot:[-49,-3],farFoot:[-45,-4],muzzle:[43,-10-travel*2],low:2};
  if(pose==='crouch')return {hip:[-5,-17-travel*7],lean:.28,nearFoot:[17,-3],farFoot:[-16,-3],muzzle:[30,-33-travel*7],low:1};
  return {hip:[-2,-33],lean:.06,nearFoot:[7,-3],farFoot:[-7,-3],muzzle:[31,-50],low:0};
}
function blendStance(a:Stance,b:Stance,t:number):Stance {
  if(a.low===2&&b.low===1)return blendStance(b,a,1-t);
  if(a.low===1&&b.low===2){
    // Plant the hands, unload the knee, extend both legs, THEN lower hips.
    // IK may change branch only at full extension (zero knee offset), not
    // halfway through an ordinary bent leg, which would teleport the knee.
    const peak:Point=[-9,-27],reach=Math.sqrt(34*34-24*24);
    const near:Point=[peak[0]-reach,-3],far:Point=[peak[0]-1-reach,-3];
    const first=t<=.6,k=first?smooth(t/.6):smooth((t-.6)/.4);
    return {hip:lerp(first?a.hip:peak,first?peak:b.hip,k),
      lean:mix(first?a.lean:1.50,first?1.50:b.lean,k),
      nearFoot:lerp(first?a.nearFoot:near,first?near:b.nearFoot,k),
      farFoot:lerp(first?a.farFoot:far,first?far:b.farFoot,k),
      muzzle:lerp(a.muzzle,b.muzzle,t),low:1+t,legBend:first?-1:1};
  }
  return {hip:lerp(a.hip,b.hip,t),lean:mix(a.lean,b.lean,t),nearFoot:lerp(a.nearFoot,b.nearFoot,t),
    farFoot:lerp(a.farFoot,b.farFoot,t),muzzle:lerp(a.muzzle,b.muzzle,t),low:mix(a.low,b.low,t)};
}
export function soldierStance(u:SoldierBody,time?:number):Stance {
  const height=stanceHeightClass(u.pose);
  const travel=height==='crouch'?clamp(u.crouchTravel??(u.moving?1:0)):height==='prone'?clamp(u.proneTravel??0):0;
  const p=time===undefined?u.poseAnimProgress:stanceTransitionProgress(u,time)??undefined;
  if(p!==undefined&&p<1&&u.poseAnimFrom&&u.poseAnimSeen){
    const from=stanceAt(u.poseAnimFrom,u.poseAnimFromTravel??0),to=stanceAt(u.poseAnimSeen,u.poseAnimToTravel??0);
    const full=Math.abs(from.low-to.low)>1;
    // Stand <-> prone traverses a real kneel, with continuous joints at both
    // boundaries. A single torso and fixed bone lengths survive the trip.
    return full ? p<.5?blendStance(from,stanceAt('crouch'),smooth(p*2)):
      blendStance(stanceAt('crouch'),to,smooth((p-.5)*2)) : blendStance(from,to,smooth(p));
  }
  return stanceAt(height,travel);
}
/** Ballistics and the visible weapon use this same muzzle, including escorts. */
export function soldierMuzzle(u:SoldierBody):{x:number;height:number} {
  // Keep established cover clearance and combat balance. Art conforms to
  // the physical barrel instead of changing cover/ballistics to fit art.
  if(soldierWeapon(u)==='mortar')return {x:12,height:30};
  const weapon=infantryWeaponMuzzle({...u,moving:!!u.moving});
  if(weapon)return weapon;
  const rifle=infantryGeometry(u);return {x:rifle.muzzleX,height:rifle.muzzleHeight};
}

/** Two-bone IK with a stable bend sign. The input endpoint is projected onto
 * the reachable annulus rather than stretching art to fit a bad target. */
export function solveLimb(root:Point,target:Point,a:number,b:number,bend=1) {
  let dx=target[0]-root[0],dy=target[1]-root[1];
  const raw=Math.hypot(dx,dy),d=Math.max(Math.abs(a-b)+.001,Math.min(a+b,raw));
  if(raw<1e-6){dx=0;dy=d;}else {dx*=d/raw;dy*=d/raw;}
  const end:Point=[root[0]+dx,root[1]+dy],along=(a*a-b*b+d*d)/(2*d),h=Math.sqrt(Math.max(0,a*a-along*along));
  return {joint:[root[0]+dx/d*along-dy/d*h*bend,root[1]+dy/d*along+dx/d*h*bend] as Point,end};
}
function actionFor(u:SoldierBody,time:number):SoldierAction {
  if((u.hp??1)<=0||u.wounded)return 'casualty';
  if(u.surrendered)return 'surrender';
  if(u.rappelling)return 'rappel';
  if(u.parachuting)return 'parachute';
  if((u.climbing??0)>0)return 'vault';
  if((u.fragThrow??0)>0)return 'throw';
  if(u.draggingUid!==undefined)return 'drag';
  if(magazineReloadActive(u,time))return 'reload';
  const weapon=soldierWeapon(u);
  if((u.launcherCycleRemaining??0)>0)return 'reload';
  if((u.shots??0)>0&&(u.cooldown??0)>.1&&['rocket','manpads','mortar'].includes(weapon))return 'reload';
  if(weapon==='sniper'&&(u.shots??0)>0&&(u.cooldown??0)>.1&&time-(u.lastCombatShotAt??-100)<.7)return 'cycle';
  if(!u.moving){
    if((u.firstAidUntil??0)>time||u.tending&&u.tendingKind==='medical')return 'medical';
    if(u.tending&&u.tendingKind==='repair')return 'repair';
    if(u.digging)return 'dig';
    if((u.overheatedUntil??0)>time)return 'barrel';
    if((u.emplacementSetupUntil??0)>time)return 'deploy';
    if((u.scavengeUntil??0)>time)return 'scavenge';
    if((u.ammoShareUntil??0)>time)return 'share';
    if((u.ammoSignalUntil??0)>time)return 'signal';
    if((u.observingUntil??0)>time)return 'observe';
  }
  return 'ready';
}
export interface SoldierPose {
  appearance:ReturnType<typeof soldierAppearance>;weapon:SoldierWeapon;action:SoldierAction;
  hip:Point;neck:Point;shoulder:Point;head:Point;headAngle:number;
  nearKnee:Point;farKnee:Point;nearFoot:Point;farFoot:Point;
  nearElbow:Point;farElbow:Point;nearHand:Point;farHand:Point;
  muzzle:Point;weaponAngle:number;weaponVisible:boolean;slung:boolean;
  phase:number;travel:number;low:number;prop?:'magazine'|'grenade'|'bandage'|'shovel'|'wrench'|'binoculars';
  /** Anatomical order, never sorted by limb x position or by gait phase. */
  layers:readonly ['farLeg','farArm','backpack','torso','head','nearLeg','weapon','nearArm'];
}
export function soldierPose(u:SoldierBody,time:number):SoldierPose {
  const action=actionFor(u,time),weapon=soldierWeapon(u);
  let stance=soldierStance(u,time),hip=stance.hip,lean=stance.lean;
  const phase=(u.gaitPhase??u.walk??0)*Math.PI/4;
  const travel=clamp(u.gaitWeight??(u.moving?1:0));
  const moving=travel>0.001,run=u.pose==='run'||u.tactic==='retreat';
  let nearFoot=stance.nearFoot,farFoot=stance.farFoot;
  if(moving){
    const stride=stance.low>1.5?8:run?20:stance.low>.5?12:16;
    const foot=(p:number,far:boolean):Point=>{
      const cycle=((p/(Math.PI*2))%1+1)%1;
      // First half is planted contact (constant backwards local velocity).
      // Second half swings forward. The far leg is always half a cycle away.
      const x=cycle<.5?stride*(1-4*cycle):stride*(-1+4*(cycle-.5));
      const lift=cycle<.5?0:Math.sin((cycle-.5)*Math.PI*2)*(run?11:stance.low>1.5?3:6);
      return stance.low>1.5?[hip[0]-29+x*.5,-3-lift]:[x+(far?-1:1),-3-lift];
    };
    nearFoot=lerp(nearFoot,foot(phase,false),travel);farFoot=lerp(farFoot,foot(phase+Math.PI,true),travel);
    hip=add(hip,[0,-Math.abs(Math.sin(phase))*travel*(run?1.5:.65)]);
  }
  if(u.motion==='jump'||u.motion==='land'){
    const jump=u.motion==='jump';
    const p=clamp((u.motionTime??0)/Math.max(.01,u.motionDuration??.6));
    const tuck=jump?Math.sin(p*Math.PI):1-p;
    hip=add(hip,[0,tuck*3]);nearFoot=add(nearFoot,[tuck*9,-tuck*11]);farFoot=add(farFoot,[-tuck*7,-tuck*8]);lean+=tuck*.15;
  }
  if(action==='rappel'||action==='parachute'){
    hip=[-3,-32];lean=.05;nearFoot=[12,-9-Math.sin(time*4)*2];farFoot=[-9,-5+Math.sin(time*4)*2];
  }
  if(action==='casualty'){
    const p=u.wounded?clamp((u.woundedTime??0)/.7):1;
    const fallen=blendStance(stance,stanceAt('prone'),smooth(p));hip=fallen.hip;lean=fallen.lean+.12;
    nearFoot=fallen.nearFoot;farFoot=fallen.farFoot;stance=fallen;
    if(u.crawling&&u.draggedByUid===undefined){
      nearFoot=add(nearFoot,[Math.sin(phase)*5,-Math.max(0,Math.cos(phase))*2]);
      farFoot=add(farFoot,[-Math.sin(phase)*5,-Math.max(0,-Math.cos(phase))*2]);
    }
  }
  const neck:Point=add(hip,[Math.sin(lean)*SOLDIER_BONES.torso,-Math.cos(lean)*SOLDIER_BONES.torso]);
  const shoulder=add(neck,[-1,5]);
  // Aimed head stays approximately upright when the torso lies flat.
  let head=add(neck,[1,2]),headAngle=stance.low>1.5?.10:lean*.2;
  const m=soldierMuzzle({...u,poseAnimProgress:time===undefined?u.poseAnimProgress:stanceTransitionProgress(u,time)??undefined});
  let muzzle:Point=[m.x,-m.height-3],weaponAngle=0,slung=false,weaponVisible=true;
  const width=SOLDIER_WEAPON_SIZE[weapon][0];
  if(action==='ready'&&stance.low<.9&&weapon!=='mortar'&&weapon!=='hmg'){
    const aiming=(u.aimUntil??0)>time||!!u.fire||!!u.secondaryFire;
    const ready=u.fire?1:u.rifleReady??(aiming?smooth((time-(u.readyAt??time-.24))/.24):0);
    weaponAngle=(1-ready)*.24;muzzle=add(muzzle,[-(1-ready)*2,(1-ready)*9]);
  }
  let nearHand:Point=[muzzle[0]-width+10,muzzle[1]+5],farHand:Point=[Math.min(muzzle[0]-11,shoulder[0]+21),muzzle[1]+3];
  let prop:SoldierPose['prop'];
  if(stance.low>1&&stance.low<2&&action==='ready'){
    const support=clamp(Math.sin((stance.low-1)*Math.PI)*2);
    farHand=lerp(farHand,[neck[0]+8,-3],support);
  }
  if(weapon==='mortar'&&!u.moving){nearHand=[11,-21];farHand=[20,-23];}
  if(action==='reload'){
    const start=u.reloadingStartAt??(u.reloadingUntil??time)-1.4;
    const launcher=(u.launcherCycleRemaining??0)>0;
    const heavy=['rocket','manpads','mortar'].includes(weapon)&&!magazineReloadActive(u,time);
    const p=launcher?1-clamp(u.launcherCycleRemaining!/Math.max(.01,u.launcherCycleDuration??1.5)):
      heavy?1-clamp((u.cooldown??0)/Math.max(.1,CARDS[u.id].rate??1)):clamp((time-start)/Math.max(.01,(u.reloadingUntil??time)-start));
    const well:Point=[muzzle[0]-width+15,muzzle[1]+8],pouch=add(hip,[6,-1]);
    farHand=p<.2?lerp(well,pouch,smooth(p/.2)):p<.52?pouch:p<.8?lerp(pouch,well,smooth((p-.52)/.28)):well;
    if(p>.2&&p<.82)prop='magazine';
  }else if(action==='cycle'){
    const p=clamp((time-(u.lastCombatShotAt??time))/.7);
    farHand=[muzzle[0]-width+15-Math.sin(p*Math.PI)*4,muzzle[1]+2];
  }else if(action==='throw'){
    slung=true;const elapsed=grenadeElapsed(u,time),p=elapsed/GRENADE_THROW_S;
    const low=stance.low>1.5,back=add(shoulder,[-12,low?-9:-19]),release=add(shoulder,[19,-12]);
    nearHand=p<.35?lerp(add(hip,[3,-4]),back,smooth(p/.35)):p<.625?lerp(back,release,smooth((p-.35)/.275)):
      lerp(release,add(shoulder,[15,9]),smooth((p-.625)/.375));
    farHand=add(shoulder,[9,13]);if(elapsed<GRENADE_RELEASE_S)prop='grenade';
  }else if(['medical','repair','dig','scavenge','deploy','barrel'].includes(action)){
    slung=true;const p=(u.tendingTime??u.digElapsed??time)*3.6,low=stance.low>1.5;
    const work=add(shoulder,[low?16:12,low?3:17]);
    nearHand=add(work,[Math.sin(p)*3,-Math.cos(p)*3]);farHand=add(work,[-5,1]);
    prop=action==='medical'?'bandage':action==='repair'?'wrench':action==='dig'?'shovel':undefined;
  }else if(action==='share'){
    nearHand=add(shoulder,[22,4]);prop='magazine';
  }else if(action==='signal'){
    nearHand=add(shoulder,[-4,-20]);
  }else if(action==='observe'){
    nearHand=add(head,[9,-7]);farHand=add(head,[13,-6]);prop='binoculars';slung=true;
  }else if(action==='drag'){
    nearHand=add(shoulder,[-16,14]);farHand=add(shoulder,[-19,10]);slung=true;
  }else if(action==='surrender'){
    const p=smooth((u.surrenderTime??0)/.6);nearHand=lerp(nearHand,add(shoulder,[12,-21]),p);
    farHand=lerp(farHand,add(shoulder,[-12,-22]),p);slung=true;
  }else if(action==='rappel'||action==='parachute'||action==='vault'){
    nearHand=add(shoulder,[10,-20]);farHand=add(shoulder,[-5,-19]);slung=true;
  }else if(action==='casualty'){
    nearHand=add(shoulder,[10,5]);farHand=add(shoulder,[16,3]);headAngle=.45;weaponVisible=false;
  }
  if(u.flash&&action!=='casualty')headAngle-=Math.min(.1,u.flash*.3);
  const kneeBend=stance.legBend??(stance.low>1.5?1:-1);
  const nearLeg=solveLimb(hip,nearFoot,17,17,kneeBend),farLeg=solveLimb(add(hip,[-1,0]),farFoot,17,17,kneeBend);
  const nearArm=solveLimb(shoulder,nearHand,12,13,1),farArm=solveLimb(add(shoulder,[1,-1]),farHand,12,13,1);
  return {appearance:soldierAppearance(u),weapon,action,hip,neck,shoulder,head,headAngle,
    nearKnee:nearLeg.joint,farKnee:farLeg.joint,nearFoot:nearLeg.end,farFoot:farLeg.end,
    nearElbow:nearArm.joint,farElbow:farArm.joint,nearHand:nearArm.end,farHand:farArm.end,
    muzzle,weaponAngle,weaponVisible,slung,phase,travel,low:stance.low,prop,
    layers:['farLeg','farArm','backpack','torso','head','nearLeg','weapon','nearArm']};
}

/** Simulation-owned gait; every navigation branch is reconciled once after
 * movement. Backwards travel subtracts phase, never negates a rounded frame.
 */
export function updateSoldierGait(u:Unit,previous:{x:number;lane:number},dt:number,time:number) {
  if(!CARDS[u.id].members)return;
  const dx=u.x-previous.x,dl=u.lane-previous.lane;
  const grounded=['ground','bank'].includes(u.motion)&&!u.rappelling&&!u.parachuting;
  const distance=grounded?Math.hypot(dx,dl):0;
  const moving=distance>1e-5&&u.draggedByUid===undefined&&(u.hp>0||u.crawling);
  const phase=u.gaitPhase??u.walk;
  const sign=Math.abs(dx)>1e-5?Math.sign(dx*(u.facing||1)):1;
  // Teleports/recovery placement are not footsteps; do not flash through a cycle.
  const stride=u.pose==='prone'?4:u.pose==='crouch'||u.pose==='hunker'?6:u.pose==='run'||u.tactic==='retreat'?10:8;
  u.gaitPhase=phase+(moving&&distance<12?sign*distance/stride:0);
  u.gaitWeight=clamp((u.gaitWeight??0)+(moving?1:-1)*dt*7);
  const aim=(u.aimUntil??0)>time||u.fire>0||u.secondaryFire>0;
  u.rifleReady=clamp((u.rifleReady??0)+(aim?1:-1)*dt/.24);
}
