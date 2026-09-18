import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  refreshVision,
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

// ── Mechanics helpers (v25/v28 pattern) ─────────────────────────────

function arena() {
  const s = createGame(28014);
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

// ══════════════════════════════════════════════════════════════════════
// SPOTTER + PRECISION HOWITZER
// ══════════════════════════════════════════════════════════════════════

// precision: 75 damage, members=1, sight 390, range 300–1350, indirect.
// A spotter (scout) within 700px of the target who can see it designates
// the target, granting ×1.3 damage.

test('precision howitzer deals ×1.3 damage when a scout designates the target', () => {
  const s = arena();
  // Howitzer at 200 — pre-emplaced so it skips the setup timer.
  const gun = solo(s, 0, 'precision', 200, {
    emplaced: true,
    emplacementSetupUntil: 0,
  });
  // Infantry at 950 — 750px away, beyond the howitzer's own 390 sight,
  // but inside its 300–1350 range band.
  solo(s, 1, 'infantry', 950, { cooldown: 1e6 });
  // Scout at 850 — 100px from the target, well within 700px designation
  // range and its own 650 sight.
  solo(s, 0, 'scouts', 850, { cooldown: 1e6 });
  refreshVision(s);
  const p = firstShot(s, gun.uid);
  assert.ok(p, 'precision howitzer must fire');
  // 75 / 1 member × 1.3 spotter bonus = 97.5
  assert.ok(
    Math.abs(p.damage - 97.5) < 0.01,
    `spotter-designated damage ${p.damage} ≈ 97.5`,
  );
  return { damage: p.damage };
});

test('precision howitzer deals normal damage without a spotter', () => {
  const s = arena();
  const gun = solo(s, 0, 'precision', 200, {
    emplaced: true,
    emplacementSetupUntil: 0,
  });
  // Infantry at 520 — 320px away, inside the howitzer's own 390 sight
  // and above its 300 minRange.
  solo(s, 1, 'infantry', 520, { cooldown: 1e6 });
  refreshVision(s);
  const p = firstShot(s, gun.uid);
  assert.ok(p, 'precision howitzer must fire');
  // 75 / 1 member, no spotter bonus.
  assert.ok(
    Math.abs(p.damage - 75) < 0.01,
    `unspotted damage ${p.damage} ≈ 75`,
  );
  return { damage: p.damage };
});

// ══════════════════════════════════════════════════════════════════════
// SPOTTER + JAVELIN AT TEAM
// ══════════════════════════════════════════════════════════════════════

// javelin: 104 damage / 2 members = 52 per shot, sight 480, range 100–760,
// guided, armorOnly. A spotter grants ×1.2 damage.

test('javelin team deals ×1.2 damage when a scout designates the target', () => {
  const s = arena();
  const at = solo(s, 0, 'javelin', 300);
  // Tank at 900 — 600px away, beyond the javelin's own 480 sight,
  // but inside its 100–760 range.
  solo(s, 1, 'tank', 900, {
    cooldown: 1e6,
    secondaryCooldown: 1e6,
    pace: 0,
  });
  // Scout at 800 — 100px from the tank, designates it.
  solo(s, 0, 'scouts', 800, { cooldown: 1e6 });
  refreshVision(s);
  const p = firstShot(s, at.uid);
  assert.ok(p, 'javelin must fire');
  // (104 / 2) × 1.2 spotter bonus = 62.4
  assert.ok(
    Math.abs(p.damage - 62.4) < 0.01,
    `spotter-designated damage ${p.damage} ≈ 62.4`,
  );
  return { damage: p.damage };
});

test('javelin team deals normal damage without a spotter', () => {
  const s = arena();
  const at = solo(s, 0, 'javelin', 300);
  // Tank at 700 — 400px away, inside the javelin's own 480 sight.
  solo(s, 1, 'tank', 700, {
    cooldown: 1e6,
    secondaryCooldown: 1e6,
    pace: 0,
  });
  refreshVision(s);
  const p = firstShot(s, at.uid);
  assert.ok(p, 'javelin must fire');
  // 104 / 2 = 52, no spotter bonus.
  assert.ok(
    Math.abs(p.damage - 52) < 0.01,
    `unspotted damage ${p.damage} ≈ 52`,
  );
  return { damage: p.damage };
});

console.log(JSON.stringify(results, null, 2));
if (results.some((r) => !r.ok)) process.exitCode = 1;
