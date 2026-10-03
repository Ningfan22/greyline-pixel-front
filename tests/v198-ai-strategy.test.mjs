import test from 'node:test';
import assert from 'node:assert/strict';
import { createGame, startGame, tick, spawnUnit, refreshVision, visibleToSide,
  playCard, requestDraw, payableCardCost, W, DRAW_COST, ENERGY_TIME } from '../game/engine.ts';
import { CARDS } from '../game/cards.ts';
import { DECK_PRESETS } from '../game/deck-presets.ts';

const DT = 0.05;
function arena(seed = 198501) {
  const s = createGame(seed, undefined, undefined, undefined,
    { difficulty: 'standard', weather: false });
  startGame(s);
  Object.assign(s, { units: [], scenery: [], walls: [], wrecks: [], aiIn: 1e9, night: false });
  s.terrain.fill(374); s.original.fill(374);
  for (const p of s.players) Object.assign(p, { hand: [], deck: [], discard: [], energy: 0, order: 'advance' });
  return s;
}
function bank(s, cp) {
  s.aiIn = 1e9;
  while (s.players[1].energy + 1e-8 < cp) tick(s, DT);
  assert(Math.abs(s.players[1].energy - s.time / ENERGY_TIME) < 1e-8);
  assert.equal(s.players[0].energy, s.players[1].energy, 'standard difficulty earns exactly the same real CP');
}
function hand(s, ids) {
  s.players[1].hand = ids.map(id => ({ id, uid: ++s.uid, readyAt: 0 }));
}
function squad(s, side, id, x) {
  const from = s.units.length; spawnUnit(s, side, id, x);
  return s.units.slice(from);
}
function decide(s) {
  const old = s.players[1].hand.map(h => ({ ...h }));
  refreshVision(s); s.aiIn = 0; tick(s, DT);
  return old.filter(h => !s.players[1].hand.some(v => v.uid === h.uid)).map(h => h.id);
}

test('a real opening rifle budget deploys the held screen before paying for more cards', () => {
  const s = arena(); bank(s, 2); hand(s, ['supply', 'infantry']);
  s.players[1].deck = ['scouts', 'javelin'].map(id => ({ id, uid: ++s.uid }));
  assert.deepEqual(decide(s), ['infantry']);
  assert.equal(s.players[1].deck.length, 2);
  assert(s.units.some(u => u.side === 1 && u.id === 'infantry'));
  assert(Math.abs(s.players[1].energy - (s.time / ENERGY_TIME - CARDS.infantry.cost)) < 1e-8);
});

test('empty launchers and their returning squad do not postpone a real replacement counter', () => {
  for (const withdrawing of [false, true]) {
    const s = arena(); bank(s, 4); hand(s, ['infantry', 'javelin']);
    for (const u of squad(s, 1, 'javelin', W - 600)) {
      u.ammo = 0; u.ammoReserve = 0;
      if (withdrawing) u.resupplyState = 'withdrawing';
    }
    squad(s, 0, 'tank', W - 900);
    assert.deepEqual(decide(s), ['javelin']);
  }
});

test('a visible heavy hull does not make the AI waste its RPG budget on an impenetrable target', () => {
  const s = arena(); bank(s, 2); hand(s, ['antiarmor', 'javelin', 'infantry']);
  squad(s, 1, 'scouts', W - 500); const enemy = squad(s, 0, 'heavy_tank', W - 700)[0];
  refreshVision(s); assert(visibleToSide(s, 1, enemy));
  assert.deepEqual(decide(s), []);
  assert(s.players[1].energy >= 2, 'the real CP remain reserved for the guided heavy-armour answer');
  assert(s.players[1].hand.some(h => h.id === 'antiarmor'));
});

test('an ordinary loaded RPG remains a usable affordable answer to a main tank at HQ', () => {
  const s = arena(); bank(s, 2); hand(s, ['antiarmor', 'javelin', 'infantry']);
  squad(s, 1, 'scouts', W - 500); squad(s, 0, 'tank', W - 550);
  assert.deepEqual(decide(s), ['antiarmor']);
});

