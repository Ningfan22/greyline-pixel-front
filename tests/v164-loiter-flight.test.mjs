import assert from 'node:assert/strict';
import test from 'node:test';
import {createGame,startGame,spawnUnit,tick,setOrder,refreshVision,visibleToSide,playCard,CARDS,W} from '../game/engine.ts';
import {createScenery} from '../game/world.ts';
import {setSquadOrder,ordersForUnit} from '../game/squad-orders.ts';

const DT=1/60;
function arena(side=0,id='loiter_drone'){
  const s=createGame(164);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.night=false;s.weather.disabled=true;s.terrain.fill(374);s.original.fill(374);
  setOrder(s,0,'hold');setOrder(s,1,'hold');
  const x=v=>side?W-v:v;
  const one=(team,id,at)=>{const n=s.units.length;spawnUnit(s,team,id,x(at));
    const u=s.units[n];s.units.splice(n+1);
    Object.assign(u,{x:x(at),cooldown:1000,secondaryCooldown:1000,pace:0,decisionIn:1000,fragLeft:0});return u;};
  const drone=one(side,id,1000);
  Object.assign(drone,{cooldown:0,squadOrder:'watch',squadOrderX:x(1000),squadOrderUntil:Infinity});
  return {s,u:drone,one,x,side};
}
function run(s,t,each=()=>{}){for(let i=0;i<Math.round(t/DT);i++){tick(s,DT);each();}}
function until(s,condition,t=8,each=()=>{}){for(let i=0;i<t/DT&&!condition();i++){tick(s,DT);each();}assert(condition(),`timeout ${s.time}`);}

