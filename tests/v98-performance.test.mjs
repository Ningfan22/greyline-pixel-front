import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  W,
} from '../game/engine.ts';
import { buildSquadIndex, squadMates } from '../game/spatial.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const engineSrc = fs.readFileSync(
  path.join(here, '../game/engine.ts'),
  'utf8',
);

const DT = 1 / 60;
const results = [],
  failures = [];
function check(name, fn) {
  if (
    process.env.TEST_FILTER &&
    !new RegExp(process.env.TEST_FILTER).test(name)
  )
    return;
  try {
    const details = fn();
    results.push({ name, ...details });
    console.log('PASS', name, JSON.stringify(details ?? {}));
  } catch (e) {
    failures.push({ name, error: e.stack });
    console.error('FAIL', name, e.stack);
  }
}

// --- source guard: no per-unit full same-squad scans remain -----------------

check('engine source: no v.squad === u.squad full scans; squadMates used widely', () => {
  assert.ok(
    !engineSrc.includes('v.squad === u.squad'),
    'a per-unit same-squad full scan remains in engine.ts',
  );
  const calls = engineSrc.match(/squadMates\(/g)?.length ?? 0;
  assert.ok(calls >= 11, `expected >= 11 squadMates call sites, found ${calls}`);
  return { squadMatesCallSites: calls };
});

// --- large-battle fixture ----------------------------------------------------

function bigBattle(cardsPerSide, seed = 98001) {
  const s = createGame(seed);
  startGame(s);
  Object.assign(s, { scenery: [], walls: [], wrecks: [] });
  for (let i = 0; i < cardsPerSide; i++) {
    // Stagger the spawn columns so 6-man squads do not stack on one pixel.
    spawnUnit(s, 0, 'infantry', 420 + (i % 12) * 78);
    spawnUnit(s, 1, 'infantry', W - 420 - (i % 12) * 78);
  }
  return s;
}

// --- index consistency at scale ----------------------------------------------

check('squadMates index agrees with brute-force filter after 60 ticks of a 288-unit battle', () => {
  const s = bigBattle(24);
  for (let t = 0; t < 60; t++) tick(s, DT);
  // The engine rebuilds the index at tick start; rebuild from live units so
  // units removed during the last tick do not false-fail the comparison.
  s.squadIndex = buildSquadIndex(s.units);
  assert.ok(s.units.length > 100, `expected a large live army, got ${s.units.length}`);
  const pairs = new Set(s.units.map((v) => `${v.side}:${v.squad}`));
  assert.ok(pairs.size >= 40, `expected >= 40 squads, got ${pairs.size}`);
  for (const key of pairs) {
    const [side, squad] = key.split(':').map(Number);
    const indexed = new Set(squadMates(s, side, squad));
    const filtered = new Set(
      s.units.filter((v) => v.side === side && v.squad === squad),
    );
    assert.equal(indexed.size, filtered.size, `squad ${key} size`);
    for (const v of filtered) assert.ok(indexed.has(v), `squad ${key} member`);
  }
  return { liveUnits: s.units.length, squads: pairs.size, ticks: 60 };
});

// --- performance: tick cost and scaling (informational) ----------------------

function measure(cardsPerSide) {
  const s = bigBattle(cardsPerSide);
  // Warm up 10 ticks so spawn/settle noise does not skew the sample.
  for (let t = 0; t < 10; t++) tick(s, DT);
  const t0 = performance.now();
  const sampleTicks = 30;
  for (let t = 0; t < sampleTicks; t++) tick(s, DT);
  const elapsed = performance.now() - t0;
  return {
    cardsPerSide,
    units: s.units.length,
    avgTickMs: elapsed / sampleTicks,
  };
}

check('large-battle tick cost stays bounded; 12 vs 24 card scaling is informational', () => {
  const small = measure(12);
  const big = measure(24);
  // Doubling the army must not multiply tick cost by more than 4x — the
  // squad lookups are O(squad) now, so scaling should be near-linear.
  assert.ok(
    big.avgTickMs < small.avgTickMs * 4,
    `tick cost scaled super-linearly: ${small.avgTickMs.toFixed(2)}ms -> ${big.avgTickMs.toFixed(2)}ms`,
  );
  console.log(
    `INFO 12 cards/side: ${small.avgTickMs.toFixed(2)}ms/tick (${small.units} units); ` +
      `24 cards/side: ${big.avgTickMs.toFixed(2)}ms/tick (${big.units} units); ` +
      `ratio ${(big.avgTickMs / small.avgTickMs).toFixed(2)}x`,
  );
  return {
    smallAvgTickMs: Number(small.avgTickMs.toFixed(3)),
    bigAvgTickMs: Number(big.avgTickMs.toFixed(3)),
    scalingRatio: Number((big.avgTickMs / small.avgTickMs).toFixed(2)),
  };
});

// --- summary ------------------------------------------------------------------

console.log(
  `\nv98 performance: ${results.length} checks, ${failures.length} failures`,
);
if (failures.length) {
  for (const f of failures) console.error(f.name, f.error);
  process.exit(1);
}
