import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DRAW_TIME, cardCost, createGame, playCard, requestDraw, snapshot,
  startGame, tick,
} from '../game/engine.ts';
import { ECONOMY_RULES, energyInterval } from '../game/economy.ts';
import { CARDS, validDeck } from '../game/cards.ts';
import { DECK_PRESETS, AI_DECKS } from '../game/deck-presets.ts';

function arena() {
  const s = createGame(187);
  startGame(s);
  s.aiIn = 1e9;
  s.walls = []; s.scenery = [];
  s.terrain.fill(374); s.original.fill(374);
  for (const p of s.players) {
    p.hand = []; p.deck = []; p.discard = []; p.energy = 10;
  }
  return s;
}
function add(s, side, id) {
  const h = {id, uid: ++s.uid, readyAt: 0};
  s.players[side].hand.push(h);
  return h;
}
function use(s, side, id, x) {
  return playCard(s, side, add(s, side, id).uid, x);
}
function advance(s, seconds) {
  const until = s.time + seconds;
  while (s.time < until - 1e-8) tick(s, Math.min(0.05, until - s.time));
}

test('manual drawing cools down in one second, without removing its two-point cost', () => {
  const s = arena(), p = s.players[0];
  p.deck = [{id:'infantry',uid:++s.uid},{id:'infantry',uid:++s.uid}];
  assert.equal(DRAW_TIME, 1);
  assert(requestDraw(s,0).ok);
  assert.equal(p.energy,8);
  assert.equal(p.drawIn,1);
  assert(!requestDraw(s,0).ok);
  advance(s,0.99);
  assert(!requestDraw(s,0).ok);
  advance(s,0.02);
  assert(requestDraw(s,0).ok);
  assert.equal(p.hand.length,2);
});

test('short bonds and stronger overdraft fund an insertion, while borrowed over-cap points persist', () => {
  const s = arena(), p = s.players[0];
  p.energy = 2;
  assert(use(s,0,'war_bonds').ok);
  assert.equal(p.bondDueAt,6);
  s.time = 6;
  tick(s,0.01);
  assert.equal(p.bondDueAt,null);
  p.energy = 9;
  assert(use(s,0,'overdraft').ok);
  assert.equal(p.energy,15);
  assert.equal(energyInterval(s,0),3.6 * 1.6);
  p.bondDueAt = s.time + 0.05;
  advance(s,0.05);
  assert.equal(p.energy,15);
  tick(s,0.1);
  assert.equal(p.energy,15);
  assert(use(s,0,'air_assault',2500).ok);
  assert.equal(p.energy,15-CARDS.air_assault.cost);
  assert(s.units.some(u=>u.side===0&&u.id==='air_assault'));
  assert.equal(ECONOMY_RULES.levyPayout,4);
});

test('electromagnetic and communications interference block enemy plays for 12 and 15 seconds', () => {
  const s = arena(), foe = s.players[1];
  const attempted = add(s,1,'infantry');
  assert(use(s,0,'signal_jam').ok);
  assert.equal(foe.lockoutUntil,12);
  assert.equal(foe.jam,0);
  assert(!playCard(s,1,attempted.uid).ok);
  s.time = 12;
  assert(playCard(s,1,attempted.uid).ok);
  const second = add(s,1,'infantry');
  assert(use(s,0,'jam').ok);
  assert.equal(foe.lockoutUntil,27);
  assert(!playCard(s,1,second.uid).ok);
  s.time = 27;
  assert(playCard(s,1,second.uid).ok);
});

test('full-line silence lasts 20 seconds for both sides, but drawing remains legal', () => {
  const s = arena();
  s.players[1].freqHopUntil = 100;
  assert(use(s,0,'command_lockdown').ok);
  assert.deepEqual(s.players.map(p=>p.lockoutUntil),[20,20]);
  for (const side of [0,1]) {
    const h = add(s,side,'infantry');
    const before = s.players[side].energy;
    assert(!playCard(s,side,h.uid).ok);
    assert.equal(s.players[side].energy,before);
    s.players[side].deck = [{id:'infantry',uid:++s.uid}];
    assert(requestDraw(s,side).ok);
  }
  s.time = 20;
  assert(playCard(s,0,s.players[0].hand[0].uid).ok);
  assert(playCard(s,1,s.players[1].hand[0].uid).ok);
});

test('interdiction taxes exactly four enemy plays and shows their payable cost', () => {
  const s = arena(), foe = s.players[1];
  foe.energy = 20;
  assert(use(s,0,'supply_interdiction').ok);
  assert.equal(foe.taxCards,4);
  for (let i=4;i>0;i--) {
    const h = add(s,1,'supply');
    assert.equal(snapshot(s,1).players[1].hand.at(-1).cost,cardCost(h)+2);
    assert(playCard(s,1,h.uid).ok);
    assert.equal(foe.taxCards,i-1);
  }
  const h = add(s,1,'supply');
  assert.equal(snapshot(s,1).players[1].hand.at(-1).cost,cardCost(h));
});

test('logistics strike removes five command points without dropping below zero', () => {
  const s = arena();
  s.players[1].energy = 4;
  assert(use(s,0,'logistics_strike').ok);
  assert.equal(s.players[1].energy,0);
  s.players[1].energy = 8;
  assert(use(s,0,'logistics_strike').ok);
  assert.equal(s.players[1].energy,3);
});

test('blitz decks carry the burst, insertion and counterplay-blocking package', () => {
  const decks = [DECK_PRESETS.find(d=>d.id==='blitz').cards, AI_DECKS[5]];
  for(const cards of decks) {
    assert(validDeck(cards));
    for(const id of ['overdraft','war_bonds','air_assault','paratroopers','signal_jam','jam','command_lockdown'])
      assert(cards.includes(id),id);
  }
  assert.equal(CARDS.command_lockdown.name,'全线静默');
});

test('blitz AI spends borrowed points on an insertion before locking its own hand', () => {
  const s = arena(), p = s.players[1];
  p.energy = 2;
  p.hand = ['overdraft','air_assault','paratroopers','signal_jam','command_lockdown','infantry']
    .map(id=>({id,uid:++s.uid,readyAt:0}));
  p.deck = ['war_bonds','forced_march','emergency_levy']
    .map(id=>({id,uid:++s.uid,readyAt:0}));
  s.aiIn = 0;
  tick(s,0.05);
  assert.equal(p.discard[0]?.id,'overdraft',JSON.stringify({energy:p.energy,hand:p.hand.map(h=>h.id),deck:p.deck.map(h=>h.id),played:p.played,notices:s.notices}));
  s.aiIn = 0;
  tick(s,0.05);
  assert(s.units.some(u=>u.side===1&&u.id==='air_assault') ||
    s.units.some(u=>u.side===1&&u.id==='paratroopers'));
  assert.equal(p.lockoutUntil ?? 0,0);
});
