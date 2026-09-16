import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
} from '../game/engine.ts';
import {
  canRicochet,
  ricochetChance,
  reflectAngle,
  RICOCHET_LIFE,
  drawRicochet,
  drawRicochets,
} from '../game/ricochet.ts';
import { SUPERSONIC_AMMO } from '../game/bullet-crack.ts';

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

// Flat open arena, AI director disabled (mirrors v91/v92 harness).
function arena(seed = 92014) {
  const s = createGame(seed);
  startGame(s);
  s.terrain.fill(374);
  s.original.fill(374);
  s.walls = [];
  s.scenery = [];
  s.players[1].deck = [];
  s.players[1].discard = [];
  s.players[1].hand = [];
  s.players[1].energy = 0;
  s.players[1].played = 0;
  s.aiIn = 1e9;
  return s;
}

let projUid = 95000;

// A tank with enough HP to absorb a whole test's worth of AP hits.
function tank(s, side, x) {
  const before = s.units.length;
  spawnUnit(s, side, 'tank', x);
  const u = s.units[before];
  u.hp = 100000;
  u.maxHp = 100000;
  return u;
}

// Fire a single non-guided round directly at a unit. life≈0 makes the next
// tick resolve the hit immediately at (tx, ty).
function fireAt(s, target, overrides = {}) {
  s.projectiles.push({
    x: target.x - 220,
    y: target.y - 20,
    startX: target.x - 220,
    startY: target.y - 20,
    tx: target.x,
    ty: target.y - 20,
    side: 0,
    targetUid: target.uid,
    base: null,
    damage: 10,
    radius: 0,
    life: 0.001,
    total: 0.001,
    uid: ++projUid,
    sourceUid: 999,
    ammunition: 'ap',
    ...overrides,
  });
  tick(s, DT);
}

