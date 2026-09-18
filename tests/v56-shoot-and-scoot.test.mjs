import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  refreshVision,
  setOrder,
} from '../game/engine.ts';

const DT = 1 / 60;
const out = path.resolve('output/v56-shoot-and-scoot-qa');
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

function arena() {
  const s = createGame(56014);
  startGame(s);
  s.terrain.fill(374);
  s.original.fill(374);
  s.walls = [];
  s.scenery = [];
  s.players[1].deck = [];
  s.players[1].discard = [];
  s.players[1].hand = [];
  s.players[1].energy = 0;
  // Keep the AI director out of the scenario: updateAI() rewrites
  // players[1].order every tick, which would clobber the exact advance/hold
  // orders these checks need to hold steady.
  s.aiIn = 1e9;
  return s;
}

function squad(s, side, id, x) {
  const at = s.units.length;
  spawnUnit(s, side, id, x);
  return s.units.slice(at);
}

// Flat arena: side 1 mortar team at 2800, side 0 rifle squad at 2400.
// 400px separation: inside mortar range (180-820), outside rifle range
// (380), outside mortar minRange (180) so no close-threat retreat. The
// rifle squad is immortal and silenced so it never shoots back or dies;
// the mortar team is on advance so shoot-and-scoot can trigger once the
// enemy sound-ranging fix matures (hits >= 2).
function scene() {
  const s = arena();
  const mortars = squad(s, 1, 'mortar', 2800);
  const rifles = squad(s, 0, 'infantry', 2400);
  setOrder(s, 0, 'hold');
  setOrder(s, 1, 'advance');
  for (const m of mortars) {
    m.cooldown = 0;
    m.decisionIn = 1e6;
  }
  for (const r of rifles) {
    r.cooldown = 1e6;
    r.decisionIn = 1e6;
    r.hp = 99999;
    r.maxHp = 99999;
  }
  refreshVision(s);
  return { s, mortars, rifles };
}

function run(s, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) tick(s, DT);
}

// --- Displacement trigger ---

check('a located mortar team displaces at least 140px after two shots', () => {
  const { s, mortars } = scene();
  const startX = mortars.map((m) => m.x);
  // Crews displace at a crouch walk (~23px/s); the last member triggers
  // around t=7s and needs ~8s to cover its 150-222px fallback.
  run(s, 18);
  const deltas = mortars.map((m, j) => m.x - startX[j]);
  assert.ok(
    deltas.every((d) => d >= 140),
    `every crew member displaced >= 140px, got [${deltas.map((d) => d.toFixed(0)).join(', ')}]`,
  );
  return { deltas: deltas.map((d) => +d.toFixed(0)) };
});

check('displacement is away from the enemy and stays inside mortar range', () => {
  const { s, mortars } = scene();
  const startX = mortars.map((m) => m.x);
  run(s, 18);
  // Side 1 fights toward -x, so "away from the enemy" is +x.
  assert.ok(
    mortars.every((m, j) => m.x > startX[j]),
    'every member moved toward their own baseline (+x for side 1)',
  );
  // Rifles sit at 2400; after a 150-222px displacement the gap is
  // 550-622px, still well inside the 820 max range.
  assert.ok(
    mortars.every((m) => m.x - 2400 <= 820),
    'the team did not displace out of its own firing range',
  );
  return { finalX: mortars.map((m) => +m.x.toFixed(0)) };
});

check('the team resumes firing after reaching the new position', () => {
  const { s, mortars } = scene();
  run(s, 6);
  const shotsMid = mortars.reduce((a, m) => a + m.shots, 0);
  run(s, 12);
  const shotsEnd = mortars.reduce((a, m) => a + m.shots, 0);
  assert.ok(shotsMid > 0, `the team fired before displacing (${shotsMid} shots)`);
  assert.ok(
    shotsEnd > shotsMid,
    `firing resumed after displacement: ${shotsMid} -> ${shotsEnd} shots`,
  );
  return { shotsMid, shotsEnd };
});

// --- Hold order suppresses displacement ---

