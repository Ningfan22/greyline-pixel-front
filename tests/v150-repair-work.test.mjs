import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame,startGame,spawnUnit,tick,setOrder,refreshVision } from '../game/engine.ts';
import { adultFrameChoice,repairWorkChoice,ownsAdultBody,idlePoseChoice } from '../game/adult-animation.ts';
import { pickRepairVehicle,repairStation,atRepairContact,REPAIR_FIRST_WORK_S } from '../game/repair-work.ts';
import { stanceTransitionActive } from '../game/infantry-action-timing.ts';
import { createRequire } from 'node:module';
import { repairOriginalFrames } from '../scripts/bake-v150-repair.mjs';
import { packedRepairFrames } from '../game/repair-art.ts';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};

function arena(){const s=createGame(150);startGame(s);s.aiIn=1e9;s.units=[];s.walls=[];s.scenery=[];
  s.terrain.fill(374);s.original.fill(374);s.weather.disabled=true;s.night=false;
  setOrder(s,0,'hold');setOrder(s,1,'hold');return s;}
function one(s,id='combat_engineers',patch={}){const n=s.units.length;spawnUnit(s,patch.side??0,id,1000);
  const u=s.units[n];s.units.splice(n+1);Object.assign(u,{x:1000,y:374,lane:0,pose:'crouch',
    poseAnimSeen:'crouch',poseAnimFrom:undefined,poseAnimAt:undefined,stanceLockUntil:100,
    crouchTravel:0,moving:false,motion:'ground',climbing:0,hp:10000,maxHp:10000,personalMorale:100,
    suppression:0,readyAt:-100,fragLeft:0,fire:0,secondaryFire:0,flash:0,aimUntil:0,cooldown:1e6,
    decisionIn:1e6,tactic:'advance',squadOrder:'hold',squadOrderUntil:Infinity,ammo:30,ammoReserve:100,
    ...patch});return u;}

test('all 34 owned tool cels retain committed height and require a real mechanic task',()=>{
  for(const [pose,offset] of [['idle',0],['crouch',12],['hunker',12],['prone',24]]){
    const u=one(arena(),'combat_engineers',{pose,tending:true,tendingKind:'repair'});
    const count=pose==='prone'?10:12;
    for(let i=0;i<count;i++){
      u.tendingTime=(i+.5)/count*2.4;const before=structuredClone(u),f=adultFrameChoice(u,123);
      assert.deepEqual(f,{group:'repair34',index:offset+i});assert(ownsAdultBody(f));
      assert.equal(idlePoseChoice(u,123),null);assert.deepEqual(u,before);
    }
    u.tendingTime=2.4;assert.equal(adultFrameChoice(u,123).index,offset);
    u.id='infantry';assert.equal(repairWorkChoice(u,123),null);
  }
});

test('casualties, descent, movement and stance transitions own the body before repair',()=>{
  for(const patch of [{hp:0},{wounded:true},{surrendered:true},{rappelling:true},{parachuting:true},
    {moving:true},{motion:'jump'},{motion:'land'},{climbing:1},{crouchTravel:.5},
    {poseAnimFrom:'stand',poseAnimSeen:'crouch',poseAnimAt:10}]){
    const u=one(arena(),'combat_engineers',{tending:true,tendingKind:'repair',...patch});
    assert.equal(repairWorkChoice(u,10.4),null);assert.notEqual(adultFrameChoice(u,10.4).group,'repair34');
  }
});

test('repair assignment is stable across health pulses and reacquired only when invalid',()=>{
  const s=arena(),u=one(s),a=one(s,'tank',{x:1190,hp:500,maxHp:1000}),b=one(s,'light_tank',{x:900,hp:600,maxHp:1000});
  assert.equal(pickRepairVehicle(s,u),a);const first=repairStation(u,a);
  a.hp=800;assert.equal(pickRepairVehicle(s,u),a);assert.equal(repairStation(u,a),first);
  a.hp=a.maxHp;assert.equal(pickRepairVehicle(s,u),b);assert.equal(u.repairSide,1);
  b.surrendered=true;assert.equal(pickRepairVehicle(s,u),undefined);assert.equal(u.repairTargetUid,undefined);
  b.surrendered=false;b.side=1;assert.equal(pickRepairVehicle(s,u),undefined);
});

