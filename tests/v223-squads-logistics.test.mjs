import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,spawnUnit,tick,refreshVision,W,CARDS,muzzlePoint} from '../game/engine.ts';
import {planAmmoResupply,initializeAmmo,logisticsRatio,ammoProfile} from '../game/ammo-logistics.ts';
import {soldierPose} from '../game/soldier-pose.ts';
import {vehicleCrewPose} from '../game/vehicle-crew-pose.ts';
import {towRackState} from '../game/vehicle-art-v223.ts';
import {gunPose} from '../game/gun-geometry.ts';
import {unitSynergy} from '../game/synergy.ts';
import {starterState,loadCollection,COLLECTION_STORAGE,SQUAD_LOGISTICS_CARDS,validDeckWithCollection} from '../game/collection.ts';
import {DECK_PRESETS} from '../game/deck-presets.ts';
const dt=1/60;
function arena(){const s=createGame(223,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;for(const p of s.players)Object.assign(p,{order:'advance',hand:[],deck:[],discard:[],energy:0});return s;}
function group(s,side,id,x){const n=s.units.length;spawnUnit(s,side,id,x);const units=s.units.slice(n);for(const u of units)Object.assign(u,{pace:1,personalMorale:100,readyAt:-10,cooldown:0,secondaryCooldown:0,fragCooldown:1e9,shots:0,secondaryShots:0});return units;}
function one(s,side,id,x){const units=group(s,side,id,x);s.units.splice(s.units.indexOf(units[0])+1);return units[0];}
function run(s,seconds,inspect){for(let i=0;i<Math.round(seconds/dt);i++){tick(s,dt);inspect?.();}}
for(const side of [0,1]){
 test(`side ${side}: unseen remembered contact sends one probe instead of freezing the entire squad`,()=>{
  const s=arena(),dir=side?-1:1,x=side?W-1100:1100,units=group(s,side,'infantry',x);
  s.groundContacts[side]=[{uid:999,side:1-side,x:x+dir*410,y:374,seenAt:0,id:'infantry',kind:'infantry',range:380}];
  // A genuine lost observation: conceal its last location under a smoke area.
  s.smokes.push({x:x+dir*410,y:350,r:180,life:30});
  const starts=units.map(u=>u.x);let probes=0;
  run(s,4,()=>{probes=Math.max(probes,units.filter(u=>u.teamRole==='probe').length);});
  assert.equal(probes,1);assert(units.some((u,i)=>(u.x-starts[i])*dir>8),'a real scout step occurs');
  assert(units.some(u=>u.teamRole==='overwatch'),'the remaining team covers');
 });
 test(`side ${side}: stretched squad alternates covering fire and short running bounds`,()=>{
  const s=arena(),dir=side?-1:1,x=side?W-1250:1250,units=group(s,side,'infantry',x);
  units.forEach((u,i)=>{u.x=x-dir*i*52;u.y=374;});
  const foe=one(s,1-side,'infantry',x+dir*320);Object.assign(foe,{hp:10000,maxHp:10000,cooldown:1e9,squadOrder:'watch',squadOrderX:foe.x,squadOrderUntil:Infinity});
  refreshVision(s);let bounds=0,cover=0;
  run(s,20,()=>{if(units.some(u=>u.teamRole==='bound'&&u.moving))bounds++;if(units.some(u=>u.teamRole==='overwatch'&&u.fire>0))cover++;});
  assert(bounds>0,'moving team advances under covering fire');assert(cover>0);assert(foe.hp<10000,'actual rounds resolve on the opponent');
 });
 test(`side ${side}: rapid reinforcements really run; regular entry walks`,()=>{
  for(const id of ['rapid_reinforcements','rapid_assault','rapid_at','rapid_recon','infantry']){
   const s=arena(),units=group(s,side,id,side?W-500:500);let running=false,walking=false;
   run(s,2,()=>{running ||= units.some(u=>u.moving&&u.pose==='run');walking ||= units.some(u=>u.moving&&u.pose==='walk');});
   if(id==='infantry'){assert(walking);assert(!running);}else assert(running,id);
  }
 });
 test(`side ${side}: transport releases exactly four independent soldiers once`,()=>{
  const s=arena(),dir=side?-1:1,x=side?W-1000:1000,carrier=one(s,side,'apc_transport',x),foe=one(s,1-side,'infantry',x+dir*470);
  Object.assign(foe,{cooldown:1e9,squadOrder:'watch',squadOrderX:foe.x,squadOrderUntil:Infinity});refreshVision(s);run(s,.5);
  const cargo=s.units.filter(u=>u.side===side&&CARDS[u.id].members);assert.equal(cargo.length,4);assert.equal(new Set(cargo.map(u=>u.squad)).size,1);assert(cargo.every(u=>(carrier.x-u.x)*dir>0));assert(carrier.transportReleased);run(s,2);assert.equal(s.units.filter(u=>u.side===side&&CARDS[u.id].members).length,4);
 });
}
test('finite supply: five stock yields only five rifle rounds and then stops',()=>{
 const s=arena(),provider=one(s,0,'supply_team',1000),client=one(s,0,'infantry',1040);initializeAmmo(provider);initializeAmmo(client);Object.assign(provider,{supplyStock:5});Object.assign(client,{ammo:0,ammoReserve:0});
 planAmmoResupply(s,client,1);assert.equal(client.ammo,5);assert.equal(provider.supplyStock,0);planAmmoResupply(s,client,1);assert.equal(client.ammo,5);assert.equal(logisticsRatio(provider),0);
});
test('empty providers stop the reload synergy immediately, even inside its cache window',()=>{
 const s=arena(),team=one(s,0,'supply_team',1000),gun=one(s,0,'heavy_mg',1040);initializeAmmo(team);
 assert(unitSynergy(s,gun,0).supply_run);team.supplyStock=0;assert(!unitSynergy(s,gun,.01).supply_run);
});
test('new and existing players receive all five new cards once, without losing currency or custom decks',()=>{
 const starter=starterState();assert(validDeckWithCollection(DECK_PRESETS.find(d=>d.id==='mobile_logistics').cards,starter));
 const prior=globalThis.localStorage,data=new Map();globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 try{const old={...starter,gold:1234,owned:{infantry:4,ammo:1}};delete old.squadLogisticsReleaseGranted;old.testGoldGranted=true;data.set(COLLECTION_STORAGE,JSON.stringify(old));data.set('greyline-player-custom-deck','KEEP');
  const next=loadCollection();assert.equal(next.gold,1234);for(const id of SQUAD_LOGISTICS_CARDS)assert.equal(next.owned[id],1);assert.equal(data.get('greyline-player-custom-deck'),'KEEP');assert.deepEqual(loadCollection(),next);
 }finally{globalThis.localStorage=prior;}
});
test('supply truck transfers stock to the team and returns to refill without creating material',()=>{
 const s=arena(),truck=one(s,0,'supply_truck',1000),team=one(s,0,'supply_team',1060);initializeAmmo(truck);initializeAmmo(team);truck.supplyStock=20;team.supplyStock=0;
 planAmmoResupply(s,team,1);assert.equal(truck.supplyStock,0);assert.equal(team.supplyStock,20);
 planAmmoResupply(s,team,1);assert.equal(team.supplyStock,20);
 const goal=planAmmoResupply(s,truck,dt);assert.equal(goal,110);const before=truck.x;run(s,2);assert(truck.x<before);
 truck.x=110;truck.y=374;planAmmoResupply(s,truck,1);assert.equal(truck.supplyStock,150);
 truck.supplyStock=2000;truck.fuel=100;planAmmoResupply(s,truck,dt);assert.equal(truck.resupplyState,undefined);assert.equal(truck.squadOrder,undefined);
 const fighter=one(s,0,'infantry',1000);fighter.squadOrder='watch';fighter.squadOrderX=fighter.x;fighter.squadOrderUntil=Infinity;run(s,2);assert(truck.x>110,'full truck automatically follows the friendly screen again');
});
test('TOW uses a two-round rack, empties corresponding tubes and rebuilds them during a real reload',()=>{
 const s=arena(),u=one(s,0,'tow_ifv',1000),foe=one(s,1,'heavy_tank',1490);Object.assign(foe,{hp:10000,maxHp:10000,cooldown:1e9,secondaryCooldown:1e9,logisticsOrder:'hold'});u.logisticsOrder='hold';const observer=one(s,0,'scouts',1050);Object.assign(observer,{squadOrder:'watch',squadOrderX:observer.x,squadOrderUntil:Infinity,cooldown:1e9});
 assert.equal(ammoProfile(u).primary.mag,2);let first=false,second=false,reload=false,refilled=false;
 run(s,40,()=>{if(u.shots===1){first=true;assert.deepEqual(towRackState(u,s.time).loaded,[false,true]);}if(u.shots===2){second=true;if((u.reloadingUntil??0)>s.time)reload=true;else if(u.ammo===2)refilled=true;}});
 assert(first&&second&&reload&&refilled);assert(foe.hp<10000);assert.equal(u.ammoReserve+u.ammo+u.shots,8);
});
test('MG gunner uses the soldier rig, arms stay anatomical at both barrel limits',()=>{
 for(const facing of [-1,1])for(const elevation of [-12,35]){
  const s=arena(),u=one(s,0,'pickup',1000);Object.assign(u,{facing,gunElevation:elevation*Math.PI/180});const crew=vehicleCrewPose(u,0);assert(crew);assert.equal(crew.pose.appearance.identity,soldierPose({id:'infantry',pose:'crouch'},0).appearance.identity);assert.equal(crew.pose.weaponVisible,false);
  const p=gunPose(u),m=muzzlePoint(u,u.x+facing*600);assert(Math.hypot(m.x-p.muzzle.x,m.y-p.muzzle.y)<.001);
  for(const [a,b,max] of [[crew.pose.shoulder,crew.pose.nearElbow,12.01],[crew.pose.nearElbow,crew.pose.nearHand,13.01]])assert(Math.hypot(a[0]-b[0],a[1]-b[1])<=max);
 }
});
