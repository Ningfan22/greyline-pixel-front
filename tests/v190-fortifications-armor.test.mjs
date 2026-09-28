import assert from 'node:assert/strict';
import test from 'node:test';
import {createGame,startGame,playCard,spawnUnit,tick,ground,pointVisible,CARDS,armorPenetrationTier} from '../game/engine.ts';
import {DECK_PRESETS,AI_DECKS} from '../game/deck-presets.ts';

function arena(){
  const s=createGame(190);startGame(s);s.aiIn=1e9;s.units=[];s.scenery=[];s.walls=[];
  s.terrain.fill(374);s.original.fill(374);s.weather.disabled=true;
  s.players.forEach(p=>p.energy=30);
  return s;
}
function use(s,id,x,side=0){
  const h={id,uid:++s.uid};s.players[side].hand.push(h);
  return playCard(s,side,h.uid,x);
}
function advance(s,seconds){for(let i=0;i<seconds*20;i++)tick(s,.05);}

test('fortifications need current line of sight, consume no resources on an invalid site, and build before activation',()=>{
  const s=arena();
  assert(pointVisible(s,0,390,ground(s,390)-24));
  assert(!pointVisible(s,0,900,ground(s,900)-24));
  const before=s.players[0].energy;
  assert.equal(use(s,'fort_bunker',900).ok,false);
  assert.equal(s.players[0].energy,before);
  assert(use(s,'fort_bunker',390).ok);
  const f=s.units.find(u=>u.id==='fort_bunker');
  assert.equal(f.hp,420);assert.equal(f.buildUntil,8);
  advance(s,4);
  assert(s.time<f.buildUntil);
  assert(!use(s,'fort_wire',900).ok,'unfinished bunker cannot extend visibility');
  advance(s,4.1);
  assert(s.time>=f.buildUntil);
});

test('completed fort auto-garrisons nearby infantry up to capacity; wire holds nobody',()=>{
  const s=arena();assert(use(s,'fort_bunker',380).ok);
  assert(use(s,'fort_wire',180).ok);
  advance(s,8.1);
  spawnUnit(s,0,'infantry',400);
  spawnUnit(s,0,'infantry',400);
  tick(s,.05);
  const fort=s.units.find(u=>u.id==='fort_bunker');
  const wire=s.units.find(u=>u.id==='fort_wire');
  assert(s.units.filter(u=>u.garrisonUid===fort.uid).length>0);
  assert(s.units.filter(u=>u.garrisonUid===fort.uid).length<=4);
  assert.equal(s.units.filter(u=>u.garrisonUid===wire.uid).length,0);
  fort.hp=0;tick(s,.05);
  assert.equal(s.units.filter(u=>u.garrisonUid===fort.uid).length,0);
});

test('ordinary paratroopers descend at the selected point while rapid reinforcements enter by ground',()=>{
  const s=arena();
  assert(CARDS.paratroopers.airdrop);assert(!CARDS.rapid_reinforcements.airdrop);
  assert(use(s,'paratroopers',1500).ok);
  const jump=s.units.filter(u=>u.id==='paratroopers');
  assert.equal(jump.length,5);
  assert(jump.every(u=>u.parachuting && u.y<ground(s,u.x)-200));
  assert(jump.some(u=>Math.abs(u.x-1500)<50));
  assert(use(s,'rapid_reinforcements',1500).ok);
  const groundTeam=s.units.filter(u=>u.id==='rapid_reinforcements');
  assert.equal(groundTeam.length,5);
  assert(groundTeam.every(u=>!u.parachuting && u.rapidUntil>s.time && u.x<350));
});

test('a completed forward post deploys later infantry forward and revives nearby casualties with limited charges',()=>{
  const s=arena();assert(use(s,'fort_spawn',390).ok);advance(s,10.1);
  const post=s.units.find(u=>u.id==='fort_spawn');
  assert(use(s,'rapid_reinforcements').ok);
  assert(s.units.filter(u=>u.id==='rapid_reinforcements').some(u=>u.x>390));
  const count=s.units.length;
  s.wrecks.push({id:++s.uid,cardId:'infantry',member:0,side:0,x:410,y:374,
    angle:0,age:0,falling:false,vx:0,vy:0});
  advance(s,15);
  assert(s.units.length>count);
  assert.equal(post.respawnCharges,2);
  assert(s.wrecks.at(-1).revived);
});

test('armor tiers are consistent and direct small-arms rounds cannot wear down vehicles',()=>{
  assert.equal(CARDS.infantry.armorTier??0,0);
  assert.equal(CARDS.ifv.armorTier,1);
  assert.equal(CARDS.tank.armorTier,2);
  assert.equal(CARDS.heavy_tank.armorTier,3);
  assert.equal(armorPenetrationTier('rifle'),0);
  assert.equal(armorPenetrationTier('autocannon'),1);
  assert.equal(armorPenetrationTier('rocket'),2);
  assert.equal(armorPenetrationTier('ap'),3);
  const s=arena();spawnUnit(s,0,'infantry',600,{member:0});spawnUnit(s,1,'ifv',640);
  const shooter=s.units[0],target=s.units[1];
  shooter.cooldown=target.cooldown=999;
  const hp=target.hp;
  s.projectiles.push({uid:++s.uid,side:0,sourceUid:shooter.uid,targetUid:target.uid,base:null,
    ammunition:'rifle',damage:100,radius:0,startX:620,startY:target.y-20,
    x:620,y:target.y-20,tx:target.x,ty:target.y-20,life:.01,total:.01});
  tick(s,.05);
  assert.equal(target.hp,hp);
});

test('indirect guns still acquire spotted armored targets and launch shells',()=>{
  const s=arena();
  spawnUnit(s,0,'field_gun',600);
  const gun=s.units[0];
  gun.cooldown=0;
  spawnUnit(s,1,'tank',1100);
  const target=s.units[1];
  target.pace=0;target.cooldown=target.secondaryCooldown=999;
  spawnUnit(s,0,'scout_drone',1000);
  advance(s,1.25);
  assert(s.projectiles.some(p=>p.sourceUid===gun.uid && p.targetUid===target.uid && p.shell));
});

test('new air, gun and fortification cards are playable and preset decks stay valid',()=>{
  for(const id of ['escort_gunship','ground_attack_jet','field_gun','siege_gun','fort_bunker','fort_machinegun','fort_aa','fort_spawn','fort_wire'])
    assert(CARDS[id]);
  for(const deck of [...DECK_PRESETS.map(d=>d.cards),...AI_DECKS]){
    assert.equal(deck.length,20);
    for(const id of deck)assert(CARDS[id],id);
  }
});
