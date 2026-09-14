import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  refreshVision,
  CARDS,
} from '../game/engine.ts';

const DT = 1 / 60;
const out = path.resolve('output/v25-synergies-qa');
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
  const s = createGame(25014);
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

function solo(s, side, id, x, opts = {}) {
  const before = s.units.length;
  spawnUnit(s, side, id, x);
  const u = s.units[before];
  s.units = s.units.slice(0, before).concat(u);
  Object.assign(u, {
    x,
    y: 374,
    shots: 0,
    cooldown: 0,
    decisionIn: 1e6,
    contactScanAt: 1e6,
    pace: 1,
    tactic: 'advance',
    squadOrder: 'watch',
    squadOrderX: x,
    squadOrderUntil: Infinity,
    ...opts,
  });
  return u;
}

function firstShot(s, sourceUid, seconds = 4) {
  for (let i = 0; i < Math.round(seconds * 60); i++) {
    tick(s, DT);
    const p = s.projectiles.find((p) => p.sourceUid === sourceUid);
    if (p) return p;
  }
  return null;
}

// --- Test 1: Forward observer — scout spots for indirect fire ---

check(
  'mortar carrier fires faster with a scout spotter (forward observer synergy)',
  () => {
    const s = arena();
    const mortar = solo(s, 0, 'mortar_carrier', 500);
    solo(s, 1, 'infantry', 1100, {
      cooldown: 1e6,
      hp: 10000,
      maxHp: 10000,
    });
    // Ranger scout at x=950 can see the enemy at x=1100 (150px, sight 828)
    solo(s, 0, 'rangers', 950, { cooldown: 1e6 });
    refreshVision(s);
    const p = firstShot(s, mortar.uid);
    assert.ok(p, 'mortar carrier must fire');
    // rate 8 × spotted 0.7 = 5.6
    assert.ok(
      Math.abs(mortar.cooldown - 5.6) < 0.001,
      `spotted cooldown ${mortar.cooldown} ≈ 5.6`,
    );
    return { cooldown: mortar.cooldown };
  },
);

check(
  'mortar carrier fires at normal rate without a scout spotter',
  () => {
    const s = arena();
    const mortar = solo(s, 0, 'mortar_carrier', 500);
    solo(s, 1, 'infantry', 1100, {
      cooldown: 1e6,
      hp: 10000,
      maxHp: 10000,
    });
    // Regular infantry at x=950 provides shared vision but is not a scout
    solo(s, 0, 'infantry', 950, { cooldown: 1e6 });
    refreshVision(s);
    const p = firstShot(s, mortar.uid);
    assert.ok(p, 'mortar carrier must fire');
    // rate 8, no spotter bonus
    assert.ok(
      Math.abs(mortar.cooldown - 8) < 0.001,
      `unspotted cooldown ${mortar.cooldown} ≈ 8`,
    );
    return { cooldown: mortar.cooldown };
  },
);

// --- Test 2: Suppression assault — close_assault vs suppressed targets ---

check(
  'assault troops deal bonus damage to suppressed targets (suppression assault synergy)',
  () => {
    const s = arena();
    const attacker = solo(s, 0, 'assault', 600);
    const enemy = solo(s, 1, 'infantry', 850, {
      cooldown: 1e6,
      suppression: 60,
    });
    refreshVision(s);
    const p = firstShot(s, attacker.uid);
    assert.ok(p, 'assault troop must fire');
    // damage 40 / 5 members × suppression 1.3 = 10.4
    assert.ok(
      Math.abs(p.damage - 10.4) < 0.001,
      `suppression assault damage ${p.damage} ≈ 10.4`,
    );
    return { damage: p.damage, enemySuppression: enemy.suppression };
  },
);

check(
  'assault troops deal normal damage to unsuppressed targets',
  () => {
    const s = arena();
    const attacker = solo(s, 0, 'assault', 600);
    solo(s, 1, 'infantry', 850, { cooldown: 1e6, suppression: 0 });
    refreshVision(s);
    const p = firstShot(s, attacker.uid);
    assert.ok(p, 'assault troop must fire');
    // damage 40 / 5 members = 8.0
    assert.ok(
      Math.abs(p.damage - 8.0) < 0.001,
      `normal damage ${p.damage} ≈ 8.0`,
    );
    return { damage: p.damage };
  },
);

// --- Test 3: Smoke screen — infantry fighting from own smoke ---

check(
  'infantry gain damage bonus when firing from their own smoke screen',
  () => {
    const s = arena();
    const shooter = solo(s, 0, 'infantry', 600);
    solo(s, 1, 'infantry', 720, { cooldown: 1e6 });
    // Own-side smoke at shooter position; 120px distance ≤ 140 so it doesn't block shot/vision
    s.smokes.push({ x: 600, life: 10, side: 0 });
    refreshVision(s);
    const p = firstShot(s, shooter.uid);
    assert.ok(p, 'infantry must fire through own smoke');
    // damage 24 / 6 members × smoke 1.15 = 4.6
    assert.ok(
      Math.abs(p.damage - 4.6) < 0.001,
      `smoke screen damage ${p.damage} ≈ 4.6`,
    );
    return { damage: p.damage };
  },
);

check(
  'infantry deal normal damage without a smoke screen',
  () => {
    const s = arena();
    const shooter = solo(s, 0, 'infantry', 600);
    solo(s, 1, 'infantry', 720, { cooldown: 1e6 });
    refreshVision(s);
    const p = firstShot(s, shooter.uid);
    assert.ok(p, 'infantry must fire');
    // damage 24 / 6 members = 4.0
    assert.ok(
      Math.abs(p.damage - 4.0) < 0.001,
      `normal damage ${p.damage} ≈ 4.0`,
    );
    return { damage: p.damage };
  },
);

fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`${results.length} passed, ${failures.length} failed`);
if (failures.length) process.exitCode = 1;
