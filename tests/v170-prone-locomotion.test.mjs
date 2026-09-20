import assert from 'node:assert/strict';
import test from 'node:test';
import {tick,setOrder,spawnUnit,refreshVision,ground} from '../game/engine.ts';
import {adultFrameChoice,poseTransitionChoice} from '../game/adult-animation.ts';
import {infantryGeometry} from '../game/infantry-geometry.ts';
import {startMagazineDrill} from '../game/crouch-locomotion.ts';
import {PRONE_STEP_S,PRONE_STOP_GRACE_S,requestProneStep,stepProneLocomotion,proneTravelApplies} from '../game/prone-locomotion.ts';
import {proneStartStop} from './fixtures/prone-start-stop.mjs';
const step=(s,n)=>{for(let i=0;i<n;i++)tick(s,1/60);};

test('both armies prepare all five low authored cels before moving their feet or lane',()=>{
  for(const side of [0,1])for(const id of ['infantry','marines','militia']){
    const {s,u,x,dir}=proneStartStop(side,id),cels=new Set();
    for(let i=0;i<Math.floor(PRONE_STEP_S*60)-1;i++){
      tick(s,1/60);assert.equal(u.x,x);assert.equal(u.lane,0);assert.equal(u.pose,'prone');
      const f=adultFrameChoice(u,s.time);assert.equal(f.group,'stance16');assert(f.index>=11);cels.add(f.index);
    }
    assert.deepEqual([...cels],[15,14,13,12,11]);step(s,24);
    assert(u.moving);assert.equal(u.proneTravel,1);assert((u.x-x)*dir>0);
    assert.equal(adultFrameChoice(u,s.time).group,'crawl2');
  }
});

test('rapid stop/start keeps one low body and gait phase, then a genuine halt settles continuously',()=>{
  const {u}=proneStartStop();Object.assign(u,{proneTravel:1,walk:3.3});let t=0;
  for(let i=0;i<600;i++){
    u.moving=i%12===0;u.proneMoveRequested=u.moving;stepProneLocomotion(u,t+=1/60,1/60);
    assert.equal(u.proneTravel,1);assert.deepEqual(adultFrameChoice(u,t),{group:'crawl2',index:1});
  }
  u.moving=u.proneMoveRequested=false;u.proneStoppedFor=0;
  for(let i=0;i<PRONE_STOP_GRACE_S*60;i++)stepProneLocomotion(u,t+=1/60,1/60);
  assert.equal(u.proneTravel,1);const cels=new Set();let height=17;
  for(let i=0;i<40;i++){
    stepProneLocomotion(u,t+=1/60,1/60);const next=infantryGeometry(u).bodyHeight;
    assert(next<=height&&height-next<.16);height=next;
    const f=adultFrameChoice(u,t);if(f.group==='stance16')cels.add(f.index);
  }
  assert.deepEqual([...cels],[11,12,13,14,15]);assert.equal(u.proneTravel,0);
  assert.deepEqual(adultFrameChoice(u,t),{group:'actions20',index:2});
});

test('restarting a half-settled body reverses from its actual height, not a new full raise',()=>{
  const {u}=proneStartStop();Object.assign(u,{proneTravel:1,proneStoppedFor:2});let t=0;
  for(let i=0;i<20;i++)stepProneLocomotion(u,t+=1/60,1/60);
  const p=u.proneTravel;assert(p>0&&p<1);assert(!requestProneStep(u,t));
  stepProneLocomotion(u,t+=1/60,1/60);assert(u.proneTravel>p&&u.proneTravel-p<.03);
});

test('an explicit prone march lowers directly onto supported elbows, without flattening then raising again',()=>{
  for(const side of [0,1]){
    const {s,u,x,dir}=proneStartStop(side);Object.assign(u,{pose:'idle',poseAnimSeen:'stand',stanceLockUntil:0});
    const cels=new Set();for(let i=0;i<160;i++){
      tick(s,1/60);const f=adultFrameChoice(u,s.time);
      if(f.group==='stance16'){cels.add(f.index);assert(f.index<=11);assert.equal(u.x,x);}
    }
    assert.deepEqual([...cels],Array.from({length:12},(_,i)=>i));
    assert.equal(u.proneTravel,1);assert((u.x-x)*dir>0);assert.equal(u.pose,'prone');
  }
});

