import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {createCanvas,Image}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
globalThis.Image=class extends Image {
  set src(value){super.src=value.startsWith('/')?fileURLToPath(new URL('../public'+value,import.meta.url)):value;}
  get src(){return super.src;}
};
const {loadArt}=await import('../game/art.ts');
const {render}=await import('../game/render.ts');
const {createGame,startGame,spawnUnit,tick,explode,ground,H,setOrder}=await import('../game/engine.ts');
const {adultFrameChoice}=await import('../game/adult-animation.ts');
const {heavyMGFrame}=await import('../game/heavy-mg-art.ts');
const {suppressNearMiss}=await import('../game/projectile-depth.ts');
const {buildSpatial}=await import('../game/spatial.ts');
const art=await loadArt(),s=createGame(140,undefined,undefined,undefined,{mapSeed:140});
startGame(s);s.aiIn=1e9;s.units=[];
for(const side of [0,1])for(const [i,id] of ['heavy_mg','lmg_team','machinegun','infantry','assault','tank','mortar'].entries())
  spawnUnit(s,side,id,1100+side*580+(side?1:-1)*i*32);
setOrder(s,0,'hold');setOrder(s,1,'advance');
const canvas=createCanvas(1280,H),ctx=canvas.getContext('2d');
const out=mkdtempSync(join(tmpdir(),'greyline-v140-machinegun-'));
const costs=[],frames=[],heavyCels=new Set();let inspected=0;
for(let i=0;i<1800;i++){
  if(i===180||i===500){explode(s,1420,ground(s,1420),70,120,0);s.blasts.at(-1).kind='artillery';}
  const t=performance.now();tick(s,1/60);costs.push(performance.now()-t);
  for(const u of s.units){const f=adultFrameChoice(u,s.time);
    if(f.group==='actions20'&&[8,9].includes(f.index))assert(u.rappelling&&!u.wounded&&!u.surrendered);
    assert.notEqual(f.group,'signals4');const h=heavyMGFrame(u,s.time);if(h!==null)heavyCels.add(h);inspected++;
  }
  if(i%3===0)render(ctx,s,art,null,null,true,700,1280);
  if([150,510,1100,1799].includes(i)){render(ctx,s,art,null,null,true,700,1280);
    writeFileSync(join(out,`battle-${i}.png`),canvas.toBuffer('image/png'));
    frames.push({time:s.time,alive:s.units.filter(u=>u.hp>0).length});}
}
const contact=createCanvas(1024,480),cc=contact.getContext('2d');
cc.fillStyle='#283129';cc.fillRect(0,0,1024,480);cc.imageSmoothingEnabled=false;
const bounds=art.heavyMG.map(({image,muzzle},i)=>{
  cc.drawImage(image,(i%4)*256,Math.floor(i/4)*240,256,192);
  cc.fillStyle='#e8ddc5';cc.font='16px monospace';cc.fillText(`cel ${i+1}`,i%4*256+24,Math.floor(i/4)*240+220);
  const data=image.getContext('2d').getImageData(0,0,128,96).data;
  const b={x0:128,y0:96,x1:0,y1:0};
  for(let y=0;y<96;y++)for(let x=0;x<128;x++)if(data[(y*128+x)*4+3]>=128){b.x0=Math.min(b.x0,x);b.y0=Math.min(b.y0,y);b.x1=Math.max(b.x1,x);b.y1=Math.max(b.y1,y);}
  assert(b.x0>0&&b.y0>0&&b.x1<127&&b.y1<95,'no cell edges');
  assert(Math.abs(b.y1-93)<=1,'fixed ground contact');return {i,...b,muzzle};
});
writeFileSync(join(out,'heavy-mg-contact.png'),contact.toBuffer('image/png'));
// Real renderer: same scale and pose, no rescaled anatomy or image compositing.
const lineup=createGame(140);startGame(lineup);lineup.aiIn=1e9;lineup.units=[];
lineup.scenery=[];lineup.walls=[];lineup.terrain.fill(374);lineup.original.fill(374);
for(const [i,id]of ['machinegun','lmg_team','heavy_mg'].entries()){
  const n=lineup.units.length;spawnUnit(lineup,0,id,1000+i*160);lineup.units.splice(n+1);
  Object.assign(lineup.units[n],{x:1000+i*160,y:374,lane:0,pose:'crouch',poseAnimSeen:'crouch',moving:false,motion:'ground',stillFor:3,ammo:150});
}
render(ctx,lineup,art,null,null,true,750,1280);writeFileSync(join(out,'lineup.png'),canvas.toBuffer('image/png'));
// Microbenchmark only the changed near-miss query, with identical short rays.
const bench=createGame(140);bench.units=[];bench.scenery=[];bench.walls=[];bench.terrain.fill(374);
for(let i=0;i<100;i++)spawnUnit(bench,1,'infantry',80+i*35);
for(const u of bench.units)Object.assign(u,{y:374,pose:'idle',lane:0});
const measure=indexed=>{bench.spatial=indexed?buildSpatial(bench.units,3840):undefined;const t=performance.now();
  for(let i=0;i<3000;i++){const x=80+i%100*35;
    suppressNearMiss(bench,{damage:1,side:0,startLane:0,targetLane:0,startX:0,startY:338,tx:3840,ammunition:'machinegun'},x,338,x+18,338);bench.particles=[];}
  return performance.now()-t;};
measure(false);measure(true);const micro={full:[],indexed:[]};
for(let i=0;i<5;i++){micro.full.push(measure(false));micro.indexed.push(measure(true));}
costs.sort((a,b)=>a-b);
const report={output:out,renderedFrames:605,unitFramesInspected:inspected,heavyCels:[...heavyCels].sort(),
  tickMedianMs:costs[Math.floor(costs.length/2)],tickP95Ms:costs[Math.floor(costs.length*.95)],frames,bounds,
  queryMicrobenchmark:{units:bench.units.length,rays:3000,...micro}};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
