import assert from 'node:assert/strict';
import test from 'node:test';
import {createGame,startGame,spawnUnit,tick,setOrder,refreshVision} from '../game/engine.ts';
import {adultFrameChoice,ownsAdultBody} from '../game/adult-animation.ts';
import {magazineReloadActive,stanceTransitionActive} from '../game/infantry-action-timing.ts';
import {heavyMGFrame} from '../game/heavy-mg-art.ts';

function arena(){const s=createGame(143);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.weather.disabled=true;s.night=false;return s;}
function one(s,side=0,x=1000,extra={}) {const n=s.units.length;spawnUnit(s,side,extra.id??'infantry',x);
  const u=s.units[n];s.units.splice(n+1);Object.assign(u,{x,y:374,lane:0,pose:'crouch',poseAnimSeen:'crouch',
    stanceLockUntil:100,motion:'ground',hp:10000,maxHp:10000,shots:0,decisionIn:1000,tactic:'crouch',
    cooldown:0,stillFor:5,moving:false,personalMorale:100,suppression:0,readyAt:-100,fragLeft:0,
    fire:0,flash:0,aimUntil:100,...extra});return u;}

test('ordinary rifle shots cycle the weapon, not the whole magazine/body',()=>{
  for(const side of [0,1])for(const pose of ['idle','crouch','prone']){
    const s=arena(),u=one(s,side,1000,{pose,poseAnimSeen:pose==='idle'?'stand':pose});
    one(s,1-side,1000+(side?-1:1)*160,{cooldown:1000});
    setOrder(s,0,'hold');setOrder(s,1,'hold');refreshVision(s);
    for(let i=0;i<360&&u.shots<3;i++){
      tick(s,1/60);
      assert.equal(u.reloadingUntil??0,0,`${pose}: false magazine clock after ${u.shots} shots`);
      assert(!magazineReloadActive(u,s.time));
      assert(!['reload8','lowReload16'].includes(adultFrameChoice(u,s.time).group));
    }
    assert.equal(u.shots,3);assert.equal(u.ammo,27);
  }
});

test('empty rifle magazines run eight pose-specific cels then consume exactly one reserve refill',()=>{
  for(const pose of ['idle','crouch','prone']){
    const s=arena(),u=one(s,0,1000,{pose,poseAnimSeen:pose==='idle'?'stand':pose,ammo:1,ammoReserve:60});
    one(s,1,1160,{cooldown:1000});setOrder(s,0,'hold');setOrder(s,1,'hold');refreshVision(s);
    for(let i=0;i<180&&u.ammo;i++)tick(s,1/60);
    assert.equal(u.ammo,0);assert.equal(u.reloadingUntil-u.reloadingStartAt,2.5);
    const seen=new Set(),end=u.reloadingUntil;
    while(s.time<end){const f=adultFrameChoice(u,s.time);assert(ownsAdultBody(f));
      assert.equal(f.group,pose==='idle'?'reload8':'lowReload16');seen.add(f.index);tick(s,1/60);}
    assert.deepEqual([...seen],Array.from({length:8},(_,i)=>i+(pose==='prone'?8:0)));
    assert(u.ammo>0&&u.ammo<=30);assert.equal(u.ammoReserve,30);
  }
});

test('sharing, scavenging and observer decorations cannot mask a real receiver reload',()=>{
  for(const patch of [{ammoShareUntil:10},{scavengeUntil:10},{id:'scouts'},{id:'sniper_team',member:0}]){
    const s=arena(),u=one(s,0,1000,{pose:'prone',poseAnimSeen:'prone',ammo:0,
      reloadingStartAt:0,reloadingUntil:2.5,...patch});
    for(let i=0;i<8;i++)assert.deepEqual(adultFrameChoice(u,(i+.5)/8*2.5),{group:'lowReload16',index:8+i});
  }
});

test('tactical top-up is a real drill but a stale nonempty clock is not',()=>{
  const s=arena(),u=one(s,0,1000,{ammo:12,ammoReserve:60,reloadingStartAt:0,reloadingUntil:2.5});
  assert(!magazineReloadActive(u,1));assert.equal(adultFrameChoice(u,1).group,'actions20');
  u.tacticalReload=true;assert(magazineReloadActive(u,1));assert.equal(adultFrameChoice(u,1).group,'lowReload16');
  setOrder(s,0,'hold');for(let i=0;i<151;i++)tick(s,1/60);
  assert.equal(u.ammo,30);assert.equal(u.ammoReserve,42);assert(!u.tacticalReload);
});

test('heavy belt reload keeps the gun drill and never selects a rifle magazine animation',()=>{
  const s=arena(),u=one(s,0,1000,{id:'heavy_mg',member:0,ammo:0,reloadingStartAt:0,reloadingUntil:5});
  for(let i=0;i<4;i++){const t=(i+.5)/4*5;
    assert.deepEqual(adultFrameChoice(u,t),{group:'actions20',index:1});assert.equal(heavyMGFrame(u,t),4+i);}
});

test('retreat locomotion is never frozen by a reload animation',()=>{
  const s=arena(),u=one(s,0,1000,{pose:'idle',poseAnimSeen:'stand',ammo:0,ammoReserve:30,
    reloadingStartAt:0,reloadingUntil:2.5,tactic:'retreat',squadOrder:'retreat',aimUntil:0});const start=u.x;
  for(let i=0;i<120;i++)tick(s,1/60);
  assert(u.x<start-5);assert(u.moving);assert(!ownsAdultBody(adultFrameChoice(u,s.time)));
});

test('posture transitions plant lateral formation movement as well as forward movement',()=>{
  const s=arena(),u=one(s);Object.assign(u,{pose:'idle',poseAnimSeen:'stand',stanceLockUntil:0,
    lane:28,tactic:'advance',decisionIn:0});setOrder(s,0,'prone');
  tick(s,1/60);assert(stanceTransitionActive(u,s.time));const position=[u.x,u.lane];
  for(let i=0;i<80;i++){tick(s,1/60);assert(stanceTransitionActive(u,s.time));assert.deepEqual([u.x,u.lane],position);}
});
