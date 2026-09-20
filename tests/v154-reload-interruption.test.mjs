import assert from 'node:assert/strict';
import test from 'node:test';
import {createGame,startGame,spawnUnit,tick,setOrder} from '../game/engine.ts';
import {magazineReloadCel,magazineReloadActive,pauseMagazineDrill} from '../game/infantry-action-timing.ts';
import {adultFrameChoice} from '../game/adult-animation.ts';
import {startMagazineDrill} from '../game/crouch-locomotion.ts';
function arena(side=0,extra={}){
  const s=createGame(154);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.weather.disabled=true;s.night=false;
  spawnUnit(s,side,'infantry',side?2400:1000,{member:0});const u=s.units[0];s.units.splice(1);
  Object.assign(u,{x:side?2400:1000,y:374,lane:0,pose:'idle',poseAnimSeen:'stand',
    stanceLockUntil:100,motion:'ground',hp:10000,maxHp:10000,shots:0,decisionIn:1000,
    tactic:'advance',cooldown:1000,stillFor:5,moving:false,personalMorale:100,
    suppression:0,readyAt:-100,fragLeft:0,fire:0,flash:0,aimUntil:0,
    ammo:0,ammoReserve:60,reloadingStartAt:0,reloadingUntil:2.5,...extra});
  setOrder(s,side,'hold');return {s,u};
}
const step=(s,n)=>{for(let i=0;i<n;i++)tick(s,1/60);};

test('incapacitation preserves unfinished magazine work instead of giving an instant refill on recovery',()=>{
  for(const side of [0,1])for(const topup of [false,true]){
    const {s,u}=arena(side,topup?{ammo:12,tacticalReload:true}:{});
    step(s,45);const phase=magazineReloadCel(u,s.time),remaining=u.reloadingUntil-s.time;
    Object.assign(u,{wounded:true,woundedTime:0,bleedOut:60,woundedFromPose:'idle'});
    step(s,180);assert.equal(u.ammo,topup?12:0);assert.equal(u.ammoReserve,60);
    assert.equal(magazineReloadCel(u,s.time),phase);
    assert(Math.abs(u.reloadingUntil-s.time-remaining)<1e-8);
    // Isolate recovery from treatment/stance mechanics; its unfinished work remains.
    Object.assign(u,{wounded:false,crawling:false,tactic:'advance',moving:false,pose:'idle',poseAnimSeen:'stand'});
    tick(s,1/60);assert.equal(u.ammo,topup?12:0);assert(magazineReloadActive(u,s.time));
    step(s,120);assert.equal(u.ammo,30);assert.equal(u.ammoReserve,topup?42:30);
  }
});

test('a real stand-to-prone transition does not consume the magazine animation behind its own cels',()=>{
  const {s,u}=arena();step(s,30);const phase=magazineReloadCel(u,s.time),remaining=u.reloadingUntil-s.time;
  Object.assign(u,{pose:'prone',poseAnimFrom:'stand',poseAnimSeen:'prone',poseAnimAt:s.time,tactic:'prone'});
  for(let i=0;i<143;i++){
    tick(s,1/60);assert.equal(adultFrameChoice(u,s.time).group,'stance16');
    assert.equal(magazineReloadCel(u,s.time),phase);assert.equal(u.ammo,0);
  }
  assert(Math.abs(u.reloadingUntil-s.time-remaining)<1e-8);
  step(s,125);assert.equal(u.ammo,30);assert.equal(u.ammoReserve,30);
});

test('descent, landing and occupied hands pause work, while walking and decoration do not',()=>{
  for(const patch of [{rappelling:true},{parachuting:true},{motion:'jump'},{motion:'land'},
    {climbing:1},{tending:true},{draggingUid:8},{firstAidUntil:10},{fragThrow:.5},
    {surrendered:true},{pose:'crouch',crouchTravel:.5}]){
    const {u}=arena(0,patch),before=magazineReloadCel(u,.8);
    pauseMagazineDrill(u,.9,.1);
    assert(Math.abs(u.reloadingStartAt-.1)<1e-8,JSON.stringify(patch));
    assert(Math.abs(u.reloadingUntil-2.6)<1e-8);assert.equal(magazineReloadCel(u,.9),before);
    assert.equal(u.ammoReserve,60);assert.equal(u.ammo,0);
  }
  for(const patch of [{moving:true,pose:'run',tactic:'retreat'},{motion:'bank'},
    {digging:true},{ammo:10,tacticalReload:false},{reloadingUntil:0}]){
    const {u}=arena(0,patch),before=JSON.stringify(u);pauseMagazineDrill(u,.9,.1);
    assert.equal(JSON.stringify(u),before,JSON.stringify(patch));
  }
});

test('reserved knee-settling time is not added twice and render reads cannot pause a clock',()=>{
  const {u}=arena(0,{pose:'crouch',poseAnimSeen:'crouch',crouchTravel:1});
  startMagazineDrill(u,0,2.5);const end=u.reloadingUntil;
  for(let i=1;i<=8;i++){u.crouchTravel=1-i/10;pauseMagazineDrill(u,i/10,.1);}
  assert.equal(u.reloadingUntil,end);assert.equal(u.reloadingStartAt,.9);
  const before=JSON.stringify(u);for(let i=0;i<1000;i++)adultFrameChoice(u,i/1000);
  assert.equal(JSON.stringify(u),before);
});

test('a retreating rifle still finishes once without stopping for an artificial interruption',()=>{
  for(const side of [0,1]){
    const {s,u}=arena(side,{tactic:'retreat',squadOrder:'retreat'}),start=u.x;
    setOrder(s,side,'retreat');step(s,210);
    assert((u.x-start)*(side?1:-1)>20);assert(u.moving);assert.equal(u.ammo,30);
    assert.equal(u.ammoReserve,30);assert.equal(u.reloadingUntil,0);
  }
});
