import assert from 'node:assert/strict';
import test from 'node:test';
import {createGame,startGame,spawnUnit,tick,setOrder,refreshVision} from '../game/engine.ts';
import {launcherDrillBusy,launcherDrillCel,advanceLauncherDrill} from '../game/launcher-drill.ts';
import {grenadeLauncherFrame} from '../game/grenade-launcher-art.ts';

function arena(side=0){
  const s=createGame(159);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.weather.disabled=true;s.night=false;
  const x=side?2400:1000,dir=side?-1:1;
  spawnUnit(s,side,'grenadiers',x,{member:0});const u=s.units.at(-1);
  spawnUnit(s,1-side,'infantry',x+dir*300,{member:0});const foe=s.units.at(-1);
  for(const [v,vx]of [[u,x],[foe,x+dir*300]])Object.assign(v,{x:vx,y:374,lane:0,
    hp:10000,maxHp:10000,cooldown:v===u?0:10000,decisionIn:1000,tactic:'prone',
    pose:'prone',poseAnimSeen:'prone',stanceLockUntil:100,moving:false,motion:'ground',
    stillFor:5,readyAt:-100,fragLeft:0,aimUntil:0,cover:0,coverGoal:null,firingGoal:null,
    personalMorale:96,suppression:0,shots:0});
  setOrder(s,0,'hold');setOrder(s,1,'hold');refreshVision(s);return{s,u,foe};
}
const step=(s,n)=>{for(let i=0;i<n;i++)tick(s,1/60);};
function discharge(s,u){for(let i=0;i<120&&!u.shots;i++)tick(s,1/60);assert.equal(u.shots,1);}

test('real prone launcher work pauses for a casualty and resumes with no free loaded round',()=>{
  for(const side of [0,1]){
    const {s,u}=arena(side);discharge(s,u);step(s,30);
    const remaining=u.launcherCycleRemaining,cel=launcherDrillCel(u);
    Object.assign(u,{wounded:true,woundedTime:0,bleedOut:60,woundedFromPose:'prone'});
    step(s,180);assert.equal(u.launcherCycleRemaining,remaining);assert.equal(launcherDrillCel(u),cel);
    Object.assign(u,{wounded:false,crawling:false,moving:false,tactic:'prone',pose:'prone',poseAnimSeen:'prone',cooldown:-1});
    tick(s,1/60);assert.equal(u.shots,1);assert(u.launcherCycleRemaining>0);
    step(s,240);assert(u.shots>=2);
  }
});
test('a stance transition preserves unfinished launcher work even after its ordinary cooldown expires',()=>{
  const {s,u}=arena();discharge(s,u);step(s,25);const remaining=u.launcherCycleRemaining;
  Object.assign(u,{pose:'idle',tactic:'advance',poseAnimFrom:'prone',poseAnimSeen:'stand',poseAnimAt:s.time});
  step(s,140);assert.equal(u.launcherCycleRemaining,remaining);assert.equal(u.shots,1);
  assert(u.cooldown<=0);step(s,240);assert(u.shots>=2);
});
test('movement and occupied hands freeze the same work clock that the visual selector reads',()=>{
  const {u}=arena();Object.assign(u,{launcherCycleDuration:2.4,launcherCycleRemaining:1.2});
  for(const patch of [{moving:true},{motion:'bank'},{rappelling:true},{parachuting:true},
    {climbing:1},{tending:true},{digging:true},{draggingUid:12},{fragThrow:.5},{firstAidUntil:10},
    {flash:.1},{hp:0},{surrendered:true},{pose:'crouch',crouchTravel:.5}]){
    const v={...u,...patch},before=JSON.stringify(v);assert(launcherDrillBusy(v,1));
    advanceLauncherDrill(v,1,.1);assert.equal(JSON.stringify(v),before);
    assert.equal(grenadeLauncherFrame(v,1),null);
  }
  advanceLauncherDrill(u,1,.16);assert(Math.abs(u.launcherCycleRemaining-1.04)<1e-8);
});
test('no wall-clock cycle or cooldown-only reload, and repeated render reads are pure',()=>{
  const {u}=arena();const before=JSON.stringify(u);
  for(let i=0;i<100;i++){assert.equal(launcherDrillCel(u),0);grenadeLauncherFrame(u,i);}
  assert.equal(JSON.stringify(u),before);
  Object.assign(u,{launcherCycleDuration:2.4,launcherCycleRemaining:2.4});
  const seen=new Set([launcherDrillCel(u)]);
  for(let i=0;i<241;i++){advanceLauncherDrill(u,1,.01);seen.add(launcherDrillCel(u));}
  assert.equal(seen.size,8);assert.equal(launcherDrillCel(u),0);
});
test('the prone drill has its own eight cels and a real posture transition still owns the body',()=>{
  const {u}=arena(),seen=new Set();
  Object.assign(u,{launcherCycleDuration:2.4,launcherCycleRemaining:2.4});
  for(let i=0;i<241;i++){
    const f=grenadeLauncherFrame(u,1);assert(f>=16&&f<=23);seen.add(f);
    advanceLauncherDrill(u,1,.01);
  }
  seen.add(grenadeLauncherFrame(u,1));assert.equal(seen.size,8);
  assert.equal(grenadeLauncherFrame({...u,poseAnimFrom:'crouch',poseAnimSeen:'prone',poseAnimAt:1},1.5),null);
  for(const id of ['rocket','antiarmor','airborne_at','infantry','heavy_mg'])
    assert.equal(grenadeLauncherFrame({...u,id},1),null);
});
