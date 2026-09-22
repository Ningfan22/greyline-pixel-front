import assert from 'node:assert/strict';
import test from 'node:test';
import {createGame,startGame,spawnUnit,tick,setOrder,refreshVision,ground,CARDS,W} from '../game/engine.ts';
import {weaponCard,weaponModel,validDeck} from '../game/cards.ts';
import {ammunition,magazine} from '../game/ballistics.ts';
import {DECK_PRESETS,AI_DECKS} from '../game/deck-presets.ts';
import {starterState,validDeckWithCollection} from '../game/collection.ts';

function arena(){const s=createGame(177);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.weather.disabled=true;s.night=false;setOrder(s,0,'hold');setOrder(s,1,'hold');return s;}
function spawn(s,side,id,x){const n=s.units.length;spawnUnit(s,side,id,x);return s.units.slice(n);}
function passive(units){for(const u of units)Object.assign(u,{cooldown:1e9,secondaryCooldown:1e9,pace:0,fragLeft:0});}
const run=(s,n,observe=()=>{})=>{for(let i=0;i<n*60;i++){tick(s,1/60);observe();}};

test('every preset is legal and the starter deck is actually owned in full',()=>{
  for(const cards of [...DECK_PRESETS.map(d=>d.cards),...AI_DECKS])assert(validDeck(cards));
  assert(validDeckWithCollection(DECK_PRESETS[0].cards,starterState()));
  assert.equal(new Set(DECK_PRESETS.map(d=>[...d.cards].sort().join('|'))).size,DECK_PRESETS.length);
});
test('specialist pairs contain one real weapon and one rifle escort, not two duplicated heavy weapons',()=>{
  for(const id of ['flame_team','light_mortar']){
    const gun=weaponCard({id,member:0}),guard=weaponCard({id,member:1});
    assert.equal(gun.members,1);assert.equal(guard.members,1);assert.equal(guard.radius,0);
    assert.equal(guard.indirect,false);assert.equal(weaponModel({id,member:1}),'infantry');
    assert.equal(ammunition(id,1),'rifle');assert.equal(gun.damage,CARDS[id].damage);
  }
  assert.equal(ammunition('flame_team',0),'flame');assert.equal(magazine('flame_team',0).mag,12);
  assert.equal(ammunition('light_mortar',0),'mortar');assert.equal(ammunition('scout_car'),'machinegun');
  assert(CARDS.machinegun.cost>CARDS.lmg_team.cost);
});
test('recon vehicles stay on the ground and their self-defence weapon really fires on both sides',()=>{
  for(const side of [0,1]){
    const s=arena(),x=v=>side?W-v:v,u=spawn(s,side,'scout_car',x(1000))[0];
    passive(spawn(s,1-side,'infantry',x(1200)));u.cooldown=0;refreshVision(s);
    run(s,4,()=>assert(Math.abs(u.y-ground(s,u.x))<3,'ground observer must not enter airborne patrol'));
    assert(u.shots>0);assert.equal(u.lastAmmo,'machinegun');assert.equal(CARDS.scout_car.sight,950);
  }
});
test('MLRS fires a three-rocket sequence with a genuine long reload and no inherited armor',()=>{
  const s=arena(),u=spawn(s,0,'mlrs',900)[0],enemy=spawn(s,1,'heavy_tank',1450);
  passive(spawn(s,0,'scout_car',1050));
  passive(enemy);enemy[0].hp=enemy[0].maxHp=100000;u.cooldown=0;refreshVision(s);
  const shots=[],projectiles=new Map();let previous=0;
  run(s,12,()=>{if(u.shots>previous){shots.push(s.time);previous=u.shots;}
    for(const p of s.projectiles)if(p.sourceUid===u.uid)projectiles.set(p.uid,{ammo:p.ammunition,arc:p.arc,shell:p.shell,damage:p.damage});});
  assert(shots.length>=4,JSON.stringify(shots));assert(shots[1]-shots[0]<.5);assert(shots[2]-shots[1]<.5);
  // The observing scout applies the normal 1.3x reload synergy.
  assert(shots[3]-shots[2]>=7.5/1.3-.02,JSON.stringify(shots));assert.equal(CARDS.mlrs.armored,false);
  for(const p of projectiles.values()){assert.equal(p.ammo,'rocket');assert(p.arc>=100);assert(p.shell);assert.equal(p.damage,16);}
});
test('fire pulses cause bounded anti-personnel damage, do not crater, and are weak against armor',()=>{
  for(const id of ['flame_team','flame_tank']){
    const s=arena(),u=spawn(s,0,id,1000)[0],targets=spawn(s,1,'infantry',1140);
    const armor=spawn(s,1,'tank',1140)[0];passive(s.units);const hp=targets.map(v=>v.hp),armHp=armor.hp;
    const target=targets[0];target.x=1140;target.y=374;target.lane=0;
    const terrain=Array.from(s.terrain);s.projectiles.push({side:0,sourceUid:u.uid,startX:1120,startY:345,
      x:1140,y:345,tx:1140,ty:345,targetUid:target.uid,base:null,damage:12,radius:18,
      ammunition:'flame',armorMultiplier:.08,infantryMultiplier:1.5,startLane:0,targetLane:0,
      life:0,total:.04});tick(s,1/60);
    assert(target.hp<hp[0]);assert(target.hp>=hp[0]-18.001,'one pulse cannot delete a healthy squad');
    assert(armHp-armor.hp<=.961);assert.deepEqual(Array.from(s.terrain),terrain);
  }
});
test('one attack-jet sortie is bounded against three dense or spread squads, in both directions',()=>{
  for(const side of [0,1])for(const spacing of [0,30,80,170]){
    const s=arena(),x=v=>side?W-v:v,jet=spawn(s,side,'strike_jet',x(1000))[0];jet.cooldown=0;
    const victims=[];for(let i=0;i<3;i++)victims.push(...spawn(s,1-side,'infantry',x(1220+i*spacing)));
    passive(victims);refreshVision(s);run(s,7);
    const active=victims.filter(u=>u.hp>0&&!u.wounded&&!u.surrendered).length;
    assert(jet.shots>0&&jet.shots<=CARDS.strike_jet.sortieAmmo);
    assert(active>=victims.length/2,`side ${side}, spacing ${spacing}: only ${active} survived`);
  }
});
