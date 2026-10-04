import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { createGame, startGame, spawnUnit, tick, refreshVision, explode } from '../game/engine.ts';
import { loadBakedBattleArt } from '../game/battle-art-baked.ts';
import { drawFlameStream } from '../game/weapon-art-v204.ts';
import { aimedGunSolution, gunMount } from '../game/gun-geometry.ts';
const { createCanvas, Image } = createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
globalThis.Image=class extends Image {set src(path){super.src=fileURLToPath(new URL('../public'+path,import.meta.url));}};
const art=await loadBakedBattleArt();
const DT=1/60, near=(a,b)=>assert(Math.abs(a-b)<1e-6,`${a} != ${b}`);
function arena() {
 const s=createGame(207,undefined,undefined,undefined,{weather:false});startGame(s);
 Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});
 s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;
 for(const p of s.players)Object.assign(p,{hand:[],deck:[],discard:[],energy:0});return s;
}
function spawn(s,side,id,x){const n=s.units.length;spawnUnit(s,side,id,x);const u=s.units[n];Object.assign(u,{squadOrder:'watch',squadOrderX:x,squadOrderUntil:Infinity,emplaced:true,emplacementSetupUntil:0});return u;}
function drain(s,u,seconds){const shots=[];let old=u.shots;for(let i=0;i<seconds*60;i++){tick(s,DT);if(u.shots!==old){const p=s.projectiles.findLast(p=>p.sourceUid===u.uid);if(p)shots.push({...p});old=u.shots;}}return shots;}
test('rocket pod stays nearly level and its shell departs along the actual tube axis on either side',()=>{
 for(const facing of [-1,1]) for(const range of [120,350,600]) {
  const u={id:'rocket_heli',x:1000,y:150,facing,hullAngle:0};
  const aim=aimedGunSolution(u,1000+facing*range,354);
  assert(aim.canFire);assert(aim.elevation>=-10*Math.PI/180-1e-8);assert(aim.elevation<=5*Math.PI/180+1e-8);
  assert(aim.arc>0);
  const tangent=Math.atan2(354-aim.muzzle.y-4*aim.arc,1000+facing*range-aim.muzzle.x);
  near(Math.sin(tangent),Math.sin(aim.angle));near(Math.cos(tangent),Math.cos(aim.angle));
 }
});
test('actual helicopter rockets still launch after constraining their rack',()=>{
 const s=arena(),u=spawn(s,0,'rocket_heli',850),v=spawn(s,1,'ifv',1200);
 Object.assign(v,{hp:1e6,maxHp:1e6,cooldown:1e9,secondaryCooldown:1e9});spawn(s,0,'pathfinders',1230);refreshVision(s);
 const shots=drain(s,u,9);assert(shots.length>=2);
 for(const p of shots){assert(p.arc>0);assert(p.startY<300);assert(p.ammunition==='rocket');}
 assert(Math.abs(u.gunElevation)<=10*Math.PI/180+1e-8);
});
test('MLRS area salvo has wider real impact distribution and still fires all 16 tubes',()=>{
 const s=arena(),u=spawn(s,0,'mlrs',750),v=spawn(s,1,'barrage',1470);
 Object.assign(v,{hp:1e6,maxHp:1e6,cooldown:1e9});spawn(s,0,'pathfinders',1270);refreshVision(s);
 const shots=drain(s,u,7);assert.equal(shots.length,16);
 assert.deepEqual(shots.map(p=>p.launcherTube),Array.from({length:16},(_,i)=>i));
 const span=Math.max(...shots.map(p=>p.tx))-Math.min(...shots.map(p=>p.tx));
 assert(span>50,`real salvo should cover a wider area: ${span}`);
});
for(const mode of ['endpoint','terrain collision'])test(`rocket ${mode} greatly reduces excavated soil, including after shooter removal`,()=>{
 function impact(ammunition){const s=arena();s.projectiles=[{sourceUid:99999,sourceCardId:'mlrs',ammunition,x:1000,y:340,startX:1000,startY:340,tx:1000,ty:mode==='endpoint'?366:390,side:0,targetUid:null,base:null,damage:10,radius:55,life:DT/2,total:DT,arc:0,effect:'artillery'}];tick(s,DT);
  const cuts=s.terrain.map((h,i)=>Math.max(0,h-s.original[i]));return{depth:Math.max(...cuts),volume:cuts.reduce((a,b)=>a+b,0)};}
 const shell=impact('cannon'),rocket=impact('rocket');
 assert(shell.depth>=8);assert(rocket.depth>0&&rocket.depth<=shell.depth*.13);
 assert(rocket.volume<shell.volume*.08,`${rocket.volume} vs ${shell.volume}`);
});
test('rocket soil reduction preserves explosive damage to exposed soldiers and buildings',()=>{
 function blast(ammunition){const s=arena(),u=spawn(s,1,'infantry',1010);s.units=[u];const before=u.hp;
  s.walls=[{x:1000,width:30,height:50,hp:1000}];
  explode(s,1000,354,55,10,0,1,1,'artillery',1,{sourceUid:99999,ammunition});
  return{loss:before-u.hp,wall:s.walls[0].hp};}
 const old=blast('cannon'),rocket=blast('rocket');near(rocket.loss,old.loss);assert.equal(rocket.wall,old.wall);
});
test('procedural coarse flame needs no image and remains horizontal on both facings',()=>{
 assert.equal(art.weaponEffects.flame,undefined);
 for(const facing of [-1,1])for(let frame=0;frame<4;frame++){
  function draw(ty){const c=createCanvas(320,160);drawFlameStream(c.getContext('2d'),{rocket:null},160,80,160+facing*130,ty,frame/13,0);return c.getContext('2d').getImageData(0,0,320,160).data;}
  assert.deepEqual(draw(20),draw(145),'target Y cannot tilt the visible flame');
  const pixels=draw(80);let nearNozzle=0;
  for(let y=76;y<=84;y++)for(let x=0;x<8;x++)if(pixels[(y*320+160+facing*x)*4+3]>120)nearNozzle++;
  assert(nearNozzle>0,'every cel is locked to the same nozzle');
 }
});
test('actual flamethrower projectile follows the same level barrel as the stream',()=>{
 const s=arena(),u=spawn(s,0,'flame_team',850);const v=spawn(s,1,'infantry',965);
 for(const enemy of s.units.filter(v=>v.side===1))Object.assign(enemy,{hp:1e6,maxHp:1e6,cooldown:1e9});refreshVision(s);
 const shots=drain(s,u,2);assert(shots.length>0);
 for(const p of shots){assert.equal(p.ammunition,'flame');near(p.ty,p.startY);assert.equal(p.arc,0);}
});
