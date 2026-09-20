import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const {createCanvas,loadImage,Image}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
const {buildingFrames}=await import('../game/building-art.ts');
const {paintedFootings}=await import('../game/battlefield-effects-art.ts');
const {drawScenery}=await import('../game/scenery-art.ts');
const {createScenery,HOUSE_PROFILES}=await import('../game/world.ts');
const load=name=>loadImage(new URL('../public/art/'+name,import.meta.url).pathname);
const [states,collapse,footing]=await Promise.all(['buildings-v13.png','building-collapse-v13.png','building-footings-v145.png'].map(load));
const art={...buildingFrames(states,collapse),footings:paintedFootings(footing)};
const out=mkdtempSync(join(tmpdir(),`greyline-v166-foundations-${process.argv[2]??'review'}-`));
const sheet=createCanvas(3*400,3*300),c=sheet.getContext('2d'),report=[];
c.imageSmoothingEnabled=false;
for(let row=0;row<3;row++)for(let stage=0;stage<3;stage++){
  const x=200,y=210,frame=art.states[row][stage],f=frame.getContext('2d'),d=f.getImageData(0,0,frame.width,frame.height).data;
  const scene=createCanvas(400,300),ctx=scene.getContext('2d');ctx.imageSmoothingEnabled=false;
  const p=createScenery(Array(401).fill(y),[{kind:'house',x,building:row,seed:166}])[0];
  for(const part of p.parts)part.hp=part.maxHp*[1,.7,.35][stage];
  const g=px=>y+Math.max(0,1-Math.abs(px-(x+HOUSE_PROFILES[row].width*.47))/65)*52;
  drawScenery(ctx,p,0,[],art,{},g);
  const pixels=ctx.getImageData(0,0,400,300).data,unsupported=[];
  for(let col=0;col<frame.width;col++){
    let bottom=-1;
    for(let py=frame.height-1;py>=frame.height-14;py--)if(d[(py*frame.width+col)*4+3]>200&&d[((py-1)*frame.width+col)*4+3]>200){bottom=py;break;}
    if(bottom<0)continue;
    const px=x-frame.width+col*2+1,from=y-(frame.height-4)*2+(bottom+1)*2;
    for(let py=from;py<Math.floor(g(px));py++)if(pixels[(py*400+px)*4+3]<240)unsupported.push([px,py]);
  }
  ctx.globalCompositeOperation='destination-over';ctx.fillStyle='#53604d';ctx.beginPath();ctx.moveTo(0,300);
  for(let px=0;px<=400;px++)ctx.lineTo(px,g(px));ctx.lineTo(400,300);ctx.closePath();ctx.fill();
  ctx.fillStyle='#99a7ad';ctx.fillRect(0,0,400,300);ctx.globalCompositeOperation='source-over';
  ctx.fillStyle='#20312b';ctx.font='14px monospace';ctx.fillText(`house ${row} stage ${stage}: ${unsupported.length} gaps`,8,18);
  const file=`house-${row}-${stage}.png`;writeFileSync(join(out,file),scene.toBuffer('image/png'));
  c.drawImage(scene,stage*400,row*300);report.push({row,stage,unsupported:unsupported.length,examples:unsupported.slice(0,12),file});
}
writeFileSync(join(out,'contact.png'),sheet.toBuffer('image/png'));
globalThis.Image=class extends Image{
  set src(v){super.src=v.startsWith('/')?fileURLToPath(new URL('../public'+v,import.meta.url)):v;}
  get src(){return super.src;}
};
const {loadArt}=await import('../game/art.ts');
const {createGame,startGame,spawnUnit,refreshVision,crater,H,W}=await import('../game/engine.ts');
const {MAP_IDS}=await import('../game/maps.ts');
const {render}=await import('../game/render.ts');
const allArt=await loadArt(),scene=createCanvas(1280,H),ctx=scene.getContext('2d'),captures=[];
for(const map of MAP_IDS)for(const stage of [0,1,2])for(const dir of [-1,1]){
  const s=createGame(166,undefined,undefined,map,{mapSeed:166});startGame(s);
  s.aiIn=1e9;s.weather.disabled=true;s.night=false;s.units=[];
  const p=s.scenery.filter(p=>p.kind==='house').sort((a,b)=>Math.abs(a.x-1800)-Math.abs(b.x-1800))[0];
  assert(p,`${map}: needs a real generated house`);
  for(const part of p.parts)part.hp=part.maxHp*[1,.7,.35][stage];
  const half=HOUSE_PROFILES[p.building].width/2;
  crater(s,p.x+dir*(half+1),44,18);
  spawnUnit(s,0,'scouts',p.x-180);spawnUnit(s,0,'scouts',p.x+180);refreshVision(s);
  assert(s.knownScenery[0][p.id],'fixture must be observed through ordinary vision');
  const before=JSON.stringify({units:s.units,scenery:s.scenery,terrain:s.terrain});
  render(ctx,s,allArt,null,null,true,Math.max(0,Math.min(W-1280,p.x-640)),1280);
  assert.equal(JSON.stringify({units:s.units,scenery:s.scenery,terrain:s.terrain}),before);
  const file=`${map}-stage${stage}-side${dir}.png`;writeFileSync(join(out,file),scene.toBuffer('image/png'));captures.push(file);
}
writeFileSync(join(out,'report.json'),JSON.stringify({report,captures},null,2));console.log(JSON.stringify({out,report,captures}));
