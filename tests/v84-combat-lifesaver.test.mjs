import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  ground,
} from '../game/engine.ts';

const DT = 1 / 60;
const out = path.resolve('output/v84-combat-lifesaver-qa');
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

// Flat open arena, AI director disabled.
function arena() {
  const s = createGame(81014);
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

// A single infantryman in a chosen squad, parked exactly at x.
function gruntSquad(s, side, x, squad) {
  const before = s.units.length;
  spawnUnit(s, side, 'infantry', x, { member: 0, squad });
  return s.units[before];
}

// A tanky enemy that never shoots back, parked on a hold order.
function enemy(s, x) {
  const before = s.units.length;
  spawnUnit(s, 1, 'infantry', x, { member: 0 });
  const e = s.units[before];
  e.squadOrder = 'hold';
  e.squadOrderUntil = 1e9;
  e.cooldown = 1e9;
  e.hp = 100000;
  e.maxHp = 100000;
  return e;
}

// Put a man down: bleeding, prone, out of the fight.
function wound(u, s, bleedOut = 7) {
  u.wounded = true;
  u.woundedTime = 10;
  u.bleedOut = bleedOut;
  u.rescueProgress = 0;
  u.pose = 'prone';
  u.y = ground(s, u.x);
  u.fire = 0;
  u.moving = false;
}

// A rifleman who will act as combat lifesaver. His scan clocks are parked
// during lazy-init so the first ticks do not start a channel early.
function lifesaver(s, x, squad = 77) {
  const u = gruntSquad(s, 0, x, squad);
  u.squadOrder = 'hold';
  u.squadOrderUntil = 1e9;
  u.firstAidScanAt = 1e9;
  u.dragScanAt = 1e9;
  return u;
}

// Lazy-init (magazines, etc.), then release the scan brakes.
function arm(s) {
  run(s, 2 * DT);
  for (const u of s.units) {
    u.firstAidScanAt = 0;
    u.dragScanAt = 0;
  }
}

function run(s, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) tick(s, DT);
}

function runUntil(s, predicate, timeout) {
  const steps = Math.round(timeout / DT);
  for (let i = 0; i < steps; i++) {
    tick(s, DT);
    if (predicate()) return s.time;
  }
  return null;
}

// A. A rifleman beside a downed squadmate kneels and stabilizes him.
check('A. buddy aid stabilizes a bleeding squadmate', () => {
  const s = arena();
  const cas = gruntSquad(s, 0, 120, 77); // x>110 so first aid is legal,
  const saver = lifesaver(s, 140); // x<=130 so drag never fires
  arm(s);
  wound(cas, s, 7);
  assert.ok(
    runUntil(s, () => saver.firstAidUntil !== undefined, 1) !== null,
    'the lifesaver should start a channel',
  );
  run(s, 0.1); // let the channel block set the kneeling pose
  assert.equal(saver.pose, 'crouch', 'he kneels to work');
  assert.equal(
    cas.firstAidByUid,
    saver.uid,
    'the casualty is bonded to his lifesaver',
  );
  assert.ok(
    runUntil(s, () => (cas.stabilizedUntil ?? 0) > s.time, 2.5) !== null,
    'the tourniquet should go on',
  );
  assert.ok(
    Math.abs(cas.rescueProgress - 0.5) < 0.01,
    'stabilizing banks half a revive tick',
  );
  assert.ok(
    (saver.firstAidCooldownUntil ?? 0) > s.time,
    'the lifesaver goes on cooldown',
  );
  return { rescueProgress: +cas.rescueProgress.toFixed(2) };
});

// B. No one kneels while a foe is in the hot zone.
check('B. enemies in the hot zone block buddy aid', () => {
  const s = arena();
  enemy(s, 400); // 260px from the saver, inside the 340px hot zone
  const cas = gruntSquad(s, 0, 120, 77);
  const saver = lifesaver(s, 140);
  arm(s);
  wound(cas, s, 7);
  run(s, 2);
  assert.equal(
    saver.firstAidUntil,
    undefined,
    'under direct fire he keeps his weapon up',
  );
  return { hot: true };
});

// C. A pinned man cannot help anyone.
check('C. heavy suppression blocks buddy aid', () => {
  const s = arena();
  const cas = gruntSquad(s, 0, 120, 77);
  const saver = lifesaver(s, 140);
  arm(s);
  wound(cas, s, 7);
  saver.suppression = 100; // decays at 7/s -> 86 after 2s, still >= 55
  run(s, 2);
  assert.equal(
    saver.firstAidUntil,
    undefined,
    'a cowering man cannot bandage anyone',
  );
  return { suppression: saver.suppression };
});

// D. A man 180px away is out of reach (and out of drag range too).
check('D. distant casualties are ignored', () => {
  const s = arena();
  const cas = gruntSquad(s, 0, 120, 77);
  const saver = lifesaver(s, 300); // 180px away
  arm(s);
  wound(cas, s, 7);
  run(s, 2);
  assert.equal(saver.firstAidUntil, undefined, 'too far to kneel');
  assert.ok(Math.abs(saver.x - 300) < 1, 'he stays put');
  return { dx: 180 };
});

