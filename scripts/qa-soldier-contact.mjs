/** Existing production artwork through the production sprite draw helper.
 * Controlled gait/turn rows are synthetic; blast row uses real engine hits. */
import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
const {CARDS,createGame,startGame,spawnUnit,tick,explode}=await import('../game/engine.ts');
const {soldierArt,soldierFrame}=await import('../game/soldier-art.ts');
const {soldierPose,updateSoldierGround,updateSoldierGait,beginSoldierTurn,updateSoldierTurn}=await import('../game/soldier-pose.ts');
const {drawSprite}=await import('../game/art.ts');
const art=soldierArt(await loadImage('public/art/soldier-parts-v178.png'),await loadImage('public/art/soldier-equipment-v178.png'));
const out=mkdtempSync(join(tmpdir(),'greyline-v181-contact-')),report=[];
const samples=[0,.05,.1,.2,.35,.5,.75,1];
const s=createGame(181);startGame(s);s.aiIn=1e9;s.weather.disabled=true;s.scenery=[];s.walls=[];
for(const [id,card]of Object.entries(CARDS))if(card.members)for(let member=0;member<card.members;member++){
  if(process.argv[2]&&id!==process.argv[2])continue;
  const plate=createCanvas(2048,1320),ctx=plate.getContext('2d'),entry={id,member,rows:[]};
  ctx.fillStyle='#afb7aa';ctx.fillRect(0,0,plate.width,plate.height);ctx.font='18px monospace';ctx.fillStyle='#17271e';
  ctx.fillText(`${id} / member ${member} — fixed pixels, real body parts`,12,24);
  for(const [row,mode]of ['uphill-aim','downhill-reload','prone-turn','blast-impact'].entries()){
    const slope=row===0?-.2:row===1?.2:0,floor=x=>374+(Math.floor(x)-1500)*slope;
    const u={id,member,uid:1,hp:100,x:1500,y:374,lane:0,facing:row===1?-1:1,climbing:0,
      pose:row===1?'crouch':row===2?'prone':'walk',motion:'ground',moving:row<2,walk:1,gaitPhase:1,
      gaitWeight:row<2?1:0,crouchTravel:row===1?1:0,proneTravel:0,aimUntil:100,rifleReady:1,
      ...(row===1?{ammo:0,reloadingStartAt:20,reloadingUntil:21.5}:{})};
    updateSoldierGround(u,floor,20,1);let wreck;
    if(row===2){const previous={x:u.x,y:u.y,facing:u.facing,pose:soldierPose(u,20)};u.facing=-1;beginSoldierTurn(u,previous,20);}
    if(row===3){
      s.time=1;s.units=[];s.wrecks=[];s.projectiles=[];s.blasts=[];s.particles=[];s.terrain.fill(374);s.original.fill(374);
      spawnUnit(s,0,id,1500,{member});const target=s.units.at(-1);s.units=[target];
      Object.assign(target,{x:1500,y:374,pose:'idle',motion:'ground',moving:false,rappelling:false,parachuting:false});
      explode(s,1475,350,70,10000,1,1,1,'he',1.5);wreck=s.wrecks.find(w=>w.id===target.uid);
      // Start shortly before impact, then show settling rather than only launch.
      for(let i=0;i<45;i++)tick(s,1/60);
    }
    const records=[];
    for(let frame=0;frame<=120;frame++){
      const t=frame/120,time=20+t;
      if(frame){
        if(row===3)tick(s,1/120);
        else {const previous={x:u.x,lane:0};if(u.moving)u.x+=u.facing*.35;
          u.y=floor(u.x);updateSoldierGait(u,previous,1/120,time);updateSoldierGround(u,floor,time,1/120);updateSoldierTurn(u,time);}
      }
      const col=samples.findIndex(v=>Math.abs(v-t)<1e-8);if(col<0)continue;
      const actor=wreck??u,body=wreck?{id,member,uid:wreck.id,pose:wreck.pose,hp:1,wounded:true,woundedTime:wreck.age,
        soldierFall:wreck.soldierFall,moving:false,motion:'ground',walk:0}:u;
      const f=soldierFrame(art,body,row===3?s.time:time),x=col*256+128,y=row*320+270,angle=wreck?.angle??0;
      ctx.save();ctx.translate(x,y);ctx.scale(2,2);
      ctx.strokeStyle='#505b4d';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(-62,-62*slope);ctx.lineTo(62,62*slope);ctx.stroke();
      const inset=f.image.height-f.anchorY;
      // The real renderer anchors boots three pixels above the unit origin.
      // Blast specimens retain their world height relative to local ground.
      const elevation=wreck?actor.y-s.terrain[Math.floor(actor.x)]:0;
      drawSprite(ctx,f.image,-Math.sin(angle)*inset,3+elevation+Math.cos(angle)*inset,
        f.image.width,f.image.height,(actor.facing??1)<0,1,angle);ctx.restore();
      ctx.font='12px monospace';ctx.fillStyle='#17271e';ctx.fillText(`${mode} +${t.toFixed(2)}s`,col*256+8,row*320+53);
      records.push({t,angle,falling:wreck?.falling,appearance:f.pose.appearance});
    }
    entry.rows.push({mode,samples:records});
  }
  writeFileSync(join(out,`${id}-${member}.png`),plate.toBuffer('image/png'));report.push(entry);
}
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({out,members:report.length,snapshots:report.length*4*8}));
