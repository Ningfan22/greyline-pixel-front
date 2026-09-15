import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  coveringMate,
  isCombatant,
  CARDS,
  W,
} from '../game/engine.ts';
import {
  buildSpatial,
  buildSquadIndex,
  buildByUid,
  nearUnits,
  squadMates,
  unitByUid,
  QUERY_PAD,
  GRID_CELL,
} from '../game/spatial.ts';

const DT = 1 / 60;
const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}

// --- nearUnits: no unit within range may be missed -------------------------

test('nearUnits: every unit truly within range is a candidate', () => {
  const units = Array.from({ length: 300 }, (_, i) => ({
    uid: i + 1,
    x: Math.floor((i / 300) * W),
  }));
  const s = { units, spatial: buildSpatial(units, W) };
  let seed = 12345;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
  for (let trial = 0; trial < 400; trial++) {
    const x = rand() * W;
    const range = rand() * 1400;
    const out = new Set(nearUnits(s, x, range, []));
    for (const u of units) {
      if (Math.abs(u.x - x) <= range) {
        assert.ok(out.has(u), `missed unit at dx=${Math.abs(u.x - x)} range=${range}`);
      }
    }
    // Candidates never come from beyond one padded cell span.
    for (const u of out) {
      assert.ok(Math.abs(u.x - x) <= range + QUERY_PAD + GRID_CELL);
    }
  }
});

test('nearUnits: unit exactly on the range boundary is included', () => {
  const edge = { uid: 7, x: 1200 };
  const s = { units: [edge], spatial: buildSpatial([edge], W) };
  assert.ok(nearUnits(s, 1000, 200, []).includes(edge));
  // nearUnits is a padded candidate filter: a unit 200px away may still be a
  // candidate for a 100px query (the caller's exact check decides), but a
  // unit beyond the padded cell span must never be returned.
  assert.ok(nearUnits(s, 1000, 100, []).includes(edge));
  const far = { uid: 8, x: 2000 };
  const s2 = { units: [far], spatial: buildSpatial([far], W) };
  assert.ok(!nearUnits(s2, 1000, 100, []).includes(far));
});

test('nearUnits: falls back to a full scan without an index', () => {
  const units = [{ uid: 1, x: 10 }, { uid: 2, x: 3000 }];
  const out = nearUnits({ units }, 1500, 100, []);
  assert.equal(out.length, 2);
});

// --- unitByUid --------------------------------------------------------------

test('unitByUid: map hit, map miss fallback, and unknown uid', () => {
  const indexed = { uid: 1, x: 100 };
  const lateSpawn = { uid: 2, x: 200 };
  const s = { units: [indexed, lateSpawn], byUid: buildByUid([indexed]) };
  assert.equal(unitByUid(s, 1), indexed);
  assert.equal(unitByUid(s, 2), lateSpawn); // mid-tick spawn, map miss
  assert.equal(unitByUid(s, 99), undefined);
  assert.equal(unitByUid(s, undefined), undefined);
});

// --- frontX -----------------------------------------------------------------

function battleWithMix() {
  const s = createGame(47001);
  startGame(s);
  Object.assign(s, { scenery: [], walls: [], wrecks: [] });
  s.players.forEach((p) => (p.order = 'hold'));
  const ids = [
    'infantry', 'infantry', 'medic', 'machinegun', 'sniper',
    'rocket', 'mortar', 'recon', 'helicopter',
  ];
  for (let i = 0; i < 27; i++) {
    const id = ids[i % ids.length];
    spawnUnit(s, 0, id, 380 + (i % 14) * 90);
    spawnUnit(s, 1, id, 3460 - (i % 14) * 90);
  }
  return s;
}

