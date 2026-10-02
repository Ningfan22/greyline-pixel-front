import assert from 'node:assert/strict';
import test from 'node:test';
import {
  damageVehicleTracks, advanceTrackRepair, isImmobilized, vehicleNeedsRepair,
  TRACK_REPAIR_SECONDS,
} from '../game/vehicle-damage.ts';
import { pickRepairVehicle, atRepairContact, repairStation } from '../game/repair-work.ts';

function vehicle(patch = {}) {
  return {id:'tank',uid:1,side:0,x:1000,y:374,hp:650,maxHp:650,hullAngle:0,
    motion:'ground',moving:false,fire:.1,secondaryFire:.1,cooldown:3,
    facing:1,aimUntil:20,...patch};
}
function lowHit(u, patch = {}) {
  return {damage:80,source:'blast',ammunition:'cannon',hitX:u.x+40,hitY:u.y-6,
    time:1,...patch};
}

test('normal upper-hull hits damage no running gear; real repeated low HE hits can immobilize', () => {
  const u = vehicle();
  for (let i=0;i<10;i++) {
    assert.equal(damageVehicleTracks(u,lowHit(u,{hitY:u.y-40,time:i+1})),false);
    assert.equal(isImmobilized(u),false);
  }
  assert.equal(u.trackIntegrity,undefined);
  assert.equal(damageVehicleTracks(u,lowHit(u)),false);
  assert(u.trackIntegrity>0 && u.trackIntegrity<100);
  assert.equal(isImmobilized(u),false);
  let broken = false;
  for (let i=0;i<6&&!broken;i++) broken=damageVehicleTracks(u,lowHit(u,{time:i+2}));
  assert(broken);assert.equal(u.trackIntegrity,0);assert(isImmobilized(u));
});

test('a strong lower penetration or antitank mine stops motion but leaves turret and both guns usable', () => {
  for (const hit of [{source:'bullet',ammunition:'ap',damage:390},
    {source:'blast',ammunition:undefined,damage:260}]) {
    const u=vehicle({moving:true});
    assert(damageVehicleTracks(u,lowHit(u,hit)));
    assert.equal(u.moving,false);assert(isImmobilized(u));
    assert.equal(u.hp,650);assert.equal(u.fire,.1);assert.equal(u.secondaryFire,.1);
    assert.equal(u.cooldown,3);assert.equal(u.aimUntil,20);assert.equal(u.facing,1);
  }
});

test('rifles, coax guns, gas, flamethrowers and blocked autocannon cannot shoot out tank tracks', () => {
  const u=vehicle();
  for (const ammunition of ['rifle','machinegun','flame','grenade','autocannon'])
    for(let i=0;i<12;i++) damageVehicleTracks(u,lowHit(u,{source:'bullet',ammunition,damage:500}));
  damageVehicleTracks(u,lowHit(u,{source:'gas',damage:500}));
  assert.equal(u.trackIntegrity,undefined);assert.equal(isImmobilized(u),false);
  const ifv=vehicle({id:'ifv'});
  damageVehicleTracks(ifv,lowHit(ifv,{source:'bullet',ammunition:'autocannon',damage:13}));
  assert(ifv.trackIntegrity<100 && ifv.trackIntegrity>0);
});

test('nearby explosion and out-of-footprint hits cannot immobilize a distant tank; hull slope is respected', () => {
  const u=vehicle();
  assert.equal(damageVehicleTracks(u,lowHit(u,{damage:500,hitX:u.x+180})),false);
  assert.equal(damageVehicleTracks(u,lowHit(u,{damage:500,hitY:u.y-80})),false);
  assert.equal(damageVehicleTracks(u,lowHit(u,{damage:500,hitY:u.y+40})),false);
  assert.equal(damageVehicleTracks(u,lowHit(u,{damage:500,hitX:undefined})),false);
  assert.equal(u.trackIntegrity,undefined);
  for (const angle of [-.3,.3]) {
    const tilted=vehicle({hullAngle:angle}),x=65,y=-6;
    assert(damageVehicleTracks(tilted,lowHit(tilted,{damage:390,source:'bullet',ammunition:'ap',
      hitX:tilted.x+x*Math.cos(angle)-y*Math.sin(angle),
      hitY:tilted.y+x*Math.sin(angle)+y*Math.cos(angle)})));
  }
});

