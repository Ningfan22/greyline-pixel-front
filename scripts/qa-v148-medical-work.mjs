import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const {createCanvas,Image}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
globalThis.Image=class extends Image {
  set src(v){super.src=v.startsWith('/')?fileURLToPath(new URL('../public'+v,import.meta.url)):v;}
  get src(){return super.src;}
};
const {loadArt,uniformFrame}=await import('../game/art.ts');
const {render}=await import('../game/render.ts');
const {adultFrameChoice,adultIdentity}=await import('../game/adult-animation.ts');
const {specialistSprite}=await import('../game/adult-specialists.ts');
const {createGame,startGame,spawnUnit,CARDS,H}=await import('../game/engine.ts');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),'greyline-v148-medical-'));
function bounds(im) {
  const d=im.getContext('2d').getImageData(0,0,im.width,im.height).data;
  let left=im.width,right=-1,top=im.height,bottom=-1;
  for(let p=0;p<d.length;p+=4)if(d[p+3]>=128){const x=p/4%im.width,y=Math.floor(p/4/im.width);
    left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
  return{left,right,top,bottom,height:bottom-top+1};
}
const anatomy=[];
const plate=createCanvas(1440,960),pc=plate.getContext('2d');
pc.fillStyle='#718178';pc.fillRect(0,0,1440,960);pc.imageSmoothingEnabled=false;
for(let row=0;row<3;row++) for(let i=0;i<8;i++){
  const frame=art.adults.infantry.medical24[row*8+i],b=bounds(frame);
  anatomy.push(b);assert(b.bottom>=94&&b.bottom<=95);assert(b.left>0&&b.right<127);
  if(i)assert(Math.abs(b.height-anatomy[row*8+i-1].height)<=2);
  pc.drawImage(frame,i%4*360,(row*2+Math.floor(i/4))*160,213,160);
  pc.fillStyle='#f4e4c4';pc.font='13px monospace';pc.fillText(`${row}/${i} h${b.height}`,i%4*360+218,(row*2+Math.floor(i/4))*160+150);
}
writeFileSync(join(out,'medical-cels.png'),plate.toBuffer('image/png'));
const canvas=createCanvas(1280,H),ctx=canvas.getContext('2d'),draw=ctx.drawImage.bind(ctx);
let drawn=[];ctx.drawImage=(...args)=>{drawn.push(args[0]);return draw(...args);};
let rendered=0,verified=0;
const settled=[];
for(const side of [0,1])for(const [row,pose]of ['idle','crouch','prone'].entries()) {
  const s=createGame(148);startGame(s);s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.knownTerrain[0].fill(374);s.knownScenery[0]={};s.knownWalls[0]={};
  s.weather.disabled=true;s.night=false;s.sight[0].fill(true);
  for(const [j,id] of ['medic','medic_team','field_hospital','infantry'].entries()){
    const n=s.units.length;spawnUnit(s,side,id,500+j*240);s.units.splice(n+1);const u=s.units[n];
    Object.assign(u,{x:500+j*240,y:374,lane:0,pose,poseAnimFrom:undefined,poseAnimSeen:row===0?'stand':pose,
      poseAnimAt:undefined,crouchTravel:0,moving:false,motion:'ground',climbing:0,fire:0,secondaryFire:0,
      flash:0,fragThrow:0,aimUntil:0,readyAt:-100,cover:0,rappelling:false,parachuting:false,
      tending:id!=='infantry',tendingKind:'medical',tendingTime:0,firstAidUntil:id==='infantry'?11.5:undefined});
    const normal={group:'actions20',index:[0,1,2][row]},base=art.adults[adultIdentity(id)].actions20[normal.index];
    const normalBody=specialistSprite(base,normal,u,art.adultSpecialists,art.weaponStances)?.image??base;
    const nb=bounds(normalBody);settled.push({id,pose,side,normal:nb,work:anatomy[row*8]});
    assert(Math.abs(nb.height-anatomy[row*8].height)<=8,`${id}/${pose} entry height ${nb.height}→${anatomy[row*8].height}`);
  }
  s.visible[0]=s.units.map(u=>u.uid);
  for(let i=0;i<=144;i++) {
    s.time=10+i/60;
    for(const u of s.units){u.tendingTime=i/60;if(u.id==='infantry')u.firstAidUntil=s.time+(1.5-i/60%1.5);}
    drawn=[];render(ctx,s,art,null,null,true,300,1280);rendered++;
    for(const u of s.units){const f=adultFrameChoice(u,s.time);
      assert.equal(f.group,'medical24');
      const im=uniformFrame(art.adults[adultIdentity(u.id)][f.group][f.index],CARDS[u.id].uniform);
      assert(drawn.includes(im),`${u.id} work was hidden by a decorator`);verified++;
    }
    if([0,72,144].includes(i))writeFileSync(join(out,`${side}-${pose}-${i}.png`),canvas.toBuffer('image/png'));
  }
}
writeFileSync(join(out,'report.json'),JSON.stringify({rendered,verified,anatomy,settled},null,2));
console.log(JSON.stringify({out,rendered,verified,anatomy}));
