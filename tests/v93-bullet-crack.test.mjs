import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  H,
} from '../game/engine.ts';
import {
  nearMissCrack,
  CrackTracker,
  SUPERSONIC_AMMO,
  CRACK_RADIUS,
} from '../game/bullet-crack.ts';

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

// Minimal projectile stub with the fields nearMissCrack reads.
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

const LISTENER_X = 640,
  LISTENER_Y = H / 2,
  WIDTH = 1280;

// ── Pure detection ─────────────────────────────────────────────────────────

check('supersonic round inside radius fires a crack', () => {
  const p = stubProjectile({ x: LISTENER_X + 50, y: LISTENER_Y + 30 });
  const event = nearMissCrack(p, LISTENER_X, LISTENER_Y, WIDTH);
  assert.ok(event, 'expected a crack event');
  assert.ok(event.closeness > 0 && event.closeness <= 1);
  assert.ok(event.pan >= -1 && event.pan <= 1);
  assert.ok(event.seed >= 0 && event.seed < 8);
  return { ok: true };
});

check('point-blank pass has closeness near 1', () => {
  const p = stubProjectile({ x: LISTENER_X + 5, y: LISTENER_Y });
  const event = nearMissCrack(p, LISTENER_X, LISTENER_Y, WIDTH);
  assert.ok(event);
  assert.ok(event.closeness > 0.95, `closeness=${event.closeness}`);
  return { ok: true };
});

check('round outside radius does not crack', () => {
  const p = stubProjectile({
    x: LISTENER_X + CRACK_RADIUS + 50,
    y: LISTENER_Y,
  });
  assert.equal(nearMissCrack(p, LISTENER_X, LISTENER_Y, WIDTH), null);
  return { ok: true };
});

check('subsonic ammunition never cracks', () => {
  for (const ammo of ['rocket', 'grenade', 'mortar', 'cannon', 'drone']) {
    const p = stubProjectile({
      x: LISTENER_X,
      y: LISTENER_Y,
      ammunition: ammo,
    });
    assert.equal(
      nearMissCrack(p, LISTENER_X, LISTENER_Y, WIDTH),
      null,
      `${ammo} should not crack`,
    );
  }
  return { ok: true };
});

check('all four supersonic types crack', () => {
  for (const ammo of SUPERSONIC_AMMO) {
    const p = stubProjectile({
      x: LISTENER_X,
      y: LISTENER_Y,
      ammunition: ammo,
    });
    assert.ok(
      nearMissCrack(p, LISTENER_X, LISTENER_Y, WIDTH),
      `${ammo} should crack`,
    );
  }
  return { ok: true };
});

check('missing ammunition does not crack', () => {
  const p = stubProjectile({ x: LISTENER_X, y: LISTENER_Y });
  delete p.ammunition;
  assert.equal(nearMissCrack(p, LISTENER_X, LISTENER_Y, WIDTH), null);
  return { ok: true };
});

check('pan follows horizontal offset', () => {
  const right = stubProjectile({ x: LISTENER_X + 150, y: LISTENER_Y });
  const left = stubProjectile({ x: LISTENER_X - 150, y: LISTENER_Y });
  const eRight = nearMissCrack(right, LISTENER_X, LISTENER_Y, WIDTH);
  const eLeft = nearMissCrack(left, LISTENER_X, LISTENER_Y, WIDTH);
  assert.ok(eRight.pan > 0, 'right-side round should pan right');
  assert.ok(eLeft.pan < 0, 'left-side round should pan left');
  return { ok: true };
});

// ── Tracker: each projectile cracks exactly once ───────────────────────────

check('tracker fires once per projectile', () => {
  const tracker = new CrackTracker();
  const p = stubProjectile({ x: LISTENER_X, y: LISTENER_Y });
  assert.ok(tracker.consider(p, LISTENER_X, LISTENER_Y, WIDTH));
  assert.equal(
    tracker.consider(p, LISTENER_X, LISTENER_Y, WIDTH),
    null,
    'same projectile should not crack twice',
  );
  return { ok: true };
});

