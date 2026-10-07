import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,spawnUnit,tick,refreshVision,vehicleContact,contactSafeX,W,CARDS} from '../game/engine.ts';
import {soldierPose} from '../game/soldier-pose.ts';
const dt=1/60;
function arena(){const s=createGame(227,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;for(const p of s.players)Object.assign(p,{order:'advance',hand:[],deck:[],discard:[],energy:0});return s;}
function one(s,side,id,x,patch={}){const n=s.units.length;spawnUnit(s,side,id,x);const u=s.units[n];s.units.splice(n+1);Object.assign(u,{x,y:374,shots:0,secondaryShots:0,cooldown:0,secondaryCooldown:0,fragCooldown:1e9,pace:1,personalMorale:100,readyAt:-10,rifleReady:1,lane:0,...patch});return u;}
function run(s,t,inspect){for(let i=0;i<Math.ceil(t/dt);i++){tick(s,dt);inspect?.();}}
for(const side of [0,1]){
 const dir=side?-1:1,at=x=>side?W-x:x;
 test(`side ${side}: rifle shoots dismounted infantry beyond unpenetrable APC`,()=>{
  const s=arena(),rifle=one(s,side,'infantry',at(1000),{satchelLeft:0});
  const apc=one(s,1-side,'apc_transport',at(1220),{transportReleased:true,cooldown:1e9,satchelLeft:0,ammo:0});
  apc.squadOrder='watch';apc.squadOrderX=apc.x;apc.squadOrderUntil=Infinity;
  const enemy=one(s,1-side,'infantry',at(1330),{satchelLeft:0});enemy.squadOrder='watch';enemy.squadOrderX=enemy.x;enemy.squadOrderUntil=Infinity;
  refreshVision(s);let softRounds=0;run(s,8,()=>{softRounds+=s.projectiles.filter(p=>p.sourceUid===rifle.uid&&p.targetUid===enemy.uid).length;});
  assert(softRounds>0,'actual resolved target is soldier behind APC');assert.equal(apc.hp,apc.maxHp,'rifle never pierces armored carrier');assert(rifle.shots>0);
 });
 test(`side ${side}: squad answers active carrier and dismounted infantry rather than all freezing`,()=>{
  const s=arena(),lead=one(s,side,'infantry',at(1000),{satchelLeft:0});
  const friends=[lead];for(let n=1;n<5;n++){const u=one(s,side,'infantry',at(1000-n*28),{satchelLeft:0});u.squad=lead.squad;u.member=n;u.lane=[0,-20,20,-10,10][n];friends.push(u);}
  const apc=one(s,1-side,'apc_transport',at(1220),{transportReleased:true}),enemy=one(s,1-side,'infantry',at(1330),{satchelLeft:0});
  for(const u of [apc,enemy])Object.assign(u,{squadOrder:'watch',squadOrderX:u.x,squadOrderUntil:Infinity});
  refreshVision(s);let softRounds=0;run(s,2,()=>{softRounds+=s.projectiles.filter(p=>friends.some(u=>u.uid===p.sourceUid)&&p.targetUid===enemy.uid).length;});
  assert(softRounds>0,'loaded, actively shooting carrier does not hijack soft-target selection');assert(friends.filter(u=>u.shots>0).length>=2,'multiple squad members answer fire');assert(apc.shots>0,'enemy gun really active');assert.equal(apc.hp,apc.maxHp,'rifles still cannot penetrate the hull');
 });
 test(`side ${side}: a close ordinary rifleman plants one finite charge, then breaks contact`,()=>{
  const s=arena(),rifle=one(s,side,'infantry',at(1100)),apc=one(s,1-side,'apc_transport',at(1185),{transportReleased:true,cooldown:1e9});
  apc.squadOrder='watch';apc.squadOrderX=apc.x;apc.squadOrderUntil=Infinity;
  refreshVision(s);let animated=false,attached=false,escaped=false;const start=rifle.x;
  run(s,4,()=>{if(rifle.satchelPlantUntil>s.time){const p=soldierPose(rifle,s.time);animated||=p.action==='plant'&&p.slung;}attached||=!!s.attachedCharges?.length;escaped||=!!s.attachedCharges?.length&&(rifle.x-start)*dir<-10;});
  assert(animated,'dedicated attachment action uses two hands and slung rifle');assert(attached,'charge lives on vehicle until delayed detonation');assert.equal(rifle.satchelLeft,0);assert(apc.hp<=0,'normal 360hp APC destroyed by attached charge');assert(escaped,'runs clear before detonation');
 });
 test(`side ${side}: remote rifleman does not run toward tank to use explosives`,()=>{
  const s=arena(),rifle=one(s,side,'infantry',at(1000)),tank=one(s,1-side,'tank',at(1320),{cooldown:1e9,secondaryCooldown:1e9});tank.squadOrder='watch';tank.squadOrderX=tank.x;tank.squadOrderUntil=Infinity;
  refreshVision(s);run(s,3);assert.equal(rifle.satchelLeft,1);assert.equal(rifle.satchelPlantStartedAt,undefined);assert((rifle.x-at(1000))*dir<=10,'survival before speculative close assault');
 });
 test(`side ${side}: no endless contact wall remains after observation marked clear`,()=>{
  const s=arena(),u=one(s,side,'infantry',at(1000));s.groundContacts=[[],[]];s.groundContacts[side].push({uid:99,id:'apc_transport',x:at(1070),y:374,lane:0,seenAt:0,clearSince:0});
  assert.equal(contactSafeX(s,u,u.x+dir*15),u.x+dir*15);
 });
}
test('wheel contact clears the ledge as soon as the rear tyre does, without nose/body support',()=>{
 const s=arena();for(let x=0;x<1200;x++)s.terrain[x]=300;
 for(const id of ['pickup','apc_transport','supply_truck','scout_car','sam_vehicle']){
  const c=vehicleContact(s,1280,id);assert.equal(c.y,374,`${id} rests on lower road, not cliff behind bumper`);assert.equal(c.angle,0);
 }
 const c=vehicleContact(s,1205,'pickup');assert(c.y>320&&c.angle>.2,'front axle dropping lowers and tilts chassis');
});
test('tracked vehicles still bridge shallow blast crater',()=>{
 const s=arena();for(let x=1190;x<1210;x++)s.terrain[x]=379;const c=vehicleContact(s,1200,'tank');assert.equal(c.y,374);assert.equal(c.angle,0);
});
test('incapacitation cancels planting before consuming stock or attaching charge',()=>{
 const s=arena(),u=one(s,0,'infantry',1100),apc=one(s,1,'apc_transport',1185,{transportReleased:true,cooldown:1e9});refreshVision(s);tick(s,dt);assert(u.satchelPlantUntil>s.time);u.wounded=true;run(s,1.5);assert.equal(u.satchelLeft,1);assert(!s.attachedCharges?.length);assert.equal(apc.hp,apc.maxHp);
});
test('attached demolition retains real friendly blast damage, never friendly immunity',()=>{
 const s=arena(),apc=one(s,1,'apc_transport',1200,{transportReleased:true,cooldown:1e9}),friend=one(s,0,'infantry',1200,{satchelLeft:0});
 s.attachedCharges=[{targetUid:apc.uid,sourceUid:friend.uid,side:0,at:0,x:1200,y:350}];refreshVision(s);tick(s,dt);assert(friend.hp<friend.maxHp||friend.wounded);assert(apc.hp<=0);
});
for(const side of [0,1])for(const id of ['sp_howitzer_122','sp_howitzer_155']){
 const dir=side?-1:1,at=x=>side?W-x:x;
 test(`side ${side}: ${id} holds without a screen, follows a screen from rear`,()=>{
  const s=arena(),gun=one(s,side,id,at(1000));refreshVision(s);run(s,3);assert.equal(gun.x,at(1000),'unsupported battery never scouts forward');
  const screen=one(s,side,'infantry',at(1700),{satchelLeft:0});Object.assign(screen,{squadOrder:'watch',squadOrderX:screen.x,squadOrderUntil:Infinity});run(s,4);
  assert((gun.x-at(1000))*dir>20,'battery follows a real advancing line');assert((screen.x-gun.x)*dir>300,'battery stays behind line');
 });
 test(`side ${side}: ${id} fires indirect shell at observed tank from rear line`,()=>{
  const s=arena(),gun=one(s,side,id,at(1000)),screen=one(s,side,'scouts',at(1900),{satchelLeft:0}),enemy=one(s,1-side,'tank',at(2200),{cooldown:1e9,secondaryCooldown:1e9});
  for(const u of [screen,enemy])Object.assign(u,{squadOrder:'watch',squadOrderX:u.x,squadOrderUntil:Infinity});refreshVision(s);
  let shell=false;run(s,5,()=>{shell||=s.projectiles.some(p=>p.sourceUid===gun.uid&&p.targetUid===enemy.uid);});
  assert(gun.shots>0&&shell,'actual new battery projectile');assert((screen.x-gun.x)*dir>500,'gun does not charge firing target');
 });
}
for(const side of [0,1])for(const id of ['mortar_60','mortar_81','mortar_120','howitzer_105','howitzer_120','howitzer_122','howitzer_152','howitzer_155','howitzer_203','field_gun_85'])test(`side ${side}: ${id} actually fires its own ammunition, not just a card illustration`,()=>{
 const s=arena(),dir=side?-1:1,at=x=>side?W-x:x,c=CARDS[id],distance=Math.max((c.minRange??0)+160,Math.min(c.range-50,c.range*.55));
 const gun=one(s,side,id,at(1000)),observer=one(s,side,'scouts',at(1000+distance-80),{satchelLeft:0}),enemy=one(s,1-side,'tank',at(1000+distance),{cooldown:1e9,secondaryCooldown:1e9});
 for(const u of [observer,enemy])Object.assign(u,{squadOrder:'watch',squadOrderX:u.x,squadOrderUntil:Infinity});refreshVision(s);let projectile=false;
 run(s,6,()=>{projectile||=s.projectiles.some(p=>p.sourceUid===gun.uid&&p.targetUid===enemy.uid);});assert(gun.shots>0&&projectile,'a visible normal-health target receives a real shell');assert(gun.ammo<c.ammoCapacity,'shell consumes finite ammunition');
});
