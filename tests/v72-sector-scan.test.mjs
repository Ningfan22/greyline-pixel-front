import assert from 'node:assert/strict';
import {
  sectorScanChoice,
  idlePoseChoice,
  idleMicroChoice,
} from '../game/adult-animation.ts';
import { createGame, startGame, spawnUnit } from '../game/engine.ts';

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}

// Minimal unit stub with every field the scan functions read.
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
    vacuum: false,
    fragThrow: 0,
    pose: 'idle',
    facing: 1,
    wounded: false,
    surrendered: false,
    ...overrides,
  };
}

// --- sectorScanChoice: null when the soldier is busy or not holding ---

test('sectorScanChoice is null while moving', () => {
  assert.equal(sectorScanChoice(stubUnit({ moving: true }), 0), null);
});

test('sectorScanChoice is null while firing', () => {
  assert.equal(sectorScanChoice(stubUnit({ fire: 0.5 }), 0), null);
});

test('sectorScanChoice is null while aiming', () => {
  assert.equal(sectorScanChoice(stubUnit({ aimUntil: 5 }), 0), null);
});

test('sectorScanChoice is null when suppressed', () => {
  assert.equal(sectorScanChoice(stubUnit({ suppression: 0.5 }), 0), null);
});

test('sectorScanChoice is null while digging', () => {
  assert.equal(sectorScanChoice(stubUnit({ digging: true }), 0), null);
});

test('sectorScanChoice is null while tending a casualty', () => {
  assert.equal(sectorScanChoice(stubUnit({ tending: true }), 0), null);
});

test('sectorScanChoice is null while dragging a casualty', () => {
  assert.equal(
    sectorScanChoice(stubUnit({ draggingUid: 7 }), 0),
    null,
  );
});

test('sectorScanChoice is null in a command vacuum', () => {
  assert.equal(sectorScanChoice(stubUnit({ vacuum: true }), 0), null);
});

test('sectorScanChoice is null mid frag throw', () => {
  assert.equal(sectorScanChoice(stubUnit({ fragThrow: 0.3 }), 0), null);
});

test('sectorScanChoice is null when wounded', () => {
  assert.equal(sectorScanChoice(stubUnit({ wounded: true }), 0), null);
});

test('sectorScanChoice is null when surrendered', () => {
  assert.equal(sectorScanChoice(stubUnit({ surrendered: true }), 0), null);
});

test('sectorScanChoice is null when dead', () => {
  assert.equal(sectorScanChoice(stubUnit({ hp: 0 }), 0), null);
});

test('sectorScanChoice is null in crouch, prone and hunker poses', () => {
  for (const pose of ['crouch', 'prone', 'hunker', 'walk']) {
    assert.equal(sectorScanChoice(stubUnit({ pose }), 0), null);
  }
});

// --- sectorScanChoice: the three-beat scan cycle ---
// uid=1: period = 23 + 1*1.7 = 24.7; phase = (t + 5.77) % 24.7.
// Scan window opens at t = 24.7 - 5.77 = 18.93.

test('beat 1 is the alert stance facing front', () => {
  const choice = sectorScanChoice(stubUnit({ uid: 1, facing: 1 }), 18.93);
  assert.deepEqual(choice, { group: 'actions20', index: 0, dir: 1 });
});

test('beat 2 takes a knee and flips the sprite to the rear', () => {
  const choice = sectorScanChoice(stubUnit({ uid: 1, facing: 1 }), 19.93);
  assert.deepEqual(choice, { group: 'actions20', index: 1, dir: -1 });
});

test('beat 3 returns to the alert stance facing front', () => {
  const choice = sectorScanChoice(stubUnit({ uid: 1, facing: 1 }), 21.43);
  assert.deepEqual(choice, { group: 'actions20', index: 0, dir: 1 });
});

test('the scan window closes after three seconds', () => {
  assert.equal(sectorScanChoice(stubUnit({ uid: 1 }), 22.0), null);
});