test('aircraft, foot soldiers, fixed gun pits and wrecks never acquire a broken track state', () => {
  for (const patch of [{id:'helicopter'},{id:'infantry'},{id:'fort_bunker'},{id:'tank',hp:0}]) {
    const u=vehicle(patch);
    assert.equal(damageVehicleTracks(u,lowHit(u,{damage:1000})),false);
    assert.equal(u.trackIntegrity,undefined);assert.equal(isImmobilized(u),false);
  }
});

test('full hull health does not restore a broken track; six actual stationary repair seconds do', () => {
  const u=vehicle();damageVehicleTracks(u,lowHit(u,{damage:390}));
  assert(vehicleNeedsRepair(u));assert(isImmobilized(u));
  for (let i=1;i<TRACK_REPAIR_SECONDS*4;i++) {
    assert.equal(advanceTrackRepair(u,.25,1+i*.25),false);
    assert(isImmobilized(u));
  }
  assert(advanceTrackRepair(u,.25,1+TRACK_REPAIR_SECONDS));
  assert.equal(isImmobilized(u),false);assert.equal(u.trackIntegrity,100);
  assert.equal(u.trackRepairProgress,0);assert.equal(vehicleNeedsRepair(u),false);
});

test('multiple mechanics and a repair card cannot count the same repair second repeatedly', () => {
  const u=vehicle({trackIntegrity:0});
  for (let i=1;i<=20;i++) {
    const time=i*.25;
    advanceTrackRepair(u,.25,time);
    advanceTrackRepair(u,.25,time);
    advanceTrackRepair(u,.25,time);
  }
  assert.equal(u.trackRepairProgress,5);assert(isImmobilized(u));
  assert.equal(advanceTrackRepair(u,-1,6),false);
  assert.equal(advanceTrackRepair(u,.25,4),false);
  assert(isImmobilized(u));
  for(let i=21;i<=24;i++) advanceTrackRepair(u,.25,i*.25);
  assert.equal(isImmobilized(u),false);
});

test('leaving the job, airborne hulls and further enemy track hits do not produce free repair progress', () => {
  const u=vehicle({trackIntegrity:0});
  advanceTrackRepair(u,2,2);assert.equal(u.trackRepairProgress,2);
  u.moving=true;assert.equal(advanceTrackRepair(u,2,4),false);
  u.moving=false;u.motion='jump';assert.equal(advanceTrackRepair(u,2,6),false);
  u.motion='ground';assert.equal(u.trackRepairProgress,2);
  damageVehicleTracks(u,lowHit(u,{time:6,damage:260}));assert.equal(u.trackRepairProgress,0);
  assert.equal(advanceTrackRepair(u,1,6),false);
  advanceTrackRepair(u,1,7);assert.equal(u.trackRepairProgress,1);assert(isImmobilized(u));
});

test('mechanics find full-health immobilized armor, reserve real hull ends and release repaired targets', () => {
  const worker=vehicle({id:'combat_engineers',uid:2,x:900,repairTargetUid:undefined});
  const damaged=vehicle({uid:3,x:1100,hp:500});
  const stuck=vehicle({uid:4,x:1050,trackIntegrity:0});
  const s={time:0,terrain:new Array(4096).fill(374),units:[worker,damaged,stuck]};
  assert.equal(pickRepairVehicle(s,worker),stuck);
  worker.x=repairStation(worker,stuck);assert(atRepairContact(worker,stuck));
  stuck.hp=stuck.maxHp;assert.equal(pickRepairVehicle(s,worker),stuck);
  stuck.trackIntegrity=100;assert.equal(pickRepairVehicle(s,worker),damaged);
  damaged.hp=damaged.maxHp;assert.equal(pickRepairVehicle(s,worker),undefined);
});
