import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {statSync} from 'node:fs';
import {packedBlastFrames,blendEffectFrame} from '../game/effect-atlas.ts';
import {paintedBlastAtlas} from '../game/battlefield-effects-art.ts';
import {drawBlast} from '../game/ballistics.ts';
import {blastDuration} from '../game/blast-animation.ts';
const {createCanvas,loadImage,Image}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
const image=kind=>loadImage(new URL(`../public/art/blast-${kind}-frames-v165.png`,import.meta.url).pathname);
const pixels=f=>f.getContext('2d').getImageData(0,0,f.width,f.height).data;

test('prepacked established fuel and earth retain their exact registered painted frames',async()=>{
  for(const kind of ['fuel','earth']){
    const packed=packedBlastFrames(await image(kind));
    const source=await loadImage(new URL(`../public/art/${kind}-blast-v145.png`,import.meta.url).pathname);
    const original=paintedBlastAtlas(source,kind);
    for(let i=0;i<16;i++)assert.deepEqual(pixels(packed[i]),pixels(original[i]),`${kind}/${i}`);
  }
});

test('new HE, grenade and air are independently painted, complete and isolated in every cel and blend',async()=>{
  const allHashes=new Set();
  for(const kind of ['he','grenade','air']){
    const frames=packedBlastFrames(await image(kind)),mass=[],heat=[];
    for(const [i,f]of frames.entries()){
      const d=pixels(f);allHashes.add(createHash('sha256').update(d).digest('hex'));
      let alpha=0,fire=0;
      for(let y=0;y<160;y++)for(let x=0;x<144;x++){
        const k=(y*144+x)*4;alpha+=d[k+3];
        // Pale grenade/flak flashes are white, not orange. Measuring only
        // red dominance mistakes subpixel colored alpha noise for the flash.
        if((d[k]>130&&d[k]-d[k+2]>65&&d[k+1]>d[k+2]*1.2)||
          (d[k]>225&&d[k+1]>215&&d[k+2]>185))fire+=d[k+3];
        if(x<4||x>=140||y<6||y>=158)assert.equal(d[k+3],0,`${kind}/${i}: edge ${x},${y}`);
      }
      assert(alpha>100,`${kind}/${i}: not an empty placeholder`);mass.push(alpha);heat.push(fire);
      if(i<15)for(const phase of [.25,.5,.75]){
        const b=blendEffectFrame(f,frames[i+1],phase),bp=pixels(b);
        assert.equal(b,blendEffectFrame(f,frames[i+1],phase),'reuse prepared blend');
        for(let x=0;x<144;x++)for(let y=0;y<6;y++)assert.equal(bp[(y*144+x)*4+3],0,`${kind}/${i}: blended top strip`);
      }
    }
    assert(Math.max(...mass)>mass[0]*2,`${kind}: real expansion`);
    assert(mass[15]<Math.max(...mass)*.15,`${kind}: dissipated final cel`);
    for(let i=6;i<16;i++)assert(mass[i]<mass[i-1],`${kind}/${i}: smoke regrows after the peak`);
    assert(Math.max(...heat.slice(10))<Math.max(...heat)*.03,`${kind}: no late re-ignition`);
  }
  assert.equal(allHashes.size,48,'not seeds/mirrors/repeated blanks counted as drawn frames');
});

test('draw path actually uses each authored family, with ground versus air origin and caller state intact',async()=>{
  const painted={};for(const kind of ['fuel','earth','he','grenade','air'])painted[kind]=packedBlastFrames(await image(kind));
  const legacy=createCanvas(1,1),c=createCanvas(800,800).getContext('2d');const calls=[];
  const draw=c.drawImage.bind(c);c.drawImage=(...args)=>{calls.push(args);return draw(...args);};
  c.globalAlpha=.7;c.fillStyle='#abcdee';const saved=c.globalAlpha;
  for(const kind of ['he','grenade','air','artillery','wreck','crash']){
    const family=kind==='artillery'?'earth':kind==='wreck'||kind==='crash'?'fuel':kind;
    for(const seed of [0,1,2,99])for(let i=0;i<=120;i++){
      c.clearRect(0,0,800,800);calls.length=0;
      drawBlast(c,{kind,age:blastDuration(kind)*i/120,radius:60,x:400,y:400,seed},[[legacy],[legacy]],[[legacy],[legacy],[legacy]],undefined,painted);
      assert.equal(c.globalAlpha,saved);assert.equal(c.fillStyle,'#abcdee');
      if(i===0){assert.equal(calls[0][0],painted[family][0]);const h=calls[0][4];
        assert(Math.abs(calls[0][2]/h+(kind==='air'?.5:154/160))<.015);}
      if(i===120)assert.equal(calls.length,0,'no lingering final frame beyond lifetime');
      for(const call of calls)assert.equal(call[0].width,144,'legacy sheet never drawn');
    }
  }
});

test('production loader no longer downloads or keys the four superseded original blast sheets',async()=>{
  const requested=[];
  globalThis.Image=class extends Image{
    set src(v){requested.push(v);super.src=v.startsWith('/')?fileURLToPath(new URL('../public'+v,import.meta.url)):v;}
    get src(){return super.src;}
  };
  const {loadArt}=await import('../game/art.ts');const art=await loadArt();
  const removed=['explosions-v12.png','explosions-v13.png','fuel-blast-v145.png','earth-blast-v145.png'];
  for(const name of removed)assert(!requested.includes('/art/'+name),name);
  let packedBytes=0;
  for(const kind of ['fuel','earth','he','grenade','air']){
    const name=`blast-${kind}-frames-v165.png`;assert(requested.includes('/art/'+name));
    packedBytes+=statSync(new URL('../public/art/'+name,import.meta.url)).size;
    assert.equal(art.paintedBlasts[kind].length,16);
  }
  assert.equal(art.combatExplosions[0],art.paintedBlasts.he);
  assert.equal(art.combatExplosionsV13[2],art.paintedBlasts.grenade);
  const oldBytes=removed.reduce((n,name)=>n+statSync(new URL('../public/art/'+name,import.meta.url)).size,0);
  assert(packedBytes<oldBytes*.25,JSON.stringify({oldBytes,packedBytes}));
  console.log('Blast download bytes',JSON.stringify({oldBytes,packedBytes,saved:oldBytes-packedBytes}));
});
