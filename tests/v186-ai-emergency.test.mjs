import test from 'node:test';
import assert from 'node:assert/strict';
import {createGame,startGame,tick,spawnUnit,refreshVision,W} from '../game/engine.ts';

function base() {
  const s=createGame(186);startGame(s);
  s.terrain.fill(374);s.original.fill(374);s.walls=[];s.scenery=[];s.units=[];
  const p=s.players[1];p.deck=[];p.discard=[];p.hand=[];p.energy=2;s.aiIn=0;
  spawnUnit(s,1,'scouts',W-500);
  spawnUnit(s,0,'tank',W-550);
  refreshVision(s);
  return s;
}
function hand(s,ids) {
  s.players[1].hand=ids.map((id,i)=>({id,uid:10000+i,readyAt:0}));
}

test('a tank at the AI base makes it deploy an affordable counter instead of waiting for a costly one',()=>{
  const s=base();hand(s,['javelin','antiarmor','infantry']);
  tick(s,.05);
  assert.equal(s.players[1].played,1);
  assert(!s.players[1].hand.some(card=>card.id==='antiarmor'));
  assert(s.players[1].hand.some(card=>card.id==='javelin'));
});

test('if no strong counter remains in the deck, an urgent HQ attack receives an available defender',()=>{
  const s=base();hand(s,['infantry']);
  s.players[1].deck=[{id:'infantry',uid:20000,readyAt:0}];
  tick(s,.05);
  assert.equal(s.players[1].played,1);
  assert(s.units.some(u=>u.side===1&&u.id==='infantry'));
});

test('a distant tank still makes the AI save for its stronger held counter',()=>{
  const s=base();
  for(const u of s.units.filter(u=>u.side===0))u.x=W-850;
  for(const u of s.units.filter(u=>u.side===1))u.x=W-760;
  hand(s,['javelin','antiarmor']);refreshVision(s);
  tick(s,.05);
  assert.equal(s.players[1].played,0);
  assert(s.players[1].hand.some(card=>card.id==='javelin'));
});
