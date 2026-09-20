import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createGame,startGame,spawnUnit,refreshVision,tick,explode,ground,H} from '../game/engine.ts';
import {WRECKS,wreckContact,wreckObstacles} from '../game/wreck-geometry.ts';
const {createCanvas,Image}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
globalThis.Image=class extends Image{
  set src(v){super.src=v.startsWith('/')?fileURLToPath(new URL('../public'+v,import.meta.url)):v;}
  get src(){return super.src;}
};
const {loadArt}=await import('../game/art.ts'),{render}=await import('../game/render.ts');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),'greyline-v162-wrecks-'));
const tankIds=['light_tank','tank','heavy_tank'],causes=['bullet','blast','burn'];
const sheet=createCanvas(1280,660),a=sheet.getContext('2d');a.imageSmoothingEnabled=false;
a.fillStyle='#a3b0b0';a.fillRect(0,0,1280,660);
for(const [row,id]of tankIds.entries())for(const [col,cause]of causes.entries()){
  const f=art.wreckVariants[id][cause][0];a.drawImage(f,col*420+210-f.width/2,row*220+206-f.height);
  a.fillStyle='#172824';a.font='18px monospace';a.fillText(`${id} / ${cause}`,col*420+12,row*220+25);
}
writeFileSync(join(out,'tank-states.png'),sheet.toBuffer('image/png'));
const others=Object.keys(WRECKS).filter(id=>!tankIds.includes(id));
const catalog=createCanvas(1200,Math.ceil(others.length/4)*190),c=catalog.getContext('2d');
c.imageSmoothingEnabled=false;c.fillStyle='#a3b0b0';c.fillRect(0,0,catalog.width,catalog.height);
for(const [i,id]of others.entries()){
  const f=art.wreckVariants[id].blast[0];c.drawImage(f,i%4*300+150-f.width/2,Math.floor(i/4)*190+170-f.height);
  c.fillStyle='#172824';c.font='15px monospace';c.fillText(id,i%4*300+10,Math.floor(i/4)*190+20);
}
writeFileSync(join(out,'other-authored-wrecks.png'),catalog.toBuffer('image/png'));
const canvas=createCanvas(1280,H),ctx=canvas.getContext('2d');let rendered=0;
const captures=[],timings=[];
for(const map of ['greyline','jungle','mountains','desert'])for(const side of [0,1]){
  const s=createGame(162,undefined,undefined,map,{mapSeed:162});startGame(s);s.aiIn=1e9;
  s.weather.disabled=true;s.night=false;s.units=[];
  // Friendly wrecks are always known. Living observers use ordinary vision.
  for(const x of [1250,1650,2050])spawnUnit(s,0,'infantry',x);
  for(const u of s.units)Object.assign(u,{cooldown:1000,decisionIn:1000,holdX:u.x,readyAt:1000});
  for(const [i,id]of tankIds.entries()){
    const x=1320+i*310;
    const w={id:6+i,cardId:id,side:0,facing:side?-1:1,x,y:ground(s,x),angle:0,age:130,falling:false,
      vx:0,vy:0,pose:'idle',lane:0,cause:causes[i]};
    Object.assign(w,wreckContact(px=>ground(s,px),w));s.wrecks.push(w);
  }
  refreshVision(s);
  for(let i=0;i<120;i++){
    if(i===20){const x=1630;explode(s,x,ground(s,x),60,1,0,1,1,'artillery');}
    tick(s,1/60);const before=JSON.stringify(s.wrecks),at=performance.now();
    render(ctx,s,art,null,null,true,1000,1280);timings.push(performance.now()-at);rendered++;
    assert.equal(JSON.stringify(s.wrecks),before);
    if([0,119].includes(i)){
      const name=`${map}-side${side}-${i}.png`;writeFileSync(join(out,name),canvas.toBuffer('image/png'));captures.push(name);
    }
    for(const w of s.wrecks)for(const b of wreckObstacles(w))assert([b.x,b.y,b.w,b.h].every(Number.isFinite));
  }
}
timings.sort((a,b)=>a-b);
const report={out,rendered,captures,drawMs:{median:timings[timings.length>>1],p95:timings[Math.floor(timings.length*.95)],max:timings.at(-1)}};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
