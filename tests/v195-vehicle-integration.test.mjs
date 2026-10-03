import assert from 'node:assert/strict';
import test from 'node:test';
import { issueLogisticsOrder } from '../game/logistics-orders.ts';
import {createGame,startGame,spawnUnit,tick,playCard,refreshVision,setOrder,CARDS} from '../game/engine.ts';
import {isImmobilized} from '../game/vehicle-damage.ts';
import {repairStation} from '../game/repair-work.ts';

const DT=.05;
const dir=side=>side===0?1:-1;
const mx=(s,side,x)=>side===0?x:s.terrain.length-x;
function arena() {
  const s=createGame(195113);startGame(s);s.aiIn=1e9;s.units=[];s.walls=[];s.scenery=[];
  s.terrain.fill(374);s.original.fill(374);s.weather.disabled=true;s.night=false;
  s.players.forEach(p=>p.energy=30);setOrder(s,0,'advance');setOrder(s,1,'hold');
  return s;
}
function one(s,side,id,x,patch={}) {
  const before=s.units.length;spawnUnit(s,side,id,x,{member:0});
  const u=s.units[before];s.units.splice(before+1);
  Object.assign(u,{x,y:374,readyAt:-100,personalMorale:100,suppression:0,
    decisionIn:1e6,fragLeft:0,cooldown:1e6,squadOrder:'watch',squadOrderX:x,
    squadOrderUntil:Infinity,...patch});return u;
}
function run(s,seconds) {for(let i=0;i<Math.round(seconds/DT);i++)tick(s,DT);}
function until(s,predicate,seconds) {
  for(let i=0;i<Math.round(seconds/DT);i++) {tick(s,DT);if(predicate())return true;}
  return false;
}
function breakWithProjectile(s,tank,attacker) {
  s.projectiles.push({uid:++s.uid,side:attacker.side,sourceUid:attacker.uid,targetUid:tank.uid,
    base:null,ammunition:'ap',damage:260,radius:0,startX:tank.x-dir(tank.side)*10,
    startY:tank.y-6,x:tank.x-dir(tank.side)*10,y:tank.y-6,tx:tank.x,ty:tank.y-6,
    life:.01,total:.01});
  tick(s,DT);assert(isImmobilized(tank),'real low projectile must break running gear');
  assert.equal(tank.hp,390);
}
function useRepair(s,side) {
  const h={id:'repair',uid:++s.uid};s.players[side].hand.push(h);
  assert(playCard(s,side,h.uid).ok);
}

