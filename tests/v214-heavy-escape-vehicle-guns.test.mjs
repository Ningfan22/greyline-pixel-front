import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,spawnUnit,tick,refreshVision,CARDS,W,muzzlePoint} from '../game/engine.ts';
import {gunPose,aimedGunSolution} from '../game/gun-geometry.ts';
import {drawArticulatedGun,gunRecoil,visualGunMuzzle} from '../game/gun-art.ts';
import {VEHICLE_GUNS} from '../game/vehicle-gun-layout.ts';
const dt=1/60,mirror=(side,x)=>side?W-x:x;
function arena(){const s=createGame(214,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;for(const p of s.players)Object.assign(p,{order:'advance',hand:[],deck:[],discard:[],energy:0});return s;}
function one(s,side,id,x,patch={}){const n=s.units.length;spawnUnit(s,side,id,x);const u=s.units[n];s.units.splice(n+1);Object.assign(u,{x,y:374,lane:0,pace:1,personalMorale:100,readyAt:-10,rifleReady:1,cooldown:1e9,secondaryCooldown:1e9,fragCooldown:1e9,...patch});return u;}
function watch(u){Object.assign(u,{squadOrder:'watch',squadOrderX:u.x,squadOrderUntil:Infinity,decisionIn:1e9});}
function run(s,t,inspect){for(let i=0;i<Math.round(t/dt);i++){tick(s,dt);inspect?.();}}
for(const side of [0,1]){
 test(`side ${side}: locked crouched squad turns, sprints and fans out from an unsupported tank`,()=>{
  const s=arena(),n=s.units.length;spawnUnit(s,side,'infantry',mirror(side,1200));const own=s.units.slice(n);
  own.forEach((u,i)=>Object.assign(u,{x:mirror(side,1200-i*18),y:374,lane:0,pose:'crouch',stanceLockUntil:60,decisionIn:0,pace:1,personalMorale:100,cooldown:1e9,fragCooldown:1e9}));
  const tank=one(s,1-side,'tank',mirror(side,1500));watch(tank);refreshVision(s);const starts=own.map(u=>u.x);run(s,3);
  assert(own.every(u=>u.withdrawHeavyUid===tank.uid && u.pose==='run' && !u.backpedaling && u.facing===(side?1:-1)));
  assert(own.every((u,i)=>(starts[i]-u.x)*(side?-1:1)>50),JSON.stringify(own.map((u,i)=>({x:u.x,start:starts[i],pose:u.pose,lane:u.lane}))));
  assert(new Set(own.map(u=>Math.round(u.lane))).size>=3,'separate depth lanes instead of a pile');
 });
 test(`side ${side}: a prepared loaded AT operator keeps its antiarmour role`,()=>{
  const s=arena(),u=one(s,side,'javelin',mirror(side,1200),{decisionIn:0,cooldown:0});const tank=one(s,1-side,'tank',mirror(side,1580));watch(tank);refreshVision(s);run(s,6);assert.equal(u.withdrawHeavyUid,undefined);assert(u.shots>0,'real missile fire at the tank');
 });
 test(`side ${side}: IFV releases six actual rounds on the painted barrel axis, then pauses`,()=>{
  const s=arena(),u=one(s,side,'ifv',mirror(side,1100),{cooldown:0,ammo:100,ammoReserve:100});watch(u);
  const enemy=one(s,1-side,'infantry',mirror(side,1430),{maxHp:10000,hp:10000});watch(enemy);refreshVision(s);
  const releases=[],seen=new Set();
  run(s,3,()=>{for(const p of s.projectiles)if(p.sourceUid===u.uid&&!seen.has(p.uid)){seen.add(p.uid);releases.push({time:s.time,x:p.startX,y:p.startY,shots:u.shots});const bore=gunPose(u).muzzle;assert(Math.hypot(p.startX-bore.x,p.startY-bore.y)<1e-7);}});
  assert(releases.length>=6,JSON.stringify(releases));
  for(let i=1;i<6;i++)assert(releases[i].time-releases[i-1].time<=.14);
  assert(releases[6].time-releases[5].time>=1.09,'real reload/aim gap');assert.equal(100-u.ammo,u.shots,'each real round costs ammo');
 });
}
for(const id of Object.keys(VEHICLE_GUNS))test(`${id}: independent barrel recoil leaves the hull anchored and rotates both muzzle and bullet origin`,()=>{
 for(const facing of [-1,1])for(const hullAngle of [-.15,0,.15]){
  const u={id,x:1000,y:374,facing,gunFacing:facing,hullAngle,gunElevation:.1,fire:.25,moving:false};
  const pose=gunPose(u),m=muzzlePoint(u,1000+facing*400);assert(Math.hypot(pose.muzzle.x-m.x,pose.muzzle.y-m.y)<1e-7);
  const visual=visualGunMuzzle(u),recoil=gunRecoil(u);assert(recoil<=1.5);assert(Math.abs(Math.hypot(visual.x-m.x,visual.y-m.y)-recoil)<1e-7);
  const draws=[],ctx={save(){},restore(){},translate(x,y){draws.push([x,y]);},rotate(){},scale(){},drawImage(){}};
  const parts={body:{width:165,height:105},barrel:{},barrelPivot:[0,2],sourceElevation:0,bodyGroundOffset:3};
  drawArticulatedGun(ctx,parts,u);assert.deepEqual(draws[0],[u.x,u.y+3],'fixed hull even during firing');assert(Math.hypot(draws[1][0]-(pose.pivot.x-Math.cos(pose.angle)*recoil),draws[1][1]-(pose.pivot.y-Math.sin(pose.angle)*recoil))<1e-7);
 }
});

for(const side of [0,1])test(`side ${side}: close riflemen escape despite nearby AT support and unfinished magazine work`,()=>{
 const s=arena(),u=one(s,side,'infantry',mirror(side,1200),{decisionIn:0,pose:'prone',stanceLockUntil:60,ammo:0,ammoReserve:50,reloadingUntil:20,reloadingStartAt:0});
 const at=one(s,side,'javelin',mirror(side,1070));watch(at);const tank=one(s,1-side,'tank',mirror(side,1450));watch(tank);refreshVision(s);const x=u.x;run(s,.7);
 assert.equal(u.withdrawHeavyUid,tank.uid);assert.equal(u.pose,'run');run(s,2.3);assert((x-u.x)*(side?-1:1)>50,'reloading cannot root the escape');assert(!u.backpedaling);
});
for(const side of [0,1])for(const id of ['scout_car','command_vehicle','pickup','mine_clearer'])test(`${id} side ${side}: actual ammunition releases from its independent visible barrel`,()=>{
 const s=arena(),u=one(s,side,id,mirror(side,1100),{cooldown:0});watch(u);const target=one(s,1-side,'infantry',mirror(side,1400),{maxHp:10000,hp:10000});watch(target);refreshVision(s);let count=0;const seen=new Set();
 run(s,2,()=>{for(const p of s.projectiles)if(p.sourceUid===u.uid&&!seen.has(p.uid)){seen.add(p.uid);count++;const muzzle=gunPose(u).muzzle;assert(Math.hypot(muzzle.x-p.startX,muzzle.y-p.startY)<1e-7);}});assert(count>1,'multiple real bullets, not just flash decoration');
});
for(const side of [0,1])test(`side ${side}: surviving riflemen keep sprinting away under real tank shell flinch`,()=>{
 const s=arena(),n=s.units.length;spawnUnit(s,side,'infantry',mirror(side,1200));const own=s.units.slice(n);
 own.forEach((u,i)=>Object.assign(u,{x:mirror(side,1200-i*18),y:374,lane:0,pose:'crouch',stanceLockUntil:60,decisionIn:0,pace:1,personalMorale:100,cooldown:1e9,fragCooldown:1e9}));
 const tank=one(s,1-side,'tank',mirror(side,1500),{cooldown:0});watch(tank);
 // A forward observer keeps the fleeing riflemen actually seen throughout
 // the tank's longer acquisition; no hidden target can bypass fog of war.
 const observer=one(s,1-side,'scouts',mirror(side,1050));watch(observer);refreshVision(s);const starts=own.map(u=>u.x);run(s,6);
 assert(tank.shots>0,'real enemy shell fire stays lethal');const survivors=own.filter(u=>u.hp>0&&!u.wounded&&!u.surrendered);assert(survivors.length>=2,'the burst does not root all survivors in place');
 assert(survivors.every(u=>(starts[own.indexOf(u)]-u.x)*(side?-1:1)>150&&!u.backpedaling),JSON.stringify(survivors.map(u=>({x:u.x,pose:u.pose,flinch:u.flinchUntil}))));
});
