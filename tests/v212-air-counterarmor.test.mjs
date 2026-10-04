import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,spawnUnit,tick,refreshVision,CARDS,W,playCard,armorPenetrationTier,isCombatant} from '../game/engine.ts';
import {pointVisible,visibleToSide,createScenery} from '../game/world.ts';
import {ammunition} from '../game/ballistics.ts';
import {gunMount,gunPose,aimedGunSolution} from '../game/gun-geometry.ts';
import {HELI_LAYOUT} from '../game/weapon-layout-v204.ts';
import {DECK_PRESETS,AI_DECKS} from '../game/deck-presets.ts';
const DT=1/120;
function arena(){const s=createGame(212,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;s.weather.disabled=true;for(const p of s.players)Object.assign(p,{hand:[],deck:[],discard:[],energy:10});return s;}
function one(s,side,id,x,extra={}){const n=s.units.length;spawnUnit(s,side,id,x);const u=s.units[n];s.units.splice(n+1);Object.assign(u,{x,y:CARDS[id].air?200:374,cooldown:1e9,secondaryCooldown:1e9,fragCooldown:1e9,decisionIn:1e9,squadOrder:CARDS[id].sortie?'attack':'watch',squadOrderX:x,squadOrderUntil:Infinity,emplaced:true,emplacementSetupUntil:0,personalMorale:100},extra);return u;}
function run(s,t,inspect){for(let i=0;i<Math.round(t/DT);i++){tick(s,DT);inspect?.();}}
function use(s,side,id,x){const token={id,uid:++s.uid};s.players[side].hand.push(token);return playCard(s,side,token.uid,x);}
const at=(side,x)=>side?W-x:x;
for(const side of [0,1]) {
 test(`side ${side}: a real fast attack run selects and heavily damages visible tanks instead of skipping to HQ`,()=>{
  const s=arena(),jet=one(s,side,'strike_jet',at(side,800),{cooldown:0}),tank=one(s,1-side,'tank',at(side,1370),{hp:3000,maxHp:3000});one(s,side,'scouts',at(side,1300));refreshVision(s);
  const aims=[];run(s,3,()=>{for(const p of s.projectiles)if(p.sourceUid===jet.uid)aims.push(p.targetUid);});
  assert(jet.shots>0);assert(aims.includes(tank.uid));assert(tank.hp<2750,JSON.stringify({hp:tank.hp,shots:jet.shots,aims}));assert(jet.x!==at(side,800),'fixed-wing must continue flying');
 });
 test(`side ${side}: strafe ranks armour above closer soft targets, but still needs legitimate observation`,()=>{
  const s=arena(),jet=one(s,side,'strike_jet',at(side,800),{cooldown:0}),tank=one(s,1-side,'heavy_tank',at(side,1350)),inf=one(s,1-side,'infantry',at(side,1250));one(s,side,'scouts',at(side,1260));refreshVision(s);
  let first;run(s,.25,()=>{first??=s.projectiles.find(p=>p.sourceUid===jet.uid)?.targetUid;});assert.equal(first,tank.uid);assert(armorPenetrationTier(ammunition('strike_jet'),CARDS.strike_jet)>=3);assert.equal(armorPenetrationTier('autocannon',CARDS.ifv),1);
  const hidden=arena(),plane=one(hidden,side,'strike_jet',at(side,1000),{cooldown:0}),foe=one(hidden,1-side,'tank',at(side,1400));hidden.scenery=createScenery(hidden.terrain,[{kind:'tree',x:foe.x,seed:212}]);refreshVision(hidden);run(hidden,.25);assert.equal(plane.shots,0);assert.equal(foe.hp,foe.maxHp);
 });
 test(`side ${side}: SAM radar shares distant air contacts through woods at night without revealing distant ground`,()=>{
  const s=arena();one(s,side,'sam_vehicle',at(side,600));const aircraft=one(s,1-side,'strike_jet',at(side,3000)),ground=one(s,1-side,'tank',at(side,2900));s.night=true;s.scenery=createScenery(s.terrain,[{kind:'tree',x:at(side,1800),seed:212}]);refreshVision(s);
  assert(visibleToSide(s,side,aircraft));assert(!visibleToSide(s,side,ground));assert(!pointVisible(s,side,ground.x,ground.y-25));
  const far=one(s,1-side,'strike_jet',at(side,3350));refreshVision(s);assert(!visibleToSide(s,side,far));
 });
 for(const [id,maxShots] of [['strike_jet',1],['bomber',1],['helicopter',2]])test(`side ${side}: SAM really intercepts ${id} within ${maxShots} hits before it reaches the protected front`,()=>{
  const s=arena(),sam=one(s,side,'sam_vehicle',at(side,600),{cooldown:0}),plane=one(s,1-side,id,at(side,2850),{cooldown:1e9,orbitX:at(side,2850)});let shotMax=0;refreshVision(s);run(s,6,()=>{shotMax=Math.max(shotMax,sam.shots);});
  assert(!isCombatant(plane),JSON.stringify({hp:plane.hp,x:plane.x,shots:shotMax}));assert(shotMax<=maxShots);assert((plane.x-at(side,1100))*(side?-1:1)>0,'intercept occurs before protected units');
 });
 test(`side ${side}: anti-tank submunitions damage an armour cluster while sparing dispersed infantry and HQ`,()=>{
  const s=arena();one(s,side,'scouts',at(side,1500));const tanks=[1250,1390,1530].map(x=>one(s,1-side,'tank',at(side,x),{hp:3000,maxHp:3000}));const soldier=one(s,1-side,'infantry',at(side,1390));refreshVision(s);
  assert(use(s,side,'antitank_cluster',at(side,1390)).ok);assert.equal(s.markers[0].kind,'antitank_cluster');const hp=soldier.hp,baseHp=s.players[1-side].hp;run(s,6);
  assert(tanks.every(u=>u.hp<2850),JSON.stringify(tanks.map(u=>u.hp)));assert(hp-soldier.hp<30);assert.equal(s.players[1-side].hp,baseHp);
 });
 test(`side ${side}: swarm spawns four real interceptable FPVs from the friendly line and distributes targets`,()=>{
  const s=arena(),front=one(s,side,'scouts',at(side,1300));const tanks=[1540,1660,1780].map(x=>one(s,1-side,'tank',at(side,x),{hp:3000,maxHp:3000}));refreshVision(s);
  assert(use(s,side,'hunter_swarm',at(side,1660)).ok);const drones=s.units.filter(u=>u.id==='fpv_drone');assert.equal(drones.length,4);assert.equal(new Set(drones.map(u=>u.fpvLock?.uid)).size,3);assert(drones.every(u=>(front.x-u.x)*(side?-1:1)>=60));assert(tanks.every(u=>u.hp===3000),'no instant scripted damage');run(s,4);assert(tanks.every(u=>u.hp<3000));
 });
 test(`side ${side}: six-mine belt requires observed terrain and advance placement, triggers on vehicles with real friendly blast`,()=>{
  const s=arena();one(s,side,'scouts',at(side,1100));refreshVision(s);assert(use(s,side,'antitank_barrier',at(side,1300)).ok);assert.equal(s.mines.length,6);const enemy=one(s,1-side,'tank',s.mines[2].x),ally=one(s,side,'infantry',enemy.x);run(s,2.1);assert(enemy.hp<enemy.maxHp);assert(ally.hp<ally.maxHp);assert(s.mines.length<6);
  const hidden=arena();assert(!use(hidden,side,'antitank_barrier',at(side,1800)).ok);assert.equal(hidden.players[side].energy,10);
  one(hidden,side,'scouts',at(side,1600));one(hidden,1-side,'tank',at(side,1830));refreshVision(hidden);assert(!use(hidden,side,'antitank_barrier',at(side,1800)).ok);
 });
}
test('short chin gun has a restrained sweep and never manufactures a ray outside its mount limits',()=>{
 assert.equal(HELI_LAYOUT.gunWidth,26);for(const id of ['helicopter','escort_gunship'])for(const facing of [-1,1]){
 const body={id,x:800,y:200,facing,hullAngle:0},m=gunMount(id);assert(m.barrelLength<26);assert(Math.abs(m.minElevation*180/Math.PI+32)<1e-8);const pose=gunPose(body,-2);assert.equal(pose.elevation,m.minElevation);assert(!aimedGunSolution(body,800+facing*50,374).canFire);assert(aimedGunSolution(body,800+facing*450,350).canFire);
 }});
test('new counter-armour cards are collectible in a complete preset and appear in enemy decks',()=>{
 const preset=DECK_PRESETS.find(d=>d.id==='armor_hunters');assert.equal(preset.cards.length,20);for(const id of ['antitank_cluster','hunter_swarm','antitank_barrier'])assert(preset.cards.includes(id)&&AI_DECKS.some(d=>d.includes(id)));assert.equal(CARDS.sam_vehicle.range,W*2/3);
});
