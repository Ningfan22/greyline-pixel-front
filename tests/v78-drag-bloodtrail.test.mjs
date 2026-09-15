import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  ground,
  pointVisible,
} from '../game/engine.ts';
import { drawDragMarks } from '../game/ambience.ts';

const DT = 1 / 60;
const results = [];
function test(name, fn) {
  try {
    const value = fn();
    results.push({ name, ok: true, ...value });
    console.log('PASS', name);
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
    console.error('FAIL', name, error.message);
  }
}

// Flat open arena, AI director disabled (mirrors v41/v71 harnesses).
function arena(seed = 78001) {
  const s = createGame(seed);
  startGame(s);
  Object.assign(s, {
    units: [],
    scenery: [],
    walls: [],
    wrecks: [],
    aiIn: 1e9,
  });
  s.terrain.fill(374);
  s.original.fill(374);
  s.players.forEach((p) => (p.order = 'hold'));
  return s;
}

function run(s, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) tick(s, DT);
}

function runUntil(s, predicate, timeout) {
  const steps = Math.round(timeout / DT);
  for (let i = 0; i < steps; i++) {
    tick(s, DT);
    if (predicate()) return s.time;
  }
  return null;
}

/** Spawn a 6-man rifle squad on side 0 and return its members. */
function squad(s, x) {
  spawnUnit(s, 0, 'infantry', x);
  return s.units.filter((u) => u.side === 0);
}

/** The rightmost (forward) member becomes a bleeding casualty. */
function casualty(s, x = 500, bleedOut = 12) {
  const members = squad(s, x);
  const v = members.reduce((a, b) => (b.x > a.x ? b : a));
  v.wounded = true;
  v.woundedFromPose = v.pose;
  v.woundedTime = 3;
  v.bleedOut = bleedOut;
  v.hp = Math.floor(v.maxHp * 0.3);
  v.rescueProgress = 0;
  v.y = 374;
  return v;
}

/** Canvas stub that records every draw call so we can assert gating. */
function recordingCtx() {
  const calls = [];
  const ctx = new Proxy(
    {},
    {
      get(_t, prop) {
        if (prop === 'calls') return calls;
        return (...args) => calls.push({ op: String(prop), args });
      },
      set() {
        return true;
      },
    },
  );
  return ctx;
}

const ellipseCount = (ctx) => ctx.calls.filter((c) => c.op === 'ellipse').length;

// --- A. Emission ---------------------------------------------------------

test('拖拽伤员时在地面留下血痕', () => {
  const s = arena();
  const v = casualty(s);
  const t = runUntil(s, () => s.dragMarks.length > 0, 6);
  assert.ok(t !== null, 'a blood smear appears within 6s of the drag');
  assert.ok(s.dragMarks.length >= 1, 'at least one smear recorded');
  assert.ok(
    s.dragMarks.every((m) => m.side === 0),
    'smears are tagged with the casualty side',
  );
  return { marks: s.dragMarks.length, firstAt: +t.toFixed(2) };
});

test('血痕位于地面线', () => {
  const s = arena();
  casualty(s);
  runUntil(s, () => s.dragMarks.length > 0, 6);
  const m = s.dragMarks[0];
  assert.equal(m.y, ground(s, m.x), 'smear sits exactly on the ground line');
  assert.equal(m.y, 374, 'flat arena ground is 374');
  return { x: +m.x.toFixed(1), y: m.y };
});

test('血痕间距约 14px，沿拖拽路径分布', () => {
  const s = arena();
  const v = casualty(s, 900);
  run(s, 8);
  assert.ok(s.dragMarks.length >= 3, 'several smears laid over 8s of hauling');
  const xs = s.dragMarks.map((m) => m.x).sort((a, b) => b - a);
  for (let i = 1; i < xs.length; i++) {
    const gap = xs[i - 1] - xs[i];
    assert.ok(
      gap >= 12 && gap <= 17,
      `smear spacing ~14px, got ${gap.toFixed(1)}`,
    );
  }
  assert.ok(v.x < 900 - 40, 'the drag moved well left of the start');
  return { marks: s.dragMarks.length };
});