test('both armies approach the real hull end and perform steady work without stance chatter',()=>{
  for(const side of [0,1])for(const pose of ['crouch','prone']){
    const s=arena(),dir=side?-1:1,u=one(s,'combat_engineers',{side,pose,poseAnimSeen:pose,x:1000});
    const v=one(s,'tank',{side,x:1000+dir*240,hp:100,maxHp:10000});
    const seen=new Set();let workTicks=0,lastHealth=v.hp,firstWorkX;
    for(let i=0;i<27*60;i++){
      tick(s,1/60);const f=adultFrameChoice(u,s.time);
      if(u.tendingKind==='repair'){
        assert(atRepairContact(u,v));assert.equal(u.pose,pose);assert.equal(u.moving,false);
        if(!stanceTransitionActive(u,s.time)&&(u.crouchTravel??0)===0){
          assert.equal(f.group,'repair34');seen.add(f.index);workTicks++;firstWorkX??=u.x;
          assert.equal(u.x,firstWorkX);
        }
      } else assert.notEqual(f.group,'repair34');
      if(v.hp>lastHealth){assert(u.tendingTime>=REPAIR_FIRST_WORK_S);assert(atRepairContact(u,v));}
      lastHealth=v.hp;
    }
    assert(workTicks>1000,`side${side}/${pose}: never worked enough`);assert.equal(seen.size,pose==='prone'?10:12);assert(v.hp>100);
  }
});

test('standing stance lock is honored and no healing occurs while lowering or first reaching',()=>{
  const s=arena(),u=one(s,'combat_engineers',{pose:'idle',poseAnimSeen:'stand',stanceLockUntil:3});
  const v=one(s,'tank',{x:1200,hp:100,maxHp:10000});u.x=repairStation(u,v);
  const rows=new Set();let lastHp=v.hp,transitions=0,prevPose=u.pose;
  for(let i=0;i<12*60;i++){
    tick(s,1/60);const f=adultFrameChoice(u,s.time);
    if(u.pose!==prevPose){transitions++;assert(s.time>=3);prevPose=u.pose;}
    if(stanceTransitionActive(u,s.time)){assert.equal(f.group,'stance16');assert.equal(u.tendingTime,0);assert.equal(v.hp,lastHp);}
    if(f.group==='repair34')rows.add(Math.floor(f.index/12));
    if(v.hp>lastHp)assert(u.tendingTime>=REPAIR_FIRST_WORK_S);
    lastHp=v.hp;
  }
  assert.equal(transitions,1);assert.deepEqual([...rows],[0,1]);
});

test('moving or distant armor cannot be repaired and leaving/full-health cancels the work',()=>{
  const s=arena(),u=one(s),v=one(s,'tank',{x:1200,hp:100,maxHp:10000});u.x=repairStation(u,v);
  v.moving=true;assert(!atRepairContact(u,v));v.moving=false;
  u.x-=20;assert(!atRepairContact(u,v));u.x+=20;
  for(let i=0;i<60;i++)tick(s,1/60);assert.equal(u.tendingKind,'repair');assert(v.hp>100);
  const repaired=v.hp;v.x+=200;tick(s,1/60);assert.equal(u.tending,false);assert.equal(v.hp,repaired);
  v.hp=v.maxHp;tick(s,1/60);assert.equal(u.repairTargetUid,undefined);
});

test('retreat orders and casualties release the mechanic instead of being trapped in repair',()=>{
  for(const patch of [{squadOrder:'retreat',squadOrderX:600},{hp:0},{wounded:true,bleedOut:60},{surrendered:true}]){
    const s=arena(),u=one(s),v=one(s,'tank',{x:1200,hp:100,maxHp:10000});u.x=repairStation(u,v);
    for(let i=0;i<60;i++)tick(s,1/60);assert(u.tending);const hp=v.hp;
    Object.assign(u,patch);tick(s,1/60);assert.equal(u.tending,false);assert.equal(u.repairTargetUid,undefined);
    assert.equal(v.hp,hp);assert.notEqual(adultFrameChoice(u,s.time).group,'repair34');
  }
});

