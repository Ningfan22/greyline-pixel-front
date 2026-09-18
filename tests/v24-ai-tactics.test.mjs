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

function deck(s, ids) {
  const filled = [...ids];
  while (filled.length < 20) filled.push('infantry');
  s.players[1].deck = filled.map((id, i) => ({
    id,
    uid: 20000 + i,
    readyAt: 0,
  }));
}

// --- Smoke-contact: shock troops blind the enemy line before closing ---

test('AI lays smoke on the enemy line when shock troops make contact', () => {
  const s = arena();
  squad(s, 1, 'assault', 2800);
  squad(s, 1, 'assault', 2860);
  squad(s, 0, 'infantry', 2500);
  hand(s, ['smoke'], 2);
  refreshVision(s);
  tick(s, 0.05);
  assert.equal(s.players[1].played, 1);
  const smoke = s.smokes.find((m) => m.side === 1);
  assert.ok(smoke, 'expected a side-1 smoke screen');
  assert.ok(Math.abs(smoke.x - 2630) < 1, `smoke x ${smoke.x} ≈ 2630`);
  assert.ok((s.aiPushUntil ?? 0) > s.time, 'push window opened');
  assert.ok(s.players[1].energy < 2, 'smoke was paid for');
  return { smokeX: smoke.x, push: s.aiPushUntil - s.time };
});

test('AI orders a rush while the smoke push window is active', () => {
  const s = arena();
  squad(s, 1, 'assault', 2800);
  squad(s, 1, 'assault', 2860);
  squad(s, 0, 'infantry', 2500);
  hand(s, ['smoke'], 2);
  refreshVision(s);
  tick(s, 0.05);
  assert.equal(s.players[1].played, 1);
  s.aiIn = 0;
  tick(s, 0.05);
  assert.equal(s.players[1].order, 'rush');
  return { order: s.players[1].order };
});

// --- Archetype inference from the 20-card deck ---

function archetypeOf(deckIds) {
  const s = arena();
  squad(s, 1, 'infantry', 2900);
  deck(s, deckIds);
  refreshVision(s);
  tick(s, 0.05);
  return s.aiArchetype;
}

test('archetype: fire_support (artillery + scouts)', () => {
  assert.equal(archetypeOf(['artillery', 'scouts']), 'fire_support');
});

test('archetype: air_mobile (two air cards)', () => {
  assert.equal(
    archetypeOf(['air_assault', 'strike_jet']),
    'air_mobile',
  );
});

test('archetype: assault (two shock cards + smoke)', () => {
  assert.equal(
    archetypeOf(['assault', 'marines', 'smoke']),
    'assault',
  );
});

test('archetype: counterattack (reserve + withdrawal)', () => {
  assert.equal(
    archetypeOf(['reserve_mobilization', 'smoke_withdrawal']),
    'counterattack',
  );
});

test('archetype: combined (plain infantry)', () => {
  assert.equal(archetypeOf([]), 'combined');
});

console.log(JSON.stringify(results, null, 2));
if (results.some((r) => !r.ok)) process.exitCode = 1;
