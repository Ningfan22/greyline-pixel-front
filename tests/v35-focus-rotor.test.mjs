import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  setOrder,
} from '../game/engine.ts';
import { targetValue, squadFocus } from '../game/focus-fire.ts';
import { rotorWash, isRotorcraft } from '../game/rotor-wash.ts';

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

function arena() {
  const s = createGame(32001);
  startGame(s);
  return s;
}

function run(s, frames) {
  for (let i = 0; i < frames; i++) tick(s, DT);
}

function mockUnit(id, hpFraction = 1) {
  const maxHp = 100;
  return { id, hp: maxHp * hpFraction, maxHp };
}

function washState() {
  return { terrain: Array(3840).fill(500), fxSeed: 1, particles: [] };
}

// --- targetValue -------------------------------------------------------------

test('targetValue ranks scouts, command, medics above plain infantry', () => {
  assert.ok(targetValue(mockUnit('scouts')) >= 8, 'scouts are top-priority targets');
  assert.ok(
    targetValue(mockUnit('command_vehicle')) >= 7,
    'command vehicles are high value',
  );
  assert.ok(targetValue(mockUnit('medic')) >= 6, 'medics are high value');
  assert.ok(targetValue(mockUnit('mortar')) >= 5, 'indirect fire is high value');
  assert.ok(targetValue(mockUnit('antiarmor')) >= 5, 'antiarmor teams are high value');
  assert.ok(targetValue(mockUnit('rocket')) >= 4, 'AA teams are worth focusing');
  assert.equal(targetValue(mockUnit('infantry')), 0, 'full-health riflemen have no bonus value');
});

test('targetValue finishes off badly wounded units', () => {
  assert.equal(
    targetValue(mockUnit('infantry', 0.3)),
    3,
    'sub-40% hp units are worth finishing',
  );
  assert.equal(
    targetValue(mockUnit('infantry', 0.5)),
    0,
    'half-health units get no finish bonus',
  );
});

// --- isRotorcraft ------------------------------------------------------------

test('isRotorcraft recognises airlift and heli airframes only', () => {
  assert.ok(isRotorcraft(mockUnit('air_assault')), 'transport heli is rotorcraft');
  assert.ok(isRotorcraft(mockUnit('rocket_heli')), 'rocket heli is rotorcraft');
  assert.ok(isRotorcraft(mockUnit('helicopter')), 'base heli counts as rotorcraft (v36)');
  assert.ok(!isRotorcraft(mockUnit('infantry')), 'infantry is not rotorcraft');
  assert.ok(!isRotorcraft(mockUnit('tank')), 'tank is not rotorcraft');
});

// --- rotorWash (unit) --------------------------------------------------------

test('rotorWash emits rising ground dust when flying low', () => {
  const s = washState();
  rotorWash(s, { id: 'air_assault', x: 100, y: 380, rotorWashAt: 0 }, DT);
  assert.ok(s.particles.length >= 2, 'should emit 2-3 dust puffs');
  for (const p of s.particles) {
    assert.equal(p.kind, 'dust');
    assert.equal(p.y, 499, 'dust spawns on the ground below the fuselage');
    assert.ok(p.vy < 0, 'dust is flung upward');
    assert.ok(p.x >= 70 && p.x <= 130, 'dust spreads below the heli');
    assert.ok(p.size >= 5 && p.size <= 22, 'wash dust size band');
  }
});

test('rotorWash stays quiet at high altitude and for non-rotorcraft', () => {
  const high = washState();
  rotorWash(high, { id: 'air_assault', x: 100, y: 100, rotorWashAt: 0 }, DT);
  assert.equal(high.particles.length, 0, '400px clearance is above the wash ceiling');

  const ground = washState();
  rotorWash(ground, { id: 'infantry', x: 100, y: 380, rotorWashAt: 0 }, DT);
  assert.equal(ground.particles.length, 0, 'infantry produce no rotor wash');
});

test('rotorWash is throttled to 0.05s and deterministic for a seed', () => {
  const s = washState();
  const u = { id: 'air_assault', x: 100, y: 380, rotorWashAt: 0 };
  rotorWash(s, u, DT);
  const emitted = s.particles.length;
  rotorWash(s, u, 0);
  assert.equal(s.particles.length, emitted, 'no new dust while throttle is active');

  const a = washState();
  const b = washState();
  rotorWash(a, { id: 'air_assault', x: 100, y: 380, rotorWashAt: 0 }, DT);
  rotorWash(b, { id: 'air_assault', x: 100, y: 380, rotorWashAt: 0 }, DT);
  assert.deepEqual(a.particles, b.particles, 'same seed yields identical dust');
});

// --- squadFocus (real arena, forced visibility) ------------------------------

