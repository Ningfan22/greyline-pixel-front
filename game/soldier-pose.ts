/** One anatomical model for every soldier and every action. Coordinates are
 * local to the boot anchor, facing right; facing NEVER changes limb identity.
 * No canvases, frame fitting, random sizes or render-time state writes here.
 */
import type {Unit} from './engine';
import {CARDS,weaponModel} from './cards';
import {adultIdentity} from './adult-animation';
import {isPrecisionObserver} from './precision-team';
import {weaponPlacement,weaponSocket,WEAPON_SIGHTS} from './soldier-weapon-rig';
import {runStep} from './soldier-run-cycle';
import {stanceHeightClass,stanceTransitionProgress,magazineReloadActive,
  grenadeElapsed,GRENADE_THROW_S,GRENADE_RELEASE_S} from './infantry-action-timing';

export type Point = readonly [number,number];
export type SoldierBody = Pick<Unit,'id'|'pose'> & Partial<Unit> & {fallVariant?:number};
export type SoldierWeapon = 'rifle'|'lmg'|'hmg'|'rocket'|'manpads'|'sniper'|'grenade'|'mortar'|'flame';
export type SoldierAction = 'ready'|'reload'|'throw'|'medical'|'repair'|'dig'|'drag'|'share'|
  'scavenge'|'signal'|'observe'|'deploy'|'barrel'|'cycle'|'casualty'|'surrender'|'rappel'|'parachute'|'vault';
export const SOLDIER_BONES = {thigh:17,shin:17,torso:22,upperArm:12,forearm:13} as const;
const clamp=(v:number)=>Math.max(0,Math.min(1,v));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const lerp=(a:Point,b:Point,t:number):Point=>[mix(a[0],b[0],t),mix(a[1],b[1],t)];
const add=(a:Point,b:Point):Point=>[a[0]+b[0],a[1]+b[1]];
const rotate=(p:Point,a:number):Point=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
const smooth=(t:number)=>{t=clamp(t);return t*t*(3-2*t);};
const shoulderAt=(hip:Point,neck:Point):Point=>[neck[0]+(hip[0]-neck[0])*.2-1,neck[1]+(hip[1]-neck[1])*.2];
function gaitStep(phase:number,stride:number,height:number):Point {
  const cycle=((phase/(Math.PI*2))%1+1)%1;
  if(cycle<.5)return [stride*(1-4*cycle),0];
  const q=(cycle-.5)*2;
  // Match the planted foot's velocity at lift-off and touchdown, with zero
  // vertical velocity at contact. No triangle-wave reversal or stamping.
  return [-stride+2*stride*(-q+6*q*q-4*q*q*q),height*Math.sin(Math.PI*q)**2];
}
/** A sprint/crawl owns the body and hands until the actor settles to fire. */
export function soldierBusyMoving(u:SoldierBody) {
  const travel=clamp(u.gaitWeight??(u.moving?1:0)),height=stanceHeightClass(u.pose);
  if(u.moving&&(u.pose==='run'||u.tactic==='retreat'||height==='prone'))return true;
  return travel>.08&&((u.gaitRun??(u.pose==='run'||u.tactic==='retreat'?1:0))>.08||height==='prone');
}
export function soldierAimWeight(u:SoldierBody,_time?:number) {
  if(soldierBusyMoving(u)||u.rappelling||u.parachuting||u.wounded||u.surrendered)return 0;
  if(u.fire||u.secondaryFire)return 1;
  if(u.rifleReady!==undefined)return clamp(u.rifleReady);
  // The simulation fades rifleReady from aimUntil. Rendering and ballistics
  // must read that same state, including a newly spawned unraised weapon.
  return 0;
}
export function soldierSupportFraction(u:SoldierBody,low=stanceHeightClass(u.pose)==='prone'?2:stanceHeightClass(u.pose)==='crouch'?1:0) {
  const run=clamp(u.gaitRun??(u.pose==='run'||u.tactic==='retreat'?1:0))*(1-clamp(low*2));
  return .5-.12*run;
}
export function soldierFootPlanted(u:SoldierBody,far=false) {
  const cycle=(((u.gaitPhase??u.walk??0)/8+(far?.5:0))%1+1)%1;
  return cycle<soldierSupportFraction(u);
}

