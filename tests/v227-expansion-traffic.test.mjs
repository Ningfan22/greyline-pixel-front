import test from 'node:test';import assert from 'node:assert/strict';
import {createGame,startGame,spawnUnit,tick,refreshVision,CARDS,setOrder} from '../game/engine.ts';
import {FORT_IDS_V227,GUN_IDS_V227,EXPANSION_IDS_V227} from '../game/expansion-v227.ts';
import {fortificationContact,fortificationSize} from '../game/fortification-ground.ts';
import {gunPose} from '../game/gun-geometry.ts';import {vehicleCrewPose} from '../game/vehicle-crew-pose.ts';
import {initializeAmmo,planAmmoResupply} from '../game/ammo-logistics.ts';
import {soldierPose} from '../game/soldier-pose.ts';import {SoldierHistory} from '../game/soldier-history.ts';
import {warnFriendlyLane,friendlyLineBlocked,friendlyCrossing,refreshFriendlyLanes} from '../game/friendly-fire-lanes.ts';
import {starterState,loadCollection,COLLECTION_STORAGE} from '../game/collection.ts';
const dt=1/30;
function arena(){const s=createGame(227,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;for(const p of s.players)Object.assign(p,{order:'advance',hand:[],deck:[],discard:[],energy:0});return s;}
function one(s,side,id,x){const n=s.units.length;spawnUnit(s,side,id,x);const u=s.units[n];s.units.splice(n+1);return u;}
function run(s,time){for(let i=0;i<time/dt;i++)tick(s,dt);}
test('at least10 forts and12 artillery with distinct working stats and mobile roles',()=>{
 assert.equal(FORT_IDS_V227.length,10);assert.equal(GUN_IDS_V227.length,12);assert(GUN_IDS_V227.filter(id=>CARDS[id].selfPropelled).length>=2);
 assert(CARDS.howitzer_155.damage>CARDS.howitzer_105.damage);assert(CARDS.howitzer_155.range>CARDS.howitzer_105.range);assert(CARDS.howitzer_155.rate>CARDS.howitzer_105.rate);
 for(const id of GUN_IDS_V227){assert(CARDS[id].ammoCapacity>0);assert.equal(CARDS[id].type,'unit');assert(gunPose({id,x:1000,y:374,facing:1}));}
});
for(const side of [0,1])for(const id of [...FORT_IDS_V227,'fort_bunker','fort_machinegun','fort_aa','fort_spawn','fort_wire'])test(`side ${side}: ${id} supplies fixed personnel without capturing the marching squad`,()=>{
 const s=arena();const fort=one(s,side,id,1300);spawnUnit(s,side,'infantry',1300);const existing=s.units.slice(1),count=CARDS[id].garrisonCapacity??0;
 run(s,Math.max(0,(CARDS[id].buildTime??0)-.1));assert.equal(s.units.filter(u=>u.fortCrewUid===fort.uid).length,0,'no premature crew activation');
 run(s,.2);assert.equal(s.units.filter(u=>u.fortCrewUid===fort.uid).length,count);assert(existing.every(u=>u.garrisonUid===undefined),'squad retains its own team');
 setOrder(s,side,'advance');tick(s,dt);assert.equal(s.units.filter(u=>u.garrisonUid===fort.uid).length,count,'army advance leaves dedicated guards');
 fort.hp=0;tick(s,dt);assert.equal(s.units.filter(u=>u.garrisonUid===fort.uid).length,0,'destroyed host releases surviving guards');
});
test('fort foundations support entire width on sloped ground',()=>{
 const floor=x=>360+Math.sin(x/40)*26+x*.02;
 for(const id of [...FORT_IDS_V227,'fort_bunker','fort_wire']){const y=fortificationContact(floor,1100,id),[w]=fortificationSize(id);for(let dx=-w/2;dx<=w/2;dx+=4)assert(y<=floor(1100+dx)+.001,id);}
});
test('completed supply depot has finite transferable stores; unfinished depot supplies nothing',()=>{
 const s=arena(),depot=one(s,0,'fort_supply_depot',1000),client=one(s,0,'infantry',1060);initializeAmmo(depot);initializeAmmo(client);depot.supplyStock=5;client.ammo=0;client.ammoReserve=0;
 planAmmoResupply(s,client,1);assert.equal(client.ammo,0);
 s.time=depot.buildUntil+.01;planAmmoResupply(s,client,1);assert.equal(client.ammo,5);assert.equal(depot.supplyStock,0);planAmmoResupply(s,client,1);assert.equal(client.ammo,5);
});
test('machine gun lane is announced before firing; lower stance clears actual friendly body',()=>{
 const s=arena(),mg=one(s,0,'machinegun',1000),friend=one(s,0,'infantry',1150);friend.lane=mg.lane=0;friend.pose='idle';friend.y=374;
 warnFriendlyLane(s,mg,1030,330,1500,330,0);assert(friendlyLineBlocked(s,mg,1030,330,1500,330,0));const crossing=friendlyCrossing(s,friend);assert(crossing?.blocked);assert.equal(crossing.pose,'prone');
 friend.pose='prone';assert(!friendlyLineBlocked(s,mg,1030,330,1500,330,0));assert(!friendlyCrossing(s,friend)?.blocked);
 s.time=1;refreshFriendlyLanes(s);assert.equal(friendlyCrossing(s,friend),null,'expired fire corridor never becomes a permanent wall');
});
test('a grazing MG lane provides a depth crossing rather than trapping prone infantry',()=>{
 const s=arena(),mg=one(s,0,'machinegun',1000),friend=one(s,0,'infantry',1150);friend.lane=mg.lane=0;friend.pose='prone';friend.y=374;
 warnFriendlyLane(s,mg,1030,366,1500,366,0);const crossing=friendlyCrossing(s,friend);assert(crossing.blocked);assert.equal(Math.abs(crossing.lane),16);friend.lane=crossing.lane;assert.equal(friendlyCrossing(s,friend),null);
});
test('pickup standing operator and raised pintle clear cab roof in both directions',()=>{
 const s=arena();for(const side of [0,1]){const u=one(s,side,'pickup',1000);const p=gunPose(u),crew=vehicleCrewPose(u,2);assert(p.pivot.y<u.y-70);assert(crew.pose.head[1]+crew.y<-78);assert(crew.pose.hip[1]-crew.pose.nearFoot[1]<-20);assert(Math.hypot(crew.pose.nearHand[0]-crew.pose.shoulder[0],crew.pose.nearHand[1]-crew.pose.shoulder[1])<=25.1);}
});
test('lightweight historical rig inputs produce the same poses after live unit mutation',()=>{
 const s=arena();for(const id of Object.keys(CARDS).filter(id=>CARDS[id].members))for(const pose of ['idle','walk','run','crouch','prone','dig']){
 const u=one(s,0,id,1000);Object.assign(u,{pose,moving:['walk','run'].includes(pose),rifleReady:.9,fire:0,gaitPhase:.8,gaitWeight:.6,gaitRun:pose==='run'?1:0,suppression:14,leader:true,teamRole:'overwatch',contactUntil:20,attentionUntil:20,training:2});
 const expected=soldierPose({...u},12),history=new SoldierHistory(u,12);Object.assign(u,{pose:'run',walk:45,rifleReady:0});assert.deepEqual(history.pose,expected,`${id}/${pose}`);
 }
});
test('all22 new cards granted once to existing players without changing their deck or gold',()=>{
 const old=globalThis.localStorage,data=new Map();globalThis.localStorage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};
 try{const prior={...starterState(),gold:312,owned:{infantry:4},testGoldGranted:true};delete prior.expansion227Granted;data.set(COLLECTION_STORAGE,JSON.stringify(prior));data.set('custom-deck','KEEP');const next=loadCollection();assert.equal(next.gold,312);for(const id of EXPANSION_IDS_V227)assert.equal(next.owned[id],1);assert.deepEqual(loadCollection(),next);assert.equal(data.get('custom-deck'),'KEEP');}finally{globalThis.localStorage=old;}
});
test('watchtower guards stand on its elevated deck and retain matching foot and firing geometry',()=>{
 const s=arena(),tower=one(s,0,'fort_watchtower',1200);tower.buildUntil=0;run(s,1);const guards=s.units.filter(u=>u.fortCrewUid===tower.uid);assert.equal(guards.length,2);for(const u of guards){assert.equal(u.y,tower.y-106);assert.equal(u.motion,'ground');assert.notEqual(u.pose,'jump','standing on a platform never starts falling');assert(Math.abs(u.soldierGround.near)<.01,'boots supported by flat observation platform');assert(soldierPose(u,s.time).muzzle[1]<0);}
});
test('a stationary rifleman ducks and clears a grazing MG burst without deadlocking the gun or taking friendly hits',()=>{
 const s=arena(),mg=one(s,0,'machinegun',1000),friend=one(s,0,'infantry',1150),enemy=one(s,1,'infantry',1500);
 Object.assign(mg,{lane:0,pose:'crouch',squadOrder:'watch',squadOrderX:1000,squadOrderUntil:Infinity});Object.assign(friend,{lane:0,fragCooldown:1e9});Object.assign(enemy,{lane:0,pose:'idle',ammo:0,ammoReserve:0,squadOrder:'watch',squadOrderX:1500,squadOrderUntil:Infinity});refreshVision(s);let duck=false,round=false;
 for(let i=0;i<180;i++){tick(s,dt);duck||=(friend.friendlyLaneLowUntil??0)>s.time;round||=s.projectiles.some(p=>p.sourceUid===mg.uid);}
 assert(duck,'actual gun warning drives lower posture');assert(round&&mg.shots>0,'actual gun rounds resume after friend clears lane');assert.equal(friend.hp,friend.maxHp,'real friendly collision does not hit the cautious crossing rifleman');assert(Math.abs(friend.lane)>5||friend.x>1150,'a low grazing burst is passed, not a permanent wall');
});
