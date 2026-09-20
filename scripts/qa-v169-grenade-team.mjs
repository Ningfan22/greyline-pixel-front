import assert from 'node:assert/strict';
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
const {loadArt,uniformFrame}=await import('../game/art.ts');
const {render}=await import('../game/render.ts');
const {adultFrameChoice,adultIdentity}=await import('../game/adult-animation.ts');
const {tick,CARDS,H,createGame,startGame,spawnUnit,setOrder,refreshVision}=await import('../game/engine.ts');
const {grenadeTeamArena}=await import('../tests/fixtures/grenade-team-arena.mjs');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),'greyline-v169-grenades-'));
const canvas=createCanvas(1280,H),ctx=canvas.getContext('2d'),draw=ctx.drawImage.bind(ctx);
let drawn=[],rendered=0,verified=0;ctx.drawImage=(...args)=>{drawn.push(args[0]);return draw(...args);};
function paint(s,camera,name){
  drawn=[];const before=JSON.stringify(s.units);render(ctx,s,art,null,null,true,camera,1280);rendered++;
  assert.equal(JSON.stringify(s.units),before);
  if(name)writeFileSync(join(out,name+'.png'),canvas.toBuffer('image/png'));
}
const drills=[];
for(const side of [0,1])for(const pose of ['idle','crouch','prone']) {
  const {s,squad,x}=grenadeTeamArena(side,pose);let thrower;const seen=new Set(),rounds=new Set();
  let coveringShots=0,previous=0;
  for(let i=0;i<180;i++) {
    tick(s,1/60);thrower??=squad.find(u=>(u.fragThrow??0)>0);
    const f=thrower&&thrower.fragThrow>0?adultFrameChoice(thrower,s.time):null;
    const fresh=f&&!seen.has(f.index);
    paint(s,x-500,fresh?`${side}-${pose}-${f.index}`:undefined);
    if(f){
      assert(drawn.includes(uniformFrame(art.adults[adultIdentity(thrower.id)][f.group][f.index],CARDS[thrower.id].uniform)));
      verified++;seen.add(f.index);
      const shots=squad.reduce((a,u)=>a+(u===thrower?0:u.shots),0);coveringShots+=Math.max(0,shots-previous);previous=shots;
    }
    for(const p of s.projectiles)if(p.ammunition==='grenade')rounds.add(p.uid);
  }
  assert.equal(seen.size,pose==='idle'?8:16);assert(coveringShots>0);
  drills.push({side,pose,cels:seen.size,coveringShots,grenades:rounds.size});
}

// Close-contact encounters with actual card HP, ammunition and damage. No
// frozen enemy cooldown, forced sight or repeated refills in this paired trial.
const encounters=[];
for(const id of ['assault','assault_grenadiers'])for(const seed of [13,71,169])for(const side of [0,1]){
  const s=createGame(seed);startGame(s);s.units=[];s.scenery=[];s.walls=[];s.aiIn=1e9;
  s.terrain.fill(374);s.original.fill(374);s.weather.disabled=true;s.night=false;
  const x=side?2200:1300,dir=side?-1:1;
  spawnUnit(s,side,id,x);const own=[...s.units];spawnUnit(s,1-side,'machinegun',x+dir*180);
  const foes=s.units.filter(u=>u.side!==side);
  own.forEach((u,i)=>Object.assign(u,{x:x-dir*i*12,y:374,readyAt:0}));
  foes.forEach((u,i)=>Object.assign(u,{x:x+dir*(180+i*10),y:374,readyAt:0}));
  setOrder(s,0,'hold');setOrder(s,1,'hold');refreshVision(s);
  const ids=new Set(own.map(u=>u.uid)),rounds=new Set();let peakThrowers=0;
  for(let i=0;i<1800;i++){
    tick(s,1/60);
    for(const p of s.projectiles)if(ids.has(p.sourceUid)&&p.ammunition==='grenade')rounds.add(p.uid);
    peakThrowers=Math.max(peakThrowers,own.filter(u=>(u.fragThrow??0)>0).length);
    if(i%60===0)paint(s,x-500,i===600?`encounter-${id}-${seed}-${side}`:undefined);
  }
  if(id==='assault_grenadiers')assert(peakThrowers<=1);
  encounters.push({id,seed,side,grenades:rounds.size,peakThrowers,shots:own.reduce((n,u)=>n+u.shots,0),
    healthy:own.filter(u=>u.hp>0&&!u.wounded&&!u.surrendered).length,
    enemyHealthy:foes.filter(u=>u.hp>0&&!u.wounded&&!u.surrendered).length,
    enemyHp:foes.reduce((n,u)=>n+Math.max(0,u.hp),0)});
}
assert(encounters.some(v=>v.id==='assault_grenadiers'&&v.grenades>0),'drill must occur with real combat health and enemy fire');
const report={out,rendered,verified,drills,encounters};writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report));
