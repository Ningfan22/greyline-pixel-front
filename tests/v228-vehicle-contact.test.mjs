import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,spawnUnit,tick,refreshVision,contactSafeX,CARDS,W} from '../game/engine.ts';
import {armorHalf} from '../game/vehicle-geometry.ts';
const dt=1/60;
function arena(){const s=createGame(228,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;for(const p of s.players)Object.assign(p,{order:'advance',hand:[],deck:[],discard:[],energy:0});return s;}
function one(s,side,id,x,patch={}){const n=s.units.length;spawnUnit(s,side,id,x);const u=s.units[n];s.units.splice(n+1);Object.assign(u,{x,y:374,shots:0,secondaryShots:0,cooldown:0,secondaryCooldown:0,fragCooldown:1e9,pace:1,personalMorale:100,readyAt:-10,rifleReady:1,lane:0,transportReleased:true,...patch});return u;}
function run(s,seconds,inspect){for(let i=0;i<Math.round(seconds/dt);i++){tick(s,dt);inspect?.();}}
for(const side of [0,1]){
 const dir=side?-1:1,at=x=>side?W-x:x;
 for(const wrecked of [false,true])test(`side ${side}: normal-health pickup and APC break a close silent pursuit ${wrecked?'among wrecks':'on open ground'}`,()=>{
  const s=arena(),pickup=one(s,side,'pickup',at(1100)),apc=one(s,1-side,'apc_transport',at(1230));
  if(wrecked)s.wrecks.push({id:++s.uid,cardId:'tank',side:1-side,x:at(1240),y:374,age:20,falling:false,vx:0,vy:0,angle:0,facing:-dir});
  refreshVision(s);let round=false,last=pickup.x,direction=0,turns=0;
  run(s,5,()=>{round||=s.projectiles.some(p=>p.sourceUid===apc.uid&&p.targetUid===pickup.uid);const d=Math.sign(pickup.x-last);if(d&&direction&&d!==direction)turns++;if(d)direction=d;last=pickup.x;});
  assert(round&&apc.shots>0,'carrier resumes actual aimed fire with finite ammunition');assert(apc.ammo<600);
  assert((pickup.x-at(1100))*dir<-100,'soft carrier backs out instead of refilling the gap');
  assert(Math.abs(pickup.x-apc.x)>250,'two hulls separate');assert.equal(apc.hp,CARDS.apc_transport.hp,'machine gun never magically penetrates APC');assert.equal(pickup.shots,0);assert(turns<=1,'no advance/reverse oscillation');
 });
 test(`side ${side}: pickup suppresses infantry behind an invulnerable parked APC`,()=>{
  const s=arena(),pickup=one(s,side,'pickup',at(1100)),apc=one(s,1-side,'apc_transport',at(1230),{cooldown:1e9,logisticsOrder:'hold'}),rifle=one(s,1-side,'infantry',at(1310),{cooldown:1e9,satchelLeft:0});
  Object.assign(rifle,{squadOrder:'watch',squadOrderX:rifle.x,squadOrderUntil:Infinity});refreshVision(s);let soft=false,armor=false;
  run(s,16,()=>{for(const p of s.projectiles)if(p.sourceUid===pickup.uid){soft||=p.targetUid===rifle.uid;armor||=p.targetUid===apc.uid;}});
  assert(soft&&pickup.shots>0,'real rounds go to exposed infantry');assert(!armor,'unsupported hull is not a firing target');assert.equal(apc.hp,apc.maxHp);assert(rifle.hp<rifle.maxHp);
 });
 test(`side ${side}: soft vehicles in a close duel both acquire a real firing distance`,()=>{
  const s=arena(),own=one(s,side,'pickup',at(1100)),enemy=one(s,1-side,'pickup',at(1240));refreshVision(s);run(s,4);
  assert(own.shots>0&&enemy.shots>0,'both sides actually shoot');assert(own.hp<own.maxHp&&enemy.hp<enemy.maxHp);
 });
 test(`side ${side}: encounter clearance includes both vehicle hulls`,()=>{
  const s=arena(),own=one(s,side,'tank',at(1100)),enemy=one(s,1-side,'heavy_tank',at(1420));refreshVision(s);
  const x=contactSafeX(s,own,at(1350));assert(Math.abs(enemy.x-x)>=armorHalf(own.id)+armorHalf(enemy.id)+24-1e-6);
 });
 test(`side ${side}: pickup resumes advancement after the observed carrier departs`,()=>{
  const s=arena(),own=one(s,side,'pickup',at(1100)),enemy=one(s,1-side,'apc_transport',at(1250),{ammo:0,logisticsOrder:'hold'});refreshVision(s);run(s,5);const x=own.x;
  s.units=s.units.filter(u=>u!==enemy);refreshVision(s);run(s,9);assert((own.x-x)*dir>80,'a vanished contact does not leave a permanent halt');
 });
 for(const patch of [{fuel:0},{logisticsOrder:'hold'}])test(`side ${side}: automatic separation respects ${patch.fuel===0?'empty fuel':'explicit standby'}`,()=>{
  const s=arena(),own=one(s,side,'pickup',at(1100),patch);one(s,1-side,'apc_transport',at(1230),{ammo:0,logisticsOrder:'hold'});refreshVision(s);run(s,3);assert.equal(own.x,at(1100));
 });
}
