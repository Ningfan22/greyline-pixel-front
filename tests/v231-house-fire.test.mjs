import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,spawnUnit,tick,refreshVision,W} from '../game/engine.ts';
import {createScenery,obstacleBoxes,segmentBox} from '../game/world.ts';
const DT=1/60;
function field(){const s=createGame(231,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;for(const p of s.players)Object.assign(p,{order:'advance',hand:[],deck:[],discard:[],energy:0});return s;}
function one(s,side,id,x,patch={}){const n=s.units.length;spawnUnit(s,side,id,x);const u=s.units[n];s.units.splice(n+1);Object.assign(u,{x,y:374,shots:0,secondaryShots:0,cooldown:0,secondaryCooldown:0,fragCooldown:1e9,pace:1,personalMorale:100,readyAt:-10,rifleReady:1,lane:0,transportReleased:true,...patch});return u;}
function run(s,seconds,inspect){for(let i=0;i<Math.round(seconds/DT);i++){tick(s,DT);inspect?.();}}
const diagnostic=u=>JSON.stringify({id:u.id,side:u.side,x:u.x,shots:u.shots,coax:u.secondaryShots,hp:u.hp,ammo:u.ammo,goal:u.firingGoal});
for(const side of [0,1]){
 const at=x=>side?W-x:x;
 for(const id of ['pickup','infantry','machinegun','apc_transport','scout_car'])for(const house of ['shooter','between','target'])test(`side ${side}, ${id}, house at ${house}: actual small-arms fire reaches observed infantry`,()=>{
  const s=field(),u=one(s,side,id,at(1100)),foe=one(s,1-side,'infantry',at(1400),{squadOrder:'watch',squadOrderX:at(1400),squadOrderUntil:Infinity,satchelLeft:0});
  s.scenery=createScenery(s.terrain,[{kind:'house',x:at(house==='shooter'?1100:house==='target'?1400:1250),seed:228}]);
  refreshVision(s);let release=false;run(s,30,()=>{release||=s.projectiles.some(p=>p.sourceUid===u.uid&&p.targetUid===foe.uid);});
  assert(release&&u.shots>0,diagnostic(u));assert(foe.hp<foe.maxHp||u.hp<u.maxHp,'physical exchange causes damage: '+diagnostic(u)+' / '+diagnostic(foe));
  if(house==='target'&&['pickup','infantry','machinegun'].includes(id)&&foe.hp>0&&u.hp>0)assert(foe.shots>0,'the surviving defender also fires from the house footprint: '+diagnostic(foe));
 });
 for(const houses of [false,true])for(const trees of [false,true])test(`side ${side}: normal mixed TOW/APC contact exchanges actual fire, houses ${houses}, trees ${trees}`,()=>{
  const s=field(),pickup=one(s,side,'pickup',at(1020)),tow=one(s,side,'tow_ifv',at(1140)),enemyTow=one(s,1-side,'tow_ifv',at(1450)),apc=one(s,1-side,'apc_transport',at(1550));
  if(houses)s.scenery=createScenery(s.terrain,[{kind:'house',x:at(1400),seed:228}]);
  if(trees)s.scenery.push(...createScenery(s.terrain,[{kind:'tree',x:at(1290),seed:228},{kind:'tree',x:at(1330),seed:230}]));
  refreshVision(s);const launches=new Map();run(s,15,()=>{for(const p of s.projectiles)if(p.guided&&[tow.uid,enemyTow.uid].includes(p.sourceUid))launches.set(p.uid,p.sourceUid);});
  assert(tow.shots>0&&enemyTow.shots>0,[tow,enemyTow].map(diagnostic).join('\n'));
  assert([...launches.values()].includes(tow.uid)&&[...launches.values()].includes(enemyTow.uid),'both sides launch physical missiles');
  assert(tow.hp<tow.maxHp,'friendly armor takes real counterfire');assert(enemyTow.hp<enemyTow.maxHp||apc.hp<apc.maxHp,'enemy armor takes real impact');
  assert(pickup.ammo<=600&&tow.ammo<=2,'finite normal ready ammunition');
 });
 test(`side ${side}: coax fires against an observed soldier inside a house`,()=>{
  const s=field(),tow=one(s,side,'tow_ifv',at(1100)),foe=one(s,1-side,'infantry',at(1400),{squadOrder:'watch',squadOrderX:at(1400),squadOrderUntil:Infinity,satchelLeft:0});
  s.scenery=createScenery(s.terrain,[{kind:'house',x:foe.x,seed:228}]);refreshVision(s);let shot=false;run(s,15,()=>{shot||=s.projectiles.some(p=>p.sourceUid===tow.uid&&p.weapon==='coax'&&p.targetUid===foe.uid);});assert(shot&&tow.secondaryShots>0,diagnostic(tow));assert(foe.hp<foe.maxHp);assert.equal(tow.shots,0,'antiarmor launcher does not spend missiles on infantry');
 });
}
for(const side of [0,1])test(`side ${side}: the real guided missile flies around two live trunks and hits normal armor`,()=>{
 const at=x=>side?W-x:x,s=field(),tow=one(s,side,'tow_ifv',at(900),{logisticsOrder:'hold'}),foe=one(s,1-side,'apc_transport',at(1500),{logisticsOrder:'hold',cooldown:1e9});
 one(s,side,'scouts',at(1580),{logisticsOrder:'hold',cooldown:1e9});
 s.scenery=createScenery(s.terrain,[{kind:'tree',x:at(1170),seed:228},{kind:'tree',x:at(1260),seed:230}]);refreshVision(s);let samples=0,missile=false;const previous=new Map();
 run(s,8,()=>{for(const p of s.projectiles)if(p.sourceUid===tow.uid&&p.guided){missile=true;const old=previous.get(p.uid)??{x:p.startX,y:p.startY};for(const b of obstacleBoxes(s).filter(b=>b.prop?.kind==='tree'&&!b.foliage)){assert.equal(segmentBox(old.x,old.y,p.x,p.y,b),null,'the entire physical flight segment must clear the trunk');const centre=b.x+b.w/2;if(Math.min(old.x,p.x)<=centre&&Math.max(old.x,p.x)>=centre&&Math.abs(p.x-old.x)>1e-6){const y=old.y+(p.y-old.y)*(centre-old.x)/(p.x-old.x);assert(y<b.y,'crosses above the live trunk');samples++;}}previous.set(p.uid,{x:p.x,y:p.y});}});
 assert(missile&&samples>0,'physical flight follows the planned raised corridor: '+JSON.stringify({missile,samples,tow:diagnostic(tow),foe:diagnostic(foe),boxes:obstacleBoxes(s).filter(b=>!b.foliage).map(b=>({x:b.x,y:b.y,w:b.w,h:b.h}))}));assert(foe.hp<foe.maxHp,'normal armor receives a real impact');
});
for(const side of [0,1])for(const hills of [false,true])test(`side ${side}: full infantry squads and vehicles exchange fire in a village, hills ${hills}`,()=>{
 const s=field(),at=x=>side?W-x:x;
 if(hills){for(let x=0;x<s.terrain.length;x++)s.terrain[x]=s.original[x]=374+Math.sin((at(x)-700)/130)*18;s.terrainVersion++;}
 spawnUnit(s,side,'infantry',at(1180));spawnUnit(s,side,'pickup',at(1000));spawnUnit(s,1-side,'infantry',at(1440));spawnUnit(s,1-side,'pickup',at(1590));
 const actors=[...s.units];s.scenery=createScenery(s.terrain,[{kind:'house',x:at(1440),seed:228},{kind:'tree',x:at(1290),seed:228}]);refreshVision(s);const fired=new Set();run(s,30,()=>{for(const p of s.projectiles)if(p.sourceUid!==undefined&&p.targetUid!==null&&p.base===null)fired.add(p.sourceUid);});
 for(const faction of [0,1]){const group=actors.filter(u=>u.side===faction);assert(group.filter(u=>fired.has(u.uid)).length>=3,'multiple real squad members and vehicles fire: '+group.map(diagnostic).join('\n'));assert(group.some(u=>u.hp<u.maxHp),'both sides take physical counterfire');}
});