export function soldierAppearance(u: Pick<Unit,'id'>) {
  return {identity:adultIdentity(u.id),uniform:CARDS[u.id].uniform??'infantry'};
}
export function soldierEyeOffset(u:Pick<Unit,'id'>):Point {
  const id=adultIdentity(u.id);
  return id==='police'?[5,-5.5]:id==='militia'?[5,-6.5]:[4.5,-6.5];
}
export const SHOVEL_GRIPS={top:[4,2],shaft:[4,12],tip:[4,26]} as const;
export function diggingTool(elapsed:number) {
  const cycle=((elapsed/2.4)%1+1)%1;
  const frames=[{t:0,tip:[18,-12],a:-.2},{t:.26,tip:[18,-1],a:-.35},
    {t:.42,tip:[18,-1],a:-.6},{t:.66,tip:[21,-11],a:-.8},
    {t:.79,tip:[28,-15],a:-1.1},{t:1,tip:[18,-12],a:-.2}];
  const i=frames.findIndex((v,i)=>i>0&&cycle<=v.t),a=frames[i-1],b=frames[i];
  const p=smooth((cycle-a.t)/(b.t-a.t)),angle=mix(a.a,b.a,p);
  const tip=add(lerp(a.tip as unknown as Point,b.tip as unknown as Point,p),[7,0]),offset=rotate(SHOVEL_GRIPS.tip,angle);
  const origin:Point=[tip[0]-offset[0],tip[1]-offset[1]];
  return {origin,angle,tip,top:weaponSocket(origin,angle,SHOVEL_GRIPS.top),shaft:weaponSocket(origin,angle,SHOVEL_GRIPS.shaft)};
}
/** Stable selection survives a wreck handoff because wrecks retain uid. */
export function soldierFallVariant(u:SoldierBody) {
  return u.soldierCrawled||u.crawling?0:Math.abs(u.fallVariant??u.uid??u.member??0)%4;
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
  if(pose==='prone')return {hip:[-17,-11],lean:1.44,nearFoot:[-49.74,-3],farFoot:[-50.8,-3.5],muzzle:[43,-10-travel*2],low:2,legBend:-1};
  if(pose==='crouch')return {hip:[-5,-17-travel*7],lean:.28,nearFoot:[17,-3],farFoot:[-16,-3],muzzle:[30,-33-travel*7],low:1};
  return {hip:[-2,-33],lean:.06,nearFoot:[7,-3],farFoot:[-7,-3],muzzle:[31,-50],low:0};
}
function fallenStance(variant:number):Stance {
  const states:Array<Omit<Stance,'muzzle'|'low'>>=[
    {hip:[19,-9],lean:1.50,nearFoot:[-13.8,-3],farFoot:[-14.5,-3.5],legBend:-1},
    {hip:[-15,-9],lean:-1.46,nearFoot:[17,-3],farFoot:[14,-4],legBend:-1},
    {hip:[7,-10],lean:1.65,nearFoot:[-24,-3],farFoot:[-12,-4],legBend:1},
    {hip:[-5,-7],lean:-1.30,nearFoot:[12,-7],farFoot:[8,-9],legBend:-1},
  ];
  return {...states[variant],muzzle:[0,0],low:2};
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
      muzzle:lerp(a.muzzle,b.muzzle,t),low:1+t,legBend:-1};
  }
  return {hip:lerp(a.hip,b.hip,t),lean:mix(a.lean,b.lean,t),nearFoot:lerp(a.nearFoot,b.nearFoot,t),
    farFoot:lerp(a.farFoot,b.farFoot,t),muzzle:lerp(a.muzzle,b.muzzle,t),low:mix(a.low,b.low,t),legBend:t<.5?a.legBend:b.legBend};
}
export function soldierStance(u:SoldierBody,time?:number,settled=false):Stance {
  const height=stanceHeightClass(u.pose);
  const travel=height==='crouch'?clamp(u.crouchTravel??(!settled&&u.moving?1:0)):height==='prone'?clamp(u.proneTravel??0):0;
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
/** Ballistics uses the same shoulder and weapon sockets as the visible rig.
 * No image decoding, old atlas landmarks or recursive pose evaluation. */
export function soldierMuzzle(u:SoldierBody,settled=false):{x:number;height:number} {
  // Eligibility uses exactly the raised, stationary body without copying all
  // combat/logistics fields. The visible/committed muzzle keeps its live gait.
  const body=soldierBodyPose(u,undefined,'ready',settled),gun=mountedWeapon(u,body,undefined,settled);
  return {x:gun.muzzle[0],height:-gun.muzzle[1]-3};
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
/** Keep the canonical anatomy while fitting each boot to its own terrain
 * sample. The gun muzzle remains the authoritative ballistic location. */
function groundSoldierBody(p:SoldierBodyPose,contact:Unit['soldierGround']):SoldierBodyPose {
  if(!contact||contact.weight<=0)return p;
  // Kneel/prone rolls through a fully extended leg. Release ground shaping
  // smoothly around that instant so an IK branch cannot flip a bent knee.
  const weight=contact.weight*smooth(Math.abs(p.low-1.6)/.35);
  const near:Point=add(p.nearFoot,[0,contact.near*weight]);
  const far:Point=add(p.farFoot,[0,contact.far*weight]);
  const reach=(dx:number)=>Math.sqrt(Math.max(0,34*34-dx*dx));
  const nr=reach(near[0]-p.hip[0]),fr=reach(far[0]-p.hip[0]+1);
  const lo=Math.max(near[1]-nr,far[1]-fr),hi=Math.min(near[1]+nr,far[1]+fr);
  const y=Math.max(lo,Math.min(hi,p.hip[1]+(contact.hip??0)*weight)),shift:Point=[0,y-p.hip[1]];
  const bend=(root:Point,joint:Point,end:Point)=>
    ((end[0]-root[0])*(joint[1]-root[1])-(end[1]-root[1])*(joint[0]-root[0]))<0?-1:1;
  const hip=add(p.hip,shift),farHip=add(hip,[-1,0]);
  const nl=solveLimb(hip,near,17,17,bend(p.hip,p.nearKnee,p.nearFoot));
  const fl=solveLimb(farHip,far,17,17,bend(add(p.hip,[-1,0]),p.farKnee,p.farFoot));
  return {...p,hip,neck:add(p.neck,shift),shoulder:add(p.shoulder,shift),head:add(p.head,shift),
    nearKnee:nl.joint,nearFoot:nl.end,farKnee:fl.joint,farFoot:fl.end};
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
    if(!u.fire&&!u.secondaryFire&&(u.aimUntil??0)<=time&&
      ((u.calloutUntil??0)>time||(u.pointUntil??0)>time))return 'signal';
    if((u.observingUntil??0)>time)return 'observe';
  }
  return 'ready';
}
export interface SoldierPose {
  appearance:ReturnType<typeof soldierAppearance>;weapon:SoldierWeapon;action:SoldierAction;
  hip:Point;neck:Point;shoulder:Point;head:Point;headAngle:number;
  nearKnee:Point;farKnee:Point;nearFoot:Point;farFoot:Point;
  nearElbow:Point;farElbow:Point;nearHand:Point;farHand:Point;
  muzzle:Point;weaponOrigin:Point;weaponAngle:number;weaponCarry:number;weaponVisible:boolean;slung:boolean;
  phase:number;travel:number;low:number;
  prop?:'magazine'|'grenade'|'bandage'|'shovel'|'wrench'|'binoculars'|'rocketRound'|'mortarRound'|'belt'|'shell';
  propHand:'near'|'far';
  toolOrigin?:Point;toolAngle?:number;
  nearHandShape?:'open'|'relaxed';farHandShape?:'open'|'relaxed';
  hideFarArm?:boolean;
  nearFootAngle?:number;farFootAngle?:number;
  /** Anatomical order, never sorted by limb x position or by gait phase. */
  layers:readonly ['farLeg','farArm','backpack','torso','head','nearLeg','weapon','nearArm'];
}
export interface SoldierTurn {
  at:number;duration:number;progress?:number;hip:Point;angles:number[];targets:number[];initialTargets:number[];head:Point;headAngle:number;bottom:number;
}
const boneAngle=(root:Point,end:Point)=>Math.atan2(end[1]-root[1],end[0]-root[0]);
const angleDelta=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b));
const legAngles=(p:SoldierPose)=>[
  boneAngle(p.hip,p.neck),boneAngle(p.hip,p.nearKnee),boneAngle(p.nearKnee,p.nearFoot),
  boneAngle(add(p.hip,[-1,0]),p.farKnee),boneAngle(p.farKnee,p.farFoot),
];
/** Rebase the last visible anatomy into the new facing. Keep the same legs
 * and use additive bone-angle offsets so the gait can keep advancing while
 * turning; a moving target must not change a shortest-rotation branch. */
