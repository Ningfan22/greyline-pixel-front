import assert from 'node:assert/strict';
import * as E from '../game/engine.ts';
import { energyInterval } from '../game/economy.ts';

const results = [];
function test(name, fn) {
  try {
    results.push({ name, ok: true, ...fn() });
  } catch (e) {
    results.push({ name, ok: false, error: e.stack });
  }
}

function arena() {
  const s = E.createGame(71);
  E.startGame(s);
  s.aiIn = 1e9;
  s.walls = [];
  s.scenery = [];
  s.terrain.fill(374);
  s.original.fill(374);
  for (const p of s.players) {
    p.hand = [];
    p.deck = [];
    p.discard = [];
    p.order = 'hold';
  }
  return s;
}
function token(s, side, id) {
  const h = { id, uid: ++s.uid };
  s.players[side].hand.push(h);
  return h;
}
function use(s, side, id) {
  return E.playCard(s, side, token(s, side, id).uid);
}

// v119 regression: war_production / forward_hq used to fall through to the
// overdraft branch (the chain ended in a bare `if`), granting an extra 5
// energy and a 25s recharge slow on every economy play.

test('war_production pays 2 and gains 2 without triggering overdraft', () => {
  const s = arena();
  const p = s.players[0];
  p.energy = 4;
  const before = energyInterval(s, 0);
  const r = use(s, 0, 'war_production');
  assert.equal(r.ok, true, r.message);
  assert.equal(p.energy, 4, 'net energy should be 0 (pay 2, gain 2)');
  assert.ok(p.productionUntil > s.time, 'productionUntil should be set');
  assert.equal(p.overdraftUntil, null, 'overdraft must not fire');
  assert.ok(
    energyInterval(s, 0) < before,
    'recharge interval should shrink during production',
  );
  assert.ok(Math.abs(energyInterval(s, 0) - (before - 0.62)) < 1e-9);
  return { energy: p.energy, interval: energyInterval(s, 0) };
});

test('forward_hq upgrades recharge without triggering overdraft', () => {
  const s = arena();
  const p = s.players[0];
  p.energy = 3;
  const before = energyInterval(s, 0);
  const r = use(s, 0, 'forward_hq');
  assert.equal(r.ok, true, r.message);
  assert.equal(p.energy, 0, 'should spend all 3 energy');
  assert.equal(p.forwardHq, true);
  assert.equal(p.energyCap, 8, 'cap should drop from 10 to 8');
  assert.equal(p.overdraftUntil, null, 'overdraft must not fire');
  assert.ok(Math.abs(energyInterval(s, 0) - (before - 0.5)) < 1e-9);
  return { cap: p.energyCap, interval: energyInterval(s, 0) };
});

test('overdraft card still works (positive regression on the else-if chain)', () => {
  const s = arena();
  const p = s.players[0];
  p.energy = 2;
  const r = use(s, 0, 'overdraft');
  assert.equal(r.ok, true, r.message);
  assert.equal(p.energy, 6, 'pay 1, gain 5 → net +4');
  assert.ok(p.overdraftUntil > s.time, 'overdraftUntil should be set');
  return { energy: p.energy, overdraftUntil: p.overdraftUntil };
});

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
