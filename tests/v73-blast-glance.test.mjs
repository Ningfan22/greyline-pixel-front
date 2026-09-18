import assert from 'node:assert/strict';
import {
  blastGlanceChoice,
  idlePoseChoice,
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
    pose: 'idle',
    facing: 1,
    wounded: false,
    surrendered: false,
    blastGlanceUntil: 0,
    blastGlanceDir: 1,
    ...overrides,
  };
}

// --- blastGlanceChoice: null when there is no glance or the soldier is busy ---

test('blastGlanceChoice is null without an active glance', () => {
  assert.equal(blastGlanceChoice(stubUnit(), 0), null);
});

test('blastGlanceChoice is null after the glance window expires', () => {
  assert.equal(blastGlanceChoice(stubUnit({ blastGlanceUntil: 5 }), 6), null);
});

test('blastGlanceChoice is null while moving', () => {
  assert.equal(
    blastGlanceChoice(stubUnit({ moving: true, blastGlanceUntil: 5 }), 0),
    null,
  );
});

test('blastGlanceChoice is null while firing', () => {
  assert.equal(
    blastGlanceChoice(stubUnit({ fire: 0.5, blastGlanceUntil: 5 }), 0),
    null,
  );
});

test('blastGlanceChoice is null while aiming', () => {
  assert.equal(
    blastGlanceChoice(stubUnit({ aimUntil: 5, blastGlanceUntil: 5 }), 0),
    null,
  );
});

test('blastGlanceChoice is null when suppressed', () => {
  assert.equal(
    blastGlanceChoice(stubUnit({ suppression: 0.5, blastGlanceUntil: 5 }), 0),
    null,
  );
});

test('blastGlanceChoice is null while digging', () => {
  assert.equal(
    blastGlanceChoice(stubUnit({ digging: true, blastGlanceUntil: 5 }), 0),
    null,
  );
});

test('blastGlanceChoice is null while tending a casualty', () => {
  assert.equal(
    blastGlanceChoice(stubUnit({ tending: true, blastGlanceUntil: 5 }), 0),
    null,
  );
});

test('blastGlanceChoice is null while dragging a casualty', () => {
  assert.equal(
    blastGlanceChoice(stubUnit({ draggingUid: 7, blastGlanceUntil: 5 }), 0),
    null,
  );
});

test('blastGlanceChoice is null in a command vacuum', () => {
  assert.equal(
    blastGlanceChoice(stubUnit({ vacuum: true, blastGlanceUntil: 5 }), 0),
    null,
  );
});

test('blastGlanceChoice is null mid frag throw', () => {
  assert.equal(
    blastGlanceChoice(stubUnit({ fragThrow: 0.3, blastGlanceUntil: 5 }), 0),
    null,
  );
});

test('blastGlanceChoice is null when wounded', () => {
  assert.equal(
    blastGlanceChoice(stubUnit({ wounded: true, blastGlanceUntil: 5 }), 0),
    null,
  );
});

test('blastGlanceChoice is null when surrendered', () => {
  assert.equal(
    blastGlanceChoice(stubUnit({ surrendered: true, blastGlanceUntil: 5 }), 0),
    null,
  );
});

test('blastGlanceChoice is null when dead', () => {
  assert.equal(
    blastGlanceChoice(stubUnit({ hp: 0, blastGlanceUntil: 5 }), 0),
    null,
  );
});

test('blastGlanceChoice is null in crouch, prone and hunker poses', () => {
  for (const pose of ['crouch', 'prone', 'hunker', 'walk']) {
    assert.equal(
      blastGlanceChoice(stubUnit({ pose, blastGlanceUntil: 5 }), 0),
      null,
    );
  }
});

// --- blastGlanceChoice: the alert stance toward the blast ---

test('blastGlanceChoice returns the alert stance facing the blast', () => {
  const choice = blastGlanceChoice(
    stubUnit({ blastGlanceUntil: 5, blastGlanceDir: -1 }),
    0,
  );
  assert.deepEqual(choice, { group: 'actions20', index: 0, dir: -1 });
});

test('blastGlanceChoice defaults to facing right when no dir is stored', () => {
  const choice = blastGlanceChoice(
    stubUnit({ blastGlanceUntil: 5, blastGlanceDir: undefined }),
    0,
  );
  assert.equal(choice.dir, 1);
});

test('the glance dir is independent of the real facing', () => {
  const u = stubUnit({
    facing: -1,
    blastGlanceUntil: 5,
    blastGlanceDir: 1,
  });
  const choice = blastGlanceChoice(u, 0);
  assert.equal(choice.dir, 1, 'the glance dir points toward the blast');
  assert.equal(u.facing, -1, 'the real facing is untouched');
});

