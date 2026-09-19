// Exercise the production renderer and live role changes, not a UI mock.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const {createCanvas,Image}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
globalThis.Image=class extends Image {
  set src(value){super.src=value.startsWith('/')?fileURLToPath(new URL('../public'+value,import.meta.url)):value;}
  get src(){return super.src;}
};
const {loadArt}=await import('../game/art.ts');
const {render}=await import('../game/render.ts');
const {createGame,startGame,spawnUnit,tick,explode,ground,H,unitRange}=await import('../game/engine.ts');
const {adultFrameChoice}=await import('../game/adult-animation.ts');
const art=await loadArt(),s=createGame(138,undefined,undefined,undefined,{mapSeed:138});
startGame(s);s.aiIn=1e9;s.units=[];
for(const side of [0,1]) for(const [i,id] of ['sniper_team','sniper','scouts','machinegun','infantry','tank','mortar'].entries())
  spawnUnit(s,side,id,1050+side*570+(side?1:-1)*i*28);
const canvas=createCanvas(1280,H),ctx=canvas.getContext('2d');
const out=mkdtempSync(join(tmpdir(),'greyline-v138-precision-'));
const costs=[],frames=[],pair=s.units.filter(u=>u.side===0&&u.id==='sniper_team');
let inspected=0;
for(let i=0;i<1080;i++) {
  if(i===100||i===390) {
    explode(s,1370,ground(s,1370),70,150,0);
    s.blasts.at(-1).kind='artillery';
  }
  const t=performance.now();tick(s,1/60);costs.push(performance.now()-t);
  for(const u of s.units) {
    const f=adultFrameChoice(u,s.time);
    if(f.group==='actions20'&&[8,9].includes(f.index))
      assert(u.rappelling&&!u.wounded&&!u.surrendered,`rogue climb ${u.uid}`);
    inspected++;
  }
  if(i%3===0)render(ctx,s,art,null,null,true,640,1280);
  if([120,410,720,1079].includes(i)) {
    writeFileSync(join(out,`battle-${i}.png`),canvas.toBuffer('image/png'));
    frames.push({time:s.time,pair:pair.map(u=>({member:u.member,pose:u.pose,x:u.x,y:u.y,shots:u.shots,range:unitRange(s,u)}))});
  }
}
costs.sort((a,b)=>a-b);
const report={output:out,renderedFrames:360,unitFramesInspected:inspected,
  tickMedianMs:costs[Math.floor(costs.length/2)],tickP95Ms:costs[Math.floor(costs.length*.95)],frames};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
