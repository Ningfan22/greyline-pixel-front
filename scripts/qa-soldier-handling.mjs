// Render the production rig for visual review; no substitute illustration.
import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
const {soldierArt,soldierFrame}=await import('../game/soldier-art.ts');
const {updateSoldierGait}=await import('../game/soldier-pose.ts');
const out=resolve('outputs/soldier-poses');mkdirSync(out,{recursive:true});
const art=soldierArt(await loadImage('public/art/soldier-parts-v178.png'),await loadImage('public/art/soldier-equipment-v178.png'));
const base={id:'infantry',uid:1,member:0,hp:100,x:950,y:374,lane:0,facing:1,
  pose:'idle',motion:'ground',moving:false,walk:0,rifleReady:1,aimUntil:100};
const roles=[['RIFLE','infantry'],['LIGHT MG','machinegun'],['ROCKET','rocket'],['MANPADS','manpads'],
  ['HEAVY MG','heavy_mg'],['MORTAR','light_mortar'],['SNIPER','sniper_team']];
const states=[['READY',{rifleReady:0,aimUntil:0}],['AIM / DEPLOY',{}],['KNEEL',{pose:'crouch'}],
  ['PRONE',{pose:'prone'}],['WALK / CARRY',{pose:'walk',moving:true,gaitWeight:1,gaitPhase:1}],
  ['RUN',{pose:'run',moving:true,gaitWeight:1,gaitPhase:2}]];
const sheet=createCanvas(1320,roles.length*240),ctx=sheet.getContext('2d');
ctx.fillStyle='#b3bdb5';ctx.fillRect(0,0,sheet.width,sheet.height);ctx.imageSmoothingEnabled=false;
roles.forEach(([name,id],row)=>states.forEach(([state,patch],col)=>{
  const x=col*220,y=row*240;
  ctx.fillStyle='#34463a';ctx.font='13px monospace';ctx.fillText(`${name} / ${state}`,x+8,y+18);
  ctx.fillStyle='#89988e';ctx.fillRect(x+8,y+209,204,1);
  const frame=soldierFrame(art,{...base,id,...patch},20);
  ctx.drawImage(frame.image,x-18,y+17,256,256);
}));
writeFileSync(resolve(out,'handling.png'),sheet.toBuffer('image/png'));
const units=['infantry','rocket','heavy_mg','light_mortar'].map(id=>({...base,id,pose:'walk',moving:true,gaitWeight:1,gaitPhase:0}));
const frames=resolve(out,'motion-frames');mkdirSync(frames,{recursive:true});
for(let i=0;i<48;i++){
  const c=createCanvas(1040,280),g=c.getContext('2d');g.fillStyle='#b3bdb5';g.fillRect(0,0,c.width,c.height);g.imageSmoothingEnabled=false;
  units.forEach((u,n)=>{
    if(i){const previous={x:u.x,lane:u.lane};u.x+=50/48;updateSoldierGait(u,previous,1/30,20+i/30);}
    g.fillStyle='#34463a';g.font='15px monospace';g.fillText(u.id,n*260+16,24);
    g.fillStyle='#89988e';g.fillRect(n*260+8,247,244,2);
    // Moving ground marks make stance-foot sliding visible in this fixed camera.
    for(let j=0;j<7;j++)g.fillRect(n*260+8+((j*40-(u.x-950)*3)%240+240)%240,248,5,2);
    g.drawImage(soldierFrame(art,u,20+i/30).image,n*260+130-192,247-279,384,384);
  });
  writeFileSync(resolve(frames,String(i).padStart(3,'0')+'.png'),c.toBuffer('image/png'));
}
console.log(JSON.stringify({sheet:resolve(out,'handling.png'),motionFrames:frames}));
