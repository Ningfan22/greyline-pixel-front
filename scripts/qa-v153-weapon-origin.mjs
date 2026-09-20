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
const {loadArt}=await import('../game/art.ts');
const {render}=await import('../game/render.ts');
const {createGame,startGame,spawnUnit,muzzlePoint,H}=await import('../game/engine.ts');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),'greyline-v153-origins-'));
const canvas=createCanvas(1280,H),ctx=canvas.getContext('2d'),draw=ctx.drawImage.bind(ctx);
let bodies=[],rendered=0;
ctx.drawImage=(...args)=>{
  if(args.length===5&&args[4]===96&&args[2]===-96){const m=ctx.getTransform();bodies.push({image:args[0],x:m.e,y:m.f});}
  return draw(...args);
};
const reports=[];
for(const side of[0,1])for(const pose of['idle','crouch','prone']){
  const s=createGame(153);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.knownTerrain[0].fill(374);s.knownScenery[0]={};s.knownWalls[0]={};
  s.weather.disabled=true;s.night=false;s.sight[0].fill(true);
  const ids=['infantry','grenadiers','rocket','sniper','lmg_team','heavy_mg'];
  for(const [i,id]of ids.entries()){
    spawnUnit(s,side,id,660+i*160,{member:0});const u=s.units.at(-1);
    Object.assign(u,{x:660+i*160,y:374,lane:0,pose,poseAnimSeen:pose==='idle'?'stand':pose,
      moving:false,motion:'ground',crouchTravel:0,stillFor:5,flash:0,fire:0,fragThrow:0,
      aimUntil:0,readyAt:-100,cover:0,facing:side?-1:1});
  }
  s.visible[0]=s.units.map(u=>u.uid);const before=JSON.stringify(s.units),groundRows=new Set();
  for(let i=0;i<180;i++){
    s.time=10+i/30;bodies=[];render(ctx,s,art,null,null,true,500,1280);rendered++;
    assert.equal(JSON.stringify(s.units),before);
    for(const u of s.units){
      const body=bodies.find(b=>b.x===Math.round(u.x-500));assert(body,`${u.id}/${side}/${pose}`);
      assert.equal(body.y,377,`${u.id} planted foot origin at t=${s.time}`);groundRows.add(body.y);
    }
    if(i===30){
      writeFileSync(join(out,`${side}-${pose}-battle.png`),canvas.toBuffer('image/png'));
      // Diagnostic crosshair, not in-game decoration: actual physics origin.
      for(const u of s.units){const p=muzzlePoint(u,u.x+u.facing*300);ctx.fillStyle='#fc5a58';
        ctx.fillRect(p.x-500-2,p.y,5,1);ctx.fillRect(p.x-500,p.y-2,1,5);}
      writeFileSync(join(out,`${side}-${pose}-origins.png`),canvas.toBuffer('image/png'));
    }
  }
  reports.push({side,pose,groundRows:[...groundRows],units:ids});
}
const report={out,rendered,reports,limitation:'Renderer/collision diagnostic, not browser FPS or new missing-action artwork.'};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