export function beginSoldierTurn(u:Unit,previous:{x:number;y:number;facing:number;pose:SoldierPose},time:number) {
  const current=soldierPose({...u,soldierTurn:undefined},time),old=previous.pose;
  const flip=previous.facing*(u.facing||1),dx=(previous.x-u.x)*(u.facing||1),dy=previous.y-u.y;
  const point=(p:Point,far=false):Point=>[p[0]*flip+dx+(far&&flip<0?-2:0),p[1]+dy];
  const from={...old,hip:point(old.hip),neck:point(old.neck),head:point(old.head),
    nearKnee:point(old.nearKnee),nearFoot:point(old.nearFoot),
    farKnee:point(old.farKnee,true),farFoot:point(old.farFoot,true)};
  const oldAngles=legAngles(from),newAngles=legAngles(current),angles=oldAngles.map((a,i)=>angleDelta(a,newAngles[i]));
  const duration=Math.max(.35,...angles.map(a=>Math.abs(a)*.4));
  u.soldierTurn={at:time,duration,progress:0,angles,targets:newAngles,initialTargets:[...newAngles],hip:[from.hip[0]-current.hip[0],from.hip[1]-current.hip[1]],
    head:[from.head[0]-from.neck[0]-current.head[0]+current.neck[0],from.head[1]-from.neck[1]-current.head[1]+current.neck[1]],
    headAngle:angleDelta(old.headAngle*flip,current.headAngle),bottom:Math.max(from.nearFoot[1],from.farFoot[1])};
}
/** Unwrap target rotations in simulation. A simultaneous stance change can
 * cross atan2's +/-PI seam; reselecting a shortest arc during the turn snaps
 * a whole shin across the body. Canvas reads remain pure. */
export function updateSoldierTurn(u:Unit,time:number) {
  const turn=u.soldierTurn;if(!turn)return;
  turn.progress=clamp((time-turn.at)/turn.duration);
  const targets=legAngles(soldierPose({...u,soldierTurn:undefined},time));
  turn.targets=targets.map((a,i)=>turn.targets[i]+angleDelta(a,turn.targets[i]));
}
function turnSoldierBody(p:SoldierBodyPose,u:SoldierBody,time?:number):SoldierBodyPose {
  const turn=u.soldierTurn;if(!turn||u.wounded||u.surrendered)return p;
  const t=smooth(time===undefined?turn.progress??0:(time-turn.at)/turn.duration),weight=1-t;if(weight===0)return p;
  // Fade the new gait in as the body turns. Adding a full-strength live gait
  // to the old facing offset can fold a walking shin above its own pelvis.
  const angles=turn.targets.map((a,i)=>a*t+(turn.initialTargets[i]+turn.angles[i])*weight);
  const bone=(root:Point,a:number,length:number):Point=>add(root,[Math.cos(a)*length,Math.sin(a)*length]);
  let hip=add(p.hip,[turn.hip[0]*weight,turn.hip[1]*weight]);
  let neck=bone(hip,angles[0],22),nearKnee=bone(hip,angles[1],17),nearFoot=bone(nearKnee,angles[2],17),
    farKnee=bone(add(hip,[-1,0]),angles[3],17),farFoot=bone(farKnee,angles[4],17);
  const plane=mix(turn.bottom,Math.max(p.nearFoot[1],p.farFoot[1]),t);
  const lift=['ground','bank','land'].includes(u.motion??'ground')?Math.max(0,nearFoot[1]-plane,farFoot[1]-plane):0;
  if(lift){hip=add(hip,[0,-lift]);neck=add(neck,[0,-lift]);nearKnee=add(nearKnee,[0,-lift]);
    farKnee=add(farKnee,[0,-lift]);nearFoot=add(nearFoot,[0,-lift]);farFoot=add(farFoot,[0,-lift]);}
  const shoulder=shoulderAt(hip,neck);
  return {...p,hip,neck,shoulder,head:add(neck,[p.head[0]-p.neck[0]+turn.head[0]*weight,p.head[1]-p.neck[1]+turn.head[1]*weight]),
    headAngle:p.headAngle+turn.headAngle*weight,nearKnee,nearFoot,farKnee,farFoot};
}
/** Interpolate bone angles, not joint positions: a fall/recovery must keep
 * every limb's length and must begin at the exact last live pose. */
export function blendSoldierPose(from:SoldierPose,to:SoldierPose,progress:number,plantFeet=true):SoldierPose {
  const t=smooth(progress);if(t===0)return from;if(t===1)return to;
  const angle=(a:number,b:number)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
  const bone=(root:Point,oldRoot:Point,oldEnd:Point,newRoot:Point,newEnd:Point,length:number):Point=>{
    const a=angle(Math.atan2(oldEnd[1]-oldRoot[1],oldEnd[0]-oldRoot[0]),Math.atan2(newEnd[1]-newRoot[1],newEnd[0]-newRoot[0]));
    return add(root,[Math.cos(a)*length,Math.sin(a)*length]);
  };
  const hip=lerp(from.hip,to.hip,t),neck=bone(hip,from.hip,from.neck,to.hip,to.neck,22),shoulder=shoulderAt(hip,neck);
  const nearKnee=bone(hip,from.hip,from.nearKnee,to.hip,to.nearKnee,17),
    farKnee=bone(add(hip,[-1,0]),add(from.hip,[-1,0]),from.farKnee,add(to.hip,[-1,0]),to.farKnee,17);
  const nearFoot=bone(nearKnee,from.nearKnee,from.nearFoot,to.nearKnee,to.nearFoot,17),
    farFoot=bone(farKnee,from.farKnee,from.farFoot,to.farKnee,to.farFoot,17);
  const nearElbow=bone(shoulder,from.shoulder,from.nearElbow,to.shoulder,to.nearElbow,12),
    farElbow=bone(add(shoulder,[1,-1]),add(from.shoulder,[1,-1]),from.farElbow,add(to.shoulder,[1,-1]),to.farElbow,12);
  const nearHand=bone(nearElbow,from.nearElbow,from.nearHand,to.nearElbow,to.nearHand,13),
    farHand=bone(farElbow,from.farElbow,from.farHand,to.farElbow,to.farHand,13);
  const head=add(neck,lerp([from.head[0]-from.neck[0],from.head[1]-from.neck[1]],
    [to.head[0]-to.neck[0],to.head[1]-to.neck[1]],t));
  const result={...to,hip,neck,shoulder,head,nearKnee,farKnee,nearFoot,farFoot,nearElbow,farElbow,nearHand,farHand,
    headAngle:angle(from.headAngle,to.headAngle),muzzle:lerp(from.muzzle,to.muzzle,t),
    weaponAngle:angle(from.weaponAngle,to.weaponAngle),weaponOrigin:lerp(from.weaponOrigin,to.weaponOrigin,t),
    weaponCarry:mix(from.weaponCarry,to.weaponCarry,t),
    nearFootAngle:angle(from.nearFootAngle??0,to.nearFootAngle??0),farFootAngle:angle(from.farFootAngle??0,to.farFootAngle??0),
    weaponVisible:t<.25?from.weaponVisible:to.weaponVisible,slung:t<.25?from.slung:to.slung};
  // A rotating shin can otherwise cross the floor and disappear below the
  // sprite's boot anchor. Resolve contact by lifting the entire skeleton,
  // never by cutting off/stretching a leg or reassigning its identity.
  const plane=Math.max(-3,mix(Math.max(from.nearFoot[1],from.farFoot[1]),Math.max(to.nearFoot[1],to.farFoot[1]),t));
  const lift=plantFeet?Math.max(0,nearFoot[1]-plane,farFoot[1]-plane):0;
  if(lift>0)for(const key of ['hip','neck','shoulder','head','nearKnee','farKnee','nearFoot','farFoot',
    'nearElbow','farElbow','nearHand','farHand','muzzle','weaponOrigin'] as const)result[key]=add(result[key],[0,-lift]);
  return result;
}
const bodyPoints=['hip','neck','shoulder','head','nearKnee','farKnee','nearFoot','farFoot',
  'nearElbow','farElbow','nearHand','farHand','muzzle','weaponOrigin'] as const;