// --- B. Lifecycle --------------------------------------------------------

test('血痕数量有上限（70 条）', () => {
  const s = arena();
  // Long drag: casualty far from the baseline. The buddy-drag AI only
  // hauls casualties with 0 < bleedOut < 25, and bleedOut counts down in
  // real time, so keep topping it up — once the haul has started it only
  // needs bleedOut > 0 to continue. 70 smears * 14px = 980px of dragging,
  // well within the 1700 -> 116 trip to the baseline.
  const v = casualty(s, 1700, 20);
  for (let i = 0; i < Math.round(100 / DT); i++) {
    tick(s, DT);
    if (i % 60 === 0) v.bleedOut = Math.max(v.bleedOut, 12);
  }
  assert.ok(s.dragMarks.length > 0, 'smears were laid');
  assert.equal(s.dragMarks.length, 70, 'cap of 70 reached');
  return { marks: s.dragMarks.length };
});

test('血痕在 35 秒寿命后不再渲染', () => {
  const s = arena();
  const v = casualty(s);
  runUntil(s, () => s.dragMarks.length > 0, 6);
  const born = s.dragMarks[0].born;
  // Park the dragger and let the casualty die so the buddy AI cannot
  // restart the haul and lay fresh smears that disturb the age measurement.
  for (const u of s.units) u.draggingUid = undefined;
  for (const u of s.units) if (u.wounded) u.draggedByUid = undefined;
  v.bleedOut = 0;
  run(s, 36);
  const age = s.time - born;
  assert.ok(age >= 35, 'first smear exceeded its 35s lifetime');
  const ctx = recordingCtx();
  drawDragMarks(ctx, s, 0, 4000);
  assert.equal(ellipseCount(ctx), 0, 'expired smears are skipped by the renderer');
  return { age: +age.toFixed(2) };
});

// --- C. Fog of war gating ------------------------------------------------

test('敌方血痕在视野外不渲染', () => {
  const s = arena();
  // An enemy smear deep in their backfield, no player observer anywhere.
  s.dragMarks.push({ x: 3200, y: 374, side: 1, seed: 7, born: s.time });
  assert.equal(
    pointVisible(s, 0, 3200, 374),
    false,
    'precondition: the ground is not visible to the player',
  );
  const ctx = recordingCtx();
  drawDragMarks(ctx, s, 0, 4000);
  assert.equal(ellipseCount(ctx), 0, 'enemy smear stays hidden in fog');
  return {};
});

test('敌方血痕在视野内渲染', () => {
  const s = arena();
  // Player observer close enough to see the ground where the enemy dragged.
  spawnUnit(s, 0, 'infantry', 3050);
  s.dragMarks.push({ x: 3120, y: 374, side: 1, seed: 9, born: s.time });
  assert.ok(
    pointVisible(s, 0, 3120, 374),
    'precondition: the player can see the smear site',
  );
  const ctx = recordingCtx();
  drawDragMarks(ctx, s, 0, 4000);
  assert.ok(ellipseCount(ctx) > 0, 'witnessed enemy smear is drawn');
  return {};
});

test('己方血痕始终渲染（无需视野）', () => {
  const s = arena();
  // Own-side smear far from every friendly unit.
  s.dragMarks.push({ x: 3200, y: 374, side: 0, seed: 11, born: s.time });
  assert.equal(
    pointVisible(s, 0, 3200, 374),
    false,
    'precondition: no friendly eyes on the site',
  );
  const ctx = recordingCtx();
  drawDragMarks(ctx, s, 0, 4000);
  assert.ok(ellipseCount(ctx) > 0, 'own casualty trail is always known');
  return {};
});

// --- Report --------------------------------------------------------------

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  for (const f of failed) console.error('FAILED:', f.name, '-', f.error);
  process.exit(1);
}
