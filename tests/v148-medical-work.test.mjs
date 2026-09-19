import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, startGame, spawnUnit, tick, setOrder } from '../game/engine.ts';
import { adultFrameChoice, medicalWorkChoice, ownsAdultBody, idlePoseChoice } from '../game/adult-animation.ts';
import { beginSupportTick, continueSupportWork } from '../game/support-work.ts';
import { repairStation } from '../game/repair-work.ts';
import { createRequire } from 'node:module';
import { medicalOriginalFrames } from '../scripts/bake-v148-medical-work.mjs';
import { packedMedicalFrames } from '../game/medical-art.ts';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};

function arena() {
  const s = createGame(148); startGame(s); s.aiIn = 1e9;
  s.units = []; s.scenery = []; s.walls = []; s.terrain.fill(374); s.original.fill(374);
  s.weather.disabled = true; s.night = false; setOrder(s,0,'hold'); setOrder(s,1,'hold');
  return s;
}
function one(s, id = 'medic_team', extra = {}) {
  const n=s.units.length; spawnUnit(s,0,id,1000); s.units.splice(n+1); const u=s.units[n];
  Object.assign(u,{x:1000,y:374,lane:0,moving:false,motion:'ground',climbing:0,pose:'crouch',
    poseAnimSeen:'crouch',poseAnimFrom:undefined,poseAnimAt:undefined,stanceLockUntil:0,crouchTravel:0,
    hp:10000,maxHp:10000,personalMorale:100,suppression:0,readyAt:-100,medicalReadyAt:0,
    fragLeft:0,fire:0,secondaryFire:0,flash:0,aimUntil:0,decisionIn:1e6,tactic:'advance',
    cooldown:1e6,ammo:30,ammoReserve:100,squadOrder:'hold',squadOrderUntil:Infinity, ...extra}); return u;
}

test('all three medical postures have eight owned cels on a real task clock',()=>{
  for(const [pose,offset] of [['idle',0],['crouch',8],['hunker',8],['prone',16]]) {
    const u=one(arena(),'medic_team',{pose,tending:true,tendingKind:'medical'});
    const seen=new Set();
    for(let i=0;i<8;i++) {
      u.tendingTime=(i+.5)*.3;
      const before=structuredClone(u), choice=adultFrameChoice(u,1234);
      assert.deepEqual(choice,{group:'medical24',index:offset+i});
      assert(ownsAdultBody(choice)); assert.equal(idlePoseChoice(u,1234),null);
      assert.deepEqual(u,before);seen.add(choice.index);
    }
    assert.equal(seen.size,8);
  }
});

test('moving, descent, injury and posture transitions cannot be replaced by bandaging',()=>{
  for(const patch of [{moving:true},{motion:'jump'},{motion:'land'},{climbing:1},{rappelling:true},
    {parachuting:true},{hp:0},{wounded:true},{surrendered:true},{crouchTravel:.5},
    {poseAnimFrom:'stand',poseAnimSeen:'crouch',poseAnimAt:10}]) {
    const u=one(arena(),'medic_team',{tending:true,tendingKind:'medical',...patch});
    assert.equal(medicalWorkChoice(u,10.4),null,JSON.stringify(patch));
    assert.notEqual(adultFrameChoice(u,10.4).group,'medical24');
  }
});

test('buddy aid uses its own deadline rather than the global animation phase',()=>{
  for(const pose of ['idle','crouch','prone']) {
    const u=one(arena(),'infantry',{pose,firstAidUntil:21.5,firstAidTargetUid:999});
    for(let i=0;i<8;i++) {
      const f=adultFrameChoice(u,20+(i+.5)/8*1.5);
      assert.equal(f.group,'medical24');assert.equal(f.index%8,i);
    }
    assert.notEqual(adultFrameChoice(u,21.5).group,'medical24');
  }
});

test('continuous work survives healing pulses but changing target or task restarts it',()=>{
  const u=one(arena());
  for(let i=0;i<180;i++) {
    const prev=beginSupportTick(u);
    continueSupportWork(u,prev,'medical',77,i/60,1/60);
    assert(Math.abs(u.tendingTime-(i+1)/60)<1e-8);
  }
  continueSupportWork(u,beginSupportTick(u),'medical',88,3,1/60);
  assert.equal(u.tendingTime,1/60);
  continueSupportWork(u,beginSupportTick(u),'repair',88,3.1,1/60);
  assert.equal(u.tendingTime,1/60);assert.equal(u.tendingKind,'repair');
  beginSupportTick(u);
  assert.deepEqual([u.tending,u.tendingTime,u.tendingKind,u.tendingTargetUid],[false,0,undefined,undefined]);
});

test('a posture drill finishes before the medical clock starts',()=>{
  const u=one(arena(), 'medic_team',{poseAnimFrom:'stand',poseAnimSeen:'crouch',poseAnimAt:0});
  for(let i=0;i<72;i++) {
    continueSupportWork(u,beginSupportTick(u),'medical',77,i/60,1/60);
    assert.equal(u.tendingTime,0);assert.equal(adultFrameChoice(u,i/60).group,'stance16');
  }
  continueSupportWork(u,beginSupportTick(u),'medical',77,1.2,1/60);
  assert.equal(u.tendingTime,1/60);assert.deepEqual(adultFrameChoice(u,1.2),{group:'medical24',index:8});
});

