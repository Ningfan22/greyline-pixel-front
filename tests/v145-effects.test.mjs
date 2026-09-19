import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {blastDuration,blastFrameAt} from '../game/blast-animation.ts';
import {blendEffectFrame,drawSmokePuff} from '../game/effect-atlas.ts';
import {drawWreckSmoke} from '../game/ambience.ts';
import {createGame,startGame,tick} from '../game/engine.ts';
import {drawBuildingFooting} from '../game/building-art.ts';
import {HOUSE_PROFILES} from '../game/world.ts';
import {paintedBlastAtlas,paintedFootings} from '../game/battlefield-effects-art.ts';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
const solid=color=>{const c=createCanvas(12,12);c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,12,12);return c;};

test('all blast clocks progress once through every authored cel and fade to zero at their simulated lifetime',()=>{
  for(const kind of ['he','artillery','wreck','grenade','air','crash','penetration']){
    const duration=blastDuration(kind),count=kind==='penetration'?8:16,seen=new Set();let last=-1;
    for(let n=0;n<=1000;n++){const f=blastFrameAt({kind,age:duration*n/1000},count);
      assert(f.index>=last&&f.index<count);assert(f.blend>=0&&f.blend<=1);last=f.index;seen.add(last);}
    assert.equal(seen.size,count);assert.equal(blastFrameAt({kind,age:duration},count).alpha,0);
    assert(blastFrameAt({kind,age:duration-.001},count).alpha<.03);
    const s=createGame(145);startGame(s);s.aiIn=1e9;
    s.blasts=[{kind,age:duration-.02,x:1000,y:300,radius:30,soil:false,seed:17}];
    tick(s,.01);assert.equal(s.blasts.length,1);tick(s,.02);assert.equal(s.blasts.length,0);
  }
});

test('intermediate cels preserve opaque overlap instead of pulsing transparency, and are cached',()=>{
  const red=solid('#ff0000'),blue=solid('#0000ff');
  assert.equal(blendEffectFrame(red,blue,0),red);assert.equal(blendEffectFrame(red,blue,1),blue);
  for(const p of [.25,.5,.75]){const f=blendEffectFrame(red,blue,p),d=f.getContext('2d').getImageData(6,6,1,1).data;
    assert(d[3]>=254);assert(Math.abs(d[0]-255*(1-p))<=1);assert(Math.abs(d[2]-255*p)<=1);
    assert.equal(blendEffectFrame(red,blue,p),f);}
});

test('painted smoke retains caller state through cached in-between frames',()=>{
  const c=createCanvas(100,100).getContext('2d');c.globalAlpha=.6;c.fillStyle='#aabbcc';
  const frames=[solid('#fff'),solid('#bbb')];drawSmokePuff(c,frames,.5,50,50,20,'#555',.7);
  assert(Math.abs(c.globalAlpha-.6)<.001);assert.equal(c.fillStyle,'#aabbcc');
  assert(c.getImageData(50,50,1,1).data[3]>150);
});

test('a new wreck cannot instantly display smoke puffs emitted before it existed',()=>{
  const s=createGame(145);s.time=96;const w={id:1,cardId:'tank',x:500,y:374,age:0,falling:false};s.wrecks=[w];
  const count=()=>{let draws=0;const c={fillStyle:'',fillRect(){draws++;}};drawWreckSmoke(c,s,0,1200);return draws;};
  assert.equal(count(),2);w.age=.8;assert.equal(count(),6);
  w.age=4;const full=count();assert(full>=18&&full<=22);
  s.time=200;assert.equal(count(),full);w.age=121;assert.equal(count(),0);
});

test('painted footings support both full-width building corners over an excavated slope',()=>{
  for(let row=0;row<3;row++)for(const dir of [-1,1]){
    const c=createCanvas(400,220),ctx=c.getContext('2d'),p={x:200,y:90},half=HOUSE_PROFILES[row].width/2;
    const ground=x=>90+Math.max(0,1-Math.abs(x-(200+dir*half*.85))/70)*55;
    drawBuildingFooting(ctx,p,row,90,solid('#5b5249'),ground);
    const pixels=ctx.getImageData(0,0,400,220).data;
    for(let x=Math.ceil(200-half+1);x<200+half-1;x++)
      for(let y=90;y<Math.floor(ground(x));y++)assert(pixels[(y*400+x)*4+3]>240,`unsupported ${row}/${dir}/${x}/${y}`);
    assert.equal(pixels[(90*400+Math.floor(200-half-2))*4+3],0);
    assert.equal(pixels[(85*400+Math.ceil(200+half+2))*4+3],0);
  }
});

test('all 32 new authored cels fit a shared origin and leave clean borders without a neighbouring fire strip',async()=>{
  for(const kind of ['fuel','earth']){
    const im=await loadImage(new URL(`../public/art/${kind}-blast-v145.png`,import.meta.url).pathname);
    const frames=paintedBlastAtlas(im,kind);assert.equal(frames.length,16);const fire=[];
    for(const [i,f]of frames.entries()){
      const d=f.getContext('2d').getImageData(0,0,144,160).data;let pixels=0,bottom=0,heat=0;
      for(let y=0;y<160;y++)for(let x=0;x<144;x++){
        const k=(y*144+x)*4,a=d[k+3];if(a>8){pixels++;bottom=Math.max(bottom,y);
          assert(x>=5&&x<139&&y>=12&&y<=157,`${kind}/${i}: atlas-border leakage ${x},${y}`);}
        if(d[k]>120&&d[k]-d[k+1]>40&&d[k+1]>d[k+2]*1.3)heat+=a/255;
      }
      assert(pixels>10,`${kind}/${i} erased`);assert(bottom>=150&&bottom<=156,`${kind}/${i}: drifting ground ${bottom}`);fire.push(heat);
    }
    if(kind==='fuel'){
      assert(fire[4]>fire[0]*4);for(let i=9;i<16;i++)assert(fire[i]<fire[4]*.01,'late fuel re-ignition');
    }
  }
});

test('all three generated masonry interiors are opaque and materially different',async()=>{
  const im=await loadImage(new URL('../public/art/building-footings-v145.png',import.meta.url).pathname);
  const samples=paintedFootings(im).map(f=>f.getContext('2d').getImageData(0,0,112,24).data);
  for(const data of samples)for(let i=3;i<data.length;i+=4)assert(data[i]>=254);
  assert.notDeepEqual(samples[0],samples[1]);assert.notDeepEqual(samples[1],samples[2]);
});
