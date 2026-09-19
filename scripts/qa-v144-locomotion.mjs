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
const {specialistSprite}=await import('../game/adult-specialists.ts');
const {adultFrameChoice,adultIdentity}=await import('../game/adult-animation.ts');
const {createGame,startGame,spawnUnit,tick,setOrder,CARDS,H}=await import('../game/engine.ts');
const {crouchMotionActive}=await import('../game/crouch-locomotion.ts');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),'greyline-v144-locomotion-'));
function arena(){const s=createGame(144);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.weather.disabled=true;s.knownTerrain[0].fill(374);
  s.knownScenery[0]={};s.sight[0].fill(true);return s;}
function one(s,side,id,x){const n=s.units.length;spawnUnit(s,side,id,x);s.units.splice(n+1);const u=s.units[n];
  Object.assign(u,{x,y:374,lane:0,pace:1,pose:'crouch',poseAnimSeen:'crouch',stanceLockUntil:100,
    motion:'ground',moving:false,fire:0,secondaryFire:0,flash:0,fragLeft:0,aimUntil:0,
    tactic:'crouch',decisionIn:1000,cooldown:1000,readyAt:-100});return u;}
const canvas=createCanvas(1280,H),ctx=canvas.getContext('2d'),draw=ctx.drawImage.bind(ctx);let drawn=[];
ctx.drawImage=(...args)=>{drawn.push(args[0]);return draw(...args);};
let checked=0,rendered=0;const captures=[],cycles=[];
for(const side of [0,1]){
  const s=arena();for(const [i,id]of ['infantry','marines','machinegun','javelin','mortar','heavy_mg'].entries())one(s,side,id,550+i*150);
  const trace=[],tickMs=[],drawMs=[];
  for(let i=0;i<480;i++){
    if(i===0)setOrder(s,side,'crouch');if(i===130)setOrder(s,side,'hold');if(i===320)setOrder(s,side,'crouch');
    let at=performance.now();tick(s,1/60);tickMs.push(performance.now()-at);
    // An omniscient art fixture: enemy visibility is tested in gameplay suites.
    s.visible[0]=s.units.map(u=>u.uid);s.sight[0].fill(true);drawn=[];
    at=performance.now();render(ctx,s,art,null,null,true,300,1280);drawMs.push(performance.now()-at);rendered++;
    for(const u of s.units){const f=adultFrameChoice(u,s.time);
      assert.notEqual(f.group,'signals4');
      if(crouchMotionActive(u)){assert.equal(f.group,'stance16');assert(!u.moving);
        assert(drawn.includes(uniformFrame(art.adults[adultIdentity(u.id)][f.group][f.index],CARDS[u.id].uniform)));checked++;}
    }
    const u=s.units[0],f=adultFrameChoice(u,s.time);
    trace.push({time:s.time,x:u.x,travel:u.crouchTravel,moving:u.moving,frame:`${f.group}:${f.index}`});
    if([0,20,40,100,135,210,240,280,340,390].includes(i)){
      const name=`side-${side}-${i}.png`;writeFileSync(join(out,name),canvas.toBuffer('image/png'));captures.push(name);}
  }
  const stats=xs=>{xs.sort((a,b)=>a-b);return{median:xs[xs.length>>1],p95:xs[Math.floor(xs.length*.95)]};};
  cycles.push({side,trace,tickMs:stats(tickMs),drawMs:stats(drawMs)});
}
// Exact held-travel body continuity, including specialist weapons and mortar.
const s=arena();for(const id of ['infantry','machinegun','javelin','mortar','sniper','medic']){
  const u=one(s,0,id,1000);u.crouchTravel=1;u.walk=3.4;u.moving=true;
  const f=adultFrameChoice(u,1),base=art.adults[adultIdentity(id)][f.group][f.index];
  const moving=specialistSprite(base,f,u,art.adultSpecialists)?.image??base;
  u.moving=false;const held=adultFrameChoice(u,1);
  assert.deepEqual(held,f);assert.equal(specialistSprite(base,held,u,art.adultSpecialists)?.image??base,moving);checked++;
}
// Inspect the precise authored bridge, at fixed body scale and baseline.
const plate=createCanvas(8*170,205),pc=plate.getContext('2d');pc.fillStyle='#718178';pc.fillRect(0,0,plate.width,plate.height);
pc.imageSmoothingEnabled=false;const frames=[art.adults.infantry.actions20[1],...art.adults.infantry.stance16.slice(2,8).reverse(),art.adults.infantry.crouch8[3]];
const heights=[];
for(const [i,f]of frames.entries()){
  const d=f.getContext('2d').getImageData(0,0,96,96).data;let top=96,bottom=0;
  for(let p=0;p<d.length;p+=4)if(d[p+3]>=128){top=Math.min(top,Math.floor(p/4/96));bottom=Math.max(bottom,Math.floor(p/4/96));}
  assert(bottom>=94&&bottom<=95);heights.push(96-top);if(i)assert(Math.abs(heights[i]-heights[i-1])<=6);
  pc.drawImage(f,i*170,0,170,170);pc.fillStyle='#f5ebc8';pc.font='14px monospace';pc.fillText(`${i}: h${96-top}`,i*170+12,194);
}
writeFileSync(join(out,'knee-to-travel.png'),plate.toBuffer('image/png'));
const report={output:out,rendered,checked,heights,captures,cycles};writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,cycles:cycles.map(({side,tickMs,drawMs})=>({side,tickMs,drawMs}))}));
