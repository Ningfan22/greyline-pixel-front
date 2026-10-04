import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {CARDS,modelOf} from '../game/cards.ts';
import {cardPicturePath} from '../game/card-picture-path.ts';
import {missileFamily} from '../game/vehicle-missile-art-v209.ts';
import {tankGeometry} from '../game/vehicle-geometry.ts';
import {wreckGeometry,wreckKind,wreckObstacles} from '../game/wreck-geometry.ts';
import {drawProjectile} from '../game/ballistics.ts';
import {createGame,startGame,spawnUnit,refreshVision,tick} from '../game/engine.ts';
const {createCanvas,Image}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
globalThis.Image=class extends Image {set src(p){super.src=fileURLToPath(new URL('../public'+p,import.meta.url));}get src(){return super.src;}};
const {loadBakedBattleArt}=await import('../game/battle-art-baked.ts');
const {unitFrame,unitSize}=await import('../game/art.ts');
const art=await loadBakedBattleArt();
const pixels=c=>Buffer.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);
const hash=b=>createHash('sha256').update(b).digest('hex');
const file=p=>fileURLToPath(new URL('../public'+p,import.meta.url));
test('every non-IFV ground variant has its own live pixels and card illustration',()=>{
 const ifv=unitFrame(art,'ifv'), reference=hash(pixels(ifv)), portrait=hash(readFileSync(file(cardPicturePath('ifv')))),seen=new Set();
 for(const id of Object.keys(CARDS).filter(id=>modelOf(id)==='ifv'&&!CARDS[id].members&&!CARDS[id].air)) {
  const f=unitFrame(art,id);if(id==='ifv')continue;
  assert.notEqual(f,ifv,id);const digest=hash(pixels(f));assert.notEqual(digest,reference,id);assert(!seen.has(digest),`${id} must have distinct pixels`);seen.add(digest);
  assert.notEqual(hash(readFileSync(file(cardPicturePath(id)))),portrait,`${id} portrait is not IFV`);
 }
 assert(seen.size>=9);
});
for(const id of ['sam_vehicle','scout_car'])test(`${id}: transparent independent live/wreck, sockets and collision match the actual painting`,()=>{
 const f=unitFrame(art,id),g=tankGeometry(id),w=art.wrecks[id],wg=wreckGeometry(id);
 assert.deepEqual([f.width,f.height],unitSize(id));assert.equal(wreckKind(id),id);assert.notEqual(w,art.wrecks.ifv);assert.deepEqual([w.width,w.height],[wg.width,wg.height]);
 for(const c of [f,w]){const d=pixels(c);assert(d[3]<20);assert(d[(c.width-1)*4+3]<20);}
 const a=f.getContext('2d').getImageData(Math.round(f.width/2+g.muzzleX)-2,Math.round(f.height-g.muzzleY)-2,5,5).data;
 assert(a.some((v,i)=>i%4===3&&v>200),'shot starts in painted weapon mouth');
 for(const [x,y,ww,hh] of wg.parts){const d=w.getContext('2d').getImageData(Math.round(x*w.width),Math.round(y*w.height),Math.round(ww*w.width),Math.round(hh*w.height)).data;
  const coverage=d.filter((v,i)=>i%4===3&&v>160).length/(d.length/4);assert(coverage>.7,`${id} invisible collision ${[x,y,ww,hh]}: ${coverage}`);}
 for(const facing of [-1,1])assert(wreckObstacles({cardId:id,x:800,y:374,angle:0,side:0,facing}).every(b=>b.w>0&&b.h>0));
});
test('guided and unguided weapons use actual authored missile pixels, nose anchored in both flight directions',()=>{
 const targets={tow_ifv:'tow',javelin:'antitank',attack_drone:'antitank',sam_vehicle:'antiair',manpads:'antiair',interceptor:'antiair',rocket:'rocket',airborne_at:'rocket',rocket_heli:'rocket',mlrs:'rocket'};
 for(const [id,family] of Object.entries(targets)){
  assert.equal(missileFamily(id),family);
  for(const heading of [0,Math.PI,-Math.PI/4,Math.PI/3]){
   const out=createCanvas(120,100),expected=createCanvas(120,100),f=art.weaponEffects.missiles[family]??art.weaponEffects.rocket;
   const ctx=expected.getContext('2d');ctx.imageSmoothingEnabled=false;ctx.translate(65,50);ctx.rotate(heading);ctx.drawImage(f,-f.width,-f.height/2);
   drawProjectile(out.getContext('2d'),{ammunition:'rocket',sourceCardId:id,x:65,y:50,startX:0,startY:50,tx:100,ty:50,life:1,total:2,heading},art.weaponEffects);
   assert(pixels(out).equals(pixels(expected)),`${id} must draw its real sprite, no shell streak`);
  }
 }
 assert.equal(new Set(Object.values(art.weaponEffects.missiles).map(c=>hash(pixels(c)))).size,3);
});
function field(){const s=createGame(209,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;for(const p of s.players)Object.assign(p,{hand:[],deck:[],discard:[],energy:0});return s;}
function spawn(s,side,id,x){const n=s.units.length;spawnUnit(s,side,id,x);const u=s.units[n];Object.assign(u,{squadOrder:'watch',squadOrderX:x,squadOrderUntil:Infinity,emplaced:true,emplacementSetupUntil:0,cooldown:0});return u;}
for(const id of ['tow_ifv','sam_vehicle','javelin'])for(const side of [0,1])test(`${id} side ${side}: real firing creates a guided rocket from its weapon, not a ballistic cannon shell`,()=>{
 const s=field(),u=spawn(s,side,id,side===0?720:1350);spawn(s,side,'pathfinders',1100);
 const target=spawn(s,1-side,id==='sam_vehicle'?'helicopter':'heavy_tank',side===0?1350:720);Object.assign(target,{hp:1e6,maxHp:1e6,cooldown:1e9,secondaryCooldown:1e9,orbitX:1350});refreshVision(s);
 let p;for(let i=0;i<300&&!p;i++){tick(s,1/60);p=s.projectiles.find(p=>p.sourceUid===u.uid&&p.ammunition==='rocket');}
 assert(p,'must fire');assert.equal(p.guided,true);assert.equal(p.shell,false);assert.equal(p.sourceCardId,id);assert(art.weaponEffects.missiles[missileFamily(id)]);
 for(let i=0;i<8;i++)tick(s,1/60);assert(p.heading!==undefined);assert(Math.hypot(p.x-p.startX,p.y-p.startY)>50);for(let i=0;i<240;i++)tick(s,1/60);assert(target.hp<target.maxHp,'the real guided missile damages its tracked target');
});
