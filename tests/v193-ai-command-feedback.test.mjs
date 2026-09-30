import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createGame,
  playCard,
  playLockoutMessage,
  refreshVision,
  requestDraw,
  spawnUnit,
  startGame,
  tick,
  W,
} from '../game/engine.ts';

function arena() {
  const s = createGame(193);
  startGame(s);
  s.terrain.fill(374);
  s.original.fill(374);
  s.walls = [];
  s.scenery = [];
  s.units = [];
  const p = s.players[1];
  p.hand = [];
  p.deck = [];
  p.discard = [];
  p.drawIn = 0;
  s.aiIn = 0;
  return s;
}

test('play lock reports its countdown before an unrelated low-energy failure', () => {
  const s = arena();
  const p = s.players[0];
  s.time = 3;
  p.hand = [{ id: 'infantry', uid: 1001, readyAt: 0 }];
  p.energy = 0;
  p.lockoutUntil = 9;
  const result = playCard(s, 0, 1001);
  assert.equal(result.ok, false);
  assert.equal(result.message, playLockoutMessage(6));
  assert.equal(p.hand.length, 1);
  assert.equal(p.energy, 0);
});

test('play lock still permits paid drawing, while draw jamming gives its own reason', () => {
  const s = arena();
  const p = s.players[0];
  p.hand = [];
  p.deck = [{ id: 'infantry', uid: 1002, readyAt: 0 }];
  p.energy = 4;
  p.lockoutUntil = 12;
  p.jam = 5;
  assert.match(requestDraw(s, 0).message, /通讯受扰.*5 秒/);
  assert.equal(p.deck.length, 1);
  p.jam = 0;
  assert.equal(requestDraw(s, 0).ok, true);
  assert.equal(p.energy, 2);
  assert.equal(p.hand[0].uid, 1002);
});

test('AI deploys an affordable anti-tank team at first contact instead of waiting for a costly launcher', () => {
  const s = arena();
  const p = s.players[1];
  p.hand = ['javelin', 'antiarmor', 'infantry'].map((id, i) => ({
    id,
    uid: 1100 + i,
    readyAt: 0,
  }));
  p.energy = 2;
  spawnUnit(s, 1, 'infantry', W - 650);
  spawnUnit(s, 0, 'tank', W - 700);
  refreshVision(s);
  tick(s, 0.05);
  assert.equal(p.played, 1);
  assert(!p.hand.some((h) => h.id === 'antiarmor'));
  assert(p.hand.some((h) => h.id === 'javelin'));
});

test('AI uses capped points to draw during a play lock without trying to play', () => {
  const s = arena();
  const p = s.players[1];
  p.hand = [{ id: 'infantry', uid: 1300, readyAt: 0 }];
  p.deck = [{ id: 'javelin', uid: 1301, readyAt: 0 }];
  p.energy = 10;
  p.lockoutUntil = 20;
  tick(s, 0.05);
  assert.equal(p.played, 0);
  assert.equal(p.hand.length, 2);
  assert.equal(p.deck.length, 0);
  assert(p.energy < 9);
});
