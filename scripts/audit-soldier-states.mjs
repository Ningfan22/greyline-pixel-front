/** Captures the image ACTUALLY submitted by render(), not an expected selector.
 * Run with the project's TS loader and NODE_PATH pointing to @napi-rs/canvas.
 * Every member of every soldier card is included, including rifle escorts.
 */
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
const {loadArt}=await import('../game/art.ts');
const {render}=await import('../game/render.ts');
const {createGame,startGame,spawnUnit,refreshVision,CARDS,H}=await import('../game/engine.ts');
const {weaponModel}=await import('../game/cards.ts');
const {soldierPose}=await import('../game/soldier-pose.ts');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),'greyline-soldier-audit-'));
const screen=createCanvas(960,H),ctx=screen.getContext('2d'),draw=ctx.drawImage.bind(ctx);
let captured;
ctx.drawImage=(...args)=>{
  if(args.length===5&&args[0]?.width===128&&args[0]?.height===128&&args[2]===-128&&args[4]===128&&args[3]===128)captured=args[0];
  return draw(...args);
};
const cases=[
  ['idle',{}], ['aim',{aimUntil:100}], ['fire',{aimUntil:100,fire:.15}],
  ...Array.from({length:8},(_,i)=>[`walk-${i}`,{pose:'walk',moving:true,walk:i,aimUntil:100}]),
  ['run',{pose:'run',moving:true,walk:3}], ['crouch',{pose:'crouch'}],
  ['crouch-walk',{pose:'crouch',moving:true,crouchTravel:1,walk:3}],
  ['prone',{pose:'prone'}],['crawl',{pose:'prone',moving:true,proneTravel:1,walk:3}],
  ['lower-half',{pose:'crouch',poseAnimAt:19.4,poseAnimFrom:'stand',poseAnimSeen:'crouch',poseAnimProgress:.5}],
  ...['idle','crouch','prone'].map(p=>['reload-'+p,{pose:p,ammo:0,reloadingStartAt:19.3,reloadingUntil:20.7}]),
  ['moving-reload',{pose:'walk',moving:true,walk:4,ammo:0,reloadingStartAt:19.3,reloadingUntil:20.7}],
  ['throw',{fragThrow:.6,fragThrowStartedAt:19.5}],
  ['medical',{pose:'crouch',tending:true,tendingKind:'medical',tendingTime:1.2}],
  ['repair',{pose:'crouch',tending:true,tendingKind:'repair',tendingTime:1.2}],
  ['dig',{pose:'crouch',digging:true,digElapsed:2}],
  ['drag',{pose:'walk',moving:true,walk:2,draggingUid:999}],
  ['share',{ammoShareUntil:21}], ['scavenge',{scavengeUntil:21}],
  ['signal',{ammoSignalUntil:21}], ['point',{pointUntil:21,pointDir:-1}],
  ['observe',{observingUntil:21}],['deploy',{pose:'crouch',emplacementSetupUntil:21}],
  ['barrel',{pose:'crouch',overheatedUntil:21}],
  ['cycle',{shots:1,lastCombatShotAt:19.7,cooldown:.5}],
  ['alert',{blastGlanceUntil:20.5,blastGlanceDir:-1}],
  ['parachute',{parachuting:true}], ['vault',{climbing:1}],
  ['rappel',{rappelling:true,walk:1}], ['jump',{motion:'jump',motionTime:.2}],
  ['wounded',{wounded:true,woundedTime:1}], ['surrender',{surrendered:true,surrenderTime:1}],
];
function bounds(frame){
  const d=frame.getContext('2d').getImageData(0,0,frame.width,frame.height).data;
  let left=frame.width,right=-1,top=frame.height,bottom=-1,soft=0,pixels=0;
  for(let y=0;y<frame.height;y++)for(let x=0;x<frame.width;x++){
    const a=d[(y*frame.width+x)*4+3];if(a>0&&a<255)soft++;
    if(a<128)continue;pixels++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
  }
  return {left,right,top,bottom,width:right-left+1,height:bottom-top+1,pixels,soft};
}
const inventory=[],images=new Map();
for(const [id,card] of Object.entries(CARDS).filter(([,c])=>c.members)){
  const s=createGame(178);startGame(s);s.scenery=[];s.walls=[];s.units=[];s.weather.disabled=true;s.time=20;
  spawnUnit(s,0,id,900);const members=[...s.units];
  for(const u of members){
    s.units=[u];Object.assign(u,{x:900,hp:100,moving:false,motion:'ground',pose:'idle',climbing:0,
      aimUntil:0,readyAt:-100,poseAnimAt:undefined,poseAnimProgress:undefined,fire:0,flash:0,
      crouchTravel:0,proneTravel:0,rappelling:false,parachuting:false});
    refreshVision(s);const base={...u},frames=[];
    for(const [name,patch] of cases){
      Object.keys(u).forEach(k=>delete u[k]);Object.assign(u,base,patch);captured=null;
      const before=JSON.stringify(u);render(ctx,s,art,null,null,true,500,960);
      if(JSON.stringify(u)!==before)throw new Error('Renderer mutated '+id+'/'+u.member);
      if(!captured)throw new Error('No actual body draw '+id+'/'+u.member+'/'+name);
      frames.push({name,action:soldierPose(u,s.time).action,...bounds(captured)});
      images.set(id+'/'+u.member+'/'+name,captured);
    }
    inventory.push({id,member:u.member,weapon:weaponModel(u),uniform:card.uniform??'infantry',frames});
  }
}
const ids=Object.entries(CARDS).filter(([,c])=>c.members).map(([id])=>id);
// Every mixed-crew member gets a plate: do not hide escorts behind member zero.
for(const {id,member} of inventory){
  const columns=8,cellW=256,cellH=280,rows=Math.ceil(cases.length/columns);
  const plate=createCanvas(columns*cellW,rows*cellH+36),p=plate.getContext('2d');
  p.fillStyle='#acb4ab';p.fillRect(0,0,plate.width,plate.height);p.imageSmoothingEnabled=false;
  p.font='18px monospace';p.fillStyle='#19271c';p.fillText(id+' / member '+member,12,24);
  cases.forEach(([name],i)=>{const f=images.get(id+'/'+member+'/'+name),x=i%columns*cellW,y=36+Math.floor(i/columns)*cellH;
    p.drawImage(f,x+(cellW-f.width*2)/2,y,f.width*2,f.height*2);
    p.fillStyle='#19271c';p.font='13px monospace';p.fillText(name,x+5,y+272);
  });
  writeFileSync(join(out,id+'-'+member+'.png'),plate.toBuffer('image/png'));
}
const report={cards:ids.length,members:inventory.length,rendered:inventory.length*cases.length,cases:cases.map(([n])=>n),inventory};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({out,cards:report.cards,members:report.members,rendered:report.rendered}));