test('healthy supply teams do not replace paid searches for the missing front line', () => {
  const s = arena(); bank(s, CARDS.supply_team.cost); hand(s, ['supply_team']);
  squad(s, 1, 'supply_team', 3250); squad(s, 1, 'infantry', 3200);
  s.players[1].deck = [{ id: 'infantry', uid: ++s.uid }];
  assert.deepEqual(decide(s), []);
  assert(s.players[1].hand.some(h => h.id === 'infantry'));
  assert.equal(s.players[1].deck.length, 0);
  assert(Math.abs(s.players[1].energy - (s.time / ENERGY_TIME - DRAW_COST)) < 1e-8);
});

test('a genuinely depleted front can still buy a paid supply team', () => {
  const s = arena(); bank(s, CARDS.supply_team.cost); hand(s, ['supply_team']);
  for (const u of squad(s, 1, 'infantry', 3250)) { u.ammo = 20; u.ammoReserve = 0; }
  assert.deepEqual(decide(s), ['supply_team']);
});

test('an FPV warhead waits for an observed target rather than expiring over an empty front', () => {
  const s = arena(); bank(s, 1); hand(s, ['fpv_drone']);
  s.players[1].deck = [{ id: 'infantry', uid: ++s.uid }];
  assert.deepEqual(decide(s), []);
  assert.equal(s.units.filter(u => u.id === 'fpv_drone').length, 0);
  assert(s.players[1].energy >= 1);
});

test('armour contact permits return fire and local positioning rather than an unscreened global rush', () => {
  const s = arena(); hand(s, []);
  squad(s, 1, 'infantry', 2850); squad(s, 1, 'tank', 2850);
  squad(s, 0, 'infantry', 2530); squad(s, 0, 'tank', 2500);
  decide(s); assert.equal(s.players[1].order, 'advance');
});

test('electronic battle choices do not inspect the opposing player command-point balance', () => {
  for (const id of ['cyber_suppression', 'comm_blackout', 'supply_interdiction', 'logistics_strike']) {
    const sample = enemyCP => {
      const s = arena(); bank(s, 4); hand(s, [id]);
      squad(s, 1, 'infantry', 2850); squad(s, 1, 'infantry', 2950);
      squad(s, 0, 'infantry', 2600); s.players[0].energy = enemyCP;
      const played = decide(s);
      return { played, hand: s.players[1].hand.map(h => h.id), order: s.players[1].order,
        energy: s.players[1].energy };
    };
    assert.deepEqual(sample(0), sample(9), id);
    assert.deepEqual(sample(0).played, [id], `${id} should use an actual battle window`);
  }
});

test('a live recharge suppression is not bought again while its public effect is still active', () => {
  const s = arena(); bank(s, 4); hand(s, ['cyber_suppression']);
  squad(s, 1, 'infantry', 2850); squad(s, 1, 'infantry', 2950);
  squad(s, 0, 'infantry', 2600); s.players[0].suppressedUntil = s.time + 8;
  assert.deepEqual(decide(s), []);
  assert(s.players[1].hand.some(h => h.id === 'cyber_suppression'));
});

test('hidden armour does not change the strategy or spend CP on a counter it has not observed', () => {
  const sample = hidden => {
    const s = arena(); bank(s, 4); hand(s, ['infantry', 'javelin', 'manpads']);
    squad(s, 1, 'infantry', 3250);
    if (hidden) {
      const u = squad(s, 0, 'heavy_tank', 400)[0]; refreshVision(s);
      assert(!visibleToSide(s, 1, u));
    }
    return { played: decide(s), energy: s.players[1].energy, order: s.players[1].order };
  };
  assert.deepEqual(sample(true), sample(false));
});

