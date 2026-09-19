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
const {GRENADE_THROW_S,GRENADE_RELEASE_S}=await import('../game/infantry-action-timing.ts');
const {createGame,startGame,spawnUnit,tick,setOrder,refreshVision,CARDS,H}=await import('../game/engine.ts');
const {LOW_GRENADE_RELEASE_HAND}=await import('../game/grenade-geometry.ts');
const {projectileForRender,infantryDepth}=await import('../game/render-depth.ts');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),'greyline-v149-grenade-'));
const bounds=im=>{
  const d=im.getContext('2d').getImageData(0,0,im.width,im.height).data;
  let left=128,right=-1,top=96,bottom=-1;
  for(let p=0;p<d.length;p+=4)if(d[p+3]>=128){const x=p/4%128,y=Math.floor(p/4/128);
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  return{left,right,top,bottom,height:bottom-top+1};
};
const anatomy=[];
for(let row=0;row<2;row++) {
  const plate=createCanvas(1536,1152),ctx=plate.getContext('2d');ctx.fillStyle='#718178';ctx.fillRect(0,0,1536,1152);
  ctx.imageSmoothingEnabled=false;
  for(let i=0;i<16;i++){
    const f=art.adults.infantry.lowGrenade32[row*16+i],b=bounds(f);anatomy.push(b);
    assert(b.bottom>=94&&b.bottom<=95);assert(b.left>0&&b.right<127);
    ctx.drawImage(f,i%4*384,Math.floor(i/4)*288,384,288);
    ctx.fillStyle='#fff0c8';ctx.font='16px monospace';ctx.fillText(`${i} ${i<10?'held':'empty'} h${b.height}`,i%4*384+6,Math.floor(i/4)*288+20);
  }
  writeFileSync(join(out,`${row?'prone':'kneeling'}-cels.png`),plate.toBuffer('image/png'));
}
const canvas=createCanvas(1280,H),ctx=canvas.getContext('2d'),draw=ctx.drawImage.bind(ctx);
let drawn=[],rendered=0,verified=0;ctx.drawImage=(...args)=>{drawn.push(args[0]);return draw(...args);};
for(const side of [0,1])for(const pose of ['crouch','hunker','prone']) {
  const s=createGame(149);startGame(s);s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.knownTerrain[0].fill(374);s.knownScenery[0]={};s.knownWalls[0]={};
  s.weather.disabled=true;s.night=false;s.sight[0].fill(true);
  for(const [j,id]of ['assault_grenadiers','marines','commandos','sapper_assault'].entries()){
    const n=s.units.length;spawnUnit(s,side,id,500+j*240);s.units.splice(n+1);const u=s.units[n];
    Object.assign(u,{x:500+j*240,y:374,lane:0,pose,poseAnimFrom:undefined,poseAnimSeen:pose==='prone'?'prone':'crouch',
      poseAnimAt:undefined,crouchTravel:0,moving:false,motion:'ground',climbing:0,fire:0,secondaryFire:0,
      flash:0,fragThrow:GRENADE_THROW_S,fragThrowStartedAt:10,aimUntil:0,readyAt:-100,cover:0,rappelling:false,parachuting:false});
  }
  s.visible[0]=s.units.map(u=>u.uid);
  for(let i=0;i<66;i++) {
    s.time=10+i/60;for(const u of s.units)u.fragThrow=GRENADE_THROW_S-i/60;
    drawn=[];render(ctx,s,art,null,null,true,300,1280);rendered++;
    for(const u of s.units){const f=adultFrameChoice(u,s.time);assert.equal(f.group,'lowGrenade32');
      assert.equal(f.index%16>=10,i/60+1e-9>=GRENADE_RELEASE_S);
      assert(drawn.includes(uniformFrame(art.adults[adultIdentity(u.id)][f.group][f.index],CARDS[u.id].uniform)));verified++;
    }
    if([0,40,42,65].includes(i))writeFileSync(join(out,`${side}-${pose}-${i}.png`),canvas.toBuffer('image/png'));
  }
}
let launches=0;
for(const side of [0,1])for(const pose of ['crouch','prone']) {
  const s=createGame(149);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.knownTerrain[0].fill(374);s.knownScenery[0]={};s.knownWalls[0]={};
  s.weather.disabled=true;s.night=false;
  const one=(team,id,x)=>{const n=s.units.length;spawnUnit(s,team,id,x);s.units.splice(n+1);const u=s.units[n];
    Object.assign(u,{x,y:374,lane:16,pose:team===side?pose:'idle',poseAnimFrom:undefined,poseAnimAt:undefined,
      poseAnimSeen:team===side?pose:'stand',crouchTravel:0,stanceLockUntil:100,decisionIn:1e6,tactic:'advance',
      hp:1000,maxHp:1000,cooldown:100,readyAt:-100,fragThrow:0,moving:false,motion:'ground',climbing:0,
      fire:0,secondaryFire:0,flash:0,aimUntil:0});return u;};
  const u=one(side,'assault_grenadiers',1800),dir=side?-1:1;
  one(1-side,'infantry',u.x+dir*170);one(1-side,'infantry',u.x+dir*190);
  setOrder(s,0,'hold');setOrder(s,1,'hold');refreshVision(s);
  let released=false;
  for(let i=0;i<70;i++){
    tick(s,1/60);s.sight[0].fill(true);s.visible[0]=s.units.map(u=>u.uid);
    drawn=[];render(ctx,s,art,null,null,true,1400,1280);rendered++;
    const p=s.projectiles.find(p=>p.sourceUid===u.uid&&p.ammunition==='grenade');
    if(p&&!released){
      released=true;launches++;
      const f=adultFrameChoice(u,s.time);assert.equal(f.index%16,10);
      const hand=LOW_GRENADE_RELEASE_HAND[pose],view=projectileForRender(s,p);
      assert.equal(view.startX,u.x+dir*(hand.x-64));
      assert.equal(view.startY,u.y+3+infantryDepth(u.lane)+hand.y-96);
      writeFileSync(join(out,`actual-release-${side}-${pose}.png`),canvas.toBuffer('image/png'));
    }
  }
  assert(released);
}
writeFileSync(join(out,'report.json'),JSON.stringify({rendered,verified,launches,anatomy},null,2));
console.log(JSON.stringify({out,rendered,verified,launches,anatomy}));