test('a genuine ravine cannot launch a slow soldier repeatedly from its distant flat lip',()=>{
  for(const side of [0,1]){
    const {s,u,dir}=proneStartStop(side);u.x=side?964:836;
    for(let x=860;x<=940;x++)s.terrain[x]=374+Math.min(44,(x-860)*2.2,(940-x)*2.2);
    let jumps=0,previous='ground';const seen=new Set();
    for(let i=0;i<14*60;i++){
      const before=u.x;tick(s,1/60);seen.add(u.motion);
      if(u.motion==='jump'&&previous!=='jump'){
        jumps++;assert(ground(s,before+dir*4)-ground(s,before)>6,'support must actually reach the lip');
      }
      previous=u.motion;assert(u.y<=ground(s,u.x)+.01);
    }
    assert(jumps<=2);assert(seen.has('jump')&&seen.has('land')&&seen.has('bank'));
    assert(side?u.x<855:u.x>945);
  }
});

test('ordinary rifle escorts and observers use the bridge; separate specialist weapons remain unchanged',()=>{
  for(const [id,member,expected] of [['machinegun',1,true],['antiarmor',2,true],['sniper_team',1,true],
    ['rocket',0,false],['sniper',0,false],['lmg_team',0,false],['heavy_mg',0,false],['medic_team',0,false],['mortar',0,false]]){
    assert.equal(proneTravelApplies({id,member}),expected,`${id}/${member}`);
    const {u}=proneStartStop(0,id,member);const ready=requestProneStep(u,0);assert.equal(ready,!expected);
  }
});

test('a real moving soldier halts into all eight reload cels before receiving any ammunition',()=>{
  const {s,u}=proneStartStop();step(s,90);assert(u.moving);setOrder(s,0,'hold');
  u.moving=false;u.proneMoveRequested=false;u.ammo=0;u.ammoReserve=30;
  startMagazineDrill(u,s.time,2.5);const start=s.time,seen=new Set();
  assert(Math.abs(u.reloadingStartAt-start-PRONE_STEP_S)<1e-9);
  for(let i=0;i<195;i++){
    tick(s,1/60);const f=adultFrameChoice(u,s.time);
    if(s.time<start+PRONE_STEP_S-.001){assert.equal(u.ammo,0);assert.equal(f.group,'stance16');}
    else if(s.time<u.reloadingUntil){assert.equal(f.group,'lowReload16');seen.add(f.index);assert.equal(u.ammo,0);}
  }
  assert.deepEqual([...seen],[8,9,10,11,12,13,14,15]);assert.equal(u.ammo,30);assert.equal(u.ammoReserve,0);
});

test('a newly observed front still stops a committed prone step before 105, while real shooting resumes after settling',()=>{
  for(const side of [0,1]){
    const {s,u,dir}=proneStartStop(side);step(s,20);assert(u.proneTravel>0&&u.proneTravel<1);
    spawnUnit(s,1-side,'infantry',u.x+dir*105,{member:0});const e=s.units.at(-1);
    Object.assign(e,{x:u.x+dir*105,y:374,lane:0,cooldown:10000,hp:10000,maxHp:10000,decisionIn:1000});
    setOrder(s,1-side,'hold');u.cooldown=0;refreshVision(s);
    step(s,240);assert((e.x-u.x)*dir>=105-1e-6);assert(u.shots>0);assert.equal(u.pose,'prone');
  }
});

test('standing from a crawl begins at its actual height and keeps the ten-second stance contract',()=>{
  const {s,u}=proneStartStop();step(s,90);assert.equal(u.proneTravel,1);
  setOrder(s,0,'advance');u.tactic='advance';u.stanceLockUntil=0;tick(s,1/60);
  assert.equal(u.poseAnimFrom,'prone');assert.equal(u.poseAnimFromTravel,1);
  assert.equal(poseTransitionChoice(u,s.time).index,11);assert.equal(infantryGeometry(u).bodyHeight,17);
  const lock=u.stanceLockUntil;setOrder(s,0,'prone');step(s,180);
  assert.equal(u.stanceLockUntil,lock);assert.notEqual(u.pose,'prone');
});

test('casualties, surrender and airborne motion cannot retain the healthy bridge; render and pause do not advance it',()=>{
  for(const patch of [{wounded:true},{surrendered:true},{hp:0},{motion:'jump'},{rappelling:true},{parachuting:true}]){
    const {u}=proneStartStop();Object.assign(u,{proneTravel:.5,...patch});stepProneLocomotion(u,10,1/60);
    assert.equal(u.proneTravel,undefined);
  }
  const {s,u}=proneStartStop();step(s,10);const snapshot=JSON.stringify(u);
  for(let i=0;i<100;i++)adultFrameChoice(u,s.time+i/60);assert.equal(JSON.stringify(u),snapshot);
  s.status='paused';step(s,100);assert.equal(JSON.stringify(u),snapshot);
});
