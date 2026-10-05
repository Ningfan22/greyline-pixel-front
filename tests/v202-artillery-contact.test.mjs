import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, spawnUnit, tick, refreshVision, CARDS, W } from '../game/engine.ts';
import { obstacleBoxes } from '../game/world.ts';
import { issueLogisticsOrder } from '../game/logistics-orders.ts';
import { tankLayoutV202 } from '../game/tank-layout-v202.ts';

const DT=1/60, dir=side=>side?-1:1, at=(side,x)=>side?W-x:x;
function arena(){
  const s=createGame(202,undefined,undefined,undefined,{weather:false});startGame(s);
  Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9});
  s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;
  for(const p of s.players)Object.assign(p,{order:'advance',hand:[],deck:[],discard:[],energy:0});
  return s;
}
function spawn(s,side,id,x){const n=s.units.length;spawnUnit(s,side,id,x);return s.units[n];}
function run(s,seconds,inspect){for(let i=0;i<seconds/DT;i++){tick(s,DT);inspect?.();}}
function watch(u){Object.assign(u,{squadOrder:'watch',squadOrderX:u.x,squadOrderUntil:Infinity,emplaced:true,emplacementSetupUntil:0});}
for(const side of [0,1]){
  test(`side ${side}: tanks fire at the exposed shield of an artillery piece behind a low wall`,()=>{
    const s=arena(),tank=spawn(s,side,'tank',at(side,1350)),gun=spawn(s,1-side,'artillery',at(side,1730));watch(tank);watch(gun);
    s.scenery=[{id:900,kind:'house',x:gun.x,y:374,seed:0,parts:[{id:0,x:gun.x-18,y:339,w:36,h:35,hp:70,maxHp:70,kind:'wall',brokenAt:0}]}];
    const boxes=obstacleBoxes(s);
    const blocked=y=>boxes.some(b=>gun.x>b.x&&gun.x<b.x+b.w&&y>b.y&&y<b.y+b.h);
    assert(blocked(gun.y-27),'the old low target point is inside solid cover');
    assert(!blocked(gun.y-43),'the actual upper shield remains exposed');
    refreshVision(s);const targets=new Map(),hp=gun.hp;
    run(s,12,()=>{for(const p of s.projectiles)if(p.sourceUid===tank.uid&&p.weapon!=='coax'&&!targets.has(p.uid))targets.set(p.uid,p.targetUid);});
    assert([...targets.values()].includes(gun.uid),'actual main gun selects the artillery piece');
    assert(gun.hp<hp,'real shells damage the gun, not just its backdrop');
    assert(gun.shots>0,'enemy artillery remains armed and returns fire');
  });
  test(`side ${side}: an unsupported MLRS holds, and real infantry leads its advance from a rear line`,()=>{
    const s=arena(),battery=spawn(s,side,'mlrs',at(side,700));refreshVision(s);
    const start=battery.x;run(s,5);assert(Math.abs(battery.x-start)<.01,'no solo charge to discover targets');
    spawn(s,side,'infantry',at(side,1050));refreshVision(s);
    let minimumScreen=Infinity;
    run(s,14,()=>{
      const front=Math.max(...s.units.filter(u=>u.side===side&&CARDS[u.id].members&&u.hp>0).map(u=>u.x*dir(side)));
      minimumScreen=Math.min(minimumScreen,front-battery.x*dir(side));
    });
    assert((battery.x-start)*dir(side)>80,'battery actually follows the advancing squad');
    assert(minimumScreen>=288,'keeps roughly 300 distance behind the leading infantry');
  });
  test(`side ${side}: a screened MLRS uses normal observation and fires across an intervening building`,()=>{
    const s=arena(),battery=spawn(s,side,'mlrs',at(side,1050)),scout=spawn(s,side,'pathfinders',at(side,1580));
    const gun=spawn(s,1-side,'barrage',at(side,1810));watch(scout);watch(gun);
    const wall=at(side,1420);
    s.scenery=[{id:901,kind:'house',x:wall,y:374,seed:0,parts:[{id:0,x:wall-22,y:255,w:44,h:119,hp:250,maxHp:250,kind:'wall',brokenAt:-1}]}];
    refreshVision(s);const start=battery.x,launches=new Map();
    run(s,12,()=>{for(const p of s.projectiles)if(p.sourceUid===battery.uid&&!launches.has(p.uid))launches.set(p.uid,{target:p.targetUid,x:battery.x});});
    assert(launches.size>=3,'real rockets launch through a complete salvo');
    assert([...launches.values()].every(p=>p.target===gun.uid),'uses the genuinely observed enemy battery');
    assert((battery.x-start)*dir(side)<5,'does not chase the target toward the intervening building');
    assert([...launches.values()].every(p=>Math.abs(p.x-gun.x)>=CARDS.mlrs.minRange),'never fires inside the dead zone');
  });
  test(`side ${side}: MLRS rear-line doctrine preserves player orders and AI supply`,()=>{
    const s=arena(),battery=spawn(s,side,'mlrs',at(side,900));spawn(s,side,'infantry',at(side,1600));run(s,.1);
    battery.fuel=40;
    if(!side){assert(issueLogisticsOrder(s,battery.uid,'hold'));const x=battery.x;run(s,2);assert.equal(battery.x,x);}
    const hold=battery.x;battery.ammo=1;battery.fuel=25;
    if(!side)assert(issueLogisticsOrder(s,battery.uid,'resupply'));
    run(s,2);
    assert((battery.x-hold)*dir(side)<-10,'the return-to-supply command owns navigation');
  });
}