test('the glance is deterministic for the same state', () => {
  const a = blastGlanceChoice(stubUnit({ blastGlanceUntil: 5 }), 0);
  const b = blastGlanceChoice(stubUnit({ blastGlanceUntil: 5 }), 0);
  assert.deepEqual(a, b);
});

// --- idlePoseChoice: a fresh blast glance outranks the routine sector scan ---

test('idlePoseChoice prefers the blast glance over the sector scan', () => {
  // uid=1, t=19.93: sector scan beat 2 (knee, dir -1) is active.
  const u = stubUnit({
    uid: 1,
    facing: 1,
    blastGlanceUntil: 25,
    blastGlanceDir: 1,
  });
  // Sanity: the sector scan would have fired without the glance.
  const scan = sectorScanChoice(u, 19.93);
  assert.ok(scan && scan.index === 1, 'the sector scan is active');
  // The blast glance must outrank it.
  const choice = idlePoseChoice(u, 19.93);
  assert.deepEqual(choice, { group: 'actions20', index: 0, dir: 1 });
});

test('idlePoseChoice falls back to the sector scan after the glance expires', () => {
  // uid=1, t=19.93: scan beat 2 active; glance expired at t=18.
  const u = stubUnit({
    uid: 1,
    facing: 1,
    blastGlanceUntil: 18,
    blastGlanceDir: 1,
  });
  const choice = idlePoseChoice(u, 19.93);
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

test('a blast in the glance band makes holding infantry glance', () => {
  const s = arena();
  const u = loneInfantry(s, 1, 600);
  // 150px away is inside the glance band, outside the flinch band.
  explode(s, 750, 354, 30, 80, 0);
  assert.ok(
    u.blastGlanceUntil !== undefined && u.blastGlanceUntil > s.time,
    'the glance window opens',
  );
  assert.equal(u.blastGlanceDir, 1, 'the soldier looks right toward the blast');
});

test('both sides glance at a distant blast — the flash reads across the line', () => {
  const s = arena();
  const left = loneInfantry(s, 0, 600);
  const right = loneInfantry(s, 1, 900);
  // Side 0 fires: its own man is 150px left of the blast, the enemy 150px right.
  explode(s, 750, 354, 30, 80, 0);
  assert.ok(
    left.blastGlanceUntil !== undefined && left.blastGlanceUntil > s.time,
    'the firing side glances too',
  );
  assert.ok(
    right.blastGlanceUntil !== undefined && right.blastGlanceUntil > s.time,
    'the enemy side glances',
  );
  assert.equal(left.blastGlanceDir, 1, 'the left soldier looks right');
  assert.equal(right.blastGlanceDir, -1, 'the right soldier looks left');
});

test('a soldier in the flinch band flinches but does not glance', () => {
  const s = arena();
  const u = loneInfantry(s, 1, 600);
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

test('a blast beyond the awareness radius draws no glance', () => {
  const s = arena();
  const u = loneInfantry(s, 1, 600);
  // 300px away is outside awareness (280 for radius=30).
  explode(s, 900, 354, 30, 80, 0);
  assert.ok(
    !u.blastGlanceUntil || u.blastGlanceUntil <= s.time,
    'no glance beyond awareness',
  );
});

test('a soldier inside the kill radius does not glance', () => {
  const s = arena();
  const u = loneInfantry(s, 1, 600);
  // 40px away is inside the kill radius (42) but the soldier survives.
  explode(s, 640, 354, 30, 80, 0);
  assert.ok(u.hp < u.maxHp, 'the soldier takes damage');
  assert.ok(u.hp > 0, 'the soldier survives the near hit');
  assert.ok(
    !u.blastGlanceUntil || u.blastGlanceUntil <= s.time,
    'no glance inside the kill radius',
  );
});

test('the glance never touches the real facing', () => {
  const s = arena();
  const u = loneInfantry(s, 1, 600);
  const facingBefore = u.facing;
  explode(s, 750, 354, 30, 80, 0);
  assert.ok(
    u.blastGlanceUntil !== undefined && u.blastGlanceUntil > s.time,
    'the glance is active',
  );
  assert.equal(u.facing, facingBefore, 'the real facing is untouched');
  const choice = blastGlanceChoice(u, s.time);
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

test('a larger blast scales the awareness radius', () => {
  const s = arena();
  // radius=60: inner=72, glanceInner=151.2, awareness=324.
  const u = loneInfantry(s, 1, 600);
  // 200px away is inside the scaled glance band (151.2, 324].
  explode(s, 800, 354, 60, 80, 0);
  assert.ok(
    u.blastGlanceUntil !== undefined && u.blastGlanceUntil > s.time,
    'the bigger blast draws a glance from farther out',
  );
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
