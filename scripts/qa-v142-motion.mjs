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
const {createGame,startGame,spawnUnit,tick,setOrder,CARDS,H}=await import('../game/engine.ts');
const {adultFrameChoice,adultIdentity}=await import('../game/adult-animation.ts');
const {stanceTransitionActive,stanceTransitionDuration}=await import('../game/infantry-action-timing.ts');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),'greyline-v142-motion-'));
const indices=[0,1,2,3,6,7,12,13];
const c=createCanvas(8*192,2*224),legacyCtx=c.getContext('2d');legacyCtx.fillStyle='#718178';legacyCtx.fillRect(0,0,c.width,c.height);
legacyCtx.imageSmoothingEnabled=false;
const bounds=[];
for(const [row,identity]of ['infantry','marines'].entries())for(const [col,index]of indices.entries()){
  const f=art.adults[identity].actions20[index],d=f.getContext('2d').getImageData(0,0,96,96).data;
  let top=96,bottom=0,left=96,right=0;
  for(let y=0;y<96;y++)for(let x=0;x<96;x++)if(d[(y*96+x)*4+3]>120){top=Math.min(top,y);bottom=Math.max(bottom,y);left=Math.min(left,x);right=Math.max(right,x);}
  legacyCtx.drawImage(f,col*192,row*224,192,192);legacyCtx.fillStyle='#eee4c5';legacyCtx.font='13px monospace';
  legacyCtx.fillText(`${identity}:${index} y${top}-${bottom}`,col*192+5,row*224+210);bounds.push({identity,index,top,bottom,left,right});
}
writeFileSync(join(out,'legacy-poses.png'),c.toBuffer('image/png'));
const plate=createCanvas(8*192,2*218),pc=plate.getContext('2d');
pc.fillStyle='#718178';pc.fillRect(0,0,plate.width,plate.height);pc.imageSmoothingEnabled=false;
const stanceBounds=[];
for(const [i,f]of art.adults.infantry.stance16.entries()){
  const d=f.getContext('2d').getImageData(0,0,96,96).data,b={left:96,top:96,right:0,bottom:0};
  for(let y=0;y<96;y++)for(let x=0;x<96;x++)if(d[(y*96+x)*4+3]>=128){b.left=Math.min(b.left,x);b.top=Math.min(b.top,y);b.right=Math.max(b.right,x);b.bottom=Math.max(b.bottom,y);}
  assert(b.bottom===95 && b.left>0 && b.right<95);stanceBounds.push(b);
  const x=(i%8)*192,y=Math.floor(i/8)*218;
  pc.drawImage(f,x,y,192,192);pc.fillStyle='#e3dfbb';pc.font='14px monospace';pc.fillText(`${i}: ${96-b.top}px`,x+10,y+207);
  pc.strokeStyle='#dde2ba';pc.beginPath();pc.moveTo(x,y+192);pc.lineTo(x+192,y+192);pc.stroke();
}
for(let i=1;i<16;i++){
  assert(stanceBounds[i].top>=stanceBounds[i-1].top,`height rises at ${i}`);
  assert(stanceBounds[i].top-stanceBounds[i-1].top<=8,`large height jump ${i}`);
}
writeFileSync(join(out,'stance-cels.png'),plate.toBuffer('image/png'));
const canvas=createCanvas(1280,H),ctx=canvas.getContext('2d'),captures=[];
const save=name=>{writeFileSync(join(out,name+'.png'),canvas.toBuffer('image/png'));captures.push(name);};
let rendered=0,checked=0;
const originalDraw=ctx.drawImage.bind(ctx);let drawn=[];
ctx.drawImage=(...args)=>{drawn.push(args[0]);return originalDraw(...args);};
for(const [from,to]of [['stand','crouch'],['stand','prone'],['crouch','stand'],['crouch','prone'],['prone','stand'],['prone','crouch']]){
  const s=createGame(142);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.weather.disabled=true;
  for(const [i,id]of ['infantry','machinegun','heavy_mg','javelin','marines','armed_police'].entries()){
    const n=s.units.length;spawnUnit(s,0,id,600+i*145);s.units.splice(n+1);
    const u=s.units[n];Object.assign(u,{x:600+i*145,y:374,lane:0,pose:to==='stand'?'idle':to,
      poseAnimFrom:from,poseAnimSeen:to,poseAnimAt:0,motion:'ground',moving:false,fire:0,flash:0,
      digging:i===0,aimUntil:100,stillFor:5,contactUntil:100});
  }
  const duration=stanceTransitionDuration(s.units[0]);
  for(let i=0;i<60*duration;i++){
    s.time=(i+.01)/60;drawn=[];
    render(ctx,s,art,null,null,true,350,1280);rendered++;
    for(const u of s.units){const f=adultFrameChoice(u,s.time);
      assert.equal(f.group,'stance16');
      assert(drawn.includes(uniformFrame(art.adults[adultIdentity(u.id)][f.group][f.index],CARDS[u.id].uniform)),`${u.id} overlay hid ${from}->${to}/${f.index}`);checked++;
    }
    if([0,Math.floor(duration*30),Math.floor(duration*60)-1].includes(i))save(`${from}-${to}-${i}`);
  }
}
// Exercise real orders, hits, reloads and shooting rather than just a selector.
const s=createGame(142);startGame(s);s.aiIn=1e9;s.units=[];s.weather.disabled=true;
for(const side of [0,1])for(let i=0;i<8;i++)spawnUnit(s,side,['infantry','machinegun','marines','sniper_team'][i%4],side?1980+i*22:1600-i*22);
const tickCosts=[],renderCosts=[];let transitions=0;
for(let i=0;i<1200;i++){
  if(i%240===0)for(const side of [0,1])setOrder(s,side,['crouch','prone','advance','hold','advance'][Math.floor(i/240)]);
  let at=performance.now();tick(s,1/60);tickCosts.push(performance.now()-at);
  for(const u of s.units){if(!CARDS[u.id].members)continue;const f=adultFrameChoice(u,s.time);
    assert.notEqual(f.group,'signals4');if(f.group==='actions20'&&[8,9,10,11].includes(f.index))assert(u.rappelling&&!u.wounded&&!u.surrendered);
    if(u.hp>0&&!u.wounded&&!u.surrendered&&u.motion==='ground'&&!u.rappelling&&stanceTransitionActive(u,s.time)){
      assert.equal(f.group,'stance16');transitions++;
    }checked++;
  }
  if(i%3===0){at=performance.now();render(ctx,s,art,null,null,true,1150,1280);renderCosts.push(performance.now()-at);rendered++;}
  if([30,120,360,660,1140].includes(i))save(`battle-${i}`);
}
const stats=xs=>{xs.sort((a,b)=>a-b);return{median:xs[xs.length>>1],p95:xs[Math.floor(xs.length*.95)]};};
const report={output:out,rendered,checked,transitions,stanceBounds,tickMs:stats(tickCosts),renderMs:stats(renderCosts),captures};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
