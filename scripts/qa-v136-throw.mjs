// Run the production renderer through a real throw, using the shipped atlas.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const {createCanvas,Image}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
globalThis.Image=class extends Image {
  set src(value){super.src=value.startsWith('/')?fileURLToPath(new URL('../public'+value,import.meta.url)):value;}
  get src(){return super.src;}
};
const {loadArt}=await import('../game/art.ts');
const {render}=await import('../game/render.ts');
const {createGame,startGame,spawnUnit,tick,setOrder,H}=await import('../game/engine.ts');
const {adultFrameChoice}=await import('../game/adult-animation.ts');
const art=await loadArt(),s=createGame(136);
startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];s.terrain.fill(374);s.original.fill(374);
spawnUnit(s,0,'assault_grenadiers',640);s.units=s.units.slice(0,1);
spawnUnit(s,1,'infantry',810);s.units=s.units.slice(0,3);
for(const [i,u] of s.units.entries()) Object.assign(u,{x:i?800+i*20:640,y:374,pose:'idle',
  motion:'ground',poseAnimSeen:'stand',stanceLockUntil:100,hp:1000,maxHp:1000,decisionIn:1000,tactic:'advance',cooldown:100});
setOrder(s,0,'hold');setOrder(s,1,'hold');
const u=s.units[0],x=u.x,canvas=createCanvas(480,H),ctx=canvas.getContext('2d');
const out=mkdtempSync(join(tmpdir(),'greyline-v136-throw-')),seen=new Set();
for(let i=0;i<80;i++) {
  tick(s,1/60);const choice=adultFrameChoice(u,s.time);
  render(ctx,s,art,null,null,true,450,480);
  if(choice.group==='grenade8'&&!seen.has(choice.index)) {
    seen.add(choice.index);assert.equal(u.x,x);assert.equal(u.pose,'idle');
    writeFileSync(join(out,`throw-${choice.index}.png`),canvas.toBuffer('image/png'));
  }
}
assert.equal(seen.size,8);console.log(JSON.stringify({output:out,rendered:80,paintedCels:[...seen]}));
