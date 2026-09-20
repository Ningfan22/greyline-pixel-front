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
const {adultFrameChoice,adultIdentity}=await import('../game/adult-animation.ts');
const {specialistSprite}=await import('../game/adult-specialists.ts');
const {createGame,startGame,spawnUnit,setOrder,tick,ground,refreshVision,CARDS,H}=await import('../game/engine.ts');
const {render}=await import('../game/render.ts');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),`greyline-v167-crawl-${process.argv[2]??'review'}-`));
const ids=['infantry','marines','armed_police','militia','rocket','sniper','lmg_team','medic_team'];
const sheet=createCanvas(8*180,ids.length*146),c=sheet.getContext('2d');
c.fillStyle='#a2aaa4';c.fillRect(0,0,sheet.width,sheet.height);c.imageSmoothingEnabled=false;
const metrics=[];
function frame(u,time){const adult=art.adults[adultIdentity(u.id)],choice=adultFrameChoice(u,time);
  return {choice,image:specialistSprite(adult[choice.group][choice.index],choice,u,art.adultSpecialists,art.weaponStances)?.image??adult[choice.group][choice.index]};}
function height(f){const d=f.getContext('2d').getImageData(0,0,f.width,f.height).data;let top=f.height,bottom=-1;
  for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++)if(d[(y*f.width+x)*4+3]>=160){top=Math.min(top,y);bottom=Math.max(bottom,y);}
  return {top,bottom,height:bottom-top+1};}
const battle=createGame(167);startGame(battle);battle.units=[];battle.aiIn=1e9;battle.night=false;battle.weather.disabled=true;
for(const [row,id]of ids.entries()){
  const x=700+row*115,n=battle.units.length;spawnUnit(battle,0,id,x,{member:0});battle.units.splice(n+1);
  const u=battle.units[n];Object.assign(u,{x,y:ground(battle,x),lane:0,pose:'prone',poseAnimSeen:'prone',poseAnimFrom:undefined,poseAnimAt:undefined,
    stanceLockUntil:1e9,motion:'ground',moving:true,tactic:'prone',decisionIn:1e9,fragLeft:0,readyAt:-100,fire:0,flash:0,secondaryFire:0,aimUntil:0});
  const heights=[];
  for(let col=0;col<8;col++){
    u.walk=col*2;const f=frame(u,10);heights.push(height(f.image));
    c.save();c.translate(col*180+90,row*146+118);c.scale(col<4?1.8:-1.8,1.8);
    c.drawImage(uniformFrame(f.image,CARDS[id].uniform),-f.image.width/2,-96);c.restore();
    c.fillStyle='#172824';c.font='12px monospace';c.fillText(`${id} ${f.choice.group}/${f.choice.index}`,col*180+3,row*146+140);
  }
  metrics.push({id,heights,range:Math.max(...heights.map(h=>h.height))-Math.min(...heights.map(h=>h.height))});
}
writeFileSync(join(out,'crawl-cycle.png'),sheet.toBuffer('image/png'));
setOrder(battle,0,'prone');refreshVision(battle);
const canvas=createCanvas(1280,H),ctx=canvas.getContext('2d');let draws=[];
const original=ctx.drawImage.bind(ctx);ctx.drawImage=(...args)=>{draws.push(args[0]);return original(...args);};
let rendered=0,movingChecks=0;const used=new Set();
for(let i=0;i<420;i++){
  tick(battle,1/60);const before=JSON.stringify(battle.units);draws=[];
  render(ctx,battle,art,null,null,true,500,1280);rendered++;
  assert.equal(JSON.stringify(battle.units),before,'drawing cannot restart gait/posture clocks');
  for(const u of battle.units)if(u.hp>0&&!u.wounded&&!u.surrendered&&u.moving&&u.pose==='prone'&&!u.poseAnimProgress){
    const f=frame(u,battle.time);assert(draws.includes(uniformFrame(f.image,CARDS[u.id].uniform)),`${u.id}: production draw must use selected crawl`);
    used.add(`${u.id}/${f.choice.group}/${f.choice.index}`);movingChecks++;
  }
  if([5,75,145,280,419].includes(i))writeFileSync(join(out,`battle-${i}.png`),canvas.toBuffer('image/png'));
}
assert(movingChecks>500);
const report={out,metrics,rendered,movingChecks,used:[...used],limitations:'Two existing authored crawl cels, not a new high-frame-count cycle. Start/stop and weapon work are separate drills.'};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
