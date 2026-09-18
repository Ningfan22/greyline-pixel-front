import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createGame, startGame, spawnUnit, tick, explode, refreshVision, ground, projectileIntercept, terrainIntercept, W } from '../game/engine.ts';
import { createScenery, damageScenery, obstacleBoxes, sceneryIntercept, buildingStage } from '../game/world.ts';
import { blastVisible } from '../game/impact-fx.ts';

const DT=1/60, out=path.resolve('output/v23-artillery-cover-qa'),results=[],failures=[];
fs.mkdirSync(out,{recursive:true});
function check(name,fn){try{const details=fn();results.push({name,...details});console.log('PASS',name);}catch(e){failures.push({name,error:e.stack});console.error('FAIL',name,e.stack);}}
function arena(){const s=createGame(23013);startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9});s.terrain.fill(374);s.original.fill(374);s.knownTerrain=[s.terrain.slice(),s.terrain.slice()];return s;}
function until(s,predicate,seconds=12){for(let t=0;t<seconds&&!predicate();t+=DT)tick(s,DT);assert.ok(predicate(),`condition not reached at ${s.time.toFixed(3)}s`);}
function templates(){
 const all={};
 for(const id of ['tank','helicopter']){
 const s=arena();spawnUnit(s,1,id,1800);const u=s.units[0];explode(s,u.x,u.y-20,160,10000,0,1,1,id==='helicopter'?'air':'he');
 assert.ok(u.destroyed,'wreck fixture must come from actual death');
 // Vehicle crew may bail out and perish in the same blast; their bodies are not the fixture under test.
 s.wrecks=s.wrecks.filter(w=>w.cardId===id);s.units=s.units.filter(v=>v.id===id);
 assert.equal(s.wrecks.length,1);
  s.terrain.fill(374);s.original.fill(374);until(s,()=>!s.wrecks[0].falling,5);tick(s,DT);
  all[id]=structuredClone(s.wrecks[0]);assert.ok(obstacleBoxes(s).some(b=>b.wreck?.id===u.uid),'death must produce solid authored wreck geometry');
 }
 return all;
}
const wrecks=templates();
function cover(s,kind,x){
 if(kind==='tank'||kind==='helicopter'){const w={...structuredClone(wrecks[kind]),id:++s.uid,x,y:374,angle:0,falling:false};s.wrecks.push(w);return {wreck:w};}
 const tree=kind.includes('tree'),prop=createScenery(s.terrain,[{id:++s.uid,kind:tree?'tree':'house',x,seed:2,building:0}])[0];s.scenery=[prop];
 if(kind==='house-rubble'||kind==='tree-fallen')damageScenery(s,prop.x,prop.y-50,200,10000);
 if(kind==='house-partial'){const a=prop.parts.find(p=>p.kind==='wall');damageScenery(s,a.x+a.w/2,a.y+a.h/2,1,10000);assert.equal(buildingStage(prop),2);}
 if(kind==='house-rubble')assert.equal(buildingStage(prop),3);
 // Let the authored destruction state mature without injecting substitute boxes.
 s.time+=3;
 return {prop};
}
function launch(side,id){
 const s=arena(),x=n=>side?W-n:n;
 spawnUnit(s,side,id,x(1000));const source=s.units[0];
 spawnUnit(s,1-side,'infantry',x(id==='infantry'?1280:1430));
 spawnUnit(s,side,'scout_drone',x(1350));
 for(const u of s.units){u.cooldown=u===source?0:1e6;u.secondaryCooldown=1e6;u.squadOrder='watch';u.squadOrderX=u.x;u.squadOrderUntil=Infinity;}
 refreshVision(s);until(s,()=>s.projectiles.some(p=>p.sourceUid===source.uid));
 const p=s.projectiles.find(p=>p.sourceUid===source.uid);assert.ok(p);
 const original=structuredClone(p);s.projectiles=[p];s.units=s.units.filter(u=>u.side===side);for(const u of s.units)u.cooldown=u.secondaryCooldown=1e6;
 s.blasts=[];s.particles=[];return{s,p,source,original};
}
function pathSamples(p){
 const samples=[];let previous={x:p.x,y:p.y};
 for(let life=p.life-DT;life>=-DT;life-=DT){const t=1-Math.max(0,life)/p.total,next={x:p.startX+(p.tx-p.startX)*t,y:p.startY+(p.ty-p.startY)*t-4*t*(1-t)*(p.arc??0)};samples.push({previous,next,life});previous=next;}
 return samples;
}
function evidence(name,s,p,extra={}){fs.writeFileSync(path.join(out,name+'-state.json'),JSON.stringify(s));return {shot:{sourceUid:p.sourceUid,ammunition:p.ammunition,shell:p.shell,startX:p.startX,tx:p.tx,ty:p.ty,arc:p.arc},...extra};}
for(const side of [0,1])for(const id of ['mortar','artillery'])for(const kind of ['tank','helicopter','house-rubble','tree-fallen'])check(`${id} side${side} descends through ${kind} and reaches original ground endpoint`,()=>{
 const {s,p,original}=launch(side,id);assert.ok(p.shell);assert.equal(p.ammunition,'mortar');cover(s,kind,p.tx);
 const boxes=obstacleBoxes(s);assert.ok(boxes.length&&boxes.every(b=>b.rubble),'fixture is entirely destroyed cover');
 const crossing=pathSamples(p).map(({previous:a,next:b})=>sceneryIntercept(s,a.x,a.y,b.x,b.y)).find(Boolean);
 assert.ok(crossing,'the actual flight must intersect authored cover rather than simply miss it');assert.ok(crossing.box.rubble);
 until(s,()=>!s.projectiles.includes(p));assert.equal(s.blasts.length,1);const blast=s.blasts[0];
 assert.equal(blast.x,original.tx);assert.equal(blast.kind,'artillery');assert.equal(blast.soil,true);assert.equal(blast.y,ground(s,blast.x));assert.ok(blastVisible(s,side,blast));
 for(let i=0;i<60;i++)tick(s,DT);assert.ok(s.blasts.includes(blast),'authored smoke sequence remains after fire');assert.equal(blast.y,ground(s,blast.x));
 return evidence(`${id}-${side}-${kind}`,s,original,{crossing:{x:crossing.x,y:crossing.y},blast:{x:blast.x,y:blast.y,kind:blast.kind,age:blast.age},wrecks:s.wrecks.length});
});
for(const side of [0,1])for(const kind of ['house-standing','house-partial','tree-standing'])check(`side${side} live ${kind} blocks descending shells but permits ascent`,()=>{
 const s=arena();cover(s,kind,1700);const solids=obstacleBoxes(s).filter(b=>!b.rubble&&!b.foliage),box=solids.find(b=>b.h>35);assert.ok(box);
 const center=box.x+box.w/2,dir=side?-1:1,ray=[center-dir*4,box.y-12,center+dir*4,box.y+Math.min(box.h-2,24)];
 assert.ok(sceneryIntercept(s,...ray));assert.ok(sceneryIntercept(s,...ray,false,false,false,true),'rubble filter must keep live structural piece');
 const shell={shell:true,ammunition:'mortar',startY:350,ty:366,arc:170,total:2,life:.2};
 assert.ok(projectileIntercept(s,shell,...ray));
 const rising={...shell,life:1.9};assert.equal(projectileIntercept(s,rising,ray[2],ray[3],ray[0],ray[1]),null);
 assert.ok(projectileIntercept(s,rising,center,370,center,380),'earth stays solid even while climbing');
 return{ray,solid:{x:box.x,y:box.y,w:box.w,h:box.h},partial:kind==='house-partial'};
});
check('mortar ammunition without legacy shell flag also skips rubble and still hits soil',()=>{
 const s=arena();cover(s,'tank',1700);const box=obstacleBoxes(s)[0],x=box.x+box.w/2,ray=[x,box.y-10,x,box.y+box.h/2];
 const p={ammunition:'mortar',startY:350,ty:366,arc:100,total:2,life:.1};assert.ok(terrainIntercept(s,...ray));assert.equal(projectileIntercept(s,p,...ray),null);
 assert.ok(terrainIntercept(s,x,360,x,390,false,false,true));assert.ok(projectileIntercept(s,p,x,360,x,390));return{ray};
});
for(const side of [0,1])check(`side${side} actual rifle still stops on an authored tank wreck`,()=>{
 const{s,p,original}=launch(side,'infantry');assert.equal(p.ammunition,'rifle');assert.equal(p.radius,0);cover(s,'tank',(p.startX+p.tx)/2);
 const crossing=pathSamples(p).map(({previous:a,next:b})=>sceneryIntercept(s,a.x,a.y,b.x,b.y)).find(Boolean);assert.ok(crossing);
 until(s,()=>!s.projectiles.includes(p));assert.ok(p.life<=0);assert.ok(Math.abs(p.x-original.tx)>25);assert.equal(s.blasts.length,0);assert.ok(s.particles.some(f=>f.kind==='impact'||f.kind==='spark'||f.kind==='dust'));
 return evidence(`rifle-${side}-tank`,s,original,{stopped:{x:p.x,y:p.y},expectedCoverX:crossing.x});
});
check('artillery blast ignores wreck shelter while live house structure and earth retain protection',()=>{
 function damage(kind,blastKind='artillery'){
  const s=arena();spawnUnit(s,1,'infantry',1100);const u=s.units[0];s.units=[u];Object.assign(u,{x:1100,y:374,pose:'idle',motion:'ground',moving:false});
  if(kind==='earth')for(let x=1020;x<1030;x++)s.terrain[x]=320;
  else if(kind)cover(s,kind,1050);
  const before=u.hp;explode(s,950,355,190,30,0,1,1,blastKind);return{loss:before-u.hp,s};
 }
 const open=damage(null),wreck=damage('tank'),aircraft=damage('helicopter'),rubble=damage('house-rubble'),tree=damage('tree-fallen'),house=damage('house-standing'),earth=damage('earth'),heOpen=damage(null,'he'),heWreck=damage('tank','he');
 assert.ok(open.loss>0);for(const scene of [wreck,aircraft,rubble,tree])assert.equal(scene.loss,open.loss);assert.ok(house.loss<open.loss*.6,'standing house must still shield soldiers');assert.ok(earth.loss<open.loss*.6,'real earth must still shield soldiers');assert.ok(heWreck.loss<heOpen.loss*.6,'ordinary direct HE shelter must remain unchanged');
 return{open:open.loss,tankWreck:wreck.loss,aircraftWreck:aircraft.loss,houseRubble:rubble.loss,fallenTree:tree.loss,standingHouse:house.loss,earth:earth.loss,directHE:{open:heOpen.loss,wreck:heWreck.loss}};
});
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({results,failures},null,2));console.log(`${results.length} passed, ${failures.length} failed`);if(failures.length)process.exitCode=1;
