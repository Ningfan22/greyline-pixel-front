import assert from 'node:assert/strict';
import test from 'node:test';
import {createGame,startGame,spawnUnit} from '../game/engine.ts';
import {
  ammoProfile,ammoSummary,ammoRatio,initializeAmmo,advanceSecondaryReload,
  planAmmoResupply,AMMO_LOW_RATIO,SUPPLY_CARRY,AMMO_CRATE_STOCK,
} from '../game/ammo-logistics.ts';

function arena(side=0) {
  const s=createGame(195201+side);startGame(s);s.units=[];s.ammoCrates=[];
  s.aiIn=1e9;s.terrain.fill(374);s.original.fill(374);s.walls=[];s.scenery=[];
  s.weather.disabled=true;s.time=0;return s;
}
const mirrored=(s,side,x)=>side===0?x:s.terrain.length-x;
function one(s,side,id='infantry',x=1000,member=0) {
  const n=s.units.length;spawnUnit(s,side,id,x,{member});
  const u=s.units[n];s.units.splice(n+1);Object.assign(u,{x,y:374,moving:false,
    motion:'ground',wounded:false,surrendered:false,parachuting:false,rappelling:false,
    resupplyState:undefined,resupplyGoal:undefined});initializeAmmo(u);return u;
}
function total(u,channel,value) {
  const p=ammoProfile(u)[channel],loaded=Math.min(value,p.mag),reserve=value-loaded;
  if(channel==='primary'){u.ammo=loaded;u.ammoReserve=reserve;}
  else{u.secondaryAmmo=loaded;u.secondaryAmmoReserve=reserve;}
}
function ratio(u,value,channel='primary') {
  const spec=ammoProfile(u)[channel];total(u,channel,Math.floor((spec.mag+spec.reserve)*value));
}
function crate(s,side,x,patch={}) {
  const c={uid:++s.uid,side,x,stock:AMMO_CRATE_STOCK,maxStock:AMMO_CRATE_STOCK,
    landAt:3,expiresAt:180,...patch};s.ammoCrates.push(c);return c;
}
function step(s,u,seconds=1,dt=.1) {
  for(let i=0;i<Math.round(seconds/dt);i++){s.time+=dt;planAmmoResupply(s,u,dt);}
}

test('every soldier and ground weapon starts with a finite personal load, including launchers and gun pits',()=>{
  const s=arena();
  for(const id of ['infantry','militia','machinegun','heavy_mg','rocket','javelin',
    'mortar','artillery','anti_tank_gun','aa_gun','ifv','tank','heavy_tank']) {
    const u=one(s,0,id),profile=ammoProfile(u);
    assert(profile.primary,`${id} must have its own finite load`);
    assert(Number.isFinite(profile.primary.mag)&&profile.primary.mag>0);
    assert(Number.isFinite(profile.primary.reserve)&&profile.primary.reserve>=0);
    assert.equal(u.ammo,profile.primary.mag);assert.equal(u.ammoReserve,profile.primary.reserve);
    total(u,'primary',0);assert.equal(ammoSummary(u).find(r=>r.channel==='primary').total,0);
    initializeAmmo(u);assert.equal(u.ammo,0,'initialization must never refill an exhausted weapon');
  }
  const a=one(s,0,'infantry',1000,0),b=one(s,0,'infantry',1000,1);
  total(a,'primary',0);assert(ammoRatio(b)>0,'one empty soldier cannot empty his squadmates');
});

test('tank shells and coax ammunition are separate stores and coax reload never creates shells',()=>{
  const u=one(arena(),0,'tank'),profile=ammoProfile(u);
  assert(profile.primary&&profile.secondary);
  const coax=u.secondaryAmmo,spare=u.secondaryAmmoReserve;
  total(u,'primary',0);assert.equal(u.secondaryAmmo,coax);assert.equal(u.secondaryAmmoReserve,spare);
  const rows=ammoSummary(u);assert.equal(rows.length,2);
  assert.equal(rows.find(r=>r.channel==='primary').total,0);
  assert(rows.find(r=>r.channel==='secondary').total>0);
  u.secondaryAmmo=0;u.secondaryAmmoReserve=20;
  advanceSecondaryReload(u,10);assert.equal(u.secondaryAmmo,0);
  advanceSecondaryReload(u,10+profile.secondary.reload-.1);assert.equal(u.secondaryAmmo,0);
  advanceSecondaryReload(u,10+profile.secondary.reload);
  assert.equal(u.secondaryAmmo,20);assert.equal(u.secondaryAmmoReserve,0);
  assert.equal(u.ammo,0);assert.equal(u.ammoReserve,0);
});

