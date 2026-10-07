import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,spawnUnit,tick,refreshVision,CARDS,W} from '../game/engine.ts';
import {createScenery,visibleToSide} from '../game/world.ts';
const dt=1/60;
function arena(){const s=createGame(228,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;for(const p of s.players)Object.assign(p,{order:'advance',hand:[],deck:[],discard:[],energy:0});return s;}
function one(s,side,id,x,patch={}){const n=s.units.length;spawnUnit(s,side,id,x);const u=s.units[n];s.units.splice(n+1);Object.assign(u,{x,y:374,shots:0,cooldown:0,secondaryCooldown:0,fragCooldown:1e9,pace:1,personalMorale:100,readyAt:-10,rifleReady:1,lane:0,transportReleased:true,...patch});return u;}
function run(s,t,inspect){for(let i=0;i<Math.round(t/dt);i++){tick(s,dt);inspect?.();}}
for(const side of [0,1]){
 const at=x=>side?W-x:x;
 for(const id of ['pickup','apc_transport','scout_car','command_vehicle','ifv','infantry','machinegun'])for(const pose of ['idle','crouch','prone'])for(const gap of [110,300])test(`side ${side}, ${id}: actual fire against ${pose} infantry at ${gap}px`,()=>{
  const s=arena(),u=one(s,side,id,at(1100)),foe=one(s,1-side,'infantry',at(1100+gap),{cooldown:1e9,pose,satchelLeft:0});
  Object.assign(foe,{squadOrder:'watch',squadOrderX:foe.x,squadOrderUntil:Infinity});refreshVision(s);let release=false;
  run(s,12,()=>{release||=s.projectiles.some(p=>p.sourceUid===u.uid&&p.targetUid===foe.uid);});
  assert(release&&u.shots>0,JSON.stringify({x:u.x,foeX:foe.x,pose:u.pose,enemyPose:foe.pose,goal:u.firingGoal,reverse:u.vehicleReverseHeld,seen:visibleToSide(s,side,foe)}));
 });
 for(const kind of ['house','tree','hill'])test(`side ${side}: pickup finds a firing slot beside ${kind}`,()=>{
  const s=arena(),u=one(s,side,'pickup',at(1100)),foe=one(s,1-side,'infantry',at(1400),{cooldown:1e9,satchelLeft:0});
  Object.assign(foe,{squadOrder:'watch',squadOrderX:foe.x,squadOrderUntil:Infinity});
  if(kind==='house')s.scenery=createScenery(s.terrain,[{kind:'house',x:at(1100),seed:228}]);
  if(kind==='tree')s.scenery=createScenery(s.terrain,[{kind:'tree',x:at(1280),seed:228}]);
  if(kind==='hill'){for(let x=0;x<s.terrain.length;x++)s.terrain[x]=s.original[x]=374+Math.sin((at(x)-900)/170)*26;s.terrainVersion++;}
  const observer=one(s,side,'scouts',at(1350),{cooldown:1e9,satchelLeft:0,lane:24});Object.assign(observer,{squadOrder:'watch',squadOrderX:observer.x,squadOrderUntil:Infinity});
  refreshVision(s);let release=false;run(s,18,()=>{release||=s.projectiles.some(p=>p.sourceUid===u.uid&&p.targetUid===foe.uid);});
  assert(release&&u.shots>0,JSON.stringify({x:u.x,shots:u.shots,enemyPose:foe.pose,seen:visibleToSide(s,side,foe),goal:u.firingGoal}));
 });
}
for(const ammo of ['rifle','machinegun','autocannon'])for(const dir of [-1,1])test(`${ammo}, direction ${dir}: an empty aim point never bends a bullet into the ground`,()=>{
 const s=arena(),sx=1600,sy=340,tx=sx+dir*100,ty=320;
 const p={uid:++s.uid,x:sx,y:sy,startX:sx,startY:sy,tx,ty,side:0,targetUid:99999,base:null,damage:10,ammunition:ammo,tracer:true,arc:0,radius:0,total:.1,life:.01};s.projectiles.push(p);tick(s,dt);
 assert(p.missed&&p.life>0,'miss actually continues');const a=tx-sx,b=ty-sy,c=p.tx-p.startX,d=p.ty-p.startY;
 assert(Math.abs(a*d-b*c)<1e-7,'outgoing bearing equals incoming bearing');assert(p.ty<p.y,'upward ray remains upward');assert.equal(p.arc,0);assert.equal(p.targetUid,null);
 tick(s,dt);assert(p.y<ty,'flight remains on the original line');
});
