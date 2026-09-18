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
// Two infantries in contact: side 1 at 2460, side 0 at 2000 (460 < 850).
function battleArena() {
  const s = arena();
  squad(s, 1, 'infantry', 2460);
  squad(s, 0, 'infantry', 2000);
  refreshVision(s);
  return s;
}
function expectPlayed(s, id) {
  tick(s, 0.05);
  assert.equal(s.players[1].played, 1, `${id} should be played`);
  assert.ok(
    !s.players[1].hand.some((h) => h.id === id),
    `${id} should leave the hand`,
  );
}

// --- economy cards: empty field, screenNeed makes highNeed true ---

test('war_production is played on an empty field for the immediate payout', () => {
  const s = arena();
  hand(s, ['war_production'], 2);
  expectPlayed(s, 'war_production');
  assert.ok(s.players[1].productionUntil > s.time);
  return { energy: s.players[1].energy };
});

test('forward_hq is played early for the permanent recharge upgrade', () => {
  const s = arena();
  hand(s, ['forward_hq'], 3);
  expectPlayed(s, 'forward_hq');
  assert.equal(s.players[1].forwardHq, true);
  return { cap: s.players[1].energyCap };
});

// --- effect cards ---

test('foraged_supplies is played to refill the hand', () => {
  const s = arena();
  // An empty deck would recycle the just-played card back into the hand
  // (draw reshuffles the discard pile), so seed a real deck to draw from.
  s.players[1].deck = [
    { id: 'infantry', uid: 20001, readyAt: 0 },
    { id: 'infantry', uid: 20002, readyAt: 0 },
  ];
  hand(s, ['foraged_supplies'], 1);
  expectPlayed(s, 'foraged_supplies');
  return { hand: s.players[1].hand.length };
});

test('blitz_doctrine is played while in contact', () => {
  const s = battleArena();
  hand(s, ['blitz_doctrine'], 3);
  expectPlayed(s, 'blitz_doctrine');
  assert.ok(s.players[1].blitzUntil > s.time);
  return { blitzUntil: s.players[1].blitzUntil };
});

test('comm_blackout is played in battle when the foe has energy', () => {
  const s = battleArena();
  s.players[0].energy = 5;
  hand(s, ['comm_blackout'], 3);
  expectPlayed(s, 'comm_blackout');
  assert.ok(s.players[0].blackoutUntil > s.time);
  return { blackoutUntil: s.players[0].blackoutUntil };
});

test('supply_interdiction is played in battle to tax foe cards', () => {
  const s = battleArena();
  s.players[0].energy = 5;
  hand(s, ['supply_interdiction'], 2);
  expectPlayed(s, 'supply_interdiction');
  assert.ok((s.players[0].taxCards ?? 0) > 0);
  return { taxCards: s.players[0].taxCards };
});

test('spoof_attack is played against enemy infantry', () => {
  const s = battleArena();
  hand(s, ['spoof_attack'], 1);
  expectPlayed(s, 'spoof_attack');
  assert.ok(s.players[0].spoofUntil > s.time);
  return { spoofUntil: s.players[0].spoofUntil };
});

test('radar_jam is played when an enemy helicopter is spotted', () => {
  const s = arena();
  squad(s, 1, 'infantry', 2800);
  // Air units are only spotted within ~450px of an observer; 1800 was
  // invisible to the infantry, so the director never knew the threat existed.
  squad(s, 0, 'helicopter', 2400);
  refreshVision(s);
  hand(s, ['radar_jam'], 2);
  expectPlayed(s, 'radar_jam');
  assert.ok(s.players[0].radarJamUntil > s.time);
  return { radarJamUntil: s.players[0].radarJamUntil };
});

test('entrench is played in battle with infantry on the line', () => {
  const s = battleArena();
  hand(s, ['entrench'], 2);
  expectPlayed(s, 'entrench');
  assert.ok(s.players[1].entrenchUntil > s.time);
  return { entrenchUntil: s.players[1].entrenchUntil };
});

// --- report ---

let failed = 0;
for (const r of results) {
  if (r.ok) console.log(`  ok - ${r.name}`);
  else {
    failed++;
    console.error(`  FAIL - ${r.name}: ${r.error}`);
  }
}
console.log(`${results.length - failed}/${results.length} passed`);
if (failed) process.exit(1);
