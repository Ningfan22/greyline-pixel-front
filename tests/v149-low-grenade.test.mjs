import assert from 'node:assert/strict';
import test from 'node:test';
import {createGame,startGame,spawnUnit,tick,setOrder,refreshVision} from '../game/engine.ts';
import {adultFrameChoice,ownsAdultBody,idlePoseChoice} from '../game/adult-animation.ts';
import {GRENADE_THROW_S,GRENADE_RELEASE_S,grenadeElapsed,grenadeReleased,grenadeCel} from '../game/infantry-action-timing.ts';
import {projectileForRender,infantryDepth} from '../game/render-depth.ts';
import {LOW_GRENADE_RELEASE_HAND,grenadeReleaseOrigin} from '../game/grenade-geometry.ts';
import {createRequire} from 'node:module';
import {lowGrenadeOriginalFrames} from '../scripts/bake-v149-low-grenade.mjs';
import {packedLowGrenades} from '../game/low-grenade-art.ts';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};

function scene(pose='crouch',side=0) {
  const s=createGame(149);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.weather.disabled=true;s.night=false;
  const one=(team,id,x)=>{const n=s.units.length;spawnUnit(s,team,id,x);s.units.splice(n+1);const u=s.units[n];
    Object.assign(u,{x,y:374,lane:8,pose:team===side?pose:'idle',poseAnimFrom:undefined,poseAnimAt:undefined,
      poseAnimSeen:team===side?(pose==='prone'?'prone':'crouch'):'stand',crouchTravel:0,
      stanceLockUntil:100,tactic:'advance',decisionIn:1e9,cooldown:100,hp:1000,maxHp:1000,
      personalMorale:100,suppression:0,readyAt:-100,moving:false,motion:'ground',climbing:0,
      fire:0,secondaryFire:0,flash:0,aimUntil:0});return u;};
  // Isolate the shared painted throw from card-specific covering requirements.
  const u=one(side,'assault',1800),dir=side?-1:1;
  one(1-side,'infantry',u.x+dir*170);one(1-side,'infantry',u.x+dir*190);
  setOrder(s,0,'hold');setOrder(s,1,'hold');refreshVision(s);return {s,u,dir};
}

test('all low throws have sixteen authored cels at their committed posture',()=>{
  for(const pose of ['crouch','hunker','prone']) {
    const {u}=scene(pose);Object.assign(u,{fragThrow:GRENADE_THROW_S,fragThrowStartedAt:20});
    for(let i=0;i<16;i++) {
      const f=adultFrameChoice(u,20+(i+.5)/16*GRENADE_THROW_S);
      assert.deepEqual(f,{group:'lowGrenade32',index:(pose==='prone'?16:0)+i});
      assert(ownsAdultBody(f));assert.equal(idlePoseChoice(u,20),null);
    }
  }
});

test('grenade release and empty-hand cel share boundaries at any match timestamp',()=>{
  for(const start of [0,1/60,13.37,241.2,590]) {
    const u={fragThrow:GRENADE_THROW_S,fragThrowStartedAt:start};
    for(const delta of [-1e-6,0,1e-6]) {
      const time=start+GRENADE_RELEASE_S+delta,elapsed=grenadeElapsed(u,time),released=grenadeReleased(elapsed);
      assert.equal(released,delta>=0);
      assert.equal(grenadeCel(u,time,16)>=10,released);
      assert.equal(grenadeCel(u,time,8)>=5,released);
    }
  }
});

test('real low throws play every cel, emit once, consume once, and keep feet planted on both sides',()=>{
  for(const pose of ['crouch','hunker','prone'])for(const side of [0,1]) {
    const {s,u,dir}=scene(pose,side),ammo=u.fragLeft,x=u.x;
    tick(s,1/60);assert.equal(u.fragThrow,GRENADE_THROW_S);assert.equal(s.projectiles.length,0);
    const started=u.fragThrowStartedAt,seen=new Set(),ids=new Set();
    while(s.time<started+GRENADE_THROW_S) {
      const f=adultFrameChoice(u,s.time),elapsed=grenadeElapsed(u,s.time);
      assert.equal(f.group,'lowGrenade32');seen.add(f.index%16);
      const p=s.projectiles.find(p=>p.sourceUid===u.uid&&p.ammunition==='grenade');
      assert.equal(!!p,grenadeReleased(elapsed));
      if(p){ids.add(p.uid);assert.equal(p.startLane,8);assert(Math.sign(p.tx-p.startX)===dir);
        const start=grenadeReleaseOrigin(u,dir);assert.equal(p.startX,start.x);assert.equal(p.startY,start.y);}
      assert.equal(u.fragLeft,ammo-(p?1:0));assert.equal(u.x,x);assert.equal(u.fire,0);assert.equal(u.shots,0);
      assert.equal(u.pose,pose==='hunker'?'crouch':pose);tick(s,1/60);
    }
    assert.equal(seen.size,16);assert.equal(ids.size,1);assert.equal(u.fragLeft,ammo-1);assert.equal(u.fragThrow,0);
  }
});

