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

const DT = 1 / 60;
const out = path.resolve('output/v61-breach-assault-qa');
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
  const s = createGame(60031);
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

function run(s, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) tick(s, DT);
}

// Flat arena with a 140hp wall at 510.  A combat engineer squad stands at
// 480 (already in breaching range: the wall find radius is width/2+14=31),
// an assault squad waits at 420 on hold (90px from the wall, inside the 200px
// surge radius), a defender squad holds at 600 (90px behind the wall, inside
// the 130px breach-shock radius) and a distant squad at 800 (290px, outside
// it).  Everyone but the engineer is silenced and frozen so the scenario
// measures the breach trigger and nothing else.
function scene() {
  const s = arena();
  s.walls = [{ uid: 1, x: 510, width: 34, height: 32, hp: 140 }];
  const engineers = squad(s, 0, 'engineers', 480);
  const assault = squad(s, 0, 'assault', 420);
  const defenders = squad(s, 1, 'infantry', 600);
  const distant = squad(s, 1, 'infantry', 800);
  // Side 0 stays on the default 'advance' order so the engineers walk up and
  // breach; the assault squad is frozen individually via its squad order.
  for (const v of assault) v.squadOrder = 'hold';
  // Engineers need 'rush' to bypass blockedContact: the defender at x=600 is
  // visible through the 32px wall, so under 'advance' the engineers go prone
  // and never reach the wall to trigger the breach code in moveSoldier.
  for (const v of engineers) v.squadOrder = 'rush';
  setOrder(s, 1, 'hold');
  for (const v of [...assault, ...defenders, ...distant]) {
    v.cooldown = 1e6;
    v.decisionIn = 1e6;
    v.hp = 99999;
    v.maxHp = 99999;
  }
  for (const v of engineers) {
    v.cooldown = 1e6;
    v.hp = 99999;
    v.maxHp = 99999;
  }
  refreshVision(s);
  return { s, engineers, assault, defenders, distant };
}

// --- Breach grants surge ----------------------------------------------------

check('breach grants a movement surge to nearby assault troops', () => {
  const { s, assault } = scene();
  run(s, 2.5);
  assert.equal(s.walls[0].hp, 0, 'wall should be breached');
  const a = assault[0];
  assert(
    (a.assaultSurgeUntil ?? 0) > s.time,
    `assault troop should be surging (surgeUntil=${a.assaultSurgeUntil}, time=${s.time})`,
  );
  assert(
    (a.assaultBurstUntil ?? 0) > s.time,
    'assault troop should keep the existing fire burst',
  );
  return {
    wallHp: s.walls[0].hp,
    surgeActive: (a.assaultSurgeUntil ?? 0) > s.time,
    burstActive: (a.assaultBurstUntil ?? 0) > s.time,
  };
});

// --- Surge shows up as a charge ---------------------------------------------

check('surging assault troops break into a run', () => {
  const s = arena();
  const surge = squad(s, 0, 'assault', 400);
  const calm = squad(s, 0, 'assault', 200);
  for (const v of [...surge, ...calm]) {
    v.cooldown = 1e6;
    v.hp = 99999;
    v.maxHp = 99999;
  }
  surge[0].assaultSurgeUntil = s.time + 4;
  run(s, 0.3);
  assert(surge[0].moving, 'surging troop should be moving');
  assert.equal(
    surge[0].pose,
    'run',
    `surging troop should charge at a run, got ${surge[0].pose}`,
  );
  assert(calm[0].moving, 'control troop should be moving');
  assert.notEqual(
    calm[0].pose,
    'run',
    `control troop should not be running, got ${calm[0].pose}`,
  );
  return { surgePose: surge[0].pose, calmPose: calm[0].pose };
});

// --- Breach shock ------------------------------------------------------------

check('breach shock suppresses defenders behind the wall', () => {
  const { s, defenders } = scene();
  const d = defenders[0];
  d.suppression = 0;
  d.flinchUntil = 0;
  d.decisionIn = 0;
  // The wall falls on the second breach hit (~1.2s); the flinch window is
  // only 0.5s, so stop inside it instead of running past it.
  run(s, 1.5);
  assert.equal(s.walls[0].hp, 0, 'wall should be breached');
  assert(
    d.suppression >= 26,
    `defender should be suppressed by the breach blast, got ${d.suppression}`,
  );
  assert(
    d.flinchUntil > s.time - 0.1,
    'defender should have flinched at the breach',
  );
  assert(
    d.decisionIn > 0,
    'defender should have lost their footing (decisionIn pushed back)',
  );
  return {
    suppression: d.suppression,
    flinch: d.flinchUntil,
    decisionIn: d.decisionIn,
  };
});

check('distant defenders are untouched by the breach', () => {
  const { s, distant } = scene();
  const d = distant[0];
  d.suppression = 0;
  d.flinchUntil = 0;
  run(s, 2.5);
  assert.equal(s.walls[0].hp, 0, 'wall should be breached');
  assert.equal(
    d.suppression,
    0,
    `distant defender should not be suppressed, got ${d.suppression}`,
  );
  assert.equal(
    d.flinchUntil,
    0,
    'distant defender should not have flinched',
  );
  return { suppression: d.suppression, flinch: d.flinchUntil };
});

fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`\n${results.length} checks, ${failures.length} failures`);
if (failures.length) process.exit(1);
