import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,spawnUnit,tick,refreshVision,W,CARDS,seekCover,isCombatant} from '../game/engine.ts';
import {suppressNearMiss} from '../game/projectile-depth.ts';
import {stanceTransitionDuration} from '../game/infantry-action-timing.ts';
const DT=1/60,mirror=(side,x)=>side?W-x:x;
function arena(){const s=createGame(210,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;for(const p of s.players)Object.assign(p,{order:'advance',hand:[],deck:[],discard:[],energy:0});return s;}
function one(s,side,id,x,patch={}){const n=s.units.length;spawnUnit(s,side,id,x);const u=s.units[n];s.units.splice(n+1);Object.assign(u,{x,y:374,lane:0,pace:1,personalMorale:100,readyAt:-10,rifleReady:1,cooldown:1e9,secondaryCooldown:1e9,fragCooldown:1e9,...patch});return u;}
function watch(u){Object.assign(u,{squadOrder:'watch',squadOrderX:u.x,squadOrderUntil:Infinity,decisionIn:1e9});}
function run(s,t,inspect){for(let i=0;i<Math.round(t/DT);i++){tick(s,DT);inspect?.();}}
function hit(s,source,u,ammo,damage){const h=u.pose==='prone'?9:u.pose==='crouch'?22:36;s.projectiles.push({uid:++s.uid,x:u.x-2,y:u.y-h,startX:u.x-2,startY:u.y-h,tx:u.x,ty:u.y-h,side:source.side,sourceUid:source.uid,targetUid:u.uid,base:null,damage,radius:0,shell:false,ammunition:ammo,life:.01,total:.01});tick(s,DT);}
for(const ammo of ['rifle','machinegun'])test(`${ammo}: confirmed body hits disable ordinary infantry promptly, without extra HP`,()=>{
 for(const pose of ['idle','prone']){const s=arena(),shooter=one(s,0,'infantry',800),u=one(s,1,'infantry',1000,{pose,stanceLockUntil:100});watch(shooter);watch(u);refreshVision(s);assert.equal(u.maxHp,35);hit(s,shooter,u,ammo,ammo==='rifle'?4:7.5);assert.equal(u.hp,ammo==='rifle'?19:12.5,'actual prone wounds are not discounted');hit(s,shooter,u,ammo,ammo==='rifle'?4:7.5);if(ammo==='rifle'&&isCombatant(u))hit(s,shooter,u,ammo,4);assert(!isCombatant(u),'a short burst/2–3 rifle hits incapacitates');}
});
test('small arms still cannot penetrate armour',()=>{for(const ammo of ['rifle','machinegun']){const s=arena(),a=one(s,0,'infantry',800),u=one(s,1,'tank',1000);watch(a);watch(u);const hp=u.hp;hit(s,a,u,ammo,100);assert.equal(u.hp,hp);}});
for(const side of [0,1]){
 test(`side ${side}: a close MG ray beats the posture lock and magazine work, then stays low`,()=>{
  const s=arena(),u=one(s,side,'infantry',mirror(side,1000),{pose:'idle',stanceLockUntil:60,ammo:0,ammoReserve:30,reloadingUntil:3,reloadingStartAt:0});watch(u);refreshVision(s);
  suppressNearMiss(s,{uid:++s.uid,side:1-side,ammunition:'machinegun',damage:7.5,radius:0,startX:mirror(side,1300),startY:338,startLane:0,targetLane:0,tx:mirror(side,900)},u.x-12,338,u.x+12,338);
  run(s,.6);assert.equal(u.pose,'prone');assert(u.poseAnimUrgent);assert.equal(stanceTransitionDuration(u),.45);assert(u.reloadingUntil>3,'reload work pauses through the real dive');run(s,2);assert.equal(u.pose,'prone','no immediate pop-up');
 });
 test(`side ${side}: normal-health rifleman withdraws immediately from overwhelming visible MG fire`,()=>{
  const s=arena(),u=one(s,side,'infantry',mirror(side,1200),{decisionIn:0,pose:'idle',stanceLockUntil:60});
  const mg=one(s,1-side,'machinegun',mirror(side,1450),{emplaced:true,emplacementSetupUntil:0});watch(mg);refreshVision(s);const start=u.x;run(s,.8);
  assert.equal(u.withdrawHeavyUid,mg.uid);assert(u.withdrawSmallArms);assert(['crouch','prone'].includes(u.pose));run(s,8);assert((start-u.x)*(side?-1:1)>15,'actual ground displacement without waiting for morale collapse');assert.equal(u.maxHp,35);
 });
 test(`side ${side}: reinforcement clears the danger memory, no threat advances normally`,()=>{
  const s=arena(),u=one(s,side,'infantry',mirror(side,1200),{decisionIn:0});const mg=one(s,1-side,'machinegun',mirror(side,1450));watch(mg);refreshVision(s);run(s,.5);assert(u.withdrawSmallArms);
  watch(one(s,1-side,'recovery_vehicle',mirror(side,1510)));
  for(let i=0;i<3;i++){const friend=one(s,side,'machinegun',mirror(side,1170-i*15));watch(friend);}refreshVision(s);run(s,1);assert.equal(u.withdrawHeavyUid,undefined,'real loaded MG support removes the mismatch');
  const clear=arena(),scout=one(clear,side,'infantry',mirror(side,1000));const start=scout.x;run(clear,4);assert((scout.x-start)*(side?-1:1)>20);
 });
 test(`side ${side}: an unseen MG cannot trigger a retreat`,()=>{const s=arena(),u=one(s,side,'infantry',mirror(side,900),{decisionIn:0}),foe=one(s,1-side,'machinegun',mirror(side,2400));watch(foe);refreshVision(s);run(s,1);assert.equal(u.withdrawHeavyUid,undefined);});
}
test('safety cover searches behind the soldier and allows shelter outside his firing range',()=>{
 const s=arena(),u=one(s,0,'infantry',1100),foe=one(s,1,'machinegun',1550);
 // A usable trench lip on the withdrawal side, with no firing-range requirement.
 for(let x=995;x<1055;x++)s.terrain[x]=374+Math.max(0,18-Math.abs(1025-x)*.6);s.terrainVersion++;
 const cover=seekCover(s,u,foe,true);assert(cover!==null&&cover<1100,'a real nearby terrain shelter is chosen');
});
for(const side of [0,1])test(`side ${side}: real MG fire kills an exposed control but a reacting soldier survives behind the same crater lip`,()=>{
 const result=[];
 for(const reacts of [false,true]){
  const s=arena(),u=one(s,side,'infantry',mirror(side,1200),{pose:'idle',decisionIn:reacts?0:1e9,stanceLockUntil:60});
  const mg=one(s,1-side,'machinegun',mirror(side,1450),{pose:'idle',cooldown:0,emplaced:true,emplacementSetupUntil:0});watch(mg);
  for(let x=1170;x<=1210;x++)s.terrain[mirror(side,x)]=374+Math.max(0,15-Math.abs(1190-x)*.75);
  s.terrainVersion++;u.y=s.terrain[Math.floor(u.x)];if(!reacts)watch(u);refreshVision(s);
  run(s,8,()=>{if(!reacts&&isCombatant(u))Object.assign(u,{pose:'idle',poseAnimProgress:undefined,poseAnimAt:undefined,duckUntil:0,duckProneUntil:0,coverSafetyUntil:0});});
  result.push({alive:isCombatant(u),hp:u.hp,pose:u.pose,shots:mg.shots});
 }
 assert(!result[0].alive&&result[0].shots>=2,JSON.stringify(result));
 assert(result[1].alive&&result[1].hp>0&&result[1].pose==='prone',JSON.stringify(result));
});
test('safety shelter is genuinely blocked from incoming fire, not inside a wall or across a cliff',()=>{
 const s=arena(),u=one(s,0,'infantry',1100),foe=one(s,1,'machinegun',1300);
 s.walls=[{uid:++s.uid,x:1080,width:10,height:60,hp:100,maxHp:100}];
 assert.equal(seekCover(s,u,foe,true),null,'cannot walk through the blocking wall to claim its far side');
 for(let x=995;x<1055;x++)s.terrain[x]=392;
 assert.equal(seekCover(s,u,foe,true),null,'an abrupt crater edge is not a traversable retreat route');
});
for(const side of [0,1])test(`side ${side}: an entire outmatched squad moves even when its theoretical cover cannot actually fire`,()=>{
 const s=arena(),n=s.units.length;spawnUnit(s,side,'infantry',mirror(side,1200));const own=s.units.slice(n);
 for(const [i,u] of own.entries())Object.assign(u,{x:mirror(side,1200-i*18),y:374,lane:i%4*12,pose:'idle',stanceLockUntil:60,decisionIn:0,personalMorale:100,pace:1,fragCooldown:1e9,cooldown:1e9});
 for(let i=0;i<3;i++){const mg=one(s,1-side,'machinegun',mirror(side,1450+i*30),{pose:'prone',emplaced:true,emplacementSetupUntil:0});watch(mg);}
 refreshVision(s);const starts=own.map(u=>u.x);run(s,8);
 assert(own.every((u,i)=>(starts[i]-u.x)*(side?-1:1)>15),JSON.stringify(own.map((u,i)=>({x:u.x,start:starts[i],goal:u.withdrawGoal,pose:u.pose}))));
});
