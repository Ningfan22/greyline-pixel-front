import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas');

let canvasCreates=0;
const operations=new WeakMap();
globalThis.document={createElement:()=>{
  canvasCreates++;
  const canvas=createCanvas(1,1),getContext=canvas.getContext.bind(canvas);
  const counts={clearRect:0,drawImage:0,putImageData:0};
  operations.set(canvas,counts);
  let instrumented=false;
  canvas.getContext=(type,options)=>{
    const ctx=getContext(type,options);
    if(type==='2d'&&!instrumented){
      instrumented=true;
      for(const name of Object.keys(counts)){
        const original=ctx[name].bind(ctx);
        ctx[name]=(...args)=>{counts[name]++;return original(...args);};
      }
    }
    return ctx;
  };
  return canvas;
}};
const {actorSoldierFrame,paintSoldier,SOLDIER_FRAME}=await import('../game/soldier-art.ts');
const {soldierPose,SOLDIER_WEAPON_SIZE}=await import('../game/soldier-pose.ts');
const {filteredSprite}=await import('../game/render-cache.ts');

// Small, asymmetric source parts exercise the real compositor without decoding
// production atlases or retaining hundreds of native pose canvases.
function artFixture(color='#708450'){
  const part=(width,height,index)=>{
    const c=createCanvas(width,height),ctx=c.getContext('2d');
    ctx.fillStyle=color;ctx.fillRect(0,0,width,height);
    ctx.clearRect(0,0,2,Math.max(1,height-2));
    ctx.fillStyle=index%2?'#cfb694':'#252e3d';
    ctx.fillRect(2,1,Math.max(1,width-3),2);
    return c;
  };
  const sizes={head:[14,14],torso:[15,24],upperArm:[7,14],forearm:[6,15],
    thigh:[8,19],shin:[7,19],boot:[11,5],rifle:[36,9],backpack:[10,18],pelvis:[13,8]};
  const body=Object.fromEntries(Object.entries(sizes).map(([name,size],i)=>[name,part(...size,i)]));
  const gear={...SOLDIER_WEAPON_SIZE,tanks:[12,22],medical:[11,10],shovel:[8,27],wrench:[4,14]};
  return {bodies:Object.fromEntries(['infantry','marines','police','militia'].map(id=>[id,body])),
    equipment:Object.fromEntries(Object.entries(gear).map(([name,size],i)=>[name,part(...size,i)])),
    uniforms:new Map(),frames:new Map()};
}
const body=(extra={})=>({id:'infantry',uid:7,member:0,hp:100,pose:'idle',motion:'ground',
  moving:false,walk:0,rifleReady:0,...extra});
const rgba=canvas=>Buffer.from(canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data);
function freshPixels(art,pose){
  const canvas=createCanvas(SOLDIER_FRAME.width,SOLDIER_FRAME.height),ctx=canvas.getContext('2d');
  ctx.save();ctx.translate(SOLDIER_FRAME.anchorX,SOLDIER_FRAME.anchorY);paintSoldier(ctx,art,pose);ctx.restore();
  const pixels=ctx.getImageData(0,0,canvas.width,canvas.height);
  for(let i=3;i<pixels.data.length;i+=4)pixels.data[i]=pixels.data[i]>127?255:0;
  ctx.putImageData(pixels,0,0);
  return rgba(canvas);
}

test('one actor keeps one raster across many poses and skips an unchanged pose',()=>{
  const art=artFixture(),owner={},u=body({pose:'walk',moving:true,gaitWeight:1,gaitRun:0});
  let frame=actorSoldierFrame(art,owner,u,10);
  const image=frame.image,allocations=canvasCreates;
  for(let i=1;i<=96;i++){
    const previous=frame;
    frame=actorSoldierFrame(art,owner,{...u,gaitPhase:i*.137},10+i/60);
    assert.equal(frame.image,image,'pose changes must reuse the actor surface');
    assert(frame.version>previous.version,'new poses must invalidate filtered consumers');
  }
  assert.equal(canvasCreates,allocations,'animation must not allocate a canvas for each pose');
  const before={...operations.get(image)};
  const repeated=actorSoldierFrame(art,owner,{...u,gaitPhase:96*.137},10+96/60);
  assert.equal(repeated.image,image);
  assert.equal(repeated.version,frame.version);
  assert.deepEqual(operations.get(image),before,'an unchanged pose must not paint or resolve alpha again');
});

test('actor identity, crew slots, and art instances own independent mutable rasters',()=>{
  const art=artFixture(),otherArt=artFixture('#8e6550'),owner={},otherOwner={};
  const u=body(),frames=[actorSoldierFrame(art,owner,u,10),
    actorSoldierFrame(art,owner,u,10,1),actorSoldierFrame(art,owner,u,10,2),
    actorSoldierFrame(art,otherOwner,u,10),actorSoldierFrame(otherArt,owner,u,10)];
  assert.equal(new Set(frames.map(f=>f.image)).size,frames.length);
  const saved=frames.map(f=>rgba(f.image));
  const changed=actorSoldierFrame(art,owner,body({pose:'prone'}),10,1);
  assert.equal(changed.image,frames[1].image);
  assert(!rgba(changed.image).equals(saved[1]),'the chosen crew slot must actually change');
  for(const i of [0,2,3,4])assert(rgba(frames[i].image).equals(saved[i]),`surface ${i} must remain intact`);
  assert(!saved[0].equals(saved[4]),'separate art fixtures must contribute their own pixels');
});

