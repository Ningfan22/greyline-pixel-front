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
const rotate=(p:Point,a:number):Point=>[p[0]*Math.cos(a)-p[1]*Math.sin(a),p[0]*Math.sin(a)+p[1]*Math.cos(a)];
const smooth=(t:number)=>{t=clamp(t);return t*t*(3-2*t);};
function gaitStep(phase:number,stride:number,height:number):Point {
  const cycle=((phase/(Math.PI*2))%1+1)%1;
  return [cycle<.5?stride*(1-4*cycle):stride*(-1+4*(cycle-.5)),
    cycle<.5?0:Math.sin((cycle-.5)*Math.PI*2)*height];
}

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
/** Keep the canonical anatomy while fitting each boot to its own terrain
 * sample. The gun muzzle remains the authoritative ballistic location. */
function groundSoldierPose(p:SoldierPose,contact:Unit['soldierGround']):SoldierPose {
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
  const shoulder=add(p.shoulder,shift),farShoulder=add(shoulder,[1,-1]);
  const na=solveLimb(shoulder,p.nearHand,12,13,bend(p.shoulder,p.nearElbow,p.nearHand));
  const fa=solveLimb(farShoulder,p.farHand,12,13,bend(add(p.shoulder,[1,-1]),p.farElbow,p.farHand));
  return {...p,hip,neck:add(p.neck,shift),shoulder,head:add(p.head,shift),
    nearKnee:nl.joint,nearFoot:nl.end,farKnee:fl.joint,farFoot:fl.end,
    nearElbow:na.joint,nearHand:na.end,farElbow:fa.joint,farHand:fa.end};
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
  muzzle:Point;weaponAngle:number;weaponVisible:boolean;slung:boolean;
  phase:number;travel:number;low:number;
  prop?:'magazine'|'grenade'|'bandage'|'shovel'|'wrench'|'binoculars'|'rocketRound'|'mortarRound'|'belt'|'shell';
  propHand:'near'|'far';
  /** Anatomical order, never sorted by limb x position or by gait phase. */
  layers:readonly ['farLeg','farArm','backpack','torso','head','nearLeg','weapon','nearArm'];
}
export interface SoldierTurn {
  at:number;duration:number;hip:Point;angles:number[];targets:number[];initialTargets:number[];head:Point;headAngle:number;bottom:number;
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
  u.soldierTurn={at:time,duration,angles,targets:newAngles,initialTargets:[...newAngles],hip:[from.hip[0]-current.hip[0],from.hip[1]-current.hip[1]],
    head:[from.head[0]-from.neck[0]-current.head[0]+current.neck[0],from.head[1]-from.neck[1]-current.head[1]+current.neck[1]],
    headAngle:angleDelta(old.headAngle*flip,current.headAngle),bottom:Math.max(from.nearFoot[1],from.farFoot[1])};
}
/** Unwrap target rotations in simulation. A simultaneous stance change can
 * cross atan2's +/-PI seam; reselecting a shortest arc during the turn snaps
 * a whole shin across the body. Canvas reads remain pure. */
export function updateSoldierTurn(u:Unit,time:number) {
  const turn=u.soldierTurn;if(!turn)return;
  const targets=legAngles(soldierPose({...u,soldierTurn:undefined},time));
  turn.targets=targets.map((a,i)=>turn.targets[i]+angleDelta(a,turn.targets[i]));
}
function turnSoldierPose(p:SoldierPose,u:SoldierBody,time:number):SoldierPose {
  const turn=u.soldierTurn;if(!turn||u.wounded||u.surrendered)return p;
  const t=smooth((time-turn.at)/turn.duration),weight=1-t;if(weight===0)return p;
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
  const shoulder=add(neck,[-1,5]);
  const near=solveLimb(shoulder,p.nearHand,12,13,1),far=solveLimb(add(shoulder,[1,-1]),p.farHand,12,13,1);
  return {...p,hip,neck,shoulder,head:add(neck,[p.head[0]-p.neck[0]+turn.head[0]*weight,p.head[1]-p.neck[1]+turn.head[1]*weight]),
    headAngle:p.headAngle+turn.headAngle*weight,nearKnee,nearFoot,farKnee,farFoot,
    nearElbow:near.joint,nearHand:near.end,farElbow:far.joint,farHand:far.end};
}
/** Interpolate bone angles, not joint positions: a fall/recovery must keep
 * every limb's length and must begin at the exact last live pose. */
