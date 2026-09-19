import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {createCanvas,Image}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
globalThis.Image=class extends Image {
  set src(v){super.src=v.startsWith('/')?fileURLToPath(new URL('../public'+v,import.meta.url)):v;}
  get src(){return super.src;}
};
const {loadArt,uniformFrame}=await import('../game/art.ts');
const {render}=await import('../game/render.ts');
const {adultFrameChoice,adultIdentity}=await import('../game/adult-animation.ts');
const {createGame,startGame,spawnUnit,tick,setOrder,CARDS,H}=await import('../game/engine.ts');
const {repairStation,atRepairContact}=await import('../game/repair-work.ts');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),'greyline-v150-repair-'));
function bounds(im){const d=im.getContext('2d').getImageData(0,0,im.width,im.height).data;
  let left=im.width,right=-1,top=im.height,bottom=-1;
  for(let p=0;p<d.length;p+=4)if(d[p+3]>=128){const x=p/4%im.width,y=Math.floor(p/4/im.width);
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  return{left,right,top,bottom,height:bottom-top+1};}
const anatomy=[];
for(let row=0;row<3;row++){
  const plate=createCanvas(1024,576),pc=plate.getContext('2d');
  pc.fillStyle='#718178';pc.fillRect(0,0,plate.width,plate.height);pc.imageSmoothingEnabled=false;
  for(let i=0;i<(row===2?10:12);i++){
    const frame=art.adults.infantry.repair34[row*12+i],b=bounds(frame);anatomy.push(b);
    assert(b.bottom>=94&&b.bottom<=95);assert(b.left>0&&b.right<127);
    if(i)assert(Math.abs(b.height-anatomy[row*12+i-1].height)<=3);
    pc.drawImage(frame,i%4*256,Math.floor(i/4)*192,256,192);
    pc.fillStyle='#f4e4c4';pc.font='13px monospace';pc.fillText(`${row}/${i} h${b.height}`,i%4*256+4,Math.floor(i/4)*192+16);
  }
  writeFileSync(join(out,`cels-${row}.png`),plate.toBuffer('image/png'));
}
function arena(){const s=createGame(150);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.knownTerrain[0].fill(374);s.knownScenery[0]={};s.knownWalls[0]={};
  s.weather.disabled=true;s.night=false;s.sight[0].fill(true);setOrder(s,0,'hold');setOrder(s,1,'hold');return s;}
function one(s,side,id,x,extra={}){const n=s.units.length;spawnUnit(s,side,id,x);const u=s.units[n];s.units.splice(n+1);
  Object.assign(u,{x,y:374,lane:0,pose:'crouch',poseAnimFrom:undefined,poseAnimSeen:'crouch',poseAnimAt:undefined,
    crouchTravel:0,stanceLockUntil:100,moving:false,motion:'ground',climbing:0,fire:0,secondaryFire:0,flash:0,
    fragLeft:0,fragThrow:0,aimUntil:0,readyAt:-100,cover:0,rappelling:false,parachuting:false,hp:10000,maxHp:10000,
    decisionIn:1e6,tactic:'advance',squadOrder:'hold',squadOrderUntil:Infinity,cooldown:1e6,...extra});return u;}
const canvas=createCanvas(1280,H),ctx=canvas.getContext('2d'),draw=ctx.drawImage.bind(ctx);
let drawn=[];ctx.drawImage=(...args)=>{drawn.push(args[0]);return draw(...args);};
let rendered=0,verified=0;
const actual=[];
for(const side of [0,1])for(const [row,pose]of ['idle','crouch','prone'].entries()){
  const s=arena(),u=one(s,side,'combat_engineers',800,{pose,poseAnimSeen:row?'crouch':'stand'});
  const v=one(s,side,'tank',1000,{hp:1000});u.x=repairStation(u,v);u.facing=1;
  if(side){u.repairSide=1;u.x=repairStation(u,v);u.facing=-1;}
  Object.assign(u,{tending:true,tendingKind:'repair',tendingTargetUid:v.uid,digging:true});
  s.visible[0]=s.units.map(u=>u.uid);
  for(let i=0;i<144;i++){
    s.time=10+i/60;u.tendingTime=i/60;drawn=[];render(ctx,s,art,null,null,true,400,1280);rendered++;
    const f=adultFrameChoice(u,s.time);assert.equal(f.group,'repair34');assert.equal(Math.floor(f.index/12),row);
    assert(drawn.includes(uniformFrame(art.adults[adultIdentity(u.id)][f.group][f.index],CARDS[u.id].uniform)));verified++;
    if([0,35,71,107,143].includes(i))writeFileSync(join(out,`${side}-${pose}-${i}.png`),canvas.toBuffer('image/png'));
  }
}
for(const side of [0,1]){
  const s=arena(),dir=side?-1:1,u=one(s,side,'combat_engineers',1000,{stanceLockUntil:0});
  const v=one(s,side,'tank',1000+dir*240,{hp:100});let firstWork;
  for(let i=0;i<900;i++){
    tick(s,1/60);if(u.tendingKind==='repair'&&(u.tendingTime??0)>.4)firstWork??=s.time;
    if(i%12===0){s.sight[0].fill(true);s.visible[0]=s.units.map(u=>u.uid);
      render(ctx,s,art,null,null,true,400,1280);rendered++;
      if([0,120,360,720,888].includes(i))writeFileSync(join(out,`actual-${side}-${i}.png`),canvas.toBuffer('image/png'));
    }
  }
  assert(firstWork);assert(atRepairContact(u,v));assert(v.hp>100);
  actual.push({side,firstWork,position:u.x,station:repairStation(u,v),repaired:v.hp-100});
}
for(const side of [0,1]){
  const s=arena(),dir=side?-1:1;spawnUnit(s,side,'combat_engineers',1000);const squad=[...s.units];
  const v=one(s,side,'tank',1000+dir*200,{hp:100});
  for(const u of squad)Object.assign(u,{readyAt:-100,fragLeft:0,cooldown:1e6,decisionIn:1e6,
    tactic:'advance',squadOrder:'hold',squadOrderUntil:Infinity});
  for(let i=0;i<1800;i++)tick(s,1/60);
  s.sight[0].fill(true);s.visible[0]=s.units.map(u=>u.uid);drawn=[];
  render(ctx,s,art,null,null,true,400,1280);rendered++;
  const working=squad.filter(u=>u.tending);assert.equal(working.length,2);
  assert(Math.abs(working[0].x-working[1].x)>250);
  for(const u of working){const f=adultFrameChoice(u,s.time);assert.equal(f.group,'repair34');
    assert(drawn.includes(uniformFrame(art.adults[adultIdentity(u.id)][f.group][f.index],CARDS[u.id].uniform)));verified++;}
  writeFileSync(join(out,`squad-${side}.png`),canvas.toBuffer('image/png'));
  actual.push({side,squad:squad.map(u=>({x:u.x,lane:u.lane,work:u.tendingKind??null})),repaired:v.hp-100});
}
const report={out,rendered,verified,anatomy,actual};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