test('reused rasters match fresh current-pose painting and clear transparent pixels',()=>{
  const art=artFixture(),owner={};
  const states=[body(),body({pose:'prone'}),body({pose:'crouch'}),
    body({pose:'walk',moving:true,gaitWeight:1,gaitPhase:5.3}),body({hp:0,fallVariant:2})];
  let previous,clearedPixels=0;
  for(const u of states){
    const expected=freshPixels(art,soldierPose(u,10));
    const actual=rgba(actorSoldierFrame(art,owner,u,10).image);
    assert(actual.equals(expected),`${u.pose}/${u.hp} must match independent fresh painting`);
    if(previous)for(let i=3;i<expected.length;i+=4){
      if(previous[i]&&expected[i]===0){clearedPixels++;assert.equal(actual[i],0);}
    }
    previous=actual;
  }
  assert(clearedPixels>100,'the sequence must expose enough formerly opaque pixels to detect ghosts');
});

test('phase alone invalidates raster painting when joints stay unchanged',()=>{
  const art=artFixture(),owner={};
  const a=body({parachuting:true,moving:true,gaitWeight:1,gaitPhase:0});
  const b={...a,gaitPhase:1};
  const poseA=soldierPose(a,10),poseB=soldierPose(b,10);
  const {phase:phaseA,...restA}=poseA,{phase:phaseB,...restB}=poseB;
  assert.notEqual(phaseA,phaseB);
  assert.deepEqual(restA,restB,'this fixture must differ only in the ankle-driving phase');
  const frameA=actorSoldierFrame(art,owner,a,10),before=rgba(frameA.image);
  const frameB=actorSoldierFrame(art,owner,b,10),expected=freshPixels(art,poseB);
  assert(!expected.equals(before),'the phase-only change must visibly rotate a boot');
  assert.equal(frameB.image,frameA.image);
  assert(frameB.version>frameA.version);
  assert(rgba(frameB.image).equals(expected),'phase changes must not leave the previous ankle pixels');
});

test('mutable filtered sprites refresh on version or decay changes with one output canvas',()=>{
  const source=createCanvas(12,12),ctx=source.getContext('2d');
  ctx.fillStyle='#c48640';ctx.fillRect(0,0,7,7);
  const before=canvasCreates,filter='grayscale(1) brightness(.6)';
  const output=filteredSprite(source,filter,1),initial=rgba(output);
  assert.equal(canvasCreates,before+1);
  const unchanged={...operations.get(output)};
  assert.equal(filteredSprite(source,filter,1),output);
  assert.deepEqual(operations.get(output),unchanged,'unchanged version and filter must avoid a draw');

  const reference=createCanvas(12,12),referenceCtx=reference.getContext('2d');
  const check=(currentFilter,version)=>{
    referenceCtx.clearRect(0,0,12,12);referenceCtx.imageSmoothingEnabled=false;
    referenceCtx.filter=currentFilter;referenceCtx.drawImage(source,0,0);
    assert.equal(filteredSprite(source,currentFilter,version),output);
    assert(rgba(output).equals(rgba(reference)),'filtered pixels must match the current source and decay');
  };
  ctx.clearRect(0,0,12,12);ctx.fillStyle='#497dbb';ctx.fillRect(6,6,5,5);
  check(filter,2);
  assert(!rgba(output).equals(initial));
  assert.equal(output.getContext('2d').getImageData(0,0,1,1).data[3],0,'old filtered silhouettes must clear');
  const current=rgba(output);
  check('grayscale(1) brightness(.3)',2);
  assert(!rgba(output).equals(current),'decay changes must refresh even at the same pose version');
  for(let i=0;i<48;i++){
    ctx.clearRect(0,0,12,12);ctx.fillRect(i%8,(i*3)%8,4,4);
    check(`grayscale(1) brightness(${.2+i/80})`,i+3);
  }
  assert.equal(canvasCreates,before+1,'pose and decay history must not grow filtered canvas storage');
});


test('small-screen live rasters keep the exact rig and parts without per-pose readback',()=>{
 const art=artFixture(),owner={},u=body({pose:'walk',moving:true,gaitWeight:1,gaitPhase:1.1});
 const hard=actorSoldierFrame(art,owner,u,10),fast=actorSoldierFrame(art,owner,u,10,0,true);
 assert.notEqual(hard.image,fast.image);assert.deepEqual(fast.pose,hard.pose);
 assert.equal(operations.get(fast.image).putImageData,0,'no alpha read/resolve/upload on the mobile path');
 const source=rgba(fast.image),canonical=rgba(hard.image);let opaque=0,matched=0;
 for(let i=3;i<source.length;i+=4)if(source[i]===255&&canonical[i]===255){opaque++;if(source[i-1]===canonical[i-1]&&source[i-2]===canonical[i-2]&&source[i-3]===canonical[i-3])matched++;}
 assert(opaque>400);assert(matched/opaque>.97,'all opaque source pixels retain their palette');
 const allocations=canvasCreates;
 for(let i=0;i<80;i++){const frame=actorSoldierFrame(art,owner,{...u,gaitPhase:i*.23},10+i/30,0,true);assert.equal(frame.image,fast.image);assert.equal(operations.get(frame.image).putImageData,0);}
 assert.equal(canvasCreates,allocations);assert(rgba(hard.image).equals(canonical),'mobile painting cannot mutate a hard-alpha export');
});
