import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS,createGame,startGame,spawnUnit,tick,ground,setOrder,explode,pickMedicPatient} from '../game/engine.ts';
import {soldierPose,updateSoldierGait} from '../game/soldier-pose.ts';

const roles=Object.entries(CARDS).filter(([,c])=>c.members).flatMap(([id,c])=>
  Array.from({length:c.members},(_,member)=>({id,member})));
const modes=['rappel','parachute','jump'];
const joints=['hip','neck','nearKnee','farKnee','nearFoot','farFoot'];
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function arena(){
  const s=createGame(180);startGame(s);s.aiIn=1e9;s.weather.disabled=true;s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);setOrder(s,0,'hold');setOrder(s,1,'hold');return s;
}
function insert(s,role,mode,side=0,height=130){
  s.time=1;s.units=[];s.wrecks=[];s.projectiles=[];s.particles=[];s.blasts=[];s.injurySeed=0;
  spawnUnit(s,side,role.id,1500,{member:role.member});const u=s.units.at(-1);s.units=[u];
  Object.assign(u,{...role,x:1500,y:374-height,pose:mode==='jump'?'jump':'climb',
    motion:mode==='jump'?'jump':'ground',motionTime:.25,motionDuration:.6,vx:20,vy:35,
    rappelling:mode==='rappel',parachuting:mode==='parachute',rappellingStartAt:1,parachutingStartAt:1,
    readyAt:1e9,decisionIn:1e9,cooldown:1e9,personalMorale:100,injuryCooldown:0,fire:0,
    moving:true,gaitWeight:0,gaitPhase:2.3});return u;
}
function shoot(s,u,lethal=false){
  const y=u.y-24;
  s.projectiles.push({x:u.x-100,y,startX:u.x-100,startY:y,tx:u.x,ty:y,
    side:1-u.side,targetUid:u.uid,base:null,damage:u.maxHp*(lethal?3:.6),radius:0,
    life:.001,total:.001,arc:0,ammunition:'rifle',tracer:false});
  tick(s,1/120);
}
test('every soldier role wounded during rope, canopy or jump keeps its world position and descends continuously',()=>{
  const s=arena(),bad=[];
  for(const role of roles)for(const mode of modes)for(const side of [0,1]){
    const u=insert(s,role,mode,side),oldY=u.y;shoot(s,u);
    assert(u.wounded,`${role.id}/${role.member}/${mode} injury fixture`);
    if(u.y-oldY>6)bad.push({role,mode,side,teleport:u.y-oldY});
    let lastY=u.y;const shots=u.shots;
    for(let i=0;i<180&&u.y<ground(s,u.x);i++){
      tick(s,1/120);assert(u.y-lastY<8,'fall must advance continuously');assert.equal(u.shots,shots,'wounded unit fired');lastY=u.y;
    }
    assert.equal(u.y,ground(s,u.x));assert(u.wounded&&u.hp>0);assert(!u.rappelling&&!u.parachuting);
  }
  assert.equal(bad.length,0,JSON.stringify({count:bad.length,examples:bad.slice(0,4)}));
});
test('every soldier role killed above ground falls from its current height instead of snapping to the ground',()=>{
  const s=arena(),bad=[];
  for(const role of roles)for(const mode of modes)for(const side of [0,1]){
    const u=insert(s,role,mode,side),oldY=u.y;shoot(s,u,true);const w=s.wrecks.find(w=>w.id===u.uid);
    assert(w,`${role.id}/${role.member}/${mode} lethal fixture`);
    if(!w.falling||w.y-oldY>6)bad.push({role,mode,side,falling:w.falling,teleport:w.y-oldY});
    let lastY=w.y;
    for(let i=0;i<180&&w.falling;i++){tick(s,1/120);assert(w.y-lastY<8);lastY=w.y;}
    assert(!w.falling);assert.equal(w.y,ground(s,w.x));
  }
  assert.equal(bad.length,0,JSON.stringify({count:bad.length,examples:bad.slice(0,4)}));
});
test('all member roles land from rope, canopy and jumping without replacing their leg pose',()=>{
  const s=arena(),bad=[];
  for(const role of roles)for(const mode of modes)for(const side of [0,1]){
    const u=insert(s,role,mode,side,1);let last=soldierPose(u,s.time);
    for(let frame=0;frame<90;frame++){
      tick(s,1/120);const pose=soldierPose(u,s.time);
      for(const key of joints)if(distance(last[key],pose[key])>6)
        bad.push({role,mode,side,frame,key,jump:distance(last[key],pose[key])});
      last=pose;
    }
    assert.equal(u.y,ground(s,u.x));assert(!u.rappelling&&!u.parachuting);
  }
  assert.equal(bad.length,0,JSON.stringify({count:bad.length,examples:bad.slice(0,6)}));
});
test('medics and buddies cannot attach treatment or a drag rope to a casualty still falling above them',()=>{
  const s=arena(),patient=insert(s,{id:'infantry',member:0},'rappel');shoot(s,patient);
  spawnUnit(s,0,'medic',patient.x,{member:0});const medic=s.units.at(-1);
  spawnUnit(s,0,'infantry',patient.x,{member:1,squad:patient.squad});const buddy=s.units.at(-1);
  if(patient.y>=ground(s,patient.x))assert.fail('injury fixture teleported to the ground');
  assert.equal(pickMedicPatient(s,medic),undefined);
  for(let frame=0;frame<20;frame++){
    tick(s,1/120);assert(patient.y<ground(s,patient.x));
    assert.equal(patient.draggedByUid,undefined);assert.equal(patient.firstAidByUid,undefined);
    assert(!medic.tending);assert.equal(buddy.draggingUid,undefined);
  }
});
test('all roles keep their current legs when surrender begins in the air or on the ground',()=>{
  const s=arena();
  for(const role of roles)for(const mode of [...modes,'ground'])for(const side of [0,1]){
    const u=insert(s,role,mode,side,mode==='ground'?0:130),oldY=u.y,shots=u.shots;
    if(mode==='ground')Object.assign(u,{pose:'walk',motion:'ground',gaitWeight:1});
    let last=soldierPose(u,s.time);
    u.surrendered=true;u.surrenderTime=0;
    for(let frame=0;frame<180;frame++){
      tick(s,1/120);const p=soldierPose(u,s.time);
      if(frame===0)assert(u.y-oldY<3);
      for(const key of joints)assert(distance(last[key],p[key])<6,`${role.id}/${mode}/${frame}/${key}`);
      last=p;
    }
    assert(!u.casualtyFall);assert.equal(u.y,ground(s,u.x));assert.equal(u.shots,shots);
  }
});
test('wounded self-crawl plants each anatomical foot in world space rather than sliding a sine-wave leg',()=>{
  for(const role of roles)for(const facing of [-1,1])for(const dir of [-1,1])for(const far of [false,true]){
    const key=far?'farFoot':'nearFoot',u={...role,uid:1,hp:1,wounded:true,woundedTime:3,crawling:true,
      pose:'prone',motion:'ground',moving:true,walk:0,x:1000,lane:0,facing,gaitWeight:1,gaitPhase:far?4.3:.3};
    const a=soldierPose(u,20),first=u.x+a[key][0]*facing;
    u.x+=dir*.1;updateSoldierGait(u,{x:1000,lane:0},1/120,20+1/120);
    const b=soldierPose(u,20+1/120);
    assert(Math.abs(u.x+b[key][0]*facing-first)<1e-6,`${role.id}/${facing}/${dir}/${key} slid`);
  }
});
test('real buddy and medic decisions complete hauling, treatment and revive for all roles with continuous bodies',()=>{
  const s=arena(),bad=[];
  for(const role of roles)for(const side of [0,1]){
    const patient=insert(s,role,'rappel',side);shoot(s,patient);
    spawnUnit(s,side,'infantry',patient.x+(side?20:-20),{member:1,squad:patient.squad});
    const buddy=s.units.at(-1);let medic,dragged=false,treated=false,revived=false;
    const poses=new Map([[patient.uid,soldierPose(patient,s.time)],[buddy.uid,soldierPose(buddy,s.time)]]);
    for(let frame=0;frame<1200;frame++){
      // Let the squad discover and haul the casualty, then bring medical help
      // into actual triage range. Do not set treatment or revive progress.
      if(frame===300){
        spawnUnit(s,side,'medic',patient.x+(side?40:-40),{member:0});medic=s.units.at(-1);
      }
      tick(s,1/60);
      dragged ||= patient.draggedByUid===buddy.uid;
      treated ||= !!medic?.tending&&medic.tendingTargetUid===patient.uid;
      for(const u of s.units){
        const previous=poses.get(u.uid),pose=soldierPose(u,s.time);
        if(previous)for(const key of joints)if(distance(previous[key],pose[key])>6)
          bad.push({role,side,frame,key,pixels:distance(previous[key],pose[key]),actor:u.id,action:pose.action});
        poses.set(u.uid,pose);
      }
      if(!patient.wounded){revived=true;if(!patient.soldierRise)break;}
    }
    assert(dragged,`${role.id}/${role.member}/${side} never hauled`);
    assert(treated&&revived,`${role.id}/${role.member}/${side} medical flow incomplete`);
  }
  assert.equal(bad.length,0,JSON.stringify({count:bad.length,examples:bad.slice(0,10)}));
});
test('stopping a wounded crawl or attaching a dragger settles the current legs instead of resetting them',()=>{
  for(const role of roles)for(const dragged of [false,true])for(let phase=0;phase<8;phase+=.25){
    const u={...role,uid:1,hp:1,wounded:true,woundedTime:3,crawling:true,pose:'prone',motion:'ground',
      moving:true,walk:0,x:1000,lane:0,facing:1,gaitWeight:1,gaitPhase:phase};
    let last=soldierPose(u,20);u.crawling=false;u.moving=false;if(dragged)u.draggedByUid=2;
    for(let frame=1;frame<=20;frame++){
      updateSoldierGait(u,{x:1000,lane:0},1/60,20+frame/60);const p=soldierPose(u,20+frame/60);
      for(const key of joints)assert(distance(last[key],p[key])<6,`${role.id}/${phase}/${frame}/${key}`);
      last=p;
    }
    assert.equal(u.gaitWeight,0);
  }
});
test('residual gait cannot change the knee rotation path while any member is collapsing',()=>{
  for(const role of roles)for(const pose of ['run','crouch','prone'])for(let phase=0;phase<8;phase+=.5){
    const u={...role,uid:1,hp:1,pose,motion:'ground',moving:true,walk:0,x:1000,lane:0,facing:1,
      gaitWeight:1,gaitPhase:phase,crouchTravel:1,proneTravel:1};
    let last=soldierPose(u,20);u.soldierFall=last;u.wounded=true;u.pose='prone';u.moving=false;
    for(let frame=1;frame<=48;frame++){
      u.woundedTime=frame/60;updateSoldierGait(u,{x:1000,lane:0},1/60,20+frame/60);
      const p=soldierPose(u,20+frame/60);
      for(const key of joints)assert(distance(last[key],p[key])<6,`${role.id}/${pose}/${phase}/${frame}/${key}`);
      last=p;
    }
  }
});
