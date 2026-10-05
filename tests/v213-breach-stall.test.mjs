import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,spawnUnit,tick,refreshVision,CARDS,W,isCombatant} from '../game/engine.ts';
import {createScenery} from '../game/world.ts';
import {wreckContact} from '../game/wreck-geometry.ts';
import {aimedGunSolution} from '../game/gun-geometry.ts';
import {issueLogisticsOrder} from '../game/logistics-orders.ts';
const DT=1/60,at=(side,x)=>side?W-x:x,dir=side=>side?-1:1;
function one(s,side,id,x){const n=s.units.length;spawnUnit(s,side,id,x);const u=s.units[n];s.units.splice(n+1);Object.assign(u,{x,y:374,pace:1,cooldown:1e9,secondaryCooldown:1e9,fragCooldown:1e9,personalMorale:100,squadOrder:'watch',squadOrderX:x,squadOrderUntil:Infinity});return u;}
function scene(side){const s=createGame(213,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;for(const p of s.players)Object.assign(p,{order:'advance',hand:[],deck:[],discard:[],energy:0});
 const w={id:++s.uid,cardId:'sam_vehicle',side:1-side,x:at(side,1150),y:374,angle:0,age:5,falling:false,vx:0,vy:0,facing:dir(side)};Object.assign(w,wreckContact(()=>374,w));s.wrecks.push(w);s.scenery=createScenery(s.terrain,[{kind:'house',x:at(side,1300),seed:213}]);
 const tank=one(s,side,'tank',at(side,1100));Object.assign(tank,{squadOrder:undefined,cooldown:0});const enemy=one(s,1-side,'infantry',at(side,1450));one(s,side,'scouts',at(side,1500));refreshVision(s);return {s,tank,enemy};}
for(const side of [0,1]){
 test(`side ${side}: a wall near the barrel cannot phantom-lock a tank behind a SAM wreck`,()=>{
  const {s,tank,enemy}=scene(side);let firstShot,previous=tank.x,furthestAdvance=-Infinity;const rounds=new Set();
  // Disable the coax only to isolate the main gun's regression. Enemy health,
  // scenery, barrel limits, movement, shell impacts and damage remain real.
  // Keep the original casualty deadline, then allow stable ranging/observation
  // recovery before checking continued movement beyond the cleared contact.
  for(let i=0;i<60/DT;i++){
   tick(s,DT);if(i===Math.round(50/DT))assert(!isCombatant(enemy),'enemy must be defeated by the existing deadline');furthestAdvance=Math.max(furthestAdvance,(tank.x-at(side,1450))*dir(side));if(tank.shots>0)firstShot??=s.time;
   assert(Math.abs(tank.x-previous)<=CARDS.tank.speed*.8*DT+1e-6,'no teleport across cover');previous=tank.x;
   for(const p of s.projectiles)if(p.sourceUid===tank.uid&&!rounds.has(p.uid)){
    rounds.add(p.uid);const gun=aimedGunSolution(tank,p.tx,p.ty);assert(gun?.canFire,'breach round must use an actually reachable impact');
   }
  }
  assert(firstShot<6,JSON.stringify({firstShot,x:tank.x,shots:tank.shots}));
  assert(!isCombatant(enemy),JSON.stringify({hp:enemy.hp,x:tank.x,shots:tank.shots,ammo:tank.ammo,goal:tank.firingGoal,breach:[tank.breachPropId,tank.breachPartId,tank.breachShots],parts:s.scenery[0].parts.map(p=>p.hp)}));
  assert(furthestAdvance>60,JSON.stringify({x:tank.x,enemyX:enemy.x,shots:tank.shots,ammo:tank.ammo,fuel:tank.fuel,resupply:tank.resupplyState,furthestAdvance,contacts:s.groundContacts[side]}));assert(rounds.size>0);
 });
 if(side===0) test('an explicit player logistics hold is not overridden by breach recovery',()=>{
  const {s,tank}=scene(side);tank.fuel=40;assert(issueLogisticsOrder(s,tank.uid,'hold'));const before=tank.x;for(let i=0;i<8/DT;i++)tick(s,DT);assert.equal(tank.x,before);
 });
}