function translateBody(p:SoldierPose,offset:Point) {
  const out={...p};for(const key of bodyPoints)out[key]=add(p[key],offset);return out;
}
export function soldierBodyBottom(p:SoldierPose) {
  const partBottom=(at:Point,angle:number,x0:number,y0:number,x1:number,y1:number)=>
    Math.max(...[[x0,y0],[x1,y0],[x0,y1],[x1,y1]].map(v=>at[1]+rotate(v as unknown as Point,angle)[1]));
  return Math.max(p.hip[1]+4,p.shoulder[1]+3,p.nearKnee[1]+3,p.farKnee[1]+3,
    p.nearElbow[1]+2,p.farElbow[1]+2,p.nearHand[1]+2,p.farHand[1]+2,
    partBottom(p.head,p.headAngle,-6,-13,8,1),
    partBottom(p.nearFoot,p.nearFootAngle??0,-4,-2,7,3),partBottom(p.farFoot,p.farFootAngle??0,-4,-2,7,3));
}
/** Authored joint chains in side view. Knees flex toward the front of the
 * body; relaxed arms stay in front of the chest, never behind the neck. */
function restingFallPose(p:SoldierPose,variant:number):SoldierPose {
  const specs=[
    {lean:1.48,legs:[[2.94,.25],[2.88,.35]],arms:[[.85,-1.10],[.70,-.85]],nod:.08},
    {lean:-1.45,legs:[[-.30,.58],[-.42,.78]],arms:[[.45,-1.20],[.65,-1.35]],nod:-.08},
    {lean:1.16,legs:[[2.52,.70],[3.08,.45]],arms:[[.98,-1.35],[.52,-1.0]],nod:.03},
    {lean:-1.30,legs:[[-1.55,2.15],[-1.80,2.30]],arms:[[.10,-1.70],[.45,-1.60]],nod:.12},
  ][variant];
  const bone=(root:Point,a:number,length:number):Point=>add(root,[Math.cos(a)*length,Math.sin(a)*length]);
  const hip=p.hip,neck=bone(hip,specs.lean-Math.PI/2,22),shoulder=shoulderAt(hip,neck);
  const out={...p,hip,neck,shoulder,head:add(neck,rotate([1,1],specs.lean)),
    headAngle:specs.lean+specs.nod,nearHandShape:undefined,farHandShape:undefined};
  for(const [i,side]of (['near','far'] as const).entries()){
    const [thigh,knee]=specs.legs[i],[upper,elbow]=specs.arms[i];
    out[`${side}Knee`]=bone(add(hip,[i?-1:0,0]),thigh,17);
    out[`${side}Foot`]=bone(out[`${side}Knee`],thigh+knee,17);
    out[`${side}FootAngle`]=thigh+knee;
    out[`${side}Elbow`]=bone(add(shoulder,[i?1:0,i?-1:0]),upper,12);
    out[`${side}Hand`]=bone(out[`${side}Elbow`],upper+elbow,13);
  }
  return out;
}
/** Interpolate parents and signed joint flexion, never two independent
 * world-space bone rotations. This preserves which way a knee/elbow bends. */
function fallChainBlend(from:SoldierPose,to:SoldierPose,t:number):SoldierPose {
  const bone=(root:Point,a:number,length:number):Point=>add(root,[Math.cos(a)*length,Math.sin(a)*length]);
  const fromLean=boneAngle(from.hip,from.neck)+Math.PI/2,toLean=boneAngle(to.hip,to.neck)+Math.PI/2;
  const blendAngle=(a:number,b:number)=>a+angleDelta(b,a)*t;
  const lean=blendAngle(fromLean,toLean),hip=lerp(from.hip,to.hip,t);
  // A small release arc separates the feet from the ground without turning
  // the fall into a jump. Ground contact below can be a hand, hip or shoulder.
  const raisedHip=add(hip,[0,-Math.sin(t*Math.PI)*4]);
  const neck=bone(raisedHip,lean-Math.PI/2,22),shoulder=shoulderAt(raisedHip,neck);
  const out={...to,hip:raisedHip,neck,shoulder};
  for(const [i,side]of (['near','far'] as const).entries()){
    const oldHip=add(from.hip,[i?-1:0,0]),newHip=add(to.hip,[i?-1:0,0]);
    const af=boneAngle(oldHip,from[`${side}Knee`]),at=boneAngle(newHip,to[`${side}Knee`]);
    const kf=angleDelta(boneAngle(from[`${side}Knee`],from[`${side}Foot`]),af);
    const kt=angleDelta(boneAngle(to[`${side}Knee`],to[`${side}Foot`]),at);
    const thigh=lean+blendAngle(angleDelta(af,fromLean),angleDelta(at,toLean));
    const flex=mix(kf,kt,t),shin=thigh+flex;
    out[`${side}Knee`]=bone(add(raisedHip,[i?-1:0,0]),thigh,17);
    out[`${side}Foot`]=bone(out[`${side}Knee`],shin,17);
    const ankleF=angleDelta(from[`${side}FootAngle`]??0,af+kf),ankleT=angleDelta(to[`${side}FootAngle`]??0,at+kt);
    out[`${side}FootAngle`]=shin+mix(ankleF,ankleT,t);
    const oldShoulder=add(from.shoulder,[i?1:0,i?-1:0]),newShoulder=add(to.shoulder,[i?1:0,i?-1:0]);
    const uf=boneAngle(oldShoulder,from[`${side}Elbow`]);
    const ef=angleDelta(boneAngle(from[`${side}Elbow`],from[`${side}Hand`]),uf);
    // A prone support elbow may start on the opposite projection branch.
    // Keep its existing bend while reaching the same relaxed hand target.
    const arm=solveLimb(newShoulder,to[`${side}Hand`],12,13,ef>0?-1:1);
    const ut=boneAngle(newShoulder,arm.joint),et=angleDelta(boneAngle(arm.joint,arm.end),ut);
    const upper=lean+blendAngle(angleDelta(uf,fromLean),angleDelta(ut,toLean));
    out[`${side}Elbow`]=bone(add(shoulder,[i?1:0,i?-1:0]),upper,12);
    out[`${side}Hand`]=bone(out[`${side}Elbow`],upper+mix(ef,et,t),13);
  }
  const headF=rotate([from.head[0]-from.neck[0],from.head[1]-from.neck[1]],-fromLean);
  const headT=rotate([to.head[0]-to.neck[0],to.head[1]-to.neck[1]],-toLean);
  out.head=add(neck,rotate(lerp(headF,headT,t),lean));
  out.headAngle=lean+mix(angleDelta(from.headAngle,fromLean),angleDelta(to.headAngle,toLean),t);
  out.weaponOrigin=lerp(from.weaponOrigin,to.weaponOrigin,t);out.weaponAngle=blendAngle(from.weaponAngle,to.weaponAngle);
  out.weaponVisible=t<.18&&from.weaponVisible;out.slung=from.slung;
  return out;
}
/** Carry the body forward/backward, release the feet, then settle on the
 * surface while retaining the exact hit-frame pose at the start. */
