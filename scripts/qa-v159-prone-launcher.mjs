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
const {render}=await import('../game/render.ts');
const {grenadeLauncherFrame}=await import('../game/grenade-launcher-art.ts');
const {createGame,startGame,spawnUnit,tick,setOrder,refreshVision,CARDS,H}=await import('../game/engine.ts');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),'greyline-v159-prone-launcher-'));
assert.equal(art.grenadeLauncher.length,24);
const canvas=createCanvas(1280,H),ctx=canvas.getContext('2d'),draw=ctx.drawImage.bind(ctx);
let drawn=[],rendered=0;ctx.drawImage=(...args)=>{drawn.push(args[0]);return draw(...args);};
const plate=createCanvas(1024,768),pc=plate.getContext('2d');
pc.fillStyle='#68766b';pc.fillRect(0,0,plate.width,plate.height);pc.imageSmoothingEnabled=false;
const bounds=[];
for(let i=16;i<24;i++){
  const im=art.grenadeLauncher[i].image,d=im.getContext('2d').getImageData(0,0,128,96).data;
  let l=128,r=-1,t=96,b=-1;
  for(let p=0;p<d.length;p+=4)if(d[p+3]>64){const x=p/4%128,y=Math.floor(p/4/128);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
  bounds.push({l,r,t,b});assert(l>1&&r<126&&b===95&&t>62,`${i} ${JSON.stringify(bounds.at(-1))}`);
  const x=(i-16)%4*256,y=Math.floor((i-16)/4)*192;pc.drawImage(im,x,y,256,192);
  pc.fillStyle='#fff0c6';pc.font='14px monospace';pc.fillText(`cel ${i-16}`,x+8,y+30);
}
for(let i=8;i<16;i++){
  const x=(i-8)%4*256,y=384+Math.floor((i-8)/4)*192;
  pc.drawImage(art.weaponStances.grenade.stance16[i].image,x,y,256,192);
  pc.fillStyle='#fff0c6';pc.fillText(`lowering ${i}`,x+8,y+30);
}
writeFileSync(join(out,'prone-cels.png'),plate.toBuffer('image/png'));
const cycles=[];
for(const side of [0,1])for(const pose of ['idle','crouch','prone']){
  const s=createGame(159);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.weather.disabled=true;s.night=false;
  const x=side?2400:1000,dir=side?-1:1;
  spawnUnit(s,side,'grenadiers',x,{member:0});const u=s.units.at(-1);
  spawnUnit(s,1-side,'infantry',x+dir*300,{member:0});const foe=s.units.at(-1);
  for(const [v,vx]of [[u,x],[foe,x+dir*300]])Object.assign(v,{x:vx,y:374,lane:0,
    hp:10000,maxHp:10000,cooldown:v===u?0:10000,decisionIn:1000,tactic:pose==='prone'?'prone':'crouch',
    pose,poseAnimSeen:pose==='idle'?'stand':pose,stanceLockUntil:100,moving:false,motion:'ground',
    stillFor:5,readyAt:-100,fragLeft:0,aimUntil:0,cover:0,coverGoal:null,firingGoal:null,
    personalMorale:96,suppression:0,shots:0});
  setOrder(s,0,'hold');setOrder(s,1,'hold');refreshVision(s);
  const seen=new Set();let fired=false;
  for(let i=0;i<190;i++){
    tick(s,1/60);if(u.shots&&!fired){fired=true;u.cooldown=10000;}
    const cel=grenadeLauncherFrame(u,s.time);assert(cel!==null);assert.equal(u.pose,pose);
    const before=JSON.stringify(s.units);drawn=[];
    render(ctx,s,art,null,null,true,x-600,1280);rendered++;
    assert.equal(JSON.stringify(s.units),before);
    assert(drawn.includes(uniformFrame(art.grenadeLauncher[cel].image,CARDS[u.id].uniform)));
    if(!seen.has(cel)&&pose==='prone')writeFileSync(join(out,`${side}-prone-${cel}.png`),canvas.toBuffer('image/png'));
    seen.add(cel);
  }
  assert.equal(seen.size,8);assert.equal(u.shots,1);assert.equal(u.launcherCycleRemaining,0);
  cycles.push({side,pose,seen:[...seen],shots:u.shots});
}
const report={out,rendered,bounds,cycles,browserQA:false};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
