import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,spawnUnit,tick,refreshVision,W} from '../game/engine.ts';
import {soldierPose} from '../game/soldier-pose.ts';
import {setSquadOrder} from '../game/squad-orders.ts';
import {infantryAttentionDirection} from '../game/infantry-attention.ts';
const dt=1/30;
function arena(){const s=createGame(226,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;for(const p of s.players)Object.assign(p,{order:'advance',hand:[],deck:[],discard:[],energy:0});return s;}
function group(s,side,id,x){const n=s.units.length;spawnUnit(s,side,id,x);const units=s.units.slice(n);for(const u of units)Object.assign(u,{personalMorale:100,readyAt:-10,cooldown:0,fragCooldown:1e9,shots:0,secondaryShots:0});return units;}
for(const side of [0,1]){
 test(`side ${side}: one probe retains the known enemy direction and the rest adopt actual covering poses`,()=>{
  const s=arena(),dir=side?-1:1,x=side?W-1100:1100,units=group(s,side,'infantry',x);
  s.groundContacts[side]=[{uid:999,side:1-side,x:x+dir*410,y:374,seenAt:0,id:'infantry',kind:'infantry',range:380}];
  s.smokes.push({x:x+dir*410,life:30,side});
  const starts=units.map(u=>u.x),actions=new Set();let covers=0,bad=0;
  for(let i=0;i<240;i++){tick(s,dt);for(const u of units){if(u.teamRole){if(u.facing!==dir)bad++;if(u.teamRole==='overwatch'&&!u.moving&&['crouch','prone'].includes(u.pose))covers++;actions.add(soldierPose(u,s.time).action);}}}
  assert.equal(bad,0,'probe/cover adjustments never mirror the torso toward home');
  assert(covers>30,'cover members kneel or lie down rather than idling upright');
  assert(actions.has('cover'));assert(actions.has('scan')||actions.has('listen'));
  assert(units.some((u,i)=>(u.x-starts[i])*dir>8),'actual probe keeps advancing');
 });
 test(`side ${side}: an unsupported solo fighter keeps approaching instead of waiting for a missing fire team`,()=>{
  const s=arena(),dir=side?-1:1,x=side?W-1200:1200,[u]=group(s,side,'infantry',x);
  s.units=[u];group(s,1-side,'infantry',x+dir*620);refreshVision(s);
  const before=u.x;for(let i=0;i<120;i++)tick(s,dt);
  assert((u.x-before)*dir>8);assert.equal(u.teamRole,undefined);
 });
 test(`side ${side}: active normal-HP firefight keeps every capable fighter facing the opposing line`,()=>{
  const s=arena(),dir=side?-1:1,x=side?W-1350:1350,own=group(s,side,'infantry',x),foes=group(s,1-side,'infantry',x+dir*310);
  refreshVision(s);let observed=0,bad=0,shots=0;
  for(let i=0;i<210;i++){tick(s,dt);for(const u of own){if(u.hp<=0||u.wounded||u.surrendered||u.tactic==='retreat'||u.resupplyState||u.withdrawHeavyUid!==undefined)continue;
    if((u.contactUntil??0)>s.time&&foes.some(v=>v.hp>0&&!v.wounded&&(v.x-u.x)*dir>30)){observed++;if(u.facing!==dir)bad++;}shots=Math.max(shots,u.shots);
  }}
  assert(observed>30);assert.equal(bad,0);assert(shots>0,'cover animation never prevents real firing');
  assert(own.some(u=>u.hp<u.maxHp)||foes.some(u=>u.hp<u.maxHp),'live bullets still resolve');
 });
 test(`side ${side}: a short rearward firing-position move backpedals, a real retreat turns and runs`,()=>{
  const s=arena(),dir=side?-1:1,x=side?W-1400:1400,[u]=group(s,side,'infantry',x);
  s.units=[u];assert(setSquadOrder(s,side,u.squad,'hold').ok);u.x+=dir*30;Object.assign(u,{attentionX:x+dir*300,attentionUntil:20,combatRunUntil:20});
  let back=0;
  for(let i=0;i<90;i++){const before=u.x;tick(s,dt);if((u.x-before)*dir<-.001){back++;assert.equal(u.facing,dir);assert(u.backpedaling);assert.notEqual(u.pose,'run');}}
  assert(back>0,'bounded firing adjustment really moves');
  Object.assign(u,{squadOrder:undefined,squadOrderX:undefined,tactic:'retreat',retreatUntil:s.time+20,personalMorale:40,decisionIn:30});let ran=false;
  for(let i=0;i<60;i++){const before=u.x;tick(s,dt);if((u.x-before)*dir<-.001){ran=true;assert.equal(u.facing,-dir);}}
  assert(ran,'true disengagement still turns homeward');
 });
}
test('attention retains the last observed point without tracking a hidden contact and expires',()=>{
 const s=arena(),[u]=group(s,0,'infantry',1000),[foe]=group(s,1,'infantry',1350);s.visible=[[foe.uid],[]];Object.assign(u,{contactUid:foe.uid,contactUntil:2});
 assert.equal(infantryAttentionDirection(s,u),1);assert.equal(u.attentionX,1350);
 s.visible=[[],[]];foe.x=700;s.time=1;assert.equal(infantryAttentionDirection(s,u),1);assert.equal(u.attentionX,1350);
 s.time=5;assert.equal(infantryAttentionDirection(s,u),0);
});
test('earpiece and sector checks use fixed limbs and retain the weapon sockets; firing and reload override them',()=>{
 const u={id:'infantry',pose:'crouch',motion:'ground',hp:35,member:0,stillFor:2,moving:false,rifleReady:.7,teamRole:'overwatch',attentionUntil:100,attentionX:1400,contactUntil:0};
 for(const time of [24.45,26.5,28]){const p=soldierPose(u,time);assert(['listen','scan','cover'].includes(p.action));
  for(const [a,b,length] of [[p.shoulder,p.nearElbow,12.01],[p.nearElbow,p.nearHand,13.01],[p.farElbow,p.farHand,13.01]])assert(Math.hypot(a[0]-b[0],a[1]-b[1])<=length);
  assert(p.weaponVisible);assert(!p.slung);
 }
 assert.equal(soldierPose({...u,fire:.1},24.45).action,'ready');
 assert.equal(soldierPose({...u,ammo:0,reloadingStartAt:24,reloadingUntil:27},24.45).action,'reload');
});
