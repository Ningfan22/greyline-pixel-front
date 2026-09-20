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
const {createGame,startGame,spawnUnit,refreshVision,setOrder,tick,H,W}=await import('../game/engine.ts');
const {render}=await import('../game/render.ts');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),'greyline-v164-loiter-'));
const report=[];
let rendered=0;
for(const side of [0,1]){
  const s=createGame(164);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.weather.disabled=true;s.night=false;s.terrain.fill(374);s.original.fill(374);
  setOrder(s,0,'hold');setOrder(s,1,'hold');const x=v=>side?W-v:v;
  const one=(team,id,at)=>{const n=s.units.length;spawnUnit(s,team,id,x(at));s.units.splice(n+1);
    const u=s.units[n];Object.assign(u,{cooldown:1000,secondaryCooldown:1000,pace:0,decisionIn:1000});return u;};
  const u=one(side,'loiter_drone',1000),target=one(1-side,'artillery',1280);
  Object.assign(u,{cooldown:0,squadOrder:'watch',squadOrderX:x(1000),squadOrderUntil:Infinity});
  // The real friendly gun sees a red aircraft; no omniscience or alpha override.
  refreshVision(s);
  const canvas=createCanvas(960,H),ctx=canvas.getContext('2d'),camera=side?W-1500:800;
  let captured=0;
  for(let i=0;i<360;i++){
    tick(s,1/60);const before=JSON.stringify(s.units);
    render(ctx,s,art,null,null,true,camera,960);rendered++;
    assert.equal(JSON.stringify(s.units),before,'renderer must not change flight state');
    const take=captured===0&&i===15||captured===1&&u.loiterFlight?.lock&&Math.abs(u.hullAngle)>.05||captured===2&&u.destroyed;
    if(take){
      const name=['confirm','dive','impact'][captured];
      writeFileSync(join(out,`side${side}-${name}.png`),canvas.toBuffer('image/png'));
      report.push({side,name,time:s.time,x:u.x,y:u.y,facing:u.facing,pitch:u.hullAngle,targetHp:target.hp});captured++;
    }
  }
  assert.equal(captured,3);
}
writeFileSync(join(out,'report.json'),JSON.stringify({rendered,report},null,2));
console.log(JSON.stringify({out,rendered,report}));
