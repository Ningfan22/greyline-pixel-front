import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  refreshVision,
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

// Mirrors the arena in v17-ai.test.mjs: flat terrain, no fog surprises, empty
// deck/discard so requestDraw cannot rescue a blocked hand, aiIn=0 so the first
// tick runs the director once.
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

test('rangers on the field block a redundant scouts purchase', () => {
  // Rangers carry the scout trait, so they are a spotter. With a mortar team
  // already needing observation, buying scouts would double up on recon.
  const s = arena();
  squad(s, 1, 'rangers', 3000);
  squad(s, 1, 'mortar', 3120);
  hand(s, ['scouts'], 3);
  refreshVision(s);
  tick(s, 0.05);
  assert.equal(s.players[1].played, 0);
  assert.ok(s.players[1].hand.some((h) => h.id === 'scouts'));
  return { played: s.players[1].played, hand: s.players[1].hand.map((h) => h.id) };
});

test('scouts on the field block a redundant rangers purchase', () => {
  // The mirror case: scouts already provide observation, so the director must
  // not spend 4 CP on rangers as a second recon asset. Before the fix rangers
  // skipped the observer branch and scored as line infantry (~32), so they were
  // bought; after the fix the observer branch vetoes them (-100).
  const s = arena();
  squad(s, 1, 'scouts', 3000);
  hand(s, ['rangers'], 4);
  refreshVision(s);
  tick(s, 0.05);
  assert.equal(s.players[1].played, 0);
  assert.ok(s.players[1].hand.some((h) => h.id === 'rangers'));
  return { played: s.players[1].played, hand: s.players[1].hand.map((h) => h.id) };
});

test('mortar without a spotter still buys scouts', () => {
  // Positive control: the observer purchase path must still fire when no
  // spotter is on the field. A lone mortar team needs observation, so scouts
  // score 34 (needsSpotter) and are bought immediately.
  const s = arena();
  squad(s, 1, 'mortar', 3120);
  hand(s, ['scouts'], 3);
  refreshVision(s);
  tick(s, 0.05);
  assert.equal(s.players[1].played, 1);
  assert.ok(!s.players[1].hand.some((h) => h.id === 'scouts'));
  return { played: s.players[1].played, hand: s.players[1].hand.map((h) => h.id) };
});

console.log(JSON.stringify(results, null, 2));
if (results.some((r) => !r.ok)) process.exitCode = 1;
