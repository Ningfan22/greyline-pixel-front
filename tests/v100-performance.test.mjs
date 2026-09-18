import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  crater,
  W,
} from '../game/engine.ts';
import { heightfieldIntercept } from '../game/terrain-ray.ts';
import { squadFocus, squadSuppressionTarget } from '../game/focus-fire.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const engineSrc = fs.readFileSync(
  path.join(here, '../game/engine.ts'),
  'utf8',
);
const raySrc = fs.readFileSync(
  path.join(here, '../game/terrain-ray.ts'),
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

// --- source guards: terrain versioning is wired end to end ------------------

check('terrain-ray cache keys on s.terrainVersion, not s.time', () => {
  assert.ok(
    raySrc.includes('s.terrainVersion'),
    'terrain-ray minima cache must key on s.terrainVersion',
  );
  assert.ok(
    raySrc.includes('old.version === s.terrainVersion'),
    'minima cache must compare the stored version against s.terrainVersion',
  );
  return {};
});

check('crater bumps terrainVersion exactly once per blast', () => {
  const s = createGame(100101);
  assert.equal(s.terrainVersion, 0, 'fresh game starts at version 0');
  crater(s, 1500, 60);
  assert.equal(s.terrainVersion, 1, 'first crater bumps to 1');
  crater(s, 2200, 60);
  crater(s, 900, 60);
  assert.equal(s.terrainVersion, 3, 'two more craters bump to 3');
  return { version: s.terrainVersion };
});

// --- ray cache invalidation: a crater must flip a blocked ray to clear ------

check('heightfield ray reflects a fresh crater within the same tick', () => {
  const s = createGame(100102);
  startGame(s);
  // Flatten to a known surface (y grows downward; 374 is the ground line).
  s.terrain.fill(374);
  s.original.fill(374);
  // Ray at y=380 sits 6px below the 374 surface: blocked.
  const blocked = heightfieldIntercept(s, 1450, 380, 1550, 380);
  assert.ok(blocked, 'ray below the surface must hit ground');
  // Blast a crater deep enough that the whole ray window sits above the new
  // floor (depth 36, capped to MAX_CRATER_DEPTH=28 below original -> floor 402).
  crater(s, 1500, 75, 36);
  const clear = heightfieldIntercept(s, 1450, 380, 1550, 380);
  assert.equal(
    clear,
    null,
    'ray must pass over the crater after the terrain version bump',
  );
  return { blockedAt: blocked.x, version: s.terrainVersion };
});

// --- squad focus: per-tick memo and dead-target invalidation ----------------

function focusArena() {
  const s = createGame(100103);
  startGame(s);
  spawnUnit(s, 0, 'infantry', 380);
  spawnUnit(s, 1, 'scouts', 560);
  const squad = s.units.find((u) => u.side === 0).squad;
  s.visible[0] = s.units.map((u) => u.uid);
  return { s, squad };
}

check('squadFocus is memoized per tick and re-designates after a kill', () => {
  const { s, squad } = focusArena();
  const first = squadFocus(s, 0, squad, s.time);
  assert.notEqual(first, undefined, 'scout team must be designated');
  // Every squad member calls once per tick with identical inputs.
  for (let i = 0; i < 8; i++)
    assert.equal(
      squadFocus(s, 0, squad, s.time),
      first,
      `same-tick call ${i} must return the memoized uid`,
    );
  // Kill the designated team, then advance to the next tick.
  for (const u of s.units) if (u.side === 1) u.hp = 0;
  s.time += DT;
  const afterKill = squadFocus(s, 0, squad, s.time);
  assert.notEqual(
    afterKill,
    first,
    'dead uid must never be returned, even inside the sticky TTL',
  );
  assert.equal(afterKill, undefined, 'no valuable target left');
  // A new scout team arrives; next tick re-designates instead of staying empty.
  spawnUnit(s, 1, 'scouts', 760);
  s.visible[0] = s.units.map((u) => u.uid);
  s.time += DT;
  const second = squadFocus(s, 0, squad, s.time);
  assert.notEqual(second, undefined, 'fresh scout team must be designated');
  assert.ok(
    s.units.some((u) => u.uid === second && u.side === 1 && u.hp > 0),
    're-designated target must be a living enemy',
  );
  return { first, second };
});

check('squadSuppressionTarget is stable within a tick for the same focus', () => {
  const { s, squad } = focusArena();
  spawnUnit(s, 1, 'scouts', 760);
  s.visible[0] = s.units.map((u) => u.uid);
  const focus = squadFocus(s, 0, squad, s.time);
  const supp = squadSuppressionTarget(s, 0, squad, focus, s.time);
  for (let i = 0; i < 6; i++)
    assert.equal(
      squadSuppressionTarget(s, 0, squad, focus, s.time),
      supp,
      `same-tick suppression call ${i} must be memoized`,
    );
  return { focus, supp };
});

// --- long battle invariants --------------------------------------------------

function bigBattle(cardsPerSide, seed = 100104) {
  const s = createGame(seed);
  startGame(s);
  Object.assign(s, { scenery: [], walls: [], wrecks: [] });
  for (let i = 0; i < cardsPerSide; i++) {
    spawnUnit(s, 0, 'infantry', 420 + (i % 12) * 78);
    spawnUnit(s, 1, 'infantry', W - 420 - (i % 12) * 78);
  }
  return s;
}

check('288-unit battle stays numerically sane for 600 ticks', () => {
  const s = bigBattle(24);
  for (let t = 0; t < 600; t++) tick(s, DT);
  assert.ok(
    Math.abs(s.time - 600 * DT) < 1e-9,
    `time must advance exactly, got ${s.time}`,
  );
  assert.equal(s.status, 'playing', 'battle must not end in 10 seconds');
  assert.ok(s.units.length > 150, `army should mostly survive, got ${s.units.length}`);
  for (const u of s.units) {
    assert.ok(Number.isFinite(u.x) && Number.isFinite(u.y), `unit ${u.uid} left the field`);
    assert.ok(u.hp >= 0 && u.hp <= u.maxHp, `unit ${u.uid} hp out of range`);
  }
  return { liveUnits: s.units.length, time: s.time };
});

// --- summary ------------------------------------------------------------------

console.log(
  `\nv100 performance: ${results.length} checks, ${failures.length} failures`,
);
if (failures.length) {
  for (const f of failures) console.error(f.name, f.error);
  process.exit(1);
}
