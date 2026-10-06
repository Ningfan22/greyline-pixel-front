import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,spawnUnit,tick,refreshVision,projectileIntercept,directShotIntercept} from '../game/engine.ts';
import {createScenery,obstacleBoxes,segmentBox,visibleToSide} from '../game/world.ts';
import {guidedCoverRoute,guidedShotIntercept,guidedSegmentIntercept} from '../game/guided-cover.ts';
const DT=1/60;
function field(){const s=createGame(215,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;for(const p of s.players)Object.assign(p,{hand:[],deck:[],discard:[],energy:0,recon:0});return s;}
function unit(s,side,id,x){const n=s.units.length;spawnUnit(s,side,id,x);s.units.splice(n+1);const u=s.units[n];Object.assign(u,{x,y:374,squadOrder:'watch',squadOrderX:x,squadOrderUntil:Infinity,logisticsOrder:'hold',emplaced:true,emplacementSetupUntil:0,cooldown:0,secondaryCooldown:1e9,personalMorale:100});return u;}
function scenario(side,id,houseCount=1){const s=field(),sx=side?1450:700,tx=side?700:1450;const u=unit(s,side,id,sx),target=unit(s,1-side,'heavy_tank',tx);Object.assign(target,{hp:10000,maxHp:10000,cooldown:1e9});unit(s,side,'scouts',tx+(side?-30:30)).cooldown=1e9;s.scenery=createScenery(s.terrain,Array.from({length:houseCount},(_,i)=>({kind:'house',x:houseCount===1?1075:950+i*250,seed:215+i})));refreshVision(s);return {s,u,target};}
for(const side of [0,1])for(const id of ['tow_ifv','javelin'])for(const houses of [1,2])test(`${id}, side ${side}, ${houses} houses: real guided shot clears roofs and damages observed armor`,()=>{
 const {s,u,target}=scenario(side,id,houses),originalHouseHp=s.scenery.map(p=>p.parts.map(v=>v.hp));assert(visibleToSide(s,side,target),'forward observer must actually see the target');let missile,roofSamples=0;
 for(let i=0;i<480;i++){tick(s,DT);const p=s.projectiles.find(p=>p.sourceUid===u.uid&&p.guided);if(p){missile??=p;for(const b of obstacleBoxes(s).filter(b=>b.prop?.kind==='house')){assert(!(p.x>b.x&&p.x<b.x+b.w&&p.y>b.y&&p.y<b.y+b.h),'missile must not cut through the house pixels');if(p.x>b.x&&p.x<b.x+b.w&&p.y<b.y)roofSamples++;}}if(target.hp<target.maxHp)break;}
 assert(missile,'launcher must fire, rather than wait forever for a straight ray');assert(roofSamples>0,'physical flight passes above a roof');assert(target.hp<target.maxHp,'tracked armor takes the actual impact');assert.deepEqual(s.scenery.map(p=>p.parts.map(v=>v.hp)),originalHouseHp,'intervening walls do not eat the missile');
});
test('house waiver applies only to guided rounds; regular rockets, tank shells and rifles still meet the wall',()=>{
 const {s}=scenario(0,'tow_ifv');const segment=[820,330,1350,330];assert.equal(guidedShotIntercept(s,...segment),null);const route=guidedCoverRoute(s,...segment);assert.equal(route.length,2);let [x,y]=segment;
 for(const point of [...route,{x:segment[2],y:segment[3]}]){for(const b of obstacleBoxes(s).filter(b=>b.prop?.kind==='house'))assert.equal(segmentBox(x,y,point.x,point.y,b),null);[x,y]=[point.x,point.y];}
 for(const ammunition of ['rocket','cannon']){assert(projectileIntercept(s,{ammunition,guided:false,radius:ammunition==='rifle'?0:8,startX:500,startY:330,tx:1350,ty:330,life:1,total:2},...segment),ammunition);assert(directShotIntercept(s,ammunition,...segment),ammunition);}
 let blocked=0;for(let i=0;i<100;i++)if(projectileIntercept(s,{ammunition:'rifle',radius:0,startX:500,startY:330,tx:1350,ty:330,life:1,total:2},...segment))blocked++;assert(blocked>0&&blocked<100,'rifles retain probabilistic depth cover');
 assert.equal(projectileIntercept(s,{ammunition:'rocket',guided:true,startX:820,startY:330,tx:1350,ty:330,life:1,total:2},...segment),null);
});
test('guided missiles still collide with solid earth',()=>{const s=field();for(let x=1000;x<1100;x++)s.terrain[x]=250;s.terrainVersion++;assert(projectileIntercept(s,{guided:true,ammunition:'rocket',life:1,total:2},800,330,1250,330));assert(guidedShotIntercept(s,800,330,1250,330));});
test('a building does not reveal hidden armor or allow a smoke lock',()=>{
 for(const smoke of [false,true]){const {s,u,target}=scenario(0,'tow_ifv');if(smoke)s.smokes=[{x:1060,side:1,life:20}];else s.units=s.units.filter(v=>v.side!==0||v===u);refreshVision(s);if(!smoke)assert(!visibleToSide(s,0,target));for(let i=0;i<180;i++)tick(s,DT);assert.equal(u.shots,0,smoke?'smoke still prevents launch':'no observed target means no launch');assert.equal(target.hp,target.maxHp);}
});
test('an expired guided missile never damages an unvisited target through the house',()=>{const {s,u,target}=scenario(0,'tow_ifv');s.projectiles.push({guided:true,sourceUid:u.uid,side:0,targetUid:target.uid,x:820,y:320,startX:820,startY:320,tx:target.x,ty:330,life:.001,total:1,ammunition:'rocket',damage:1000,radius:8});u.cooldown=1e9;tick(s,DT);assert.equal(target.hp,target.maxHp);});

test('ground guidance still meets live trees, but passes decorative wrecks',()=>{for(const obstacle of ['tree','wreck']){const s=field();if(obstacle==='tree')s.scenery=createScenery(s.terrain,[{kind:'tree',x:1075,seed:215}]);else s.wrecks=[{id:1,cardId:'tank',x:1075,y:374,side:0,angle:0,age:5,falling:false,vx:0,vy:0}];const hit=guidedSegmentIntercept(s,800,360,1350,360);if(obstacle==='tree')assert(hit,obstacle);else assert.equal(hit,null,obstacle);}});
