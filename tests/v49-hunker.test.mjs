import assert from 'node:assert/strict';
import { createGame, startGame, tick, spawnUnit } from '../game/engine.ts';
import { adultFrameChoice, adultWreckChoice } from '../game/adult-animation.ts';
import { infantryGeometry } from '../game/infantry-geometry.ts';

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

function battle(seed = 49001) {
  const s = createGame(seed);
  startGame(s);
  Object.assign(s, { scenery: [], walls: [], wrecks: [] });
  s.players.forEach((p) => (p.order = 'hold'));
  return s;
}

function spawnOne(s, side, id, x) {
  const before = s.units.length;
  spawnUnit(s, side, id, x);
  const u = s.units.slice(before).find((v) => v.id === id);
  u.x = x;
  return u;
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

// A tank wreck between two infantry gives debrisCover ~0.90 to anyone
// sheltering behind it.
function tankWreck(s, x = 1050) {
  s.wrecks.push({
    id: 99001,
    cardId: 'tank',
    side: 1,
    x,
    y: 374,
    angle: 0,
    age: 5,
    falling: false,
    vx: 0,
    vy: 0,
  });
}

// Lock the unit into the cover tactic so decideTactic and the peek-expose
// scheduler don't override the pose we are testing.
function pinToCover(s, u) {
  u.cooldown = 999;
  u.tactic = 'cover';
  u.decisionIn = 999;
  u.coverGoal = null;
  u.firingGoal = null;
  u.dispersionGoal = undefined;
  u.firingSearchAt = s.time + 10;
}

// --- bailout path ------------------------------------------------------------

test('bailout: bailing crew with suppression 60 hunkers', () => {
  const s = battle(49010);
  const u = spawnOne(s, 0, 'infantry', 500);
  u.bailoutUntil = s.time + 5;
  u.suppression = 60;
  for (let i = 0; i < 5; i++) tick(s, DT);
  assert.equal(u.pose, 'hunker');
});

test('bailout: bailing crew floored at suppression 55 stays crouched', () => {
  const s = battle(49011);
  const u = spawnOne(s, 0, 'infantry', 500);
  u.bailoutUntil = s.time + 5;
  u.suppression = 50; // clamped up to 55 by the bailout branch
  for (let i = 0; i < 5; i++) tick(s, DT);
  assert.equal(u.pose, 'crouch');
});

// --- cover block path --------------------------------------------------------

test('cover: pinned infantry behind a wreck hunkers when suppression > 55', () => {
  const s = battle(49012);
  tankWreck(s);
  const a = spawnOne(s, 0, 'infantry', 1000);
  spawnOne(s, 1, 'infantry', 1110);
  pinToCover(s, a);
  a.suppression = 60;
  for (let i = 0; i < 5; i++) tick(s, DT);
  assert.equal(a.pose, 'hunker');
});

test('cover: same cover with low suppression stays crouched (control)', () => {
  const s = battle(49013);
  tankWreck(s);
  const a = spawnOne(s, 0, 'infantry', 1000);
  spawnOne(s, 1, 'infantry', 1110);
  pinToCover(s, a);
  a.suppression = 30;
  for (let i = 0; i < 5; i++) tick(s, DT);
  assert.equal(a.pose, 'crouch');
});

// --- animation ---------------------------------------------------------------

test('animation: hunker idle holds the kneel reaction frame', () => {
  const f = adultFrameChoice(stubUnit({ pose: 'hunker', uid: 1 }), 0);
  assert.deepEqual(f, { group: 'reactions8', index: 5 });
});

test('animation: hunker peeks over cover during the glance window', () => {
  const f = adultFrameChoice(stubUnit({ pose: 'hunker', uid: 1 }), 1.5);
  assert.deepEqual(f, { group: 'actions20', index: 1 });
});

test('animation: hunker while moving uses the crouch walk cycle', () => {
  const f = adultFrameChoice(
    stubUnit({ pose: 'hunker', moving: true, walk: 3 }),
    0,
  );
  assert.deepEqual(f, { group: 'crouch8', index: 3 });
});

// --- geometry ----------------------------------------------------------------

test('geometry: hunker lowers muzzle to 24 and body to 15', () => {
  assert.deepEqual(infantryGeometry({ pose: 'hunker' }), {
    muzzleX: 30,
    muzzleHeight: 24,
    bodyHeight: 15,
  });
});

// --- wreck choice ------------------------------------------------------------

test('wreck: hunker casualty uses the low-pose death branch', () => {
  assert.deepEqual(adultWreckChoice(0.5, 'hunker'), {
    group: 'actions20',
    index: 15,
  });
  assert.deepEqual(adultWreckChoice(0.2, 'hunker'), {
    group: 'reactions8',
    index: 6,
  });
});

// --- report -------------------------------------------------------------------

let failed = 0;
for (const r of results) {
  if (r.ok) console.log(`ok - ${r.name}`);
  else {
    failed++;
    console.error(`FAIL - ${r.name}: ${r.error}`);
  }
}
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
