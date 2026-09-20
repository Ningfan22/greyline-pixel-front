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
const {loadArt}=await import('../game/art.ts');
const {render}=await import('../game/render.ts');
const {createGame,startGame,spawnUnit,setOrder,refreshVision,tick,playCard,H}=await import('../game/engine.ts');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),'greyline-v158-mortar-'));
const canvas=createCanvas(720,H),ctx=canvas.getContext('2d'),plate=createCanvas(1440,840),pc=plate.getContext('2d');
pc.fillStyle='#202924';pc.fillRect(0,0,plate.width,plate.height);pc.imageSmoothingEnabled=false;
const rows=[];let rendered=0;
for(const seed of [13,29,47,71,102,158,201,311])for(const side of [0,1])for(const hold of [true,false]){
  const s=createGame(seed);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.night=false;s.weather.disabled=true;s.terrain.fill(374);s.original.fill(374);
  const dir=side?-1:1,start=1700;
  const one=(team,id,x)=>{const n=s.units.length;spawnUnit(s,team,id,x);const u=s.units[n];s.units.splice(n+1);
    Object.assign(u,{x,y:374,lane:0,pace:1,pose:'idle',poseAnimSeen:'stand',cooldown:1000,decisionIn:1000,readyAt:-100,fragLeft:0});return u;};
  const u=one(side,'mortar_carrier',start);u.cooldown=0;
  one(side,'scouts',start+dir*80);
  const enemy=one(1-side,'infantry',start+dir*360);enemy.hp=enemy.maxHp=10000;
  setOrder(s,side,hold?'hold':'advance');setOrder(s,1-side,'hold');refreshVision(s);
  const hp=u.hp;let called=false,impact=null,firstReport=null,movingFrames=0;
  for(let i=0;i<420;i++){
    tick(s,1/60);if(u.moving)movingFrames++;
    if(!called&&u.shots&&s.time>=.5){
      const report=s.batteryReports.find(r=>r.side!==side&&r.life>3);assert(report);
      firstReport=report.x;
      const p=s.players[1-side],h={id:'precision_rocket',uid:++s.uid};p.hand=[h];p.energy=10;
      const result=playCard(s,1-side,h.uid,report.x);assert(result.ok);called=true;impact=s.markers.at(-1).impacts[0];
    }
    if(seed===13&&side===0){
      render(ctx,s,art,null,null,true,1300,720);rendered++;
      const col=[0,66,162,240].indexOf(i);
      if(col>=0){const y=hold?0:420;pc.drawImage(canvas,180,190,360,210,col*360,y,360,210);
        // Full scene below the close crop keeps the launch/impact geography visible.
        pc.drawImage(canvas,0,185,720,360,col*360,y+210,360,180);
        pc.fillStyle='#eee8cd';pc.font='14px monospace';pc.fillText(`${hold?'HOLD':'SCOOT'} ${s.time.toFixed(1)}s x=${u.x.toFixed(0)}`,col*360+6,y+412);}
    }
  }
  assert(called);rows.push({seed,side,hold,damage:+(hp-u.hp).toFixed(3),x:+u.x.toFixed(2),shots:u.shots,movingFrames,firstReport,impact});
}
const total=hold=>rows.filter(r=>r.hold===hold).reduce((a,r)=>a+r.damage,0);
assert(total(true)>0,'the trial must actually hit held vehicles');
assert(total(false)<total(true),'moving batteries should take less damage in these narrow delayed-strike trials');
assert(rows.filter(r=>!r.hold).every(r=>r.movingFrames>0&&r.shots>=2));
const result={output:out,rendered,trialCount:rows.length,heldDamage:total(true),mobileDamage:total(false),rows};
writeFileSync(join(out,'report.json'),JSON.stringify(result,null,2));
writeFileSync(join(out,'hold-vs-scoot.png'),plate.toBuffer('image/png'));
console.log(JSON.stringify(result));
