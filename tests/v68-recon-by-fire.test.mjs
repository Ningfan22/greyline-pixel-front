import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
} from '../game/engine.ts';
import { suppressNearMiss } from '../game/projectile-depth.ts';

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

// Flat arena with no walls/scenery and the AI brain disabled so recon-by-fire
// geometry is fully deterministic.
function arena() {
  const s = createGame(68014);
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

function run(s, seconds) {
  const frames = Math.round(seconds / DT);
  const fired = [];
  for (let i = 0; i < frames; i++) {
    const before = s.projectiles.length;
    tick(s, DT);
    // Recon rounds impact and are culled within a few frames, and projectile
    // objects are mutated after spawn (targetUid clears when the target dies),
    // so snapshot the relevant fields at spawn time.
    for (const p of s.projectiles.slice(before))
      fired.push({
        sourceUid: p.sourceUid,
        targetUid: p.targetUid,
        base: p.base,
        tracer: p.tracer,
        startLane: p.startLane,
        targetLane: p.targetLane,
        tx: p.tx,
      });
  }
  return fired;
}

function grunt(s, side = 1, x = 400) {
  // Spawn a single member via cargo so the unit sits exactly at x and the
  // squad has no other live members that would steal the recon target.
  const before = s.units.length;
  spawnUnit(s, side, 'infantry', x, { member: 0 });
  return s.units[before];
}

// Give a soldier a fresh last-known contact and the combat state that
// justifies probing fire, with no live enemy visible.
function primeRecon(s, u, threatX = 500) {
  // reconMemory (not lastThreat) drives probing fire: the morale pass clears
  // lastThreat once contact is lost, but reconMemory persists until it ages out.
  u.reconMemory = { x: threatX, y: 374, until: s.time + 3 };
  u.suppression = 50;
  // The engine reads the player/squad order, not u.order; hold keeps the
  // soldier stationary so the seeking gate does not block the burst.
  s.players[0].order = 'hold';
  u.coverGoal = null;
  u.firingGoal = null;
  u.dispersionGoal = undefined;
}

function reconShots(fired, u) {
  return fired.filter(
    (p) => p.sourceUid === u.uid && p.targetUid === null && p.base === null,
  );
}

// --- core trigger -------------------------------------------------------------

test('infantry with fresh lastThreat and no visible target fires recon by fire', () => {
  const s = arena();
  const enemy = grunt(s, 1, 500);
  enemy.hp = 0; // dead → not a candidate, but lastThreat stays fresh
  const u = grunt(s, 0, 200);
  primeRecon(s, u);
  const fired = run(s, 0.5);
  assert.ok(reconShots(fired, u).length >= 1, 'expected a recon-by-fire projectile');
});

test('recon-by-fire projectile carries lanes for suppression', () => {
  const s = arena();
  const enemy = grunt(s, 1, 500);
  enemy.hp = 0;
  const u = grunt(s, 0, 200);
  primeRecon(s, u);
  const fired = run(s, 0.5);
  const recon = reconShots(fired, u);
  assert.ok(recon.length >= 1, 'expected a recon-by-fire projectile');
  for (const p of recon) {
    assert.ok(p.startLane !== undefined, 'expected startLane set');
    assert.ok(p.targetLane !== undefined, 'expected targetLane set');
  }
});

// --- throttle ------------------------------------------------------------------

test('recon-by-fire is throttled by reconFireNextAt', () => {
  const s = arena();
  const enemy = grunt(s, 1, 500);
  enemy.hp = 0;
  const u = grunt(s, 0, 200);
  primeRecon(s, u);
  const fired = run(s, 0.5);
  assert.ok(reconShots(fired, u).length >= 1, 'expected at least one recon shot');
  assert.ok(
    (u.reconFireNextAt ?? 0) > s.time,
    'expected reconFireNextAt set in the future',
  );
  // Run a short window — the throttle blocks a second burst.
  s.projectiles.length = 0;
  const fired2 = run(s, 0.5);
  assert.ok(
    reconShots(fired2, u).length === 0,
    'expected no immediate second recon burst',
  );
});

// --- gating --------------------------------------------------------------------

test('recon-by-fire does not fire when threat is out of range', () => {
  const s = arena();
  const enemy = grunt(s, 1, 900);
  enemy.hp = 0;
  const u = grunt(s, 0, 200);
  primeRecon(s, u, 900);
  const fired = run(s, 0.5);
  assert.ok(reconShots(fired, u).length === 0, 'expected no recon fire out of range');
});

test('recon-by-fire does not fire when threat is behind', () => {
  const s = arena();
  const enemy = grunt(s, 1, 100);
  enemy.hp = 0;
  const u = grunt(s, 0, 200);
  primeRecon(s, u, 100); // side 0 faces right; threat is to the left
  const fired = run(s, 0.5);
  assert.ok(reconShots(fired, u).length === 0, 'expected no recon fire at a rear threat');
});

test('recon-by-fire does not fire when a visible target exists', () => {
  const s = arena();
  const enemy = grunt(s, 1, 500); // alive → visible candidate
  const u = grunt(s, 0, 200);
  primeRecon(s, u);
  const fired = run(s, 0.5);
  assert.ok(
    reconShots(fired, u).length === 0,
    'expected no recon fire when a visible target exists',
  );
  const aimed = fired.find(
    (p) => p.sourceUid === u.uid && p.targetUid === enemy.uid,
  );
  assert.ok(aimed, 'expected aimed fire at the visible target instead');
});

test('recon-by-fire does not damage the enemy base', () => {
  const s = arena();
  const enemy = grunt(s, 1, 500);
  enemy.hp = 0;
  const u = grunt(s, 0, 200);
  primeRecon(s, u);
  const baseHpBefore = s.players[1].hp;
  run(s, 1.0);
  assert.ok(
    s.players[1].hp === baseHpBefore,
    'expected enemy base to take no damage from recon fire',
  );
});

// --- visuals -------------------------------------------------------------------

test('recon-by-fire produces tracer rounds', () => {
  const s = arena();
  const enemy = grunt(s, 1, 500);
  enemy.hp = 0;
  const u = grunt(s, 0, 200);
  primeRecon(s, u);
  const fired = run(s, 1.0);
  const tracers = reconShots(fired, u).filter((p) => p.tracer);
  assert.ok(tracers.length > 0, 'expected at least one tracer round');
});

// --- suppression via lanes ------------------------------------------------------

test('recon-by-fire lanes let suppressNearMiss suppress enemies near impact', () => {
  const s = arena();
  const enemy = grunt(s, 1, 500);
  const before = enemy.suppression;
  const p = {
    uid: 9001,
    side: 0,
    damage: 10,
    startX: 200,
    tx: 500,
    startLane: enemy.lane,
    targetLane: enemy.lane,
    ammunition: 'rifle',
  };
  suppressNearMiss(s, p, 200, enemy.y - 36, 500, enemy.y - 36);
  assert.ok(
    enemy.suppression > before,
    'expected enemy suppression to increase from near-miss',
  );
});

// --- results --------------------------------------------------------------------

const passed = results.filter((r) => r.ok).length;
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
