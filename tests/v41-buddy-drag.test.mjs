import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  W,
} from '../game/engine.ts';

const DT = 1 / 60;
const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log('PASS', name);
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
    console.error('FAIL', name, error.message);
  }
}

function arena(seed = 41001) {
  const s = createGame(seed);
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

function run(s, seconds) {
  for (let i = 0; i < Math.round(seconds * 60); i++) tick(s, DT);
}

/** Spawn a 6-man rifle squad on side 0 and return its members. */
function squad(s, x) {
  spawnUnit(s, 0, 'infantry', x);
  return s.units.filter((u) => u.side === 0);
}

/** The rightmost (forward) member becomes a bleeding casualty far from base. */
function casualty(s, x = 500) {
  const members = squad(s, x);
  const v = members.reduce((a, b) => (b.x > a.x ? b : a));
  v.wounded = true;
  v.woundedFromPose = v.pose;
  v.woundedTime = 3; // past the shock window
  v.bleedOut = 12;
  v.hp = Math.floor(v.maxHp * 0.3);
  v.rescueProgress = 0;
  v.y = 374;
  return v;
}

const draggerOf = (s, v) => s.units.find((u) => u.draggingUid === v.uid);

// --- buddy drag ----------------------------------------------------------------

test('a squadmate grabs a bleeding comrade and hauls him toward the baseline', () => {
  const s = arena();
  const v = casualty(s);
  const x0 = v.x;
  run(s, 4);
  const d = draggerOf(s, v);
  assert.ok(d, 'a buddy should have linked up to drag the casualty');
  assert.equal(v.draggedByUid, d.uid, 'the casualty points back at his dragger');
  // Drag speed is 16 px/s vs 9 px/s self-crawl; in 4s the haul covers well
  // over 40px once the short approach is done.
  assert.ok(
    v.x < x0 - 40,
    `the casualty should have been hauled well left, x=${v.x.toFixed(1)} vs ${x0}`,
  );
});

test('a demoralised squad (morale < 40) refuses to drag anyone', () => {
  const s = arena();
  const v = casualty(s);
  for (const u of s.units) u.personalMorale = 20;
  run(s, 2);
  assert.equal(v.draggedByUid, undefined, 'no buddy should link up');
  assert.equal(draggerOf(s, v), undefined, 'no dragger exists');
});

test('a dragger hit below 30% hp releases the casualty, who resumes crawling', () => {
  const s = arena();
  const v = casualty(s);
  run(s, 1); // let a buddy link up and start hauling
  const d = draggerOf(s, v);
  assert.ok(d, 'precondition: a dragger linked up');
  const xBefore = v.x;
  // Nobody else may pick up the casualty once this dragger lets go.
  for (const u of s.units) if (u !== d) u.personalMorale = 20;
  d.hp = Math.floor(d.maxHp * 0.2);
  run(s, 1);
  assert.equal(d.draggingUid, undefined, 'the wounded dragger releases the bond');
  assert.equal(v.draggedByUid, undefined, 'the casualty bond is cleared too');
  // The casualty keeps crawling left on his own (bleedOut still > 8 here).
  assert.ok(v.x < xBefore, `the casualty resumes self-crawl, x=${v.x.toFixed(1)}`);
});

test('a casualty is dragged by exactly one squadmate at a time', () => {
  const s = arena();
  const v = casualty(s);
  run(s, 1);
  const draggers = s.units.filter((u) => u.draggingUid === v.uid);
  assert.equal(draggers.length, 1, 'only one buddy holds the drag link');
  assert.equal(v.draggedByUid, draggers[0].uid, 'link is mutual');
});

test('a casualty freshly tended by a medic is not grabbed', () => {
  const s = arena();
  const v = casualty(s);
  v.rescuedAt = s.time; // medic just tended him
  run(s, 1.5);
  assert.equal(v.draggedByUid, undefined, 'buddies leave the medic patient alone');
  assert.equal(draggerOf(s, v), undefined, 'no dragger links up');
});

// --- summary -------------------------------------------------------------------

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  for (const f of failed) console.error('FAILED:', f.name, '-', f.error);
  process.exit(1);
}