export function blendSoldierPose(from:SoldierPose,to:SoldierPose,progress:number):SoldierPose {
  const t=smooth(progress);if(t===0)return from;if(t===1)return to;
  const angle=(a:number,b:number)=>a+Math.atan2(Math.sin(b-a),Math.cos(b-a))*t;
  const bone=(root:Point,oldRoot:Point,oldEnd:Point,newRoot:Point,newEnd:Point,length:number):Point=>{
    const a=angle(Math.atan2(oldEnd[1]-oldRoot[1],oldEnd[0]-oldRoot[0]),Math.atan2(newEnd[1]-newRoot[1],newEnd[0]-newRoot[0]));
    return add(root,[Math.cos(a)*length,Math.sin(a)*length]);
  };
  const hip=lerp(from.hip,to.hip,t),neck=bone(hip,from.hip,from.neck,to.hip,to.neck,22),shoulder=add(neck,[-1,5]);
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
    weaponAngle:angle(from.weaponAngle,to.weaponAngle),
    weaponVisible:t<.25?from.weaponVisible:to.weaponVisible,slung:t<.25?from.slung:to.slung};
  // A rotating shin can otherwise cross the floor and disappear below the
  // sprite's boot anchor. Resolve contact by lifting the entire skeleton,
  // never by cutting off/stretching a leg or reassigning its identity.
  const plane=Math.max(-3,mix(Math.max(from.nearFoot[1],from.farFoot[1]),Math.max(to.nearFoot[1],to.farFoot[1]),t));
  const lift=Math.max(0,nearFoot[1]-plane,farFoot[1]-plane);
  if(lift>0)for(const key of ['hip','neck','shoulder','head','nearKnee','farKnee','nearFoot','farFoot',
    'nearElbow','farElbow','nearHand','farHand','muzzle'] as const)result[key]=add(result[key],[0,-lift]);
  return result;
}
export function soldierPose(u:SoldierBody,time:number):SoldierPose {
  const action=actionFor(u,time),weapon=soldierWeapon(u);
  let stance=soldierStance(u,time),hip=stance.hip,lean=stance.lean;
  const phase=(u.gaitPhase??u.walk??0)*Math.PI/4;
  const travel=clamp(u.gaitWeight??(u.moving?1:0));
  const moving=travel>0.001,run=clamp(u.gaitRun??(u.pose==='run'||u.tactic==='retreat'?1:0))*(1-clamp(stance.low*2));
  let nearFoot=stance.nearFoot,farFoot=stance.farFoot;
  if(moving){
    // Keep the planted endpoint reachable at the longest stride. Clamping an
    // overextended leg made an ostensibly moving gait slide and hover.
    hip=add(hip,[0,travel*(2+run*4)*(1-clamp(stance.low))]);
    const stride=stance.low>1.5?8:stance.low>.5?12:16+run*4;
    const foot=(p:number,far:boolean):Point=>{
      // First half is planted contact (constant backwards local velocity).
      // Second half swings forward. The far leg is always half a cycle away.
      const [x,lift]=gaitStep(p,stride,stance.low>1.5?3:6+run*5);
      return stance.low>1.5?[hip[0]-25+x,-3-lift]:[x+(far?-1:1),-3-lift];
    };
    nearFoot=lerp(nearFoot,foot(phase,false),travel);farFoot=lerp(farFoot,foot(phase+Math.PI,true),travel);
    hip=add(hip,[0,-Math.abs(Math.sin(phase))*travel*(.65+run*.85)]);
  }
  if((u.motion==='jump'||u.motion==='land')&&action!=='casualty'&&action!=='surrender'){
    const jump=u.motion==='jump';
    const p=clamp((u.motionTime??0)/Math.max(.01,u.motionDuration??.6));
    const tuck=jump?Math.sin(p*Math.PI):1-p;
    hip=add(hip,[0,tuck*3]);nearFoot=add(nearFoot,[tuck*9,-tuck*11]);farFoot=add(farFoot,[-tuck*7,-tuck*8]);lean+=tuck*.15;
  }
  if(action==='rappel'||action==='parachute'){
    hip=[-3,-32];lean=.05;nearFoot=[12,-9-Math.sin(time*4)*2];farFoot=[-9,-5+Math.sin(time*4)*2];
  }
  if(action==='casualty'){
    const p=u.soldierFall?1:u.wounded?clamp((u.woundedTime??0)/.7):1;
    const fallen=blendStance(stance,stanceAt('prone'),smooth(p));hip=fallen.hip;lean=fallen.lean+.12;
    nearFoot=fallen.nearFoot;farFoot=fallen.farFoot;stance=fallen;
    // Keep the last crawling legs while their displacement weight settles.
    // A medic/drag bond can clear `crawling` in one tick, not the anatomy.
    // The first fall already starts from its saved live legs. Its destination
    // must stay still while the old gait weight drains; otherwise the shortest
    // knee rotation can change sides during the collapse.
    if(travel>0&&(!u.soldierFall||(u.woundedTime??0)>=.7)){
      const near=gaitStep(phase,8,3),far=gaitStep(phase+Math.PI,8,3);
      nearFoot=lerp(nearFoot,[hip[0]-25+near[0],-3-near[1]],travel);
      farFoot=lerp(farFoot,[hip[0]-25+far[0],-3-far[1]],travel);
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
  let nearHand:Point=add(muzzle,rotate([-width+10,5],weaponAngle)),
    farHand:Point=add(muzzle,rotate([Math.min(-11,shoulder[0]+21-muzzle[0]),3],weaponAngle));
  let prop:SoldierPose['prop'];
  let propHand:SoldierPose['propHand']='near';
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
    // Feed each actual weapon at its own loading point. A mortar bomb goes
    // over the tube, an RPG round goes to the rear and belt guns open the feed.
    const tube=weapon==='mortar',rocket=weapon==='rocket'||weapon==='manpads',belt=weapon==='lmg'||weapon==='hmg';
    const well:Point=tube?[muzzle[0],muzzle[1]-3]:rocket?[muzzle[0]-width+2,muzzle[1]]:
      [muzzle[0]-width+15,muzzle[1]+(belt?-1:8)],pouch=add(hip,[6,-1]);
    farHand=p<.2?lerp(well,pouch,smooth(p/.2)):p<.52?pouch:p<.8?lerp(pouch,well,smooth((p-.52)/.28)):well;
    propHand='far';
    if(p>.2&&p<.82)prop=tube?'mortarRound':rocket?'rocketRound':belt?'belt':weapon==='grenade'?'shell':'magazine';
  }else if(action==='cycle'){
    const p=clamp((time-(u.lastCombatShotAt??time))/.7);
    farHand=[muzzle[0]-width+15-Math.sin(p*Math.PI)*4,muzzle[1]+2];
  }else if(action==='throw'){
    slung=true;const elapsed=grenadeElapsed(u,time),p=elapsed/GRENADE_THROW_S;
    const low=stance.low>1.5,back=add(shoulder,[-12,low?-9:-19]),release=add(shoulder,[19,-12]);
    nearHand=p<.35?lerp(add(hip,[3,-4]),back,smooth(p/.35)):p<.625?lerp(back,release,smooth((p-.35)/.275)):
      lerp(release,add(shoulder,[15,9]),smooth((p-.625)/.375));
    farHand=add(shoulder,[9,13]);if(elapsed<GRENADE_RELEASE_S)prop='grenade';
  }else if(action==='deploy'||action==='barrel'){
    // Keep the crew's support weapon on the ground while adjusting it.
    const p=(u.emplacementSetupUntil??u.overheatedUntil??time)-time;
    nearHand=[muzzle[0]-Math.min(width-10,18),muzzle[1]+6+Math.sin(p*5)*2];
    farHand=[muzzle[0]-Math.min(width-4,25),muzzle[1]+3];
    if(action==='barrel')prop='wrench';
  }else if(['medical','repair','dig','scavenge'].includes(action)){
    slung=true;const p=(u.tendingTime??u.digElapsed??time)*3.6,low=stance.low>1.5;
    const work=add(shoulder,[low?16:12,low?3:17]);
    nearHand=add(work,[Math.sin(p)*3,-Math.cos(p)*3]);farHand=add(work,[-5,1]);
    prop=action==='medical'?'bandage':action==='repair'?'wrench':action==='dig'?'shovel':undefined;
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
    const p=smooth((u.surrenderTime??0)/.6);nearHand=lerp(nearHand,add(shoulder,[12,-21]),p);
    farHand=lerp(farHand,add(shoulder,[-12,-22]),p);slung=true;
  }else if(action==='rappel'||action==='parachute'||action==='vault'){
    nearHand=add(shoulder,[10,-20]);farHand=add(shoulder,[-5,-19]);slung=true;
  }else if(action==='casualty'){
    nearHand=add(shoulder,[10,5]);farHand=add(shoulder,[16,3]);headAngle=.45;weaponVisible=false;
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
  const kneeBend=stance.legBend??(stance.low>1.5?1:-1);
  const nearLeg=solveLimb(hip,nearFoot,17,17,kneeBend),farLeg=solveLimb(add(hip,[-1,0]),farFoot,17,17,kneeBend);
  const nearArm=solveLimb(shoulder,nearHand,12,13,1),farArm=solveLimb(add(shoulder,[1,-1]),farHand,12,13,1);
  const result:SoldierPose=groundSoldierPose({appearance:soldierAppearance(u),weapon,action,hip,neck,shoulder,head,headAngle,
    nearKnee:nearLeg.joint,farKnee:farLeg.joint,nearFoot:nearLeg.end,farFoot:farLeg.end,
    nearElbow:nearArm.joint,farElbow:farArm.joint,nearHand:nearArm.end,farHand:farArm.end,
    muzzle,weaponAngle,weaponVisible,slung,phase,travel,low:stance.low,prop,propHand,
    layers:['farLeg','farArm','backpack','torso','head','nearLeg','weapon','nearArm']},u.soldierGround);
  if(action==='casualty'&&u.soldierFall)return blendSoldierPose(u.soldierFall,result,(u.woundedTime??0)/.7);
  if(action==='surrender'&&u.soldierSurrender&&time-u.soldierSurrender.at<.45)
    return blendSoldierPose(u.soldierSurrender.pose,result,(time-u.soldierSurrender.at)/.45);
  let continuous=result;
  if(action!=='casualty'&&u.soldierRise&&time-u.soldierRise.at<.35)
    continuous=blendSoldierPose(u.soldierRise.pose,result,(time-u.soldierRise.at)/.35);
  else if(action!=='casualty'&&u.soldierLanding&&time-u.soldierLanding.at<u.soldierLanding.duration)
    continuous=blendSoldierPose(u.soldierLanding.pose,result,(time-u.soldierLanding.at)/u.soldierLanding.duration);
  return turnSoldierPose(continuous,u,time);
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
  const follow=(before:number|undefined,target:number)=>{
    const start=before===undefined?target:before+(old!.y-u.y);
    return start+Math.max(-dt*30,Math.min(dt*30,target-start));
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
  const phase=u.gaitPhase??u.walk;
  const sign=Math.abs(dx)>1e-5?Math.sign(dx*(u.facing||1)):1;
  const running=u.pose==='run'||u.tactic==='retreat'?1:0;
  const oldRun=u.gaitRun??running;
  u.gaitRun=oldRun+Math.max(-dt*6,Math.min(dt*6,running-oldRun));
  // Teleports/recovery placement are not footsteps; do not flash through a cycle.
  const stride=u.pose==='prone'?4:u.pose==='crouch'||u.pose==='hunker'?6:8+u.gaitRun*2;
  u.gaitPhase=phase+(moving&&distance<12?sign*distance/stride:0);
  u.gaitWeight=clamp((u.gaitWeight??0)+(moving?1:-1)*dt*7);
  const aim=(u.aimUntil??0)>time||u.fire>0||u.secondaryFire>0;
  u.rifleReady=clamp((u.rifleReady??0)+(aim?1:-1)*dt/.24);
}
