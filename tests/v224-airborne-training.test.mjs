import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,spawnUnit,playCard,tick,refreshVision,W,CARDS} from '../game/engine.ts';
import {MAP_IDS} from '../game/maps.ts';
import {gliderLanding,clearGliderLanding} from '../game/glider.ts';
import {airGroundSight,sightRange,visibleToSide} from '../game/world.ts';
import {infantryTraining,tacticalActionScale} from '../game/infantry-training.ts';
import {aimProjectileDepth,depthHit} from '../game/projectile-depth.ts';
import {stanceTransitionDuration} from '../game/infantry-action-timing.ts';
import {wreckKind} from '../game/wreck-geometry.ts';
const dt=1/60;
function arena(){const s=createGame(224,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;for(const p of s.players)Object.assign(p,{order:'advance',hand:[],deck:[],discard:[],energy:10});return s;}
function one(s,side,id,x){const n=s.units.length;spawnUnit(s,side,id,x);const u=s.units[n];s.units.splice(n+1);Object.assign(u,{pace:1,personalMorale:100,cooldown:0,readyAt:-10,fragCooldown:1e9});return u;}
function watch(u){Object.assign(u,{squadOrder:'watch',squadOrderX:u.x,squadOrderUntil:Infinity,cooldown:1e9,secondaryCooldown:1e9});}
function run(s,seconds,inspect){for(let i=0;i<Math.round(seconds/dt);i++){tick(s,dt);inspect?.();}}
function deploy(s,side,id,x){const t={id,uid:++s.uid};s.players[side].hand=[t];s.players[side].energy=10;const result=playCard(s,side,t.uid,x);assert(result.ok,result.message);return s.units.at(-1);}
for(const side of [0,1]){
 const dir=side?-1:1,x=side?W-1250:1250;
 test(`side ${side}: AA keeps a rear screen instead of charging at the enemy HQ`,()=>{
  const s=arena(),screen=one(s,side,'infantry',x),sam=one(s,side,'sam_vehicle',x-dir*410);watch(screen);
  run(s,30);assert((screen.x-sam.x)*dir>=300,JSON.stringify({screen:screen.x,sam:sam.x}));assert(Math.abs(sam.x-(screen.x-dir*320))<3);
 });
 test(`side ${side}: AA fires at a distant plane without chasing it`,()=>{
  const s=arena(),screen=one(s,side,'infantry',x),sam=one(s,side,'sam_vehicle',x-dir*320);watch(screen);
  const air=one(s,1-side,'helicopter',x+dir*1200);Object.assign(air,{cooldown:1e9,squadOrder:'watch',squadOrderX:air.x,squadOrderUntil:Infinity,hp:10000,maxHp:10000});refreshVision(s);
  const start=sam.x;let fired=false;run(s,12,()=>{fired||=sam.shots>0;});assert(fired);assert(Math.abs(sam.x-start)<5);assert(air.hp<10000);
 });
 test(`side ${side}: AA falls behind the screen when a ground weapon approaches`,()=>{
  const s=arena(),screen=one(s,side,'infantry',x),sam=one(s,side,'sam_vehicle',x-dir*110),foe=one(s,1-side,'infantry',x+dir*320);watch(screen);watch(foe);refreshVision(s);const start=sam.x;run(s,8);assert((sam.x-start)*dir<-100);assert.equal(sam.shots,0);
 });
 test(`side ${side}: combat movement runs; peaceful infantry still walks`,()=>{
  const calm=arena(),regular=one(calm,side,'infantry',side?W-600:600);let walk=false,runPose=false;run(calm,2,()=>{walk||=regular.moving&&regular.pose==='walk';runPose||=regular.moving&&regular.pose==='run';});assert(walk);assert(!runPose);
  const s=arena(),u=one(s,side,'infantry',x),foe=one(s,1-side,'infantry',x+dir*420);watch(foe);u.cooldown=1e9;refreshVision(s);let combatRun=false;run(s,7,()=>{combatRun||=u.moving&&u.pose==='run';});assert(combatRun,JSON.stringify({pose:u.pose,x:u.x,goal:u.teamMoveGoal,tactic:u.tactic}));
 });
 test(`side ${side}: explicit crouch order survives combat movement`,()=>{
  const s=arena(),u=one(s,side,'infantry',x),foe=one(s,1-side,'infantry',x+dir*430);watch(foe);s.players[side].order='crouch';u.cooldown=1e9;refreshVision(s);let crouch=false;run(s,6,()=>{assert.notEqual(u.pose,'run');crouch||=u.pose==='crouch';});assert(crouch);
 });
 for(const id of Object.keys(CARDS).filter(id=>CARDS[id].airdrop&&!CARDS[id].insertion))test(`side ${side}: ${id} waits for an actual base-launched transport before jumping`,()=>{
  const s=arena(),target=side?W-1600:1600,carrier=deploy(s,side,id,target);assert.equal(carrier.id,'parachute_transport');assert.equal(s.units.filter(u=>u.id===id).length,0);assert.equal(carrier.x,side?W-70:70);
  run(s,.5);assert.equal(s.units.filter(u=>u.id===id).length,0);assert((carrier.x-(side?W-70:70))*dir>450);
  let firstAt,individual=false,lastCount=0;run(s,4,()=>{const people=s.units.filter(u=>u.id===id);if(people.length&&!firstAt)firstAt=s.time;individual||=people.length>0&&people.length<(CARDS[id].members??1);for(const p of people)if(p.parachuting){assert(p.y<374);assert.equal(p.shots,p.member);}assert(people.length>=lastCount);lastCount=people.length;});
  assert(firstAt>.5);assert(individual);const people=s.units.filter(u=>u.id===id);assert.equal(people.length,CARDS[id].members);assert.equal(new Set(people.map(u=>u.squad)).size,1);assert.equal(carrier.parachuteFlight.dropped,CARDS[id].members);
  run(s,2);assert(people.every(u=>!u.parachuting));assert.equal(s.units.filter(u=>u.id===id).length,CARDS[id].members);
 });
 test(`side ${side}: destroyed transport loses remaining cargo instead of spawning it`,()=>{
  const s=arena(),carrier=deploy(s,side,'paratroopers',side?W-1600:1600);carrier.hp=0;carrier.destroyed=false;run(s,6);assert.equal(s.units.filter(u=>u.id==='paratroopers').length,0);
 });
 test(`side ${side}: air assault deploys five elite troops with unchanged HP`,()=>{
  const s=arena(),carrier=deploy(s,side,'air_assault',side?W-1500:1500);run(s,15);const cargo=s.units.filter(u=>u.id==='paratroopers');assert.equal(cargo.length,5);assert(cargo.every(u=>infantryTraining(u)==='elite'));assert(cargo.every(u=>u.maxHp===44));assert.equal(CARDS.air_assault.hp,300);assert.equal(CARDS.air_assault.cost,4);assert(carrier.airlift.dropped===5);
 });
}
test('training produces measured depth hits without raising damage or health',()=>{
 const rates=[];for(const training of ['regular','trained','elite']){const s=arena(),u=one(s,0,'infantry',1000),t=one(s,1,'infantry',1350);u.training=training;t.pose='idle';let hits=0;
 for(let i=0;i<12000;i++){const p={uid:i+1,sourceUid:u.uid,targetUid:t.uid,startX:u.x,tx:t.x,ammunition:'rifle'};aimProjectileDepth(s,p);hits+=depthHit(p,t)?1:0;}rates.push(hits/12000);assert.equal(u.maxHp,35);}
 assert(rates[0]>.17&&rates[0]<.37,JSON.stringify(rates));assert(rates[1]>rates[0]*1.6);assert(rates[2]>rates[1]*1.3);
});
test('a sniper can hit a prone target at full range almost every time',()=>{
 const s=arena(),u=one(s,0,'sniper',1000),t=one(s,1,'infantry',1780);t.pose='prone';let hits=0;
 for(let i=0;i<10000;i++){const p={uid:i+1,sourceUid:u.uid,targetUid:t.uid,startX:u.x,tx:t.x,ammunition:'rifle'};aimProjectileDepth(s,p);hits+=depthHit(p,t)?1:0;}assert(hits/10000>.97);assert.equal(u.maxHp,50);
});
test('elite stance drills finish faster on the shared simulation/render clock',()=>{
 const normal={id:'infantry',poseAnimFrom:'stand',poseAnimSeen:'prone'},elite={...normal,training:'elite'};assert(stanceTransitionDuration(elite)<stanceTransitionDuration(normal)*.65);assert(tacticalActionScale(elite)<1);assert.equal(stanceTransitionDuration({...elite,poseAnimUrgent:true}),.45*.62);
});
test('sniper and deployed observer expand actual ground vision, transport plane supplies none',()=>{
 const s=arena(),sniper=one(s,0,'sniper',1000),foe=one(s,1,'infantry',2260);watch(sniper);refreshVision(s);assert(sightRange(sniper)>1400);assert(visibleToSide(s,0,foe));const n=s.units.length;spawnUnit(s,0,'sniper_team',800);const observer=s.units[n+1];Object.assign(observer,{moving:false,stillFor:2,suppression:0});assert.equal(sightRange(observer),1650);assert.equal(airGroundSight({id:'parachute_transport'}),0);
});
test('carrier is internal and has its own wreck identity',()=>{assert(CARDS.parachute_transport.internal);assert.equal(wreckKind('parachute_transport'),'parachute_transport');});
for(const map of MAP_IDS)for(const side of[0,1])test(`${map} side ${side}: glider deploys near the selected area and really lands its squad`,()=>{
 let delivered=false;for(const request of[1600,2000,1200,2500]){const s=createGame(224,undefined,undefined,map,{mapSeed:224,weather:false});startGame(s);s.aiIn=1e9;for(const p of s.players)Object.assign(p,{deck:[],hand:[],energy:10});const spot=gliderLanding(s,request,side);if(spot===null)continue;assert(Math.abs(spot-request)<=650);assert(clearGliderLanding(s,spot,side));const u=deploy(s,side,'glider_assault',request);run(s,16);delivered=s.units.filter(v=>v.id==='glider_assault').length===4;if(delivered){assert(s.wrecks.some(w=>w.id===u.uid&&w.abandoned));break;}}
 assert(delivered,'no usable route actually delivered the squad');
});
test('gliders accept a gentle slope and wrecks, reject a sheer local hole',()=>{const s=arena();for(let x=1300;x<1900;x++)s.terrain[x]=374+(x-1600)*.09;s.wrecks.push({id:50,cardId:'heavy_tank',x:1600,y:374,side:0,angle:0});assert(clearGliderLanding(s,1600,0));s.terrain[1600]+=90;assert(!clearGliderLanding(s,1600,0));});

test('a live SAM intercepts the real paratroop transport before it can unload',()=>{
 const s=arena(),sam=one(s,1,'sam_vehicle',2100);sam.squadOrder='watch';sam.squadOrderX=sam.x;sam.squadOrderUntil=Infinity;
 const carrier=deploy(s,0,'paratroopers',1600);refreshVision(s);run(s,6);assert(sam.shots>0);assert(carrier.hp<=0);assert.equal(carrier.parachuteFlight.dropped,0);assert.equal(s.units.filter(u=>u.id==='paratroopers').length,0);
});
test('AA can interrupt a rearward relocation to launch a ready interception',()=>{
 const s=arena(),screen=one(s,0,'infantry',1300),sam=one(s,0,'sam_vehicle',1280),air=one(s,1,'helicopter',2300);watch(screen);watch(air);air.hp=air.maxHp=10000;const start=sam.x;refreshVision(s);run(s,1);assert(sam.shots>0);assert(sam.x<start);
});
test('an impossible glider landing keeps both the card and command points',()=>{
 const s=arena();s.walls=[{x:1600,width:1800,height:100,hp:100,maxHp:100}];assert.equal(gliderLanding(s,1600,0),null);const t={id:'glider_assault',uid:++s.uid};s.players[0].hand=[t];const energy=s.players[0].energy;const result=playCard(s,0,t.uid,1600);assert(!result.ok);assert.equal(s.players[0].energy,energy);assert(s.players[0].hand.includes(t));assert.equal(s.units.length,0);
});
