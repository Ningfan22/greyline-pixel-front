import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  refreshVision,
  setOrder,
} from '../game/engine.ts';
import { unitSynergy, synergyProviderUid } from '../game/synergy.ts';

const DT = 1 / 60;
const out = path.resolve('output/v58-overwatch-qa');
const results = [],
  failures = [];
fs.mkdirSync(out, { recursive: true });

function check(name, fn) {
  try {
    const details = fn();
    results.push({ name, ...details });
    console.log('PASS', name);
  } catch (e) {
    failures.push({ name, error: e.stack });
    console.error('FAIL', name, e.stack);
  }
}

function arena() {
  const s = createGame(58014);
  startGame(s);
  s.terrain.fill(374);
  s.original.fill(374);
  s.walls = [];
  s.scenery = [];
  s.players[1].deck = [];
  s.players[1].discard = [];
  s.players[1].hand = [];
  s.players[1].energy = 0;
  // Keep the AI director from rewriting orders mid-scenario.
  s.aiIn = 1e9;
  return s;
}

function squad(s, side, id, x) {
  const at = s.units.length;
  spawnUnit(s, side, id, x);
  return s.units.slice(at);
}

// Flat arena: a sniper team (2 members) at sniperX and an infantry rifle
// squad at infantryX. Both sides on hold so the snipers settle and build
// stillFor; an 'advance' order on side 0 keeps the snipers moving for the
// negative test. Every unit is silenced (cooldown 1e6) and frozen out of
// tactic decisions (decisionIn 1e6) so the scenario measures overwatch and
// nothing else.
function scene({
  sniperX = 2000,
  sniperSide = 0,
  hold = true,
  infantryX = 2200,
  withInfantry = true,
} = {}) {
  const s = arena();
  const snipers = squad(s, sniperSide, 'sniper', sniperX);
  let rifles = [];
  if (withInfantry) rifles = squad(s, 0, 'infantry', infantryX);
  setOrder(s, 0, hold ? 'hold' : 'advance');
  setOrder(s, 1, 'hold');
  for (const v of [...snipers, ...rifles]) {
    v.cooldown = 1e6;
    v.decisionIn = 1e6;
    v.hp = 99999;
    v.maxHp = 99999;
  }
  refreshVision(s);
  return { s, snipers, rifles };
}

function run(s, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) tick(s, DT);
}

// --- Activation ---

check('a halted sniper team provides overwatch to nearby infantry', () => {
  const { s, rifles } = scene();
  run(s, 1.5);
  const syn = unitSynergy(s, rifles[0], s.time);
  assert.equal(syn.overwatch, true, 'nearby infantry should be covered');
  return { overwatch: syn.overwatch };
});

check('a moving sniper team does not provide overwatch', () => {
  const { s, snipers, rifles } = scene({ hold: false });
  const startX = snipers[0].x;
  run(s, 1.5);
  const moved = Math.abs(snipers[0].x - startX);
  const syn = unitSynergy(s, rifles[0], s.time);
  assert.ok(moved > 5, `sniper should have advanced, moved ${moved.toFixed(1)}px`);
  assert.equal(syn.overwatch, false, 'a moving sniper must not cover anyone');
  return { moved: +moved.toFixed(1), overwatch: syn.overwatch };
});

// --- Effect ---

check('overwatch speeds suppression decay (1.35x)', () => {
  const covered = scene();
  run(covered.s, 1.5);
  covered.rifles[0].suppression = 100;
  run(covered.s, 5);
  const coveredSupp = covered.rifles[0].suppression;
  // 100 - 9.45*5 = 52.75
  assert.ok(
    coveredSupp < 56,
    `covered squad decayed below 56, got ${coveredSupp.toFixed(2)}`,
  );

  const uncovered = scene({ sniperX: 1000 });
  run(uncovered.s, 1.5);
  uncovered.rifles[0].suppression = 100;
  run(uncovered.s, 5);
  const uncoveredSupp = uncovered.rifles[0].suppression;
  // 100 - 7*5 = 65
  assert.ok(
    uncoveredSupp >= 63,
    `uncovered squad decayed only to ~65, got ${uncoveredSupp.toFixed(2)}`,
  );
  return {
    covered: +coveredSupp.toFixed(2),
    uncovered: +uncoveredSupp.toFixed(2),
  };
});

// --- Range / side gating ---

check('a sniper beyond 500px does not provide overwatch', () => {
  const { s, rifles } = scene({ sniperX: 1000 });
  run(s, 1.5);
  const syn = unitSynergy(s, rifles[0], s.time);
  assert.equal(syn.overwatch, false, 'a 1200px-distant sniper is out of range');
  return { overwatch: syn.overwatch };
});

check('an enemy sniper does not provide overwatch to our infantry', () => {
  const { s, rifles } = scene({ sniperSide: 1 });
  run(s, 1.5);
  const syn = unitSynergy(s, rifles[0], s.time);
  assert.equal(syn.overwatch, false, 'enemy snipers must not cover our men');
  return { overwatch: syn.overwatch };
});

// --- Self-exclusion / shooter-spotter pair ---

check('a sniper team member is covered by its spotter, not by itself', () => {
  const { s, snipers } = scene({ withInfantry: false });
  run(s, 1.5);
  const syn = unitSynergy(s, snipers[0], s.time);
  const provider = synergyProviderUid(s, snipers[0], 'overwatch', s.time);
  assert.equal(syn.overwatch, true, 'the second member should cover the first');
  assert.equal(
    provider,
    snipers[1].uid,
    `provider should be the spotter (uid ${snipers[1].uid}), got ${provider}`,
  );
  assert.notEqual(provider, snipers[0].uid, 'a sniper cannot cover itself');
  return { overwatch: syn.overwatch, provider };
});

check('a dead sniper team does not provide overwatch', () => {
  const { s, snipers, rifles } = scene();
  run(s, 1.5);
  assert.equal(
    unitSynergy(s, rifles[0], s.time).overwatch,
    true,
    'overwatch should be active before the snipers die',
  );
  for (const v of snipers) v.hp = 0;
  run(s, 0.8);
  const syn = unitSynergy(s, rifles[0], s.time);
  assert.equal(syn.overwatch, false, 'a dead sniper team provides no cover');
  return { overwatch: syn.overwatch };
});

check('two sniper teams can overwatch each other', () => {
  const s = arena();
  const a = squad(s, 0, 'sniper', 2000);
  const b = squad(s, 0, 'sniper', 2100);
  setOrder(s, 0, 'hold');
  setOrder(s, 1, 'hold');
  for (const v of [...a, ...b]) {
    v.cooldown = 1e6;
    v.decisionIn = 1e6;
    v.hp = 99999;
    v.maxHp = 99999;
  }
  refreshVision(s);
  run(s, 1.5);
  const synA = unitSynergy(s, a[0], s.time);
  const synB = unitSynergy(s, b[0], s.time);
  assert.equal(synA.overwatch, true, 'team A should be covered by team B');
  assert.equal(synB.overwatch, true, 'team B should be covered by team A');
  return { a: synA.overwatch, b: synB.overwatch };
});

fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`\n${results.length} checks, ${failures.length} failures`);
if (failures.length) process.exit(1);
