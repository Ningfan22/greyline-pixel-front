import assert from 'node:assert/strict';
import test from 'node:test';
import {createGame,startGame,spawnUnit,tick,setOrder,refreshVision,CARDS,W} from '../game/engine.ts';
import {weaponCard} from '../game/cards.ts';
import {magazine} from '../game/ballistics.ts';
import {heavyMGReady,lightMGBound,machinegunBurst} from '../game/machinegun-team.ts';
import {heavyMGFrame} from '../game/heavy-mg-art.ts';
import {adultFrameChoice} from '../game/adult-animation.ts';
import {suppressNearMiss} from '../game/projectile-depth.ts';
import {buildSpatial} from '../game/spatial.ts';

function arena() {
  const s=createGame(140);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.night=false;s.weather.disabled=true;s.terrain.fill(374);s.original.fill(374);return s;
}
function one(s,side,id,x,extra={}) {
  const n=s.units.length;spawnUnit(s,side,id,x);const u=s.units[n];s.units.splice(n+1);
  Object.assign(u,{x,y:374,lane:0,pace:1,pose:'crouch',poseAnimSeen:'crouch',motion:'ground',
    hp:1000,maxHp:1000,shots:0,decisionIn:1000,tactic:'crouch',cooldown:1000,stillFor:0,
    moving:false,personalMorale:100,suppression:0,readyAt:-100,...extra});return u;
}
const step=(s,t)=>{for(let i=0;i<t*60;i++)tick(s,1/60);};

test('three teams keep distinct gunner magazines, burst drills and ordinary rifle escorts',()=>{
  assert.deepEqual(magazine('lmg_team',0),{mag:60,reserve:180,reload:2.8});
  assert.deepEqual(magazine('machinegun',0),{mag:100,reserve:200,reload:4});
  assert.deepEqual(magazine('heavy_mg',0),{mag:150,reserve:300,reload:5});
  for(const id of ['lmg_team','machinegun','heavy_mg']) {
    assert.equal(weaponCard({id,member:1}).model,'infantry');
    assert.deepEqual(magazine(id,1),{mag:30,reserve:150,reload:2.5});
    assert.equal(machinegunBurst({id,member:1}),null);
  }
  assert.deepEqual(['lmg_team','machinegun','heavy_mg'].map(id=>CARDS[id].members),[2,5,3]);
});

test('heavy gun really waits for setup, then produces an eight-round burst with enhanced near-miss pressure',()=>{
  for(const side of [0,1]) {
    const s=arena(),x=side?2400:1000,dir=side?-1:1;
    const u=one(s,side,'heavy_mg',x,{cooldown:0});one(s,1-side,'infantry',x+dir*400);
    setOrder(s,0,'hold');setOrder(s,1,'hold');refreshVision(s);
    step(s,2.3);assert.equal(u.shots,0);
    const shots=[];
    for(let i=0;i<300&&shots.length<9;i++) {
      const before=u.shots;tick(s,1/60);
      if(u.shots>before){shots.push(s.time);const p=s.projectiles.find(p=>p.sourceUid===u.uid);
        assert.equal(p.suppressionMultiplier,1.75);}
    }
    assert.equal(shots.length,9,JSON.stringify({shots,u}));
    assert(shots[0]>=2.4);assert(shots[8]-shots[7]>=.79);
    assert(shots[1]-shots[0]<.3);assert.equal(u.reloadingUntil??0,0);
    u.moving=true;assert(!heavyMGReady(s,u));tick(s,1/60);assert.equal(u.stillFor,0);
  }
});

