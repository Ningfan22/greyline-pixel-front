import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  medicTriageScore,
  anotherMedicOnPatient,
  pickMedicPatient,
  peekShouldExpose,
} from '../game/engine.ts';

const DT = 1 / 60;
const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}

// Minimal stubs with every field the v46 functions read.
function stubSoldier(overrides = {}) {
  return {
    uid: 1,
    id: 'infantry',
    side: 0,
    x: 1000,
    hp: 100,
    maxHp: 100,
    wounded: false,
    bleedOut: 0,
    tending: false,
    cooldown: 0,
    suppression: 0,
    exposedUntil: 0,
    lastCombatShotAt: undefined,
    squadOrder: undefined,
    ...overrides,
  };
}

function stubState(units, time = 10) {
  return { time, units };
}

// --- medicTriageScore ------------------------------------------------------

test('triage: a casualty who cannot be saved (bleedOut <= 2.5) is skipped', () => {
  const medic = stubSoldier({ id: 'medic' });
  const dying = stubSoldier({ wounded: true, bleedOut: 2.0, hp: 20 });
  assert.equal(medicTriageScore(medic, dying), -Infinity);
});

test('triage: an urgent bleeder outranks a lightly wounded soldier', () => {
  const medic = stubSoldier({ id: 'medic' });
  const urgent = stubSoldier({ wounded: true, bleedOut: 4, hp: 30 });
  const light = stubSoldier({
    wounded: true,
    bleedOut: 20,
    hp: 80, // > 55% maxHp → -25 penalty
  });
  assert.ok(medicTriageScore(medic, urgent) > medicTriageScore(medic, light));
});

test('triage: at equal urgency the closer patient is preferred', () => {
  const medic = stubSoldier({ id: 'medic', x: 1000 });
  const near = stubSoldier({ wounded: true, bleedOut: 10, hp: 40, x: 1020 });
  const far = stubSoldier({ wounded: true, bleedOut: 10, hp: 40, x: 1120 });
  assert.ok(medicTriageScore(medic, near) > medicTriageScore(medic, far));
});

test('triage: a non-wounded hurt soldier scores below any wounded one', () => {
  const medic = stubSoldier({ id: 'medic' });
  const scratched = stubSoldier({ hp: 99 });
  const wounded = stubSoldier({ wounded: true, bleedOut: 24, hp: 90 });
  assert.ok(medicTriageScore(medic, wounded) > medicTriageScore(medic, scratched));
});

// --- anotherMedicOnPatient --------------------------------------------------

test('claim: another medic committed (tending) on the patient is detected', () => {
  const patient = stubSoldier({ wounded: true, x: 1000 });
  const other = stubSoldier({
    id: 'medic',
    uid: 2,
    tending: true,
    x: 1020,
  });
  const medic = stubSoldier({ id: 'medic', uid: 3, x: 1040 });
  const s = stubState([patient, other, medic]);
  assert.equal(anotherMedicOnPatient(s, medic, patient), true);
});

test('claim: a medic who has not committed (tending=false) does not block', () => {
  const patient = stubSoldier({ wounded: true, x: 1000 });
  const other = stubSoldier({ id: 'medic', uid: 2, tending: false, x: 1020 });
  const medic = stubSoldier({ id: 'medic', uid: 3, x: 1040 });
  const s = stubState([patient, other, medic]);
  assert.equal(anotherMedicOnPatient(s, medic, patient), false);
});

// --- pickMedicPatient -------------------------------------------------------

test('pick: returns undefined when the only patient is unsaveable', () => {
  const medic = stubSoldier({ id: 'medic', uid: 9 });
  const dying = stubSoldier({
    uid: 10,
    wounded: true,
    bleedOut: 1.5,
    hp: 10,
    x: 1010,
  });
  const s = stubState([medic, dying]);
  assert.equal(pickMedicPatient(s, medic), undefined);
});

test('pick: urgent wounded beats lightly wounded', () => {
  const medic = stubSoldier({ id: 'medic', uid: 9, x: 1000 });
  const urgent = stubSoldier({ uid: 10, wounded: true, bleedOut: 4, hp: 30, x: 1010 });
  const light = stubSoldier({ uid: 11, wounded: true, bleedOut: 20, hp: 80, x: 1020 });
  const s = stubState([medic, urgent, light]);
  assert.equal(pickMedicPatient(s, medic), urgent);
});

test('pick: under watch order a wounded patient beyond 64px is ignored', () => {
  const medic = stubSoldier({
    id: 'medic',
    uid: 9,
    x: 1000,
    squadOrder: 'watch',
  });
  const farWounded = stubSoldier({
    uid: 10,
    wounded: true,
    bleedOut: 10,
    hp: 40,
    x: 1100, // 100px away, outside the 64px watch radius
  });
  const nearScratch = stubSoldier({ uid: 11, hp: 90, x: 1020 });
  const s = stubState([medic, farWounded, nearScratch]);
  // Watch radius only shrinks for *wounded* candidates; the scratched
  // neighbour at 20px still qualifies under the 140px fallback.
  assert.equal(pickMedicPatient(s, medic), nearScratch);
});

test('pick: two medics do not both claim the same patient', () => {
  const medicA = stubSoldier({ id: 'medic', uid: 9, x: 1000 });
  const medicB = stubSoldier({ id: 'medic', uid: 12, x: 1005 });
  const p1 = stubSoldier({ uid: 10, wounded: true, bleedOut: 5, hp: 30, x: 1015 });
  const p2 = stubSoldier({ uid: 11, wounded: true, bleedOut: 12, hp: 50, x: 1025 });
  const s = stubState([medicA, medicB, p1, p2]);
  const first = pickMedicPatient(s, medicA);
  assert.equal(first, p1);
  // Simulate the tick: medic A commits to treating p1.
  medicA.tending = true;
  const second = pickMedicPatient(s, medicB);
  assert.notEqual(second, p1);
  assert.ok(second === p2 || second === undefined);
});