// Canvas context recording every fillRect together with its fill style.
function mockCtx() {
  const fills = [];
  let style = '';
  return {
    fills,
    save() {},
    restore() {},
    fillRect(x, y, w, h) {
      fills.push({ style, x, y, w, h });
    },
    set fillStyle(v) {
      style = v;
    },
    get fillStyle() {
      return style;
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

// ── Pure module ────────────────────────────────────────────────────────────

check('all four supersonic ammunition types can ricochet', () => {
  for (const ammo of SUPERSONIC_AMMO) {
    assert.ok(canRicochet(ammo), `${ammo} should be able to ricochet`);
  }
  return { ok: true, types: [...SUPERSONIC_AMMO] };
});

check('subsonic and missing ammunition cannot ricochet', () => {
  for (const ammo of ['rocket', 'mortar', 'cannon', 'drone', undefined]) {
    assert.equal(canRicochet(ammo), false, `${ammo} should not ricochet`);
  }
  return { ok: true };
});

check('ricochet chance ranks penetrators above rifle rounds', () => {
  assert.equal(ricochetChance('ap'), 0.55);
  assert.equal(ricochetChance('autocannon'), 0.55);
  assert.equal(ricochetChance('rifle'), 0.32);
  assert.equal(ricochetChance('machinegun'), 0.32);
  for (const ammo of ['rocket', 'mortar', 'cannon', undefined]) {
    assert.equal(ricochetChance(ammo), 0, `${ammo} should have zero chance`);
  }
  return { ok: true };
});

check('reflectAngle mirrors the incoming angle plus scatter', () => {
  assert.ok(Math.abs(reflectAngle(0.5, 0) - -0.5) < 1e-9);
  assert.ok(Math.abs(reflectAngle(-0.3, 0.2) - 0.5) < 1e-9);
  assert.ok(Math.abs(reflectAngle(0, 0) - 0) < 1e-9);
  return { ok: true };
});

// ── Engine integration ─────────────────────────────────────────────────────

check('AP rounds striking a tank spawn ricochet events with valid fields', () => {
  // fxRnd is deterministic per seed, so sweep a few seeds: the chance of
  // 120 consecutive 0.55 rolls all failing is astronomically small.
  let spawned = 0;
  for (let seed = 92014; seed < 92019; seed++) {
    const s = arena(seed);
    const t = tank(s, 1, 900);
    for (let i = 0; i < 24; i++) fireAt(s, t);
    spawned += s.ricochets.length;
  }
  assert.ok(spawned > 0, 'expected at least one ricochet from AP hits');
  // Validate the fields of every spawned event.
  for (let seed = 92014; seed < 92019; seed++) {
    const s = arena(seed);
    const t = tank(s, 1, 900);
    for (let i = 0; i < 24; i++) fireAt(s, t);
    for (const r of s.ricochets) {
      assert.ok(Number.isFinite(r.x) && Number.isFinite(r.y), 'x/y finite');
      assert.ok(Math.abs(r.x - t.x) < 60, `x near impact: ${r.x}`);
      assert.ok(Math.abs(r.angle) <= Math.PI * 4, 'angle sane');
      assert.ok(r.seed >= 0 && r.seed < 8, `seed in range: ${r.seed}`);
      assert.ok(r.age >= 0, 'age non-negative');
    }
  }
  return { ok: true, spawned };
});

check('rounds without ammunition never ricochet off armor', () => {
  const s = arena();
  const t = tank(s, 1, 900);
  for (let i = 0; i < 12; i++) fireAt(s, t, { ammunition: undefined });
  assert.equal(s.ricochets.length, 0);
  return { ok: true };
});

check('radius warheads (rockets) never ricochet', () => {
  const s = arena();
  const t = tank(s, 1, 900);
  for (let i = 0; i < 12; i++)
    fireAt(s, t, { ammunition: 'rocket', radius: 46, damage: 20 });
  assert.equal(s.ricochets.length, 0);
  return { ok: true };
});

check('ricochets age each tick and are removed after their lifetime', () => {
  const s = arena();
  const t = tank(s, 1, 900);
  for (let i = 0; i < 30; i++) fireAt(s, t);
  const born = s.ricochets.length;
  assert.ok(born > 0, 'expected ricochets to age');
  // Shots land across many ticks, so surviving events carry ages from the
  // whole 0.3 s window — but every one has aged at least one DT step and
  // none has reached its lifetime yet.
  for (const r of s.ricochets) assert.ok(r.age > 0 && r.age < RICOCHET_LIFE);
  // A tagged event gains exactly DT per tick while it lives.
  const tagged = s.ricochets[s.ricochets.length - 1];
  const age0 = tagged.age;
  tick(s, DT);
  assert.ok(
    Math.abs(tagged.age - (age0 + DT)) < 1e-6 || tagged.age >= RICOCHET_LIFE,
    'age should advance by DT or the event should have expired'
  );
  // Tick past RICOCHET_LIFE (0.3s = 18 frames); allow a few extra frames.
  for (let i = 0; i < 25; i++) tick(s, DT);
  assert.equal(s.ricochets.length, 0, 'all ricochets should have expired');
  return { ok: true, born };
});

check('ricochets are symmetric: both sides produce them when hit', () => {
  let side0 = 0,
    side1 = 0;
  for (let seed = 92014; seed < 92017; seed++) {
    // Side 0 tank struck by side 1 AP.
    let s = arena(seed);
    let t = tank(s, 0, 900);
    for (let i = 0; i < 24; i++) fireAt(s, t, { side: 1 });
    side0 += s.ricochets.length;
    // Side 1 tank struck by side 0 AP.
    s = arena(seed);
    t = tank(s, 1, 900);
    for (let i = 0; i < 24; i++) fireAt(s, t, { side: 0 });
    side1 += s.ricochets.length;
  }
  assert.ok(side0 > 0, 'side 0 tank should ricochet enemy rounds');
  assert.ok(side1 > 0, 'side 1 tank should ricochet enemy rounds');
  return { ok: true, side0, side1 };
});

// ── Rendering ──────────────────────────────────────────────────────────────

check('draw paints pixels while alive and nothing after expiry', () => {
  const ctx = mockCtx();
  drawRicochet(ctx, {
    x: 100,
    y: 100,
    angle: 0,
    age: 0,
    seed: 0,
    side: 0,
  });
  assert.ok(ctx.fills.length > 0, 'expected painted pixels while alive');
  const ctxAfter = mockCtx();
  drawRicochet(ctxAfter, {
    x: 100,
    y: 100,
    angle: 0,
    age: RICOCHET_LIFE + 0.01,
    seed: 0,
    side: 0,
  });
  assert.equal(ctxAfter.fills.length, 0, 'expected no paints after expiry');
  return { ok: true, painted: ctx.fills.length };
});

check('landing flash only renders during the first 70 ms', () => {
  // Fresh ricochet: flash core (#fff3c4) must be present.
  const fresh = mockCtx();
  drawRicochet(fresh, {
    x: 100,
    y: 100,
    angle: 0,
    age: 0.01,
    seed: 0,
    side: 0,
  });
  assert.ok(
    fresh.fills.some((f) => f.style === '#fff3c4'),
    'fresh ricochet should show the white-yellow flash core',
  );
  // Older ricochet (0.1s): flash gone, but the hot streak still draws.
  const old = mockCtx();
  drawRicochet(old, {
    x: 100,
    y: 100,
    angle: 0,
    age: 0.1,
    seed: 0,
    side: 0,
  });
  assert.ok(
    !old.fills.some((f) => f.style === '#fff3c4'),
    'flash core should be gone after 70 ms',
  );
  assert.ok(
    old.fills.some((f) => f.style === '#ffe9a8'),
    'hot streak core should still render after the flash',
  );
  // drawRicochets skips expired events.
  const batch = mockCtx();
  drawRicochets(batch, [
    { x: 0, y: 0, angle: 0, age: 0, seed: 0, side: 0 },
    { x: 0, y: 0, angle: 0, age: RICOCHET_LIFE + 1, seed: 0, side: 0 },
  ]);
  assert.ok(batch.fills.length > 0, 'live event in batch should paint');
  return { ok: true, fresh: fresh.fills.length, old: old.fills.length };
});

// ── Summary ────────────────────────────────────────────────────────────────

const passed = results.filter((r) => r.ok).length;
console.log(`\nv95 ricochet: ${passed}/${results.length} passed`);
if (failures.length) {
  console.log('FAILURES:');
  for (const f of failures) console.log(f.error);
  process.exit(1);
}
