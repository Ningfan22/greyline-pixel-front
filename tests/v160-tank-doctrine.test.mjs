import assert from 'node:assert/strict';
import test from 'node:test';
import {tick,refreshVision,setOrder,CARDS,spawnUnit} from '../game/engine.ts';
import {tankTargetPriority} from '../game/tank-doctrine.ts';
import {tankRoleArena} from './fixtures/tank-role-arena.mjs';
const step=(s,n)=>{for(let i=0;i<n;i++)tick(s,1/60);};
function firstRound(s,u){
  for(let i=0;i<120;i++){
    tick(s,1/60);const p=s.projectiles.find(p=>p.sourceUid===u.uid&&p.weapon!=='coax');
    if(p)return p;
  }
  assert.fail(`no shot: ${JSON.stringify({id:u.id,pose:u.pose,x:u.x,target:u.target,shots:u.shots})}`);
}

test('three tank cards choose different real main-gun targets in the same contact, both directions',()=>{
  for(const side of [0,1])for(const [id,key,ammo]of [['tank','armor','ap'],['light_tank','launcher','cannon'],['heavy_tank','gun','cannon']]){
    const {s,tank,targets}=tankRoleArena(id,side),p=firstRound(s,tank);
    assert.equal(p.targetUid,targets[key].uid,`${side}/${id}`);
    assert.equal(p.ammunition,ammo);assert.equal(p.damage,ammo==='ap'?CARDS[id].penetration:CARDS[id].damage);
    const hp=targets[key].hp;step(s,100);assert(targets[key].hp<hp,`${id} real impact`);
  }
});
test('heavy tanks place their HE into an observed infantry concentration ahead of distant armor',()=>{
  for(const side of [0,1]){
    const {s,tank,targets}=tankRoleArena('heavy_tank',side);s.units=s.units.filter(v=>v!==targets.gun);
    refreshVision(s);const p=firstRound(s,tank);
    assert.equal(p.targetUid,targets.rifle2.uid);assert.equal(p.ammunition,'cannon');
    const before=[targets.rifle1,targets.rifle2,targets.rifle3].map(v=>v.hp);step(s,100);
    assert([targets.rifle1,targets.rifle2,targets.rifle3].every((v,i)=>v.hp<before[i]));
  }
});
test('nearby armor overrides both specialist preferences without changing their normal AP damage',()=>{
  for(const side of [0,1])for(const id of ['light_tank','heavy_tank']){
    const {s,tank,targets,x,dir}=tankRoleArena(id,side);targets.armor.x=x+dir*200;
    refreshVision(s);const p=firstRound(s,tank);
    assert.equal(p.targetUid,targets.armor.uid);assert.equal(p.ammunition,'ap');
    assert.equal(p.damage,CARDS[id].penetration);
  }
});
test('light tanks distinguish launcher operators from rifle escorts and retain ordinary target fallbacks',()=>{
  const {s,tank,targets,add}=tankRoleArena('light_tank');
  targets.launcher.member=2;const vehicle=add('pickup',420);refreshVision(s);
  assert(tankTargetPriority(tank,vehicle)<tankTargetPriority(tank,targets.launcher));
  assert.equal(firstRound(s,tank).targetUid,vehicle.uid);
  for(const id of ['light_tank','heavy_tank']){
    const a=tankRoleArena(id);a.s.units=[a.tank,a.targets.armor];refreshVision(a.s);
    assert.equal(firstRound(a.s,a.tank).targetUid,a.targets.armor.uid);
  }
});
test('preferences grant neither hidden-target knowledge, blocked shots nor forward contact-line bypass',()=>{
  for(const id of ['light_tank','heavy_tank']){
    const {s,tank,targets,x}=tankRoleArena(id),preferred=id==='light_tank'?targets.launcher:targets.gun;
    // The preferred enemy is behind solid high ground; clear infantry remain nearer.
    s.terrain.fill(160,x+335,x+350);s.terrainVersion++;refreshVision(s);
    const p=firstRound(s,tank);assert.notEqual(p.targetUid,preferred.uid);
    assert([targets.rifle1.uid,targets.rifle2.uid,targets.rifle3.uid].includes(p.targetUid));
    setOrder(s,0,'advance');step(s,60);assert(tank.x<=x+.01);
    const b=tankRoleArena(id);b.targets.launcher.x=3200;b.targets.gun.x=3250;
    b.targets.armor.x=3300;refreshVision(b.s);
    const q=firstRound(b.s,b.tank);assert([b.targets.rifle1.uid,b.targets.rifle2.uid,b.targets.rifle3.uid].includes(q.targetUid));
  }
});
test('main-battle guns still finish damaged armor while their coax independently engages infantry',()=>{
  const {s,tank,targets,add}=tankRoleArena(),other=add('heavy_tank',430);
  targets.armor.hp=300;other.hp=950;tank.secondaryCooldown=0;refreshVision(s);
  assert.equal(firstRound(s,tank).targetUid,targets.armor.uid);
  const coax=s.projectiles.find(p=>p.sourceUid===tank.uid&&p.weapon==='coax');assert(coax);
  assert([targets.rifle1.uid,targets.rifle2.uid,targets.rifle3.uid,targets.launcher.uid].includes(coax.targetUid));
});
test('AI buys a role suited to visible opposition and hidden armor does not change its choice',()=>{
  for(const [mode,expected]of [['armor','tank'],['budget-armor','light_tank'],['light','light_tank'],['battery','heavy_tank'],['hidden','heavy_tank']]){
    const {s,one}=tankRoleArena();s.units=[];s.time=120;
    for(const x of [1900,1980])spawnUnit(s,1,'infantry',x);
    s.units.forEach(v=>Object.assign(v,{y:374,cooldown:10000,decisionIn:1000}));
    if(mode==='armor'||mode==='budget-armor')one(0,'tank',1620);
    if(mode==='light')one(0,'pickup',1620);
    if(mode==='battery'||mode==='hidden')one(0,'artillery',1620);
    if(mode==='hidden')one(0,'tank',100);
    s.players[1].hand=['light_tank','tank','heavy_tank'].map(id=>({id,uid:++s.uid}));
    s.players[1].energy=mode==='budget-armor'?5:10;s.players[1].deck=[];s.aiIn=0;refreshVision(s);tick(s,.05);
    assert.equal(s.units.find(v=>v.side===1&&['light_tank','tank','heavy_tank'].includes(v.id))?.id,expected,mode);
  }
});