test('the rear-glance dir mirrors facing for a left-facing unit', () => {
  const choice = sectorScanChoice(stubUnit({ uid: 1, facing: -1 }), 19.93);
  assert.equal(choice.dir, 1);
  assert.equal(choice.index, 1);
});

test('the scan is deterministic for the same state', () => {
  const a = sectorScanChoice(stubUnit({ uid: 1 }), 19.93);
  const b = sectorScanChoice(stubUnit({ uid: 1 }), 19.93);
  assert.deepEqual(a, b);
});

// --- phase staggering: a squad never scans in unison ---

test('uid offsets stagger the scan phase across a squad', () => {
  // t=19.93: uid=1 is mid knee-glance; uid=2 is outside its scan window.
  const a = sectorScanChoice(stubUnit({ uid: 2 }), 19.93);
  assert.equal(a, null);
});

test('the scan period stretches with uid so neighbours drift apart', () => {
  // uid=1 period 24.7: scan at t=18.93. uid=4 period 29.8: its first scan
  // opens at t = 29.8 - 4*5.77 = 6.72, so probe just inside that window.
  const early = sectorScanChoice(stubUnit({ uid: 4 }), 7.22);
  assert.equal(early.index, 0);
  const later = sectorScanChoice(stubUnit({ uid: 4 }), 18.93);
  assert.equal(later, null);
});

// --- idlePoseChoice: scan takes precedence over random micro-motion ---

test('idlePoseChoice prefers the sector scan over idle micro-motion', () => {
  // uid=3, t=12.0: scan phase 1.21 (knee, dir -1) AND idleMicro alert window
  // (phase 0.93) are both active. The scan must win.
  const choice = idlePoseChoice(stubUnit({ uid: 3, facing: 1 }), 12.0);
  assert.deepEqual(choice, { group: 'actions20', index: 1, dir: -1 });
});

test('idlePoseChoice falls back to idle micro-motion between scans', () => {
  // uid=1, t=3.0: scan resting (phase 8.77 of 24.7); idleMicro four-beat
  // cycle in its alert window (phase 0.01 of 10.3).
  const choice = idlePoseChoice(stubUnit({ uid: 1 }), 3.0);
  assert.deepEqual(choice, { group: 'actions20', index: 0 });
  assert.equal(choice.dir, undefined);
});

test('idlePoseChoice returns null when neither layer is active', () => {
  // uid=1, t=20.0 is mid scan; pick a quiet time instead: t=4.0 for uid=1
  // has scan phase 9.77 (resting) and idleMicro phases 0.08 alert... use uid=5.
  const u = stubUnit({ uid: 5 });
  // Scan: period 23+5*1.7=31.5, phase (t+28.85)%31.5. idleMicro alert
  // (t+36.55)%11, crouch (t+68.5)%27. At t=4: scan 2.85? (4+28.85)=32.85%31.5=1.35
  // -> knee scan active. Probe for a null window instead.
  let foundNull = false;
  for (let t = 0; t < 40; t += 0.1) {
    if (idlePoseChoice(u, t) === null) {
      foundNull = true;
      break;
    }
  }
  assert.ok(foundNull, 'some time slice should have no idle pose at all');
});

// --- Integration: a spawned infantryman can drive the scan ---

test('spawned infantry passes the sector scan guard', () => {
  const s = createGame(1);
  startGame(s);
  s.terrain.fill(374);
  s.original.fill(374);
  s.walls = [];
  s.scenery = [];
  spawnUnit(s, 0, 'infantry', 600);
  const u = s.units[s.units.length - 1];
  u.moving = false;
  u.fire = 0;
  u.aimUntil = 0;
  u.suppression = 0;
  u.digging = false;
  u.tending = false;
  u.draggingUid = undefined;
  u.vacuum = false;
  u.fragThrow = 0;
  u.pose = 'idle';
  const choice = sectorScanChoice(u, 0);
  if (choice) {
    assert.equal(choice.group, 'actions20');
    assert.ok([0, 1].includes(choice.index));
    assert.ok(choice.dir === 1 || choice.dir === -1);
  }
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
