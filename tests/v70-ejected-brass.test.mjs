import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  emitParticle,
  ground,
} from '../game/engine.ts';

const DT = 1 / 60;
const out = path.resolve('output/v70-ejected-brass-qa');
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
  const s = createGame(70014);
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

function single(s, side, id, x, member = 0) {
  const before = s.units.length;
  spawnUnit(s, side, id, x, { member });
  return s.units[before];
}

function grunt(s, side, x) {
  return single(s, side, 'infantry', x, 0);
}

// Invincible, silent enemy that never fires or moves.
function silentFoe(s, side, x) {
  const v = grunt(s, side, x);
  v.cooldown = 1e6;
  v.decisionIn = 1e6;
  v.hp = 99999;
  v.maxHp = 99999;
  return v;
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

function casings(s) {
  return s.particles.filter((p) => p.kind === 'casing');
}

// Drop a casing straight into the particle system for deterministic physics.
function dropCasing(s, x, y, vx, vy, life = 5) {
  emitParticle(s, {
    kind: 'casing',
    x,
    y,
    vx,
    vy,
    life,
    maxLife: life,
    color: '#c8a84e',
    size: 1,
  });
  return s.particles[s.particles.length - 1];
}

// --- A. Emission ---------------------------------------------------------

check('步兵射击时抛出弹壳', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  silentFoe(s, 1, 350); // 250px, inside 380 rifle range
  runUntil(s, () => u.shots > 0, 5);
  assert.ok(u.shots > 0, 'rifleman fired');
  const cs = casings(s);
  assert.ok(cs.length > 0, 'at least one casing ejected');
  return { shots: u.shots, casings: cs.length };
});

check('机枪班组射击时也抛壳', () => {
  const s = arena();
  const at = s.units.length;
  spawnUnit(s, 0, 'machinegun', 100);
  const squad = s.units.slice(at);
  // shots is seeded with the member index at spawn, so track the delta.
  const base = squad.map((u) => u.shots);
  silentFoe(s, 1, 450); // inside 500 mg range
  runUntil(s, () => squad.some((u, i) => u.shots > base[i]), 6);
  assert.ok(
    squad.some((u, i) => u.shots > base[i]),
    'machinegun fired',
  );
  assert.ok(casings(s).length > 0, 'casing ejected');
  return { casings: casings(s).length };
});

check('弹壳寿命超过两秒，会在战场上残留', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  silentFoe(s, 1, 350);
  runUntil(s, () => u.shots > 0, 5);
  const cs = casings(s);
  assert.ok(cs.length > 0, 'casing present');
  assert.ok(cs.every((p) => p.maxLife >= 2), 'lingers at least 2s');
  return { maxLife: cs.map((p) => +p.maxLife.toFixed(2)) };
});

// --- B. Physics ----------------------------------------------------------

check('弹壳受重力加速下落', () => {
  const s = arena();
  const gy = ground(s, 500);
  const p = dropCasing(s, 500, gy - 100, 0, 10);
  run(s, 0.1);
  assert.ok(p.vy > 10 + 320 * 0.1 - 5, 'gravity accelerates the fall');
  return { vy: +p.vy.toFixed(1) };
});

check('弹壳落地后停在地面，不会穿入地下', () => {
  const s = arena();
  const gy = ground(s, 500);
  const p = dropCasing(s, 500, gy - 80, 0, 0);
  run(s, 1.5);
  assert.ok(p.y >= gy - 1, 'reached the ground');
  assert.ok(p.y <= gy + 0.5, 'rests on the surface, no sink');
  return { y: +p.y.toFixed(2), ground: gy, vy: +p.vy.toFixed(2) };
});

check('高速落地的弹壳会弹跳减速', () => {
  const s = arena();
  const gy = ground(s, 500);
  const p = dropCasing(s, 500, gy - 5, 0, 120);
  let bounced = false;
  for (let i = 0; i < 120; i++) {
    tick(s, DT);
    if (p.vy < 0) {
      bounced = true;
      break;
    }
  }
  assert.ok(bounced, 'casing bounced upward off the dirt');
  return { vyAfterBounce: +p.vy.toFixed(1) };
});

check('微风推动静止弹壳沿地面漂移', () => {
  const s = arena();
  s.wind = 12;
  const gy = ground(s, 500);
  const p = dropCasing(s, 500, gy, 0, 0);
  run(s, 1.0);
  assert.ok(p.x > 500 + 2, 'wind drifts the casing downwind');
  return { x: +p.x.toFixed(2), drift: +(p.x - 500).toFixed(2) };
});

check('弹壳寿命到期后从战场消失', () => {
  const s = arena();
  const gy = ground(s, 500);
  dropCasing(s, 500, gy, 0, 0, 0.3);
  const before = s.particles.length;
  run(s, 0.5);
  assert.ok(s.particles.length < before, 'expired casing removed');
  assert.ok(!casings(s).length, 'no casings remain');
  return { before, after: s.particles.length };
});

// --- Report --------------------------------------------------------------

fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`\n${results.length} passed, ${failures.length} failed`);
if (failures.length) process.exit(1);
