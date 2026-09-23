import test from 'node:test';
import assert from 'node:assert/strict';
import {CARDS,createGame,startGame,spawnUnit,tick,ground,explode} from '../game/engine.ts';
import {soldierPose,updateSoldierGait,updateSoldierGround,beginSoldierTurn,updateSoldierTurn} from '../game/soldier-pose.ts';
const roles=Object.entries(CARDS).filter(([,c])=>c.members).flatMap(([id,c])=>
  Array.from({length:c.members},(_,member)=>({id,member})));
const angularDistance=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
function arena(){
  const s=createGame(181);startGame(s);s.aiIn=1e9;s.weather.disabled=true;s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);return s;
}
test('every member hit by a real blast keeps a continuous body rotation through impact and settles on the ground',()=>{
  const s=arena(),bad=[];
  for(const role of roles)for(const side of [0,1]){
    s.time=1;s.units=[];s.wrecks=[];s.projectiles=[];s.particles=[];s.blasts=[];
    s.terrain.fill(374);s.original.fill(374);
    spawnUnit(s,side,role.id,1500,{member:role.member});const u=s.units.at(-1);s.units=[u];
    Object.assign(u,{...role,x:1500,y:374,pose:'idle',motion:'ground',moving:false});
    explode(s,u.x+(side?25:-25),u.y-24,70,10000,1-side,1,1,'he',1.5);
    const w=s.wrecks.find(w=>w.id===u.uid);assert(w?.falling&&Math.abs(w.spin)>1,'actual blast must throw the member');
    let angle=w.angle,landed=false;
    for(let frame=0;frame<180;frame++){
      tick(s,1/60);
      const delta=angularDistance(w.angle,angle);
      if(delta>.20)bad.push({role,side,frame,delta,before:angle,after:w.angle,falling:w.falling});
      landed ||= !w.falling;angle=w.angle;
    }
    assert(landed,'corpse never landed');
    assert(angularDistance(w.angle,0)<=.36,'corpse never settled into a ground pose');
    assert.equal(w.y,ground(s,w.x));
  }
  assert.equal(bad.length,0,JSON.stringify({count:bad.length,examples:bad.slice(0,6)}));
});
test('a helper approaching from either side never teleports its patient onto the drag offset',()=>{
  const s=arena();
  for(const role of roles)for(const side of [0,1])for(const offset of [-18,-10,10,18]){
    s.time=1;s.units=[];s.wrecks=[];s.projectiles=[];
    spawnUnit(s,side,role.id,1500+offset,{member:role.member});const u=s.units.at(-1);
    spawnUnit(s,side,'infantry',1500,{member:0,squad:u.squad});const patient=s.units.at(-1);s.units=[u,patient];
    Object.assign(patient,{x:1500,y:374,wounded:true,woundedTime:3,pose:'prone',hp:8,bleedOut:120,
      draggedByUid:u.uid,rappelling:false,parachuting:false,motion:'ground'});
    Object.assign(u,{...role,x:1500+offset,y:374,pose:'crouch',motion:'ground',climbing:0,personalMorale:100,
      moving:false,draggingUid:patient.uid,rappelling:false,parachuting:false,poseAnimAt:undefined,
      poseAnimProgress:undefined,poseAnimSeen:undefined});
    let hauled=false;
    for(let frame=0;frame<240;frame++){
      const before=patient.x;tick(s,1/60);const distance=Math.abs(patient.x-before);
      assert(distance<=.28,`${role.id}/${side}/${offset}/${frame}: patient jumped ${distance}px`);
      hauled ||= distance>0;
    }
    if((CARDS[role.id].speed??0)>0)assert(hauled,`${role.id}/${side}/${offset}: helper never began hauling`);
    else assert.equal(u.draggingUid,undefined,'stationary medical posts must release the drag bond');
  }
});
test('every role turns both ways without swapping the world positions of its anatomical legs or moving the ballistic muzzle',()=>{
  const bad=[];
  for(const role of roles)for(const facing of [-1,1])for(const pose of ['idle','walk','run','crouch','prone'])for(let phase=0;phase<8;phase++){
    const u={...role,uid:1,hp:100,x:1500,y:374,lane:0,facing,climbing:0,pose,motion:'ground',
      moving:pose!=='idle',walk:phase,gaitWeight:pose==='idle'?0:1,gaitRun:pose==='run'?1:0,gaitPhase:phase,
      crouchTravel:1,proneTravel:1,aimUntil:100,fire:.2,rifleReady:1};
    const floor=()=>374;updateSoldierGround(u,floor,20,1);
    let p=soldierPose(u,20),last={x:u.x,y:u.y,facing:u.facing,pose:p};
    u.facing=-facing;beginSoldierTurn(u,last,20);
    for(let frame=0;frame<=90;frame++){
      const time=20+frame/120;
      if(frame){const previous={x:u.x,lane:0};if(u.moving)u.x+=u.facing*(CARDS[u.id].speed??0)/120;
        updateSoldierGait(u,previous,1/120,time);updateSoldierGround(u,floor,time,1/120);}
      updateSoldierTurn(u,time);p=soldierPose(u,time);
      for(const key of ['hip','neck','nearKnee','farKnee','nearFoot','farFoot']){
        const change=Math.hypot(u.x+p[key][0]*u.facing-last.x-last.pose[key][0]*last.facing,u.y+p[key][1]-last.y-last.pose[key][1]);
        if(change>6)bad.push({role,facing,pose,phase,frame,key,change});
      }
      const unturned=soldierPose({...u,soldierTurn:undefined},time);
      assert.deepEqual(p.muzzle,unturned.muzzle,'turning animation must not alter the shot origin');
      for(const [a,b]of [['hip','nearKnee'],['nearKnee','nearFoot'],['farKnee','farFoot']])
        assert(Math.abs(Math.hypot(p[a][0]-p[b][0],p[a][1]-p[b][1])-17)<1e-6);
      last={x:u.x,y:u.y,facing:u.facing,pose:p};
    }
  }
  assert.equal(bad.length,0,JSON.stringify({count:bad.length,examples:bad.slice(0,6)}));
});
test('turning during a kneel/prone transition unwraps target angles without a knee seam jump',()=>{
  for(const role of roles)for(const facing of [-1,1])for(const from of ['crouch','prone'])for(const delay of [0,.2,.5,.8]){
    const to=from==='prone'?'crouch':'prone',floor=()=>374;
    const u={...role,uid:1,hp:100,x:1500,y:374,lane:0,facing,climbing:0,pose:to,motion:'ground',
      moving:false,walk:0,gaitWeight:0,poseAnimFrom:from,poseAnimSeen:to,poseAnimAt:20};
    const start=20+delay;updateSoldierGround(u,floor,start,1);
    let last={x:u.x,y:u.y,facing,pose:soldierPose(u,start)};
    u.facing=-facing;beginSoldierTurn(u,last,start);
    for(let frame=0;frame<=180;frame++){
      const time=start+frame/120;updateSoldierGround(u,floor,time,1/120);updateSoldierTurn(u,time);
      const p=soldierPose(u,time);
      for(const key of ['hip','neck','nearKnee','farKnee','nearFoot','farFoot']){
        const change=Math.hypot(u.x+p[key][0]*u.facing-last.x-last.pose[key][0]*last.facing,u.y+p[key][1]-last.y-last.pose[key][1]);
        assert(change<=6,`${role.id}/${from}/${delay}/${frame}/${key}: ${change}`);
      }
      last={x:u.x,y:u.y,facing:u.facing,pose:p};
    }
  }
});
test('moving uphill and downhill keeps each anatomical supporting boot planted during aim, fire and reload',()=>{
  const bad=[];
  for(const role of roles)for(const facing of [-1,1])for(const slope of [-.2,.2])
    for(const pose of ['walk','run','crouch','prone'])for(const key of ['nearFoot','farFoot']){
    const floor=x=>374+(Math.floor(x)-1500)*slope;
    const u={...role,uid:1,hp:100,x:1500,y:374,lane:0,facing,climbing:0,pose,motion:'ground',
      moving:true,walk:0,gaitWeight:1,gaitRun:pose==='run'?1:0,gaitPhase:key==='nearFoot'?1:5,
      crouchTravel:1,proneTravel:1,aimUntil:100,fire:.2,rifleReady:1};
    updateSoldierGround(u,floor,20,1);const first=soldierPose(u,20),x0=u.x+first[key][0]*facing;
    for(let frame=1;frame<=16;frame++){
      const previous={x:u.x,lane:0};u.x+=facing*.1;u.y=floor(u.x);
      if(frame===8)Object.assign(u,{fire:0,ammo:0,reloadingStartAt:20,reloadingUntil:21});
      updateSoldierGait(u,previous,1/120,20+frame/120);updateSoldierGround(u,floor,20+frame/120,1/120);
      const p=soldierPose(u,20+frame/120),x=u.x+p[key][0]*facing;
      const slide=Math.abs(x-x0),contact=Math.abs(u.y+p[key][1]+3-floor(x));
      if(slide>.05||contact>.25)bad.push({role,facing,slope,pose,key,frame,slide,contact});
    }
  }
  assert.equal(bad.length,0,JSON.stringify({count:bad.length,examples:bad.slice(0,8)}));
});
test('all soldier roles place both resting boots on the actual slope without changing bone length',()=>{
  const s=arena(),bad=[];
  for(const role of roles)for(const side of [0,1])for(const slope of [-.2,.2]){
    s.units=[];s.wrecks=[];s.projectiles=[];
    for(let x=0;x<s.terrain.length;x++)s.terrain[x]=374+(x-1500)*slope;
    s.original=s.terrain.slice();
    spawnUnit(s,side,role.id,1500,{member:role.member});const u=s.units.at(-1);s.units=[u];
    Object.assign(u,{...role,x:1500,y:374,pose:'idle',motion:'ground',moving:false,
      squadOrder:'watch',squadOrderUntil:1e9,decisionIn:1e9,readyAt:1e9,
      rappelling:false,parachuting:false,gaitWeight:0});
    for(let frame=0;frame<30;frame++)tick(s,1/60);
    const p=soldierPose(u,s.time);
    for(const key of ['nearFoot','farFoot']){
      const x=u.x+p[key][0]*u.facing;
      const offset=u.y+p[key][1]+3-ground(s,x);
      if(Math.abs(offset)>.25)bad.push({role,side,slope,key,offset});
    }
    for(const [a,b]of [['hip','nearKnee'],['nearKnee','nearFoot'],['farKnee','farFoot']])
      assert(Math.abs(Math.hypot(p[a][0]-p[b][0],p[a][1]-p[b][1])-17)<1e-6);
  }
  assert.equal(bad.length,0,JSON.stringify({count:bad.length,examples:bad.slice(0,6)}));
});
test('all six stance transitions stay continuous on sloping terrain for every member and facing',()=>{
  const bad=[];
  for(const role of roles)for(const facing of [-1,1])for(const slope of [-.2,.2])
    for(const from of ['stand','crouch','prone'])for(const to of ['stand','crouch','prone'])if(from!==to){
    const floor=x=>374+(Math.floor(x)-1500)*slope,duration=Math.abs(['stand','crouch','prone'].indexOf(from)-['stand','crouch','prone'].indexOf(to))===2?2.4:1.2;
    const u={...role,uid:1,hp:100,x:1500,y:374,lane:0,facing,climbing:0,pose:from==='stand'?'idle':from,
      motion:'ground',moving:false,walk:0,gaitWeight:0};
    updateSoldierGround(u,floor,20,1);
    Object.assign(u,{pose:to==='stand'?'idle':to,poseAnimFrom:from,poseAnimSeen:to,poseAnimAt:20});
    let last=soldierPose(u,20);
    for(let frame=1;frame<=Math.ceil((duration+.3)*60);frame++){
      const time=20+frame/60;updateSoldierGround(u,floor,time,1/60);const p=soldierPose(u,time);
      for(const key of ['hip','neck','nearKnee','farKnee','nearFoot','farFoot']){
        const pixels=Math.hypot(p[key][0]-last[key][0],p[key][1]-last[key][1]);
        if(pixels>6)bad.push({role,facing,slope,from,to,frame,key,pixels});
      }
      last=p;
    }
  }
  assert.equal(bad.length,0,JSON.stringify({count:bad.length,examples:bad.slice(0,6)}));
});