test('heavy readiness and authored cels cannot override a casualty, moving body or unfinished stance change',()=>{
  const invalid=[{moving:true},{hp:0},{wounded:true},{surrendered:true},{pose:'idle'},
    {pose:'prone'},{motion:'jump'},{parachuting:true},{rappelling:true},{climbing:1},
    {poseAnimAt:9.5},{fragThrow:.5},{tending:true},{digging:true},{flash:.1}];
  for(const patch of invalid){const s=arena();s.time=10;const u=one(s,0,'heavy_mg',1000,{stillFor:3});
    assert(heavyMGReady(s,u));assert.equal(heavyMGFrame(u,10),0);Object.assign(u,patch);
    assert.equal(heavyMGFrame(u,10),null,JSON.stringify(patch));
    if(!['prone'].includes(patch.pose)&&!('fragThrow'in patch)&&!('tending'in patch)&&!('digging'in patch)&&!('flash'in patch))
      assert(!heavyMGReady(s,u),JSON.stringify(patch));
  }
  const s=arena(),u=one(s,0,'heavy_mg',1000,{ammo:0,reloadingStartAt:10,reloadingUntil:15});
  assert.deepEqual([10,11.3,12.6,14.8].map(t=>heavyMGFrame(u,t)),[4,5,6,7]);
  u.ammo=150;u.reloadingUntil=0;u.lastCombatShotAt=20;
  assert.deepEqual([20,20.07,20.14,20.21,20.3].map(t=>heavyMGFrame(u,t)),[0,1,2,3,0]);
});

test('light gun fires four rounds then pauses, without a fake reload after each burst',()=>{
  const s=arena(),u=one(s,0,'lmg_team',1000,{cooldown:0});one(s,1,'infantry',1400);
  setOrder(s,0,'hold');setOrder(s,1,'hold');refreshVision(s);
  const shots=[];for(let i=0;i<240&&shots.length<5;i++) {const before=u.shots;tick(s,1/60);if(u.shots>before)shots.push(s.time);}
  assert.equal(shots.length,5);assert(shots[4]-shots[3]>=.79);assert(shots[1]-shots[0]<.3);
  assert.equal(u.reloadingUntil??0,0);assert.equal(u.x,1000);
});

test('empty heavy belt invokes all four authored reload cels, then replenishes from real reserve',()=>{
  const s=arena(),u=one(s,0,'heavy_mg',1000,{ammo:1,ammoReserve:300,cooldown:0,stillFor:3,stanceLockUntil:100});
  one(s,1,'infantry',1400);setOrder(s,0,'hold');setOrder(s,1,'hold');refreshVision(s);
  tick(s,1/60);assert.equal(u.ammo,0);assert.equal(u.reloadingUntil-u.reloadingStartAt,5);
  const seen=new Set(),start=s.time;
  for(let i=0;i<300;i++){seen.add(heavyMGFrame(u,s.time));tick(s,1/60);}
  assert.deepEqual([...seen].sort(),[4,5,6,7]);
  step(s,.05);assert(u.ammo>0);assert(u.ammo<=150);assert.equal(u.ammoReserve,150);
  assert(s.time-start>=5);assert(u.shots>=2);
});

test('light-gun bounds require real nearby covering fire and an uncleared-front safety margin, on both sides',()=>{
  for(const side of [0,1]){
    const s=arena(),x=side?2400:1000,dir=side?-1:1;s.time=10;
    const u=one(s,side,'lmg_team',x,{mgBurstRestUntil:10.8});
    const target=one(s,1-side,'infantry',x+dir*400),buddy=one(s,side,'infantry',x-dir*50,{lastCombatShotAt:9.5});
    assert(lightMGBound(s,u,target,'advance'));assert(!lightMGBound(s,u,target,'hold'));
    for(const patch of [{hp:0},{moving:true},{lastCombatShotAt:8},{suppression:60},{x:x-dir*200}]){
      const old={...buddy};Object.assign(buddy,patch);assert(!lightMGBound(s,u,target,'advance'));Object.assign(buddy,old);
    }
    target.x=x+dir*180;assert(!lightMGBound(s,u,target,'advance'));target.x=x+dir*400;
    setOrder(s,1-side,'hold');refreshVision(s);step(s,.5);
    assert.equal(u.x,x,'the knee must rise before the covered bound');
    assert(u.crouchTravel>0&&u.crouchTravel<1);
    buddy.lastCombatShotAt=s.time;step(s,.6);
    assert((u.x-x)*dir>0 && (u.x-x)*dir<=24.01,JSON.stringify({side,x:u.x}));
    assert.equal(u.pose,'crouch');
  }
});

