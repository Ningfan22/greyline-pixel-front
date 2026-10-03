import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
let canvasCreates=0,readFriendlyContexts=0;
const firstRequests=[];
globalThis.document={createElement:()=>{
  canvasCreates++;const canvas=createCanvas(1,1),getContext=canvas.getContext.bind(canvas);
  let first=true;
  canvas.getContext=(type,options)=>{
    if(type==='2d'&&first){first=false;firstRequests.push(options?.willReadFrequently===true);}
    if(type==='2d'&&canvas.width===128&&canvas.height===128&&options?.willReadFrequently===true)readFriendlyContexts++;
    return getContext(type,options);
  };
  return canvas;
}};
const {soldierArt,soldierFrame,paintSoldier,SOLDIER_FRAME}=await import('../game/soldier-art.ts');
const {filteredSprite}=await import('../game/render-cache.ts');
const art=soldierArt(await loadImage('public/art/soldier-parts-v178.png'),await loadImage('public/art/soldier-equipment-v178.png'));
const rgba=c=>Buffer.from(c.getContext('2d').getImageData(0,0,c.width,c.height).data);

test('read-friendly soldier rasters preserve pixels, immutable sources and the existing cache bound',()=>{
  assert(firstRequests.every(Boolean),'every source part must be CPU-backed on its first context request');
  const reference=createCanvas(128,128),ctx=reference.getContext('2d');
  const hintBefore=readFriendlyContexts;
  const requestsBefore=firstRequests.length;
  const initial=soldierFrame(art,{id:'infantry',uid:1,member:0,hp:100,pose:'idle',motion:'ground',moving:false,walk:0},0);
  assert(firstRequests.slice(requestsBefore).every(Boolean),'costume copies, dark parts and pose must all use the same read-friendly memory');
  const source=initial.image,originalPixels=rgba(source),oldFiltered=filteredSprite(source,'grayscale(1) brightness(.6)');
  let misses=1;
  for(let i=0;i<1100;i++){
    const u={id:i%3===0?'antiarmor':i%3===1?'infantry':'engineers',uid:i+2,member:0,hp:100,
      pose:'walk',motion:'ground',moving:true,walk:i*.037,rifleReady:0,gaitWeight:1,gaitRun:0,
      poseAnimFrom:'crouch',poseAnimSeen:'stand',poseAnimAt:20+i/60-(i/1100)*1.2};
    const oldKeys=new Set(art.frames.keys()),newRequestsAt=firstRequests.length,frame=soldierFrame(art,u,20+i/60);
    assert(firstRequests.slice(newRequestsAt).every(Boolean),'new specialist costumes and poses must be read-friendly');
    const added=[...art.frames.keys()].some(k=>!oldKeys.has(k));
    if(added){
      misses++;ctx.clearRect(0,0,128,128);ctx.save();ctx.translate(SOLDIER_FRAME.anchorX,SOLDIER_FRAME.anchorY);
      paintSoldier(ctx,art,frame.pose);ctx.restore();
      const pixels=ctx.getImageData(0,0,128,128);for(let j=3;j<pixels.data.length;j+=4)pixels.data[j]=pixels.data[j]>127?255:0;
      ctx.putImageData(pixels,0,0);
      assert(rgba(frame.image).equals(rgba(reference)),`${u.id} raster ${i} must match an independent original paint`);
    }
    assert(art.frames.size<=768);
  }
  assert(misses>768,'the test must actually exercise raster eviction');
  assert.equal(readFriendlyContexts-hintBefore,misses,'every freshly painted pose must request CPU read-friendly memory');
  assert(rgba(source).equals(originalPixels),'eviction must not mutate images retained by render callers');
  assert.equal(filteredSprite(source,'grayscale(1) brightness(.6)'),oldFiltered,'unchanged sources retain their filtered sprite');
  assert(canvasCreates>misses);
});
