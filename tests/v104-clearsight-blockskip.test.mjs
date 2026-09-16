import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { clearSight } from '../game/world.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const worldSrc = fs.readFileSync(path.join(here, '../game/world.ts'), 'utf8');

const results = [],
  failures = [];
function check(name, fn) {
  try {
    const details = fn();
    results.push({ name, ...details });
    console.log('PASS', name, JSON.stringify(details ?? {}));
  } catch (e) {
    failures.push({ name, error: e.stack });
    console.log('FAIL', name, e.message);
  }
}

// Exact pre-v104 per-sample march; the block-skipping version must agree
// with it on every query.
function refClearSight(s, sx, sy, tx, ty, throughSmoke = false) {
  const steps = Math.ceil(Math.abs(tx - sx) / 12);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const gx = Math.max(
      0,
      Math.min(s.terrain.length - 1, Math.floor(sx + (tx - sx) * t)),
    );
    if (sy + (ty - sy) * t >= s.terrain[gx] - 2) return false;
  }
  if (
    !throughSmoke &&
    s.smokes.some(
      (f) =>
        f.life > 0 &&
        f.x + 95 > Math.min(sx, tx) &&
        f.x - 95 < Math.max(sx, tx),
    ) &&
    Math.abs(tx - sx) > 140
  )
    return false;
  return true;
}

let seed = 987654321;
function rand() {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
}

const L = 3840;
const profiles = {
  flat: () => new Array(L).fill(300),
  hills: () =>
    Array.from({ length: L }, (_, x) => 300 + Math.sin(x / 150) * 90 + Math.sin(x / 57) * 25),
  cratered: () => {
    const t = Array.from({ length: L }, (_, x) => 300 + Math.sin(x / 200) * 60);
    for (let c = 0; c < 12; c++) {
      const cx = Math.floor(rand() * L),
        r = 40 + Math.floor(rand() * 80);
      for (let x = Math.max(0, cx - r); x < Math.min(L, cx + r); x++) {
        const d = Math.abs(x - cx) / r;
        t[x] += 28 * d * d;
      }
    }
    return t;
  },
};

check('clearSight block-skipping matches the per-sample march on every terrain profile', () => {
  let total = 0,
    mismatches = 0;
  for (const gen of Object.values(profiles)) {
    const s = { terrain: gen(), terrainVersion: 1, smokes: [], units: [] };
    for (let trial = 0; trial < 20000; trial++) {
      const sx = rand() * L,
        tx = rand() * L,
        sy = 100 + rand() * 350,
        ty = 100 + rand() * 350,
        throughSmoke = rand() < 0.3;
      if (
        clearSight(s, sx, sy, tx, ty, throughSmoke) !==
        refClearSight(s, sx, sy, tx, ty, throughSmoke)
      )
        mismatches++;
      total++;
    }
    s.smokes = [{ life: 5, x: 1900 }];
    for (let trial = 0; trial < 5000; trial++) {
      const sx = rand() * L,
        tx = rand() * L,
        sy = 100 + rand() * 350,
        ty = 100 + rand() * 350;
      if (clearSight(s, sx, sy, tx, ty) !== refClearSight(s, sx, sy, tx, ty))
        mismatches++;
      total++;
    }
  }
  assert.equal(mismatches, 0, `${mismatches}/${total} queries disagreed`);
  return { queries: total };
});

check('clearSight stays fast on flat ground (block skip actually triggers)', () => {
  const s = { terrain: new Array(L).fill(300), terrainVersion: 1, smokes: [], units: [] };
  // Warm the minima cache.
  clearSight(s, 10, 200, 3830, 200);
  const N = 20000;
  const t0 = process.hrtime.bigint();
  let blocked = 0;
  for (let i = 0; i < N; i++) {
    const sx = rand() * L,
      tx = rand() * L;
    if (!clearSight(s, sx, 200, tx, 200)) blocked++;
  }
  const us = Number(process.hrtime.bigint() - t0) / 1000 / N;
  // Pre-v104 this was ~0.48us per call on flat ground; the block walk must
  // stay well under the old per-sample cost.
  assert.ok(us < 0.25, `expected <0.25us per call, got ${us.toFixed(3)}us`);
  return { microsecondsPerCall: Number(us.toFixed(3)), blocked };
});

check('world.ts wires clearSight through the shared terrain minima cache', () => {
  assert.match(worldSrc, /terrainMinima/);
  assert.match(worldSrc, /minimum - 2/);
});

console.log(`\nv104 clearSight block-skip: ${results.length} checks, ${failures.length} failures`);
process.exit(failures.length ? 1 : 0);
