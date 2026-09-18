import assert from 'node:assert/strict';
import { adultFrameChoice } from '../game/adult-animation.ts';

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}

// Minimal unit stub with every field adultFrameChoice reads on the hunker path.
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
    tendingTime: 0,
    draggingUid: undefined,
    vacuum: false,
    fragThrow: 0,
    pose: 'hunker',
    facing: 1,
    wounded: false,
    crawling: false,
    woundedFromPose: 'idle',
    woundedTime: 0,
    surrendered: false,
    surrenderTime: 0,
    rappelling: false,
    backpedaling: false,
    walk: 0,
    motion: 'ground',
    motionTime: 0,
    motionDuration: 0,
    motionToX: 0,
    climbing: 0,
    climbDuration: 0,
    climbFrom: 0,
    signalUntil: 0,
    ackUntil: 0,
    reloadingUntil: 0,
    overheatedUntil: 0,
    tactic: 'cover',
    flash: 0,
    ...overrides,
  };
}

const COWER = { group: 'reactions8' };
const isCower = (c) =>
  c.group === 'reactions8' && (c.index === 6 || c.index === 7);

// --- Threshold boundary ---------------------------------------------------

test('suppression 79 keeps the kneeling hunker, not the cower', () => {
  // uid=1, t=3.0: glance phase = (3 + 5.17) % 6.5 = 1.67 -> not glancing,
  // so the soldier holds the knee (reaction 5).
  const c = adultFrameChoice(stubUnit({ suppression: 79 }), 3.0);
  assert.deepEqual(c, { group: 'reactions8', index: 5 });
});

test('suppression 80 drops to the deck — the cower threshold is inclusive', () => {
  const c = adultFrameChoice(stubUnit({ suppression: 80 }), 3.0);
  assert.ok(isCower(c), `expected a cower frame, got ${JSON.stringify(c)}`);
});

test('suppression 100 (max) stays cowering on the deck', () => {
  const c = adultFrameChoice(stubUnit({ suppression: 100 }), 3.0);
  assert.ok(isCower(c), `expected a cower frame, got ${JSON.stringify(c)}`);
});

// --- Cower cadence --------------------------------------------------------

test('the cower alternates between the propped lie (6) and the full curl (7)', () => {
  const u = stubUnit({ suppression: 90 });
  const seen = new Set();
  // Sample across two full 5.2s cycles.
  for (let t = 0; t < 10.4; t += 0.1) {
    seen.add(adultFrameChoice(u, t).index);
  }
  assert.ok(seen.has(6), 'the propped-on-elbow lie appears');
  assert.ok(seen.has(7), 'the full curl appears');
  assert.ok(
    !seen.has(5),
    'the kneeling hunker never appears while heavily suppressed',
  );
});

test('the cower spends most of its time propped, sinking into the curl briefly', () => {
  const u = stubUnit({ uid: 1, suppression: 90 });
  let propped = 0;
  let curled = 0;
  for (let t = 0; t < 5.2; t += 0.05) {
    const idx = adultFrameChoice(u, t).index;
    if (idx === 6) propped++;
    else if (idx === 7) curled++;
  }
  // 3.4s propped vs 1.8s curled per 5.2s cycle.
  assert.ok(propped > curled, 'the propped lie is the dominant cower pose');
  assert.ok(propped > 0 && curled > 0, 'both cower poses are reached');
});

test('the cower never steals a glance — no action(1) peek at extreme suppression', () => {
  const u = stubUnit({ suppression: 95 });
  for (let t = 0; t < 20; t += 0.1) {
    const c = adultFrameChoice(u, t);
    assert.ok(
      !(c.group === 'actions20' && c.index === 1),
      `a heavily suppressed soldier peeked at t=${t}`,
    );
    assert.ok(
      isCower(c),
      `expected only cower frames at t=${t}, got ${JSON.stringify(c)}`,
    );
  }
});

// --- Priority: movement and reload still win ------------------------------

test('a moving soldier crouch-walks even at extreme suppression', () => {
  const c = adultFrameChoice(
    stubUnit({ suppression: 95, moving: true, walk: 2 }),
    3.0,
  );
  assert.equal(c.group, 'crouch8');
});

test('a reloading soldier works the weapon even at extreme suppression', () => {
  const c = adultFrameChoice(
    stubUnit({ suppression: 95, reloadingUntil: 10 }),
    3.0,
  );
  assert.deepEqual(c, { group: 'actions20', index: 13 });
});

// --- Pose gating ----------------------------------------------------------

test('the cower only fires in the hunker pose, not crouch or prone', () => {
  for (const pose of ['crouch', 'prone', 'idle']) {
    const c = adultFrameChoice(stubUnit({ pose, suppression: 95 }), 3.0);
    assert.ok(
      !isCower(c),
      `${pose} pose must not cower, got ${JSON.stringify(c)}`,
    );
  }
});

test('a crouching defender at extreme suppression still holds the knee', () => {
  const c = adultFrameChoice(
    stubUnit({ pose: 'crouch', suppression: 95 }),
    3.0,
  );
  assert.deepEqual(c, { group: 'actions20', index: 1 });
});

// --- Determinism and squad de-sync ----------------------------------------

test('the cower is deterministic for the same state', () => {
  const a = adultFrameChoice(stubUnit({ uid: 3, suppression: 88 }), 7.7);
  const b = adultFrameChoice(stubUnit({ uid: 3, suppression: 88 }), 7.7);
  assert.deepEqual(a, b);
});

test('the cower phase is offset by uid so a pinned squad does not sync', () => {
  // At the same instant, different uids should be in different cower poses.
  const poses = new Set();
  for (let uid = 1; uid <= 8; uid++) {
    poses.add(adultFrameChoice(stubUnit({ uid, suppression: 90 }), 4.0).index);
  }
  assert.ok(
    poses.size >= 2,
    'a squad at the same instant shows a mix of propped and curled soldiers',
  );
});

// --- The previously-unused frames are now reachable -----------------------

test('reaction frames 42 and 43 (cower) are reachable through adultFrameChoice', () => {
  // This is a regression guard: the two cower frames were drawn into the
  // atlas but never referenced by code before v80.
  const reachable = new Set();
  const u = stubUnit({ suppression: 90 });
  for (let t = 0; t < 5.2; t += 0.05) {
    const c = adultFrameChoice(u, t);
    if (c.group === 'reactions8') reachable.add(c.index);
  }
  assert.ok(reachable.has(6), 'frame 42 (propped lie) is reachable');
  assert.ok(reachable.has(7), 'frame 43 (full curl) is reachable');
});

// --- Below-threshold behaviour is unchanged --------------------------------

test('below the cower threshold the hunker glance cycle still works', () => {
  const u = stubUnit({ uid: 1, suppression: 60 });
  // uid=1: glance phase = (t + 5.17) % 6.5. At t=1.0 -> 6.17 (holding knee),
  // at t=1.5 -> 0.33 (glancing).
  assert.deepEqual(adultFrameChoice(u, 1.0), {
    group: 'reactions8',
    index: 5,
  });
  assert.deepEqual(adultFrameChoice(u, 1.5), {
    group: 'actions20',
    index: 1,
  });
});

test('a soldier at suppression 0 in hunker pose still kneels and glances', () => {
  const u = stubUnit({ uid: 1, suppression: 0 });
  assert.deepEqual(adultFrameChoice(u, 1.0), {
    group: 'reactions8',
    index: 5,
  });
});

// --- Report ----------------------------------------------------------------

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
