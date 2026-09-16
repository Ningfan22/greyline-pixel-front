import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  H,
} from '../game/engine.ts';
import {
  WhipStreakLayer,
  STREAK_LIFE,
  MAX_STREAKS,
} from '../game/whip-streak.ts';

const DT = 1 / 60;
const results = [],
  failures = [];

function check(name, fn) {
  try {
    const details = fn();
    results.push({ name, ...details });
    console.log('PASS', name);
  } catch (e) {
    failures.push({ name, error: e.stack });
    results.push({ name, ok: false, error: e.message });
    console.log('FAIL', name, e.message);
  }
}

function stubProjectile(overrides = {}) {
  return {
    x: 0,
    y: 0,
    tx: 100,
    ty: 100,
    startX: 0,
    startY: 0,
    side: 0,
    targetUid: null,
    base: null,
    damage: 3,
    radius: 0,
    life: 0.1,
    total: 0.1,
    uid: 1,
    sourceUid: 2,
    ammunition: 'rifle',
    ...overrides,
  };
}

// Minimal canvas context recording the pixel fills the layer rasterizes.
function mockCtx() {
  const calls = [];
  return {
    calls,
    save() {},
    restore() {},
    fillRect(...args) {
      calls.push(args);
    },
    set fillStyle(_) {},
    get fillStyle() {
      return '';
    },
    set globalAlpha(_) {},
    get globalAlpha() {
      return 1;
    },
    set globalCompositeOperation(_) {},
    get globalCompositeOperation() {
      return 'source-over';
    },
  };
}

const LISTENER_X = 640,
  LISTENER_Y = H / 2,
  WIDTH = 1280;

// ── Spawning ───────────────────────────────────────────────────────────────

check('supersonic round inside radius spawns a streak', () => {
  const layer = new WhipStreakLayer();
  const p = stubProjectile({ x: LISTENER_X + 40, y: LISTENER_Y });
  assert.ok(
    layer.consider(p, LISTENER_X, LISTENER_Y, WIDTH, 1.0),
    'expected a streak',
  );
  assert.equal(layer.size, 1);
  return { ok: true };
});

check('subsonic ammunition never spawns a streak', () => {
  const layer = new WhipStreakLayer();
  for (const ammo of ['rocket', 'grenade', 'mortar', 'cannon', 'drone']) {
    const p = stubProjectile({
      uid: Math.floor(Math.random() * 1e6),
      x: LISTENER_X,
      y: LISTENER_Y,
      ammunition: ammo,
    });
    assert.equal(
      layer.consider(p, LISTENER_X, LISTENER_Y, WIDTH, 1.0),
      false,
      `${ammo} should not streak`,
    );
  }
  assert.equal(layer.size, 0);
  return { ok: true };
});

check('round outside radius does not spawn a streak', () => {
  const layer = new WhipStreakLayer();
  const p = stubProjectile({ x: LISTENER_X + 900, y: LISTENER_Y });
  assert.equal(
    layer.consider(p, LISTENER_X, LISTENER_Y, WIDTH, 1.0),
    false,
  );
  assert.equal(layer.size, 0);
  return { ok: true };
});

check('each projectile streaks at most once', () => {
  const layer = new WhipStreakLayer();
  const p = stubProjectile({ x: LISTENER_X, y: LISTENER_Y });
  assert.ok(layer.consider(p, LISTENER_X, LISTENER_Y, WIDTH, 1.0));
  assert.equal(
    layer.consider(p, LISTENER_X, LISTENER_Y, WIDTH, 1.05),
    false,
    'same projectile should not streak twice',
  );
  assert.equal(layer.size, 1);
  return { ok: true };
});

// ── Streak geometry ────────────────────────────────────────────────────────

check('point-blank streak is longer than a distant-edge streak', () => {
  const near = new WhipStreakLayer();
  const far = new WhipStreakLayer();
  near.consider(
    stubProjectile({ uid: 1, x: LISTENER_X + 4, y: LISTENER_Y }),
    LISTENER_X,
    LISTENER_Y,
    WIDTH,
    1.0,
  );
  far.consider(
    stubProjectile({ uid: 2, x: LISTENER_X + 200, y: LISTENER_Y }),
    LISTENER_X,
    LISTENER_Y,
    WIDTH,
    1.0,
  );
  // Sizes compared through draw output: nearer pass paints more pixels.
  const ctxNear = mockCtx(),
    ctxFar = mockCtx();
  near.draw(ctxNear, 1.01);
  far.draw(ctxFar, 1.01);
  assert.ok(
    ctxNear.calls.length > ctxFar.calls.length,
    `near=${ctxNear.calls.length} far=${ctxFar.calls.length}`,
  );
  return { ok: true, near: ctxNear.calls.length, far: ctxFar.calls.length };
});

check('streak angle follows the projectile heading', () => {
  const layer = new WhipStreakLayer();
  const p = stubProjectile({
    x: LISTENER_X,
    y: LISTENER_Y,
    heading: Math.PI / 4,
  });
  layer.consider(p, LISTENER_X, LISTENER_Y, WIDTH, 1.0);
  const ctx = mockCtx();
  layer.draw(ctx, 1.01);
  // At 45° the raster steps equal amounts in x and y.
  const [x0, y0] = ctx.calls[0];
  const [x1, y1] = ctx.calls[1];
  assert.ok(Math.abs(Math.abs(x0 - x1) - Math.abs(y0 - y1)) <= 1);
  return { ok: true };
});

