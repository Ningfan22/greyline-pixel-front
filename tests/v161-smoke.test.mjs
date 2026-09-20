import assert from 'node:assert/strict';
import test from 'node:test';
import {tick,refreshVision,emitParticle} from '../game/engine.ts';
import {tankRoleArena} from './fixtures/tank-role-arena.mjs';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {packedSmokeFrames} from '../game/smoke-art.ts';
import {drawSmokePuff} from '../game/effect-atlas.ts';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
const step=(s,n)=>{for(let i=0;i<n;i++)tick(s,1/60);};

test('HE and AP emit a rolling muzzle discharge in both directions, lasting past the flash',()=>{
  for(const id of ['tank','heavy_tank'])for(const side of [0,1]){
    const {s,tank,dir}=tankRoleArena(id,side);step(s,1);
    assert.equal(tank.shots,1);assert.equal(tank.lastAmmo,id==='tank'?'ap':'cannon');
    const smoke=s.particles.filter(p=>p.kind==='smoke');assert.equal(smoke.length,6);
    assert(smoke.every(p=>Math.sign(p.vx)===dir&&p.size>=6));
    assert(smoke.slice(1).every(p=>p.maxLife>=.5&&p.maxLife<=1));
    const oldX=smoke.map(p=>p.x);tank.cooldown=1000;
    // Isolate the emitted puff lifetime from impact smoke and pooled reuse.
    s.units=[tank];s.projectiles=[];
    step(s,18);assert.equal(tank.fire,0);
    assert(smoke.every((p,i)=>s.particles.includes(p)&&p.life>0&&dir*(p.x-oldX[i])>0));
    const before=smoke.map(p=>[p.x,p.y,p.life]);s.status='paused';step(s,60);
    assert.deepEqual(smoke.map(p=>[p.x,p.y,p.life]),before);
    s.status='playing';const alive=new Set(smoke);
    for(let i=0;i<60;i++){
      const expiring=[...alive].filter(p=>p.life<=1/60);step(s,1);
      for(const p of expiring){assert(!s.particles.includes(p));alive.delete(p);}
    }
    assert.equal(alive.size,0);
  }
});
test('a tank firing back toward its own side emits smoke toward the actual target',()=>{
  for(const side of [0,1]){
    const {s,tank,targets,x,dir}=tankRoleArena('tank',side);
    s.units=[tank,targets.armor];targets.armor.x=x-dir*220;refreshVision(s);step(s,1);
    assert.equal(tank.shots,1);assert.equal(tank.facing,-dir);
    const smoke=s.particles.filter(p=>p.kind==='smoke');assert.equal(smoke.length,6);
    assert(smoke.every(p=>Math.sign(p.vx)===-dir));
    assert(smoke.slice(1).every(p=>(p.x-tank.muzzleX)*dir<0));
  }
});
test('recycled particles cannot inherit heavy-gun smoke opacity',()=>{
  const {s}=tankRoleArena();s.particles=[];
  const puff={kind:'smoke',x:0,y:0,vx:0,vy:0,life:1,maxLife:1,color:'#888888',size:10};
  const previous={...puff,opacity:.55};s.particlePool=[previous];
  emitParticle(s,puff);assert.equal(s.particles[0],previous);assert.equal(previous.opacity,undefined);
});
test('16 authored smoke cels keep transparent borders, unique contours and a genuinely fading tail',async()=>{
  const image=await loadImage(new URL('../public/art/powder-smoke-frames-v161.png',import.meta.url).pathname);
  const frames=packedSmokeFrames(image),hashes=new Set(),mass=[];assert.equal(frames.length,16);
  for(const [i,f]of frames.entries()){
    const d=f.getContext('2d').getImageData(0,0,96,96).data;let a=0;
    hashes.add(createHash('sha256').update(d).digest('hex'));
    for(let y=0;y<96;y++)for(let x=0;x<96;x++){
      const alpha=d[(y*96+x)*4+3];a+=alpha;
      if(x<3||y<3||x>=93||y>=93)assert.equal(alpha,0,`cropped cel ${i} at ${x}/${y}`);
    }
    assert(a>1000);mass.push(a);
  }
  assert.equal(hashes.size,16);assert(mass[5]>mass[0]*5);assert(mass[15]<mass[5]*.025);
  for(let i=7;i<16;i++)assert(mass[i]<mass[i-1],`smoke thickens again at ${i}`);
  const c=createCanvas(400,400).getContext('2d');c.globalAlpha=.7;c.fillStyle='#acbdee';
  const savedAlpha=c.globalAlpha;
  for(let i=0;i<121;i++){
    c.clearRect(0,0,400,400);drawSmokePuff(c,frames,i/120,200,200,180,'#44423c',.6);
    assert.equal(c.globalAlpha,savedAlpha);assert.equal(c.fillStyle,'#acbdee');
    const d=c.getImageData(0,0,400,400).data;
    for(let y=0;y<400;y++)for(const x of [0,110,290,399])assert.equal(d[(y*400+x)*4+3],0);
  }
});