test('actual medics keep their planted stance beyond two expired stance locks',()=>{
  for(const pose of ['crouch','prone']) {
    const s=arena(),m=one(s,'medic_team',{pose,poseAnimSeen:pose});
    const p=one(s,'infantry',{x:1040,hp:1000,maxHp:10000,stanceLockUntil:100});
    if(pose==='prone') setOrder(s,0,'prone');
    // First commitment is explicit; this test targets repeated generic AI decisions.
    m.tending=true;m.tendingKind='medical';m.tendingTargetUid=p.uid;
    for(let i=0;i<25*60;i++) {
      tick(s,1/60);
      assert.equal(m.pose,pose);assert.equal(m.tendingKind,'medical',JSON.stringify({time:s.time,m:[m.x,m.tactic,m.squadOrder,m.moving,m.withdrawUntil,m.hp],p:[p.x,p.hp,p.surrendered,p.wounded]}));
      assert.equal(m.tendingTargetUid,p.uid);assert.equal(adultFrameChoice(m,s.time).group,'medical24');
    }
    assert(p.hp>1000); assert(m.tendingTime>24.9);
    p.hp=p.maxHp;tick(s,1/60);assert.equal(m.tending,false);assert.equal(m.tendingTime,0);
  }
});

test('medical work is cleared on a casualty early-return path',()=>{
  const s=arena(),u=one(s,'medic_team',{hp:0,tending:true,tendingKind:'medical',tendingTime:8,tendingTargetUid:999});
  tick(s,1/60);assert.equal(u.tending,false);assert.equal(u.tendingTime,0);assert.equal(u.tendingKind,undefined);
});

test('a standing medic respects the existing lock then lowers once before knee work',()=>{
  const s=arena(),m=one(s,'medic_team',{pose:'idle',poseAnimSeen:'stand',stanceLockUntil:10});
  one(s,'infantry',{x:1040,hp:1000,maxHp:10000});
  let transitions=0,last='stand';const rows=new Set();
  for(let i=0;i<15*60;i++){
    tick(s,1/60);const f=adultFrameChoice(m,s.time),next=m.pose==='crouch'?'crouch':'stand';
    if(next!==last){transitions++;last=next;assert(s.time>=10);}
    if(f.group==='medical24')rows.add(Math.floor(f.index/8));
    else assert.equal(f.group,'stance16');
    if(f.group==='stance16')assert.equal(m.tendingTime,0);
  }
  assert.equal(transitions,1);assert.deepEqual([...rows],[0,1]);assert.equal(m.pose,'crouch');
});

test('approaching a downed patient uses locomotion, not a moving bandaging body',()=>{
  const s=arena(),m=one(s,'medic_team');
  const p=one(s,'infantry',{x:1135,hp:100,maxHp:10000,wounded:true,bleedOut:60,firstAidByUid:999});
  let moved=false,treated=false;
  for(let i=0;i<5*60;i++){
    const before=m.x;tick(s,1/60);moved ||= m.x!==before;
    if(Math.abs(m.x-p.x)>64){assert.equal(m.tending,false);assert.notEqual(adultFrameChoice(m,s.time).group,'medical24');}
    if(m.tendingKind==='medical'){treated=true;break;}
  }
  assert(moved);assert(treated);
});

test('repair has its own state and stops when the vehicle is fully repaired',()=>{
  const s=arena(),u=one(s,'combat_engineers'),v=one(s,'tank',{x:1040,hp:500,maxHp:600});
  u.x=repairStation(u,v);
  tick(s,1/60);assert.equal(u.tendingKind,'repair');assert.notEqual(adultFrameChoice(u,s.time).group,'medical24');
  v.hp=v.maxHp;tick(s,1/60);assert.equal(u.tending,false);assert.equal(u.tendingTime,0);
});

test('nonmedical low work no longer borrows crawling frame 13',()=>{
  for(const patch of [{tending:true,tendingKind:'repair'},{scavengeUntil:30},{ammoShareUntil:30},
    {overheatedUntil:30},{emplacementSetupUntil:30}]) {
    const u=one(arena(),'infantry',patch);
    for(let t=0;t<10;t+=.1) {
      const f=adultFrameChoice(u,t);assert.deepEqual(f,{group:'actions20',index:1});
    }
  }
});

test('prepared medical cels preserve every calibrated RGBA pixel and fixed contacts',async()=>{
  const raw=await medicalOriginalFrames();
  const packed=packedMedicalFrames(await loadImage(new URL('../public/art/medical-work-frames-v148.png',import.meta.url).pathname));
  for(let i=0;i<24;i++){
    const data=packed[i].getContext('2d').getImageData(0,0,128,96).data;
    assert.deepEqual(data,raw[i].getContext('2d').getImageData(0,0,128,96).data);
    let top=96,bottom=-1,left=128,right=-1;
    for(let p=0;p<data.length;p+=4)if(data[p+3]>=128){const x=p/4%128,y=Math.floor(p/4/128);
      top=Math.min(top,y);bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);}
    assert(bottom>=94&&bottom<=95);assert(left>0&&right<127);
    const expected=i<8?64:i<16?44:21;
    assert(Math.abs(bottom-top+1-expected)<=2,`${i}: unexpected posture height`);
  }
});