check('streak without heading falls back to launch direction', () => {
  const layer = new WhipStreakLayer();
  const p = stubProjectile({
    x: LISTENER_X,
    y: LISTENER_Y,
    startX: LISTENER_X - 100,
    startY: LISTENER_Y,
    tx: LISTENER_X + 100,
    ty: LISTENER_Y,
  });
  delete p.heading;
  layer.consider(p, LISTENER_X, LISTENER_Y, WIDTH, 1.0);
  const ctx = mockCtx();
  layer.draw(ctx, 1.01);
  const [x0, y0] = ctx.calls[0];
  const [x1, y1] = ctx.calls[1];
  assert.equal(y0, y1, 'horizontal trajectory should keep y constant');
  assert.notEqual(x0, x1);
  return { ok: true };
});

// ── Lifecycle ──────────────────────────────────────────────────────────────

check('streak expires after its lifetime', () => {
  const layer = new WhipStreakLayer();
  layer.consider(
    stubProjectile({ x: LISTENER_X, y: LISTENER_Y }),
    LISTENER_X,
    LISTENER_Y,
    WIDTH,
    1.0,
  );
  assert.equal(layer.size, 1);
  layer.update(1.0 + STREAK_LIFE + 0.01);
  assert.equal(layer.size, 0);
  return { ok: true };
});

check('draw paints pixels while alive and nothing after expiry', () => {
  const layer = new WhipStreakLayer();
  layer.consider(
    stubProjectile({ x: LISTENER_X, y: LISTENER_Y }),
    LISTENER_X,
    LISTENER_Y,
    WIDTH,
    1.0,
  );
  const ctx = mockCtx();
  layer.draw(ctx, 1.05);
  assert.ok(ctx.calls.length > 0, 'expected painted pixels while alive');
  const ctxAfter = mockCtx();
  layer.draw(ctxAfter, 1.0 + STREAK_LIFE + 0.05);
  assert.equal(ctxAfter.calls.length, 0, 'expected no paints after expiry');
  return { ok: true, painted: ctx.calls.length };
});

check('concurrent streaks are capped at the limit', () => {
  const layer = new WhipStreakLayer();
  for (let i = 0; i < MAX_STREAKS + 4; i++) {
    layer.consider(
      stubProjectile({ uid: 100 + i, x: LISTENER_X, y: LISTENER_Y }),
      LISTENER_X,
      LISTENER_Y,
      WIDTH,
      1.0 + i * 0.001,
    );
  }
  assert.equal(layer.size, MAX_STREAKS);
  return { ok: true };
});

check('reset clears streaks and tracker history', () => {
  const layer = new WhipStreakLayer();
  const p = stubProjectile({ x: LISTENER_X, y: LISTENER_Y });
  layer.consider(p, LISTENER_X, LISTENER_Y, WIDTH, 1.0);
  layer.reset();
  assert.equal(layer.size, 0);
  assert.ok(
    layer.consider(p, LISTENER_X, LISTENER_Y, WIDTH, 2.0),
    'after reset the same projectile should streak again',
  );
  return { ok: true };
});

// ── Engine integration ─────────────────────────────────────────────────────

check('engine firefight spawns whip streaks near the camera', () => {
  const s = createGame();
  startGame(s, { difficulty: 'normal' });
  spawnUnit(s, 0, 'infantry', LISTENER_X - 120);
  spawnUnit(s, 1, 'infantry', LISTENER_X + 120);
  s.status = 'playing';
  const layer = new WhipStreakLayer();
  let spawned = 0;
  for (let i = 0; i < 60 * 20 && spawned === 0; i++) {
    tick(s, DT);
    for (const p of s.projectiles) {
      if (layer.consider(p, LISTENER_X, LISTENER_Y, WIDTH, s.time)) spawned++;
    }
  }
  assert.ok(spawned > 0, 'expected at least one whip streak');
  return { ok: true, spawned };
});

check('streaks fade out between volleys instead of accumulating', () => {
  const s = createGame();
  startGame(s, { difficulty: 'normal' });
  spawnUnit(s, 0, 'infantry', LISTENER_X - 120);
  spawnUnit(s, 1, 'infantry', LISTENER_X + 120);
  s.status = 'playing';
  const layer = new WhipStreakLayer();
  let maxConcurrent = 0;
  for (let i = 0; i < 60 * 20; i++) {
    tick(s, DT);
    for (const p of s.projectiles)
      layer.consider(p, LISTENER_X, LISTENER_Y, WIDTH, s.time);
    layer.update(s.time);
    if (layer.size > maxConcurrent) maxConcurrent = layer.size;
  }
  assert.ok(maxConcurrent > 0, 'expected some streaks during the fight');
  layer.update(s.time + STREAK_LIFE + 0.05);
  assert.equal(layer.size, 0, 'all streaks should fade after the battle');
  return { ok: true, maxConcurrent };
});

// ── Summary ────────────────────────────────────────────────────────────────

const passed = results.filter((r) => r.ok).length;
console.log(`\nv94 whip-streak: ${passed}/${results.length} passed`);
if (failures.length) {
  console.log('FAILURES:');
  for (const f of failures) console.log(f.error);
  process.exit(1);
}