check('tracker allows a second projectile through', () => {
  const tracker = new CrackTracker();
  const p1 = stubProjectile({ uid: 1, x: LISTENER_X, y: LISTENER_Y });
  const p2 = stubProjectile({ uid: 2, x: LISTENER_X, y: LISTENER_Y });
  assert.ok(tracker.consider(p1, LISTENER_X, LISTENER_Y, WIDTH));
  assert.ok(tracker.consider(p2, LISTENER_X, LISTENER_Y, WIDTH));
  return { ok: true };
});

check('tracker does not mark distant projectiles', () => {
  const tracker = new CrackTracker();
  const p = stubProjectile({
    x: LISTENER_X + CRACK_RADIUS + 100,
    y: LISTENER_Y,
  });
  assert.equal(tracker.consider(p, LISTENER_X, LISTENER_Y, WIDTH), null);
  // Move it close — it should still be eligible.
  p.x = LISTENER_X;
  assert.ok(tracker.consider(p, LISTENER_X, LISTENER_Y, WIDTH));
  return { ok: true };
});

check('tracker reset clears history', () => {
  const tracker = new CrackTracker();
  const p = stubProjectile({ x: LISTENER_X, y: LISTENER_Y });
  assert.ok(tracker.consider(p, LISTENER_X, LISTENER_Y, WIDTH));
  tracker.reset();
  assert.ok(
    tracker.consider(p, LISTENER_X, LISTENER_Y, WIDTH),
    'after reset the same projectile should crack again',
  );
  return { ok: true };
});

// ── Engine integration: real bullets crossing the camera produce cracks ────

check('engine firefight produces supersonic projectiles that crack', () => {
  const s = createGame();
  startGame(s, { difficulty: 'normal' });
  // Two infantry squads facing each other at the camera centre.
  const a = spawnUnit(s, 0, 'infantry', LISTENER_X - 120);
  const b = spawnUnit(s, 1, 'infantry', LISTENER_X + 120);
  s.status = 'playing';
  let cracked = 0;
  const tracker = new CrackTracker();
  for (let i = 0; i < 60 * 20 && cracked === 0; i++) {
    tick(s, DT);
    for (const p of s.projectiles) {
      if (tracker.consider(p, LISTENER_X, LISTENER_Y, WIDTH)) cracked++;
    }
  }
  assert.ok(
    s.projectiles.length > 0 || cracked > 0,
    'expected projectiles in a firefight',
  );
  assert.ok(cracked > 0, 'expected at least one near-miss crack');
  return { ok: true, cracked, projectiles: s.projectiles.length };
});

check('engine bullets carry supersonic ammunition tags', () => {
  const s = createGame();
  startGame(s, { difficulty: 'normal' });
  spawnUnit(s, 0, 'infantry', LISTENER_X - 100);
  spawnUnit(s, 1, 'infantry', LISTENER_X + 100);
  s.status = 'playing';
  const seen = new Set();
  for (let i = 0; i < 60 * 15; i++) {
    tick(s, DT);
    for (const p of s.projectiles) seen.add(p.ammunition);
  }
  assert.ok(seen.size > 0, 'expected at least one ammunition type');
  const hasSupersonic = [...seen].some((a) => SUPERSONIC_AMMO.has(a));
  assert.ok(hasSupersonic, `expected supersonic ammo, saw ${[...seen]}`);
  return { ok: true, ammo: [...seen] };
});

// ── Summary ────────────────────────────────────────────────────────────────

const passed = results.filter((r) => r.ok).length;
console.log(`\nv93 bullet-crack: ${passed}/${results.length} passed`);
if (failures.length) {
  console.log('FAILURES:');
  for (const f of failures) console.log(f.error);
  process.exit(1);
}
