import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  refreshVision,
  CARDS,
} from '../game/engine.ts';

const results = [];
function test(name, fn) {
  try {
    const value = fn();
    results.push({ name, ok: true, ...value });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}

function arena() {
  const s = createGame(1);
  startGame(s);
  s.terrain.fill(374);
  s.original.fill(374);
  s.walls = [];
  s.scenery = [];
  s.players[1].deck = [];
  s.players[1].discard = [];
  s.players[1].hand = [];
  s.players[1].energy = 0;
  s.players[1].played = 0;
  s.aiIn = 0;
  return s;
}

function squad(s, side, id, x) {
  const at = s.units.length;
  spawnUnit(s, side, id, x);
  return s.units.slice(at);
}

function hand(s, ids, energy) {
  s.players[1].hand = ids.map((id, i) => ({ id, uid: 10000 + i, readyAt: 0 }));
  s.players[1].energy = energy;
}

// Drives one AI decision and asserts which card was played.
function expectPlayed(s, expectedId) {
  refreshVision(s);
  tick(s, 0.05);
  assert.equal(s.players[1].played, 1, 'AI must play exactly one card');
  assert.ok(
    s.players[1].discard.some((c) => c.id === expectedId),
    `expected ${expectedId} in discard, got [${s.players[1].discard
      .map((c) => c.id)
      .join(', ')}]`,
  );
  assert.ok(
    s.units.some((u) => u.side === 1 && u.id === expectedId),
    `expected a side-1 ${expectedId} on the field`,
  );
  return { played: expectedId };
}

// --- Suppression assault: machine guns pin, assault troops close in ---

test('AI drafts a machine gun over a sniper when assault troops are fielded', () => {
  const s = arena();
  squad(s, 1, 'assault', 2800);
  squad(s, 0, 'infantry', 2500);
  squad(s, 0, 'infantry', 2560);
  hand(s, ['machinegun', 'sniper'], 3);
  // machinegun 41.3 (incl. +7 assault synergy) vs sniper 37.3
  return expectPlayed(s, 'machinegun');
});

test('AI drafts a sniper over a machine gun with only line infantry', () => {
  const s = arena();
  squad(s, 1, 'infantry', 2800);
  squad(s, 0, 'infantry', 2500);
  squad(s, 0, 'infantry', 2560);
  hand(s, ['machinegun', 'sniper'], 3);
  // machinegun 34.3 (no assault synergy) vs sniper 37.3
  return expectPlayed(s, 'sniper');
});

// --- Forward observer: indirect fire is faster and tighter with a spotter ---

test('AI drafts indirect fire over a sniper when scouts spot for it', () => {
  const s = arena();
  squad(s, 1, 'scouts', 2900);
  for (let i = 0; i < 5; i++) squad(s, 1, 'infantry', 2800 - i * 24);
  squad(s, 0, 'infantry', 2500);
  squad(s, 0, 'infantry', 2560);
  hand(s, ['mortar_carrier', 'sniper'], 4);
  // mortar_carrier 13.8 (incl. +5 spotter synergy) vs sniper 11.3
  return expectPlayed(s, 'mortar_carrier');
});

test('AI drafts a sniper over indirect fire without a spotter', () => {
  const s = arena();
  for (let i = 0; i < 6; i++) squad(s, 1, 'infantry', 2900 - i * 24);
  squad(s, 0, 'infantry', 2500);
  squad(s, 0, 'infantry', 2560);
  hand(s, ['mortar_carrier', 'sniper'], 4);
  // mortar_carrier 8.8 (no spotter synergy) vs sniper 11.3
  return expectPlayed(s, 'sniper');
});

test('AI drafts scouts when its own indirect fire needs a spotter', () => {
  const s = arena();
  squad(s, 1, 'mortar_carrier', 2900);
  squad(s, 1, 'infantry', 2850);
  squad(s, 0, 'infantry', 2500);
  squad(s, 0, 'infantry', 2560);
  hand(s, ['scouts', 'infantry'], 3);
  // scouts 33.95 (needsSpotter) vs infantry 30.3
  return expectPlayed(s, 'scouts');
});

test('AI drafts infantry instead of scouts without indirect fire', () => {
  const s = arena();
  squad(s, 1, 'infantry', 2900);
  squad(s, 1, 'infantry', 2850);
  squad(s, 0, 'infantry', 2500);
  squad(s, 0, 'infantry', 2560);
  hand(s, ['scouts', 'infantry'], 3);
  // scouts 18.95 (no spotter need) vs infantry 23.3
  return expectPlayed(s, 'infantry');
});

console.log(JSON.stringify(results, null, 2));
if (results.some((r) => !r.ok)) process.exitCode = 1;
