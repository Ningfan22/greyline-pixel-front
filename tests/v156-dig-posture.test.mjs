import assert from 'node:assert/strict';
import test from 'node:test';
import {createGame,startGame,spawnUnit,tick,ground} from '../game/engine.ts';
import {setSquadOrder} from '../game/squad-orders.ts';
import {stanceTransitionActive,magazineReloadActive} from '../game/infantry-action-timing.ts';

function site(side,pose,lock=0) {
  const s=createGame(156);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.night=false;s.weather.disabled=true;s.terrain.fill(374);s.original.fill(374);
  spawnUnit(s,side,'infantry',1600);s.units=[s.units[0]];const u=s.units[0];
  setSquadOrder(s,side,u.squad,'hold');
  Object.assign(u,{x:u.squadOrderX,y:ground(s,u.squadOrderX),lane:u.holdLane,pose,
    poseAnimSeen:pose==='idle'?'stand':pose,stanceLockUntil:lock,decisionIn:1000,tactic:'advance',fragLeft:0,
    suppression:0,fire:0,secondaryFire:0,ammo:30,ammoReserve:90});
  return {s,u,t:s.entrenchments[0]};
}
test('construction cannot replace a locked standing/prone body with the kneeling shovel art',()=>{
  for(const side of [0,1])for(const pose of ['idle','prone']){
    const {s,u,t}=site(side,pose,10);
    for(let i=0;i<590;i++){tick(s,1/60);assert(!u.digging);assert.equal(t.progress,0);assert.equal(u.digElapsed,0);}
    for(let i=0;i<180&&!u.digging;i++)tick(s,1/60);
    assert(u.digging);assert.equal(u.pose,'crouch');assert(!stanceTransitionActive(u,s.time));assert(t.progress>0);
  }
});
test('all lowering cels finish before shovel time or terrain excavation advance',()=>{
  const {s,u,t}=site(0,'idle');tick(s,1/60);assert(stanceTransitionActive(u,s.time));
  while(stanceTransitionActive(u,s.time)){
    assert(!u.digging);assert.equal(t.progress,0);assert.equal(u.digElapsed,0);tick(s,1/60);
  }
  for(let i=0;i<30&&!u.digging;i++)tick(s,1/60);
  assert(u.digging);assert(t.progress>0);
});
test('magazine work is completed before excavation, and long work does not periodically stand up',()=>{
  const {s,u,t}=site(0,'crouch');Object.assign(u,{ammo:0,reloadingStartAt:0,reloadingUntil:2});
  while(magazineReloadActive(u,s.time)){assert(!u.digging);assert.equal(t.progress,0);tick(s,1/60);}
  let working=0,seen=false;
  for(let i=0;i<900&&!t.built;i++){
    tick(s,1/60);
    if(u.digging){seen=true;working++;assert.equal(u.pose,'crouch');assert(!stanceTransitionActive(u,s.time));}
    if(seen)assert.equal(u.pose,'crouch','ongoing construction must retain its posture at the ten-second boundary');
  }
  assert(t.built);assert(working>650);assert(u.ammo>0);
});
