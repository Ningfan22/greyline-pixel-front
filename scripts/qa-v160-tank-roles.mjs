import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {tankRoleArena} from '../tests/fixtures/tank-role-arena.mjs';
import {tick,refreshVision,H} from '../game/engine.ts';
import {infantryConcentrations} from '../game/tank-doctrine.ts';
const {createCanvas,Image}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
globalThis.Image=class extends Image{
  set src(v){super.src=v.startsWith('/')?fileURLToPath(new URL('../public'+v,import.meta.url)):v;}
  get src(){return super.src;}
};
const {loadArt}=await import('../game/art.ts'),{render}=await import('../game/render.ts');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),'greyline-v160-tank-roles-'));
const canvas=createCanvas(1280,H),ctx=canvas.getContext('2d');
const plate=createCanvas(1280,H*3+108),pc=plate.getContext('2d');
pc.fillStyle='#1e3028';pc.fillRect(0,0,plate.width,plate.height);
const report=[];let rendered=0;
for(const seed of [13,71,102,160,901,1103,3321,8723])for(const side of [0,1])
for(const layout of ['mixed','formation'])for(const [row,id]of ['light_tank','tank','heavy_tank'].entries()){
  const {s,tank,targets,x}=tankRoleArena(id,side,seed);
  if(layout==='formation')s.units=s.units.filter(v=>v!==targets.gun);
  refreshVision(s);const before=new Map(s.units.map(v=>[v.uid,v.hp]));let first;
  for(let i=0;i<120;i++){
    tick(s,1/60);
    const p=s.projectiles.find(p=>p.sourceUid===tank.uid&&p.weapon!=='coax');
    first??=p?{target:p.targetUid,ammo:p.ammunition,damage:p.damage,tx:p.tx}:undefined;
    if(i%30===0){
      const state=JSON.stringify(s.units);render(ctx,s,art,null,null,true,x-430,1280);rendered++;
      assert.equal(JSON.stringify(s.units),state);
      if(seed===160&&side===0&&layout==='mixed'&&i===30){
        pc.drawImage(canvas,0,row*(H+36)+36);pc.fillStyle='#fff0c6';pc.font='18px monospace';
        const key=Object.entries(targets).find(([,v])=>v.uid===first?.target)?.[0];
        pc.fillText(`${id}: main gun -> ${key}`,16,row*(H+36)+26);
      }
    }
  }
  const key=Object.entries(targets).find(([,v])=>v.uid===first?.target)?.[0];
  const expected=id==='tank'?'armor':id==='light_tank'?'launcher':layout==='mixed'?'gun':'rifle2';
  assert.equal(key,expected,`${seed}/${side}/${layout}/${id}`);
  const victims=Object.entries(targets).map(([key,v])=>({key,damage:(before.get(v.uid)??v.hp)-v.hp}));
  assert(victims.some(v=>v.key===expected&&v.damage>0));
  report.push({seed,side,layout,id,target:key,ammo:first.ammo,victims});
}
writeFileSync(join(out,'three-tank-roles.png'),plate.toBuffer('image/png'));
// Verify the sliding-window centre preference against direct arithmetic.
const units=tankRoleArena().s.units.filter(v=>v.id==='infantry');
for(let i=0;i<200;i++)units.push({...units[i%3],uid:10000+i,x:600+(i*37)%450});
const counts=infantryConcentrations(units);
for(const v of units){
  const near=units.filter(q=>Math.abs(q.x-v.x)<=32),c=counts.get(v.uid);
  assert.equal(c.count,near.length);assert(Math.abs(c.spread-near.reduce((n,q)=>n+Math.abs(q.x-v.x),0)/near.length)<1e-7);
}
const start=performance.now();for(let i=0;i<3000;i++)infantryConcentrations(units);
const microsecondsPer203=(performance.now()-start)*1000/3000;
writeFileSync(join(out,'report.json'),JSON.stringify({out,rendered,trials:report.length,microsecondsPer203,report},null,2));
console.log(JSON.stringify({out,rendered,trials:report.length,microsecondsPer203,allTargetsAndImpactsVerified:true}));
