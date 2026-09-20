import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {createCanvas,Image}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
globalThis.Image=class extends Image{
  set src(v){super.src=v.startsWith('/')?fileURLToPath(new URL('../public'+v,import.meta.url)):v;}
  get src(){return super.src;}
};
const {loadArt,uniformFrame}=await import('../game/art.ts');
const {render}=await import('../game/render.ts');
const {adultFrameChoice,adultIdentity}=await import('../game/adult-animation.ts');
const {createGame,startGame,spawnUnit,setOrder,tick,ground,refreshVision,CARDS,H}=await import('../game/engine.ts');
const {proneStartStop}=await import('../tests/fixtures/prone-start-stop.mjs');
const {MAP_IDS}=await import('../game/maps.ts');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),'greyline-v170-prone-motion-'));
const canvas=createCanvas(1280,H),ctx=canvas.getContext('2d'),original=ctx.drawImage.bind(ctx);
let draws=[],rendered=0,verified=0;
ctx.drawImage=(...args)=>{draws.push(args[0]);return original(...args);};
function draw(s,camera,name){
  const before=JSON.stringify(s.units);draws=[];render(ctx,s,art,null,null,true,camera,1280);rendered++;
  assert.equal(JSON.stringify(s.units),before);
  if(name)writeFileSync(join(out,name+'.png'),canvas.toBuffer('image/png'));
}
function height(f){const d=f.getContext('2d').getImageData(0,0,f.width,f.height).data;let top=f.height,bottom=-1;
  for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++)if(d[(y*f.width+x)*4+3]>=160){top=Math.min(top,y);bottom=Math.max(bottom,y);}
  return bottom-top+1;}

const trials=[];
for(const side of [0,1])for(const id of ['infantry','marines','militia','armed_police']){
  const {s,u,x}=proneStartStop(side,id);
  // The observing side sees the red trial through a genuine friendly observer.
  if(side){spawnUnit(s,0,'scouts',x-600,{member:0});const scout=s.units.at(-1);
    Object.assign(scout,{x:x-600,y:374,cooldown:10000,decisionIn:1000,readyAt:-100});setOrder(s,0,'hold');}
  refreshVision(s);const phases={rise:new Set(),settle:new Set()},heights=[];
  let previous,largestJump=0,bodySwitches=0;
  for(let i=0;i<450;i++){
    // March; brief hold; resume; finally halt long enough to settle.
    if(i===100||i===180)setOrder(s,side,'hold');
    if(i===125)setOrder(s,side,'prone');
    tick(s,1/60);const f=adultFrameChoice(u,s.time),body=art.adults[adultIdentity(id)][f.group][f.index];
    const h=height(body);heights.push(h);if(previous!==undefined&&i!==0){largestJump=Math.max(largestJump,Math.abs(h-previous));if(h!==previous)bodySwitches++;}previous=h;
    if(f.group==='stance16')phases[i<100?'rise':'settle'].add(f.index);
    draw(s,x-500,[5,23,45,115,135,265,285,340].includes(i)?`${id}-${side}-${i}`:undefined);
    if(f.group==='stance16'||f.group==='crawl2'){
      assert(draws.includes(uniformFrame(body,CARDS[id].uniform)),`${id}/${side}: actual selected image must reach canvas`);verified++;
    }
    if(i>=105&&i<125)assert.equal(f.group,'crawl2',`${id}/${side}/${i}: brief real hold cannot snap to flat aim`);
    assert.equal(u.pose,'prone');assert(!u.rappelling);
  }
  assert.deepEqual([...phases.rise],[15,14,13,12,11]);assert.deepEqual([...phases.settle],[11,12,13,14,15]);
  assert(largestJump<=3,`${id}/${side}: ${largestJump}px`);assert.equal(u.proneTravel,0);
  trials.push({side,id,largestJump,bodySwitches,rise:[...phases.rise],settle:[...phases.settle]});
  if(side===0&&id==='infantry'){
    const plate=createCanvas(7*192,260),p=plate.getContext('2d');p.fillStyle='#a2aaa4';p.fillRect(0,0,plate.width,plate.height);p.imageSmoothingEnabled=false;
    const frames=[...art.adults.infantry.stance16.slice(11).reverse(),...art.adults.infantry.crawl2];
    frames.forEach((f,i)=>{p.drawImage(f,i*192,0,192,192);p.fillStyle='#182b21';p.font='16px monospace';p.fillText(`${i<5?'prepare':'crawl'} h${height(f)}`,i*192+10,225);});
    writeFileSync(join(out,'start-to-crawl.png'),plate.toBuffer('image/png'));
  }
}

// Mixed moving/firing/support/airborne units on four real seeded maps. Normal
// simulation, visibility, health and ammunition; no artificial pose lock.
const battles=[];
for(const map of MAP_IDS){
  const s=createGame(170,undefined,undefined,map,{mapSeed:170,difficulty:'standard'});startGame(s);s.aiIn=1e9;
  for(const side of [0,1])for(const [i,id] of ['infantry','marines','militia','machinegun','medic_team','assault_grenadiers','tank','air_assault','airborne_insertion'].entries())
    spawnUnit(s,side,id,side?2100+i*32:1600-i*32);
  let bridges=0,ropeFrames=0,invalidRope=0,movement=0,shots=0;
  for(let i=0;i<3600;i++){
    tick(s,1/60);
    for(const u of s.units){const f=CARDS[u.id].members?adultFrameChoice(u,s.time):null;
      if((u.proneTravel??0)>0&&(u.proneTravel??0)<1)bridges++;
      if(f?.group==='actions20'&&[8,9,10,11].includes(f.index)){
        ropeFrames++;if(!u.rappelling||u.hp<=0||u.wounded||u.surrendered||u.y>=ground(s,u.x))invalidRope++;
      }
      if(u.moving&&u.pose==='prone')movement++;
      assert(Number.isFinite(u.x)&&Number.isFinite(u.y)&&Number.isFinite(u.hp));
    }
    if(i%60===0)draw(s,1250,[600,1800,3540].includes(i)?`${map}-${Math.round(s.time)}s`:undefined);
  }
  shots=s.units.reduce((n,u)=>n+u.shots,0);assert.equal(invalidRope,0);
  battles.push({map,bridges,ropeFrames,invalidRope,movingProneFrames:movement,survivingUnitShots:shots,units:s.units.length});
}
const report={out,rendered,verified,trials,battles};writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