for(const side of [0,1]){
  test(`side${side}: infantry does not consume patrol, direction reverses physically, later gun triggers a two-second confirmation`,()=>{
    const {s,u,one}=arena(side),foot=one(1-side,'infantry',1280);
    refreshVision(s);const facings=new Set();let old={x:u.x,y:u.y},maxStep=0;
    run(s,8,()=>{facings.add(u.facing);maxStep=Math.max(maxStep,Math.hypot(u.x-old.x,u.y-old.y));old={x:u.x,y:u.y};});
    assert.deepEqual([...facings].sort(),[-1,1]);assert(maxStep<=116*DT+1e-6);
    assert(!u.loiterFlight.lock);assert.equal(foot.hp,foot.maxHp);assert.equal(u.hp,40);
    const tank=one(1-side,'tank',1240),gun=one(1-side,'artillery',1260);refreshVision(s);
    until(s,()=>u.loiterFlight.candidateUid!==undefined,1);
    assert.equal(u.loiterFlight.candidateUid,gun.uid,'choose cannon instead of tank or infantry');
    const confirmAt=u.loiterFlight.confirmAt,gunHp=gun.hp;
    while(s.time+DT<confirmAt){tick(s,DT);assert(!u.loiterFlight.lock);assert.equal(gun.hp,gunHp);}
    until(s,()=>!!u.loiterFlight.lock,.1);assert.equal(u.loiterFlight.lock.uid,gun.uid);
    assert(u.hp>0);assert(!s.projectiles.some(p=>p.sourceUid===u.uid));
    let prior={x:u.x,y:u.y},diveSteps=0,pitched=false;
    until(s,()=>u.destroyed,4,()=>{
      assert(Math.hypot(u.x-prior.x,u.y-prior.y)<=260*DT+1e-5);prior={x:u.x,y:u.y};
      if(u.hp>0){diveSteps++;pitched ||= Math.abs(u.hullAngle)>.05;}
    });
    assert(diveSteps>10);assert(pitched);assert(gun.hp<gunHp);
    assert.equal(s.wrecks.filter(w=>w.id===u.uid).length,1);
    assert.equal(s.players[1-side].kills,0,'self-consumption is not an enemy kill');
    assert.deepEqual(s.players.map(p=>p.hp),[1000,1000]);
    const explosions=s.explosions;run(s,3);assert.equal(s.explosions,explosions);
  });

  test(`side${side}: obscured confirmation resets and hidden terminal target cannot steer the drone`,()=>{
    const {s,u,one,x}=arena(side),target=one(1-side,'ifv',1280);refreshVision(s);
    run(s,1);assert(u.loiterFlight.candidateUid);assert(!u.loiterFlight.lock);
    s.smokes=[{side:1-side,x:x(1250),life:10}];refreshVision(s);
    assert.equal(visibleToSide(s,side,target),false);run(s,.4);
    assert.equal(u.loiterFlight.candidateUid,undefined);
    s.smokes=[];refreshVision(s);until(s,()=>u.loiterFlight.candidateUid!==undefined,1);
    run(s,1.8);assert(!u.loiterFlight.lock,'earlier partial acquisition cannot carry over');
    until(s,()=>!!u.loiterFlight.lock,1);const last={...u.loiterFlight.lock};
    target.x=x(1860);s.smokes=[{side:1-side,x:x(1590),life:10}];refreshVision(s);
    assert.equal(visibleToSide(s,side,target),false);run(s,.2);assert.deepEqual(u.loiterFlight.lock,last);
    until(s,()=>u.destroyed,4);assert.equal(target.hp,target.maxHp);
  });

  test(`side${side}: house intercepts the real aircraft after commitment`,()=>{
    const {s,u,one,x}=arena(side),target=one(1-side,'ifv',1370);refreshVision(s);
    until(s,()=>!!u.loiterFlight?.lock,6);
    s.scenery=createScenery(s.terrain,[{x:x(1280),kind:'house',building:1,seed:37}]);refreshVision(s);
    until(s,()=>u.destroyed,4);
    assert.equal(target.hp,target.maxHp);const wreck=s.wrecks.find(w=>w.id===u.uid);
    assert(wreck);assert(Math.abs(wreck.x-target.x)>50);
  });

  test(`side${side}: air defence can shoot down patrol and committed dive without remote strike`,()=>{
    for(const committed of [false,true]){
      const {s,u,one}=arena(side),target=one(1-side,'heavy_tank',1370);refreshVision(s);
      if(committed)until(s,()=>!!u.loiterFlight?.lock,6);
      const before=target.hp;
      for(let i=0;i<3;i++){const sam=one(1-side,'sam_vehicle',1220+i*4);sam.cooldown=0;}
      refreshVision(s);until(s,()=>u.destroyed,4);
      assert.equal(target.hp,before);assert(s.players[1-side].kills>=1);
      assert(!s.projectiles.some(p=>p.sourceUid===u.uid));
    }
  });

  test(`side${side}: paid one-way card expires once, does not recycle or damage headquarters`,()=>{
    const {s,x}=arena(side);s.units=[];const p=s.players[side];p.energy=10;
    const token={id:'loiter_drone',uid:++s.uid};p.hand=[token];
    assert(playCard(s,side,token.uid,x(2000)).ok);assert.equal(p.energy,7);const u=s.units.at(-1);
    assert.equal(u.x,x(112));assert.equal(u.flightUntil,60);
    run(s,59);assert(u.hp>0);run(s,2);assert.equal(u.hp,0);
    assert.equal(s.wrecks.filter(w=>w.id===u.uid).length,1);
    assert(!p.hand.includes(token));assert.equal(p.discard.filter(t=>t===token).length,1);
    assert.deepEqual(s.players.map(p=>p.hp),[1000,1000]);
  });

  test(`side${side}: retreat blocks acquisition; watch moves an orbit smoothly; dive cannot be canceled by a snap`,()=>{
    const {s,u,one,x}=arena(side);one(1-side,'tank',1280);refreshVision(s);
    u.squadOrder='retreat';u.squadOrderX=x(750);run(s,3);
    assert(!u.loiterFlight.lock);assert(!u.loiterFlight.candidateUid);
    u.squadOrder='watch';u.squadOrderX=x(1100);
    let prior={x:u.x,y:u.y};until(s,()=>!!u.loiterFlight.lock,10,()=>{
      assert(Math.hypot(u.x-prior.x,u.y-prior.y)<=260*DT+1e-5);prior={x:u.x,y:u.y};
    });
    u.squadOrder='retreat';u.squadOrderX=x(100);run(s,.1);
    assert(u.loiterFlight.lock);assert(Math.abs(u.x-x(100))>500);
  });
}

