import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {createGame,spawnUnit} from '../game/engine.ts';
import {adultFrameChoice,idlePoseChoice} from '../game/adult-animation.ts';
import {packedProneWatch} from '../game/prone-watch-art.ts';

function soldier(id='infantry',side=0){
  const s=createGame(163);spawnUnit(s,side,id,1000);const u=s.units[0];
  Object.assign(u,{pose:'prone',poseAnimSeen:'prone',poseAnimFrom:undefined,poseAnimAt:undefined,
    moving:false,motion:'ground',fire:0,flash:0,secondaryFire:0,suppression:0,aimUntil:0,
    reloadingUntil:0,tending:false,digging:false,fragThrow:0,facing:side?-1:1});return u;
}

test('a stationary prone rifleman never borrows a taller crawl cel for idle motion',()=>{
  for(const id of ['infantry','marines','armed_police','militia'])for(const side of [0,1]){
    const u=soldier(id,side);
    for(let i=0;i<1800;i++){
      const f=idlePoseChoice(u,i/30);
      assert(!(f?.group==='actions20'&&[3,12,13].includes(f.index)),`${id}/${side}: ${JSON.stringify(f)}`);
    }
  }
});

test('a prone scout/precision observer does not periodically switch to the old raised radio body',()=>{
  for(const id of ['scouts','sniper_team']){
    const u=soldier(id);u.member=1;
    for(let i=0;i<1800;i++){
      const f=adultFrameChoice(u,i/30);
      assert(!(f.group==='actions20'&&[3,12,13].includes(f.index)),`${id}: ${JSON.stringify(f)}`);
    }
  }
});

test('a prone glance cannot teleport the whole body and muzzle to the opposite facing',()=>{
  for(const side of [0,1])for(const kind of ['blast','trace']){
    const u=soldier('infantry',side);
    Object.assign(u,{[`${kind}GlanceUntil`]:100,[`${kind}GlanceDir`]:-u.facing});
    for(let i=0;i<300;i++){
      const f=idlePoseChoice(u,i/30);
      assert(f?.dir===undefined||f.dir===u.facing,`${kind}/${side}: visual full-body flip`);
    }
  }
});

test('prone observation has eight slow beats, no render mutation, and yields to real actions',()=>{
  const u=soldier(),seen=new Set(),snapshot=JSON.stringify(u);
  for(let i=0;i<300;i++){
    const f=idlePoseChoice(u,i/60);assert.equal(f.group,'proneIdle8');seen.add(f.index);
    assert.deepEqual(idlePoseChoice(u,i/60),f);
  }
  assert.equal(seen.size,8);assert.equal(JSON.stringify(u),snapshot);
  for(const patch of [{moving:true},{fire:.2},{secondaryFire:.1},{flash:.1},{aimUntil:20},
    {ammo:0,reloadingUntil:20},{fragThrow:.8},{tending:true},{digging:true},{draggingUid:2},
    {firstAidUntil:20},{poseAnimFrom:'stand',poseAnimSeen:'prone',poseAnimAt:0},
    {hp:0},{wounded:true},{surrendered:true},{rappelling:true},{parachuting:true},{motion:'bank'}]){
    const busy=Object.assign(soldier(),patch);assert.notEqual(idlePoseChoice(busy,1)?.group,'proneIdle8',JSON.stringify(patch));
  }
  const moving=Object.assign(soldier(),{moving:true});const crawl=new Set();
  for(let walk=0;walk<8;walk++){moving.walk=walk;const f=adultFrameChoice(moving,1);assert.equal(f.group,'actions20');crawl.add(f.index);}
  assert.deepEqual([...crawl],[2,12],'real crawling is not disabled to hide the idle error');
});

test('all eight painted cels keep a fixed baseline, tiny height range and clear frame margins',async()=>{
  const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
  globalThis.document={createElement:()=>createCanvas(1,1)};
  const im=await loadImage(new URL('../public/art/prone-watch-frames-v163.png',import.meta.url).pathname);
  const frames=packedProneWatch(im),hashes=new Set();assert.equal(frames.length,8);
  for(const frame of frames){
    const d=frame.getContext('2d').getImageData(0,0,96,96).data;let top=96,bottom=-1;
    for(let y=0;y<96;y++)for(let x=0;x<96;x++){
      const alpha=d[(y*96+x)*4+3];
      if(x<4||x>91||y<74)assert.equal(alpha,0,'neighbor/halo pixels outside body cell');
      if(alpha>=160){top=Math.min(top,y);bottom=Math.max(bottom,y);}
    }
    assert.equal(bottom,95);assert(bottom-top+1>=16&&bottom-top+1<=17);
    hashes.add(createHash('sha256').update(d).digest('hex'));
  }
  assert.equal(hashes.size,8);
});