test('low throw body yields to actual casualties and a still-active posture transition',()=>{
  for(const patch of [{hp:0},{wounded:true},{surrendered:true},{rappelling:true},
    {poseAnimFrom:'stand',poseAnimSeen:'crouch',poseAnimAt:10}]) {
    const {u}=scene();Object.assign(u,{fragThrow:1,fragThrowStartedAt:10,...patch});
    assert.notEqual(adultFrameChoice(u,10.1).group,'lowGrenade32');
  }
});

test('render reads are pure and disabled drawing does not delay projectile release',()=>{
  const a=scene('prone'),b=scene('prone');
  for(let i=0;i<70;i++) {
    tick(a.s,1/60);tick(b.s,1/60);
    const before=structuredClone(a.u);for(let j=0;j<7;j++)adultFrameChoice(a.u,a.s.time);
    assert.deepEqual(a.u,before);assert.deepEqual(a.s.projectiles,b.s.projectiles);
    assert.equal(a.u.fragLeft,b.u.fragLeft);
  }
});

test('an airborne grenade retains launch depth when its thrower later changes lane',()=>{
  const {s,u}=scene('prone');for(let i=0;i<44;i++)tick(s,1/60);
  const p=s.projectiles.find(p=>p.sourceUid===u.uid&&p.ammunition==='grenade');assert(p);
  const before=projectileForRender(s,p);u.lane=-24;
  const after=projectileForRender(s,p);assert.equal(after.startY,before.startY);assert.equal(after.y,before.y);
  assert.equal(after.startY,p.startY+infantryDepth(p.startLane));
});

test('low-throw packing is RGBA-identical and contacts remain fixed across all cels',async()=>{
  const raw=await lowGrenadeOriginalFrames();
  const bank=packedLowGrenades(await loadImage(new URL('../public/art/low-grenade-frames-v149.png',import.meta.url).pathname));
  for(let i=0;i<32;i++) {
    const data=bank[i].getContext('2d').getImageData(0,0,128,96).data;
    assert.deepEqual(data,raw[i].getContext('2d').getImageData(0,0,128,96).data);
    let top=96,bottom=-1,left=128,right=-1;
    for(let p=0;p<data.length;p+=4)if(data[p+3]>=128){const x=p/4%128,y=Math.floor(p/4/128);
      top=Math.min(top,y);bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);}
    assert.equal(bottom,95);assert(left>0&&right<127);
    assert(i<16?top>=52&&top<=56:top>=74&&top<=79,`${i}: changed posture class`);
  }
  for(const [row,pose]of ['crouch','prone'].entries()){
    const hand=LOW_GRENADE_RELEASE_HAND[pose],f=bank[row*16+10];
    const pixels=f.getContext('2d').getImageData(hand.x-2,hand.y-2,5,5).data;
    assert([...pixels].some((v,i)=>i%4===3&&v>128),`${pose} release is detached from the painted fingertips`);
  }
});

test('incapacitation during either low wind-up cancels the unspent grenade',()=>{
  for(const pose of ['crouch','prone'])for(const state of ['dead','wounded','surrendered']){
    const {s,u}=scene(pose);tick(s,1/60);const ammo=u.fragLeft;assert(u.fragThrow>0);
    if(state==='dead')u.hp=0;else u[state]=true;
    if(state==='wounded')u.bleedOut=30;
    for(let i=0;i<60;i++)tick(s,1/60);
    assert.equal(u.fragThrow,0);assert.equal(u.fragAim,undefined);assert.equal(u.fragLeft,ammo);
    assert(!s.projectiles.some(p=>p.sourceUid===u.uid));
  }
});
