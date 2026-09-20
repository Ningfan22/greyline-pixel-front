import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {tankRoleArena} from '../tests/fixtures/tank-role-arena.mjs';
import {tick,refreshVision,explode,ground,createGame,startGame,spawnUnit,setOrder,H} from '../game/engine.ts';
import {smokeAtlasV13,drawSmokePuff} from '../game/effect-atlas.ts';
import {transparentSheet} from '../game/sprite-atlas.ts';
const {createCanvas,Image,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
globalThis.Image=class extends Image{
  set src(v){super.src=v.startsWith('/')?fileURLToPath(new URL('../public'+v,import.meta.url)):v;}
  get src(){return super.src;}
};
const {loadArt}=await import('../game/art.ts'),{render}=await import('../game/render.ts');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),'greyline-v161-smoke-'));
const old=smokeAtlasV13(transparentSheet(await loadImage(new URL('../public/art/explosions-v13.png',import.meta.url).pathname)));
const plate=createCanvas(1280,640),pc=plate.getContext('2d');pc.imageSmoothingEnabled=false;
for(let row=0;row<4;row++)for(let col=0;col<8;col++){
  const phase=col/7,x=col*160,y=row*160;
  pc.fillStyle=row%2?'#323d31':'#b3bdc0';pc.fillRect(x,y,160,160);
  drawSmokePuff(pc,row<2?old:art.smoke,phase,x+80,y+86,145,'#857f72',.7);
  pc.fillStyle=row%2?'#f1ebcc':'#172825';pc.font='12px monospace';
  pc.fillText(`${row<2?'v160':'v161'} ${phase.toFixed(2)}`,x+8,y+16);
}
writeFileSync(join(out,'smoke-before-after.png'),plate.toBuffer('image/png'));
const scene=createCanvas(1280,H),ctx=scene.getContext('2d'),durations=[];
const muzzle=createCanvas(1280,8*200),mc=muzzle.getContext('2d');mc.imageSmoothingEnabled=false;
let rendered=0;const captures=[];
for(const [row,id]of ['tank','heavy_tank'].entries())for(const side of [0,1]){
  const {s,tank,x}=tankRoleArena(id,side,161),camera=x-640;
  for(let i=0;i<72;i++){
    tick(s,1/60);if(i===0)tank.cooldown=1000;
    const before=JSON.stringify(s.particles),at=performance.now();render(ctx,s,art,null,null,true,camera,1280);
    durations.push(performance.now()-at);rendered++;assert.equal(JSON.stringify(s.particles),before);
    if([3,17,32,57].includes(i)){
      const col=[3,17,32,57].indexOf(i),destRow=(row*2+side)*2;
      const mx=tank.muzzleX-camera,my=tank.muzzleY;
      // Whole production frame above, 2x nearest-neighbour muzzle crop below.
      if(i===3)mc.drawImage(scene,0,210,1280,200,0,(row*2+side)*400,1280,200);
      const detail=createCanvas(320,200),dc=detail.getContext('2d');dc.imageSmoothingEnabled=false;
      dc.drawImage(scene,mx-80,my-50,160,100,0,0,320,200);dc.fillStyle='#fff5c6';dc.font='13px monospace';
      dc.fillText(`${id} side${side} ${((i+1)/60).toFixed(2)}s`,8,18);
      mc.drawImage(detail,col*320,destRow*200+200);
    }
  }
}
writeFileSync(join(out,'muzzle-cycles.png'),muzzle.toBuffer('image/png'));
for(const map of ['greyline','jungle','mountains','desert']){
  const s=createGame(161,undefined,undefined,map,{mapSeed:161});startGame(s);s.aiIn=1e9;
  s.weather.disabled=true;s.night=false;
  const x=1500;
  spawnUnit(s,0,'infantry',x-110);spawnUnit(s,0,'tank',x-220);spawnUnit(s,1,'heavy_tank',x+120);
  for(const u of s.units)Object.assign(u,{cooldown:10000,secondaryCooldown:10000});
  setOrder(s,0,'hold');setOrder(s,1,'hold');refreshVision(s);
  for(let i=0;i<600;i++){
    if([0,50,95].includes(i))explode(s,x+120+(i===50?65:0),ground(s,x+120),60,2000,0);
    tick(s,1/60);const before=JSON.stringify({p:s.particles,b:s.blasts}),at=performance.now();
    render(ctx,s,art,null,null,true,x-500,1280);durations.push(performance.now()-at);rendered++;
    assert.equal(JSON.stringify({p:s.particles,b:s.blasts}),before);
    if([10,110,220,480].includes(i)){
      const name=`${map}-${i}.png`;writeFileSync(join(out,name),scene.toBuffer('image/png'));captures.push(name);
    }
  }
}
const stats=xs=>{xs.sort((a,b)=>a-b);return {median:xs[xs.length>>1],p95:xs[Math.floor(xs.length*.95)],max:xs.at(-1)};};
// Same hot draw workload for both atlases; this is not browser FPS.
function bench(frames){
  for(let n=0;n<2;n++)for(let j=0;j<1000;j++)drawSmokePuff(ctx,frames,(j%61)/60,120,120,70,'#44423c',.3);
  const at=performance.now();for(let j=0;j<6000;j++)drawSmokePuff(ctx,frames,(j%61)/60,120,120,70,'#44423c',.3);
  return (performance.now()-at)*1000/6000;
}
const report={out,rendered,captures,drawMs:stats(durations),hotPuffMicroseconds:{previous:bench(old),current:bench(art.smoke)}};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
