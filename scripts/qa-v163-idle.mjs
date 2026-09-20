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
const {createGame,startGame,spawnUnit,refreshVision,CARDS,H,ground}=await import('../game/engine.ts');
const {adultIdentity,adultFrameChoice,idlePoseChoice}=await import('../game/adult-animation.ts');
const {specialistSprite}=await import('../game/adult-specialists.ts');
const {render}=await import('../game/render.ts');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),'greyline-v163-idle-'));
const choices=[['actions20',0],['actions20',1],['actions20',2],['actions20',3],['actions20',12],['actions20',13],['actions20',8],['actions20',9]];
const sheet=createCanvas(8*196,4*230),c=sheet.getContext('2d');c.imageSmoothingEnabled=false;
c.fillStyle='#a2aaa4';c.fillRect(0,0,sheet.width,sheet.height);const report=[];
for(const [row,[id,adult]]of Object.entries(art.adults).entries())for(const [col,[group,index]]of choices.entries()){
  const f=adult[group][index],d=f.getContext('2d').getImageData(0,0,f.width,f.height).data;
  let top=f.height,bottom=-1,left=f.width,right=-1;
  for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++)if(d[(y*f.width+x)*4+3]>=160){top=Math.min(top,y);bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);}
  const metric={id,group,index,top,bottom,left,right,height:bottom-top+1};report.push(metric);
  c.drawImage(f,col*196,row*230,192,192);c.fillStyle='#172824';c.font='14px monospace';
  c.fillText(`${id}/${group}/${index}`,col*196+2,row*230+209);c.fillText(`h${metric.height} y${top}-${bottom}`,col*196+2,row*230+226);
}
writeFileSync(join(out,'legacy-poses.png'),sheet.toBuffer('image/png'));
const frames=createCanvas(1280,H),ctx=frames.getContext('2d');let draws=[];
const original=ctx.drawImage.bind(ctx);ctx.drawImage=(...args)=>{draws.push(args[0]);return original(...args);};
const ids=['infantry','marines','armed_police','militia','scouts','sniper_team'];
let rendered=0,bodyChecks=0;const used=new Set(),heights=new Set();
const cycleSheet=createCanvas(8*160,2*160),cc=cycleSheet.getContext('2d');cc.imageSmoothingEnabled=false;
cc.fillStyle='#a2aaa4';cc.fillRect(0,0,cycleSheet.width,cycleSheet.height);
for(const dir of [1,-1]){
 const s=createGame(163);startGame(s);s.aiIn=1e9;s.units=[];s.weather.disabled=true;s.night=false;
 for(const [i,id]of ids.entries()){
   const n=s.units.length,x=1200+i*145;spawnUnit(s,0,id,x);s.units.splice(n+1);
   Object.assign(s.units[n],{x,y:ground(s,x),lane:0,member:id==='sniper_team'?1:0,
    pose:'prone',poseAnimSeen:'prone',poseAnimFrom:undefined,poseAnimAt:undefined,moving:false,
    motion:'ground',fire:0,flash:0,secondaryFire:0,suppression:0,aimUntil:0,reloadingUntil:0,
    tending:false,digging:false,fragThrow:0,facing:dir});
 }
 refreshVision(s);
 for(let i=0;i<360;i++){
   s.time=i/30;const before=JSON.stringify(s.units);draws=[];
   render(ctx,s,art,null,null,true,1000,1280);rendered++;
   assert.equal(JSON.stringify(s.units),before);
   for(const u of s.units){
     const adult=art.adults[adultIdentity(u.id)],base=adultFrameChoice(u,s.time);
     const specialist=specialistSprite(adult[base.group][base.index],base,u,art.adultSpecialists,art.weaponStances);
     const f=specialist?base:idlePoseChoice(u,s.time)??base,frame=specialist?.image??adult[f.group][f.index];
     assert(draws.includes(uniformFrame(frame,CARDS[u.id].uniform)),`${u.id} expected ${f.group}/${f.index}`);
     bodyChecks++;used.add(`${f.group}/${f.index}`);
     const d=frame.getContext('2d').getImageData(0,0,frame.width,frame.height).data;
     let top=frame.height,bottom=-1;
     for(let y=0;y<frame.height;y++)for(let x=0;x<frame.width;x++)if(d[(y*frame.width+x)*4+3]>=160){top=Math.min(top,y);bottom=Math.max(bottom,y);}
     heights.add(bottom-top+1);
   }
   if(i%30===0&&i<240){
     const col=i/30,row=dir===1?0:1,u=s.units[0];
     cc.drawImage(frames,u.x-1000-48,u.y-50,96,68,col*160,row*160,160,114);
     cc.fillStyle='#172824';cc.font='15px monospace';cc.fillText(`facing${dir} t${s.time}`,col*160+5,row*160+145);
   }
   if(i===240)writeFileSync(join(out,`battle-facing${dir}.png`),frames.toBuffer('image/png'));
 }
}
writeFileSync(join(out,'idle-cycle.png'),cycleSheet.toBuffer('image/png'));
const result={out,legacy:report,rendered,bodyChecks,used:[...used],heights:[...heights]};
writeFileSync(join(out,'report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
