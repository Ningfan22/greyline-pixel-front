import test from 'node:test';
import assert from 'node:assert/strict';
import {BattleFrameBudget} from '../game/battle-frame-budget.ts';
import {advanceBattleFrame} from '../game/battle-clock.ts';
import {createGame,startGame,spawnUnit,refreshVision,tick,contactSafeX,CARDS,W} from '../game/engine.ts';
import {ammoRatio,ammoSummary,planAmmoResupply,initializeAmmo} from '../game/ammo-logistics.ts';
import {buildSpatial} from '../game/spatial.ts';
import {soldierPose,updateSoldierGround} from '../game/soldier-pose.ts';
function game(){const s=createGame(225,undefined,undefined,undefined,{weather:false});startGame(s);s.units=[];s.scenery=[];s.walls=[];s.terrain.fill(374);s.original.fill(374);s.aiIn=1e9;return s;}
for(const hz of [60,90,120,144])for(const mobile of [true,false])test(`${hz}Hz mobile=${mobile}: bounded paints preserve the battle's real elapsed time`,()=>{
 const budget=new BattleFrameBudget(),s=game();s.players[0].jam=15;s.players[0].drawIn=1;
 let remainder=0,frames=0;
 for(let i=0;i<=hz*11;i++){const dt=budget.take(i*1000/hz,mobile);if(dt!==null){frames++;remainder=advanceBattleFrame(s,dt,remainder);budget.record(i*1000/hz,1);}}
 assert(frames<=(mobile?332:662));assert(Math.abs(s.time-11)<.04);
 assert(Math.abs(s.players[0].energy-2)<.01);assert(Math.abs(s.players[0].jam-4)<.04);assert.equal(s.players[0].drawIn,0);
});
test('overloaded frames back off to 20Hz and recover without catch-up render bursts',()=>{
 const b=new BattleFrameBudget();b.take(0,true);b.record(0,80);let count=0;
 for(let i=1;i<=120;i++){const dt=b.take(i*1000/120,true);if(dt!==null){count++;b.record(i*1000/120,2);}}
 assert(count<=21);assert.equal(b.fps,20);
 assert(b.take(2500,true)!==null);assert.equal(b.fps,30);
 assert.equal(b.take(2500,true),null);b.reset(3000);assert.equal(b.take(3000,true),0);
});
for(const side of [0,1])test(`side ${side}: 30Hz and 20Hz troops still fire, kill, and consume ammunition`,()=>{
 for(const fps of [30,20]){const s=game();spawnUnit(s,side,'infantry',side?1900:1500);spawnUnit(s,1-side,'infantry',side?1500:1900);
 refreshVision(s);const original=s.units.map(u=>u.hp);for(let i=0;i<fps*12;i++)tick(s,1/fps);
 assert(s.units.some(u=>u.side===side&&u.shots>(u.member??0)));assert(s.units.some(u=>u.side!==side&&u.shots>(u.member??0)));
 assert(s.units.some((u,i)=>u.hp<original[i]));assert(s.units.some(u=>ammoRatio(u)<1));
 }
});
test('allocation-free ammunition ratios match the detailed public readout for every unit profile',()=>{
 const s=game();for(const id of Object.keys(CARDS)){spawnUnit(s,0,id,500);const u=s.units.at(-1);initializeAmmo(u);
 for(const factor of [0,.13,.5,1,1.3]){u.ammo=Math.floor(Math.max(0,u.ammo)*factor);u.ammoReserve=Math.floor(Math.max(0,u.ammoReserve)*factor);
 u.secondaryAmmo=u.secondaryAmmo===undefined?undefined:Math.floor(u.secondaryAmmo*factor);u.secondaryAmmoReserve=u.secondaryAmmoReserve===undefined?undefined:Math.floor(u.secondaryAmmoReserve*factor);
 const rows=ammoSummary(u),expected=rows.length?Math.min(...rows.map(r=>r.ratio)):1;assert.equal(ammoRatio(u),expected,id);}}
});
test('indexed contact stops match full-army scan, including contacts beside a cell boundary',()=>{
 const s=game();for(let i=0;i<50;i++)spawnUnit(s,i%2,'infantry',500+i*50);s.visible=[s.units.map(u=>u.uid),s.units.map(u=>u.uid)];
 for(const u of s.units)for(const step of [-100,-1,.2,20,100]){s.spatial=undefined;const plain=contactSafeX(s,u,u.x+step);s.spatial=buildSpatial(s.units,W);assert.equal(contactSafeX(s,u,u.x+step),plain);}
});
test('cached suppliers reflect depleted stock and suppliers spawned within the same tick',()=>{
 const s=game();spawnUnit(s,0,'infantry',700);const u=s.units[0];initializeAmmo(u);u.ammo=0;u.ammoReserve=0;
 planAmmoResupply(s,u,.05);spawnUnit(s,0,'supply_truck',700);const truck=s.units.at(-1);initializeAmmo(truck);
 for(let i=0;i<30;i++)planAmmoResupply(s,u,.05);assert(u.ammo>0);assert(truck.supplyStock<CARDS.supply_truck.supplyCapacity);
 truck.supplyStock=0;const ammo=u.ammo;for(let i=0;i<30;i++)planAmmoResupply(s,u,.05);assert.equal(u.ammo,ammo);
});
test('body-only ground sampling equals the complete unplanted rig across roles, gaits and stance changes',()=>{
 for(const id of ['infantry','antiarmor','sniper','flame_team','engineers'])for(const pose of ['idle','walk','run','prone','crouch'])for(let i=0;i<8;i++){
 const u={id,uid:1,member:0,hp:100,pose,motion:'ground',moving:pose!=='idle',climbing:0,walk:i,gaitPhase:i,gaitWeight:.8,gaitRun:pose==='run'?1:0,x:500,y:374,facing:i%2?1:-1};
 const p=soldierPose(u,10),floor=x=>374+(x-500)*.12;
 updateSoldierGround(u,floor,10,1/30);
 assert(Math.abs(u.soldierGround.near-(floor(u.x+p.nearFoot[0]*u.facing)-u.y))<1e-9,`${id}/${pose}/near`);
 assert(Math.abs(u.soldierGround.far-(floor(u.x+p.farFoot[0]*u.facing)-u.y))<1e-9);
 assert(Math.abs(u.soldierGround.hip-(floor(u.x+p.hip[0]*u.facing)-u.y))<1e-9);
 }
});
