import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,spawnUnit,tick,refreshVision,W,CARDS} from '../game/engine.ts';
import {createScenery,visibleToSide} from '../game/world.ts';
import {wreckContact} from '../game/wreck-geometry.ts';
import {gunPose} from '../game/gun-geometry.ts';
const dt=1/60,at=(side,x)=>side?W-x:x;
function arena(){const s=createGame(219,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;for(const p of s.players)Object.assign(p,{order:'advance',hand:[],deck:[],discard:[],energy:0});return s;}
function one(s,side,id,x,extra={}){const n=s.units.length;spawnUnit(s,side,id,x);s.units.splice(n+1);const u=s.units[n];Object.assign(u,{x,y:s.terrain[Math.floor(x)],pace:1,personalMorale:100,cooldown:0,secondaryCooldown:0,fragCooldown:1e9,...extra});return u;}
function run(s,t,inspect){for(let i=0;i<t/dt;i++){tick(s,dt);inspect?.();}}
function watch(u){Object.assign(u,{squadOrder:'watch',squadOrderX:u.x,squadOrderUntil:Infinity});}
for(const side of [0,1]){
 for(const id of ['ifv','scout_car','tank'])for(const distance of [560,180,105])test(`${id}, side ${side}, ${distance}px from HQ: finds a real bore angle and damages HQ`,()=>{
  const s=arena(),u=one(s,side,id,at(side,W-distance)),start=u.x;const shots=new Set();
  run(s,22,()=>{for(const p of s.projectiles)if(p.sourceUid===u.uid&&!shots.has(p.uid)){shots.add(p.uid);const bore=gunPose(u).muzzle;assert(Math.hypot(p.startX-bore.x,p.startY-bore.y)<1e-6,'round leaves articulated barrel');}});
  assert(u.shots>0&&s.players[1-side].hp<1000,JSON.stringify({shots:u.shots,hp:s.players[1-side].hp,x:u.x}));assert(shots.size>0);
  if(distance<200)assert((start-u.x)*(side?-1:1)>30,'backs out of the impossible close aim');
 });
 for(const extra of [{fuel:0},{trackIntegrity:0},...(side===0?[{logisticsOrder:'hold',fuel:40}]:[])])test(`side ${side}: blocked HQ aim does not override ${JSON.stringify(extra)}`,()=>{
  const s=arena(),u=one(s,side,'ifv',at(side,W-105),extra),x=u.x;run(s,8);assert.equal(u.x,x);assert.equal(u.shots,0);
 });
 test(`side ${side}: tank completes ranging despite equally ranked rifle contacts trading nearest place`,()=>{
  const s=arena(),tank=one(s,side,'tank',at(side,1000),{secondaryCooldown:1e9});watch(tank);
  const foes=[one(s,1-side,'infantry',at(side,1450)),one(s,1-side,'infantry',at(side,1454))];foes.forEach(watch);
  const observer=one(s,side,'scouts',at(side,1400),{cooldown:1e9});watch(observer);refreshVision(s);
  run(s,5,()=>{foes.forEach((u,i)=>{u.x=at(side,1450+(i?(s.time%1<.5?4:0):(s.time%1<.5?0:4)));u.squadOrderX=u.x;});});
  assert(tank.shots>0,'actual shell after the full acquisition');assert(foes.some(u=>u.hp<u.maxHp),'live enemies receive damage');
 });
 test(`side ${side}: shuffling infantry leave dense wrecks under a tree on a traversable slope and resume mutual fire`,()=>{
  const s=arena();for(let x=1000;x<1900;x++){const px=at(side,x);s.terrain[px]=374+8*Math.sin((x-1000)/250)+2*Math.sin(x/70);}s.original=s.terrain.slice();s.terrainVersion++;
  for(const [i,id] of ['sam_vehicle','scout_car','light_tank'].entries()){const x=at(side,1500+i*65),w={id:++s.uid,cardId:id,side:1-side,x,y:s.terrain[Math.floor(x)],angle:0,age:20,falling:false,vx:0,vy:0,facing:side?-1:1};Object.assign(w,wreckContact(x=>s.terrain[Math.floor(x)],w));s.wrecks.push(w);}
  s.scenery=createScenery(s.terrain,[{kind:'tree',x:at(side,1530),seed:212}]);
  const own=[],foes=[];for(let i=0;i<4;i++){own.push(one(s,side,'infantry',at(side,1460-i*18)));foes.push(one(s,1-side,'infantry',at(side,1530+i*18)));}refreshVision(s);
  const exited=new Set();run(s,40,()=>{for(const u of [...own,...foes])if(u.wreckEgressX!==undefined)exited.add(u.uid);});
  assert(exited.size>=4,'movement no longer excludes trapped soldiers');
  assert(own.reduce((n,u)=>n+u.shots,0)>0&&foes.reduce((n,u)=>n+u.shots,0)>0,JSON.stringify({own:own.map(u=>[u.x,u.shots,u.hp]),foes:foes.map(u=>[u.x,u.shots,u.hp])}));
  assert([...own,...foes].some(u=>u.hp<u.maxHp),'real projectile impacts, not only muzzle FX');
 });
}