test('a tank completes only its already-chosen firing step after sight is lost; hidden enemy movement is not read',()=>{
  for(const side of [0,1]){
    const samples=[];
    for(const hiddenX of [120, W-120]){
      const s=arena(),tank=spawn(s,side,'tank',at(side,1500)),foe=spawn(s,1-side,'artillery',at(side,1880));
      watch(foe);foe.cooldown=1e9;
      tank.firingGoal=tank.x-dir(side)*24;
      tank.lastThreat={x:foe.x,y:foe.y,until:3};
      // Snapshot was acquired before loss of sight. The live hidden actor now
      // moves elsewhere, but it must not move this bounded, remembered goal.
      s.visible[side]=[];s.visionIn=100;foe.x=hiddenX;
      const goal=tank.firingGoal,start=tank.x;
      run(s,.75);
      assert((tank.x-start)*dir(side)<-5,'continues the selected rearward step');
      assert.equal(tank.shots,0,'the old position does not authorize firing blind');
      assert(Math.abs(tank.x-start)<=24.01,'memory cannot extend the movement beyond its original goal');
      samples.push([tank.x,tank.firingGoal??goal]);
    }
    assert.deepEqual(samples[0],samples[1],'hidden current coordinates have no influence on navigation');
  }
});

test('a tank aiming at rear armor cannot mirror its secondary muzzle toward infantry behind the painted gun',()=>{
  for(const side of [0,1]){
    const s=arena(),tank=spawn(s,side,'tank',at(side,1800)),armor=spawn(s,1-side,'light_tank',at(side,1300));
    const infantry=spawn(s,1-side,'infantry',at(side,2100));
    const observer=spawn(s,side,'pathfinders',at(side,1750));
    s.units=s.units.filter(u=>u===tank||u===armor||u===infantry||u===observer);
    for(const u of [armor,infantry,observer])u.cooldown=1e9;
    for(const u of s.units)watch(u);
    // Rear armor is beyond tank observation range: use a real spotter and
    // allow the stationary main gun its normal 3-second aiming delay.
    refreshVision(s);run(s,3.5);
    assert(tank.shots>0,'the main gun really fires at visible rear armor');
    assert.equal(tank.gunFacing,-dir(side),'the main gun owns the actual painted facing');
    assert.equal(tank.secondaryShots,0,'the opposite infantry cannot invent a mirrored machinegun mouth');
    infantry.x=at(side,1500);infantry.squadOrderX=infantry.x;refreshVision(s);
    let bullet;
    // Inspect the launch decision, before an actual miss clears targetUid.
    run(s,.6,()=>{const p=s.projectiles.find(p=>p.sourceUid===tank.uid&&p.weapon==='coax');if(!bullet&&p)bullet={...p};});
    assert(bullet,'secondary fire resumes when infantry is on the gun side');
    assert.equal(bullet.targetUid,infantry.uid);
    assert((bullet.startX-tank.x)*tank.gunFacing>0,'the round leaves the visible side of the vehicle');
    assert(Math.abs((tank.y-bullet.startY)-tankLayoutV202('tank').coaxY)<.01,
      'secondary fire starts at the measured visible coaxial port of the current tank painting');
  }
});
