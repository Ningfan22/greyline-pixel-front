import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,spawnUnit,tick,refreshVision,ground,W,CARDS,isCombatant,setOrder} from '../game/engine.ts';
import {issueLogisticsOrder} from '../game/logistics-orders.ts';
import {setSquadOrder} from '../game/squad-orders.ts';
const DT=1/60,dir=s=>s?-1:1,at=(s,x)=>s?W-x:x;
function arena(){const s=createGame(208,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;for(const p of s.players)Object.assign(p,{order:'advance',hand:[],deck:[],discard:[],energy:0});return s;}
function one(s,side,id,x,patch={}){const n=s.units.length;spawnUnit(s,side,id,x);const u=s.units[n];s.units.splice(n+1);Object.assign(u,{x,y:ground(s,x),pace:1,personalMorale:100,cooldown:1e9,secondaryCooldown:1e9,...patch});return u;}
function watch(u){Object.assign(u,{squadOrder:'watch',squadOrderX:u.x,squadOrderUntil:Infinity});}
function run(s,t,inspect){for(let i=0;i<Math.round(t/DT);i++){tick(s,DT);inspect?.();}}
for(const side of [0,1]){
 test(`side ${side}: blocked tank crosses a supported crest until the real barrel can engage`,()=>{
  const s=arena();for(let x=940;x<1200;x++)s.terrain[at(side,x)]=374-Math.min(170,(x-940)*1.5,(1200-x)*1.5);s.original=[...s.terrain];s.terrainVersion++;
  const tank=one(s,side,'tank',at(side,900),{cooldown:0});const foe=one(s,1-side,'tank',at(side,1450),{hp:1e6,maxHp:1e6});watch(foe);const scout=one(s,side,'scouts',at(side,1400));watch(scout);refreshVision(s);
  let shots=0,nearest=Infinity,previous=tank.x;
  run(s,24,()=>{nearest=Math.min(nearest,Math.abs(tank.x-foe.x));for(const p of s.projectiles)if(p.sourceUid===tank.uid&&p.ammunition==='ap')shots++;
   assert(Math.abs(tank.x-previous)<=CARDS.tank.speed*.8*DT+1e-6,'no teleporting');previous=tank.x;});
  assert(shots>0,'the tank must reach a real firing solution instead of parking on the crest forever');assert(nearest>=280,'maintain observed contact safety distance');
 });
 test(`side ${side}: a real wreck's escaped crew cannot permanently pin an advancing tank`,()=>{
  const s=arena(),end=at(side,1350),v=one(s,1-side,'tank',end,{hp:1});
  s.projectiles.push({uid:++s.uid,x:end,y:350,startX:end,startY:350,tx:end,ty:350,side,targetUid:v.uid,base:null,damage:10,radius:0,shell:false,ammunition:'ap',life:.01,total:.01});
  run(s,.34);const crew=s.units.filter(u=>u.bailoutUntil!==undefined);assert(crew.length>0);assert(s.wrecks.some(w=>w.id===v.uid));
  for(const u of crew){Object.assign(u,{cooldown:1e9,personalMorale:100});watch(u);}
  const tank=one(s,side,'tank',at(side,760),{cooldown:0,secondaryCooldown:0});const scout=one(s,side,'scouts',at(side,1450));watch(scout);refreshVision(s);
  run(s,55);
  assert(crew.every(u=>!isCombatant(u)),'ordinary escaped crew are actually cleared');
  assert((tank.x-end)*dir(side)>200,'the same tank resumes its advance beyond the hulk');
  assert(tank.shots>=2,'a blocked first impact is followed by another real main-gun round');
 });
 for(const order of ['attack','retreat','escort'])test(`side ${side}: ${order} releases a base garrison and cannot immediately recapture it`,()=>{
  const s=arena();const fort=one(s,side,'fort_bunker',at(side,200),{buildUntil:0});const u=one(s,side,'infantry',fort.x);run(s,.2);assert.equal(u.garrisonUid,fort.uid,'first auto-enter the existing fort');
  if(order==='escort')one(s,side,'tank',at(side,550));
  assert(setSquadOrder(s,side,u.squad,order).ok);const before=u.x;run(s,8);
  assert.equal(u.garrisonUid,undefined,'movement command leaves fort');assert(Math.abs(u.x-before)>45,'soldier really moves beyond entry radius');
 });
 test(`side ${side}: reissuing the same attack order still releases auto-entered troops`,()=>{
  const s=arena(),fort=one(s,side,'fort_bunker',at(side,200),{buildUntil:0}),u=one(s,side,'infantry',fort.x);setSquadOrder(s,side,u.squad,'attack');run(s,.2);assert.equal(u.garrisonUid,fort.uid);
  assert(setSquadOrder(s,side,u.squad,'attack').ok);run(s,8);assert.equal(u.garrisonUid,undefined);assert((u.x-fort.x)*dir(side)>60);
 });
 test(`side ${side}: an army advance releases auto-docked troops but respects an explicit watch`,()=>{
  const s=arena(),fort=one(s,side,'fort_bunker',at(side,200),{buildUntil:0}),u=one(s,side,'infantry',fort.x),guard=one(s,side,'scouts',fort.x);watch(guard);run(s,.2);assert.equal(u.garrisonUid,fort.uid);assert.equal(guard.garrisonUid,fort.uid);
  assert(setOrder(s,side,'advance'));run(s,8);assert.equal(u.garrisonUid,undefined);assert((u.x-fort.x)*dir(side)>60);assert.equal(guard.garrisonUid,fort.uid);
 });
 test(`side ${side}: all six squad members pass the same base fort after departure`,()=>{
  const s=arena(),fort=one(s,side,'fort_bunker',at(side,200),{buildUntil:0});const n=s.units.length;spawnUnit(s,side,'infantry',fort.x);const own=s.units.slice(n);run(s,.2);assert(own.some(u=>u.garrisonUid===fort.uid));assert(own.some(u=>u.garrisonUid===undefined));
  assert(setSquadOrder(s,side,own[0].squad,'attack').ok);run(s,15);assert(own.every(u=>u.garrisonUid===undefined),'rear members are not captured after the first occupants depart');assert(own.every(u=>(u.x-fort.x)*dir(side)>60));
 });
 test(`side ${side}: watched garrison remains defended`,()=>{
  const s=arena(),fort=one(s,side,'fort_bunker',at(side,200),{buildUntil:0}),u=one(s,side,'infantry',fort.x);run(s,.2);assert.equal(u.garrisonUid,fort.uid);assert(setSquadOrder(s,side,u.squad,'watch').ok);run(s,3);assert.equal(u.garrisonUid,fort.uid);
 });
}

for(const order of ['advance','resupply'])test(`logistics ${order} cannot re-dock a departing low-ammo soldier`,()=>{
 const s=arena(),fort=one(s,0,'fort_bunker',400,{buildUntil:0}),u=one(s,0,'infantry',fort.x);run(s,.2);assert.equal(u.garrisonUid,fort.uid);u.ammo=1;u.ammoReserve=0;
 assert(issueLogisticsOrder(s,u.uid,order));run(s,6);assert.equal(u.garrisonUid,undefined);assert((u.x-fort.x)*(order==='resupply'?-1:1)>60);
});
