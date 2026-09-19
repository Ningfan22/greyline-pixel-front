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
const {relayReloadActive}=await import('../game/veteran-team.ts');
const {createGame,startGame,spawnUnit,tick,setOrder,refreshVision,CARDS,H}=await import('../game/engine.ts');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),'greyline-v151-veterans-'));
const canvas=createCanvas(1280,H),ctx=canvas.getContext('2d'),draw=ctx.drawImage.bind(ctx);
let drawn=[];ctx.drawImage=(...args)=>{drawn.push(args[0]);return draw(...args);};
let rendered=0;const results=[];
for(const side of [0,1])for(const pose of ['idle','crouch','prone']) {
  const s=createGame(151);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.knownTerrain[0].fill(374);s.knownScenery[0]={};s.knownWalls[0]={};
  s.weather.disabled=true;s.night=false;const x=side?2400:1000,dir=side?-1:1;
  spawnUnit(s,side,'veteran_squad',x);const squad=[...s.units];
  squad.forEach((u,i)=>Object.assign(u,{x:x-dir*i*30,y:374,lane:(i%3-1)*10,pose,
    poseAnimSeen:pose==='idle'?'stand':pose,poseAnimFrom:undefined,poseAnimAt:undefined,
    crouchTravel:0,stanceLockUntil:100,motion:'ground',moving:false,stillFor:5,readyAt:-100,
    hp:10000,maxHp:10000,shots:0,ammo:12,ammoReserve:90,cooldown:0,decisionIn:1000,tactic:pose==='prone'?'prone':'crouch',
    fragLeft:0,aimUntil:0,cover:0,coverGoal:null,firingGoal:null,personalMorale:96,suppression:0}));
  const n=s.units.length;spawnUnit(s,1-side,'infantry',x+dir*250);s.units.splice(n+1);
  Object.assign(s.units[n],{x:x+dir*250,y:374,lane:0,hp:100000,maxHp:100000,cooldown:10000,
    decisionIn:1000,pose:'crouch',poseAnimSeen:'crouch',stanceLockUntil:100,tactic:'crouch',fragLeft:0});
  setOrder(s,0,'hold');setOrder(s,1,'hold');refreshVision(s);let selected,shotsAtStart;
  const seen=new Set();let othersFired=0,previousShots=0;
  for(let i=0;i<240;i++) {
    tick(s,1/60);selected??=squad.find(u=>relayReloadActive(u,s.time));
    s.sight[0].fill(true);s.visible[0]=s.units.map(u=>u.uid);
    const before=JSON.stringify(s.units);drawn=[];render(ctx,s,art,null,null,true,x-600,1280);rendered++;
    assert.equal(JSON.stringify(s.units),before);
    if(!selected||!relayReloadActive(selected,s.time))continue;
    shotsAtStart??=selected.shots;assert.equal(selected.shots,shotsAtStart);
    const f=adultFrameChoice(selected,s.time);assert.equal(f.group,pose==='idle'?'reload8':'lowReload16');
    assert(drawn.includes(uniformFrame(art.adults[adultIdentity(selected.id)][f.group][f.index],CARDS[selected.id].uniform)));
    const shots=squad.reduce((a,u)=>a+(u===selected?0:u.shots),0);
    othersFired+=Math.max(0,shots-previousShots);previousShots=shots;
    if(!seen.has(f.index)){seen.add(f.index);writeFileSync(join(out,`${side}-${pose}-${f.index}.png`),canvas.toBuffer('image/png'));}
  }
  assert.equal(seen.size,8);assert(othersFired>0);results.push({side,pose,cels:[...seen],othersFired});
}
const report={out,rendered,results};writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
