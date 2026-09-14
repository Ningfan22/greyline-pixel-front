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

// ── Mechanics helpers (v25 pattern) ──────────────────────────────────

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

// ── Suppression helpers (v18 pattern) ────────────────────────────────

function bullet(s, side, source, target, extra = {}) {
  return {
    uid: ++s.uid,
    x: source.x,
    y: 338,
    startX: source.x,
    startY: 338,
    tx: target.x,
    ty: 338,
    side,
    sourceUid: source.uid,
    targetUid: target.uid,
    base: null,
    damage: 10,
    radius: 0,
    shell: false,
    ammunition: 'rifle',
    life: 0.2,
    total: 0.2,
    ...extra,
  };
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

// ── AI helpers (v26 pattern) ─────────────────────────────────────────

function aiArena() {
  const s = createGame(1);
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
  s.aiIn = 0;
  return s;
}

function squad(s, side, id, x) {
  const at = s.units.length;
  spawnUnit(s, side, id, x);
  return s.units.slice(at);
}

function hand(s, ids, energy) {
  s.players[1].hand = ids.map((id, i) => ({ id, uid: 10000 + i, readyAt: 0 }));
  s.players[1].energy = energy;
}

function expectPlayed(s, expectedId) {
  refreshVision(s);
  tick(s, 0.05);
  assert.equal(s.players[1].played, 1, 'AI must play exactly one card');
  assert.ok(
    s.players[1].discard.some((c) => c.id === expectedId),
    `expected ${expectedId} in discard, got [${s.players[1].discard
      .map((c) => c.id)
      .join(', ')}]`,
  );
  assert.ok(
    s.units.some((u) => u.side === 1 && u.id === expectedId),
    `expected a side-1 ${expectedId} on the field`,
  );
  return { played: expectedId };
}

// ══════════════════════════════════════════════════════════════════════
// MECHANICS TESTS
// ══════════════════════════════════════════════════════════════════════

// --- 1. Recon + Marksman: scout designation boosts sniper damage ---

test('sniper deals ×1.25 damage when a scout designates the target', () => {
  const s = arena();
  const sniper = solo(s, 0, 'sniper', 600);
  solo(s, 1, 'infantry', 850, { cooldown: 1e6 });
  solo(s, 0, 'scouts', 700, { cooldown: 1e6 });
  refreshVision(s);
  const p = firstShot(s, sniper.uid);
  assert.ok(p, 'sniper must fire');
  // damage 42 / 2 members = 21, ×1.25 scout designation = 26.25
  assert.ok(
    Math.abs(p.damage - 26.25) < 0.01,
    `scout-designated damage ${p.damage} ≈ 26.25`,
  );
  return { damage: p.damage };
});

test('sniper deals normal damage without a scout spotter', () => {
  const s = arena();
  const sniper = solo(s, 0, 'sniper', 600);
  solo(s, 1, 'infantry', 850, { cooldown: 1e6 });
  refreshVision(s);
  const p = firstShot(s, sniper.uid);
  assert.ok(p, 'sniper must fire');
  // damage 42 / 2 members = 21, no scout bonus
  assert.ok(
    Math.abs(p.damage - 21) < 0.01,
    `unspotted damage ${p.damage} ≈ 21`,
  );
  return { damage: p.damage };
});

// --- 2. AA Umbrella: anti-air suppresses enemy air, protecting nearby infantry ---

test('nearby friendly AA gun reduces suppression buildup on infantry (×0.7)', () => {
  const s = arena();
  const target = one(s, 0, 'infantry', 1000);
  const shooter = one(s, 1, 'infantry', 1200);
  // AA gun 100px away — within 420px umbrella radius
  one(s, 0, 'aa_gun', 900);
  const before = target.suppression;
  s.projectiles.push(
    bullet(s, 1, shooter, target, { startLane: 0, targetLane: 0 }),
  );
  run(s, 0.3);
  const gained = target.suppression - before;
  // spawnUnit maxHp = 35; bullet damage 10 → actual 7 (cover reduction).
  // Hit suppression = (7/35)*90 + 6 = 24; near-miss +2; decay 7/s over 0.3s ≈ 2.1.
  // Umbrella scales the hit component ×0.7: 24*0.7 + 2 - 2.1 ≈ 16.2.
  assert.ok(
    gained > 13 && gained < 20,
    `umbrella suppression gain ${gained} ≈ 16.2`,
  );
  return { suppressionGain: gained };
});

test('infantry without AA cover takes full suppression', () => {
  const s = arena();
  const target = one(s, 0, 'infantry', 1000);
  const shooter = one(s, 1, 'infantry', 1200);
  const before = target.suppression;
  s.projectiles.push(
    bullet(s, 1, shooter, target, { startLane: 0, targetLane: 0 }),
  );
  run(s, 0.3);
  const gained = target.suppression - before;
  // spawnUnit maxHp = 35; bullet damage 10 → actual 7 (cover reduction).
  // Hit suppression = (7/35)*90 + 6 = 24; near-miss +2; decay 7/s over 0.3s ≈ 2.1.
  // Total ≈ 23.4 (no umbrella scaling).
  assert.ok(
    gained > 20 && gained < 27,
    `unsuppressed suppression gain ${gained} ≈ 23.4`,
  );
  return { suppressionGain: gained };
});

// --- 3. Engineer + Breach: wall breach grants assault burst ---

test('engineer breaching a wall grants assault burst to nearby assault troops', () => {
  const s = arena();
  s.players.forEach((p) => (p.order = 'advance'));
  // Wall at x=1100, engineer at 1075 (within breach range)
  s.walls = [{ uid: 91, x: 1100, width: 24, height: 24, hp: 100, maxHp: 100 }];
  const engineer = solo(s, 0, 'engineers', 1075, {
    squadOrder: 'advance',
    squadOrderX: 1200,
    squadOrderUntil: Infinity,
  });
  const assault = solo(s, 0, 'assault', 1050, {
    squadOrder: 'watch',
    squadOrderX: 1050,
    squadOrderUntil: Infinity,
  });
  // Run until the wall is breached (2 engineer hits at 70hp each)
  let breached = false;
  for (let i = 0; i < Math.round(6 / DT); i++) {
    tick(s, DT);
    if (s.walls[0].hp === 0) {
      breached = true;
      break;
    }
  }
  assert.ok(breached, 'engineer must breach the wall');
  assert.ok(
    (assault.assaultBurstUntil ?? 0) > s.time,
    `assault burst active until ${assault.assaultBurstUntil}, now ${s.time}`,
  );
  return {
    wallHp: s.walls[0].hp,
    burstUntil: assault.assaultBurstUntil,
    time: s.time,
  };
});

// ══════════════════════════════════════════════════════════════════════
// AI TESTS
// ══════════════════════════════════════════════════════════════════════

// --- 4. AI drafts scouts when its sniper needs a spotter ---

test('AI drafts scouts over infantry when a sniper is fielded', () => {
  const s = aiArena();
  squad(s, 1, 'sniper', 2800);
  squad(s, 1, 'infantry', 2750);
  squad(s, 0, 'infantry', 2500);
  squad(s, 0, 'infantry', 2560);
  hand(s, ['scouts', 'infantry'], 3);
  // scouts 34 (needsSpotter for sniper) vs infantry 26
  return expectPlayed(s, 'scouts');
});

// --- 5. AI drafts AA gun when enemy air threatens its indirect fire ---

test('AI drafts AA gun over sniper when enemy air threatens indirect fire', () => {
  const s = aiArena();
  squad(s, 1, 'mortar_carrier', 2900);
  squad(s, 1, 'infantry', 2850);
  squad(s, 1, 'infantry', 2800);
  squad(s, 0, 'helicopter', 2500);
  hand(s, ['aa_gun', 'sniper'], 3);
  // aa_gun 31 (antiAir 19 + umbrella 6) vs sniper 26
  return expectPlayed(s, 'aa_gun');
});

// --- 6. AI drafts engineers when assault troops face a wall ---

test('AI drafts engineers over sniper when assault troops face a wall', () => {
  const s = aiArena();
  squad(s, 1, 'assault', 2800);
  squad(s, 1, 'infantry', 2750);
  squad(s, 1, 'infantry', 2700);
  squad(s, 0, 'infantry', 2500);
  squad(s, 0, 'infantry', 2560);
  // AI needs to know about the wall to score engineers highly
  s.knownWalls[1] = {
    91: { uid: 91, x: 2500, width: 24, height: 24, hp: 100 },
  };
  hand(s, ['engineers', 'sniper'], 3);
  // engineers 24 (hasAssault + wallAhead) vs sniper 14
  return expectPlayed(s, 'engineers');
});

console.log(JSON.stringify(results, null, 2));
if (results.some((r) => !r.ok)) process.exitCode = 1;
