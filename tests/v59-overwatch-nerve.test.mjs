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
import { unitSynergy } from '../game/synergy.ts';

const DT = 1 / 60;
const out = path.resolve('output/v59-overwatch-nerve-qa');
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
  const s = createGame(59014);
  startGame(s);
  s.terrain.fill(374);
  s.original.fill(374);
  s.walls = [];
  s.scenery = [];
  s.players[1].deck = [];
  s.players[1].discard = [];
  s.players[1].hand = [];
  s.players[1].energy = 0;
  s.aiIn = 1e9;
  return s;
}

function squad(s, side, id, x) {
  const at = s.units.length;
  spawnUnit(s, side, id, x);
  return s.units.slice(at);
}

// Flat arena.  When *covered* a halted sniper team sits 200px behind the
// rifle squad (inside the 500px overwatch ring); when *uncovered* the sniper
// is 1200px away (outside the ring).  An optional enemy rifle squad at 2500
// puts the friendly squad in contact (300px < 380px rifle range).  Every
// unit is silenced and frozen out of tactic decisions so the scenario
// measures the nerve pin-threshold shift and nothing else.
function scene({ covered = true, enemy = false } = {}) {
  const s = arena();
  const sniperX = covered ? 2000 : 1000;
  const snipers = squad(s, 0, 'sniper', sniperX);
  const rifles = squad(s, 0, 'infantry', 2200);
  let foes = [];
  if (enemy) foes = squad(s, 1, 'infantry', 2500);
  setOrder(s, 0, 'hold');
  setOrder(s, 1, 'hold');
  for (const v of [...snipers, ...rifles, ...foes]) {
    v.cooldown = 1e6;
    v.decisionIn = 1e6;
    v.hp = 99999;
    v.maxHp = 99999;
  }
  refreshVision(s);
  return { s, snipers, rifles, foes };
}

function run(s, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) tick(s, DT);
}

// Force one tactic decision on the chosen member with the given suppression,
// then return the resulting tactic.  Suppression decays first in the tick
// (7/s baseline, 9.45/s under overwatch) before decideTactic reads it, so the
// caller must leave headroom above/below the threshold.
function decideAt({ s, rifles, member, suppression }) {
  const u = rifles[member];
  // Sanity: overwatch state must match what the test expects.
  const syn = unitSynergy(s, u, s.time);
  u.suppression = suppression;
  u.decisionIn = 0;
  run(s, DT);
  return { tactic: u.tactic, overwatch: syn.overwatch, supp: u.suppression };
}

// --- Out of contact -------------------------------------------------------

check('covered infantry out of contact: suppression 75 stays on their feet', () => {
  const { s, rifles } = scene({ covered: true, enemy: false });
  run(s, 1.5);
  const r = decideAt({ s, rifles, member: 0, suppression: 75 });
  assert.equal(r.overwatch, true, 'overwatch should be active');
  // threshold 68 + 14 = 82; 75 - 0.16 decay = 74.84 < 82
  assert.equal(
    r.tactic,
    'advance',
    `covered squad with supp ${r.supp.toFixed(2)} should advance, got ${r.tactic}`,
  );
  return { overwatch: r.overwatch, suppression: +r.supp.toFixed(2), tactic: r.tactic };
});

check('uncovered infantry out of contact: suppression 75 hits the dirt', () => {
  const { s, rifles } = scene({ covered: false, enemy: false });
  run(s, 1.5);
  const r = decideAt({ s, rifles, member: 0, suppression: 75 });
  assert.equal(r.overwatch, false, 'overwatch should be inactive');
  // threshold 68 + 0 = 68; 75 - 0.12 decay = 74.88 > 68
  assert.equal(
    r.tactic,
    'prone',
    `uncovered squad with supp ${r.supp.toFixed(2)} should pin, got ${r.tactic}`,
  );
  return { overwatch: r.overwatch, suppression: +r.supp.toFixed(2), tactic: r.tactic };
});

// --- In contact ------------------------------------------------------------
// Member 1 is used for in-contact tests because the balanced-doctrine role
// list starts with 'prone' at index 0; member 1 maps to 'cover', so a
// non-'prone' result proves the nerve bonus (not the role list) kept the
// unit up.

check('covered infantry in contact: suppression 75 keeps manoeuvring', () => {
  const { s, rifles } = scene({ covered: true, enemy: true });
  run(s, 1.5);
  const r = decideAt({ s, rifles, member: 1, suppression: 75 });
  assert.equal(r.overwatch, true, 'overwatch should be active');
  // threshold 65 + 14 = 79; 75 - 0.16 = 74.84 < 79
  assert.notEqual(
    r.tactic,
    'prone',
    `covered squad with supp ${r.supp.toFixed(2)} should not pin, got ${r.tactic}`,
  );
  return { overwatch: r.overwatch, suppression: +r.supp.toFixed(2), tactic: r.tactic };
});

check('uncovered infantry in contact: suppression 75 pins', () => {
  const { s, rifles } = scene({ covered: false, enemy: true });
  run(s, 1.5);
  const r = decideAt({ s, rifles, member: 1, suppression: 75 });
  assert.equal(r.overwatch, false, 'overwatch should be inactive');
  // threshold 65 + 0 = 65; 75 - 0.12 = 74.88 > 65
  assert.equal(
    r.tactic,
    'prone',
    `uncovered squad with supp ${r.supp.toFixed(2)} should pin, got ${r.tactic}`,
  );
  return { overwatch: r.overwatch, suppression: +r.supp.toFixed(2), tactic: r.tactic };
});

// --- Nerve cap -------------------------------------------------------------

check('covered infantry: suppression 84 still pins (nerve has a cap)', () => {
  const { s, rifles } = scene({ covered: true, enemy: false });
  run(s, 1.5);
  const r = decideAt({ s, rifles, member: 0, suppression: 84 });
  assert.equal(r.overwatch, true, 'overwatch should be active');
  // threshold 68 + 14 = 82; 84 - 0.16 = 83.84 > 82
  assert.equal(
    r.tactic,
    'prone',
    `covered squad with supp ${r.supp.toFixed(2)} exceeds the +14 cap and should pin, got ${r.tactic}`,
  );
  return { overwatch: r.overwatch, suppression: +r.supp.toFixed(2), tactic: r.tactic };
});

fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`\n${results.length} checks, ${failures.length} failures`);
if (failures.length) process.exit(1);
