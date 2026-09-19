import assert from 'node:assert/strict';
import test from 'node:test';
import {createGame,startGame,spawnUnit,tick,setOrder,refreshVision,coveringMate} from '../game/engine.ts';
import {adultFrameChoice,poseTransitionChoice} from '../game/adult-animation.ts';
import {infantryGeometry} from '../game/infantry-geometry.ts';
import {CROUCH_STEP_S,CROUCH_STOP_GRACE_S,crouchMotionActive,requestCrouchStep,stepCrouchLocomotion,startMagazineDrill} from '../game/crouch-locomotion.ts';

function arena(){const s=createGame(144);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.weather.disabled=true;s.night=false;return s;}
function one(s,side=0,x=1000,extra={}){const n=s.units.length;spawnUnit(s,side,'infantry',x);
  const u=s.units[n];s.units.splice(n+1);Object.assign(u,{x,y:374,lane:0,pace:1,pose:'crouch',poseAnimSeen:'crouch',
    stanceLockUntil:100,motion:'ground',hp:10000,maxHp:10000,shots:0,decisionIn:1000,tactic:'crouch',
    cooldown:1000,stillFor:0,moving:false,personalMorale:100,suppression:0,readyAt:-100,
    fragLeft:0,fire:0,flash:0,aimUntil:0,...extra});return u;}
const step=(s,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++)tick(s,1/60);};

test('a kneeling soldier rises through real cels before moving, on both sides',()=>{
  for(const side of [0,1]){const s=arena(),u=one(s,side),start=[u.x,u.lane];setOrder(s,side,'crouch');
    const indices=new Set();for(let i=0;i<Math.floor(CROUCH_STEP_S*60)-1;i++){
      tick(s,1/60);assert.deepEqual([u.x,u.lane],start);const f=adultFrameChoice(u,s.time);
      assert.equal(f.group,'stance16');indices.add(f.index);}
    assert.deepEqual([...indices],[7,6,5,4,3,2]);
    step(s,.2);assert(u.moving);assert.equal(u.crouchTravel,1);assert((u.x-start[0])*(side?-1:1)>0);
  }
});

test('brief aim/traffic stops keep body height and foot phase; a real stop lowers slowly',()=>{
  const u=one(arena(),0,1000,{moving:true,crouchTravel:1,walk:3.3});let time=0;
  for(let i=0;i<600;i++){
    u.moving=i%12===0;u.crouchMoveRequested=u.moving;stepCrouchLocomotion(u,time+=1/60,1/60);
    assert.equal(u.crouchTravel,1);assert.deepEqual(adultFrameChoice(u,time),{group:'crouch8',index:3});
    assert.equal(infantryGeometry(u).bodyHeight,28);
  }
  u.moving=false;u.crouchMoveRequested=false;u.crouchStoppedFor=0;
  for(let i=0;i<Math.floor(CROUCH_STOP_GRACE_S*60);i++)stepCrouchLocomotion(u,time+=1/60,1/60);
  assert.equal(u.crouchTravel,1);
  let last=28;const cels=new Set();
  for(let i=0;i<56;i++){stepCrouchLocomotion(u,time+=1/60,1/60);
    const height=infantryGeometry(u).bodyHeight;assert(height<=last&&last-height<=.1);last=height;
    const f=adultFrameChoice(u,time);if(f.group==='stance16')cels.add(f.index);}
  assert.deepEqual([...cels],[2,3,4,5,6,7]);assert.equal(u.crouchTravel,0);
  assert.deepEqual(adultFrameChoice(u,time),{group:'actions20',index:1});
});

test('resuming halfway through settling reverses continuously instead of teleporting the body',()=>{
  const u=one(arena(),0,1000,{crouchTravel:1,crouchStoppedFor:2});let time=0;
  for(let i=0;i<24;i++)stepCrouchLocomotion(u,time+=1/60,1/60);
  const before=u.crouchTravel;assert(before>0&&before<1);assert(!requestCrouchStep(u));
  stepCrouchLocomotion(u,time+=1/60,1/60);assert(u.crouchTravel>before&&u.crouchTravel-before<.02);
  for(let i=0;i<60;i++){requestCrouchStep(u);stepCrouchLocomotion(u,time+=1/60,1/60);}
  assert(requestCrouchStep(u));assert.equal(u.crouchTravel,1);
});

