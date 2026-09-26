import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,spawnUnit,tick,setOrder,refreshVision,W} from '../game/engine.ts';
import {soldierBusyMoving,soldierAimWeight} from '../game/soldier-pose.ts';

const dt=1/60;
function arena() {
  const s=createGame(184);startGame(s);
  s.units=[];s.scenery=[];s.walls=[];s.terrain.fill(374);s.original.fill(374);s.aiIn=1e9;
  return s;
}
function actor(s,side,id,x,pose='idle') {
  spawnUnit(s,side,id,x,{member:0});
  const u=s.units.at(-1);
  Object.assign(u,{hp:10000,maxHp:10000,decisionIn:100,fragLeft:0,cooldown:0,
    secondaryCooldown:0,readyAt:-10,pose,poseAnimSeen:pose==='prone'?'prone':'stand',
    stanceLockUntil:100,lane:0,rapidUntil:0,gaitWeight:0,gaitRun:0,rifleReady:1,
    aimUntil:100,proneTravel:pose==='prone'?1:undefined});
  return u;
}
function passiveTarget(s,u,distance=180) {
  const v=actor(s,1-u.side,'infantry',u.x+(u.side?-1:1)*distance);
  v.cooldown=100;v.secondaryCooldown=100;setOrder(s,v.side,'hold');refreshVision(s);
  return v;
}

test('the first running or crawling stride suppresses inherited aiming even before gait weight rises',()=>{
  for(const patch of [{pose:'run'},{pose:'walk',tactic:'retreat'},{pose:'prone'}]) {
    const u={id:'infantry',...patch,moving:true,gaitWeight:0,gaitRun:0,rifleReady:1,
      aimUntil:100,fire:.2,secondaryFire:.1};
    assert(soldierBusyMoving(u));assert.equal(soldierAimWeight(u,20),0);
  }
  assert(!soldierBusyMoving({id:'infantry',pose:'walk',moving:true,gaitWeight:1,gaitRun:0}));
});

test('a running or crawling rifleman settles and resumes fire after encountering a target',()=>{
  for(const side of [0,1])for(const mode of ['run','prone']) {
    const s=arena(),u=actor(s,side,'infantry',side?W-700:700,mode);
    setOrder(s,side,mode==='run'?'rush':'prone');
    const initialX=u.x;
    for(let frame=0;frame<120;frame++)tick(s,dt);
    assert(Math.abs(u.x-initialX)>20,`${side}/${mode}: fixture never travels`);
    assert(soldierBusyMoving(u));assert.equal(soldierAimWeight(u,s.time),0);
    passiveTarget(s,u);setOrder(s,side,'hold');
    let busyFrames=0,firstShot;
    for(let frame=0;frame<180;frame++) {
      const before=u.shots;tick(s,dt);
      if(soldierBusyMoving(u)) {
        busyFrames++;assert.equal(u.shots,before,`${side}/${mode}: shoots before the legs settle`);
        assert.equal(soldierAimWeight(u,s.time),0);
      }
      if(u.shots>before)firstShot??=frame;
    }
    assert(busyFrames>=5,`${side}/${mode}: no stopping transition was exercised`);
    assert(firstShot>=5&&firstShot<60,`${side}/${mode}: target planning deadlocked after stopping`);
    assert(u.shots>=2,`${side}/${mode}: only one accidental shot, no continued firing`);
  }
});

test('infantry self-defence cannot fire on the same tick that starts a sprint or crawl',()=>{
  for(const side of [0,1])for(const mode of ['run','prone']) {
    const s=arena(),u=actor(s,side,'javelin',side?W-700:700,mode==='run'?'idle':'prone');
    passiveTarget(s,u);setOrder(s,side,mode==='run'?'rush':'prone');
    for(let frame=0;frame<20;frame++) {
      tick(s,dt);
      assert(u.moving,`${side}/${mode}/${frame}: fixture did not start moving`);
      assert(soldierBusyMoving(u));
      assert.equal(u.secondaryShots,0,`${side}/${mode}/${frame}: sidearm releases during movement`);
      assert(!s.projectiles.some(p=>p.sourceUid===u.uid),`${side}/${mode}/${frame}: hidden moving shot`);
    }
  }
});

test('a launcher team sidearm resumes after its sprint or crawl settles',()=>{
  for(const side of [0,1])for(const mode of ['run','prone']) {
    const s=arena(),u=actor(s,side,'javelin',side?W-700:700,mode);
    setOrder(s,side,mode==='run'?'rush':'prone');
    for(let frame=0;frame<120;frame++)tick(s,dt);
    assert(u.moving&&soldierBusyMoving(u));
    passiveTarget(s,u);setOrder(s,side,'hold');
    let firstShot;
    for(let frame=0;frame<180;frame++) {
      const before=u.secondaryShots;tick(s,dt);
      if(soldierBusyMoving(u))assert.equal(u.secondaryShots,before);
      if(u.secondaryShots>before)firstShot??=frame;
    }
    assert(firstShot>=5&&firstShot<60,`${side}/${mode}: sidearm never resumes after stopping`);
    assert(u.secondaryShots>=2);assert.equal(u.shots,0,'anti-armour ammunition wasted on infantry');
  }
});

test('vehicle coaxial guns remain independent of infantry gait gates and main-gun reload',()=>{
  for(const id of ['tank','light_tank','heavy_tank','tow_ifv']) {
    const s=arena(),u=actor(s,0,id,700);
    Object.assign(u,{gaitWeight:1,gaitRun:1,cooldown:100});
    passiveTarget(s,u);setOrder(s,0,'hold');
    tick(s,dt);
    assert(u.secondaryShots>0,`${id}: infantry gait blocks a vehicle coaxial gun`);
    assert.equal(u.shots,0,`${id}: main gun ignores its reload`);
    assert(s.projectiles.some(p=>p.sourceUid===u.uid&&p.weapon==='coax'));
  }
});

test('a fleeing soldier cannot use the low-morale conflict shot while his running gait is active',()=>{
  for(const busy of [false,true]) {
    const s=arena(),u=actor(s,0,'rocket',2000,busy?'run':'idle'),friend=actor(s,0,'rocket',1962);
    Object.assign(u,{tactic:'retreat',retreatUntil:100,personalMorale:0,
      gaitWeight:busy?1:0,gaitRun:busy?1:0,moving:busy});
    Object.assign(friend,{squad:u.squad,personalMorale:0});
    for(const v of s.units){v.cooldown=100;v.injuryCooldown=100;}
    // This deterministic draw triggers the stationary control's 0.4 chance.
    s.seed=0;tick(s,.001);
    const shots=s.projectiles.filter(p=>p.sourceUid===u.uid&&p.targetUid===friend.uid);
    assert.equal(shots.length,busy?0:1,busy?'running conflict shot bypasses the gait gate':'control never exercises the conflict branch');
    if(busy)assert(u.moving&&soldierBusyMoving(u));
    else assert(!u.moving);
  }
});
