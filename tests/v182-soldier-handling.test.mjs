import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS} from '../game/cards.ts';
import {soldierPose,soldierMuzzle,updateSoldierGait,updateSoldierGround,beginSoldierTurn,updateSoldierTurn,soldierFootPlanted,soldierSupportFraction} from '../game/soldier-pose.ts';
import {WEAPON_GRIPS,weaponSocket} from '../game/soldier-weapon-rig.ts';
const base={id:'infantry',member:0,uid:1,hp:100,x:1500,y:374,lane:0,facing:1,
  pose:'idle',motion:'ground',moving:false,walk:0,fire:0,climbing:0,rifleReady:1};
const roles=Object.entries(CARDS).filter(([,c])=>c.members).flatMap(([id,c])=>
  Array.from({length:c.members},(_,member)=>({id,member})));
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);

test('weapon hands keep their actual grips while a crawling support arm is free to pull',()=>{
  const bad=[];
  for(const role of roles)for(const pose of ['idle','walk','run','crouch','prone'])
    for(const moving of [false,true])for(const ready of [0,1])for(const phase of [0,1,2,3,4,5,6,7]){
    const u={...base,...role,pose,moving,gaitWeight:moving?1:0,gaitPhase:phase,
      crouchTravel:moving?1:0,proneTravel:moving?1:0,rifleReady:ready};
    updateSoldierGround(u,x=>374+(x-1500)*.12,20,1);
    const p=soldierPose(u,20),grips=WEAPON_GRIPS[p.weapon];
    for(const [hand,key]of [['nearHand','trigger'],['farHand','support']]){
      if(pose==='prone'&&moving&&hand==='farHand')continue;
      const error=distance(p[hand],weaponSocket(p.weaponOrigin,p.weaponAngle,grips[key]));
      if(error>.01)bad.push({role,pose,moving,ready,phase,hand,error});
    }
    const shot=soldierMuzzle(u);
    assert(distance(p.muzzle,[shot.x,-shot.height-3])<1e-7,'visual muzzle and shot diverged');
  }
  assert.equal(bad.length,0,JSON.stringify(bad.slice(0,8)));
});
test('aimed weapons keep the butt or tube in shoulder contact while prone arms clear the floor',()=>{
  for(const id of ['infantry','machinegun','rocket','manpads','sniper_team','grenadiers','flame_team'])
    for(const pose of ['idle','walk','crouch','prone'])for(const phase of [0,2,4,6]){
    const moving=pose!=='prone';
    const p=soldierPose({...base,id,pose,moving,gaitWeight:moving?1:0,gaitPhase:phase,crouchTravel:1,proneTravel:0},20);
    const socket=weaponSocket(p.weaponOrigin,p.weaponAngle,WEAPON_GRIPS[p.weapon].shoulder);
    assert(distance(socket,p.shoulder)<=5.2,`${id}/${pose}: shoulder contact`);
    if(pose==='prone')for(const key of ['nearHand','farHand','nearElbow','farElbow'])
      assert(p[key][1]<=-1.5,`${id}/${key}: arm passes through the floor`);
  }
});
test('heavy supports stay grounded; carried weapons rotate together with both grip points',()=>{
  for(const [id,bottom] of [['heavy_mg',25],['light_mortar',32]])for(const pose of ['idle','crouch','prone']){
    const p=soldierPose({...base,id,pose},20);
    assert.equal(p.weaponAngle,0);
    assert.equal(p.weaponOrigin[1]+bottom,-3);
    const carried=soldierPose({...base,id,pose:'walk',moving:true,gaitWeight:1,gaitPhase:2},20);
    assert.equal(carried.weaponCarry,1);assert.notEqual(carried.weaponAngle,0);
  }
});
test('folding heavy weapons and loading mortar rounds keep reachable grips and loading ports',()=>{
  for(const id of ['heavy_mg','light_mortar'])for(const pose of ['idle','walk','crouch','prone'])
    for(let weight=0;weight<=1;weight+=.125)for(const phase of [0,2,4,6]){
    const u={...base,id,pose,moving:weight>0,gaitWeight:weight,gaitPhase:phase,crouchTravel:weight,proneTravel:weight};
    const p=soldierPose(u,20),grips=WEAPON_GRIPS[p.weapon];
    for(const [key,socket]of [['nearHand','trigger'],['farHand','support']]){
      if(pose==='prone'&&weight>0&&key==='farHand')continue;
      assert(distance(p[key],weaponSocket(p.weaponOrigin,p.weaponAngle,grips[socket]))<.01,`${id}/${pose}/${weight}/${key}`);
    }
    if(id==='light_mortar'&&weight===0){
      const reload=soldierPose({...u,ammo:0,reloadingStartAt:19,reloadingUntil:20.1},20);
      assert(distance(reload.farHand,weaponSocket(reload.weaponOrigin,reload.weaponAngle,grips.feed))<.01,
        `${pose}: cannot reach mortar loading port`);
    }
  }
});
test('shoulder contact survives turning instead of leaving the gun at the unturned body',()=>{
  for(const id of ['infantry','rocket','manpads'])for(const pose of ['idle','walk','prone']){
    const u={...base,id,pose,moving:pose==='walk',gaitWeight:pose==='walk'?1:0,gaitPhase:2};
    const previous={x:u.x,y:u.y,facing:1,pose:soldierPose(u,20)};
    u.facing=-1;beginSoldierTurn(u,previous,20);
    for(let i=0;i<90;i++){
      updateSoldierTurn(u,20+i/120);const p=soldierPose(u,20+i/120);
      assert(distance(weaponSocket(p.weaponOrigin,p.weaponAngle,WEAPON_GRIPS[p.weapon].shoulder),p.shoulder)<5.2);
    }
  }
});
test('walking support leg straightens at midstance and running has a distinct forward lean',()=>{
  for(const pose of ['walk','run']){
    const p=soldierPose({...base,pose,moving:true,gaitWeight:1,gaitPhase:2},20);
    const leg=distance(p.hip,p.nearFoot),flex=2*Math.acos(Math.min(1,leg/34));
    if(pose==='walk')assert(flex<Math.PI/4,`${pose}: deep crouch at midstance`);
    const lean=Math.atan2(p.neck[0]-p.hip[0],p.hip[1]-p.neck[1]);
    assert(lean>=(pose==='run'?.19:.09));
  }
});
test('walking, running and crouching support feet hold world position in both travel directions',()=>{
  for(const pose of ['walk','run','crouch'])for(const facing of [-1,1])for(const direction of [-1,1])
    for(let phase=.05;phase<7.95;phase+=.08){
    const u={...base,pose,facing,moving:true,gaitWeight:1,gaitPhase:phase,crouchTravel:1,proneTravel:1};
    const key=soldierFootPlanted(u)?'nearFoot':soldierFootPlanted(u,true)?'farFoot':null;
    if(!key)continue;
    const p=soldierPose(u,20),world=u.x+p[key][0]*facing;
    const previous={x:u.x,lane:0};u.x+=direction*.005;updateSoldierGait(u,previous,1/6000,20);
    const next=soldierPose(u,20);
    assert(Math.abs(u.x+next[key][0]*facing-world)<1e-6,`${pose}/${phase}: planted boot slips`);
  }
});
test('swing feet leave and meet the floor with continuous horizontal and vertical velocity',()=>{
  const eps=.0001;
  for(const pose of ['walk','run','crouch','prone'])for(const phase of (pose==='run'?[0,3.04,4,7.04,8]:[0,4,8])){
    const point=n=>soldierPose({...base,pose,moving:true,gaitWeight:1,gaitPhase:n,crouchTravel:1,proneTravel:1},20).nearFoot;
    const a=point(phase-eps),b=point(phase),c=point(phase+eps);
    const v0=[(b[0]-a[0])/eps,(b[1]-a[1])/eps],v1=[(c[0]-b[0])/eps,(c[1]-b[1])/eps];
    assert(distance(v0,v1)<.02,`${pose}/${phase}: foot stamps or reverses abruptly`);
  }
});
test('moving and stationary crouch-prone transitions have no limb or weapon threshold jumps',()=>{
  for(const id of ['infantry','rocket','heavy_mg','light_mortar'])for(const from of ['crouch','prone'])
    for(const weight of [0,1]){
    const to=from==='crouch'?'prone':'crouch';
    const u={...base,id,pose:to,poseAnimFrom:from,poseAnimSeen:to,poseAnimAt:20,
      moving:weight>0,gaitWeight:weight,crouchTravel:weight,proneTravel:weight};
    let previous=soldierPose(u,20);
    for(let i=1;i<=144;i++){
      u.gaitPhase=i/20;const p=soldierPose(u,20+i/120);
      for(const key of ['nearFoot','farFoot','nearKnee','farKnee','muzzle'])
        assert(distance(previous[key],p[key])<3,`${id}/${from}/${weight}/${i}/${key}: pose jumps`);
      previous=p;
    }
  }
});
test('fast walking, running and crouching still plant the support foot on a slope',()=>{
  for(const pose of ['walk','run','crouch'])for(const speed of [68,122,165.6])
    for(const slope of [-.2,.2])for(const facing of [-1,1]){
    const u={...base,pose,facing,moving:true,gaitWeight:1,gaitPhase:0,crouchTravel:1,proneTravel:1};
    const floor=x=>374+(x-1500)*slope;updateSoldierGround(u,floor,20,1);
    for(let i=0;i<120;i++){
      const previous={x:u.x,lane:0};u.x+=facing*speed/60;u.y=floor(u.x);
      updateSoldierGait(u,previous,1/60,20+i/60);updateSoldierGround(u,floor,20+i/60,1/60);
      const p=soldierPose(u,20+i/60);
      for(const [key,offset]of [['nearFoot',0],['farFoot',.5]]){
        const phase=((u.gaitPhase/8+offset)%1+1)%1;if(phase<.02||phase>soldierSupportFraction(u)-.02)continue;
        assert(Math.abs(u.y+p[key][1]+3-floor(u.x+p[key][0]*facing))<.25,`${pose}/${speed}/${slope}/${key}: floats above slope`);
      }
    }
  }
});
