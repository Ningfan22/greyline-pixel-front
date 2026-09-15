import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createGame, startGame, tick, spawnUnit } from '../game/engine.ts';

const DT = 1 / 60;
const out = path.resolve('output/v87-contact-callout-qa');
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

// Run the simulation until a predicate matches or ticks run out.
function runUntil(s, ticks, pred) {
  for (let i = 0; i < ticks; i++) {
    tick(s, DT);
    if (pred(s)) return i;
  }
  return -1;
}

// ── spotter gets callout fields ───────────────────────────────────────
check('a soldier who newly spots a threat shouts a contact callout', () => {
  const s = arena();
  const before = s.units.length;
  spawnUnit(s, 0, 'infantry', 300);
  const squadId = s.units[before].squad;
  spawnUnit(s, 1, 'infantry', 600);
  // Advance until someone in the friendly squad has an active callout.
  const t = runUntil(
    s,
    600,
    (s) =>
      s.units.some(
        (u) =>
          u.side === 0 &&
          u.squad === squadId &&
          (u.calloutUntil ?? 0) > s.time,
      ),
  );
  assert.ok(t >= 0, 'a callout should fire within 10 seconds of contact');
  const spotter = s.units.find(
    (u) => u.side === 0 && u.squad === squadId && (u.calloutUntil ?? 0) > s.time,
  );
  assert.ok(spotter, 'spotter should have calloutUntil set');
  assert.ok(
    spotter.calloutUntil > s.time,
    'calloutUntil should be in the future',
  );
  assert.ok(
    spotter.calloutDir === 1 || spotter.calloutDir === -1,
    'calloutDir should be 1 or -1',
  );
  // Enemy is to the right (x=600 > spotter x~300), so calloutDir should be 1.
  assert.equal(
    spotter.calloutDir,
    1,
    'callout should point toward the threat on the right',
  );
  return { tick: t, spotterUid: spotter.uid, dir: spotter.calloutDir };
});

// ── nearby squadmates hear the callout ────────────────────────────────
check('nearby squadmates hear the callout and orient toward the threat', () => {
  const s = arena();
  const before = s.units.length;
  spawnUnit(s, 0, 'infantry', 300);
  const squadId = s.units[before].squad;
  spawnUnit(s, 1, 'infantry', 600);
  // Run until a callout fires.
  runUntil(
    s,
    600,
    (s) =>
      s.units.some(
        (u) =>
          u.side === 0 &&
          u.squad === squadId &&
          (u.calloutUntil ?? 0) > s.time,
      ),
  );
  const spotter = s.units.find(
    (u) => u.side === 0 && u.squad === squadId && (u.calloutUntil ?? 0) > s.time,
  );
  assert.ok(spotter, 'spotter should exist');
  // Nearby mates (within 140px) should have heardContact fields.
  const mates = s.units.filter(
    (u) =>
      u.side === 0 &&
      u.squad === squadId &&
      u.uid !== spotter.uid &&
      Math.abs(u.x - spotter.x) <= 140,
  );
  assert.ok(mates.length > 0, 'squad should have nearby mates');
  for (const m of mates) {
    assert.ok(
      (m.heardContactAt ?? 0) > 0,
      `mate ${m.uid} should have heardContactAt set`,
    );
    assert.equal(
      m.heardContactDir,
      1,
      `mate ${m.uid} should have heardContactDir pointing right`,
    );
  }
  return { heardMates: mates.length };
});

// ── distant squadmates do not hear ────────────────────────────────────
check('distant squadmates beyond 140px do not hear the callout', () => {
  const s = arena();
  const before = s.units.length;
  // Spawn a squad, then teleport one member far away.
  spawnUnit(s, 0, 'infantry', 300);
  const squadId = s.units[before].squad;
  const farMate = s.units[before + 1];
  farMate.x = 300 + 500; // 500px from the rest of the squad
  spawnUnit(s, 1, 'infantry', 600);
  // Run until a callout fires.
  runUntil(
    s,
    600,
    (s) =>
      s.units.some(
        (u) =>
          u.side === 0 &&
          u.squad === squadId &&
          (u.calloutUntil ?? 0) > s.time,
      ),
  );
  const spotter = s.units.find(
    (u) => u.side === 0 && u.squad === squadId && (u.calloutUntil ?? 0) > s.time,
  );
  assert.ok(spotter, 'spotter should exist');
  // The far mate should NOT have heardContact.
  assert.ok(
    spotter.uid !== farMate.uid,
    'far mate should not be the spotter',
  );
  assert.ok(
    (farMate.heardContactAt ?? 0) === 0,
    'far mate should not have heard the callout',
  );
  return { farMateUid: farMate.uid, dist: 500 };
});

