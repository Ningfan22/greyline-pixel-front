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
const {specialistSprite}=await import('../game/adult-specialists.ts');
const {adultFrameChoice,adultIdentity}=await import('../game/adult-animation.ts');
const {grenadeLauncherFrame}=await import('../game/grenade-launcher-art.ts');
const {stanceTransitionDuration}=await import('../game/infantry-action-timing.ts');
const {createGame,startGame,spawnUnit,tick,setOrder,refreshVision,CARDS,H}=await import('../game/engine.ts');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),'greyline-v152-grenadiers-'));
const canvas=createCanvas(1280,H),ctx=canvas.getContext('2d'),draw=ctx.drawImage.bind(ctx);
let drawn=[],rendered=0;ctx.drawImage=(...args)=>{drawn.push(args[0]);return draw(...args);};
const bodyBounds=im=>{
  const d=im.getContext('2d').getImageData(0,0,im.width,im.height).data;
  let l=128,r=-1,t=96,b=-1;
  for(let p=0;p<d.length;p+=4)if(d[p+3]>64){const x=p/4%128,y=Math.floor(p/4/128);l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
  return {l,r,t,b,height:b-t+1};
};
const plate=createCanvas(1536,832),pc=plate.getContext('2d');
pc.fillStyle='#647066';pc.fillRect(0,0,plate.width,plate.height);pc.imageSmoothingEnabled=false;
const all=[...art.grenadeLauncher,...art.weaponStances.grenade.stance16],bounds=[];
for(const [i,f]of all.entries()){
  const b=bodyBounds(f.image);assert(b.l>1&&b.r<126&&b.b>=94,`body ${i} ${JSON.stringify(b)}`);bounds.push(b);
  const x=i%8*192,y=Math.floor(i/8)*208;
  pc.drawImage(f.image,x,y,192,144);pc.fillStyle='#fff0c6';pc.font='14px monospace';
  pc.fillText(`${i<16?'cycle':'stance'} ${i%16} H${b.height}`,x+4,y+165);
}
for(let i=17;i<32;i++)assert(Math.abs(bounds[i].height-bounds[i-1].height)<=7,`height step ${i}`);
writeFileSync(join(out,'authored-cels.png'),plate.toBuffer('image/png'));
function arena(side,pose){
  const s=createGame(152);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.knownTerrain[0].fill(374);s.knownScenery[0]={};s.knownWalls[0]={};
  s.weather.disabled=true;s.night=false;const x=side?2400:1000,dir=side?-1:1;
  spawnUnit(s,side,'grenadiers',x,{member:0});const u=s.units.at(-1);
  spawnUnit(s,1-side,'infantry',x+dir*300,{member:0});const enemy=s.units.at(-1);
  for(const [v,vx]of [[u,x],[enemy,x+dir*300]])Object.assign(v,{x:vx,y:374,lane:0,
    hp:10000,maxHp:10000,shots:0,cooldown:v===u?0:10000,pose,poseAnimSeen:pose==='idle'?'stand':pose,
    motion:'ground',moving:false,crouchTravel:0,stanceLockUntil:100,stillFor:5,decisionIn:1000,
    tactic:pose==='prone'?'prone':'crouch',readyAt:-100,fragLeft:0,aimUntil:0,cover:0,coverGoal:null,firingGoal:null,
    suppression:0,personalMorale:96});
  setOrder(s,0,'hold');setOrder(s,1,'hold');refreshVision(s);return{s,u,enemy,x};
}
function frame(s,u,x,expected){
  s.sight[0].fill(true);s.visible[0]=s.units.map(v=>v.uid);const before=JSON.stringify(s.units);
  drawn=[];render(ctx,s,art,null,null,true,x-600,1280);rendered++;
  assert.equal(JSON.stringify(s.units),before);assert(drawn.includes(uniformFrame(expected,CARDS[u.id].uniform)));
}
const cycles=[];
for(const side of [0,1])for(const pose of ['idle','crouch']){
  const {s,u,enemy,x}=arena(side,pose),seen=new Set();let fired=false;
  for(let i=0;i<170;i++){
    tick(s,1/60);if(u.shots>=1&&!fired){fired=true;u.cooldown=10000;} // isolate one actual discharge
    const cel=grenadeLauncherFrame(u,s.time);assert(cel!==null,JSON.stringify({side,pose,current:u.pose,step:u.crouchTravel}));
    frame(s,u,x,art.grenadeLauncher[cel].image);
    if(!seen.has(cel)){seen.add(cel);writeFileSync(join(out,`${side}-${pose}-cycle-${cel}.png`),canvas.toBuffer('image/png'));}
  }
  assert.equal(seen.size,8);cycles.push({side,pose,seen:[...seen],shots:u.shots});
}
let transitions=0;
for(const side of [0,1]){
  const {s,u,x}=arena(side,'prone');let shots=0;
  for(let i=0;i<160;i++){
    tick(s,1/60);shots=u.shots;
    const choice=adultFrameChoice(u,s.time),f=specialistSprite(
      art.adults[adultIdentity(u.id)][choice.group][choice.index],choice,u,art.adultSpecialists,art.weaponStances);
    assert.equal(f.image,art.weaponStances.grenade.prone.image);
    frame(s,u,x,f.image);
  }
  assert(shots>0);writeFileSync(join(out,`${side}-prone-aim.png`),canvas.toBuffer('image/png'));
}
for(const side of [0,1])for(const [from,to]of [['stand','crouch'],['crouch','prone'],['stand','prone'],['prone','stand'],['prone','crouch'],['crouch','stand']]){
  const {s,u,x}=arena(side,to==='stand'?'idle':to);
  Object.assign(u,{poseAnimFrom:from,poseAnimSeen:to,poseAnimAt:10,launcherCycleRemaining:1,launcherCycleDuration:2.4});
  const duration=stanceTransitionDuration(u),seen=new Set();
  for(let i=0;i<60;i++){
    s.time=10+duration*i/60;const choice=adultFrameChoice(u,s.time);assert.equal(choice.group,'stance16');
    const f=specialistSprite(art.adults[adultIdentity(u.id)][choice.group][choice.index],choice,u,art.adultSpecialists,art.weaponStances);
    assert.equal(f.image,art.weaponStances.grenade.stance16[choice.index].image);
    assert.equal(grenadeLauncherFrame(u,s.time),null);frame(s,u,x,f.image);seen.add(choice.index);
  }
  assert(seen.size>=8);transitions++;
}
const report={out,rendered,cycles,transitions,bounds,limitations:'Prone uses complete aim/stance cels, not the rejected below-ground loading sequence. No browser/FPS claim.'};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
