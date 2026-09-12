import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  refreshVision,
  visibleToSide,
  CARDS,
  chooseAiDeck,
  validDeck,
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
test('depleted squads buy available infantry instead of saving for a command vehicle', () => {
  const s = arena();
  for (const x of [2400, 2460]) {
    const g = squad(s, 1, 'infantry', x);
    for (const u of g) u.hp = 0;
    g[0].hp = 10;
  }
  squad(s, 0, 'infantry', 2150);
  hand(s, ['command_vehicle', 'infantry'], 2);
  refreshVision(s);
  tick(s, 0.05);
  assert.equal(s.players[1].played, 1);
  assert.ok(!s.players[1].hand.some((h) => h.id === 'infantry'));
  assert.ok(s.players[1].hand.some((h) => h.id === 'command_vehicle'));
  return { energy: s.players[1].energy };
});
test('unprotected artillery and idle AT do not consume the opening screen budget', () => {
  const s = arena();
  squad(s, 1, 'armed_police', 3000);
  hand(s, ['mortar_carrier', 'javelin'], 4);
  s.players[1].deck = [{ id: 'infantry', uid: 10020, readyAt: 0 }];
  s.players[1].drawIn = 5;
  refreshVision(s);
  tick(s, 0.05);
  assert.equal(s.players[1].played, 0);
  assert.ok(s.players[1].energy >= 4);
  for (let i = 0; i < 140 && s.players[1].drawIn < 8; i++) tick(s, 0.05);
  assert.ok(s.players[1].hand.some((h) => h.id === 'infantry'));
  assert.ok(s.players[1].drawIn > 8);
  assert.ok(s.players[1].energy < 4);
  return {
    hand: s.players[1].hand.map((h) => h.id),
    energy: s.players[1].energy,
  };
});
test('troops beyond firing range are not parked as artillery guards', () => {
  const s = arena(),
    gun = squad(s, 1, 'artillery', 3100)[0],
    g = squad(s, 1, 'antiarmor', 2800);
  gun.emplaced = true;
  gun.lastCombatShotAt = 0;
  const x = g.reduce((n, u) => n + u.x, 0) / g.length;
  refreshVision(s);
  for (let i = 0; i < 100; i++) tick(s, 0.05);
  assert.ok(g.every((u) => u.squadOrder !== 'hold'));
  const moved = x - g.reduce((n, u) => n + u.x, 0) / g.length;
  assert.ok(moved > 80);
  return { moved };
});
test('hidden enemy composition does not change the AI card or order decision', () => {
  const sample = (enemy) => {
    const s = arena();
    squad(s, 1, 'infantry', 3000);
    hand(s, ['infantry', 'javelin', 'manpads'], 4);
    if (enemy) squad(s, 0, enemy, 400);
    refreshVision(s);
    assert.ok(
      s.units.filter((u) => u.side === 0).every((u) => !visibleToSide(s, 1, u)),
    );
    s.seed = 99;
    tick(s, 0.05);
    return {
      hand: s.players[1].hand.map((h) => h.id),
      order: s.players[1].order,
      energy: s.players[1].energy,
      played: s.players[1].played,
    };
  };
  const clear = sample(null);
  assert.deepEqual(sample('heavy_tank'), clear);
  assert.deepEqual(sample('helicopter'), clear);
  return clear;
});
test('all deck choices obey 20-card copy limits and retain paid counters', () => {
  const sizes = [];
  for (let seed = 1; seed <= 4; seed++) {
    const d = chooseAiDeck(seed);
    assert.ok(validDeck(d));
    assert.ok(d.includes('antiarmor'));
    assert.ok(d.some((id) => CARDS[id].antiAir));
    sizes.push(d.length);
  }
  return { sizes };
});
console.log(JSON.stringify(results, null, 2));
if (results.some((r) => !r.ok)) process.exitCode = 1;
