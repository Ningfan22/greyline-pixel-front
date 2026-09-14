import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  refreshVision,
  CARDS,
} from '../game/engine.ts';

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

// ── Arena helpers (v28 pattern) ──────────────────────────────────────

function arena(seed = 28014) {
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
  s.knownTerrain = [s.terrain.slice(), s.terrain.slice()];
  return s;
}

function run(s, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) tick(s, DT);
}

function one(s, side, id, x) {
  const n = s.units.length;
  spawnUnit(s, side, id, x);
  const us = s.units.slice(n);
  s.units = s.units.filter((u) => !us.slice(1).includes(u));
  const u = us[0];
  Object.assign(u, {
    x,
    y: 374,
    cooldown: 1e6,
    secondaryCooldown: 1e6,
    pace: 0,
    lane: 0,
    pose: 'idle',
  });
  return u;
}

/**
 * Destroy a vehicle with a point-blank AP shot and return the infantry
 * that bailed out (still inside their disorientation window).
 */
function killVehicle(s, victim, damage, opts = {}) {
  const src = one(
    s,
    1 - victim.side,
    'infantry',
    victim.x + (victim.side === 0 ? 400 : -400),
  );
  s.projectiles.push({
    uid: ++s.uid,
    x: victim.x,
    y: victim.y - 24,
    startX: victim.x,
    startY: victim.y - 24,
    tx: victim.x,
    ty: victim.y - 24,
    side: 1 - victim.side,
    sourceUid: src.uid,
    targetUid: victim.uid,
    base: null,
    damage,
    radius: 0,
    shell: false,
    ammunition: 'ap',
    armorMultiplier: opts.armorMultiplier ?? 2,
    life: 0.05,
    total: 0.05,
  });
  run(s, 0.2);
  return s.units.filter(
    (u) =>
      u.side === victim.side && u.id === 'infantry' && u.bailoutUntil !== undefined,
  );
}

function bailCount(s, side) {
  return s.units.filter(
    (u) => u.side === side && u.id === 'infantry' && u.bailoutUntil !== undefined,
  ).length;
}

// ══════════════════════════════════════════════════════════════════════
// MECHANICS TESTS
// ══════════════════════════════════════════════════════════════════════

// --- 1. Tank knock-out spawns shaken bailing crew ---

test('tank knock-out spawns up to three dismounted crew', () => {
  const s = arena();
  const tank = one(s, 0, 'tank', 1900);
  const crew = killVehicle(s, tank, 340);
  assert.ok(crew.length >= 1 && crew.length <= 3, `crew ${crew.length} in [1,3]`);
  for (const m of crew) {
    assert.ok(m.bailoutUntil > s.time, 'crew still in bailout window');
    assert.ok(m.hp < m.maxHp * 0.62, `crew hp ${m.hp} below 62%`);
    assert.ok(m.suppression >= 55, `crew suppression ${m.suppression} >= 55`);
    assert.equal(m.destroyed, false);
  }
  assert.equal(
    s.units.some((u) => u.uid === tank.uid),
    false,
    'wreck removed from the live roster',
  );
  return { crew: crew.length };
});

// --- 2. Bailing crew hold their fire ---

test('bailing crew do not fire while disoriented', () => {
  const s = arena();
  const tank = one(s, 0, 'tank', 1900);
  const crew = killVehicle(s, tank, 340);
  assert.ok(crew.length >= 1, 'need at least one survivor');
  const m = crew[0];
  const shotsBefore = m.shots;
  run(s, 0.8);
  const after = s.units.find((u) => u.uid === m.uid);
  assert.ok(after, 'crew survives the stumble');
  assert.equal(after.shots, shotsBefore, 'no shots fired during bailout');
  assert.equal(after.fire, 0, 'no muzzle flash during bailout');
  return { shotsBefore, shotsAfter: after.shots };
});

// --- 3. Bailing crew stumble toward their own baseline ---