for(const side of [0,1]) {
  test(`side ${side}: real AP track damage blocks advance, parked anchors, retreat and fallback while guns still fire`,()=>{
    const s=arena(),x=mx(s,side,1300),d=dir(side);
    const tank=one(s,side,'tank',x);
    const attacker=one(s,1-side,'tank',x+d*450,{hp:10000,maxHp:10000});
    one(s,1-side,'infantry',x+d*280,{hp:10000,maxHp:10000});
    refreshVision(s);breakWithProjectile(s,tank,attacker);
    tank.squadOrder='attack';tank.cooldown=0;tank.secondaryCooldown=0;
    run(s,.3);
    assert.equal(tank.x,x);assert.equal(tank.moving,false);
    assert(tank.shots>0,'turret must still fire its main gun');
    assert(tank.secondaryShots>0,'track damage must not disable coax');
    tank.squadOrder='watch';tank.squadOrderX=x-d*100;run(s,.2);assert.equal(tank.x,x);
    tank.squadOrder='retreat';tank.squadOrderX=x-d*400;run(s,1);assert.equal(tank.x,x);
    const fallback={id:'fallback',uid:++s.uid};s.players[side].hand.push(fallback);
    const result=playCard(s,side,fallback.uid,x);
    assert(result.ok);assert.equal(tank.x,x,'fallback orders cannot teleport a broken hull');
  });

  test(`side ${side}: repair card chooses a full-health broken hull and restores movement after six seconds`,()=>{
    const s=arena(),x=mx(s,side,1300),tank=one(s,side,'tank',x);
    const attacker=one(s,1-side,'tank',x+dir(side)*450,{hp:10000,maxHp:10000});
    breakWithProjectile(s,tank,attacker);s.units=[tank];tank.hp=tank.maxHp;
    tank.squadOrder='attack';useRepair(s,side);
    assert(isImmobilized(tank));assert.equal(tank.repairTime,6);
    run(s,5.9);assert(isImmobilized(tank));assert.equal(tank.x,x);
    run(s,.2);assert.equal(isImmobilized(tank),false);
    run(s,.5);assert((tank.x-x)*dir(side)>0,'restored tank should resume advancing');
  });

  test(`side ${side}: a mechanic must reach the hull and perform actual tool work before fixing tracks`,()=>{
    const s=arena(),x=mx(s,side,1300),tank=one(s,side,'tank',x,{trackIntegrity:0});
    const mechanic=one(s,side,'combat_engineers',x-dir(side)*220,{pose:'crouch',
      poseAnimSeen:'crouch',stanceLockUntil:Infinity,squadOrder:'hold',tactic:'advance'});
    const station=repairStation(mechanic,tank);
    run(s,.2);assert(isImmobilized(tank));assert.equal(tank.trackRepairProgress??0,0);
    assert(Math.abs(mechanic.x-station)>3,'worker must still travel to actual contact');
    assert(until(s,()=>tank.trackRepairProgress>0,10),'worker must settle and start actual work');
    assert(mechanic.tendingKind==='repair');assert(isImmobilized(tank));
    assert((tank.trackRepairProgress??0)>0 && tank.trackRepairProgress<6);
    run(s,5.5);assert(isImmobilized(tank));
    run(s,.6);assert.equal(isImmobilized(tank),false);
    assert.equal(tank.hp,tank.maxHp,'track-only damage is repairable independently of hull health');
  });
}

test('a nearby recovery vehicle repairs full-health running gear continuously rather than only on HP pulses',()=>{
  const s=arena(),tank=one(s,0,'tank',1200,{trackIntegrity:0});
  one(s,0,'recovery_vehicle',1050);
  run(s,5.9);assert(isImmobilized(tank));assert((tank.trackRepairProgress??0)>5);
  run(s,.2);assert.equal(isImmobilized(tank),false);
});

test('the AI actually pays for repairs when its full-health tank has a broken track',()=>{
  const s=arena(),tank=one(s,1,'tank',2600,{trackIntegrity:0});
  const p=s.players[1],repair={id:'repair',uid:++s.uid};
  p.hand=[repair];p.deck=[];p.discard=[];p.energy=10;p.drawIn=1e9;
  const energy=p.energy,played=p.played;
  s.aiIn=0;tick(s,DT);
  assert.equal(p.played,played+1,'AI must play the repair card rather than merely score it');
  assert(!p.hand.some(h=>h.uid===repair.uid));
  assert.equal(p.energy,energy-CARDS.repair.cost,'AI must spend real command points');
  assert(tank.repairTime>0);assert(isImmobilized(tank));assert.equal(tank.hp,tank.maxHp);
  s.aiIn=1e9;run(s,6.1);assert.equal(isImmobilized(tank),false);
});

test('an empty fixed howitzer actually waits in place without towing, then accepts ammo at that position',()=>{
  const s=arena(),gun=one(s,0,'artillery',1200,{ammo:0,ammoReserve:0,squadOrder:'attack',emplaced:false});
  assert(issueLogisticsOrder(s,gun.uid,'resupply'));
  run(s,5);assert.equal(gun.x,1200);assert.equal(gun.resupplyState,'waiting');
  assert.equal(gun.moving,false);assert.equal(gun.shots,0);
  s.ammoCrates.push({uid:++s.uid,side:0,x:gun.x,stock:1800,maxStock:1800,
    landAt:s.time,expiresAt:s.time+180});
  run(s,2);assert.equal(gun.x,1200);assert.equal(gun.resupplyState,'supplying');
  assert(gun.ammo>0);assert.equal(gun.shots,0,'partial resupply cannot resume firing before full');
});
