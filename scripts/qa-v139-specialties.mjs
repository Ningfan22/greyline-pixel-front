// Real engine + production renderer, with generated art loaded from public.
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {createCanvas,Image,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
globalThis.Image=class extends Image {
  set src(value){super.src=value.startsWith('/')?fileURLToPath(new URL('../public'+value,import.meta.url)):value;}
  get src(){return super.src;}
};
const {loadArt}=await import('../game/art.ts');
const {render}=await import('../game/render.ts');
const {createGame,startGame,spawnUnit,tick,explode,ground,H,setOrder}=await import('../game/engine.ts');
const {adultFrameChoice}=await import('../game/adult-animation.ts');
const {PACK_CANVAS,PACK_FPS,packFrameRect,packMotion}=await import('../game/pack-animation.ts');
const art=await loadArt(),s=createGame(139,undefined,undefined,undefined,{mapSeed:139});
startGame(s);s.aiIn=1e9;s.units=[];
for(const side of [0,1]) for(const [i,id] of ['ambush_squad','rangers','pathfinders','recon_jump','sniper_team','machinegun','infantry','tank','mortar'].entries())
  spawnUnit(s,side,id,1050+side*570+(side?1:-1)*i*28);
setOrder(s,0,'hold');setOrder(s,1,'advance');
const canvas=createCanvas(1280,H),ctx=canvas.getContext('2d');
const out=mkdtempSync(join(tmpdir(),'greyline-v139-specialties-'));
const costs=[],frames=[];let inspected=0;
for(let i=0;i<1800;i++) {
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
  if([120,410,1080,1799].includes(i)) {
    render(ctx,s,art,null,null,true,640,1280);
    writeFileSync(join(out,`battle-${i}.png`),canvas.toBuffer('image/png'));
    frames.push({time:s.time,alive:s.units.filter(u=>u.hp>0).length});
  }
}
const atlas=await loadImage(fileURLToPath(new URL('../public/art/pack-tear-v139.png',import.meta.url)));
const sheet=createCanvas(PACK_CANVAS.width*4,PACK_CANVAS.height*4),sc=sheet.getContext('2d');
sc.fillStyle='#2b2218';sc.fillRect(0,0,sheet.width,sheet.height);sc.imageSmoothingEnabled=false;
for(let i=0;i<16;i++){
  const p=packMotion(.48+(i+.5)/PACK_FPS),r=packFrameRect(atlas.width,atlas.height,i);
  sc.drawImage(atlas,r.x,r.y,r.width,r.height,p.x+(i%4)*PACK_CANVAS.width,p.y+Math.floor(i/4)*PACK_CANVAS.height,r.width*p.scale,r.height*p.scale);
}
writeFileSync(join(out,'pack-contact.png'),sheet.toBuffer('image/png'));
costs.sort((a,b)=>a-b);
const report={output:out,renderedFrames:604,unitFramesInspected:inspected,
  tickMedianMs:costs[Math.floor(costs.length/2)],tickP95Ms:costs[Math.floor(costs.length*.95)],frames};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
