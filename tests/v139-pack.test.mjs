import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { PACK_CANVAS, PACK_DURATION, PACK_FRAMES, PACK_FPS, packFrameRect, packMotion } from '../game/pack-animation.ts';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
const atlas=await loadImage(fileURLToPath(new URL('../public/art/pack-tear-v139.png',import.meta.url)));

test('painted atlas uses measured integer cuts, real alpha and sixteen unclipped solid silhouettes',()=>{
  assert.equal(atlas.width,1254);assert.equal(atlas.height,1254);
  const hashes=new Set();
  for(let i=0;i<PACK_FRAMES;i++) {
    const r=packFrameRect(atlas.width,atlas.height,i),c=createCanvas(r.width,r.height),ctx=c.getContext('2d');
    assert([313,314].includes(r.width));assert([313,314].includes(r.height));
    ctx.drawImage(atlas,r.x,r.y,r.width,r.height,0,0,r.width,r.height);
    const {data}=ctx.getImageData(0,0,c.width,c.height);
    let solid=0,transparent=0;
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++) {
      const a=data[(y*c.width+x)*4+3];
      if(a===0)transparent++;
      if(a>127){solid++;assert(x>0&&y>0&&x<c.width-1&&y<c.height-1,`solid boundary in frame ${i}`);}
    }
    assert(solid>20000);assert(transparent>c.width*c.height*.45);
    hashes.add(c.toBuffer('image/png').toString('base64'));
  }
  assert.equal(hashes.size,16);
});

test('all source cels stay fully inside the landscape canvas throughout lift, tear and settle',()=>{
  const frames=new Set();
  for(let t=0;t<=PACK_DURATION;t+=1/240) {
    const p=packMotion(t),r=packFrameRect(atlas.width,atlas.height,p.frame);
    frames.add(p.frame);
    assert(p.x>=8&&p.y>=8,`top/left cropped at ${t}`);
    assert(p.x+r.width*p.scale<=PACK_CANVAS.width-8);
    assert(p.y+r.height*p.scale<=PACK_CANVAS.height-8);
    assert(p.alpha>=0&&p.alpha<=1);
  }
  assert.equal(frames.size,16);assert.equal(PACK_FPS,24);
  assert.equal(packMotion(-1).frame,0);assert.equal(packMotion(100).frame,15);
  assert.equal(packMotion(PACK_DURATION).alpha,0);
});

test('production crop/render leaves transparent top and side gutters instead of a neighboring frame',()=>{
  const canvas=createCanvas(PACK_CANVAS.width,PACK_CANVAS.height),ctx=canvas.getContext('2d');
  for(let i=0;i<16;i++) {
    const p=packMotion(.48+(i+.5)/PACK_FPS),r=packFrameRect(atlas.width,atlas.height,p.frame);
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;
    ctx.drawImage(atlas,r.x,r.y,r.width,r.height,p.x,p.y,r.width*p.scale,r.height*p.scale);
    const {data}=ctx.getImageData(0,0,canvas.width,canvas.height);
    for(let x=0;x<canvas.width;x++)assert.equal(data[(5*canvas.width+x)*4+3],0);
    for(let y=0;y<canvas.height;y++)for(const x of [5,canvas.width-6])assert.equal(data[(y*canvas.width+x)*4+3],0);
  }
});