export function fallSoldierPose(from:SoldierPose,target:SoldierPose,progress:number,variant:number) {
  const p=clamp(progress);if(p===0)return from;
  const to=from.low>1.5?translateBody(target,[from.hip[0]+3-target.hip[0],0]):target;
  const result=fallChainBlend(from,to,smooth(p));
  const bottom=soldierBodyBottom(result);
  return bottom>0?translateBody(result,[0,-bottom]):result;
}
type SoldierBodyPose=Pick<SoldierPose,'hip'|'neck'|'shoulder'|'head'|'headAngle'|'nearKnee'|'farKnee'|'nearFoot'|'farFoot'|'phase'|'travel'|'low'>;
export function soldierStride(u:SoldierBody,low=stanceHeightClass(u.pose)==='prone'?2:stanceHeightClass(u.pose)==='crouch'?1:0) {
  const run=clamp(u.gaitRun??(u.pose==='run'||u.tactic==='retreat'?1:0));
  return low>=1?mix(8.5,3.5,smooth(low-1)):mix(12.5+run*.5,8.5,smooth(low));
}
function soldierBodyPose(u:SoldierBody,time?:number,action:SoldierAction='ready',settled=false):SoldierBodyPose {
  const weapon=soldierWeapon(u);
  let stance=soldierStance(u,time,settled),hip=stance.hip,lean=stance.lean;
  const phase=(u.gaitPhase??u.walk??0)*Math.PI/4;
  const travel=settled?0:clamp(u.gaitWeight??(u.moving?1:0));
  const gaitTravel=travel*(stance.low>1&&stance.low<2?smooth(Math.abs(stance.low-1.6)/.35):1);
  const moving=travel>0.001,run=settled?0:clamp(u.gaitRun??(u.pose==='run'||u.tactic==='retreat'?1:0))*(1-clamp(stance.low*2));
  let nearFoot=stance.nearFoot,farFoot=stance.farFoot;
  if(moving){
    // Keep the planted endpoint reachable at the longest stride. Clamping an
    // overextended leg made an ostensibly moving gait slide and hover.
    const stride=soldierStride(u,stance.low);
    const upright=1-clamp(stance.low),rise=Math.sin(phase)**2;
    const beat=((phase/Math.PI)%1+1)%1;
    const knots=[[0,-31],[.28,-29],[.70,-32],[.87,-34],[1,-31]];
    const k=knots.findIndex((v,i)=>i>0&&beat<=v[0]),a=knots[k-1],b=knots[k];
    const runningHip=mix(a[1],b[1],smooth((beat-a[0])/(b[0]-a[0])));
    const walkingHip=hip[1]+.2-2.6*rise;
    hip=[hip[0],mix(hip[1],mix(walkingHip,runningHip,run),travel*upright)];
    lean+=travel*(.04+run*.17)*upright;
    const foot=(p:number,far:boolean):Point=>{
      // First half is planted contact (constant backwards local velocity).
      // Second half swings forward. The far leg is always half a cycle away.
      // Re-time the walk support to the same contact boundary while blending
      // into the run, so an accelerating planted boot does not slide.
      const cycle=((p/(2*Math.PI))%1+1)%1,contact=.5-.12*run;
      const walkPhase=(cycle<contact?cycle/contact*.5:.5+(cycle-contact)/(1-contact)*.5)*2*Math.PI;
      const runPhase=(cycle<contact?cycle/contact*.38:.38+(cycle-contact)/(1-contact)*.62)*2*Math.PI;
      const [x,lift]=lerp(gaitStep(walkPhase,stride,mix(5,3,clamp(stance.low))),runStep(runPhase,stride),run);
      return lerp([x+(far?-1:1),-3-lift],[hip[0]-30.7+x-(far?1:0),-3-lift*.55],smooth(stance.low-1));
    };
    nearFoot=lerp(nearFoot,foot(phase,false),gaitTravel);farFoot=lerp(farFoot,foot(phase+Math.PI,true),gaitTravel);
    if(stance.low>.5&&stance.low<1.5)hip=add(hip,[0,-(Math.sin(phase)**2)*travel*.8]);
  }
  if((u.motion==='jump'||u.motion==='land')&&action!=='casualty'&&action!=='surrender'){
    const jump=u.motion==='jump';
    const p=clamp((u.motionTime??0)/Math.max(.01,u.motionDuration??.6));
    const tuck=jump?Math.sin(p*Math.PI):1-p;
    hip=add(hip,[0,tuck*3]);nearFoot=add(nearFoot,[tuck*9,-tuck*11]);farFoot=add(farFoot,[-tuck*7,-tuck*8]);lean+=tuck*.15;
  }
  if(action==='rappel'){
    hip=[-3,-32];lean=-.08;nearFoot=[4,0];farFoot=[-7,-1];
  }else if(action==='parachute'){
    hip=[-3,-32];lean=.05;nearFoot=[12,-9-Math.sin((time??0)*4)*2];farFoot=[-9,-5+Math.sin((time??0)*4)*2];
  }
  if(action==='casualty'){
    const p=u.soldierFall?1:u.wounded?clamp((u.woundedTime??0)/.7):1;
    const rest=u.soldierCrawled||u.crawling?stanceAt('prone'):fallenStance(soldierFallVariant(u));
    const crawling=(!u.soldierFall||(u.woundedTime??0)>=.7)?travel:0;
    const destination=crawling>0?blendStance(rest,stanceAt('prone'),crawling):rest;
    const fallen=p===1?destination:blendStance(stance,destination,smooth(p));hip=fallen.hip;lean=fallen.lean;
    nearFoot=fallen.nearFoot;farFoot=fallen.farFoot;stance=fallen;
    // Keep the last crawling legs while their displacement weight settles.
    // A medic/drag bond can clear `crawling` in one tick, not the anatomy.
    // The first fall already starts from its saved live legs. Its destination
    // must stay still while the old gait weight drains; otherwise the shortest
    // knee rotation can change sides during the collapse.
    if(travel>0&&(!u.soldierFall||(u.woundedTime??0)>=.7)){
      const near=gaitStep(phase,2.3,1.65),far=gaitStep(phase+Math.PI,2.3,1.65);
      nearFoot=lerp(nearFoot,[hip[0]-30.7+near[0],-3-near[1]],travel);
      farFoot=lerp(farFoot,[hip[0]-31.7+far[0],-3-far[1]],travel);
    }
  }
  if(action==='dig'){
    const cycle=((u.digElapsed??time??0)/2.4)%1,press=Math.sin(Math.PI*clamp(cycle/.8));
    const work=stanceAt('crouch');hip=work.hip;nearFoot=[12,-3];farFoot=work.farFoot;
    lean=.45+press*.16;stance={...work,lean};
  }
  if(action==='surrender'&&stance.low>1){
    const up=blendStance(stance,stanceAt('crouch'),smooth((u.surrenderTime??0)/.65));
    hip=up.hip;lean=up.lean;nearFoot=up.nearFoot;farFoot=up.farFoot;stance=up;
  }
  if((weapon==='mortar'||weapon==='hmg')&&stance.low<1&&!['casualty','surrender','rappel','parachute','vault'].includes(action)){
    const operating=1-smooth(travel),work=stanceAt('crouch');
    hip=lerp(hip,work.hip,operating);lean=mix(lean,weapon==='hmg'?1.25:.34,operating);
    nearFoot=lerp(nearFoot,work.nearFoot,operating);farFoot=lerp(farFoot,work.farFoot,operating);
    stance={...stance,low:mix(stance.low,1,operating),legBend:operating>.5?-1:stance.legBend};
  }
  if(weapon==='hmg'&&stance.low>=1&&stance.low<1.9&&['ready','reload','deploy','barrel','cycle','signal','observe','share'].includes(action))
    lean=mix(lean,1.25,(1-travel)*(1-smooth(stance.low-1)));
  const proneBody=smooth((stance.low-1.65)/.35);
  const crawl=travel*proneBody*(action!=='casualty'||u.soldierCrawled||u.crawling?1:0);
  if(crawl){hip=add(hip,[Math.sin(phase)*1.4*crawl,Math.cos(phase*2)*.4*crawl]);lean+=Math.sin(phase)*.06*crawl;}
  const neck:Point=add(hip,[Math.sin(lean)*SOLDIER_BONES.torso,-Math.cos(lean)*SOLDIER_BONES.torso]);
  const shoulder=shoulderAt(hip,neck);
  const kneeBend=stance.legBend??(stance.low>1.5?1:-1);
  const nearLeg=solveLimb(hip,nearFoot,17,17,kneeBend),farLeg=solveLimb(add(hip,[-1,0]),farFoot,17,17,kneeBend);
  if(proneBody>0&&(action!=='casualty'||u.soldierCrawled||u.crawling)){
    const leg=(root:Point,old:typeof nearLeg,p:number,far:boolean)=>{
      // Low crawl bends toward the ground; feet trail the shins rather than
      // reversing a knee branch or keeping a standing boot under a prone leg.
      const thigh=(far?2.82:2.75)+Math.sin(p)*.075*crawl;
      const knee=add(root,[Math.cos(thigh)*17,Math.sin(thigh)*17]);
      const ankleY=-3.5-(1+Math.sin(p))*1.2*crawl;
      const shin=Math.PI-Math.asin(Math.max(-1,Math.min(1,(ankleY-knee[1])/17)));
      const oldThigh=boneAngle(root,old.joint),oldShin=boneAngle(old.joint,old.end);
      const a=oldThigh+angleDelta(thigh,oldThigh)*proneBody,b=oldShin+angleDelta(shin,oldShin)*proneBody;
      old.joint=add(root,[Math.cos(a)*17,Math.sin(a)*17]);old.end=add(old.joint,[Math.cos(b)*17,Math.sin(b)*17]);
    };
    leg(hip,nearLeg,phase,false);leg(add(hip,[-1,0]),farLeg,phase+Math.PI,true);
  }
  return turnSoldierBody(groundSoldierBody({hip,neck,shoulder,head:add(neck,[1,2]),headAngle:stance.low>1.5?.10:lean*.2,
    nearKnee:nearLeg.joint,farKnee:farLeg.joint,nearFoot:nearLeg.end,farFoot:farLeg.end,
    phase,travel,low:stance.low},u.soldierGround),u,time);
}
function mountedWeapon(u:SoldierBody,body:SoldierBodyPose,time?:number,settled=false){
  const ready=settled?(u.rappelling||u.parachuting||u.wounded||u.surrendered?0:1):soldierAimWeight(u,time);
  const ground=(u.soldierGround?.hip??0)*(u.soldierGround?.weight??0);
  const run=settled?0:body.travel*clamp(u.gaitRun??(u.pose==='run'||u.tactic==='retreat'?1:0))*(1-clamp(body.low));
  return weaponPlacement(soldierWeapon(u),body.shoulder,body.low,body.travel,ready,ground,run);
}
export function soldierPose(u:SoldierBody,time:number):SoldierPose {
  const action=actionFor(u,time),weapon=soldierWeapon(u),body=soldierBodyPose(u,time,action);
  const {hip,neck,shoulder,phase,travel}=body,stance={low:body.low};
  let {head,headAngle}=body;
  const gun=mountedWeapon(u,body,time),muzzle=gun.muzzle,weaponAngle=gun.angle;
  let slung=false,weaponVisible=true;
  let nearHand:Point=gun.trigger,farHand:Point=gun.support;
  let prop:SoldierPose['prop'];
  let propHand:SoldierPose['propHand']='near';
  let toolOrigin:Point|undefined,toolAngle:number|undefined;
  let nearHandShape:SoldierPose['nearHandShape'],farHandShape:SoldierPose['farHandShape'];
  if(stance.low>1&&stance.low<2&&action==='ready'){
    const support=clamp(Math.sin((stance.low-1)*Math.PI)*2);
    farHand=lerp(farHand,[neck[0]+8,-3],support);
  }
  if(action==='reload'){
    const start=u.reloadingStartAt??(u.reloadingUntil??time)-1.4;
    const launcher=(u.launcherCycleRemaining??0)>0;
    const heavy=['rocket','manpads','mortar'].includes(weapon)&&!magazineReloadActive(u,time);
    const p=launcher?1-clamp(u.launcherCycleRemaining!/Math.max(.01,u.launcherCycleDuration??1.5)):
      heavy?1-clamp((u.cooldown??0)/Math.max(.1,CARDS[u.id].rate??1)):clamp((time-start)/Math.max(.01,(u.reloadingUntil??time)-start));
    // Feed each actual weapon at its own loading point. A mortar bomb goes
    // over the tube, an RPG round goes to the rear and belt guns open the feed.
    const tube=weapon==='mortar',rocket=weapon==='rocket'||weapon==='manpads',belt=weapon==='lmg'||weapon==='hmg';
    const well:Point=gun.feed,pouch=add(hip,[6,-1]);
    farHand=p<.2?lerp(well,pouch,smooth(p/.2)):p<.52?pouch:p<.8?lerp(pouch,well,smooth((p-.52)/.28)):well;
    propHand='far';
    if(p>.2&&p<.82)prop=tube?'mortarRound':rocket?'rocketRound':belt?'belt':weapon==='grenade'?'shell':'magazine';
  }else if(action==='cycle'){
    const p=clamp((time-(u.lastCombatShotAt??time))/.7);
    farHand=add(gun.feed,[-Math.sin(p*Math.PI)*4,1]);
  }else if(action==='throw'){
    slung=true;const elapsed=grenadeElapsed(u,time),p=elapsed/GRENADE_THROW_S;
    const low=stance.low>1.5,back=add(shoulder,[-12,low?-9:-19]),release=add(shoulder,[19,-12]);
    nearHand=p<.35?lerp(add(hip,[3,-4]),back,smooth(p/.35)):p<.625?lerp(back,release,smooth((p-.35)/.275)):
      lerp(release,add(shoulder,[15,9]),smooth((p-.625)/.375));
    farHand=add(shoulder,[9,13]);if(elapsed<GRENADE_RELEASE_S)prop='grenade';
  }else if(action==='deploy'||action==='barrel'){
    // Keep the crew's support weapon on the ground while adjusting it.
    const p=(u.emplacementSetupUntil??u.overheatedUntil??time)-time;
    nearHand=gun.trigger;
    farHand=add(action==='barrel'?gun.support:gun.feed,[0,Math.sin(p*5)*2]);
    if(action==='barrel')prop='wrench';
  }else if(action==='dig'){
    slung=true;const tool=diggingTool(u.digElapsed??time);
    const groundShift:Point=[0,hip[1]+17];
    toolOrigin=add(tool.origin,groundShift);toolAngle=tool.angle;
    nearHand=add(tool.top,groundShift);farHand=add(tool.shaft,groundShift);prop='shovel';
    headAngle=.22;
  }else if(['medical','repair','scavenge'].includes(action)){
    slung=true;const p=(u.tendingTime??u.digElapsed??time)*3.6,low=stance.low>1.5;
    const work=add(shoulder,[low?16:12,low?3:17]);
    nearHand=add(work,[Math.sin(p)*3,-Math.cos(p)*3]);farHand=add(work,[-5,1]);
    prop=action==='medical'?'bandage':action==='repair'?'wrench':undefined;
  }else if(action==='share'){
    nearHand=add(shoulder,[22,4]);prop='magazine';
  }else if(action==='signal'){
    const point=(u.pointUntil??0)>time,dir=(u.pointDir??u.calloutDir??u.facing??1)*(u.facing??1);
    nearHand=add(shoulder,point?[dir*21,-6]:[-4+Math.sin(time*7)*3,-20]);
  }else if(action==='observe'){
    nearHand=add(head,[9,-7]);farHand=add(head,[13,-6]);prop='binoculars';slung=true;
  }else if(action==='drag'){
    nearHand=add(shoulder,[-16,14]);farHand=add(shoulder,[-19,10]);slung=true;
  }else if(action==='surrender'){
    const p=smooth((u.surrenderTime??0)/.6);nearHand=lerp(nearHand,add(shoulder,[14,-16]),p);
    farHand=lerp(farHand,add(shoulder,[13,-16]),p);slung=true;
    nearHandShape='open';farHandShape='open';
  }else if(action==='rappel'){
    nearHand=add(shoulder,[7,15]);farHand=add(shoulder,[2,-20]);slung=true;
  }else if(action==='parachute'||action==='vault'){
    nearHand=add(shoulder,[10,-20]);farHand=add(shoulder,[-5,-19]);slung=true;
  }else if(action==='casualty'){
    const variant=soldierFallVariant(u),arms:Point[][]=[[[17,5],[22,3]],[[18,4],[-19,3]],
      [[6,5],[19,3]],[[0,6],[12,3]]];
    nearHand=add(shoulder,arms[variant][0]);farHand=add(shoulder,arms[variant][1]);
    nearHand=[nearHand[0],Math.min(-3,nearHand[1])];farHand=[farHand[0],Math.min(-3,farHand[1])];
    headAngle=[.48,-1.05,.8,1.12][variant];weaponVisible=false;
    nearHandShape='relaxed';farHandShape='relaxed';
  }
  if(action==='ready'&&!u.moving&&travel<.01&&!u.fire&&!u.secondaryFire&&(u.aimUntil??0)<=time&&
    (u.suppression??0)<.4&&stanceTransitionProgress(u,time)===null){
    // Preserve alert/idle feedback without ever flipping the torso or legs.
    const end=(u.blastGlanceUntil??0)>time?u.blastGlanceUntil!:
      (u.traceGlanceUntil??0)>time?u.traceGlanceUntil!:
      u.heardContactAt!==undefined&&time-u.heardContactAt<.7?u.heardContactAt+.7:0;
    const glance=end?Math.sin(Math.min(1,end-time)*Math.PI):Math.sin(time*1.3+(u.uid??0))*.25;
    headAngle-=glance*.18;head=add(head,[-glance*1.5,0]);
  }
  if(u.flash&&action!=='casualty')headAngle-=Math.min(.1,u.flash*.3);
  if(action==='ready'&&weapon!=='mortar'){
    // The eye follows the rear sight with eye relief. Standing tucks the
    // cheek down; prone raises the chin. The stock stays in its shoulder.
    const eyeLocal=soldierEyeOffset(u),sight=WEAPON_SIGHTS[weapon];
    const aim=soldierAimWeight(u,time)*(weapon==='hmg'?1-smooth(gun.carry*3):1);
    const target=weaponSocket(gun.origin,gun.angle,[sight.rear[0]-sight.relief,sight.rear[1]]);
    const eye=rotate(eyeLocal,headAngle);
    head=lerp(head,[target[0]-eye[0],target[1]-eye[1]],aim);
  }
  // Keep prone elbows above the floor. The shoulder-mounted sockets are
  // reachable by construction; IK now bends arms instead of moving hands off guns.
  const arm=(root:Point,hand:Point,far=false)=>{
    const down=solveLimb(root,hand,12,13,action==='surrender'&&far?-1:1);
    if(stance.low>1.5&&down.joint[1]>-2)return solveLimb(root,hand,12,13,-1);
    return down;
  };
  const nearArm=arm(shoulder,nearHand),farArm=arm(add(shoulder,[1,-1]),farHand,true);
  if(action==='ready'&&stance.low>1.65&&travel>0){
    const weight=travel*smooth((stance.low-1.65)/.35),root=add(shoulder,[1,-1]);
    const upper=.83+.12*Math.sin(phase+Math.PI),lower=-.25+.18*Math.sin(phase);
    const a=boneAngle(root,farArm.joint),b=boneAngle(farArm.joint,farArm.end);
    const elbowAngle=a+angleDelta(upper,a)*weight,handAngle=b+angleDelta(lower,b)*weight;
    farArm.joint=add(root,[Math.cos(elbowAngle)*12,Math.sin(elbowAngle)*12]);
    farArm.end=add(farArm.joint,[Math.cos(handAngle)*13,Math.sin(handAngle)*13]);
  }
  const ankle=(knee:Point,foot:Point)=>{
    const a=boneAngle(knee,foot);return a<0?a+2*Math.PI:a;
  };
  const footWeight=smooth(stance.low-1);
  const nearFootAngle=action==='rappel'?1.0:action==='casualty'?ankle(body.nearKnee,body.nearFoot):footWeight?ankle(body.nearKnee,body.nearFoot)*footWeight:undefined;
  const farFootAngle=action==='rappel'?.85:action==='casualty'?ankle(body.farKnee,body.farFoot):footWeight?ankle(body.farKnee,body.farFoot)*footWeight:undefined;
  let result:SoldierPose={...body,appearance:soldierAppearance(u),weapon,action,head,headAngle,
    nearElbow:nearArm.joint,farElbow:farArm.joint,nearHand:nearArm.end,farHand:farArm.end,
    muzzle,weaponOrigin:gun.origin,weaponAngle,weaponCarry:gun.carry,weaponVisible,slung,prop,propHand,
    toolOrigin,toolAngle,nearHandShape,farHandShape,
    hideFarArm:action==='surrender',nearFootAngle,farFootAngle,
    layers:['farLeg','farArm','backpack','torso','head','nearLeg','weapon','nearArm']};
  if(action==='casualty'&&!u.soldierCrawled&&!u.crawling)result=restingFallPose(result,soldierFallVariant(u));
  if(action==='casualty'&&u.soldierCrawlStart&&time-u.soldierCrawlStart.at<.5)
    return blendSoldierPose(u.soldierCrawlStart.pose,result,(time-u.soldierCrawlStart.at)/.5);
  if(action==='casualty'&&u.soldierFall)return fallSoldierPose(u.soldierFall,result,(u.woundedTime??0)/.7,soldierFallVariant(u));
  if(action==='surrender'&&u.soldierSurrender&&time-u.soldierSurrender.at<.45)
    return blendSoldierPose(u.soldierSurrender.pose,result,(time-u.soldierSurrender.at)/.45);
  let continuous=result;
  if(action!=='casualty'&&u.soldierRise&&time-u.soldierRise.at<(u.soldierRise.duration??.35))
    continuous=blendSoldierPose(u.soldierRise.pose,result,(time-u.soldierRise.at)/(u.soldierRise.duration??.35));
  else if(action!=='casualty'&&u.soldierLanding&&time-u.soldierLanding.at<u.soldierLanding.duration)
    continuous=blendSoldierPose(u.soldierLanding.pose,result,(time-u.soldierLanding.at)/u.soldierLanding.duration);
  return continuous;
}