test('frontX: max of friendly ground combatants, min of enemy, air excluded', () => {
  const s = battleWithMix();
  const expected = [650, W - 650];
  for (let side = 0; side < 2; side++) {
    const xs = s.units
      .filter((v) => v.side === side && isCombatant(v) && !CARDS[v.id].air)
      .map((v) => v.x);
    if (xs.length) {
      expected[side] = side === 0 ? Math.max(...xs) : Math.min(...xs);
    }
  }
  tick(s, DT);
  assert.ok(s.frontX, 'frontX built by tick');
  assert.ok(Math.abs(s.frontX[0] - expected[0]) < 1, `frontX[0] ${s.frontX[0]} vs ${expected[0]}`);
  assert.ok(Math.abs(s.frontX[1] - expected[1]) < 1, `frontX[1] ${s.frontX[1]} vs ${expected[1]}`);
});

test('frontX: empty battlefield falls back to 650 / W-650', () => {
  const s = createGame(99);
  startGame(s);
  s.players.forEach((p) => (p.order = 'hold'));
  tick(s, DT);
  assert.deepEqual(s.frontX, [650, W - 650]);
});

// --- squadMates --------------------------------------------------------------

test('squadMates: index matches a full side+squad filter', () => {
  const s = battleWithMix();
  for (let i = 0; i < 10; i++) tick(s, DT);
  s.squadIndex = buildSquadIndex(s.units);
  const pairs = new Set(s.units.map((v) => `${v.side}:${v.squad}`));
  assert.ok(pairs.size > 4, 'several squads on the field');
  for (const key of pairs) {
    const [side, squad] = key.split(':').map(Number);
    const indexed = new Set(squadMates(s, side, squad));
    const filtered = new Set(
      s.units.filter((v) => v.side === side && v.squad === squad),
    );
    assert.equal(indexed.size, filtered.size, `squad ${key} size`);
    for (const v of filtered) assert.ok(indexed.has(v), `squad ${key} member`);
  }
});

test('squadMates: fallback path filters live units', () => {
  const s = battleWithMix();
  tick(s, DT);
  const first = s.units[0];
  delete s.squadIndex;
  const mates = squadMates(s, first.side, first.squad);
  assert.ok(mates.every((v) => v.side === first.side && v.squad === first.squad));
  assert.ok(mates.includes(first));
});

// --- coveringMate: indexed path must match the full-scan fallback ------------

test('coveringMate: spatial index agrees with brute-force fallback', () => {
  const s = battleWithMix();
  let comparisons = 0;
  for (let t = 0; t < 24; t++) {
    tick(s, DT);
    const fighters = s.units.filter((v) => isCombatant(v) && !CARDS[v.id].air);
    for (const u of fighters) {
      // Nearest few enemies are the realistic targets; helicopters exercise
      // the airThreat / cross-squad AA cover branch.
      const enemies = s.units
        .filter((v) => v.side !== u.side && isCombatant(v))
        .sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))
        .slice(0, 4);
      for (const target of enemies) {
        // Rebuild fresh indexes from the current state: regroup can reassign
        // squads mid-tick, so the index built at tick start may be stale by
        // tick end (a harmless 1-tick delay in-game, but it would make this
        // brute-force comparison false-fail).
        s.spatial = buildSpatial(s.units, W);
        s.squadIndex = buildSquadIndex(s.units);
        const withIndex = coveringMate(s, u, target, t % 2 === 0);
        s.spatial = undefined;
        s.squadIndex = undefined;
        const fallback = coveringMate(s, u, target, t % 2 === 0);
        s.spatial = buildSpatial(s.units, W);
        s.squadIndex = buildSquadIndex(s.units);
        assert.equal(
          withIndex,
          fallback,
          `coveringMate mismatch tick=${t} uid=${u.uid} target=${target.uid}`,
        );
        comparisons++;
      }
    }
  }
  assert.ok(comparisons > 2000, `compared ${comparisons} pairs`);
});

// --- report ------------------------------------------------------------------

let failed = 0;
for (const r of results) {
  if (r.ok) console.log(`ok - ${r.name}`);
  else {
    failed++;
    console.error(`FAIL - ${r.name}: ${r.error}`);
  }
}
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
