import assert from 'node:assert/strict';
import { adultFrameChoice, idleMicroChoice } from '../game/adult-animation.ts';
import { createGame, startGame, spawnUnit } from '../game/engine.ts';

const results = [];
function test(name, fn) {
  try {
    const value = fn();
    results.push({ name, ok: true, ...value });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}

// Minimal unit stub with every field the animation functions read.
function stubUnit(overrides = {}) {
  return {
    uid: 1,
    id: 'infantry',
    hp: 100,
    maxHp: 100,
    moving: false,
    fire: 0,
    aimUntil: 0,
    suppression: 0,
    digging: false,
    tending: false,
    draggingUid: undefined,
    pose: 'idle',
    walk: 0,
    backpedaling: false,
    wounded: false,
    crawling: false,
    surrendered: false,
    rappelling: false,
    climbing: 0,
    climbDuration: 1,
    motion: 'ground',
    motionTime: 0,
    motionDuration: 0,
    reloadingUntil: 0,
    fragThrow: 0,
    tendingTime: 0,
    woundedTime: 0,
    woundedFromPose: undefined,
    surrenderTime: 0,
    flash: 0,
    tactic: 'advance',
    ...overrides,
  };
}

// --- idleMicroChoice: null when the soldier is busy ---

test('idleMicroChoice is null while moving', () => {
  const u = stubUnit({ moving: true });
  assert.equal(idleMicroChoice(u, 0), null);
});

test('idleMicroChoice is null while firing', () => {
  const u = stubUnit({ fire: 0.5 });
  assert.equal(idleMicroChoice(u, 0), null);
});

test('idleMicroChoice is null while aiming', () => {
  const u = stubUnit({ aimUntil: 10 });
  assert.equal(idleMicroChoice(u, 5), null);
});

test('idleMicroChoice is null when suppressed', () => {
  const u = stubUnit({ suppression: 0.8 });
  assert.equal(idleMicroChoice(u, 0), null);
});

test('idleMicroChoice is null while digging', () => {
  const u = stubUnit({ digging: true });
  assert.equal(idleMicroChoice(u, 0), null);
});

test('idleMicroChoice is null while tending a casualty', () => {
  const u = stubUnit({ tending: true });
  assert.equal(idleMicroChoice(u, 0), null);
});

test('idleMicroChoice is null while dragging a casualty', () => {
  const u = stubUnit({ draggingUid: 99 });
  assert.equal(idleMicroChoice(u, 0), null);
});

// --- idleMicroChoice: alert and crouch phases ---

test('idleMicroChoice returns alert stance at the start of the alert window', () => {
  const u = stubUnit({ uid: 1 });
  // alertPhase = (time + uid * 7.31) % 11; uid=1 → offset 7.31
  // At time 3.69: (3.69 + 7.31) % 11 = 0 → inside the 1.6 s alert window
  const choice = idleMicroChoice(u, 3.69);
  assert.ok(choice, 'expected an alert micro-motion frame');
  assert.equal(choice.group, 'actions20');
  assert.equal(choice.index, 0);
});

test('idleMicroChoice returns crouch glance inside the crouch window', () => {
  const u = stubUnit({ uid: 2 });
  // v114 four-beat cycle: period = 9 + (uid % 5) * 1.3; uid=2 → 11.6 s,
  // offset = uid * 7.31 = 14.62. At time 10.58: (10.58 + 14.62) % 11.6 = 2.0
  // → inside the take-a-knee beat [1.4, 2.6).
  const choice = idleMicroChoice(u, 10.58);
  assert.ok(choice, 'expected a crouch micro-motion frame');
  assert.equal(choice.group, 'actions20');
  assert.equal(choice.index, 1);
});

test('idleMicroChoice is null outside both windows', () => {
  const u = stubUnit({ uid: 1 });
  // At time 20: alertPhase = (20 + 7.31) % 11 = 27.31 % 11 = 5.31 (outside 1.6)
  // crouchPhase = (20 + 13.7) % 27 = 33.7 % 27 = 6.7 (outside 2.2)
  assert.equal(idleMicroChoice(u, 20), null);
});

test('idleMicroChoice phases differ by uid so squads do not sync', () => {
  const a = stubUnit({ uid: 1 });
  const b = stubUnit({ uid: 5 });
  // At a fixed time, one soldier may be mid-motion while the other is idle.
  let aActive = 0;
  let bActive = 0;
  for (let t = 0; t < 40; t += 0.1) {
    if (idleMicroChoice(a, t)) aActive++;
    if (idleMicroChoice(b, t)) bActive++;
  }
  assert.ok(aActive > 0, 'soldier A should have some micro-motion frames');
  assert.ok(bActive > 0, 'soldier B should have some micro-motion frames');
  assert.notEqual(
    aActive,
    bActive,
    'different uids should produce different micro-motion timing',
  );
});

// --- Drag pose: slower crouch gait ---

test('dragger uses a slower crouch cycle than a normal crouch-walk', () => {
  const dragger = stubUnit({
    pose: 'crouch',
    moving: true,
    walk: 4,
    draggingUid: 99,
  });
  const normal = stubUnit({
    pose: 'crouch',
    moving: true,
    walk: 4,
  });
  const dragChoice = adultFrameChoice(dragger, 0);
  const normChoice = adultFrameChoice(normal, 0);
  assert.equal(dragChoice.group, 'crouch8');
  assert.equal(normChoice.group, 'crouch8');
  // walk=4 → normal cycle = floor(4) % 8 = 4; drag = floor(2) % 8 = 2
  assert.equal(normChoice.index, 4);
  assert.equal(dragChoice.index, 2);
  assert.notEqual(
    dragChoice.index,
    normChoice.index,
    'dragger must not match the normal crouch-walk frame at the same walk',
  );
});

test('dragger advances at half cadence over time', () => {
  const dragger = stubUnit({
    pose: 'crouch',
    moving: true,
    draggingUid: 99,
  });
  const normal = stubUnit({ pose: 'crouch', moving: true });
  // At walk=8: normal = floor(8)%8 = 0; drag = floor(4)%8 = 4
  dragger.walk = 8;
  normal.walk = 8;
  assert.equal(adultFrameChoice(normal, 0).index, 0);
  assert.equal(adultFrameChoice(dragger, 0).index, 4);
});

// --- Integration: a spawned infantryman can drive idleMicroChoice ---

test('spawned infantry passes the idle micro-motion guard', () => {
  const s = createGame(1);
  startGame(s);
  s.terrain.fill(374);
  s.original.fill(374);
  s.walls = [];
  s.scenery = [];
  spawnUnit(s, 0, 'infantry', 600);
  const u = s.units[s.units.length - 1];
  // A fresh unit may be mid-walk; force a clean idle state.
  u.moving = false;
  u.fire = 0;
  u.aimUntil = 0;
  u.suppression = 0;
  u.digging = false;
  u.tending = false;
  u.draggingUid = undefined;
  // At time 0 with uid offset, the soldier should be in a valid idle state
  // (either micro-motion or null — both are acceptable).
  const choice = idleMicroChoice(u, 0);
  if (choice) {
    assert.ok(['actions20'].includes(choice.group));
    assert.ok([0, 1].includes(choice.index));
  }
});

// --- Report ---

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
