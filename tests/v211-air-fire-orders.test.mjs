import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,spawnUnit,tick,refreshVision,CARDS,W,explode,isCombatant} from '../game/engine.ts';
import {createScenery,pointVisible,visibleToSide} from '../game/world.ts';
import {aimProjectileDepth,depthHit} from '../game/projectile-depth.ts';
import {setSquadOrder,ordersForUnit} from '../game/squad-orders.ts';
import {issueLogisticsOrder} from '../game/logistics-orders.ts';
import {readFileSync} from 'node:fs';
const DT=1/60,at=(side,x)=>side?W-x:x;
function arena(){const s=createGame(211,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false,knownScenery:[{},{}]});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;for(const p of s.players)Object.assign(p,{order:'advance',hand:[],deck:[],discard:[],energy:0});return s;}
function one(s,side,id,x,patch={}){const n=s.units.length;spawnUnit(s,side,id,x);const u=s.units[n];s.units.splice(n+1);Object.assign(u,{x,y:CARDS[id].air?180:374,lane:0,pace:1,personalMorale:100,readyAt:-10,rifleReady:1,cooldown:1e9,secondaryCooldown:1e9,fragCooldown:1e9,...patch});return u;}
function watch(u){Object.assign(u,{squadOrder:'watch',squadOrderX:u.x,squadOrderUntil:Infinity,decisionIn:1e9,emplaced:true,emplacementSetupUntil:0});}
function run(s,t,inspect){for(let i=0;i<Math.round(t/DT);i++){tick(s,DT);inspect?.();}}
for(const side of [0,1]) {
 for(const kind of ['tree','house'])test(`side ${side}: strike aircraft cannot reveal ground under ${kind}, including night muzzle flash`,()=>{
  const s=arena(),jet=one(s,side,'strike_jet',at(side,1300)),enemy=one(s,1-side,'infantry',at(side,1380));watch(jet);watch(enemy);s.scenery=createScenery(s.terrain,[{kind,x:at(side,1380)}]);
  refreshVision(s);assert(!visibleToSide(s,side,enemy));assert(!pointVisible(s,side,enemy.x,enemy.y-20));assert.equal(Object.keys(s.knownScenery[side]).length,0,'roof visibility must not leak ground map');
  s.night=true;enemy.flashUntil=10;refreshVision(s);assert(!visibleToSide(s,side,enemy));
 });
 test(`side ${side}: open flat ground offers a small glimpse, wooded slopes and distant ground do not`,()=>{
  const s=arena(),jet=one(s,side,'strike_jet',at(side,1300)),near=one(s,1-side,'infantry',at(side,1380)),far=one(s,1-side,'infantry',at(side,1600));refreshVision(s);
  assert(visibleToSide(s,side,near));assert(!visibleToSide(s,side,far));
  for(let x=1260;x<1450;x++)s.terrain[at(side,x)]=374-Math.max(0,50-Math.abs(x-1340)*.6);s.terrainVersion++;refreshVision(s);assert(!visibleToSide(s,side,near),'terrain undulation prevents open-ground observation');
 });
 test(`side ${side}: recon stays broad, helicopters limited, aerial targets remain visible`,()=>{
  for(const [id,range,seen] of [['scout_drone',700,true],['helicopter',250,true],['helicopter',450,false],['rocket_heli',450,false]]){
   const s=arena();one(s,side,id,at(side,1300));const enemy=one(s,1-side,'infantry',at(side,1300+range));refreshVision(s);assert.equal(visibleToSide(s,side,enemy),seen,id);
  }
  const s=arena();one(s,side,'interceptor',at(side,1300));const plane=one(s,1-side,'strike_jet',at(side,2000));s.scenery=createScenery(s.terrain,[{kind:'house',x:at(side,1400)}]);refreshVision(s);assert(visibleToSide(s,side,plane),'ground restrictions must not disable air combat');
 });
 test(`side ${side}: hidden forest is not strafed, friendly observation restores legitimate firing`,()=>{
  const s=arena(),heli=one(s,side,'attack_drone',at(side,1000),{cooldown:0}),enemy=one(s,1-side,'ifv',at(side,1600),{hp:1e6,maxHp:1e6});watch(heli);watch(enemy);s.scenery=createScenery(s.terrain,[{kind:'tree',x:enemy.x}]);refreshVision(s);run(s,2);assert.equal(heli.shots,0);
  const scout=one(s,side,'scouts',at(side,1550));watch(scout);refreshVision(s);assert(visibleToSide(s,side,enemy));s.scenery=[];const pass=one(s,side,'attack_drone',at(side,1000),{cooldown:0});refreshVision(s);run(s,3);assert(pass.shots>0,JSON.stringify({x:heli.x,y:heli.y,pose:heli.pose,range:CARDS[heli.id].range,shots:heli.shots,visible:s.visible[side]}));
 });
 test(`side ${side}: rifle-only squad retreats from armour instead of charging an invulnerable hull`,()=>{
  const s=arena(),u=one(s,side,'infantry',at(side,1200),{decisionIn:0}),tank=one(s,1-side,'tank',at(side,1450));watch(tank);refreshVision(s);const x=u.x;run(s,6);assert.equal(u.withdrawHeavyUid,tank.uid);assert((x-u.x)*(side?-1:1)>20);assert.equal(u.shots,0,'small calibre does not invent armour penetration');
 });
 for(const id of ['artillery','barrage','anti_tank_gun','aa_gun'])test(`side ${side}: ${id} real crew-towed advance/retreat commands replace placement`,()=>{
  if(!CARDS[id])return;
  assert.deepEqual(ordersForUnit(id).map(o=>o.id),['attack','retreat','watch']);
  const s=arena(),u=one(s,side,id,at(side,1200));assert(setSquadOrder(s,side,u.squad,'attack').ok);run(s,3);assert((u.x-at(side,1200))*(side?-1:1)>50);const forward=u.x;
  assert(setSquadOrder(s,side,u.squad,'retreat').ok);run(s,3);assert((forward-u.x)*(side?-1:1)>30);assert(u.moving);assert.equal(u.shots,0,'cannot fire while crew pushes it');
 });
}
test('two confirmed ordinary rifle hits disable a standard soldier; HP unchanged',()=>{
 const s=arena(),source=one(s,0,'infantry',800),target=one(s,1,'infantry',1000);watch(source);watch(target);assert.equal(target.maxHp,35);
 for(let i=0;i<2;i++){s.projectiles.push({uid:++s.uid,sourceUid:source.uid,x:999,y:338,startX:999,startY:338,tx:1000,ty:338,side:0,targetUid:target.uid,base:null,damage:4,radius:0,ammunition:'rifle',startLane:0,targetLane:0,life:.01,total:.01});tick(s,DT);}
 assert(!isCombatant(target));
});
for(const ammo of ['rifle','machinegun'])test(`${ammo}: real seeded depth aim reduces hit probability by about two thirds`,()=>{
 const s=arena(),source=one(s,0,'infantry',800),target=one(s,1,'infantry',1100);const shots=6000;let hits=0;
 for(let i=0;i<shots;i++){const p={uid:i+500,sourceUid:source.uid,targetUid:target.uid,ammunition:ammo,radius:0,tx:1100,startX:800};aimProjectileDepth(s,p);hits+=depthHit(p,target);}
 // Original spread at 300 is 7.615, body half-width 5 => .657; now ~.219.
 assert(hits/shots>.19&&hits/shots<.25,`${hits}/${shots}`);
 const sniper=one(s,0,'sniper',800);let precise=0;
 for(let i=0;i<1000;i++){const p={uid:i+800,sourceUid:sniper.uid,targetUid:target.uid,ammunition:'rifle',radius:0,tx:1100,startX:800};aimProjectileDepth(s,p);precise+=depthHit(p,target);}
 assert(precise>950,'precision rifle retains its specialised accuracy');
});
test('tank coax confirmed hits disable infantry in two hits, while bursts still miss normally',()=>{
 const s=arena(),tank=one(s,0,'tank',800,{secondaryCooldown:0}),target=one(s,1,'infantry',1120);watch(tank);watch(target);refreshVision(s);run(s,.02);
 const p=s.projectiles.find(p=>p.weapon==='coax');assert(p);assert.equal(p.damage,6);assert.equal(p.infantryMultiplier,1.5);
 let hits=0;run(s,18,()=>{if(target.hp<35&&isCombatant(target))hits=1;});assert(!isCombatant(target),JSON.stringify({hp:target.hp,pose:target.pose,shots:tank.secondaryShots,muzzle:[tank.secondaryMuzzleX,tank.secondaryMuzzleY],x:target.x}));assert(tank.secondaryShots>=2);assert(hits<=1);
});
for(const kind of ['he','artillery','grenade'])test(`${kind}: real blast harms both armies equally, without friendly kill credit`,()=>{
 const s=arena(),a=one(s,0,'infantry',995),b=one(s,1,'infantry',1005);explode(s,1000,354,60,20,0,1,1,kind);assert(a.hp<35&&b.hp<35);assert(Math.abs(a.hp-b.hp)<1e-8);assert(s.notices.some(n=>n.text.includes('误伤')));assert.equal(s.players[0].kills,0);
});
test('ordinary friendly soldier crossing a physical bullet ray gets hurt; other depth lane stays safe',()=>{
 for(const lane of [0,24]){const s=arena(),source=one(s,0,'infantry',800),ally=one(s,0,'infantry',1000,{lane,pose:'idle',stanceLockUntil:100}),enemy=one(s,1,'infantry',1200);for(const u of s.units)watch(u);
  s.projectiles.push({uid:++s.uid,sourceUid:source.uid,startX:900,startY:338,x:900,y:338,tx:1200,ty:338,side:0,targetUid:enemy.uid,base:null,damage:4,radius:0,ammunition:'rifle',startLane:0,targetLane:0,life:.1,total:.1});run(s,.06);assert.equal(ally.hp<35,lane===0,'only the traversed physical depth can be hit');}
});
test('MLRS launches all 16 tubes, then really waits at least 18 seconds before tube 17',()=>{
 const s=arena(),u=one(s,0,'mlrs',750,{cooldown:0}),enemy=one(s,1,'barrage',1470,{hp:1e6,maxHp:1e6});watch(u);watch(enemy);const spotter=one(s,0,'scouts',1300);watch(spotter);refreshVision(s);const times=[];let shots=0;run(s,27,()=>{if(u.shots!==shots){times.push(s.time);shots=u.shots;}});assert(times.length>=17);assert(times[16]-times[15]>=18-DT);assert(times[15]-times[0]<4,'in-salvo cadence stays rapid');
});
test('TOW really observes its longer missile reload interval',()=>{
 const s=arena(),u=one(s,0,'tow_ifv',800,{cooldown:0}),enemy=one(s,1,'tank',1400,{hp:1e6,maxHp:1e6});watch(u);watch(enemy);const spot=one(s,0,'scouts',1300);watch(spot);refreshVision(s);const times=[];let old=0;run(s,25,()=>{if(u.shots!==old){times.push(s.time);old=u.shots;}});assert(times.length>=2);assert(times[1]-times[0]>=11.25-DT);
});
test('ammo-empty gun can return for supply; fixed fortification cannot move',()=>{
 const s=arena(),u=one(s,0,'artillery',1200,{ammo:0,ammoReserve:0});assert(issueLogisticsOrder(s,u.uid,'resupply'));run(s,3);assert(u.x<1170);assert.equal(u.resupplyState,'withdrawing');
 const fort=one(s,0,'fort_machinegun',1400,{ammo:0,ammoReserve:0});assert(!issueLogisticsOrder(s,fort.uid,'advance'));
});
test('shortage uses the existing unit command fan, with no second lower-left selector',()=>{
 const source=readFileSync(new URL('../app/battle.tsx',import.meta.url),'utf8');assert(!source.includes('logistics-selection-button'));assert(!source.includes('<LogisticsMenu'));assert(source.includes('<UnitLogisticsFan'));assert(source.includes('!logisticsStatus &&'));const fan=readFileSync(new URL('../app/unit-logistics-fan.tsx',import.meta.url),'utf8');assert(fan.includes("label:'继续推进'"));assert(fan.includes("label:'回去补给'"));
});

