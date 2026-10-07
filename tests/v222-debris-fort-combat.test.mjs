import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,spawnUnit,tick,refreshVision,W,CARDS,projectileIntercept,vehicleContact} from '../game/engine.ts';
import {createScenery,obstacleBoxes,clearSight,observationPenalty,visibleToSide,buildingStage,sceneryIntercept} from '../game/world.ts';
import {wreckContact} from '../game/wreck-geometry.ts';
import {clearGliderLanding} from '../game/glider.ts';
const dt=1/60,at=(side,x)=>side?W-x:x;
function arena(){const s=createGame(222,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;for(const p of s.players)Object.assign(p,{order:'advance',hand:[],deck:[],discard:[],energy:0});return s;}
function one(s,side,id,x,patch={}){const n=s.units.length;spawnUnit(s,side,id,at(side,x));const u=s.units[n];s.units.splice(n+1);Object.assign(u,{x:at(side,x),y:374,shots:0,secondaryShots:0,cooldown:0,secondaryCooldown:0,fragCooldown:1e9,pace:1,personalMorale:100,readyAt:-10,rifleReady:1,...patch});return u;}
function watch(u){Object.assign(u,{squadOrder:'watch',squadOrderX:u.x,squadOrderUntil:Infinity,decisionIn:1e9});}
function debris(s,side,x,kind='wreck'){if(kind==='wreck'){const w={id:++s.uid,cardId:'heavy_tank',side:1-side,x:at(side,x),y:374,age:20,falling:false,vx:0,vy:0,angle:0,facing:side?1:-1};Object.assign(w,wreckContact(()=>374,w));s.wrecks.push(w);}else {s.scenery=createScenery(s.terrain,[{kind:'house',x:at(side,x),seed:222}]);s.scenery[0].parts.forEach(p=>p.hp=kind==='partial'&&p.kind==='wall'?p.maxHp*.35:0);assert.equal(buildingStage(s.scenery[0]),kind==='partial'?2:3);}}
function run(s,t,inspect){for(let i=0;i<Math.round(t/dt);i++){tick(s,dt);inspect?.();}}
for(const side of [0,1]){
 for(const kind of ['wreck','ruin','partial'])test(`side ${side}, ${kind}: no invisible wall, observation penalty or shot interception`,()=>{
  const s=arena();debris(s,side,1180,kind);assert.equal(obstacleBoxes(s).length,0);assert(clearSight(s,at(side,1000),345,at(side,1360),345));assert.equal(observationPenalty(s,at(side,1000),345,at(side,1360),345,600),0);
  for(const ammunition of ['rifle','machinegun','autocannon','cannon','rocket']){const p={ammunition,startX:at(side,1000),startY:345,tx:at(side,1360),ty:345};assert.equal(projectileIntercept(s,p,p.startX,p.startY,p.tx,p.ty),null,ammunition);}
  assert(clearGliderLanding(s,at(side,1180),side),'debris is not an invisible landing wall either');
 });
 for(const id of ['infantry','antiarmor','tank','ifv'])for(const kind of ['wreck','partial'])test(`side ${side}, ${id}: engages and damages live bunker across ${kind}`,()=>{
  const s=arena(),u=one(s,side,id,1000);debris(s,side,1180,kind);const fort=one(s,1-side,'fort_bunker',W-1360,{cooldown:1e9,buildUntil:0,fortCrewSpawned:true,hp:10000,maxHp:10000});watch(fort);refreshVision(s);assert(visibleToSide(s,side,fort));let projectile=false;
  run(s,16,()=>{if(s.projectiles.some(p=>p.sourceUid===u.uid&&p.targetUid===fort.uid))projectile=true;});assert(u.shots>0&&projectile,'real targeted rounds');assert(fort.hp<fort.maxHp,'bunker takes resolved damage');assert.equal(u.wreckEgressX,undefined);
 });
 for(const id of ['infantry','tank','ifv'])test(`side ${side}, ${id}: crosses dense wrecks without one backward step when no enemy exists`,()=>{
  const s=arena(),u=one(s,side,id,1100);for(const x of [1120,1160,1200])debris(s,side,x);const start=u.x;run(s,14,()=>assert((u.x-start)*(side?-1:1)>=-1e-6,'never invent a rear exit or threat'));
  assert((u.x-start)*(side?-1:1)>80);assert.equal(u.vehicleReverseReason,undefined);assert.equal(u.wreckEgressX,undefined);
 });
 test(`side ${side}: embedded riflemen shoot each other without forced exit or one-way wreck cover`,()=>{
  const s=arena();debris(s,side,1240);const u=one(s,side,'infantry',1200,{hp:10000,maxHp:10000}),foe=one(s,1-side,'infantry',W-1300,{hp:10000,maxHp:10000});watch(u);watch(foe);refreshVision(s);run(s,8);assert(u.shots>0&&foe.shots>0);assert(u.hp<u.maxHp&&foe.hp<foe.maxHp);assert.equal(u.x,at(side,1200));assert.equal(foe.x,at(side,1300));
 });
 for(const id of ['tank','ifv'])test(`side ${side}, ${id}: near HQ with wrecks acquires a firing line and does not cycle forward/back`,()=>{
  const s=arena(),u=one(s,side,id,W-180);for(const x of [W-250,W-180,W-120])debris(s,side,x);let previous=u.x,dir=0,turns=0;run(s,28,()=>{const d=Math.sign(u.x-previous);if(d&&dir&&d!==dir)turns++;if(d)dir=d;previous=u.x;});assert(u.shots>0&&s.players[1-side].hp<1000);assert(turns<=1,`${turns} motion direction changes`);
 });
 test(`side ${side}: tank fires at active MG fort behind destroyed hull`,()=>{
  const s=arena(),u=one(s,side,'tank',1000),fort=one(s,1-side,'fort_machinegun',W-1360,{buildUntil:0,fortCrewSpawned:true});watch(fort);debris(s,side,1180);refreshVision(s);run(s,10);assert(u.shots>0&&fort.hp<fort.maxHp);assert(u.hp>0);
 });
}
test('solid soil, live walls and intact houses still block; ruin artwork retains damage stages',()=>{
 const s=arena();s.scenery=createScenery(s.terrain,[{kind:'house',x:1180,seed:222}]);assert(obstacleBoxes(s).length>0);assert(sceneryIntercept(s,1000,350,1360,350,false,true));assert(observationPenalty(s,1000,350,1360,350,600)>0);s.scenery=[];for(let x=1170;x<1190;x++)s.terrain[x]=330;s.terrainVersion++;const p={ammunition:'rifle',startX:1000,startY:345,tx:1360,ty:345};assert(projectileIntercept(s,p,1000,345,1360,345));
});
