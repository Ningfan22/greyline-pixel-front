import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
} from '../game/engine.ts';
import {
  traceGlanceChoice,
  dugInTraceGlanceChoice,
  idlePoseChoice,
  blastGlanceChoice,
} from '../game/adult-animation.ts';

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

// Flat open arena, AI director disabled (mirrors v41/v71/v78 harnesses).
function arena(seed = 79001) {
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

// Same arena but the AI director keeps its default ~1.1s think clock.
function arenaAI(seed = 79002) {
  const s = createGame(seed);
  startGame(s);
  Object.assign(s, {
    units: [],
    scenery: [],
    walls: [],
    wrecks: [],
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

/** Fresh friendly drag mark at a given x. */
function mark(s, x, side = 0, born = s.time) {
  s.dragMarks.push({ x, y: 374, side, seed: 1, born });
}

// --- A. Soldier scan ------------------------------------------------------

test('士兵扫视到新鲜血痕并转向痕迹方向', () => {
  const s = arena();
  spawnUnit(s, 0, 'infantry', 500);
  mark(s, 600);
  const t = runUntil(
    s,
    () => s.units.some((u) => (u.traceGlanceUntil ?? 0) > s.time),
    1.5,
  );
  assert.ok(t !== null, 'a soldier glances within 1.5s of the scan');
  const glancing = s.units.filter((u) => (u.traceGlanceUntil ?? 0) > s.time);
  assert.ok(glancing.length >= 1, 'at least one soldier is glancing');
  for (const u of glancing) {
    assert.equal(u.traceGlanceDir, 1, 'every glance faces right toward x=600');
  }
  const intel = s.traceIntel[0];
  assert.ok(intel, 'side 0 trace intel was written');
  assert.ok(Math.abs(intel.x - 600) < 1, `intel x ≈ 600, got ${intel.x}`);
  assert.equal(intel.side, 0, 'intel carries the casualty side');
  return { glanced: glancing.length, intelX: intel.x };
});

test('血痕在左侧时最右单位向左扫视', () => {
  const s = arena();
  spawnUnit(s, 0, 'infantry', 500);
  mark(s, 380);
  runUntil(s, () => s.units.some((u) => (u.traceGlanceUntil ?? 0) > s.time), 1.5);
  const rightmost = s.units.reduce((a, b) => (b.x > a.x ? b : a));
  assert.ok(
    (rightmost.traceGlanceUntil ?? 0) > s.time,
    'the rightmost soldier (x=500) is glancing',
  );
  assert.equal(rightmost.traceGlanceDir, -1, 'the rightmost soldier looks left');
  return { x: rightmost.x, dir: rightmost.traceGlanceDir };
});

test('超出 320px 的血痕不触发扫视', () => {
  const s = arena();
  spawnUnit(s, 0, 'infantry', 500);
  mark(s, 3200, 1);
  run(s, 1.5);
  assert.ok(
    !s.units.some((u) => (u.traceGlanceUntil ?? 0) > s.time),
    'no soldier glances at a far trail',
  );
  assert.equal(s.traceIntel[0], undefined, 'no intel written for a far trail');
  return {};
});

test('超过 15 秒的旧血痕不触发扫视', () => {
  const s = arena();
  spawnUnit(s, 0, 'infantry', 500);
  mark(s, 600, 0, s.time - 20);
  run(s, 1.5);
  assert.ok(
    !s.units.some((u) => (u.traceGlanceUntil ?? 0) > s.time),
    'no soldier glances at a stale trail',
  );
  return {};
});

test('被压制的士兵不扫视血痕', () => {
  const s = arena();
  spawnUnit(s, 0, 'infantry', 500);
  for (const u of s.units) u.suppression = 80;
  mark(s, 600);
  run(s, 1.3);
  // Suppression decays at 7/s with no synergies: 80 - 7*1.3 ≈ 71 > 40.
  assert.ok(
    !s.units.some((u) => (u.traceGlanceUntil ?? 0) > s.time),
    'pinned soldiers keep their heads down',
  );
  return {};
});

// --- B. Medic tracking ----------------------------------------------------

test('军医沿己方血痕追踪伤员方向', () => {
  const s = arena();
  spawnUnit(s, 0, 'medic', 500);
  const startMax = Math.max(...s.units.map((u) => u.x));
  s.traceIntel[0] = { x: 700, side: 0, at: s.time, until: s.time + 8 };
  run(s, 3);
  const endMax = Math.max(...s.units.map((u) => u.x));
  assert.ok(
    endMax > startMax + 50,
    `medics advanced toward the trail (${startMax.toFixed(0)} → ${endMax.toFixed(0)})`,
  );
  return { from: +startMax.toFixed(1), to: +endMax.toFixed(1) };
});

test('军医不追踪敌方血痕', () => {
  const s = arena();
  spawnUnit(s, 0, 'medic', 500);
  const startMax = Math.max(...s.units.map((u) => u.x));
  s.traceIntel[0] = { x: 700, side: 1, at: s.time, until: s.time + 8 };
  run(s, 3);
  const endMax = Math.max(...s.units.map((u) => u.x));
  assert.ok(
    endMax < startMax + 30,
    `medics ignore enemy blood (${startMax.toFixed(0)} → ${endMax.toFixed(0)})`,
  );
  return {};
});

test('军医不追踪过期情报', () => {
  const s = arena();
  spawnUnit(s, 0, 'medic', 500);
  const startMax = Math.max(...s.units.map((u) => u.x));
  s.traceIntel[0] = { x: 700, side: 0, at: s.time - 10, until: s.time - 1 };
  run(s, 3);
  const endMax = Math.max(...s.units.map((u) => u.x));
  assert.ok(
    endMax < startMax + 30,
    `medics ignore stale intel (${startMax.toFixed(0)} → ${endMax.toFixed(0)})`,
  );
  return {};
});

// --- C. AI director -------------------------------------------------------

test('AI 导演在血痕 sector 施放烟幕', () => {
  const s = arenaAI();
  spawnUnit(s, 0, 'infantry', 2500);
  spawnUnit(s, 1, 'infantry', 2900);
  s.traceIntel[1] = { x: 2500, side: 0, at: s.time, until: s.time + 8 };
  const p = s.players[1];
  p.deck = [];
  p.discard = [];
  p.energy = 10;
  p.hand = [{ id: 'smoke', uid: ++s.uid, readyAt: 0 }];
  run(s, 1.3);
  assert.ok(
    s.smokes.some((m) => m.side === 1 && Math.abs(m.x - 2640) < 160),
    'smoke screens the contact sector (enemyTrace.x + 140)',
  );
  return { smokes: s.smokes.length };
});

test('AI 导演在血痕情报期重视侦察', () => {
  const s = arenaAI();
  spawnUnit(s, 1, 'infantry', 3400);
  s.traceIntel[1] = { x: 3300, side: 0, at: s.time, until: s.time + 8 };
  const p = s.players[1];
  p.deck = [];
  p.discard = [];
  p.energy = 3;
  p.recon = 0;
  p.hand = [{ id: 'recon', uid: ++s.uid, readyAt: 0 }];
  run(s, 1.3);
  assert.ok(p.recon > 0, 'recon was activated from the trace intel');
  return { recon: p.recon };
});

// --- D. Animation layer ---------------------------------------------------

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
    traceGlanceUntil: 0,
    traceGlanceDir: 1,
    ...overrides,
  };
}

test('traceGlanceChoice 无扫视窗口时返回 null', () => {
  assert.equal(traceGlanceChoice(stubUnit(), 0), null);
});

test('traceGlanceChoice 窗口过期后返回 null', () => {
  assert.equal(traceGlanceChoice(stubUnit({ traceGlanceUntil: 5 }), 6), null);
});

test('traceGlanceChoice 移动/射击/瞄准/压制时返回 null', () => {
  for (const [key, val] of [
    ['moving', true],
    ['fire', 0.5],
    ['aimUntil', 5],
    ['suppression', 0.5],
  ]) {
    assert.equal(
      traceGlanceChoice(stubUnit({ [key]: val, traceGlanceUntil: 5 }), 0),
      null,
      `gated by ${key}`,
    );
  }
});

test('traceGlanceChoice 作业/拖拽/真空/投弹时返回 null', () => {
  for (const [key, val] of [
    ['digging', true],
    ['tending', true],
    ['draggingUid', 7],
    ['vacuum', true],
    ['fragThrow', 0.3],
  ]) {
    assert.equal(
      traceGlanceChoice(stubUnit({ [key]: val, traceGlanceUntil: 5 }), 0),
      null,
      `gated by ${key}`,
    );
  }
});

test('traceGlanceChoice 伤亡/投降/死亡时返回 null', () => {
  for (const [key, val] of [
    ['wounded', true],
    ['surrendered', true],
    ['hp', 0],
  ]) {
    assert.equal(
      traceGlanceChoice(stubUnit({ [key]: val, traceGlanceUntil: 5 }), 0),
      null,
      `gated by ${key}`,
    );
  }
});

test('traceGlanceChoice 非 idle 姿态返回 null', () => {
  for (const pose of ['crouch', 'prone', 'hunker', 'walk']) {
    assert.equal(
      traceGlanceChoice(stubUnit({ pose, traceGlanceUntil: 5 }), 0),
      null,
      `gated by pose=${pose}`,
    );
  }
});

test('traceGlanceChoice idle + active 返回警戒姿态和方向', () => {
  const choice = traceGlanceChoice(
    stubUnit({ traceGlanceUntil: 5, traceGlanceDir: -1 }),
    0,
  );
  assert.deepEqual(choice, { group: 'actions20', index: 0, dir: -1 });
});

test('traceGlanceChoice 默认方向为右', () => {
  const choice = traceGlanceChoice(
    stubUnit({ traceGlanceUntil: 5, traceGlanceDir: undefined }),
    0,
  );
  assert.equal(choice.dir, 1);
});

test('dugInTraceGlanceChoice crouch 返回单膝姿态', () => {
  const choice = dugInTraceGlanceChoice(
    stubUnit({ pose: 'crouch', traceGlanceUntil: 5, traceGlanceDir: 1 }),
    0,
  );
  assert.deepEqual(choice, { group: 'actions20', index: 1, dir: 1 });
});

test('dugInTraceGlanceChoice prone 返回卧倒姿态', () => {
  const choice = dugInTraceGlanceChoice(
    stubUnit({ pose: 'prone', traceGlanceUntil: 5, traceGlanceDir: -1 }),
    0,
  );
  assert.deepEqual(choice, { group: 'actions20', index: 2, dir: -1 });
});

test('dugInTraceGlanceChoice idle 姿态返回 null', () => {
  assert.equal(
    dugInTraceGlanceChoice(stubUnit({ pose: 'idle', traceGlanceUntil: 5 }), 0),
    null,
  );
});

test('idlePoseChoice 爆炸扫视优先于血痕扫视', () => {
  const u = stubUnit({
    blastGlanceUntil: 5,
    blastGlanceDir: -1,
    traceGlanceUntil: 5,
    traceGlanceDir: 1,
  });
  const choice = idlePoseChoice(u, 0);
  assert.deepEqual(choice, { group: 'actions20', index: 0, dir: -1 });
});

test('idlePoseChoice 无爆炸时血痕扫视生效', () => {
  const u = stubUnit({
    blastGlanceUntil: 0,
    traceGlanceUntil: 5,
    traceGlanceDir: 1,
  });
  const choice = idlePoseChoice(u, 0);
  assert.deepEqual(choice, { group: 'actions20', index: 0, dir: 1 });
});

// --- Report ---------------------------------------------------------------

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  for (const f of failed) console.error('FAILED:', f.name, '-', f.error);
  process.exit(1);
}
