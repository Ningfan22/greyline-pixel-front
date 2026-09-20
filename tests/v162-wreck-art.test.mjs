import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {WRECKS,wreckContact,wreckObstacles,wreckGeometry} from '../game/wreck-geometry.ts';
import {wreckVariants} from '../game/wreck-variants.ts';
import {paintedTankWrecks} from '../game/tank-wreck-art.ts';
import {tankGeometry} from '../game/vehicle-geometry.ts';
import {createGame,startGame} from '../game/engine.ts';
import {sceneryIntercept} from '../game/world.ts';
import {createHash} from 'node:crypto';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};

test('unpainted alternatives preserve every original pixel and allocate no synthetic damage canvases',()=>{
  const originals=Object.fromEntries(Object.entries(WRECKS).map(([id,g])=>{
    const frame=createCanvas(g.width,g.height),c=frame.getContext('2d');
    c.fillStyle='#788568';c.fillRect(20,20,40,30);return [id,frame];
  }));
  const previous=globalThis.document.createElement;
  globalThis.document.createElement=()=>{throw new Error('procedural wreck painting returned');};
  try{
    const families=wreckVariants(originals);
    for(const id of Object.keys(WRECKS))for(const cause of ['bullet','blast','burn']){
      assert.equal(families[id][cause].length,1);
      assert.equal(families[id][cause][0],originals[id]);
    }
  }finally{globalThis.document.createElement=previous;}
});

test('authored cause families are used exactly, not recolored, cut up or combined with the old wreck',()=>{
  const original=createCanvas(50,30),base=Object.fromEntries(Object.keys(WRECKS).map(id=>[id,original]));
  const family={bullet:[createCanvas(50,30)],blast:[createCanvas(50,30)],burn:[createCanvas(50,30)]};
  const families=wreckVariants(base,{tank:family});assert.equal(families.tank,family);
  for(const cause of ['bullet','blast','burn'])assert.equal(families.tank[cause][0],family[cause][0]);
  assert.equal(families.ifv.blast[0],original);
});

test('remaining authored wrecks retain mirrored support and their original solid-part geometry',()=>{
  for(const [id,g]of Object.entries(WRECKS)){
    if(['light_tank','tank','heavy_tank'].includes(id))continue;
    for(const dir of [-1,1]){
      const w={cardId:({howitzer:'artillery',at_gun:'anti_tank_gun'}[id]??id),x:1000,y:374,angle:0,side:0,facing:dir};
      assert.deepEqual(wreckContact(()=>374,w),{y:374,angle:0});
      const boxes=wreckObstacles(w);assert.equal(boxes.length,g.parts.length);
      for(const b of boxes)assert(b.w>0&&b.h>0&&[b.x,b.y].every(Number.isFinite));
    }
  }
});

test('nine distinct complete paintings have clean frame borders and solid cover follows their actual alpha',async()=>{
  const im=await loadImage(new URL('../public/art/tank-wreck-frames-v162.png',import.meta.url).pathname);
  const families=paintedTankWrecks(im),hashes=new Set();
  for(const id of ['light_tank','tank','heavy_tank'])for(const cause of ['bullet','blast','burn']){
    const frame=families[id][cause][0],g=wreckGeometry(id,cause);
    assert.equal(frame.width,g.width);assert.equal(frame.height,g.height);
    const d=frame.getContext('2d').getImageData(0,0,384,192).data;
    hashes.add(createHash('sha256').update(d).digest('hex'));
    for(let y=0;y<192;y++)for(let x=0;x<384;x++)
      if(x<3||x>380||y<3||y>188)assert(d[(y*384+x)*4+3]<8,`${id}/${cause} leaks ${x}/${y}`);
    assert(g.parts.length>=15&&g.parts.length<=50);
    for(const r of g.parts){
      const [x,y,w,h]=r.map((v,i)=>Math.round(v*(i%2?192:384)));let solid=0;
      for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)solid+=d[(yy*384+xx)*4+3]>=160?1:0;
      assert(solid/(w*h)>=.625,`${id}/${cause} invisible cover rectangle`);
    }
    assert(Math.abs((g.support[1]-g.support[0])*g.width-tankGeometry(id).half*2)<.001);
  }
  assert.equal(hashes.size,9);
});

test('cause-specific wreck cover blocks real rays through metal but not empty sky, mirrored on slopes',()=>{
  for(const id of ['light_tank','tank','heavy_tank'])for(const cause of ['bullet','blast','burn'])for(const facing of [-1,1]){
    const s=createGame(162);startGame(s);s.units=[];s.scenery=[];s.walls=[];
    const w={id:1,cardId:id,cause,x:1500,y:374,angle:0,side:0,facing,falling:false};
    for(const slope of [-.1,0,.1]){
      const floor=x=>374+slope*(x-1500);Object.assign(w,wreckContact(floor,w));
      assert(Math.abs(w.angle-Math.atan(slope))<1e-9);
      const g=wreckGeometry(id,cause);
      for(let x=-tankGeometry(id).half;x<=tankGeometry(id).half;x+=1)
        assert(w.y+x*Math.sin(w.angle)<=floor(w.x+x*Math.cos(w.angle))+1e-7);
    }
    w.angle=0;w.y=374;s.wrecks=[w];
    const boxes=wreckObstacles(w),b=boxes.find(b=>b.w>30&&b.y>330);assert(b);
    const x=b.x+b.w/2,y=b.y+b.h/2;
    assert(sceneryIntercept(s,x-1,y,x+1,y,false,true));
    const top=Math.min(...boxes.map(b=>b.y));assert.equal(sceneryIntercept(s,1300,top-8,1700,top-8,false,true),null);
    const mirror=wreckObstacles({...w,facing:-facing});
    assert.equal(mirror.length,boxes.length);
    for(let i=0;i<boxes.length;i++)assert(Math.abs(mirror[i].x+mirror[i].w+boxes[i].x-3000)<1e-7);
  }
  for(const id of ['light_tank','tank','heavy_tank']){
    assert.notDeepEqual(wreckGeometry(id,'bullet').parts,wreckGeometry(id,'blast').parts);
    assert.notDeepEqual(wreckGeometry(id,'blast').parts,wreckGeometry(id,'burn').parts);
  }
});