for(const side of [0,1]) {
  test(`side ${side}: thirty percent latches withdrawal and partial refill cannot resume the advance`,()=>{
    const s=arena(side),x=mirrored(s,side,1600),u=one(s,side,'infantry',x);
    const profile=ammoProfile(u).primary;
    // The first whole round above the cutoff stays out of withdrawal. With
    // 90 rounds, flooring 31 percent would accidentally produce exactly 30.
    total(u,'primary',Math.floor((profile.mag+profile.reserve)*AMMO_LOW_RATIO)+1);
    assert.equal(planAmmoResupply(s,u,0),null);
    ratio(u,AMMO_LOW_RATIO);
    u.escortTankUid=123;u.escortGoal=x;u.coverGoal=x;u.firingGoal=x;u.withdrawGoal=x;
    const base=mirrored(s,side,110);
    assert.equal(planAmmoResupply(s,u,0),base);assert.equal(u.resupplyState,'withdrawing');
    assert.equal(u.resupplyReturnX,x);assert.equal(u.escortTankUid,undefined);
    assert.equal(u.coverGoal,null);assert.equal(u.firingGoal,null);
    u.x=base;s.time+=1;planAmmoResupply(s,u,.1);
    assert(ammoRatio(u)>AMMO_LOW_RATIO && ammoRatio(u)<1);
    assert.equal(u.resupplyState,'supplying','crossing back over thirty percent must not release withdrawal');
    step(s,u,5);assert.equal(ammoRatio(u),1);assert.equal(u.resupplyState,undefined);
    assert.equal(u.tactic,'advance');assert.equal(u.squadOrder,'attack');
  });

  test(`side ${side}: a unit already in a supply circle still waits for a full load when it reaches thirty percent`,()=>{
    const s=arena(side),x=mirrored(s,side,1600),u=one(s,side,'infantry',x);
    const box=crate(s,side,x,{landAt:0});ratio(u,AMMO_LOW_RATIO);
    s.time=.1;assert.equal(planAmmoResupply(s,u,.1),u.x);
    assert(ammoRatio(u)>AMMO_LOW_RATIO && ammoRatio(u)<1);
    assert.equal(u.resupplyState,'supplying');assert(box.stock<AMMO_CRATE_STOCK);
    step(s,u,5);assert.equal(ammoRatio(u),1);assert.equal(u.resupplyState,undefined);
  });

  test(`side ${side}: supply selection uses the closest friendly usable source and replans when it is exhausted`,()=>{
    const s=arena(side),x=mirrored(s,side,1700),u=one(s,side,'tank',x);
    ratio(u,.1);const near=crate(s,side,mirrored(s,side,1300),{landAt:0});
    const far=crate(s,side,mirrored(s,side,900),{landAt:0});
    crate(s,1-side,mirrored(s,side,1650),{landAt:0});
    assert.equal(planAmmoResupply(s,u,0),near.x);
    near.stock=0;assert.equal(planAmmoResupply(s,u,0),far.x);
    far.stock=0;assert.equal(planAmmoResupply(s,u,0),mirrored(s,side,110));
    assert.equal(u.resupplyState,'withdrawing');
  });

  test(`side ${side}: exhausted supply groups return to their own base and fill the whole carry before leaving`,()=>{
    const s=arena(side),x=mirrored(s,side,1600),u=one(s,side,'supply_team',x);
    assert.equal(u.supplyStock,SUPPLY_CARRY);u.supplyStock=0;
    crate(s,side,x,{landAt:0});
    const base=mirrored(s,side,110);
    assert.equal(planAmmoResupply(s,u,0),base,'a soldier must refill his supply pack at base');
    assert.equal(u.resupplyState,'withdrawing');u.x=base;
    step(s,u,2);assert(u.supplyStock>SUPPLY_CARRY*AMMO_LOW_RATIO&&u.supplyStock<SUPPLY_CARRY);
    assert.equal(u.resupplyState,'supplying','a partially refilled supply pack cannot resume marching');
    step(s,u,4);assert.equal(u.supplyStock,SUPPLY_CARRY);assert.equal(u.resupplyState,undefined);
  });
}

test('airdrop ammo is unavailable before its three second landing and is never shared with enemies',()=>{
  const s=arena(),u=one(s,0,'infantry',1400),foe=one(s,1,'infantry',1400);
  const box=crate(s,0,1400);ratio(u,0);ratio(foe,0);
  s.time=2.99;assert.equal(planAmmoResupply(s,u,.1),110);assert.equal(u.ammo,0);
  assert.equal(box.stock,AMMO_CRATE_STOCK);
  s.time=3;assert.equal(planAmmoResupply(s,u,.1),1400);assert(u.ammo>0);
  const remaining=box.stock;assert.equal(planAmmoResupply(s,foe,.1),s.terrain.length-110);
  assert.equal(foe.ammo,0);assert.equal(box.stock,remaining);
  s.time=181;assert.equal(planAmmoResupply(s,u,0),110,'expired boxes cannot hold a retreating unit forever');
});

test('supply stock is consumed at weapon-specific cost and a box too empty for a shell is skipped',()=>{
  const s=arena(),u=one(s,0,'tank',1500),p=ammoProfile(u);
  total(u,'primary',p.primary.mag-1);const box=crate(s,0,1500,{landAt:0,stock:6});
  s.time=1;planAmmoResupply(s,u,.5);assert.equal(u.ammo,p.primary.mag);assert.equal(box.stock,0);
  const rocket=one(s,0,'rocket',1800);total(rocket,'primary',0);
  const useless=crate(s,0,1700,{landAt:0,stock:5});
  const usable=crate(s,0,1400,{landAt:0,stock:120});
  assert.equal(planAmmoResupply(s,rocket,0),usable.x,'insufficient stock must not trap a rocket team beside an unusable box');
  assert.equal(useless.stock,5);
});

