import assert from 'node:assert/strict';
import {
  blastGlanceChoice,
  dugInBlastGlanceChoice,
  idlePoseChoice,
  idleMicroChoice,
  sectorScanChoice,
} from '../game/adult-animation.ts';
import { createGame, startGame, spawnUnit, explode } from '../game/engine.ts';

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}

// Minimal unit stub with every field the glance functions read.
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
    pose: 'crouch',
    facing: 1,
    wounded: false,
    surrendered: false,
    blastGlanceUntil: 0,
    blastGlanceDir: 1,
    ...overrides,
  };
}

// --- dugInBlastGlanceChoice: null when there is no glance or the soldier is busy ---

test('dugInBlastGlanceChoice is null without an active glance', () => {
  assert.equal(dugInBlastGlanceChoice(stubUnit(), 0), null);
});

test('dugInBlastGlanceChoice is null after the glance window expires', () => {
  assert.equal(
    dugInBlastGlanceChoice(stubUnit({ blastGlanceUntil: 5 }), 6),
    null,
  );
});

test('dugInBlastGlanceChoice is null while moving', () => {
  assert.equal(
    dugInBlastGlanceChoice(
      stubUnit({ moving: true, blastGlanceUntil: 5 }),
      0,
    ),
    null,
  );
});

test('dugInBlastGlanceChoice is null while firing', () => {
  assert.equal(
    dugInBlastGlanceChoice(
      stubUnit({ fire: 0.5, blastGlanceUntil: 5 }),
      0,
    ),
    null,
  );
});

test('dugInBlastGlanceChoice is null while aiming', () => {
  assert.equal(
    dugInBlastGlanceChoice(
      stubUnit({ aimUntil: 5, blastGlanceUntil: 5 }),
      0,
    ),
    null,
  );
});

test('dugInBlastGlanceChoice is null when suppressed', () => {
  assert.equal(
    dugInBlastGlanceChoice(
      stubUnit({ suppression: 0.5, blastGlanceUntil: 5 }),
      0,
    ),
    null,
  );
});

test('dugInBlastGlanceChoice is null while digging', () => {
  assert.equal(
    dugInBlastGlanceChoice(
      stubUnit({ digging: true, blastGlanceUntil: 5 }),
      0,
    ),
    null,
  );
});

test('dugInBlastGlanceChoice is null while tending a casualty', () => {
  assert.equal(
    dugInBlastGlanceChoice(
      stubUnit({ tending: true, blastGlanceUntil: 5 }),
      0,
    ),
    null,
  );
});

test('dugInBlastGlanceChoice is null while dragging a casualty', () => {
  assert.equal(
    dugInBlastGlanceChoice(
      stubUnit({ draggingUid: 7, blastGlanceUntil: 5 }),
      0,
    ),
    null,
  );
});

test('dugInBlastGlanceChoice is null in a command vacuum', () => {
  assert.equal(
    dugInBlastGlanceChoice(
      stubUnit({ vacuum: true, blastGlanceUntil: 5 }),
      0,
    ),
    null,
  );
});

test('dugInBlastGlanceChoice is null mid frag throw', () => {
  assert.equal(
    dugInBlastGlanceChoice(
      stubUnit({ fragThrow: 0.3, blastGlanceUntil: 5 }),
      0,
    ),
    null,
  );
});

test('dugInBlastGlanceChoice is null when wounded', () => {
  assert.equal(
    dugInBlastGlanceChoice(
      stubUnit({ wounded: true, blastGlanceUntil: 5 }),
      0,
    ),
    null,
  );
});

test('dugInBlastGlanceChoice is null when surrendered', () => {
  assert.equal(
    dugInBlastGlanceChoice(
      stubUnit({ surrendered: true, blastGlanceUntil: 5 }),
      0,
    ),
    null,
  );
});

test('dugInBlastGlanceChoice is null when dead', () => {
  assert.equal(
    dugInBlastGlanceChoice(
      stubUnit({ hp: 0, blastGlanceUntil: 5 }),
      0,
    ),
    null,
  );
});

// --- dugInBlastGlanceChoice: only crouch and prone poses ---

test('dugInBlastGlanceChoice is null in idle, hunker and walk poses', () => {
  for (const pose of ['idle', 'hunker', 'walk']) {
    assert.equal(
      dugInBlastGlanceChoice(
        stubUnit({ pose, blastGlanceUntil: 5 }),
        0,
      ),
      null,
    );
  }
});

test('a crouching defender stays on one knee and turns toward the blast', () => {
  const choice = dugInBlastGlanceChoice(
    stubUnit({ pose: 'crouch', blastGlanceUntil: 5, blastGlanceDir: -1 }),
    0,
  );
  assert.deepEqual(choice, { group: 'actions20', index: 1, dir: -1 });
});

