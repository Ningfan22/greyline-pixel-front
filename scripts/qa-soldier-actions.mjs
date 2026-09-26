// Production sprite review plus a wide-painter audit for lost edge pixels.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
const {soldierArt,soldierFrame,paintSoldier,SOLDIER_FRAME}=await import('../game/soldier-art.ts');
const {soldierPose,updateSoldierGait}=await import('../game/soldier-pose.ts');
const art=soldierArt(await loadImage('public/art/soldier-parts-v178.png'),await loadImage('public/art/soldier-equipment-v178.png'));
const out=resolve('outputs/soldier-actions-v184'),frames=resolve(out,'frames');
mkdirSync(frames,{recursive:true});
const base={id:'marines',uid:0,member:0,hp:100,x:950,y:374,lane:0,facing:1,
  pose:'idle',motion:'ground',moving:false,walk:0,gaitPhase:0,gaitWeight:0,
  fire:0,secondaryFire:0,rifleReady:0,aimUntil:0};
const aimed={...base,rifleReady:1,aimUntil:100};
function moving(pose,speed,elapsed,ready=0){
  const u={...base,pose,moving:true,gaitWeight:1,gaitRun:pose==='run'?1:0,
    crouchTravel:pose==='crouch'?1:0,proneTravel:pose==='prone'?1:0};
  for(let time=0;time<elapsed;){
    const dt=Math.min(1/60,elapsed-time),previous={x:u.x,lane:u.lane};
    u.x+=speed*dt;time+=dt;updateSoldierGait(u,previous,dt,20+time);
  }
  u.rifleReady=ready;return u;
}
const fall=soldierPose(moving('walk',36,.3),20);
function rappelling(t){
  const duration=72/65,elapsed=t%(duration+.9),started=20+t-elapsed;
  const u={...base,pose:'climb',moving:true,rappellingStartAt:started};
  if(elapsed<duration)return {...u,rappelling:true,y:302+elapsed*65};
  const landing=elapsed-duration;
  return {...u,moving:false,pose:landing<.3?'land':'idle',motion:landing<.3?'land':'ground',
    motionTime:landing,motionDuration:.3,soldierLanding:landing<.3?{
      at:started+duration,duration:.3,pose:soldierPose({...u,rappelling:true},started+duration)}:undefined};
}
const actions=[
  ['STAND AIM',()=>({...aimed})],['KNEEL AIM',()=>({...aimed,pose:'crouch'})],
  ['PRONE AIM',()=>({...aimed,pose:'prone'})],
  ['MARCH',t=>moving('walk',36,t)],['CARRY / LOW READY',t=>moving('walk',36,t,.35)],
  ['RUN',t=>moving('run',54,t)],['CRAWL',t=>moving('prone',10,t)],
  ['DIG',t=>({...base,pose:'crouch',digging:true,digElapsed:t})],
  ['SURRENDER',t=>({...base,surrendered:true,surrenderTime:t})],['RAPPEL',rappelling],
  ...[0,1,2,3].map(v=>['FALL '+v,t=>({...base,wounded:true,woundedTime:t,fallVariant:v,soldierFall:fall})]),
];
const W=360,H=340,SCALE=2,AX=180,FLOOR=318;
const cropWorst=new Map();
function audit(name,u,time,frame){
  const c=createCanvas(400,320),g=c.getContext('2d'),ax=160,ay=220;
  g.translate(ax,ay);paintSoldier(g,art,frame.pose);
  const data=g.getImageData(0,0,c.width,c.height).data;
  const bounds={left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};let outside=0;
  const spriteAnchor=frame.anchorX??SOLDIER_FRAME.anchorX;
  for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++)if(data[(y*c.width+x)*4+3]>127){
    const px=x-ax,py=y-ay;
    bounds.left=Math.min(bounds.left,px);bounds.right=Math.max(bounds.right,px);
    bounds.top=Math.min(bounds.top,py);bounds.bottom=Math.max(bounds.bottom,py);
    if(px< -spriteAnchor||px>=frame.image.width-spriteAnchor||py< -frame.anchorY||py>=frame.image.height-frame.anchorY)outside++;
  }
  const previous=cropWorst.get(name);
  const combined=previous?{
    left:Math.min(previous.bounds.left,bounds.left),top:Math.min(previous.bounds.top,bounds.top),
    right:Math.max(previous.bounds.right,bounds.right),bottom:Math.max(previous.bounds.bottom,bounds.bottom),
  }:bounds;
  cropWorst.set(name,!previous||outside>previous.outside?{name,time,outside,bounds:combined,u}:{...previous,bounds:combined});
  return outside;
}
function tile(g,name,u,time,x,y,{wide=false,check=true}={}){
  const f=soldierFrame(art,u,time),dy=u.y-base.y,originX=x+AX,originY=y+FLOOR+dy*SCALE;
  const outside=check?audit(name,u,time,f):0;
  g.fillStyle='#304134';g.font='15px monospace';g.fillText(name,x+10,y+23);
  g.fillStyle='#879587';g.fillRect(x+8,y+FLOOR,W-16,1);
  // Fixed origins expose fall displacement; scrolling terrain exposes foot slip.
  if(u.moving&&!u.rappelling)for(let j=0;j<9;j++)g.fillRect(x+8+((j*40-(u.x-base.x)*SCALE)%(W-16)+W-16)%(W-16),y+FLOOR+2,5,2);
  g.strokeStyle='#829384';g.beginPath();g.moveTo(originX,y+FLOOR-4);g.lineTo(originX,y+FLOOR+6);g.stroke();
  if(u.rappelling){
    g.strokeStyle='#69664f';g.lineWidth=2;g.beginPath();
    g.moveTo(originX+f.pose.farHand[0]*SCALE,y+32);
    g.lineTo(originX+f.pose.farHand[0]*SCALE,originY+f.pose.farHand[1]*SCALE);
    g.lineTo(originX+f.pose.nearHand[0]*SCALE,originY+f.pose.nearHand[1]*SCALE);
    g.lineTo(originX+f.pose.nearHand[0]*SCALE,y+FLOOR);g.stroke();
  }
  if(wide){g.save();g.translate(originX,originY);g.scale(SCALE,SCALE);paintSoldier(g,art,f.pose);g.restore();}
  else g.drawImage(f.image,originX-(f.anchorX??SOLDIER_FRAME.anchorX)*SCALE,originY-f.anchorY*SCALE,f.image.width*SCALE,f.image.height*SCALE);
  if(outside){g.fillStyle='#8b3028';g.font='12px monospace';g.fillText(`SPRITE CROP: ${outside} px`,x+10,y+43);}
}
function canvas(cols,rows){
  const c=createCanvas(cols*W,rows*H),g=c.getContext('2d');
  g.fillStyle='#adb6ad';g.fillRect(0,0,c.width,c.height);g.imageSmoothingEnabled=false;return {c,g};
}
const {c:sheet,g:ctx}=canvas(6,actions.length);
actions.forEach(([name,unit],row)=>[0,.15,.3,.45,.65,.85].forEach((t,col)=>tile(ctx,`${name} / ${t.toFixed(2)}s`,unit(t),20+t,col*W,row*H)));
writeFileSync(resolve(out,'actions.png'),sheet.toBuffer('image/png'));
for(let frame=0;frame<72;frame++){
  const {c,g}=canvas(4,Math.ceil(actions.length/4)),t=frame/30;
  actions.forEach(([name,unit],i)=>tile(g,name,unit(t),20+t,i%4*W,Math.floor(i/4)*H));
  writeFileSync(resolve(frames,String(frame).padStart(3,'0')+'.png'),c.toBuffer('image/png'));
}
const failures=[...cropWorst.values()].filter(v=>v.outside>0);
if(failures.length){
  const {c,g}=canvas(2,failures.length);
  failures.forEach((v,row)=>{
    tile(g,`${v.name} / PRODUCTION`,v.u,v.time,0,row*H,{check:false});
    tile(g,`${v.name} / UNCROPPED`,v.u,v.time,W,row*H,{wide:true,check:false});
  });
  writeFileSync(resolve(out,'crop-comparison.png'),c.toBuffer('image/png'));
}
const report={sprite:SOLDIER_FRAME,failures:failures.map(({u,...rest})=>rest),all:[...cropWorst.values()].map(({u,...rest})=>rest)};
writeFileSync(resolve(out,'sprite-bounds.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({sheet:resolve(out,'actions.png'),frames,bounds:resolve(out,'sprite-bounds.json'),cropFailures:report.failures}));
