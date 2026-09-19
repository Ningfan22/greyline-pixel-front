import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {createCanvas,Image}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
globalThis.Image=class extends Image {
  set src(value){super.src=value.startsWith('/')?fileURLToPath(new URL('../public'+value,import.meta.url)):value;}
  get src(){return super.src;}
};
const {loadArt,uniformFrame}=await import('../game/art.ts');
const {render}=await import('../game/render.ts');
const {createGame,startGame,spawnUnit,CARDS,H}=await import('../game/engine.ts');
const {adultFrameChoice,adultIdentity}=await import('../game/adult-animation.ts');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),'greyline-v143-reload-'));
const plate=createCanvas(10*160,2*190),pc=plate.getContext('2d'),bounds=[];
pc.fillStyle='#718178';pc.fillRect(0,0,plate.width,plate.height);pc.imageSmoothingEnabled=false;
for(let row=0;row<2;row++)for(let col=0;col<10;col++){
  const stable=art.adults.infantry.actions20[row?2:1];
  const f=col===0||col===9?stable:art.adults.infantry.lowReload16[row*8+col-1];
  const d=f.getContext('2d').getImageData(0,0,96,96).data,b={row,col,top:96,bottom:0,left:96,right:0};
  for(let y=0;y<96;y++)for(let x=0;x<96;x++)if(d[(y*96+x)*4+3]>=128){
    b.top=Math.min(b.top,y);b.bottom=Math.max(b.bottom,y);b.left=Math.min(b.left,x);b.right=Math.max(b.right,x);}
  assert.equal(b.bottom,95);assert(b.left>0&&b.right<95);assert(row?b.top>=76:b.top>=51);
  bounds.push(b);pc.drawImage(f,col*160,row*190,160,160);pc.fillStyle='#f9f0cd';pc.font='13px monospace';
  pc.fillText(`${col===0||col===9?'hold':col-1}: h${96-b.top}`,col*160+8,row*190+182);
}
writeFileSync(join(out,'low-reloads.png'),plate.toBuffer('image/png'));
// Draw through the production renderer with deliberately competing dig/idle flags.
const canvas=createCanvas(1280,H),ctx=canvas.getContext('2d'),draw=ctx.drawImage.bind(ctx);let drawn=[];
ctx.drawImage=(...args)=>{drawn.push(args[0]);return draw(...args);};
let checked=0,rendered=0;
for(const pose of ['idle','crouch','prone'])for(const side of [0,1]){
  const s=createGame(143);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];s.terrain.fill(374);
  s.original.fill(374);s.weather.disabled=true;
  for(const [i,id]of ['infantry','marines','armed_police','militia','scouts','sniper_team'].entries()){
    const n=s.units.length;spawnUnit(s,side,id,600+i*140);s.units.splice(n+1);
    Object.assign(s.units[n],{x:600+i*140,y:374,lane:0,pose,motion:'ground',moving:false,fire:0,flash:0,
      digging:true,aimUntil:0,stillFor:5,ammo:0,reloadingStartAt:0,reloadingUntil:2.5,
      ammoShareUntil:3,scavengeUntil:3});
  }
  // This is an omniscient art fixture, not an enemy-observation test.
  s.visible[0]=s.units.map(u=>u.uid);s.sight[0].fill(true);
  s.knownTerrain[0].fill(374);s.knownScenery[0]={};
  for(let i=0;i<150;i++){
    s.time=(i+.01)/60;drawn=[];render(ctx,s,art,null,null,true,350,1280);rendered++;
    for(const u of s.units){const f=adultFrameChoice(u,s.time);
      assert.equal(f.group,pose==='idle'?'reload8':'lowReload16');
      assert(drawn.includes(uniformFrame(art.adults[adultIdentity(u.id)][f.group][f.index],CARDS[u.id].uniform)),
        `${u.id}/${side}/${pose}/${f.index}: reload hidden by overlay`);checked++;
    }
    if([0,74,149].includes(i))writeFileSync(join(out,`${pose}-${side}-${i}.png`),canvas.toBuffer('image/png'));
  }
}
// Expose the remaining legacy gait-height difference; do not hide it in a pass assertion.
const gaitHeights=art.adults.infantry.crouch8.map(f=>{
  const d=f.getContext('2d').getImageData(0,0,96,96).data;let top=96;
  for(let i=0;i<d.length;i+=4)if(d[i+3]>=128)top=Math.min(top,Math.floor(i/4/96));return 96-top;
});
const report={output:out,rendered,checked,bounds,remainingCrouchGaitHeights:gaitHeights};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