check('a hold order keeps the battery in place despite a mature fix', () => {
  const { s, mortars } = scene();
  setOrder(s, 1, 'hold');
  const startX = mortars.map((m) => m.x);
  run(s, 15);
  assert.ok(
    mortars.every((m, j) => Math.abs(m.x - startX[j]) <= 2),
    `held battery did not displace: [${mortars.map((m, j) => (m.x - startX[j]).toFixed(1)).join(', ')}]`,
  );
  const shots = mortars.reduce((a, m) => a + m.shots, 0);
  assert.ok(shots >= 6, `the held battery kept firing (${shots} shots)`);
  return { shots, drift: mortars.map((m, j) => +(m.x - startX[j]).toFixed(1)) };
});

// --- Static emplacements never displace ---

check('a static field howitzer never displaces, even when located', () => {
  const s = arena();
  const guns = squad(s, 1, 'artillery', 2800);
  // 300px gap: inside the howitzer's 390 sight so it acquires a target,
  // above its 280 minRange so the dead-zone retreat does not kick in.
  const rifles = squad(s, 0, 'infantry', 2500);
  setOrder(s, 0, 'hold');
  setOrder(s, 1, 'hold');
  for (const g of guns) {
    g.cooldown = 0;
    g.decisionIn = 1e6;
  }
  for (const r of rifles) {
    r.cooldown = 1e6;
    r.decisionIn = 1e6;
    r.hp = 99999;
    r.maxHp = 99999;
  }
  refreshVision(s);
  const startX = guns[0].x;
  let goalEverSet = false;
  for (let i = 0; i < 20 * 60; i++) {
    tick(s, DT);
    if (guns.some((g) => g.displaceGoal != null)) goalEverSet = true;
  }
  assert.ok(!goalEverSet, 'no displaceGoal was ever assigned to a static gun');
  assert.ok(Math.abs(guns[0].x - startX) <= 2, 'the howitzer stayed emplaced');
  assert.ok(guns[0].shots > 0, `the howitzer fired (${guns[0].shots} shots), exercising the trigger path`);
  return { shots: guns[0].shots, drift: +(guns[0].x - startX).toFixed(1) };
});

// --- The cat-and-mouse loop: a fresh fix grows on the new position ---

check('fire from the new position grows a fresh sound-ranging fix there', () => {
  const { s, mortars } = scene();
  run(s, 18);
  const mature = s.batteryReports.filter(
    (r) => r.side === 0 && r.hits >= 2,
  );
  assert.ok(mature.length >= 2, `at least two mature fixes existed (old + new), got ${mature.length}`);
  const nearNew = mature.some((r) =>
    mortars.some((m) => Math.abs(r.x - m.x) < r.scatter + 100),
  );
  assert.ok(
    nearNew,
    'a mature fix sits on the displaced position, ready for the next counter-battery cycle',
  );
  return {
    reports: mature.map((r) => ({ hits: r.hits, x: +r.x.toFixed(0) })),
    mortarX: mortars.map((m) => +m.x.toFixed(0)),
  };
});

// --- Cooldown ---

check('displacement sets a ~9s cooldown before the gun can displace again', () => {
  const { s, mortars } = scene();
  const startX = mortars.map((m) => m.x);
  let firstTriggerAt = null;
  let cooldownSpan = null;
  for (let i = 0; i < 20 * 60; i++) {
    tick(s, DT);
    if (firstTriggerAt === null) {
      const m = mortars.find((mm) => mm.displaceGoal != null);
      if (m) {
        firstTriggerAt = s.time;
        cooldownSpan = (m.displaceUntil ?? 0) - s.time;
      }
    }
  }
  assert.ok(firstTriggerAt !== null, 'a displacement triggered');
  assert.ok(
    cooldownSpan >= 8.5 && cooldownSpan <= 9.5,
    `cooldown span is ~9s, got ${cooldownSpan?.toFixed(2)}s`,
  );
  // No member should have completed two full displacements (>= 290px net)
  // before the cooldown plus a second move could elapse (~14s).
  assert.ok(
    mortars.every((m, j) => m.x - startX[j] < 290 || s.time > 14),
    'no member double-displaced inside the cooldown window',
  );
  return { firstTriggerAt: +firstTriggerAt.toFixed(2), cooldownSpan: +cooldownSpan.toFixed(2) };
});

fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`\n${results.length} checks, ${failures.length} failures`);
if (failures.length) process.exit(1);