test('roster distinguishes long anti-emplacement patrol from cheap immediate FPV, without changing collection ids',()=>{
  assert.equal(CARDS.loiter_drone.cost,3);assert.equal(CARDS.fpv_drone.cost,1);
  assert.equal(CARDS.loiter_drone.flightTime,60);assert.equal(CARDS.fpv_drone.flightTime,24);
  assert(CARDS.loiter_drone.radius>CARDS.fpv_drone.radius);
  assert(!CARDS.loiter_drone.sortie);assert.match(CARDS.loiter_drone.detail,/确认2秒/);
  assert.doesNotMatch(CARDS.airborne_insertion.detail,/落地后8秒内快速突进/);
});

test('AI buys loitering support for observed guns but not hidden guns or an infantry-only lane',()=>{
  for(const mode of ['visible-gun','hidden-gun','foot-only']){
    const {s,one}=arena();s.units=[];
    one(1,'scouts',1800);
    one(0,mode==='foot-only'?'infantry':'artillery',mode==='hidden-gun'?100:1500);
    const p=s.players[1];p.hand=[{id:'loiter_drone',uid:++s.uid}];p.deck=[];p.energy=10;s.aiIn=0;
    refreshVision(s);tick(s,.05);
    assert.equal(s.units.some(u=>u.side===1&&u.id==='loiter_drone'),mode==='visible-gun',mode);
  }
});

test('public orders leave aircraft in flight and fuel expiry cannot be paused by selection',()=>{
  const {s,u,one}=arena();one(1,'tank',1280);refreshVision(s);
  assert.equal(ordersForUnit(u.id).find(o=>o.id==='watch').label,'就地盘旋');
  assert(setSquadOrder(s,0,u.squad,'watch').ok);const y=u.y;run(s,.5);assert.notEqual(u.y,y);
  assert(setSquadOrder(s,0,u.squad,'retreat').ok);tick(s,DT);assert(!u.loiterFlight.candidateUid);
  u.flightUntil=s.time+.1;run(s,.2);assert(u.destroyed);
});

test('near either HQ a retreat reaches its real anchor and resumes a bounded orbit',()=>{
  for(const side of [0,1]){
    const {s,u,x}=arena(side);u.x=x(300);u.y=164;
    assert(setSquadOrder(s,side,u.squad,'retreat').ok);
    assert.equal(u.squadOrderX,x(100));until(s,()=>u.squadOrder==='watch',5);
    const facings=new Set();run(s,8,()=>{assert(u.x>=60&&u.x<=W-60);facings.add(u.facing);});
    assert.deepEqual([...facings].sort(),[-1,1]);
  }
});

test('FPV and loiter impact warheads cannot explode again when airborne debris lands',()=>{
  for(const id of ['fpv_drone','loiter_drone']){
    const {s,u,one}=arena(0,id);if(id==='fpv_drone')u.squadOrder=undefined;
    const target=one(1,'heavy_tank',1260);refreshVision(s);
    until(s,()=>u.destroyed,8);assert(target.hp<target.maxHp);
    const wreck=s.wrecks.find(w=>w.id===u.uid);assert(wreck?.spentWarhead);assert(wreck.falling);
    assert.equal(s.explosions,1);run(s,4);assert(!wreck.falling);assert.equal(s.explosions,1);
    assert.equal(s.wrecks.filter(w=>w.id===u.uid).length,1);
  }
});
