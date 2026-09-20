import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {buildingFrames,drawBuildingFooting,paintedBuildingFootprint} from '../game/building-art.ts';
import {paintedFootings} from '../game/battlefield-effects-art.ts';
import {drawScenery} from '../game/scenery-art.ts';
import {createScenery,HOUSE_PROFILES} from '../game/world.ts';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
const load=name=>loadImage(new URL('../public/art/'+name,import.meta.url).pathname);
const [states,collapse,footing]=await Promise.all(['buildings-v13.png','building-collapse-v13.png','building-footings-v145.png'].map(load));
const art={...buildingFrames(states,collapse),footings:paintedFootings(footing)};

test('real intact/damaged/partial painted floor edges reach terrain on both sides, including subpixel origins',()=>{
  let checks=0;
  for(let row=0;row<3;row++)for(let stage=0;stage<3;stage++)for(const dir of [-1,1])for(const fraction of [0,.25,.75]){
    const x=200+fraction,y=210+fraction,frame=art.states[row][stage];
    const p=createScenery(Array(402).fill(y),[{kind:'house',x:200,building:row,seed:166}])[0];p.x=x;
    for(const part of p.parts)part.hp=part.maxHp*[1,.7,.35][stage];
    const ground=px=>y+Math.max(0,1-Math.abs(px-(x+dir*HOUSE_PROFILES[row].width*.47))/65)*52;
    const out=createCanvas(420,300),ctx=out.getContext('2d'),before=JSON.stringify(p);
    drawScenery(ctx,p,0,[],art,{},ground);assert.equal(JSON.stringify(p),before);
    const data=ctx.getImageData(0,0,420,300).data;
    const pixels=frame.getContext('2d').getImageData(0,0,frame.width,frame.height).data;
    const ox=Math.round(x-frame.width),oy=Math.round(y-(frame.height-4)*2);
    for(let col=0;col<frame.width;col++){
      let bottom=-1;
      for(let py=frame.height-1;py>=frame.height-14;py--)if(pixels[(py*frame.width+col)*4+3]>200&&pixels[((py-1)*frame.width+col)*4+3]>200){bottom=py;break;}
      if(bottom<0)continue;
      for(let dx=0;dx<2;dx++){
        const px=ox+col*2+dx;
        for(let py=oy+(bottom+1)*2;py<Math.floor(ground(px));py++){
          assert(data[(py*420+px)*4+3]>=240,`unsupported ${row}/${stage}/${dir}/${fraction}: ${px},${py}`);checks++;
        }
      }
    }
  }
  assert(checks>10000,'exercise the actual painted support edge, not only a solid fixture rectangle');
});

test('partial destruction can widen the painted footprint without stretching the masonry texture',()=>{
  for(const row of [0,1]){
    const f=art.states[row][2],span=paintedBuildingFootprint(f);
    assert(span[1]*2-f.width>HOUSE_PROFILES[row].width/2,'the old intact-only bound missed the ruin edge');
  }
  for(let row=0;row<3;row++){
    const samples=[];
    for(const stage of [0,1,2]){
      const out=createCanvas(400,300),c=out.getContext('2d');
      drawBuildingFooting(c,{x:200,y:210},row,210,art.footings[row],()=>270,art.states[row][stage]);
      samples.push(c.getImageData(180,214,40,40).data);
    }
    assert.deepEqual(samples[0],samples[1]);assert.deepEqual(samples[1],samples[2]);
  }
});

test('footprint inspection is cached once per immutable frame and ignores high overhangs',()=>{
  const frame=createCanvas(100,100),c=frame.getContext('2d');
  c.fillStyle='#777';c.fillRect(0,0,100,30);c.fillRect(22,86,54,12);c.fillRect(0,98,1,1);
  let reads=0;const read=c.getImageData.bind(c);c.getImageData=(...args)=>{reads++;return read(...args);};
  const first=paintedBuildingFootprint(frame);assert.deepEqual(first,[21,77]);
  for(let i=0;i<300;i++)assert.equal(paintedBuildingFootprint(frame),first);
  assert.equal(reads,1,'never rescan image pixels during every battle frame');
  const blank=createCanvas(10,10);assert.equal(paintedBuildingFootprint(blank),null);
});

test('terrain clipping and caller state remain intact and a completely collapsed house gets no new platform',()=>{
  const frame=art.states[0][2],out=createCanvas(400,300),c=out.getContext('2d');
  c.globalAlpha=.75;c.fillStyle='#345678';const alpha=c.globalAlpha;
  drawBuildingFooting(c,{x:200,y:210},0,210,art.footings[0],()=>230,frame);
  assert.equal(c.globalAlpha,alpha);assert.equal(c.fillStyle,'#345678');
  const d=c.getImageData(0,0,400,300).data;
  for(const [x,y]of [[50,215],[350,215],[200,195],[200,240]])assert.equal(d[(y*400+x)*4+3],0);
  const p=createScenery(Array(401).fill(210),[{kind:'house',x:200,building:0,seed:166}])[0];
  for(const part of p.parts)part.hp=0;
  let groundCalls=0;drawScenery(c,p,0,[],art,{},()=>{groundCalls++;return 230;});
  assert.equal(groundCalls,1,'settled rubble retains its normal center anchor, no standing foundation added');
});