test('bailing crew fall back toward their own baseline', () => {
  const s = arena();
  const tank = one(s, 0, 'tank', 1900);
  const crew = killVehicle(s, tank, 340);
  assert.ok(crew.length >= 1, 'need at least one survivor');
  const m = crew[0];
  const x0 = m.x;
  run(s, 0.8);
  const after = s.units.find((u) => u.uid === m.uid);
  assert.ok(after.x < x0 - 4, `side-0 crew moved left: ${x0} -> ${after.x}`);
  return { from: Math.round(x0), to: Math.round(after.x) };
});

// --- 4. Crew recover and fight once the shock passes ---

test('crew rejoin the fight after the bailout window', () => {
  const s = arena();
  const tank = one(s, 0, 'tank', 1900);
  const crew = killVehicle(s, tank, 340);
  assert.ok(crew.length >= 1, 'need at least one survivor');
  const m = crew[0];
  run(s, 3.2); // outlast the 1.8–2.7s bailout window
  assert.ok(s.time >= m.bailoutUntil, 'bailout window elapsed');
  // Steady them: clear shock, then put a target in range.
  Object.assign(m, {
    suppression: 0,
    personalMorale: 90,
    cooldown: 0,
    decisionIn: 0,
  });
  const foe = one(s, 1, 'infantry', m.x + 260);
  refreshVision(s);
  let shot = null;
  for (let i = 0; i < Math.round(4 / DT) && !shot; i++) {
    tick(s, DT);
    shot = s.projectiles.find((p) => p.sourceUid === m.uid) ?? null;
  }
  assert.ok(shot, 'recovered crew fires at the visible enemy');
  assert.ok(
    s.units.some((u) => u.uid === foe.uid),
    'foe still present (crew did not defect)',
  );
  return { fired: !!shot };
});

// --- 5. Catastrophic kills leave fewer survivors ---

test('catastrophic kills reduce crew survival', () => {
  const N = 24;
  let lowSum = 0;
  let highSum = 0;
  for (let i = 0; i < N; i++) {
    const sLow = arena(4100 + i);
    const tLow = one(sLow, 0, 'tank', 1900);
    lowSum += killVehicle(sLow, tLow, 340).length;
    const sHigh = arena(8200 + i);
    const tHigh = one(sHigh, 0, 'tank', 1900);
    highSum += killVehicle(sHigh, tHigh, 5000).length;
  }
  const meanLow = lowSum / N;
  const meanHigh = highSum / N;
  assert.ok(
    meanLow > meanHigh + 0.8,
    `mean survivors low-overkill ${meanLow.toFixed(2)} > high-overkill ${meanHigh.toFixed(2)} + 0.8`,
  );
  return { meanLow: +meanLow.toFixed(2), meanHigh: +meanHigh.toFixed(2) };
});

// --- 6. Aircraft losses leave no crew on foot ---

test('helicopter loss produces no bailing crew', () => {
  const s = arena();
  const heli = one(s, 0, 'helicopter', 1900);
  const before = s.units.length;
  const crew = killVehicle(s, heli, 340);
  assert.deepEqual(crew, [], 'no crew bails from an aircraft');
  assert.equal(
    s.units.some((u) => u.uid === heli.uid),
    false,
    'helicopter destroyed',
  );
  assert.equal(
    s.units.filter((u) => u.side === 0 && u.id === 'infantry').length,
    0,
    'no side-0 infantry appeared',
  );
  assert.ok(s.units.length >= before - 1, 'only the aircraft was removed');
  return { crew: 0 };
});

// --- 7. A technical carries a single crewman ---

test('technical knock-out yields at most one survivor', () => {
  const s = arena();
  const tech = one(s, 0, 'pickup', 1900);
  assert.equal(CARDS.pickup.crew, 1, 'pickup crew field is 1');
  const crew = killVehicle(s, tech, 120);
  assert.ok(crew.length <= 1, `at most one crew, got ${crew.length}`);
  return { crew: crew.length };
});

// ── Summary ──────────────────────────────────────────────────────────

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  for (const r of failed) console.error('FAILED:', r.name, '-', r.error);
  process.exit(1);
}