test('finite supply soldiers transfer actual carried stock and are unavailable while withdrawing for more',()=>{
  const s=arena(),u=one(s,0,'infantry',1500),supplier=one(s,0,'supply_team',1480);
  ratio(u,0);supplier.supplyStock=30;s.time=1;
  planAmmoResupply(s,u,1);assert.equal(u.ammo,30);assert.equal(supplier.supplyStock,0);
  assert.equal(planAmmoResupply(s,u,0),110,'empty supplier must cease being a valid source immediately');
  supplier.supplyStock=SUPPLY_CARRY;supplier.resupplyState='withdrawing';
  assert.equal(planAmmoResupply(s,u,0),110,'a withdrawing logistics soldier cannot advertise a moving supply source');
  supplier.resupplyState=undefined;assert.equal(planAmmoResupply(s,u,0),u.x);
});

test('a tank cannot leave its supply source while either independent weapon channel is below full',()=>{
  const s=arena(),u=one(s,0,'tank',1200),p=ammoProfile(u);ratio(u,0,'secondary');
  assert.equal(planAmmoResupply(s,u,0),110);u.x=110;
  step(s,u,1);assert.equal(u.ammo,p.primary.mag);assert(u.secondaryAmmo>0);
  assert(ammoRatio(u)<1);assert.equal(u.resupplyState,'supplying');
  step(s,u,35);assert.equal(ammoRatio(u),1);assert.equal(u.resupplyState,undefined);
});

test('a supply pack at thirty percent inside its own base remains parked until completely replenished',()=>{
  const s=arena(),u=one(s,0,'supply_team',110);u.supplyStock=SUPPLY_CARRY*AMMO_LOW_RATIO;
  s.time=.1;assert.equal(planAmmoResupply(s,u,.1),u.x);
  assert(u.supplyStock>SUPPLY_CARRY*AMMO_LOW_RATIO && u.supplyStock<SUPPLY_CARRY);
  assert.equal(u.resupplyState,'supplying');
  step(s,u,4);assert.equal(u.supplyStock,SUPPLY_CARRY);assert.equal(u.resupplyState,undefined);
});

test('fixed cannon and immobilized hulls wait at their position for supply instead of planning impossible marches',()=>{
  for(const [id,patch] of [['artillery',{}],['tank',{trackIntegrity:0}]]) {
    const s=arena(),u=one(s,0,id,1700);Object.assign(u,patch);ratio(u,0);
    assert.equal(planAmmoResupply(s,u,0),null,'waiting guns keep firing remaining rounds without a movement goal');
    assert.equal(u.resupplyState,'waiting');
    const box=crate(s,0,u.x,{landAt:0});
    step(s,u,1);assert.equal(u.resupplyState,'supplying');assert(ammoRatio(u)>0);
    step(s,u,30);assert.equal(ammoRatio(u),1);assert.equal(u.resupplyState,undefined);
    assert(box.stock<AMMO_CRATE_STOCK);
  }
});

test('wounded, surrendered, descending and aircraft units cannot absorb ground ammunition',()=>{
  for(const patch of [{wounded:true},{surrendered:true},{parachuting:true},{rappelling:true},{hp:0}]) {
    const s=arena(),u=one(s,0,'infantry',1000);Object.assign(u,patch);ratio(u,0);
    const box=crate(s,0,1000,{landAt:0});
    assert.equal(planAmmoResupply(s,u,1),null);assert.equal(box.stock,AMMO_CRATE_STOCK);
  }
  const s=arena(),air=one(s,0,'helicopter',1000),box=crate(s,0,1000,{landAt:0});
  assert.equal(ammoProfile(air).primary,null);assert.equal(planAmmoResupply(s,air,1),null);
  assert.equal(box.stock,AMMO_CRATE_STOCK);
});

for(const side of [0,1]) {
  test(`side ${side}: a box ahead cannot lure a low-ammo soldier forward, but a circle already in reach permits stationary supply`,()=>{
    const s=arena(side),x=mirrored(s,side,1600),u=one(s,side,'infantry',x);
    ratio(u,.1);
    const beyond=crate(s,side,mirrored(s,side,1850),{landAt:0});
    assert.equal(planAmmoResupply(s,u,0),mirrored(s,side,110));
    assert.equal(u.resupplyState,'withdrawing');assert.equal(beyond.stock,AMMO_CRATE_STOCK);
    const within=crate(s,side,mirrored(s,side,1700),{landAt:0}),before=u.ammo+u.ammoReserve;
    s.time=.1;assert.equal(planAmmoResupply(s,u,.1),x);
    assert.equal(u.resupplyState,'supplying');assert.equal(u.x,x);
    assert(u.ammo+u.ammoReserve>before);assert(within.stock<AMMO_CRATE_STOCK);
    assert.equal(beyond.stock,AMMO_CRATE_STOCK);
  });
}
