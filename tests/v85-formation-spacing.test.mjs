import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  formationLane,
} from '../game/engine.ts';

const DT = 1 / 60;
const out = path.resolve('output/v85-formation-spacing-qa');
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

// Flat open arena, AI director disabled.
function arena() {
  const s = createGame(81014);
  startGame(s);
  s.terrain.fill(374);
  s.original.fill(374);
  s.walls = [];
  s.scenery = [];
  s.players[1].deck = [];
  s.players[1].discard = [];
  s.players[1].hand = [];
  s.players[1].energy = 0;
  s.aiIn = 1e9;
  return s;
}

// ── formationLane helper ──────────────────────────────────────────────
check('formationLane spreads members evenly around zero', () => {
  assert.equal(formationLane(0, 1), 0, 'single member stays at 0');
  // 4 members: matches the old spawn table [-18, -6, 6, 18]
  assert.deepEqual(
    [0, 1, 2, 3].map((m) => formationLane(m, 4)),
    [-18, -6, 6, 18],
  );
  // 6 members: every member gets a unique slot (old code repeated lanes)
  const lanes6 = [0, 1, 2, 3, 4, 5].map((m) => formationLane(m, 6));
  assert.equal(new Set(lanes6).size, 6, 'all 6 lanes unique');
  assert.deepEqual(lanes6, [-30, -18, -6, 6, 18, 30]);
  return { lanes4: [-18, -6, 6, 18], lanes6 };
});

// ── spawn lanes ───────────────────────────────────────────────────────
check('six-member squad spawns with six unique lanes', () => {
  const s = arena();
  const before = s.units.length;
  spawnUnit(s, 0, 'infantry', 400);
  const members = s.units.slice(before).filter((u) => u.side === 0);
  assert.equal(members.length, 6);
  const lanes = members.map((u) => u.lane);
  assert.equal(
    new Set(lanes).size,
    6,
    `expected 6 unique spawn lanes, got ${lanes.join(', ')}`,
  );
  return { lanes: lanes.sort((a, b) => a - b) };
});

// ── formation drift during advance ────────────────────────────────────
check('advancing squad keeps a spread skirmish line', () => {
  const s = arena();
  const before = s.units.length;
  spawnUnit(s, 0, 'infantry', 300);
  const squadId = s.units[before].squad;
  // Let the squad advance for ~12 seconds with no enemy in sight.
  for (let i = 0; i < 720; i++) tick(s, DT);
  const members = s.units.filter(
    (u) => u.squad === squadId && u.hp > 0,
  );
  assert.ok(members.length >= 4, 'most of the squad survives');
  const lanes = members.map((u) => u.lane);
  const spread = Math.max(...lanes) - Math.min(...lanes);
  assert.ok(
    spread >= 30,
    `squad should stay spread across lanes, spread=${spread.toFixed(1)}`,
  );
  // No two alive members should share the exact same lane.
  assert.equal(
    new Set(lanes.map((l) => Math.round(l))).size,
    lanes.length,
    `duplicate lanes after advance: ${lanes.map((l) => l.toFixed(1)).join(', ')}`,
  );
  return {
    spread: +spread.toFixed(1),
    lanes: lanes.map((l) => +l.toFixed(1)).sort((a, b) => a - b),
  };
});

// ── dispersion still overrides formation ──────────────────────────────
check('dispersion temporarily pulls a soldier off the formation lane', () => {
  const s = arena();
  // Two 6-member squads stacked at the same x to force crowding.
  spawnUnit(s, 0, 'infantry', 400);
  spawnUnit(s, 0, 'infantry', 400);
  // A tanky enemy within range so the squads are in contact (dispersion
  // only fires under contact).
  const eBefore = s.units.length;
  spawnUnit(s, 1, 'infantry', 700);
  const enemy = s.units[eBefore];
  enemy.squadOrder = 'hold';
  enemy.squadOrderUntil = 1e9;
  enemy.cooldown = 1e9;
  enemy.hp = 100000;
  // Run until a soldier enters dispersion with a slot that actually
  // differs from its formation lane.
  let dispersed = null;
  for (let i = 0; i < 600 && !dispersed; i++) {
    tick(s, DT);
    dispersed = s.units.find(
      (u) =>
        u.side === 0 &&
        u.dispersionGoal !== undefined &&
        (u.dispersionUntil ?? 0) > s.time &&
        u.passingLane !== undefined &&
        Math.abs(u.passingLane - formationLane(u.member, 6)) >= 4,
    );
  }
  assert.ok(dispersed, 'crowded squads should trigger dispersion');
  const formLane = formationLane(dispersed.member, 6);
  // Lane drift is gradual (0.2px/tick), so let it run and confirm the
  // soldier actually leaves the formation lane instead of being pulled
  // back by the formation-drift fallback.
  let deviated = false;
  for (let i = 0; i < 120 && !deviated; i++) {
    tick(s, DT);
    if (Math.abs(dispersed.lane - formLane) >= 4) deviated = true;
  }
  assert.ok(
    deviated,
    `dispersion should pull the lane off formation ${formLane} ` +
      `(passingLane ${dispersed.passingLane}, lane ${dispersed.lane.toFixed(1)})`,
  );
  return {
    formationLane: formLane,
    passingLane: dispersed.passingLane,
    driftedLane: +dispersed.lane.toFixed(1),
  };
});

// ── report ────────────────────────────────────────────────────────────
fs.writeFileSync(
  path.join(out, 'report.json'),
  JSON.stringify({ results, failures }, null, 2),
);
if (failures.length) {
  console.error(`\n${failures.length} check(s) failed`);
  process.exit(1);
}
console.log(`\nAll ${results.length} checks passed`);