test('a prone defender stays on the deck and turns toward the blast', () => {
  const choice = dugInBlastGlanceChoice(
    stubUnit({ pose: 'prone', blastGlanceUntil: 5, blastGlanceDir: -1 }),
    0,
  );
  assert.deepEqual(choice, { group: 'actions20', index: 2, dir: -1 });
});

test('dugInBlastGlanceChoice defaults to facing right when no dir is stored', () => {
  const choice = dugInBlastGlanceChoice(
    stubUnit({ pose: 'crouch', blastGlanceUntil: 5, blastGlanceDir: undefined }),
    0,
  );
  assert.equal(choice.dir, 1);
});

test('the dug-in glance dir is independent of the real facing', () => {
  const u = stubUnit({
    pose: 'prone',
    facing: -1,
    blastGlanceUntil: 5,
    blastGlanceDir: 1,
  });
  const choice = dugInBlastGlanceChoice(u, 0);
  assert.equal(choice.dir, 1, 'the glance dir points toward the blast');
  assert.equal(u.facing, -1, 'the real facing is untouched');
});

test('the dug-in glance is deterministic for the same state', () => {
  const a = dugInBlastGlanceChoice(
    stubUnit({ pose: 'crouch', blastGlanceUntil: 5 }),
    0,
  );
  const b = dugInBlastGlanceChoice(
    stubUnit({ pose: 'crouch', blastGlanceUntil: 5 }),
    0,
  );
  assert.deepEqual(a, b);
});

// --- idlePoseChoice: the standing glance and dug-in glance never overlap ---

test('idlePoseChoice uses the standing glance for an idle soldier', () => {
  const u = stubUnit({
    pose: 'idle',
    blastGlanceUntil: 25,
    blastGlanceDir: 1,
  });
  const choice = idlePoseChoice(u, 0);
  assert.deepEqual(choice, { group: 'actions20', index: 0, dir: 1 });
});

test('idlePoseChoice uses the dug-in glance for a crouching soldier', () => {
  const u = stubUnit({
    pose: 'crouch',
    blastGlanceUntil: 25,
    blastGlanceDir: -1,
  });
  const choice = idlePoseChoice(u, 0);
  assert.deepEqual(choice, { group: 'actions20', index: 1, dir: -1 });
});

test('idlePoseChoice uses the dug-in glance for a prone soldier', () => {
  const u = stubUnit({
    pose: 'prone',
    blastGlanceUntil: 25,
    blastGlanceDir: 1,
  });
  const choice = idlePoseChoice(u, 0);
  assert.deepEqual(choice, { group: 'actions20', index: 2, dir: 1 });
});

test('idlePoseChoice falls through to null for a crouching soldier after the glance expires', () => {
  // uid=1, t=19.93: the sector scan is idle-only, and the idle micro-motion
  // phase (alert 5.24/11, crouch 6.63/27) is dormant — every layer returns null.
  const u = stubUnit({
    uid: 1,
    pose: 'crouch',
    facing: 1,
    blastGlanceUntil: 18,
    blastGlanceDir: 1,
  });
  assert.equal(sectorScanChoice(u, 19.93), null, 'the sector scan is idle-only');
  const choice = idlePoseChoice(u, 19.93);
  assert.equal(choice, null, 'no pose layer fires after the glance expires');
});

test('the dug-in glance outranks the idle micro-motion', () => {
  // uid=1, t=3.69: idleMicroChoice would return the alert stance (action 0),
  // but the active dug-in glance must win with the knee pose toward the blast.
  const u = stubUnit({
    uid: 1,
    pose: 'crouch',
    facing: 1,
    blastGlanceUntil: 5,
    blastGlanceDir: -1,
  });
  const micro = idleMicroChoice(u, 3.69);
  assert.ok(micro && micro.index === 0, 'the idle micro-motion would fire');
  const choice = idlePoseChoice(u, 3.69);
  assert.deepEqual(choice, { group: 'actions20', index: 1, dir: -1 });
});

// --- Integration helpers ---

function arena() {
  const s = createGame(32001);
  startGame(s);
  // Flat terrain so blast distance is purely horizontal.
  s.terrain.fill(374);
  s.original.fill(374);
  s.walls = [];
  s.scenery = [];
  return s;
}

function loneInfantry(s, side, x) {
  spawnUnit(s, side, 'infantry', x, { member: 0 });
  const mine = s.units.filter(
    (u) => u.side === side && Math.abs(u.x - x) < 4,
  );
  return mine[mine.length - 1];
}

// radius=30: inner=42, glanceInner=88.2, awareness=280.
// Glance band: (88.2, 280]. Flinch band: (42, 88.2]. Kill radius: 42.

