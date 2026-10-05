import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,spawnUnit,tick,refreshVision,CARDS,W} from '../game/engine.ts';
import {createScenery,visibleToSide} from '../game/world.ts';
import {hasVehicleFuel} from '../game/vehicle-logistics.ts';
import {damageVehicleTracks,isImmobilized,vehicleNeedsRepair,advanceTrackRepair} from '../game/vehicle-damage.ts';
const dt=1/60,at=(side,x)=>side?W-x:x;
function arena(){const s=createGame(221,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;for(const p of s.players)Object.assign(p,{order:'advance',hand:[],deck:[],discard:[],energy:0});return s;}
function spawn(s,side,id,x,patch={}){const n=s.units.length;spawnUnit(s,side,id,at(side,x));const own=s.units.slice(n);for(const u of own)Object.assign(u,{pace:1,personalMorale:100,cooldown:0,secondaryCooldown:0,fragCooldown:1e9,shots:0,secondaryShots:0,...patch});return own;}
function target(s,side,id='sam_vehicle',x=1240){const u=spawn(s,side,id,W-x,{cooldown:1e9,secondaryCooldown:1e9})[0];Object.assign(u,{squadOrder:'watch',squadOrderX:u.x,squadOrderUntil:Infinity,logisticsOrder:'hold'});return u;}
function run(s,seconds,inspect){for(let i=0;i<Math.round(seconds/dt);i++){tick(s,dt);inspect?.();}}
for(const side of [0,1]){
 for(const trees of [false,true])test(`side ${side}: automatic rifle squad fires real bullets and hurts radar truck ${trees?'among trees':'in open ground'}`,()=>{
  const s=arena(),own=spawn(s,side,'infantry',1000),sam=target(s,1-side);
  if(trees)s.scenery=createScenery(s.terrain,[{kind:'tree',x:at(side,1210),seed:221},{kind:'tree',x:at(side,1280),seed:222}]);
  refreshVision(s);assert(visibleToSide(s,side,sam));let realBullet=false;
  run(s,16,()=>{assert(own.every(u=>u.withdrawHeavyUid!==sam.uid),'AA missile damage cannot be a tank blast threat');if(s.projectiles.some(p=>own.some(u=>p.sourceUid===u.uid)&&p.ammunition==='rifle'))realBullet=true;});
  assert(realBullet,'actual rifle projectile, not seeded shot counters');assert(own.some(u=>u.shots>0));assert(sam.hp<sam.maxHp,'actual resolved damage reaches truck');assert(own.every(u=>Math.abs(u.x-at(side,1000))<500),'no false sprint to HQ');
 });
 for(const id of ['antiarmor','rocket','javelin','airborne_at','ifv','tank'])test(`side ${side}: ${id} still engages the unarmoured vehicle`,()=>{
  const s=arena(),own=spawn(s,side,id,1000),sam=target(s,1-side);refreshVision(s);run(s,18);
  assert(own.some(u=>u.shots>0),'armour-only weapons must still accept a vehicle target');assert(sam.hp<sam.maxHp);
 });
 test(`side ${side}: rifle squad still treats a real tank as lethal armour`,()=>{
  const s=arena(),own=spawn(s,side,'infantry',1000),tank=target(s,1-side,'tank');refreshVision(s);run(s,3);
  assert(own.some(u=>u.withdrawHeavyUid===tank.uid));assert.equal(tank.hp,tank.maxHp,'rifles cannot penetrate actual tank armour');
 });
 test(`side ${side}: pure AA weapons never become ground threats even on an armoured platform`,()=>{
  const old={armored:CARDS.sam_vehicle.armored,armorTier:CARDS.sam_vehicle.armorTier};
  try{Object.assign(CARDS.sam_vehicle,{armored:true,armorTier:1});const s=arena(),own=spawn(s,side,'infantry',1000),sam=target(s,1-side);refreshVision(s);run(s,3);assert(own.every(u=>u.withdrawHeavyUid!==sam.uid));
   const t=arena(),tank=spawn(t,side,'tank',1080)[0],foe=target(t,1-side);refreshVision(t);run(t,8);assert.notEqual(tank.vehicleReverseReason,'close');assert(tank.shots>0);assert(foe.hp<foe.maxHp);
  }finally{Object.assign(CARDS.sam_vehicle,old);}
 });
 test(`side ${side}: radar truck retains real fuel, running gear damage and repair`,()=>{
  const s=arena(),sam=spawn(s,side,'sam_vehicle',1000)[0];assert(hasVehicleFuel(sam));sam.fuel=0;const x=sam.x;run(s,1);assert.equal(sam.x,x);
  assert(damageVehicleTracks(sam,{source:'bullet',ammunition:'rocket',damage:300,hitX:sam.x,hitY:sam.y,time:s.time}));assert(isImmobilized(sam));assert(vehicleNeedsRepair(sam));sam.moving=false;sam.motion='ground';for(let i=1;i<=6;i++)advanceTrackRepair(sam,1,s.time+i);assert(!isImmobilized(sam));assert.equal(sam.trackIntegrity,100);
 });
 test(`side ${side}: SAM does not retaliate with aircraft-only missiles against infantry`,()=>{
  const s=arena(),sam=spawn(s,side,'sam_vehicle',1000)[0],own=spawn(s,1-side,'infantry',W-1240,{cooldown:1e9,fragCooldown:1e9});refreshVision(s);run(s,6);assert.equal(sam.shots,0);assert(own.every(u=>u.hp===u.maxHp));
 });
}
test('SAM truck classification and tank protection are distinct',()=>{assert.equal(CARDS.sam_vehicle.armored,false);assert.equal(CARDS.sam_vehicle.vehicle,true);assert.equal(CARDS.sam_vehicle.armorTier,0);assert.equal(CARDS.ifv.armorTier,1);assert.equal(CARDS.tank.armorTier,2);assert.equal(CARDS.heavy_tank.armorTier,3);});
