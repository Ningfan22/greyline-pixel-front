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
const {createGame,startGame,spawnUnit,playCard,tick,explode,ground,H,W}=await import('../game/engine.ts');
const {gliderLanding}=await import('../game/glider.ts');
const {MAP_IDS,createMapLayout}=await import('../game/maps.ts');
const {adultFrameChoice}=await import('../game/adult-animation.ts');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),'greyline-v141-'));
const canvas=createCanvas(1280,H),ctx=canvas.getContext('2d'),captures=[],costs=[];
let inspected=0,rendered=0;
const save=name=>{writeFileSync(join(out,name+'.png'),canvas.toBuffer('image/png'));captures.push(name);};
const plate=createCanvas(1024,880),pc=plate.getContext('2d');pc.fillStyle='#55635b';pc.fillRect(0,0,1024,880);
pc.imageSmoothingEnabled=false;
const bounds=art.glider.map((f,i)=>{
  pc.drawImage(f,(i%2)*512,(i>>1)*220,512,200);
  const d=f.getContext('2d').getImageData(0,0,256,100).data,b={left:256,top:100,right:0,bottom:0};
  for(let y=0;y<100;y++)for(let x=0;x<256;x++)if(d[(y*256+x)*4+3]>=128){b.left=Math.min(b.left,x);b.top=Math.min(b.top,y);b.right=Math.max(b.right,x);b.bottom=Math.max(b.bottom,y);}
  assert(b.left>0&&b.right<255&&b.top>0&&b.bottom<99);assert(Math.abs(b.bottom-92)<=1);return b;
});
writeFileSync(join(out,'glider-cels.png'),plate.toBuffer('image/png'));
for(const map of MAP_IDS){
  const s=createGame(141,undefined,undefined,map,{mapSeed:141});startGame(s);s.aiIn=1e9;s.weather.disabled=true;
  const p=s.players[0],card={id:'glider_assault',uid:++s.uid};p.hand=[card];p.energy=10;
  let landing=null;for(let x=800;x<W-650;x+=150){const lz=gliderLanding(s,x,0);if(lz!==null){landing=lz;break;}}
  assert(landing!==null);assert(playCard(s,0,card.uid,landing).ok);const u=s.units.at(-1),seen=new Set();
  for(let i=0;i<900;i++){
    const at=performance.now();tick(s,1/60);costs.push(performance.now()-at);
    for(const v of s.units){if(!v.glider){const f=adultFrameChoice(v,s.time);assert.notEqual(f.group,'signals4');
      if(f.group==='actions20'&&[8,9].includes(f.index))assert(v.rappelling&&!v.wounded&&!v.surrendered);inspected++;}}
    if(i%3===0){render(ctx,s,art,null,null,true,Math.max(0,landing-600),1280);rendered++;}
    const stage=u.destroyed?'empty':u.glider.phase;
    if(!seen.has(stage)&&(stage!=='approach'||u.x>landing-450)){
      seen.add(stage);render(ctx,s,art,null,null,true,Math.max(0,landing-600),1280);save(`${map}-${stage}`);
    }
  }
  // Real large explosion on every map, with scenery/debris/smoke layers active.
  const x=landing+160;spawnUnit(s,1,'tank',x);explode(s,x,ground(s,x),120,1000,0);
  s.blasts.at(-1).kind='artillery';
  for(let i=0;i<180;i++){
    tick(s,1/60);if(i%3===0){render(ctx,s,art,null,null,true,Math.max(0,landing-600),1280);rendered++;}
    if([8,30,75,150].includes(i)){render(ctx,s,art,null,null,true,Math.max(0,landing-600),1280);save(`${map}-explosion-${i}`);}
  }
}
let pads=0;
for(const map of MAP_IDS)for(let seed=1;seed<=100;seed++){
  const m=createMapLayout(map,W,seed);
  for(const h of m.scenerySites.filter(p=>p.kind==='house')){
    for(let x=h.x-110;x<=h.x+110;x++)assert.equal(m.terrain[x],m.terrain[h.x],`${map}/${seed} floating foundation`);pads++;
  }
}
costs.sort((a,b)=>a-b);
const report={output:out,rendered,inspected,mapSeeds:400,buildingPads:pads,bounds,captures,
  tickMedianMs:costs[costs.length>>1],tickP95Ms:costs[Math.floor(costs.length*.95)]};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