function focusArena() {
  const s = arena();
  spawnUnit(s, 0, 'infantry', 380);
  spawnUnit(s, 1, 'infantry', 480);
  spawnUnit(s, 1, 'medic', 560);
  const squad = s.units.find((u) => u.side === 0).squad;
  const medic = s.units.find((u) => u.side === 1 && u.id === 'medic');
  s.visible[0] = s.units.map((u) => u.uid);
  return { s, squad, medic };
}

test('squadFocus designates the medic over closer riflemen', () => {
  const { s, squad, medic } = focusArena();
  assert.equal(squadFocus(s, 0, squad, s.time), medic.uid);
});

test('squadFocus designation is sticky within the TTL', () => {
  const { s, squad, medic } = focusArena();
  const first = squadFocus(s, 0, squad, s.time);
  assert.equal(squadFocus(s, 0, squad, s.time + 0.3), first, 'cached within 0.6s');
  assert.equal(
    squadFocus(s, 0, squad, s.time + 0.7),
    medic.uid,
    're-scan after TTL still picks the medic',
  );
});

test('squadFocus drops a dead target and returns undefined with no valuable foe', () => {
  const { s, squad } = focusArena();
  squadFocus(s, 0, squad, s.time);
  for (const u of s.units) if (u.side === 1 && u.id === 'medic') u.hp = 0;
  assert.equal(
    squadFocus(s, 0, squad, s.time + 0.1),
    undefined,
    'dead medic is invalidated and riflemen have no focus value',
  );
});

test('squadFocus ignores high-value targets beyond the radius', () => {
  const s = arena();
  spawnUnit(s, 0, 'infantry', 2000);
  spawnUnit(s, 1, 'mortar', 3000);
  s.visible[0] = s.units.map((u) => u.uid);
  const squad = s.units.find((u) => u.side === 0).squad;
  assert.equal(
    squadFocus(s, 0, squad, s.time),
    undefined,
    'mortar ~1100px from squad centre is outside the 720px radius',
  );
  spawnUnit(s, 1, 'mortar', 2400);
  s.visible[0] = s.units.map((u) => u.uid);
  const near = s.units.find(
    (u) => u.side === 1 && u.id === 'mortar' && Math.abs(u.x - 2400) < 60,
  );
  assert.equal(
    squadFocus(s, 0, squad, s.time + 1),
    near.uid,
    'mortar within the radius becomes the focus target',
  );
});

// --- integration: squad actually concentrates fire ---------------------------

test('infantry squad concentrates its fire on the medic', () => {
  const s = arena();
  spawnUnit(s, 0, 'infantry', 380);
  setOrder(s, 0, 'hold');
  // Open ground left of the seed's house (which spans x≈532–708): a medic
  // sheltered inside walls soaks 50% scenery-cover intercepts and out-heals
  // the trickle, which would make this a cover test instead of a focus test.
  spawnUnit(s, 1, 'infantry', 440);
  spawnUnit(s, 1, 'medic', 480);
  const medicXs = s.units
    .filter((u) => u.side === 1 && u.id === 'medic')
    .map((u) => u.x);
  const medicHp0 = s.units
    .filter((u) => u.side === 1 && u.id === 'medic')
    .reduce((sum, u) => sum + u.hp, 0);

  let focusedFrames = 0;
  for (let i = 0; i < 120; i++) {
    tick(s, DT);
    const shooters = s.units.filter(
      (u) => u.side === 0 && u.id === 'infantry' && u.lastThreat,
    );
    if (shooters.length >= 3) {
      const onMedic = shooters.filter((u) =>
        medicXs.some((x) => Math.abs(u.lastThreat.x - x) <= 40),
      );
      if (onMedic.length > shooters.length / 2) focusedFrames++;
    }
  }

  assert.ok(
    focusedFrames > 10,
    `squad should keep its guns on the medic for a stretch (${focusedFrames} frames)`,
  );
  const medicHpNow = s.units
    .filter((u) => u.side === 1 && u.id === 'medic')
    .reduce((sum, u) => sum + u.hp, 0);
  assert.ok(
    medicHpNow < medicHp0,
    'the focused medic should actually have taken damage',
  );
});

// --- integration: helicopter downwash in flight ------------------------------

test('low-flying transport heli kicks up rotor wash dust', () => {
  const s = arena();
  spawnUnit(s, 0, 'air_assault', 200);
  let sawWash = false;
  for (let i = 0; i < 120; i++) {
    tick(s, DT);
    if (s.particles.some((p) => p.kind === 'dust' && p.size >= 10)) sawWash = true;
  }
  assert.ok(
    sawWash,
    'the approaching transport should stir up dust beneath its rotors',
  );
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error(failed.map((f) => f.error).join('\n'));
  process.exit(1);
}
