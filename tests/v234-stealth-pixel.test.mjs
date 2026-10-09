import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createGame,startGame,spawnUnit,tick,refreshVision,visibleToSide} from '../game/engine.ts';
import {CARDS} from '../game/cards.ts';
import {airGroundSight,missileCanLock} from '../game/world.ts';
import {unitSize} from '../game/art.ts';
const {loadImage,createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas');
function arena(){const s=createGame(234,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;for(const p of s.players)Object.assign(p,{order:'hold',energy:20,hand:[],deck:[],discard:[]});return s;}
function actor(s,side,id,x,patch={}){const n=s.units.length;spawnUnit(s,side,id,x);const u=s.units[n];s.units.splice(n+1);Object.assign(u,{x,y:CARDS[id].air?210:374,lane:0,readyAt:-10,cooldown:0,secondaryCooldown:1e9,fragCooldown:1e9,logisticsOrder:'hold',...patch});return u;}
function run(s,seconds){for(let i=0;i<seconds*60;i++)tick(s,1/60);}
for(const side of [0,1]){
 test(`side ${side}: nearby optical contact never permits SAM or MANPADS missile launches`,()=>{
  for(const id of ['sam_vehicle','manpads']){
   const s=arena(),defender=actor(s,side,id,1500),plane=actor(s,1-side,'stealth_bomber',1650,{cooldown:1e9});
   refreshVision(s);assert(visibleToSide(s,side,plane),'Close contact is genuinely visible');
   assert(!missileCanLock(plane));run(s,2);assert.equal(defender.shots,defender.member);
   assert.equal(plane.hp,plane.maxHp);assert(!s.projectiles.some(p=>p.guided&&p.targetUid===plane.uid));
  }
 });
 test(`side ${side}: normal bomber still draws real radar-guided fire`,()=>{
  const s=arena(),defender=actor(s,side,'sam_vehicle',1500),plane=actor(s,1-side,'bomber',1650,{cooldown:1e9});
  refreshVision(s);assert(visibleToSide(s,side,plane));run(s,.3);assert(defender.shots>defender.member);
 });
 test(`side ${side}: bombs damage armor without exposing a distant stealth bomber`,()=>{
  const s=arena(),plane=actor(s,side,'stealth_bomber',side?2050:1200,{logisticsOrder:undefined}),x=side?1850:1400;
  actor(s,side,'scouts',x,{cooldown:1e9});const tank=actor(s,1-side,'tank',x,{cooldown:1e9});actor(s,1-side,'sam_vehicle',side?650:2600,{cooldown:1e9});
  refreshVision(s);assert.equal(airGroundSight(plane),0);run(s,2);
  assert(plane.shots>plane.member,'Aircraft actually released bombs');assert(tank.hp<tank.maxHp,'Bombs reached real target');
  assert((plane.exposedUntil??0)<=s.time);assert(!visibleToSide(s,1-side,plane));
 });
 test(`side ${side}: stale guided missile tracks cannot force a hit on stealth bomber`,()=>{
  const s=arena(),plane=actor(s,side,'stealth_bomber',1800,{cooldown:1e9});
  s.projectiles.push({uid:++s.uid,sourceUid:9999,targetUid:plane.uid,side:1-side,base:null,startX:1790,startY:190,x:1790,y:190,tx:1800,ty:190,total:1,life:1,damage:240,radius:22,ammunition:'rocket',guided:true,speed:900});
  run(s,.1);assert.equal(s.projectiles.length,0);assert.equal(plane.hp,plane.maxHp);
 });
}
test('battle sprite has final compact native dimensions and entirely hard alpha',async()=>{
 const image=await loadImage('public/art/v234/stealth-bomber-sprite.png');
 assert.deepEqual(unitSize('stealth_bomber'),[208,84]);assert.equal(image.width,208);assert.equal(image.height,84);
 const canvas=createCanvas(208,84),ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
 const pixels=ctx.getImageData(0,0,208,84).data;let opaque=0;
 for(let i=3;i<pixels.length;i+=4){assert(pixels[i]===0||pixels[i]===255);if(pixels[i])opaque++;}
 assert(opaque>3000&&opaque<208*84,'Transparent silhouette retains a substantial aircraft');
});
