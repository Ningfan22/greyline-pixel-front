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
const {createGame,startGame,spawnUnit,tick,setOrder,ground,CARDS,H}=await import('../game/engine.ts');
const {setSquadOrder}=await import('../game/squad-orders.ts');
const {adultFrameChoice}=await import('../game/adult-animation.ts');
const {stanceHeightClass}=await import('../game/infantry-action-timing.ts');
const {digWorkSettled}=await import('../game/support-work.ts');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),'greyline-v156-ground-work-'));
const canvas=createCanvas(800,H),ctx=canvas.getContext('2d');
let draws=[];const original=ctx.drawImage.bind(ctx);ctx.drawImage=(...args)=>{draws.push(args[0]);return original(...args);};
let frames=0,bankChecks=0,digChecks=0;const captures=[];
function world(){const s=createGame(156);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.night=false;s.weather.disabled=true;s.terrain.fill(374);s.original.fill(374);return s;}
function paint(s){s.sight[0].fill(true);s.visible[0]=s.units.map(u=>u.uid);s.knownTerrain[0]=s.terrain.slice();
  draws=[];render(ctx,s,art,null,null,true,500,800);frames++;}
function save(name){writeFileSync(join(out,name+'.png'),canvas.toBuffer('image/png'));captures.push(name);}
const plate=createCanvas(5*240,6*180),pc=plate.getContext('2d');pc.fillStyle='#202924';pc.fillRect(0,0,plate.width,plate.height);
pc.imageSmoothingEnabled=false;
for(const side of [0,1])for(const [row,pose]of ['idle','crouch','prone'].entries()){
  const s=world();for(let x=860;x<=940;x++)s.terrain[x]=374+Math.min(44,(x-860)*2.2,(940-x)*2.2);
  spawnUnit(s,side,'infantry',900);s.units=[s.units[0]];const u=s.units[0];
  Object.assign(u,{x:900,y:ground(s,900),lane:0,pace:1,pose,poseAnimSeen:stanceHeightClass(pose),
    decisionIn:1000,tactic:pose==='idle'?'advance':pose,crouchTravel:pose==='crouch'?1:undefined,walk:0,fragLeft:0});
  setOrder(s,side,pose==='idle'?'advance':pose);let bankFrame=0;
  for(let i=0;i<300;i++){
    tick(s,1/60);if(u.motion==='bank'){
      paint(s);const f=adultFrameChoice(u,s.time),image=uniformFrame(art.adults.infantry[f.group][f.index],CARDS[u.id].uniform);
      assert(draws.includes(image));assert.equal(stanceHeightClass(u.pose),stanceHeightClass(pose));
      assert(Math.abs(u.y-ground(s,u.x))<1e-6);bankChecks++;
      if(bankFrame%10===0&&bankFrame<=40){
        const col=bankFrame/10,y=(side*3+row)*180;pc.drawImage(canvas,u.x-500-60,u.y-78,120,84,col*240,y,240,168);
        pc.fillStyle='#e6e0c6';pc.font='12px monospace';pc.fillText(`${side}/${pose} step ${bankFrame}`,col*240+5,y+178);
      }
      bankFrame++;
    } else if(i%6===0)paint(s);
  }
  assert(bankFrame>20);save(`bank-${side}-${pose}`);
}
writeFileSync(join(out,'bank-contact-sheet.png'),plate.toBuffer('image/png'));
for(const initial of ['idle','prone']){
  const s=world();spawnUnit(s,0,'infantry',900);s.units=[s.units[0]];const u=s.units[0];
  setSquadOrder(s,0,u.squad,'hold');Object.assign(u,{x:u.squadOrderX,lane:u.holdLane,pose:initial,
    poseAnimSeen:stanceHeightClass(initial),stanceLockUntil:3,tactic:'advance',decisionIn:1000,fragLeft:0});
  for(let i=0;i<960;i++){
    tick(s,1/60);if(i%3)continue;paint(s);
    const digFrames=art.digging.infantry.dig8.map(f=>uniformFrame(f,CARDS[u.id].uniform));
    const paintedDig=draws.some(f=>digFrames.includes(f));
    assert.equal(paintedDig,!!u.digging&&digWorkSettled(u,s.time));if(paintedDig)digChecks++;
    if([60,210,300,780].includes(i))save(`dig-${initial}-${i}`);
  }
}
assert(digChecks>100);
const report={output:out,frames,bankChecks,digChecks,captures};writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
