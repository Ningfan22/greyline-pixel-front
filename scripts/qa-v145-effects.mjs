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
const {loadArt}=await import('../game/art.ts');
const {drawBlast}=await import('../game/ballistics.ts');
const {drawScenery}=await import('../game/scenery-art.ts');
const {createScenery,HOUSE_PROFILES}=await import('../game/world.ts');
const {render}=await import('../game/render.ts');
const {createGame,startGame,spawnUnit,tick,explode,ground,H,W}=await import('../game/engine.ts');
const {MAP_IDS}=await import('../game/maps.ts');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),'greyline-v145-effects-'));
const families=art.paintedBlasts ? [...art.combatExplosions,...art.combatExplosionsV13,art.paintedBlasts.fuel,art.paintedBlasts.earth]
  : [...art.combatExplosions,...art.combatExplosionsV13];
const atlas=createCanvas(16*160,families.length*200),a=atlas.getContext('2d');
a.fillStyle='#849693';a.fillRect(0,0,atlas.width,atlas.height);a.imageSmoothingEnabled=false;
families.forEach((frames,row)=>frames.forEach((f,i)=>{
  a.drawImage(f,i*160+(160-f.width)/2,row*200+195-f.height);
  a.fillStyle='#152825';a.font='14px monospace';a.fillText(`${row}:${i}`,i*160+10,row*200+16);
}));
writeFileSync(join(out,'actual-atlases.png'),atlas.toBuffer('image/png'));
const kinds=['he','artillery','wreck','grenade','air','crash','penetration'];
const times=[0,.04,.1,.2,.35,.5,.8,1.1,1.6,2.2,3,4];
const plate=createCanvas(times.length*340,kinds.length*430),p=plate.getContext('2d');
p.fillStyle='#849693';p.fillRect(0,0,plate.width,plate.height);p.imageSmoothingEnabled=false;
for(const [row,kind]of kinds.entries())for(const [col,age]of times.entries()){
  p.save();p.beginPath();p.rect(col*340,row*430,340,430);p.clip();
  drawBlast(p,{x:col*340+170,y:row*430+410,kind,age,radius:80,seed:16},art.explosions,art.combatExplosions,art.combatExplosionsV13,art.paintedBlasts);
  p.restore();p.fillStyle='#152825';p.font='16px monospace';p.fillText(`${kind} ${age}s`,col*340+10,row*430+20);
}
writeFileSync(join(out,'blast-lifecycles.png'),plate.toBuffer('image/png'));
for(const [row,kind]of kinds.entries()){
  const strip=createCanvas(4*340,3*430),c=strip.getContext('2d');
  for(let i=0;i<12;i++)c.drawImage(plate,i*340,row*430,340,430,i%4*340,Math.floor(i/4)*430,340,430);
  writeFileSync(join(out,`${kind}-lifecycle.png`),strip.toBuffer('image/png'));
}
const houseCanvas=createCanvas(1200,960),h=houseCanvas.getContext('2d');h.imageSmoothingEnabled=false;
h.fillStyle='#9bacb0';h.fillRect(0,0,1200,960);
for(let row=0;row<3;row++)for(let stage=0;stage<3;stage++){
  const x=stage*400+200,y=row*320+255;
  const scenery=createScenery(Array(1300).fill(y),[{kind:'house',x,building:row,seed:145}])[0];
  for(const part of scenery.parts)part.hp=part.maxHp*([1,.7,.35][stage]);
  const groundAt=px=>y+Math.max(0,1-Math.abs(px-(x+HOUSE_PROFILES[row].width*.37))/60)*48;
  h.fillStyle='#544433';h.beginPath();h.moveTo(stage*400,y+80);
  for(let px=stage*400;px<stage*400+400;px++)h.lineTo(px,groundAt(px));
  h.lineTo(stage*400+400,y+80);h.closePath();h.fill();
  drawScenery(h,scenery,0,art.scenery,art.buildings,art.trees,groundAt);
  h.fillStyle='#152825';h.font='16px monospace';h.fillText(`house ${row} / damage ${stage}`,stage*400+10,row*320+20);
}
writeFileSync(join(out,'building-support.png'),houseCanvas.toBuffer('image/png'));
const scene=createCanvas(1280,H),ctx=scene.getContext('2d');let rendered=0;
const drawMs=[],tickMs=[],captures=[],slowFrames=[];
for(const map of MAP_IDS){
  const s=createGame(145,undefined,undefined,map,{mapSeed:145});startGame(s);s.aiIn=1e9;s.weather.disabled=true;
  const house=s.scenery.find(p=>p.kind==='house'&&p.x>600&&p.x<W-600),x=house?.x??1800;
  const camera=Math.max(0,Math.min(W-1280,x-500));
  for(let i=0;i<3;i++){spawnUnit(s,0,'infantry',x-320-i*50);spawnUnit(s,1,'infantry',x+320+i*50);}
  spawnUnit(s,0,'tank',x-140);spawnUnit(s,1,'tank',x+140);
  for(let i=0;i<360;i++){
    if(i===0||i===80){const hit=x+(i?140:-140);explode(s,hit,ground(s,hit),70,1000,0);s.blasts.at(-1).kind=i?'wreck':'artillery';}
    let at=performance.now();tick(s,1/60);tickMs.push(performance.now()-at);
    // Art fixture deliberately reveals the scene. Vision rules remain covered
    // separately; captures exercise the same production effect/terrain layers.
    s.sight[0].fill(true);s.visible[0]=s.units.map(u=>u.uid);s.knownTerrain[0]=s.terrain.slice();
    s.knownScenery[0]=Object.fromEntries(s.scenery.map(p=>[p.id,structuredClone(p)]));
    at=performance.now();render(ctx,s,art,null,null,true,camera,1280);const drawTime=performance.now()-at;
    drawMs.push(drawTime);if(drawTime>16)slowFrames.push({map,frame:i,ms:drawTime});rendered++;
    if([18,98,170,340].includes(i)){
      const name=`${map}-${i}.png`;writeFileSync(join(out,name),scene.toBuffer('image/png'));captures.push(name);
    }
  }
}
const stats=xs=>{xs.sort((a,b)=>a-b);return {median:xs[xs.length>>1],p95:xs[Math.floor(xs.length*.95)],max:xs.at(-1)};};
const report={output:out,rendered,captures,slowFrames,tickMs:stats(tickMs),drawMs:stats(drawMs)};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