test('a distant blast makes a crouching defender glance from the knee', () => {
  const s = arena();
  const u = loneInfantry(s, 1, 600);
  u.pose = 'crouch';
  // 150px away is inside the glance band, outside the flinch band.
  explode(s, 750, 354, 30, 80, 0);
  assert.ok(
    u.blastGlanceUntil !== undefined && u.blastGlanceUntil > s.time,
    'the glance window opens',
  );
  const choice = dugInBlastGlanceChoice(u, s.time);
  assert.ok(choice, 'the crouching defender glances');
  assert.equal(choice.index, 1, 'the defender stays on one knee');
  assert.equal(choice.dir, 1, 'the defender looks right toward the blast');
});

test('a distant blast makes a prone defender glance from the deck', () => {
  const s = arena();
  const u = loneInfantry(s, 1, 600);
  u.pose = 'prone';
  explode(s, 750, 354, 30, 80, 0);
  assert.ok(
    u.blastGlanceUntil !== undefined && u.blastGlanceUntil > s.time,
    'the glance window opens',
  );
  const choice = dugInBlastGlanceChoice(u, s.time);
  assert.ok(choice, 'the prone defender glances');
  assert.equal(choice.index, 2, 'the defender stays on the deck');
  assert.equal(choice.dir, 1, 'the defender looks right toward the blast');
});

test('both sides dug in glance at a distant blast — the whole line reacts', () => {
  const s = arena();
  const left = loneInfantry(s, 0, 600);
  left.pose = 'crouch';
  const right = loneInfantry(s, 1, 900);
  right.pose = 'prone';
  // Side 0 fires: its own man is 150px left of the blast, the enemy 150px right.
  explode(s, 750, 354, 30, 80, 0);
  const leftChoice = dugInBlastGlanceChoice(left, s.time);
  const rightChoice = dugInBlastGlanceChoice(right, s.time);
  assert.ok(leftChoice, 'the crouching defender on the firing side glances');
  assert.ok(rightChoice, 'the prone defender on the enemy side glances');
  assert.equal(leftChoice.dir, 1, 'the left defender looks right');
  assert.equal(rightChoice.dir, -1, 'the right defender looks left');
});

test('a dug-in soldier in the flinch band flinches but does not glance', () => {
  const s = arena();
  const u = loneInfantry(s, 1, 600);
  u.pose = 'crouch';
  // 50px away is inside the flinch band (42, 88.2].
  explode(s, 650, 354, 30, 80, 0);
  assert.ok(
    u.flinchUntil !== undefined && u.flinchUntil > s.time,
    'the soldier flinches',
  );
  assert.ok(
    !u.blastGlanceUntil || u.blastGlanceUntil <= s.time,
    'no glance inside the flinch band',
  );
});

test('a dug-in soldier beyond the awareness radius does not glance', () => {
  const s = arena();
  const u = loneInfantry(s, 1, 600);
  u.pose = 'prone';
  // 300px away is outside awareness (280 for radius=30).
  explode(s, 900, 354, 30, 80, 0);
  assert.ok(
    !u.blastGlanceUntil || u.blastGlanceUntil <= s.time,
    'no glance beyond awareness',
  );
});

test('the dug-in glance never touches the real facing', () => {
  const s = arena();
  const u = loneInfantry(s, 1, 600);
  u.pose = 'crouch';
  const facingBefore = u.facing;
  explode(s, 750, 354, 30, 80, 0);
  assert.ok(
    u.blastGlanceUntil !== undefined && u.blastGlanceUntil > s.time,
    'the glance is active',
  );
  assert.equal(u.facing, facingBefore, 'the real facing is untouched');
  const choice = dugInBlastGlanceChoice(u, s.time);
  assert.equal(choice.dir, 1, 'the glance dir points right toward the blast');
  assert.equal(u.facing, -1, 'the real facing still points left');
});

test('vehicles do not glance — only infantry track the blast', () => {
  const s = arena();
  spawnUnit(s, 1, 'pickup', 600);
  const v = s.units.find((u) => u.id === 'pickup');
  explode(s, 750, 354, 30, 80, 0);
  assert.ok(
    !v.blastGlanceUntil || v.blastGlanceUntil <= s.time,
    'the vehicle has no glance window',
  );
});

test('a larger blast scales the awareness radius for dug-in defenders', () => {
  const s = arena();
  // radius=60: inner=72, glanceInner=151.2, awareness=324.
  const u = loneInfantry(s, 1, 600);
  u.pose = 'crouch';
  // 200px away is inside the scaled glance band (151.2, 324].
  explode(s, 800, 354, 60, 80, 0);
  assert.ok(
    u.blastGlanceUntil !== undefined && u.blastGlanceUntil > s.time,
    'the bigger blast draws a glance from farther out',
  );
  const choice = dugInBlastGlanceChoice(u, s.time);
  assert.ok(choice, 'the crouching defender glances at the bigger blast');
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
