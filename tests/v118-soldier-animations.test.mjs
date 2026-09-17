import assert from 'node:assert/strict';
import {
  adultFrameChoice,
  idleMicroChoice,
  crouchFidgetChoice,
  proneFidgetChoice,
  leaderPointChoice,
} from '../game/adult-animation.ts';

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
    secondaryFire: 0,
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

// --- v118: a stationary burst keeps the aimed stance (the patrol layer
// overlays its dedicated aimed-rifle pose for the whole burst) ---

test('standing fire: fresh shot (fire=0.25) keeps the aimed stance action(0)', () => {
  const c = adultFrameChoice(stubUnit({ fire: 0.25 }), 0);
  assert.deepEqual(c, { group: 'actions20', index: 0 });
});

test('standing fire: decaying shot (fire=0.1) keeps the aimed stance action(0)', () => {
  const c = adultFrameChoice(stubUnit({ fire: 0.1 }), 0);
  assert.deepEqual(c, { group: 'actions20', index: 0 });
});

test('standing fire: a moving rifleman keeps the full walk cycle', () => {
  const c = adultFrameChoice(stubUnit({ fire: 0.25, moving: true, walk: 3 }), 0);
  assert.deepEqual(c, { group: 'walk8', index: 3 });
});

// --- v118: crouch / prone idle fidgets only return low frames ---

test('crouch fidget: weight-shift beat returns the low crouch frame (17)', () => {
  // uid 1: period 10.9, phase (5 + 6.13) % 10.9 = 0.23 < 1.4
  const c = crouchFidgetChoice(stubUnit({ uid: 1, pose: 'crouch' }), 5);
  assert.ok(c);
  assert.equal(c.group, 'actions20');
  assert.equal(c.index, 17);
});

test('crouch fidget: scan beat returns the lean-forward frame (13)', () => {
  // uid 1: phase (7 + 6.13) % 10.9 = 2.23, in [1.4, 2.4)
  const c = crouchFidgetChoice(stubUnit({ uid: 1, pose: 'crouch' }), 7);
  assert.ok(c);
  assert.equal(c.index, 13);
});

test('crouch fidget: idle phase returns null', () => {
  // uid 1: phase (0 + 6.13) % 10.9 = 6.13, outside both beats
  assert.equal(crouchFidgetChoice(stubUnit({ uid: 1, pose: 'crouch' }), 0), null);
});

test('crouch fidget: never returns the standing alert frame (0)', () => {
  const u = stubUnit({ uid: 2, pose: 'crouch' });
  for (let t = 0; t < 30; t += 0.1) {
    const c = crouchFidgetChoice(u, t);
    if (c) assert.notEqual(c.index, 0);
  }
});

test('crouch fidget: gated out while firing or moving', () => {
  assert.equal(crouchFidgetChoice(stubUnit({ pose: 'crouch', fire: 0.2 }), 5), null);
  assert.equal(crouchFidgetChoice(stubUnit({ pose: 'crouch', moving: true }), 5), null);
});

test('prone fidget: work beat returns the prone-working frame (3)', () => {
  // uid 1: period 12.1, phase (7 + 5.47) % 12.1 = 0.37 < 1.5
  const c = proneFidgetChoice(stubUnit({ uid: 1, pose: 'prone' }), 7);
  assert.ok(c);
  assert.equal(c.group, 'actions20');
  assert.equal(c.index, 3);
});

test('prone fidget: shift beat returns the crawl-posture frame (12)', () => {
  // uid 1: phase (9 + 5.47) % 12.1 = 2.37, in [1.5, 2.6)
  const c = proneFidgetChoice(stubUnit({ uid: 1, pose: 'prone' }), 9);
  assert.ok(c);
  assert.equal(c.index, 12);
});

test('prone fidget: never returns the standing alert frame (0)', () => {
  const u = stubUnit({ uid: 2, pose: 'prone' });
  for (let t = 0; t < 30; t += 0.1) {
    const c = proneFidgetChoice(u, t);
    if (c) assert.notEqual(c.index, 0);
  }
});

// --- v118: hit flinch widened to four variants ---

test('hit flinch: uid % 4 === 3 returns the deep curl (reaction 7)', () => {
  const c = adultFrameChoice(stubUnit({ uid: 3, flash: 0.2 }), 0);
  assert.equal(c.group, 'reactions8');
  assert.equal(c.index, 7);
});

test('hit flinch: uid % 4 === 0 still returns the tall stagger (reaction 4)', () => {
  const c = adultFrameChoice(stubUnit({ uid: 4, flash: 0.2 }), 0);
  assert.equal(c.group, 'reactions8');
  assert.equal(c.index, 4);
});

// --- v118: leader point-out ---

test('leader point: returns the pointing frame (action 9) with the stamped dir', () => {
  const c = leaderPointChoice(stubUnit({ pointUntil: 10, pointDir: 1 }), 5);
  assert.ok(c);
  assert.equal(c.group, 'actions20');
  assert.equal(c.index, 9);
  assert.equal(c.dir, 1);
});

test('leader point: dir flips with the stamped threat direction', () => {
  const c = leaderPointChoice(stubUnit({ pointUntil: 10, pointDir: -1 }), 5);
  assert.equal(c.dir, -1);
});

test('leader point: expired stamp returns null', () => {
  assert.equal(leaderPointChoice(stubUnit({ pointUntil: 2, pointDir: 1 }), 5), null);
});

test('leader point: a leader already firing keeps the weapon on target (null)', () => {
  assert.equal(
    leaderPointChoice(stubUnit({ pointUntil: 10, fire: 0.2 }), 5),
    null,
  );
});

// --- v118: pop-up bug fix — idleMicroChoice is standing-only ---

test('idleMicroChoice: crouch pose returns null (no more pop-up to standing)', () => {
  assert.equal(idleMicroChoice(stubUnit({ pose: 'crouch' }), 0), null);
});

test('idleMicroChoice: prone pose returns null', () => {
  assert.equal(idleMicroChoice(stubUnit({ pose: 'prone' }), 0), null);
});

test('idleMicroChoice: standing pose still fidgets (regression check)', () => {
  // uid 1: phase (4 + 7.31) % 10.3 = 1.01 < 1.4 -> alert stance
  const c = idleMicroChoice(stubUnit({ uid: 1, pose: 'idle' }), 4);
  assert.ok(c);
  assert.equal(c.group, 'actions20');
  assert.equal(c.index, 0);
});

// --- report ---

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : `\n      ${r.error}`}`);
}
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) process.exit(1);