test('spatial pressure queries match a full scan at boundaries, vertical rays and across walls',()=>{
  for(const [sx,sy,tx,ty] of [[240,338,270,338],[500,310,500,360],[800,338,100,338]]){
    for(const wall of [false,true]) {
      const run=indexed=>{
        const s=arena();
        for(let i=0;i<35;i++)one(s,1,'infantry',80+i*23,{pose:'idle',lane:i%4?0:24});
        if(wall)s.walls.push({x:500,width:8,height:80,hp:100,maxHp:100});
        if(indexed)s.spatial=buildSpatial(s.units,W);
        const p={damage:7,side:0,startX:0,startY:338,tx:1000,ty:338,startLane:0,targetLane:0,ammunition:'machinegun',suppressionMultiplier:1.75};
        suppressNearMiss(s,p,sx,sy,tx,ty);
        const result=s.units.map(u=>u.suppression);suppressNearMiss(s,p,sx,sy,tx,ty);
        assert.deepEqual(s.units.map(u=>u.suppression),result,'once per bullet');return result;
      };
      const expected=run(false);if(!wall)assert(expected.some(v=>v===7));assert.deepEqual(run(true),expected);
    }
  }
});

test('all machinegun actions preserve posture lock and never select rope or command frames on the ground',()=>{
  const s=arena();for(const side of [0,1])for(const [i,id]of ['heavy_mg','machinegun','lmg_team'].entries()){
    one(s,side,id,1000+side*380-i*(side?-30:30),{cooldown:0,decisionIn:0,tactic:'advance'});
  }
  refreshVision(s);const last=new Map();
  for(let i=0;i<900;i++){
    tick(s,1/60);
    for(const u of s.units){const f=adultFrameChoice(u,s.time);
      assert.notEqual(f.group,'signals4');if(f.group==='actions20')assert(![8,9,10,11].includes(f.index));
      if(u.hp<=0||u.wounded||u.surrendered)continue;
      const cls=['prone','crawl'].includes(u.pose)?'prone':['crouch','hunker'].includes(u.pose)?'crouch':'stand';
      const before=last.get(u.uid);if(before&&before.cls!==cls){assert(s.time-before.at>=9.99,JSON.stringify({u,before}));last.set(u.uid,{cls,at:s.time});}
      else if(!before)last.set(u.uid,{cls,at:-100});
    }
  }
});

test('AI chooses a screen, a prepared gun or a mobile gun from actual visible contact',()=>{
  for(const mode of ['empty','mass','mobile'])for(const hidden of [false,true]){
    const s=arena();
    const group=(side,id,x,moving=false)=>{
      const n=s.units.length;spawnUnit(s,side,id,x);
      s.units.slice(n).forEach(u=>Object.assign(u,{x,y:374,lane:0,pose:'idle',moving,cooldown:1000,decisionIn:1000}));
    };
    if(mode==='mobile')for(let i=0;i<3;i++)one(s,0,'infantry',1600+i*10);
    else group(0,'infantry',1600);
    if(mode==='mass')group(0,'infantry',1620);
    if(mode!=='empty'){
      group(1,'infantry',1900,mode==='mobile');group(1,'infantry',1980,mode==='mobile');group(1,'assault',2020,mode==='mobile');
    }
    if(hidden)group(0,'infantry',100);
    s.players[1].hand=['lmg_team','heavy_mg','machinegun'].map(id=>({id,uid:++s.uid}));
    s.players[1].deck=[];s.players[1].energy=10;s.aiIn=0;refreshVision(s);tick(s,.05);
    const chosen=s.units.filter(u=>['lmg_team','heavy_mg','machinegun'].includes(u.id));
    assert(chosen.length);assert.equal(chosen[0].id,{empty:'machinegun',mass:'heavy_mg',mobile:'lmg_team'}[mode]);
  }
});
