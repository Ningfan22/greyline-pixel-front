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
const {drawBlast}=await import('../game/ballistics.ts');
const {blastDuration}=await import('../game/blast-animation.ts');
const {createGame,startGame,refreshVision,spawnUnit,tick,explode,ground,H}=await import('../game/engine.ts');
const {MAP_IDS}=await import('../game/maps.ts');
const {render}=await import('../game/render.ts');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),`greyline-v165-${process.argv[2]??'effects'}-`));
const kinds=['he','grenade','air','artillery','wreck','crash','penetration'];
for(const kind of kinds){
  const sheet=createCanvas(160*8,180*2),c=sheet.getContext('2d');c.fillStyle='#98a6a1';c.fillRect(0,0,sheet.width,sheet.height);
  const phase=[0,.012,.026,.044,.066,.095,.13,.175,.22,.29,.38,.48,.59,.71,.84,.94];
  for(let i=0;i<16;i++){
    c.save();c.beginPath();c.rect(i%8*160,Math.floor(i/8)*180,160,180);c.clip();
    const b={kind,age:phase[i]*blastDuration(kind),radius:44,x:i%8*160+80,y:Math.floor(i/8)*180+(kind==='air'?90:169),seed:2,soil:kind!=='air'};
    // Fit only the review cell; the battle captures below use real game dimensions.
    c.translate(b.x,b.y);c.scale(.45,.45);b.x=b.y=0;
    drawBlast(c,b,art.explosions,art.combatExplosions,art.combatExplosionsV13,art.paintedBlasts);c.restore();
    c.fillStyle='#203029';c.font='12px monospace';c.fillText(`${kind} ${i}`,i%8*160+5,Math.floor(i/8)*180+15);
  }
  writeFileSync(join(out,`${kind}-cycle.png`),sheet.toBuffer('image/png'));
}
const canvas=createCanvas(1280,H),ctx=canvas.getContext('2d');
const s=createGame(165);startGame(s);s.aiIn=1e9;s.weather.disabled=true;s.night=false;s.units=[];
for(const x of [1150,1700,2200])spawnUnit(s,0,'scouts',x);refreshVision(s);
let rendered=0;
for(const kind of kinds){
  const duration=blastDuration(kind);s.blasts=[{kind,age:0,radius:60,x:1640,y:ground(s,1640)-(kind==='air'?150:0),seed:2,soil:kind!=='air'}];
  for(let i=0;i<=120;i++){
    s.time=i/24;s.blasts[0].age=i/120*duration;const before=JSON.stringify(s.units);
    render(ctx,s,art,null,null,true,1100,1280);rendered++;
    assert.equal(JSON.stringify(s.units),before);
    if([8,25,58,100].includes(i))writeFileSync(join(out,`${kind}-battle-${i}.png`),canvas.toBuffer('image/png'));
  }
}
const scenes=[];
for(const map of MAP_IDS){
  const battle=createGame(165,undefined,undefined,map,{mapSeed:165});startGame(battle);
  battle.aiIn=1e9;battle.weather.disabled=true;battle.night=false;
  for(const [side,x]of [[0,1500],[1,1810]]){
    spawnUnit(battle,side,'infantry',x);spawnUnit(battle,side,'tank',x);
    spawnUnit(battle,side,'scouts',x-80*(side===0?1:-1));
  }
  const observed=new Set(),tickMs=[],drawMs=[];
  for(let i=0;i<420;i++){
    // Real engine explosion entry point and autonomous combat, without
    // revealing hidden units/terrain or overriding render alpha.
    if(i%24===0&&i/24<6){
      const kind=kinds[i/24];
      explode(battle,1650,ground(battle,1650)-(kind==='air'?150:0),60,12,0,1,1,kind);
    }
    let at=performance.now();tick(battle,1/60);tickMs.push(performance.now()-at);
    for(const b of battle.blasts)observed.add(b.kind);
    for(const u of battle.units)assert(Number.isFinite(u.x)&&Number.isFinite(u.y)&&Number.isFinite(u.hp));
    const before=JSON.stringify(battle.units);
    at=performance.now();render(ctx,battle,art,null,null,true,1100,1280);drawMs.push(performance.now()-at);
    assert.equal(JSON.stringify(battle.units),before,'render must not change live combat state');
    if([8,56,104,240,419].includes(i))writeFileSync(join(out,`${map}-mixed-${i}.png`),canvas.toBuffer('image/png'));
  }
  for(const kind of kinds.slice(0,6))assert(observed.has(kind),`${map}: missing ${kind}`);
  const stats=xs=>{xs.sort((a,b)=>a-b);return {median:xs[xs.length>>1],p95:xs[Math.floor(xs.length*.95)],max:xs.at(-1)};};
  scenes.push({map,frames:420,seconds:battle.time,observed:[...observed],tickMs:stats(tickMs),drawMs:stats(drawMs)});
}
const report={out,lifecycleFrames:rendered,mixedCombatFrames:scenes.reduce((sum,s)=>sum+s.frames,0),kinds,scenes};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
