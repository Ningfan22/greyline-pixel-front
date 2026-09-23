import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame,startGame,spawnUnit } from '../game/engine.ts';
import { adultFrameChoice } from '../game/adult-animation.ts';
import { patrolModeForUnit } from '../game/patrol-art-v17.ts';
function soldier(id='marines') { const s=createGame(177);startGame(s);spawnUnit(s,0,id,1000);
  const u=s.units[0];Object.assign(u,{hp:100,motion:'ground',pose:'walk',moving:true,walk:0,
    fire:0,secondaryFire:0,flash:0,climbing:0,wounded:false,surrendered:false,rappelling:false,
    reloadingUntil:0,aimUntil:100,poseAnimAt:undefined,readyAt:0});return u; }
test('moving aim, discharge and residual work clocks cannot select a static full-body patrol pose',()=>{
  for(const id of ['infantry','marines','militia','armed_police'])for(const patch of [
    {},{fire:.2},{secondaryFire:.2},{ammoShareUntil:100},{scavengeUntil:100},{reloadingUntil:100},
  ]) {
    const u=Object.assign(soldier(id),patch),seen=new Set();
    for(let phase=0;phase<8;phase++) { u.walk=phase;const choice=adultFrameChoice(u,20);
      assert.equal(choice.group,'walk8',`${id} ${JSON.stringify(patch)}`);seen.add(choice.index);
      assert.equal(patrolModeForUnit(u,choice,20),null); }
    assert.equal(seen.size,8);
  }
});
test('stationary rifle aims/fires; unopposed patrol walks; low/running/reverse gaits retain ownership',()=>{
  const u=soldier();u.moving=false;
  assert.equal(patrolModeForUnit(u,adultFrameChoice(u,20),20),'raise');u.fire=.2;
  assert.equal(patrolModeForUnit(u,adultFrameChoice(u,20),20),'fire');
  Object.assign(u,{moving:true,aimUntil:0,fire:0});assert.equal(patrolModeForUnit(u,adultFrameChoice(u,20),20),'walk');
  for(const pose of ['crouch','prone','run','hunker']) {u.pose=pose;assert.equal(patrolModeForUnit(u,adultFrameChoice(u,20),20),null);}
  u.pose='walk';u.backpedaling=true;const indices=[];
  for(let i=0;i<8;i++){u.walk=i;const f=adultFrameChoice(u,20);indices.push(f.index);assert.equal(patrolModeForUnit(u,f,20),null);}
  assert.deepEqual(indices,[0,7,6,5,4,3,2,1]);
});
