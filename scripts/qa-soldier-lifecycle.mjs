/** Real engine snapshots, all member roles; no replacement poses or resized bodies. */
import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
const {CARDS,createGame,startGame,spawnUnit,tick,setOrder}=await import('../game/engine.ts');
const {soldierArt,soldierFrame}=await import('../game/soldier-art.ts');
const art=soldierArt(await loadImage('public/art/soldier-parts-v178.png'),await loadImage('public/art/soldier-equipment-v178.png'));
const out=mkdtempSync(join(tmpdir(),'greyline-v180-lifecycle-'));
const frames=[0,5,12,24,39,54,75,96],report=[];
const s=createGame(180);startGame(s);s.aiIn=1e9;s.weather.disabled=true;s.scenery=[];s.walls=[];
s.terrain.fill(374);s.original.fill(374);setOrder(s,0,'hold');setOrder(s,1,'hold');
for(const [id,c]of Object.entries(CARDS))if(c.members)for(let member=0;member<c.members;member++){
  const plate=createCanvas(2048,1000),ctx=plate.getContext('2d');ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#adb6ad';ctx.fillRect(0,0,plate.width,plate.height);ctx.fillStyle='#17271e';ctx.font='18px monospace';
  ctx.fillText(`${id} / member ${member} — real rope landing, injury and lethal hit`,12,24);
  const entry={id,member,rows:[]};
  for(const [row,mode]of ['landing','wounded','fatal'].entries()){
    s.time=1;s.units=[];s.wrecks=[];s.projectiles=[];s.particles=[];s.blasts=[];s.injurySeed=0;
    spawnUnit(s,0,id,1500,{member});const u=s.units.at(-1);s.units=[u];
    Object.assign(u,{x:1500,y:294,pose:'climb',motion:'ground',rappelling:true,parachuting:false,
      rappellingStartAt:1,moving:true,gaitWeight:0,gaitPhase:2.3,cooldown:1e9,decisionIn:1e9,readyAt:1e9});
    if(mode!=='landing'){
      const y=u.y-24;
      s.projectiles.push({x:u.x-100,y,startX:u.x-100,startY:y,tx:u.x,ty:y,side:1,targetUid:u.uid,base:null,
        damage:u.maxHp*(mode==='fatal'?3:.6),radius:0,life:.001,total:.001,arc:0,ammunition:'rifle',tracer:false});
    }
    const samples=[];
    for(let frame=0;frame<=frames.at(-1);frame++){
      if(frame>0)tick(s,1/60);
      const col=frames.indexOf(frame);if(col<0)continue;
      const wreck=s.wrecks.find(w=>w.id===u.uid),body=wreck?{
        id,member,uid:u.uid,pose:wreck.pose,hp:1,wounded:true,woundedTime:wreck.age,
        soldierFall:wreck.soldierFall,moving:false,motion:'ground',walk:0}:u;
      const {image,pose}=soldierFrame(art,body,s.time),actor=wreck??u;
      const x=col*256+128,y=row*320+326;
      ctx.fillStyle='#6d766b';ctx.fillRect(col*256+6,y,244,2);
      ctx.drawImage(image,x-128+(actor.x-1500)*2,y+(actor.y-374)*2-192,256,image.height*2);
      ctx.fillStyle='#17271e';ctx.font='12px monospace';
      ctx.fillText(`${mode} +${(frame/60).toFixed(2)}s`,col*256+8,row*320+51);
      ctx.fillText(`y=${actor.y.toFixed(1)} ${pose.action}`,col*256+8,row*320+69);
      samples.push({frame,time:s.time,y:actor.y,action:pose.action,appearance:pose.appearance});
    }
    entry.rows.push({mode,samples});
  }
  writeFileSync(join(out,`${id}-${member}.png`),plate.toBuffer('image/png'));report.push(entry);
}
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({out,members:report.length,snapshots:report.length*3*frames.length}));
