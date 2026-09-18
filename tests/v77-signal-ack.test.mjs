import assert from 'node:assert/strict';
import { adultFrameChoice, idlePoseChoice } from '../game/adult-animation.ts';
import { createGame, startGame, spawnUnit } from '../game/engine.ts';
import { setSquadOrder } from '../game/squad-orders.ts';

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}

function arena() {
  const s = createGame(77);
  startGame(s);
  s.terrain.fill(374);
  s.original.fill(374);
  s.walls = [];
  s.scenery = [];
  return s;
}

function squad(s, side, id, x) {
  const at = s.units.length;
  spawnUnit(s, side, id, x);
  return s.units.slice(at);
}

// Minimal unit stub with every field adultFrameChoice reads on the idle path.
function stubUnit(overrides = {}) {
  return {
    uid: 1,
    id: 'infantry',
    hp: 100,
    maxHp: 100,
    moving: false,
    fire: 0,
    aimUntil: 0,
    reloadingUntil: 0,
    suppression: 0,
    digging: false,
    tending: false,
    draggingUid: undefined,
    vacuum: false,
    fragThrow: 0,
    pose: 'idle',
    facing: 1,
    walk: 0,
    backpedaling: false,
    tactic: 'advance',
    flash: 0,
    wounded: false,
    woundedFromPose: 'idle',
    woundedTime: 0,
    crawling: false,
    surrendered: false,
    surrenderTime: 0,
    rappelling: false,
    climbing: 0,
    climbDuration: 1,
    motion: 'ground',
    motionTime: 0,
    motionDuration: 1,
    signalUntil: 0,
    ackUntil: 0,
    overheatedUntil: 0,
    tendingTime: 0,
    ...overrides,
  };
}

// --- Order integration: a fresh order makes nearby members acknowledge ---

test('a fresh watch order makes nearby members acknowledge the leader signal', () => {
  const s = arena();
  const members = squad(s, 0, 'infantry', 900);
  const leader = members.reduce((a, b) => (a.uid < b.uid ? a : b));
  setSquadOrder(s, 0, leader.squad, 'watch');
  assert.ok((leader.signalUntil ?? 0) > s.time, 'leader signals');
  assert.equal(leader.ackUntil, undefined, 'the leader does not ack itself');
  const nearby = members.filter((m) => m !== leader);
  assert.ok(nearby.length >= 4, 'infantry squad has six members');
  for (const m of nearby) {
    assert.ok(
      (m.ackUntil ?? 0) > s.time,
      `member ${m.uid} got an ack window`,
    );
  }
});

test('ack windows are staggered by uid so the squad does not move in unison', () => {
  const s = arena();
  const members = squad(s, 0, 'infantry', 900);
  const leader = members.reduce((a, b) => (a.uid < b.uid ? a : b));
  setSquadOrder(s, 0, leader.squad, 'watch');
  const windows = members
    .filter((m) => m !== leader)
    .map((m) => m.ackUntil)
    .sort((a, b) => a - b);
  assert.ok(
    windows[windows.length - 1] - windows[0] > 0.1,
    'ack windows span a visible ripple',
  );
});

test('members too far away to see the signal do not acknowledge', () => {
  const s = arena();
  const members = squad(s, 0, 'infantry', 900);
  const leader = members.reduce((a, b) => (a.uid < b.uid ? a : b));
  const straggler = members.find((m) => m !== leader);
  straggler.x = leader.x + 400;
  setSquadOrder(s, 0, leader.squad, 'watch');
  assert.equal(straggler.ackUntil, undefined);
  const close = members.filter((m) => m !== leader && m !== straggler);
  for (const m of close) assert.ok((m.ackUntil ?? 0) > s.time);
});

test('repeating the same order does not re-signal or re-ack', () => {
  const s = arena();
  const members = squad(s, 0, 'infantry', 900);
  const leader = members.reduce((a, b) => (a.uid < b.uid ? a : b));
  setSquadOrder(s, 0, leader.squad, 'watch');
  const firstSignal = leader.signalUntil;
  const firstAcks = members.map((m) => m.ackUntil);
  s.time += 5;
  setSquadOrder(s, 0, leader.squad, 'watch');
  assert.equal(leader.signalUntil, firstSignal, 'no fresh signal on a repeat');
  assert.deepEqual(
    members.map((m) => m.ackUntil),
    firstAcks,
    'no fresh acks on a repeat',
  );
});

// --- Animation: the ack window drives a return arm pump ---

test('the ack window alternates the arm-over-head frame with the return pump', () => {
  // remaining 0.50s: floor(0.50*7)=3 -> arm pump; 0.36s: floor(2.52)=2 ->
  // return pump. v117: the settle beat is the arm-forward frame (9), not the
  // alert stand (0) — a plain frame would be swallowed by the patrol overlay.
  const pump = adultFrameChoice(stubUnit({ ackUntil: 1.0 }), 0.5);
  assert.deepEqual(pump, { group: 'actions20', index: 8 });
  const settle = adultFrameChoice(stubUnit({ ackUntil: 1.0 }), 0.64);
  assert.deepEqual(settle, { group: 'actions20', index: 9 });
});

test('after the ack window the soldier returns to the default idle frame', () => {
  const choice = adultFrameChoice(stubUnit({ ackUntil: 1.0 }), 1.5);
  assert.deepEqual(choice, { group: 'actions20', index: 0 });
});

test('crouched and prone members stay low instead of popping up to ack', () => {
  for (const [pose, expected] of [
    ['crouch', 1],
    ['prone', 2],
  ]) {
    const choice = adultFrameChoice(
      stubUnit({ pose, ackUntil: 1.0 }),
      0.5,
    );
    assert.equal(choice.group, 'actions20');
    assert.equal(choice.index, expected, `${pose} keeps its low pose`);
  }
});

test('moving, firing and reloading members do not ack', () => {
  assert.equal(
    adultFrameChoice(stubUnit({ ackUntil: 1.0, moving: true, walk: 3 }), 0.5)
      .group,
    'walk8',
  );
  assert.notEqual(
    adultFrameChoice(stubUnit({ ackUntil: 1.0, fire: 0.5 }), 0.5).index,
    8,
  );
  assert.equal(
    adultFrameChoice(stubUnit({ ackUntil: 1.0, reloadingUntil: 2.0 }), 0.5)
      .index,
    13,
  );
});

test('idlePoseChoice yields to an active ack so scans cannot mask it', () => {
  // uid=1 at t=20 is mid sector scan (phase 1.07 -> knee glance) without an
  // ack; with an active ack the composed idle pose must stand down.
  const scanning = idlePoseChoice(stubUnit({ uid: 1 }), 20.0);
  assert.equal(scanning.index, 1);
  const acking = idlePoseChoice(stubUnit({ uid: 1, ackUntil: 21.0 }), 20.0);
  assert.equal(acking, null);
});

// --- Report ---

let failed = 0;
for (const r of results) {
  if (r.ok) {
    console.log(`  ok  ${r.name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${r.name}`);
    console.log(`        ${r.error}`);
  }
}
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
