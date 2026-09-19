import assert from 'node:assert/strict';
import test from 'node:test';
import {createGame,startGame,spawnUnit,tick,setOrder,refreshVision} from '../game/engine.ts';
import {adultFrameChoice,poseTransitionChoice,idlePoseChoice} from '../game/adult-animation.ts';
import {stanceTransitionActive,stanceTransitionDuration} from '../game/infantry-action-timing.ts';
import {infantryGeometry} from '../game/infantry-geometry.ts';
import {heavyMGFrame} from '../game/heavy-mg-art.ts';

function arena(){const s=createGame(142);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.weather.disabled=true;s.night=false;return s;}
function single(s,side=0,id='infantry',x=1000){const n=s.units.length;spawnUnit(s,side,id,x);
  const u=s.units[n];s.units.splice(n+1);Object.assign(u,{x,y:374,lane:0,pose:'idle',motion:'ground',
    poseAnimSeen:'stand',tactic:'advance',decisionIn:1000,readyAt:-100,hp:1000,maxHp:1000,
    suppression:0,fire:0,secondaryFire:0,flash:0,fragLeft:0});return u;}
const pose={stand:'idle',crouch:'crouch',prone:'prone'};
const expected={stand:{crouch:[0,1,2,3,4,5,6,7],prone:[0,1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]},
  crouch:{stand:[7,6,5,4,3,2,1,0],prone:[8,9,10,11,12,13,14,15]},
  prone:{stand:[15,14,13,12,11,10,9,8,7,6,5,4,3,2,1,0],crouch:[15,14,13,12,11,10,9,8]}};

test('all six posture transitions play the actual authored cels in order, without renderer mutation',()=>{
  for(const [from,targets]of Object.entries(expected))for(const [to,indices]of Object.entries(targets)){
    const u=single(arena());Object.assign(u,{pose:pose[to],poseAnimFrom:from,poseAnimSeen:to,poseAnimAt:10});
    const before=structuredClone(u),duration=stanceTransitionDuration(u),seen=[];
    for(let i=0;i<indices.length;i++){
      const t=10+(i+.5)/indices.length*duration,choice=adultFrameChoice(u,t);
      assert.equal(choice.group,'stance16');seen.push(choice.index);assert.equal(idlePoseChoice(u,t),null);
    }
    assert.deepEqual(seen,indices);assert.equal(poseTransitionChoice(u,10+duration+1e-6),null);
    assert.deepEqual(u,before,'drawing never stamps or clears simulation state');
  }
});

test('reload, hit flashes and work flags cannot interrupt a committed posture drill',()=>{
  for(const patch of [{reloadingUntil:20},{tending:true,tendingTime:.2},{flash:.2},{digging:true},{overheatedUntil:20},
      {fire:.1,secondaryFire:.1},{id:'heavy_mg',member:0,stillFor:4}]){
    const u=single(arena());Object.assign(u,{pose:'crouch',poseAnimFrom:'stand',poseAnimSeen:'crouch',poseAnimAt:10},patch);
    assert.deepEqual(adultFrameChoice(u,10.6),{group:'stance16',index:3});
    assert.equal(heavyMGFrame(u,10.6),null);
  }
});

test('aiming and firing never alternate a kneel with the old hands-and-knees frame',()=>{
  for(const p of ['crouch','hunker','prone']){
    const u=single(arena());u.pose=p;u.aimUntil=100;
    for(let i=0;i<1200;i++){u.fire=(i%13)/60;u.secondaryFire=(i%7)/60;
      assert.deepEqual(adultFrameChoice(u,i/60),{group:'actions20',index:p==='prone'?2:1});}
  }
});

test('idle kit decorations never drop a kneeling rifleman or engineer onto all fours',()=>{
  for(const id of ['infantry','engineers']){
    const u=single(arena(),0,id);Object.assign(u,{pose:'crouch',ammo:12});
    for(let i=0;i<3600;i++){const f=idlePoseChoice(u,i/30);
      if(f)assert.deepEqual(f,{group:'actions20',index:1});}
  }
});