test('pick: dead and surrendered soldiers are never patients', () => {
  const medic = stubSoldier({ id: 'medic', uid: 9, x: 1000 });
  const dead = stubSoldier({ uid: 10, hp: 0, wounded: true, x: 1010 });
  const surrendered = stubSoldier({
    uid: 11,
    hp: 50,
    surrendered: true,
    x: 1020,
  });
  const s = stubState([medic, dead, surrendered]);
  assert.equal(pickMedicPatient(s, medic), undefined);
});

// --- peekShouldExpose -------------------------------------------------------

test('peek: a ready soldier behind cover starts a peek', () => {
  const u = stubSoldier({ uid: 7, cooldown: 0, exposedUntil: 0 });
  const s = stubState([u], 10);
  assert.equal(peekShouldExpose(s, u), true);
  assert.ok(u.exposedUntil > 10);
  // uid % 3 === 1 → base peek 0.61s, no suppression penalty.
  assert.ok(Math.abs(u.exposedUntil - 10.61) < 1e-9);
});

test('peek: a reloading soldier stays down', () => {
  const u = stubSoldier({ uid: 7, cooldown: 0.5, exposedUntil: 0 });
  const s = stubState([u], 10);
  assert.equal(peekShouldExpose(s, u), false);
  assert.equal(u.exposedUntil, 0);
});

test('peek: a soldier already in a peek window stays up', () => {
  const u = stubSoldier({ uid: 7, cooldown: 0.9, exposedUntil: 10.4 });
  const s = stubState([u], 10);
  assert.equal(peekShouldExpose(s, u), true);
});

test('peek: a suppressed soldier hesitates right after firing', () => {
  const u = stubSoldier({
    uid: 7,
    cooldown: 0,
    suppression: 80,
    lastCombatShotAt: 10.1, // hesitation = 0.3 + 80*0.004 = 0.62s
    exposedUntil: 0,
  });
  const s = stubState([u], 10.2);
  assert.equal(peekShouldExpose(s, u), false);
});

test('peek: a suppressed soldier peeks once the hesitation passes, with a shorter window', () => {
  const u = stubSoldier({
    uid: 7,
    cooldown: 0,
    suppression: 80,
    lastCombatShotAt: 9.0,
    exposedUntil: 0,
  });
  const s = stubState([u], 10);
  assert.equal(peekShouldExpose(s, u), true);
  // base 0.61 - min(0.2, 80*0.003=0.24) = 0.41s
  assert.ok(Math.abs(u.exposedUntil - 10.41) < 1e-9);
});

test('peek: after a window expires the soldier can peek again', () => {
  const u = stubSoldier({ uid: 7, cooldown: 0, exposedUntil: 0 });
  const s = stubState([u], 10);
  assert.equal(peekShouldExpose(s, u), true);
  const firstWindow = u.exposedUntil;
  // Window expires, weapon ready again.
  s.time = firstWindow + 0.01;
  u.exposedUntil = firstWindow - 0.01; // already in the past
  assert.equal(peekShouldExpose(s, u), true);
  assert.ok(u.exposedUntil > s.time);
});

test('peek: peek window never drops below 0.3s even when suppressed', () => {
  const u = stubSoldier({
    uid: 8, // uid % 3 === 2 → base 0.67
    cooldown: 0,
    suppression: 100,
    lastCombatShotAt: 0,
    exposedUntil: 0,
  });
  const s = stubState([u], 10);
  peekShouldExpose(s, u);
  // 0.67 - 0.2 = 0.47 > 0.3 floor; push suppression harder via a uid whose
  // base is lowest (uid % 3 === 0 → 0.55).
  const u2 = stubSoldier({
    uid: 9,
    cooldown: 0,
    suppression: 100,
    lastCombatShotAt: 0,
    exposedUntil: 0,
  });
  peekShouldExpose(s, u2);
  assert.ok(u2.exposedUntil - 10 >= 0.3 - 1e-9);
});

// --- integration: medic treats a casualty on the real battlefield -----------

function arena() {
  const s = createGame(46001);
  startGame(s);
  Object.assign(s, {
    units: [],
    scenery: [],
    walls: [],
    wrecks: [],
    aiIn: 1e9,
  });
  s.players.forEach((p) => (p.order = 'hold'));
  return s;
}

function run(s, frames) {
  for (let i = 0; i < frames; i++) tick(s, DT);
}

test('integration: a medic reaches and stabilises a bleeding casualty', () => {
  const s = arena();
  spawnUnit(s, 0, 'medic', 1000, { member: 0 });
  const medic = s.units.find((u) => u.side === 0 && u.id === 'medic');
  spawnUnit(s, 0, 'infantry', 1060, { member: 0 });
  const casualty = s.units.find(
    (u) => u.side === 0 && u.id === 'infantry',
  );
  casualty.wounded = true;
  casualty.bleedOut = 25;
  casualty.hp = Math.floor(casualty.maxHp * 0.3);
  const hpBefore = casualty.hp;
  // The medic is 60px away: outside the 64px treat radius for the wounded,
  // so he walks over first, then kneels to treat.
  run(s, 60 * 6);
  assert.ok(
    casualty.hp > hpBefore,
    `expected casualty hp to rise above ${hpBefore}, got ${casualty.hp}`,
  );
  assert.equal(medic.tending, true);
});

// --- report -----------------------------------------------------------------

let failed = 0;
for (const r of results) {
  if (r.ok) {
    console.log(`  ok  ${r.name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${r.name}\n        ${r.error}`);
  }
}
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
