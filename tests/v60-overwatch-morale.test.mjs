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
const out = path.resolve('output/v60-overwatch-morale-qa');
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
  const s = createGame(60021);
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
// is 1200px away (outside the ring).  An enemy rifle squad at 2500 puts the
// friendly squad in contact (300px < 380px rifle range) so the morale-break
// check in decideTactic actually runs.  Every unit is silenced and frozen so
// the scenario measures the nerve morale-threshold shift and nothing else.
function scene({ covered = true } = {}) {
  const s = arena();
  const sniperX = covered ? 2000 : 1000;
  const snipers = squad(s, 0, 'sniper', sniperX);
  const rifles = squad(s, 0, 'infantry', 2200);
  const foes = squad(s, 1, 'infantry', 2500);
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

// Force one tactic decision on member 1 with the given morale, then return
// the resulting tactic.  Member 1 is used because the balanced-doctrine role
// list starts with 'prone' at index 0; member 1 maps to 'cover', so a
// non-'retreat' result proves the nerve bonus (not the role list) kept the
// unit in the fight.
function decideAt({ s, rifles, morale }) {
  const u = rifles[1];
  const syn = unitSynergy(s, u, s.time);
  u.personalMorale = morale;
  u.suppression = 0;
  u.decisionIn = 0;
  run(s, DT);
  return { tactic: u.tactic, overwatch: syn.overwatch, morale: u.personalMorale };
}

// --- Morale break threshold -------------------------------------------------

check('covered infantry at morale 30 holds the line (nerve raises the break point)', () => {
  const { s, rifles } = scene({ covered: true });
  run(s, 1.5);
  const r = decideAt({ s, rifles, morale: 30 });
  assert.equal(r.overwatch, true, 'overwatch should be active');
  // break point 35 - 7 = 28; 30 >= 28 so the squad stays in the fight
  assert.notEqual(
    r.tactic,
    'retreat',
    `covered squad at morale ${r.morale} should not break, got ${r.tactic}`,
  );
  return { overwatch: r.overwatch, morale: r.morale, tactic: r.tactic };
});

check('uncovered infantry at morale 30 breaks (no nerve bonus)', () => {
  const { s, rifles } = scene({ covered: false });
  run(s, 1.5);
  const r = decideAt({ s, rifles, morale: 30 });
  assert.equal(r.overwatch, false, 'overwatch should be inactive');
  // break point 35 - 0 = 35; 30 < 35 so the squad breaks
  assert.equal(
    r.tactic,
    'retreat',
    `uncovered squad at morale ${r.morale} should break, got ${r.tactic}`,
  );
  return { overwatch: r.overwatch, morale: r.morale, tactic: r.tactic };
});

check('covered infantry at morale 25 still breaks (nerve has a floor)', () => {
  const { s, rifles } = scene({ covered: true });
  run(s, 1.5);
  const r = decideAt({ s, rifles, morale: 25 });
  assert.equal(r.overwatch, true, 'overwatch should be active');
  // break point 35 - 7 = 28; 25 < 28 so the squad still breaks
  assert.equal(
    r.tactic,
    'retreat',
    `covered squad at morale ${r.morale} is past the floor and should break, got ${r.tactic}`,
  );
  return { overwatch: r.overwatch, morale: r.morale, tactic: r.tactic };
});

fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`\n${results.length} checks, ${failures.length} failures`);
if (failures.length) process.exit(1);
