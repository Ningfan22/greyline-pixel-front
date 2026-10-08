import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,spawnUnit,tick,refreshVision,projectileIntercept,FRIENDLY_BULLET_HIT_CHANCE,W} from '../game/engine.ts';
import {createScenery} from '../game/world.ts';
import {treeCoverBlockChance} from '../game/infantry-training.ts';
import {expansionGunLayout} from '../game/expansion-art-v227.ts';
function field(){const s=createGame(232,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;for(const p of s.players)Object.assign(p,{order:'advance',hand:[],deck:[],discard:[],energy:0});return s;}
function one(s,side,id,x,patch={}){const n=s.units.length;spawnUnit(s,side,id,x);const u=s.units[n];s.units.splice(n+1);Object.assign(u,{x,y:374,shots:0,secondaryShots:0,cooldown:1e9,secondaryCooldown:1e9,fragLeft:0,fragCooldown:1e9,pace:1,personalMorale:100,readyAt:-10,rifleReady:1,lane:0,transportReleased:true,...patch});return u;}
const run=(s,seconds)=>{for(let i=0;i<seconds*60;i++)tick(s,1/60);};
for(const side of [0,1])for(const hold of [false,true])test(`side ${side}: exhausted infantry respects ${hold?'hold':'advance'} near HQ and decorative ruins`,()=>{
 const s=field(),x=side?330:W-330,u=one(s,side,'infantry',x,{ammo:0,ammoReserve:0,logisticsOrder:hold?'hold':'advance',cooldown:0});
 s.scenery=createScenery(s.terrain,[{kind:'house',x:x-80,seed:228}]);for(const p of s.scenery)for(const q of p.parts)if(q.kind==='roof')q.hp=0;
 refreshVision(s);run(s,6);assert.equal(u.shots,0);assert.equal(u.ammo,0);assert.equal(u.ammoReserve,0);if(hold)assert.equal(u.x,x);else if(side) {assert(u.x-x>100);assert.equal(u.resupplyState,'withdrawing');} else assert(u.x-x>100,JSON.stringify(u));
});
for(const id of ['pickup','tow_ifv'])test(id+': friendly crossing no longer permanently disables primary/coax fire',()=>{
 const s=field(),gun=one(s,0,id,1000,{cooldown:0,secondaryCooldown:0,logisticsOrder:'hold'});one(s,0,'infantry',1110,{logisticsOrder:'hold'});one(s,1,'infantry',1300,{logisticsOrder:'hold'});refreshVision(s);run(s,5);assert(gun.shots+gun.secondaryShots>0);assert(gun.ammo<600||gun.secondaryAmmo<200);
});
for(const ammo of ['rifle','machinegun'])for(const missed of [false,true])test(`${ammo}, missed ${missed}: real body crossings damage at 1/60 and rejected hits keep flying`,()=>{
 const s=field(),ally=one(s,0,'infantry',1000,{logisticsOrder:'hold',hp:20000,maxHp:20000});
 for(let i=0;i<6000;i++)s.projectiles.push({uid:++s.uid,sourceUid:99999,x:980,y:368,startX:980,startY:368,tx:1080,ty:368,side:0,targetUid:null,base:null,damage:1,radius:0,total:1,life:1,arc:0,ammunition:ammo,missed,startLane:0,targetLane:0});
 for(let i=0;i<3;i++)tick(s,.05);const firstContactHp=ally.hp;for(let i=0;i<3;i++)tick(s,.05);assert.equal(ally.hp,firstContactHp,'additional frames inside the body cannot roll again');const hits=6000-s.projectiles.length;assert(hits>=65&&hits<=140,'observed hits '+hits);assert.equal(FRIENDLY_BULLET_HIT_CHANCE,1/60);assert.equal(20000-ally.hp,hits*(ammo==='rifle'?5:3),'confirmed friendly hits retain ordinary bullet lethality');const survivors=[...s.projectiles];assert(survivors.length>5800);assert(survivors.every(p=>p.x>1000&&p.passedFriendlies.includes(ally.uid)));const before=ally.hp;tick(s,.01);assert.equal(ally.hp,before,'same round overlapping the body cannot roll again');
});
test('physical rounds outside the friendly depth lane cannot cause friendly damage',()=>{
 const s=field(),ally=one(s,0,'infantry',1000,{logisticsOrder:'hold'});for(let i=0;i<600;i++)s.projectiles.push({uid:++s.uid,sourceUid:99999,x:980,y:368,startX:980,startY:368,tx:1080,ty:368,side:0,targetUid:null,base:null,damage:1,radius:0,total:1,life:1,arc:0,ammunition:'rifle',startLane:30,targetLane:30});for(let i=0;i<6;i++)tick(s,.05);assert.equal(ally.hp,ally.maxHp);
});
for(const kind of ['tree','house'])test(kind+': sniper gap selection reduces tree interceptions while house cover stays intact',()=>{
 function blocked(id){const s=field();s.scenery=createScenery(s.terrain,[{kind,x:1300,seed:228}]);let count=0;for(let i=0;i<5000;i++){const p={startX:900,startY:350,tx:1500,ty:350,radius:0,ammunition:'rifle',treeCoverBlockChance:treeCoverBlockChance({id}),total:1,life:.5};count+=!!projectileIntercept(s,p,900,350,1500,350);}return count;}
 const regular=blocked('infantry'),sniper=blocked('sniper');assert(regular>2200&&regular<2800,'regular '+regular);if(kind==='tree')assert(sniper>150&&sniper<350,'sniper '+sniper);else assert.equal(sniper,regular);
});
for(const id of ['sp_howitzer_122','sp_howitzer_155'])test(id+': gun fits the armored carriage without stretching or a giant muzzle',()=>{const a=expansionGunLayout(id);assert(a.barrelLength<a.bodyWidth*.6);assert(a.barrelHeight<23);assert(a.bodyWidth<=185);});

test('a soil impact prevents friendly rolls behind the impact point',()=>{
 const s=field(),ally=one(s,0,'infantry',1000,{logisticsOrder:'hold'});for(let x=985;x<990;x++)s.terrain[x]=350;s.terrainVersion++;
 for(let i=0;i<500;i++)s.projectiles.push({uid:++s.uid,sourceUid:99999,x:980,y:368,startX:980,startY:368,tx:1080,ty:368,side:0,targetUid:null,base:null,damage:1,radius:0,total:1,life:1,arc:0,ammunition:'rifle',startLane:0,targetLane:0});
 for(let i=0;i<6;i++)tick(s,.05);assert.equal(ally.hp,ally.maxHp);assert.equal(s.projectiles.length,0);
});

test('actual sniper fire snapshots its tree gap skill into the released round',()=>{
 const s=field(),sniper=one(s,0,'sniper',1000,{cooldown:0,logisticsOrder:'hold'});one(s,1,'infantry',1300,{logisticsOrder:'hold'});refreshVision(s);let released;
 for(let i=0;i<600&&!released;i++){tick(s,1/60);released=s.projectiles.find(p=>p.sourceUid===sniper.uid);}
 assert(released,'normal sniper releases a physical bullet');assert.equal(released.treeCoverBlockChance,.05);
});