for(const seed of [211,212,213]) test(`seed ${seed}: equal opposing rifle squads actually exchange fire instead of mutually stalling`,()=>{
 const s=arena();s.seed=seed;for(const side of [0,1]){const n=s.units.length;spawnUnit(s,side,'infantry',side?1350:1000);for(const [i,u] of s.units.slice(n).entries())Object.assign(u,{x:(side?1350:1000)+(side?1:-1)*i*18,y:374,lane:(i%4)*12-18,cooldown:0,fragCooldown:1e9,personalMorale:100,pace:1});}
 refreshVision(s);const shots=[0,0];run(s,12,()=>{for(const side of [0,1])shots[side]=Math.max(shots[side],s.units.filter(u=>u.side===side).reduce((n,u)=>n+u.shots,0));});assert(shots.every(n=>n>=3),JSON.stringify(shots));
});
for(const side of [0,1])test(`side ${side}: a low posture blocked by a berm recovers an actual firing stance during a safe lull`,()=>{
 const s=arena(),u=one(s,side,'infantry',at(side,1000),{pose:'prone',stanceLockUntil:100,cooldown:0}),enemy=one(s,1-side,'infantry',at(side,1320),{hp:1e6,maxHp:1e6});watch(u);watch(enemy);const spotter=one(s,side,'scouts',at(side,1280));watch(spotter);
 for(let x=1050;x<=1150;x++)s.terrain[at(side,x)]=374-Math.max(0,20-Math.abs(x-1100)*.4);s.terrainVersion++;refreshVision(s);
 run(s,6);assert(u.shots>0,JSON.stringify({pose:u.pose,x:u.x,blocked:u.blockedAimSince,shots:u.shots}));assert.equal(u.pose,'idle','a committed standing ray clears the bank without a teleport');
});