test('casualty/surrender/descent override healthy transition cels without restoring command frames',()=>{
  for(const patch of [{hp:0},{wounded:true,woundedTime:2},{surrendered:true},{rappelling:true}]){
    const u=single(arena());Object.assign(u,{pose:'prone',poseAnimFrom:'stand',poseAnimSeen:'prone',poseAnimAt:0},patch);
    assert.notEqual(adultFrameChoice(u,.6).group,'stance16');
    assert.notEqual(adultFrameChoice(u,.6).group,'signals4');
  }
});

test('hands and feet wait through the real transition, then locomotion resumes on both sides',()=>{
  for(const side of [0,1]){
    const s=arena(),u=single(s,side);setOrder(s,side,'prone');const x=u.x;
    tick(s,1/60);assert(stanceTransitionActive(u,s.time));
    const end=u.poseAnimAt+stanceTransitionDuration(u);
    while(s.time+1/60<end){tick(s,1/60);assert.equal(u.x,x);assert.equal(u.shots,0);}
    setOrder(s,side,'advance');for(let i=0;i<180;i++)tick(s,1/60);
    assert((u.x-x)*(side?-1:1)>5,'posture ownership must not strand the soldier');
  }
});

test('a target in sight cannot draw a rifle shot until the knees have settled',()=>{
  for(const side of [0,1]){
    const s=arena(),u=single(s,side),e=single(s,1-side,'infantry',1000+(side?-1:1)*220);
    e.cooldown=1000;setOrder(s,side,'crouch');setOrder(s,1-side,'hold');refreshVision(s);
    tick(s,1/60);const end=u.poseAnimAt+stanceTransitionDuration(u);
    while(s.time+1/60<end){tick(s,1/60);assert.equal(u.shots,0);}
    for(let i=0;i<120;i++)tick(s,1/60);assert(u.shots>0,'shooting resumes at the real low muzzle');
  }
});

test('the hit body descends continuously through a knee-height waypoint instead of instantly shrinking',()=>{
  for(const [from,targets]of Object.entries(expected))for(const to of Object.keys(targets)){
    const u=single(arena());Object.assign(u,{pose:pose[to],poseAnimFrom:from,poseAnimSeen:to});
    let previous=infantryGeometry({pose:pose[from]}).bodyHeight;
    for(let i=0;i<=120;i++){u.poseAnimProgress=i/120;const height=infantryGeometry(u).bodyHeight;
      assert(Math.abs(height-previous)<.5);previous=height;}
    assert.equal(previous,infantryGeometry({pose:pose[to]}).bodyHeight);
  }
});

test('drawing once, repeatedly, or never has no effect on an off-screen posture clock',()=>{
  const a=arena(),u=single(a);setOrder(a,0,'prone');const b=structuredClone(a);
  for(let i=0;i<240;i++){tick(a,1/60);tick(b,1/60);for(let k=0;k<3;k++)adultFrameChoice(u,a.time);}
  assert.deepEqual(a.units.map(v=>[v.x,v.pose,v.poseAnimAt,v.poseAnimProgress,v.shots]),
    b.units.map(v=>[v.x,v.pose,v.poseAnimAt,v.poseAnimProgress,v.shots]));
});

test('a real active reload finishes before a new posture drill can begin',()=>{
  const s=arena(),u=single(s);setOrder(s,0,'crouch');
  Object.assign(u,{pace:0,ammo:0,ammoReserve:30,reloadingStartAt:0,reloadingUntil:1.5});
  for(let i=0;i<80;i++){tick(s,1/60);assert.equal(u.pose,'idle');
    assert.equal(adultFrameChoice(u,s.time).group,'reload8');}
  for(let i=0;i<15;i++)tick(s,1/60);
  assert.equal(u.pose,'crouch');assert(u.poseAnimAt>=1.5);assert(stanceTransitionActive(u,s.time));
});
