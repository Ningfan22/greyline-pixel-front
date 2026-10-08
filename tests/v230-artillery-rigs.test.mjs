import test from 'node:test';import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import {createRequire} from 'node:module';
import {GUN_IDS_V227} from '../game/expansion-v227.ts';
import {expansionGunParts,expansionGunMount,expansionGunLayout} from '../game/expansion-art-v227.ts';
import {createGame,startGame,spawnUnit,tick,refreshVision,CARDS,W} from '../game/engine.ts';
import {gunPose} from '../game/gun-geometry.ts';import {drawArticulatedGun} from '../game/gun-art.ts';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');globalThis.document={createElement:()=>createCanvas(1,1)};
const dt=1/60;
function arena(){const s=createGame(230,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;for(const p of s.players)Object.assign(p,{order:'advance',hand:[],deck:[],discard:[],energy:0});return s;}
function one(s,side,id,x){const n=s.units.length;spawnUnit(s,side,id,x);const u=s.units[n];s.units.splice(n+1);Object.assign(u,{x,y:374,lane:0,shots:0,cooldown:1e9,secondaryCooldown:1e9,fragCooldown:1e9,pace:1,personalMorale:100,readyAt:-10,rifleReady:1,transportReleased:true,squadOrder:'watch',squadOrderX:x,squadOrderUntil:Infinity,logisticsOrder:'hold',decisionIn:1e9});return u;}
const manifest=JSON.parse(readFileSync(new URL('../public/art/v230-guns/provenance.json',import.meta.url)));
test('all twelve rigs preserve distinct authored originals and independent gun pixels',()=>{assert.equal(manifest.assets.length,12);const hashes=new Set();for(const a of manifest.assets){const h=createHash('sha256').update(readFileSync(new URL('../'+a.source,import.meta.url))).digest('hex');assert.equal(h,a.sha256);hashes.add(h);}assert.equal(hashes.size,12);});
for(const id of GUN_IDS_V227){
 test(id+': painted muzzle follows elevation while carriage remains fixed',async()=>{const body=await loadImage(readFileSync(new URL('../public/art/v230-guns/'+id+'-body.png',import.meta.url))),barrel=await loadImage(readFileSync(new URL('../public/art/v230-guns/'+id+'-barrel.png',import.meta.url)));const parts=expansionGunParts(id,body,barrel),a=expansionGunLayout(id),m=expansionGunMount(id);assert(parts.barrel.width>20,'real separate tube');assert(Math.abs(parts.barrel.width/parts.barrel.height-barrel.width/barrel.height)<1,'no stretched tube');let previous;
 for(const e of [m.minElevation,m.restElevation,m.maxElevation]){const c=createCanvas(500,260),ctx=c.getContext('2d');drawArticulatedGun(ctx,parts,{id,x:200,y:240,facing:1,gunFacing:1,gunElevation:e});const bytes=c.toBuffer('image/png');assert(bytes.length>1000);const hash=createHash('sha256').update(bytes).digest('hex');assert.notEqual(hash,previous,'visible rotation must change pixels');previous=hash;}
 assert.equal(parts.body.width,a.bodyWidth);});
 for(const side of [0,1])for(const gap of [Math.max(400,(CARDS[id].minRange??0)+90),Math.min(900,CARDS[id].range-80)])test(id+' side '+side+' gap '+gap+': actual finite-ammo fire after gradual elevation',()=>{const s=arena(),at=x=>side?W-x:x,u=one(s,side,id,at(900)),foe=one(s,1-side,'apc_transport',at(900+gap));u.cooldown=0;u.gunElevation=expansionGunMount(id).restElevation;foe.hp=foe.maxHp=10000;const observer=one(s,side,'sniper',at(900+gap-80));refreshVision(s);let shots=0,moved=false,last=u.gunElevation,seen=new Set();
 for(let i=0;i<1200;i++){tick(s,dt);if(u.gunElevation!==undefined){const d=Math.abs(u.gunElevation-last);assert(d<=.42*dt+.016,'no snapped elevation');moved||=d>1e-6;last=u.gunElevation;}
 for(const p of s.projectiles)if(p.sourceUid===u.uid&&!seen.has(p.uid)){seen.add(p.uid);shots++;const pose=gunPose(u);assert(Math.hypot(p.startX-pose.muzzle.x,p.startY-pose.muzzle.y)<1e-6,'round starts at actual painted muzzle');const dx=p.tx-p.startX,dy=p.ty-p.startY;assert(Math.abs((dy-4*p.arc)/dx-Math.tan(pose.angle))<1e-6,'initial projectile tangent matches the visible bore');}
 if(shots)break;}
 assert(shots>0,JSON.stringify({id,side,gap,x:u.x,e:u.gunElevation,ammo:u.ammo,target:foe.x,pose:u.pose,goal:u.firingGoal}));assert(moved,'actual aiming progresses over ticks');assert(u.ammo<CARDS[id].ammoCapacity,'actual round consumes ammunition');});
}