/** Terrain sampling belongs to simulation, not canvas draws. No horizontal
 * repositioning, damage, visibility or aiming rules are changed. */
export function updateSoldierGround(u:Unit,floor:(x:number)=>number,time:number,dt:number) {
  const old=u.soldierGround;
  // A fall already owns its last live skeleton; do not move its destination
  // while the body is rotating into it (the same rule as residual gait).
  if(u.soldierFall&&u.wounded&&u.woundedTime<.7)return;
  const grounded=['ground','bank','land'].includes(u.motion)&&!u.rappelling&&!u.parachuting&&u.climbing<=0;
  if(!grounded){
    if(old){old.weight=clamp(old.weight-dt/.12);if(old.weight===0)u.soldierGround=undefined;}
    return;
  }
  const p=soldierPose({...u,soldierGround:undefined,soldierTurn:undefined},time),facing=u.facing||1;
  const near=floor(u.x+p.nearFoot[0]*facing)-u.y,far=floor(u.x+p.farFoot[0]*facing)-u.y;
  const hip=floor(u.x+p.hip[0]*facing)-u.y;
  // At sprint speed a swinging foot crosses sloped ground faster than a
  // fixed 30px/s filter can follow. Track the body's terrain displacement
  // as well, while retaining smoothing at abrupt crater edges.
  const rise=Math.abs((old?.y??u.y)-u.y);
  const followStep=dt*30+(rise<=dt*65?rise*3:0);
  const follow=(before:number|undefined,target:number)=>{
    const start=before===undefined?target:before+(old!.y-u.y);
    return start+Math.max(-followStep,Math.min(followStep,target-start));
  };
  u.soldierGround={near:follow(old?.near,near),far:follow(old?.far,far),hip:follow(old?.hip,hip),
    weight:clamp((old?.weight??0)+dt/.12),y:u.y};
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
  if(u.wounded&&!u.soldierCrawled&&(u.crawling||(u.woundedTime>=.7&&(u.gaitWeight??0)>.01))){
    if(u.crawling&&(u.gaitWeight??0)<.1)
      u.soldierCrawlStart={at:time,pose:soldierPose({...u,crawling:false,gaitWeight:0},time)};
    u.soldierCrawled=true;
  }
  const phase=u.gaitPhase??u.walk;
  const sign=Math.abs(dx)>1e-5?Math.sign(dx*(u.facing||1)):1;
  const running=u.pose==='run'||u.tactic==='retreat'?1:0;
  const oldRun=u.gaitRun??running;
  u.gaitRun=oldRun+Math.max(-dt*6,Math.min(dt*6,running-oldRun));
  // Teleports/recovery placement are not footsteps; do not flash through a cycle.
  const stride=soldierStride(u)/(4*soldierSupportFraction(u));
  u.gaitPhase=phase+(moving&&distance<12?sign*distance/stride:0);
  const settle=!u.wounded&&['hmg','mortar'].includes(soldierWeapon(u))?6:7;
  u.gaitWeight=clamp((u.gaitWeight??0)+(moving?dt*7:-dt*settle));
  const aim=!soldierBusyMoving(u)&&((u.aimUntil??0)>time||u.fire>0||u.secondaryFire>0);
  u.rifleReady=clamp((u.rifleReady??0)+(aim?1:-1)*dt/.24);
}
