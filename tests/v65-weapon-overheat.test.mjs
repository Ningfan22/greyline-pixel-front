import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  refreshVision,
  setOrder,
  canOverheat,
  unitHeat,
  overheated,
  OVERHEAT_HOT,
  OVERHEAT_CRIT,
} from '../game/engine.ts';

const DT = 1 / 60;
const out = path.resolve('output/v65-weapon-overheat-qa');
const results = [],
  failures = [];
fs.mkdirSync(out, { recursive: true });

function check(name, fn) {
  try {
    const details = fn();
    results.push({ name, ...details });
    console.log('PASS', name);
  } catch (e) {
    failures.push({ name, error: e.stack });
    console.error('FAIL', name, e.stack);
  }
}

function arena() {
  const s = createGame(65014);
  startGame(s);
  s.terrain.fill(374);
  s.original.fill(374);
  s.walls = [];
  s.scenery = [];
  s.players[1].deck = [];
  s.players[1].discard = [];
  s.players[1].hand = [];
  s.players[1].energy = 0;
  // Keep the AI director from rewriting orders mid-scenario.
  s.aiIn = 1e9;
  return s;
}

function squad(s, side, id, x) {
  const at = s.units.length;
  spawnUnit(s, side, id, x);
  return s.units.slice(at);
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

// --- Pure functions ---

check('unitHeat decays with a 4s tau', () => {
  const s = arena();
  s.time = 4;
  const h = unitHeat(s, { heat: 8, heatAt: 0 });
  const expected = 8 / Math.E;
  assert.ok(
    Math.abs(h - expected) < 0.01,
    `heat after 4s should be ~${expected.toFixed(2)}, got ${h.toFixed(2)}`,
  );
  return { heat: +h.toFixed(3), expected: +expected.toFixed(3) };
});

check('canOverheat classifies machinegun and autocannon only', () => {
  assert.equal(canOverheat({ id: 'machinegun', member: 0 }), true, 'mg gunner');
  assert.equal(
    canOverheat({ id: 'machinegun', member: 1 }),
    false,
    'mg rifle escort',
  );
  assert.equal(canOverheat({ id: 'infantry', member: 0 }), false, 'rifleman');
  assert.equal(canOverheat({ id: 'ifv', member: 0 }), true, 'ifv autocannon');
  return {};
});

check('overheated is true only inside the lock window', () => {
  const s = arena();
  s.time = 10;
  assert.equal(overheated(s, { overheatedUntil: 12 }), true, 'inside window');
  assert.equal(overheated(s, { overheatedUntil: 9.9 }), false, 'after window');
  assert.equal(overheated(s, {}), false, 'no lock set');
  return {};
});

check('HOT threshold is below CRIT threshold', () => {
  assert.ok(OVERHEAT_HOT < OVERHEAT_CRIT, 'aim wander must precede lockup');
  return { hot: OVERHEAT_HOT, crit: OVERHEAT_CRIT };
});

// --- Simulation: machinegun overheats under sustained fire ---

check('a machinegunner locks up after sustained fire and resumes', () => {
  const s = arena();
  const mg = squad(s, 0, 'machinegun', 100);
  const gunner = mg[0];
  // Silenced, invincible foe infantry at 460px: inside mg range (500) and
  // sight (600), beyond the rifle escorts' range (380) so only the gunner fires.
  const foe = squad(s, 1, 'infantry', 560);
  for (const v of foe) {
    v.cooldown = 1e6;
    v.decisionIn = 1e6;
    v.hp = 99999;
    v.maxHp = 99999;
  }
  setOrder(s, 0, 'hold');
  setOrder(s, 1, 'hold');
  refreshVision(s);

  const triggerTime = runUntil(
    s,
    () => (gunner.overheatedUntil ?? 0) > 0,
    12,
  );
  assert.ok(
    triggerTime !== null,
    'gunner should overheat within 12s of sustained fire',
  );
  assert.ok(gunner.shots > 10, `gunner should have fired many rounds, got ${gunner.shots}`);

  // During the barrel-change lock the gunner cannot fire.
  const shotsAtLock = gunner.shots;
  run(s, 1.0);
  assert.equal(
    gunner.shots,
    shotsAtLock,
    'no shots while changing the barrel',
  );
  assert.ok(overheated(s, gunner), 'still inside the lock window at 1s');

  // After the 2.5s lock the gunner vents and resumes fire.
  run(s, 3.0);
  assert.ok(
    gunner.shots > shotsAtLock,
    `gunner should resume fire after the lock, shots stayed at ${gunner.shots}`,
  );
  return {
    triggerAt: +triggerTime.toFixed(2),
    shotsBeforeLock: shotsAtLock,
    shotsAfterResume: gunner.shots,
  };
});

// --- Negative: rifles never overheat ---

check('riflemen fire indefinitely without overheating', () => {
  const s = arena();
  const inf = squad(s, 0, 'infantry', 100);
  const foe = squad(s, 1, 'infantry', 380);
  for (const v of foe) {
    v.cooldown = 1e6;
    v.decisionIn = 1e6;
    v.hp = 99999;
    v.maxHp = 99999;
  }
  setOrder(s, 0, 'hold');
  setOrder(s, 1, 'hold');
  refreshVision(s);
  run(s, 12);
  assert.equal(
    inf[0].overheatedUntil,
    undefined,
    'a rifle must never lock up from heat',
  );
  assert.ok(inf[0].shots > 0, 'rifleman should have engaged the enemy');
  return { shots: inf[0].shots };
});

fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`\n${results.length} checks, ${failures.length} failures`);
if (failures.length) process.exit(1);