for (const nativeTerrain of [false, true])
test(`a standard-resource ${nativeTerrain ? 'original village' : 'flat'} match forms a fighting line and exchanges real damage without gifted CP`, t => {
  const deck = DECK_PRESETS.find(d => d.id === 'combined').cards;
  const s = createGame(198517, deck, deck, undefined,
    { difficulty: 'standard', weather: false });
  startGame(s); s.night = false;
  if (!nativeTerrain) { s.terrain.fill(374); s.original.fill(374); s.walls = []; s.scenery = []; }
  else assert(s.scenery.some(c => c.kind === 'house'), 'the original village must keep its blocking houses');
  assert.equal(s.players[0].energy, 0); assert.equal(s.players[1].energy, 0);
  const spent = [0, 0], shots = [0, 0], received = [0, 0], recorded = new Map(), hp = new Map();
  let redDraws = 0, firstContact = null;
  const stopAt = nativeTerrain ? 240 : 210;
  while (s.time < stopAt - 1e-8 && s.status === 'playing') {
    const human = s.players[0];
    const fighting = human.hand.find(h => CARDS[h.id].type === 'unit' &&
      !CARDS[h.id].heal && !CARDS[h.id].observer && h.id !== 'supply_team' &&
      !CARDS[h.id].airOnly && payableCardCost(human, h) <= human.energy);
    if (fighting) {
      const cost = payableCardCost(human, fighting);
      if (playCard(s, 0, fighting.uid).ok) spent[0] += cost;
    } else if (human.hand.length < 6 && human.deck.length &&
        !human.hand.some(h => CARDS[h.id].type === 'unit' && !CARDS[h.id].heal &&
          !CARDS[h.id].observer && !CARDS[h.id].airOnly)) {
      if (requestDraw(s, 0).ok) spent[0] += DRAW_COST;
    }
    const red = s.players[1], previous = red.hand.map(h => ({ ...h }));
    const oldDraw = red.drawIn, oldPlayed = red.played;
    tick(s, Math.min(DT, stopAt - s.time));
    if (red.drawIn > oldDraw + 0.5) { spent[1] += DRAW_COST; redDraws++; }
    if (red.played > oldPlayed)
      for (const h of previous.filter(h => !red.hand.some(v => v.uid === h.uid))) spent[1] += CARDS[h.id].cost;
    for (const u of s.units) {
      // spawnUnit seeds primary shots with the member index for staggered bursts.
      // Those initial counters are not projectiles or evidence of return fire.
      const count = (u.shots ?? 0) + (u.secondaryShots ?? 0), old = recorded.get(u.uid) ?? (u.member ?? 0);
      shots[u.side] += Math.max(0, count - old); recorded.set(u.uid, count);
      received[u.side] += Math.max(0, (hp.get(u.uid) ?? u.maxHp) - Math.max(0, u.hp));
      hp.set(u.uid, Math.max(0, u.hp));
    }
    if (firstContact === null && shots[0] > 0 && shots[1] > 0) firstContact = s.time;
  }
  assert(firstContact !== null, `both armies must exchange real fire: ${JSON.stringify({ shots, redPlayed: s.players[1].played })}`);
  assert(shots[0] > 20 && shots[1] > 20);
  assert(received[0] > 100 && received[1] > 100,
    `real fire must inflict damage on both sides: ${JSON.stringify({ shots, received })}`);
  assert(s.players[1].played >= 5, 'normal slow CP still buys several useful paid deployments');
  assert(redDraws > 0, 'the live army must fund its own replacement draws');
  for (const side of [0, 1]) assert(spent[side] <= s.time / ENERGY_TIME + 1e-6,
    `side ${side} cannot spend more real CP than it earned`);
  t.diagnostic(JSON.stringify({ terrain: nativeTerrain ? 'village' : 'flat', seconds: s.time,
    firstContact, shots, received, played: s.players.map(p => p.played), redDraws, spent,
    earned: s.time / ENERGY_TIME, kills: s.players.map(p => p.kills) }));
});