// E. A tourniquet slows the bleed to a trickle.
check('E. stabilized casualties bleed at 15% rate', () => {
  const s = arena();
  const cas = gruntSquad(s, 0, 120, 77);
  arm(s);
  wound(cas, s, 7);
  cas.stabilizedUntil = s.time + 100;
  run(s, 1);
  const lost = 7 - cas.bleedOut;
  assert.ok(
    lost > 0.13 && lost < 0.17,
    `expected ~0.15 bleed, got ${lost.toFixed(3)}`,
  );
  return { lost: +lost.toFixed(3) };
});

// F. Only one man per squad kneels at a time.
check('F. one lifesaver per squad', () => {
  const s = arena();
  const cas = gruntSquad(s, 0, 120, 77);
  const sv1 = lifesaver(s, 130);
  const sv2 = lifesaver(s, 140);
  arm(s);
  wound(cas, s, 7);
  assert.ok(
    runUntil(s, () => (cas.stabilizedUntil ?? 0) > s.time, 3) !== null,
    'someone should stabilize the casualty',
  );
  const did1 =
    sv1.firstAidUntil !== undefined || (sv1.firstAidCooldownUntil ?? 0) > s.time;
  const did2 =
    sv2.firstAidUntil !== undefined || (sv2.firstAidCooldownUntil ?? 0) > s.time;
  assert.ok(did1 !== did2, 'exactly one lifesaver acted');
  assert.equal(
    sv1.firstAidUntil,
    undefined,
    'the channel is over by completion',
  );
  return { acted: did1 ? 'sv1' : 'sv2' };
});

// G. A channel breaks the moment the zone turns hot.
check('G. a hot zone interrupts the channel', () => {
  const s = arena();
  const cas = gruntSquad(s, 0, 120, 77);
  const saver = lifesaver(s, 140);
  arm(s);
  wound(cas, s, 7);
  assert.ok(
    runUntil(s, () => saver.firstAidUntil !== undefined, 1) !== null,
    'the channel should start',
  );
  enemy(s, 400); // zone turns hot mid-channel
  run(s, 0.5);
  assert.equal(
    saver.firstAidUntil,
    undefined,
    'he drops the tourniquet and grabs his rifle',
  );
  assert.equal(
    cas.firstAidByUid,
    undefined,
    'the bond is released',
  );
  assert.ok(
    (cas.stabilizedUntil ?? 0) <= s.time,
    'no tourniquet was applied',
  );
  return { interrupted: true };
});

// H. A casualty being dragged is let go.
check('H. a drag interrupts the channel', () => {
  const s = arena();
  const cas = gruntSquad(s, 0, 120, 77);
  const saver = lifesaver(s, 140);
  arm(s);
  wound(cas, s, 7);
  assert.ok(
    runUntil(s, () => saver.firstAidUntil !== undefined, 1) !== null,
    'the channel should start',
  );
  cas.draggedByUid = 99999; // someone else grabs the casualty
  run(s, 0.1);
  assert.equal(saver.firstAidUntil, undefined, 'the channel breaks');
  assert.equal(cas.firstAidByUid, undefined, 'the bond is released');
  return { interrupted: true };
});

// I. The medic still heals a stabilized man — first aid buys time, not health.
check('I. medics heal stabilized casualties', () => {
  const s = arena();
  const cas = gruntSquad(s, 0, 120, 77);
  arm(s);
  cas.hp = 5;
  cas.maxHp = 35;
  wound(cas, s, 7);
  cas.stabilizedUntil = s.time + 100;
  const before = s.units.length;
  spawnUnit(s, 0, 'medic', 140, { member: 0, squad: 77 });
  const medic = s.units[before];
  medic.squadOrder = 'hold';
  medic.squadOrderUntil = 1e9;
  run(s, 1.2); // two heal ticks: +1.6 progress, +8 hp
  assert.ok(
    cas.rescueProgress > 0.4,
    `the medic should bank progress, got ${cas.rescueProgress.toFixed(2)}`,
  );
  assert.ok(cas.hp > 5, `the medic should heal, hp=${cas.hp}`);
  assert.equal(cas.wounded, true, 'still down — 13hp < 14hp revive threshold');
  return { rescueProgress: +cas.rescueProgress.toFixed(2), hp: cas.hp };
});

// J. A lifesaver who is himself hit lets go of his patient.
check('J. a downed lifesaver releases his patient', () => {
  const s = arena();
  const cas = gruntSquad(s, 0, 120, 77);
  const saver = lifesaver(s, 140);
  arm(s);
  wound(cas, s, 7);
  assert.ok(
    runUntil(s, () => saver.firstAidUntil !== undefined, 1) !== null,
    'the channel should start',
  );
  // The saver takes a round and goes down mid-channel.
  saver.wounded = true;
  saver.bleedOut = 25;
  saver.woundedTime = 0;
  saver.pose = 'prone';
  saver.y = ground(s, saver.x);
  run(s, 0.1);
  assert.equal(
    saver.firstAidUntil,
    undefined,
    'his own channel is cleared',
  );
  assert.equal(
    cas.firstAidByUid,
    undefined,
    'the casualty is released',
  );
  return { released: true };
});

fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`\n${results.length} checks, ${failures.length} failures`);
if (failures.length) process.exit(1);