test('a mechanic cannot cross an uncleared contact to reach a vehicle',()=>{
  const s=arena(),u=one(s,'combat_engineers',{x:1000,pose:'idle',poseAnimSeen:'stand'});
  const v=one(s,'tank',{x:1280,hp:100,maxHp:10000});
  one(s,'infantry',{side:1,x:1130});refreshVision(s);
  for(let i=0;i<300;i++){tick(s,1/60);assert(u.x<=1025+.001);assert.equal(u.tending,false);assert.equal(v.hp,100);}
});

test('spawn-edge vehicles offer the reachable hull end and moving vehicles get no repairs',()=>{
  for(const side of [0,1]){
    const s=arena(),width=s.terrain.length,u=one(s,'combat_engineers',{side,x:side?width-130:130});
    const v=one(s,'heavy_tank',{side,x:side?width-130:130,hp:100,maxHp:10000});
    pickRepairVehicle(s,u);assert.equal(u.repairSide,side?-1:1);
    assert(repairStation(u,v)>=125&&repairStation(u,v)<=width-125);
  }
  const s=arena(),u=one(s),v=one(s,'tank',{x:1200,hp:100,maxHp:10000});u.x=repairStation(u,v);
  // Exact constant-speed movement, tested with the vehicle both before and
  // after the mechanic in the unit array, not just a fabricated contact predicate.
  for(const vehicleFirst of [false,true]){
    s.units=vehicleFirst?[v,u]:[u,v];v.moving=true;v.squadOrder='retreat';v.squadOrderX=1800;
    const hp=v.hp;
    for(let i=0;i<60;i++){tick(s,1/60);assert.equal(v.hp,hp);assert.equal(u.tending,false);}
  }
});

test('a full mechanic squad occupies distinct hull ends and leaves the third member free',()=>{
  const s=arena();spawnUnit(s,0,'combat_engineers',1000);const squad=[...s.units];
  const v=one(s,'tank',{x:1200,hp:100,maxHp:10000});
  for(const u of squad)Object.assign(u,{fragLeft:0,readyAt:-100,cooldown:1e6,decisionIn:1e6,
    tactic:'advance',squadOrder:'hold',squadOrderUntil:Infinity});
  for(let i=0;i<1800;i++)tick(s,1/60);
  assert.equal(squad.length,3);assert.equal(new Set(squad.map(u=>u.lane)).size,3);
  const working=squad.filter(u=>u.tendingKind==='repair');assert.equal(working.length,2);
  assert(Math.abs(working[0].x-working[1].x)>250);assert.notEqual(working[0].repairSide,working[1].repairSide);
  for(const u of working)assert.equal(adultFrameChoice(u,s.time).group,'repair34');
  const guard=squad.find(u=>!u.tending);assert.equal(guard.repairTargetUid,undefined);
  v.hp=v.maxHp;tick(s,1/60);for(const u of squad){assert.equal(u.tending,false);assert.equal(u.repairTargetUid,undefined);}
});

test('packed repair cels are lossless with fixed ground contacts and no neighboring frames',async()=>{
  const raw=await repairOriginalFrames(),packed=packedRepairFrames(await loadImage(
    new URL('../public/art/repair-work-frames-v150.png',import.meta.url).pathname));
  assert.equal(raw.length,34);assert.equal(packed.length,34);
  for(let i=0;i<34;i++){
    const d=packed[i].getContext('2d').getImageData(0,0,128,96).data;
    assert.deepEqual(d,raw[i].getContext('2d').getImageData(0,0,128,96).data);
    let left=128,right=-1,top=96,bottom=-1;
    for(let p=0;p<d.length;p+=4)if(d[p+3]>=128){const x=p/4%128,y=Math.floor(p/4/128);
      left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    assert.equal(bottom,95);assert(left>0&&right<127);
    const height=bottom-top+1;assert(i<12?height>=63&&height<=64:i<24?height===43:height===20);
  }
});