test('lowering for a dry-mag reload precedes all eight magazine beats and real replenishment',()=>{
  const s=arena(),u=one(s,0,1000,{crouchTravel:1,ammo:0,ammoReserve:30});setOrder(s,0,'hold');
  startMagazineDrill(u,0,2.5);assert.equal(u.reloadingStartAt,CROUCH_STEP_S);
  const seen=new Set();for(let i=0;i<205;i++){tick(s,1/60);const f=adultFrameChoice(u,s.time);
    if(s.time<CROUCH_STEP_S-.001){assert.equal(u.ammo,0);assert.equal(f.group,'stance16');}
    else if(s.time<u.reloadingUntil){assert.equal(f.group,'lowReload16');seen.add(f.index);}}
  assert.deepEqual([...seen],[0,1,2,3,4,5,6,7]);assert.equal(u.ammo,30);assert.equal(u.ammoReserve,0);
});

test('actual firing waits for the low body to settle and resumes without changing stance',()=>{
  const s=arena(),u=one(s,0,1000,{crouchTravel:.7,crouchStoppedFor:2,cooldown:0});
  one(s,1,1200);setOrder(s,0,'hold');setOrder(s,1,'hold');refreshVision(s);
  while(crouchMotionActive(u)){const before=u.shots;tick(s,1/60);assert.equal(u.shots,before);}
  step(s,1.2);assert(u.shots>0);assert.equal(u.pose,'crouch');
});

test('cross-height transitions start at the actual travel height, with continuous hit geometry',()=>{
  for(const to of ['idle','prone']){const s=arena(),u=one(s,0,1000,{crouchTravel:1,
      stanceLockUntil:0,tactic:to==='idle'?'advance':'prone'});
    setOrder(s,0,to==='idle'?'advance':'prone');tick(s,1/60);
    assert.equal(u.poseAnimFromTravel,1);assert.equal(poseTransitionChoice(u,s.time).index,2);
    assert.equal(infantryGeometry(u).bodyHeight,28);}
});

test('a crouch march enters its travel height directly rather than kneeling then rising again',()=>{
  const s=arena(),u=one(s,0,1000,{pose:'idle',poseAnimSeen:'stand',stanceLockUntil:0,tactic:'advance'});
  setOrder(s,0,'crouch');tick(s,1/60);assert.equal(u.poseAnimToTravel,1);
  step(s,1.4);assert.equal(u.crouchTravel,1);assert(u.moving);
});

test('casualty, surrender and terrain motion discard the healthy low-motion state',()=>{
  for(const patch of [{wounded:true},{surrendered:true},{hp:0},{motion:'jump'},{rappelling:true},{pose:'prone'}]){
    const u=one(arena(),0,1000,{crouchTravel:.4,crouchMoveRequested:true,...patch});
    stepCrouchLocomotion(u,10,1/60);assert.equal(u.crouchTravel,undefined);}
});

test('drawing repeatedly cannot change movement clocks, feet, ammunition or off-screen outcomes',()=>{
  const a=arena(),u=one(a);setOrder(a,0,'crouch');const b=structuredClone(a);
  for(let i=0;i<300;i++){if(i===90){setOrder(a,0,'hold');setOrder(b,0,'hold');}
    tick(a,1/60);tick(b,1/60);for(let j=0;j<4;j++)adultFrameChoice(u,a.time);}
  assert.deepEqual(a.units,b.units);
});

test('a committed first step still stops outside a newly revealed hostile front',()=>{
  for(const side of [0,1]){const s=arena(),dir=side?-1:1,u=one(s,side);setOrder(s,side,'crouch');
    step(s,.5);assert(crouchMotionActive(u));assert(u.crouchStepCommittedUntil>s.time);
    const e=one(s,1-side,u.x+dir*105);setOrder(s,1-side,'hold');refreshVision(s);
    step(s,2);assert((e.x-u.x)*dir>=105-.01);}
});

test('a soldier still rising or lowering cannot be credited as ready covering fire',()=>{
  const s=arena(),u=one(s),v=one(s,0,960,{cooldown:0,lastCombatShotAt:0}),e=one(s,1,1280);
  v.squad=u.squad;refreshVision(s);assert(coveringMate(s,u,e,true));
  v.crouchTravel=.5;assert(!coveringMate(s,u,e,true));
  v.crouchTravel=1;assert(coveringMate(s,u,e,true));
});

test('upright bounds still end instead of waiting forever for a nonexistent low-step phase',()=>{
  const s=arena(),u=one(s,0,1000,{pose:'idle',poseAnimSeen:'stand',tactic:'bound',cooldown:0}),
    mate=one(s,0,960,{cooldown:0});mate.squad=u.squad;
  one(s,1,1330);setOrder(s,1,'hold');refreshVision(s);let run=0,longest=0,moved=0,stopped=0;
  for(let i=0;i<180;i++){const x=u.x;tick(s,1/60);if(u.x>x+.01){moved++;longest=Math.max(longest,++run);}
    else{run=0;if(moved)stopped++;}}
  assert(moved>5);assert(stopped>30);assert(longest<=45);assert(u.shots>0);
});