// ── throttle: only one callout per squad at a time ────────────────────
check('only one soldier per squad shouts at a time (throttle)', () => {
  const s = arena();
  const before = s.units.length;
  spawnUnit(s, 0, 'infantry', 300);
  const squadId = s.units[before].squad;
  spawnUnit(s, 1, 'infantry', 600);
  // Run until a callout fires.
  runUntil(
    s,
    600,
    (s) =>
      s.units.some(
        (u) =>
          u.side === 0 &&
          u.squad === squadId &&
          (u.calloutUntil ?? 0) > s.time,
      ),
  );
  const shouters = s.units.filter(
    (u) => u.side === 0 && u.squad === squadId && (u.calloutUntil ?? 0) > s.time,
  );
  assert.equal(
    shouters.length,
    1,
    `exactly one soldier should be shouting, got ${shouters.length}`,
  );
  return { shouters: shouters.length };
});

// ── hearer turns toward the reported threat ───────────────────────────
check('a stationary hearer turns to face the reported threat direction', () => {
  const s = arena();
  const before = s.units.length;
  spawnUnit(s, 0, 'infantry', 300);
  const squadId = s.units[before].squad;
  spawnUnit(s, 1, 'infantry', 600);
  // Run until a callout fires.
  runUntil(
    s,
    600,
    (s) =>
      s.units.some(
        (u) =>
          u.side === 0 &&
          u.squad === squadId &&
          (u.calloutUntil ?? 0) > s.time,
      ),
  );
  const spotter = s.units.find(
    (u) => u.side === 0 && u.squad === squadId && (u.calloutUntil ?? 0) > s.time,
  );
  assert.ok(spotter, 'spotter should exist');
  // Find a mate who heard the callout and is stationary.
  const hearer = s.units.find(
    (u) =>
      u.side === 0 &&
      u.squad === squadId &&
      u.uid !== spotter.uid &&
      (u.heardContactAt ?? 0) > 0 &&
      !u.moving,
  );
  assert.ok(hearer, 'a stationary hearer should exist');
  // The hearer should be facing right (toward the threat).
  assert.equal(
    hearer.facing,
    1,
    'stationary hearer should face the reported threat direction (right)',
  );
  return { hearerUid: hearer.uid, facing: hearer.facing };
});

// ── callout expires ───────────────────────────────────────────────────
check('callout expires after ~0.9 seconds', () => {
  const s = arena();
  const before = s.units.length;
  spawnUnit(s, 0, 'infantry', 300);
  const squadId = s.units[before].squad;
  spawnUnit(s, 1, 'infantry', 600);
  // Run until a callout fires.
  runUntil(
    s,
    600,
    (s) =>
      s.units.some(
        (u) =>
          u.side === 0 &&
          u.squad === squadId &&
          (u.calloutUntil ?? 0) > s.time,
      ),
  );
  const spotter = s.units.find(
    (u) => u.side === 0 && u.squad === squadId && (u.calloutUntil ?? 0) > s.time,
  );
  assert.ok(spotter, 'spotter should exist');
  const calloutEnd = spotter.calloutUntil;
  // Advance past the callout expiry.
  while (s.time < calloutEnd + 0.1) tick(s, DT);
  assert.ok(
    (spotter.calloutUntil ?? 0) <= s.time,
    'callout should have expired',
  );
  return { expiredAt: +calloutEnd.toFixed(2) };
});

// ── summary ───────────────────────────────────────────────────────────
const summary = {
  total: results.length + failures.length,
  passed: results.length,
  failed: failures.length,
  results,
  failures,
};
fs.writeFileSync(
  path.join(out, 'summary.json'),
  JSON.stringify(summary, null, 2),
);
console.log(`\n${results.length} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
