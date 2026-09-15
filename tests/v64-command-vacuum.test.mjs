import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  squadInVacuum,
  squadRoleOffset,
  COMMAND_VACUUM_DURATION,
} from '../game/engine.ts';

const DT = 1 / 60;
const out = path.resolve('output/v64-command-vacuum-qa');
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
  const s = createGame(64031);
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

function squad(s, side, id, x) {
  const at = s.units.length;
  spawnUnit(s, side, id, x);
  return s.units.slice(at);
}

function run(s, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) tick(s, DT);
}

/** Lowest-uid living combatant is the squad leader. */
function leaderOf(mates) {
  const living = mates.filter((v) => v.hp > 0);
  let leader = living[0];
  for (const m of living) if (m.uid < leader.uid) leader = m;
  return leader;
}

// ── 1. Leader death opens a command vacuum ──────────────────
check('组长阵亡后班组进入指挥真空', () => {
  const s = arena();
  const grunts = squad(s, 0, 'infantry', 400);
  // Let the squad command tracker initialise.
  run(s, 0.5);
  assert.ok(!squadInVacuum(s, 0, grunts[0].squad), '组长存活时不应有真空');
  const leader = leaderOf(grunts);
  leader.hp = 0;
  run(s, 0.1);
  assert.ok(
    squadInVacuum(s, 0, grunts[0].squad),
    '组长阵亡后应进入指挥真空',
  );
});

// ── 2. Non-leader death does NOT open a vacuum ──────────────
check('普通队员阵亡不触发指挥真空', () => {
  const s = arena();
  const grunts = squad(s, 0, 'infantry', 400);
  run(s, 0.5);
  const leader = leaderOf(grunts);
  const follower = grunts.find((v) => v.uid !== leader.uid);
  follower.hp = 0;
  run(s, 0.1);
  assert.ok(
    !squadInVacuum(s, 0, grunts[0].squad),
    '普通队员阵亡不应触发真空',
  );
});

// ── 3. Vacuum expires and successor takes over ──────────────
check('真空持续时间结束后副队长接替', () => {
  const s = arena();
  const grunts = squad(s, 0, 'infantry', 400);
  run(s, 0.5);
  const leader = leaderOf(grunts);
  leader.hp = 0;
  run(s, 0.1);
  assert.ok(squadInVacuum(s, 0, grunts[0].squad), '应处于真空');
  // Run past the vacuum window.
  run(s, COMMAND_VACUUM_DURATION + 0.5);
  assert.ok(
    !squadInVacuum(s, 0, grunts[0].squad),
    '真空结束后应恢复指挥',
  );
  // The new leader is the next-lowest-uid survivor.
  const survivors = grunts.filter((v) => v.hp > 0);
  const newLeader = leaderOf(survivors);
  assert.ok(newLeader.uid !== leader.uid, '应有新组长接替');
});

// ── 4. Suppression recovery is slower during vacuum ─────────
check('真空期间压制恢复减慢', () => {
  const s = arena();
  const grunts = squad(s, 0, 'infantry', 400);
  run(s, 0.5);
  // Baseline: no vacuum, suppression decays at full rate.
  const probe = grunts[0];
  probe.suppression = 80;
  run(s, 1.0);
  const baselineDecay = 80 - probe.suppression;
  assert.ok(baselineDecay > 0, '基线应有压制恢复');

  // Now trigger vacuum and measure again.
  const s2 = arena();
  const grunts2 = squad(s2, 0, 'infantry', 400);
  run(s2, 0.5);
  const leader2 = leaderOf(grunts2);
  leader2.hp = 0;
  run(s2, 0.1);
  assert.ok(squadInVacuum(s2, 0, grunts2[0].squad), '应处于真空');
  const probe2 = grunts2.find((v) => v.hp > 0);
  probe2.suppression = 80;
  run(s2, 1.0);
  const vacuumDecay = 80 - probe2.suppression;
  assert.ok(
    vacuumDecay < baselineDecay * 0.8,
    `真空期间压制恢复应显著减慢 (基线=${baselineDecay.toFixed(1)}, 真空=${vacuumDecay.toFixed(1)})`,
  );
});

// ── 5. Bounding overwatch freezes during vacuum ─────────────
check('真空期间交替掩护冻结', () => {
  const s = arena();
  const grunts = squad(s, 0, 'infantry', 400);
  run(s, 0.5);
  const survivors = grunts.filter((v) => v.hp > 0);
  const offsetBefore = squadRoleOffset(s, survivors[0], survivors);
  // Force the rotation cadence to be due. (run() alone never calls
  // squadRoleOffset, so a 6s gap would look like a fresh engagement and
  // re-clock the rotation timer instead of rotating.)
  const rec = s.squadManeuver[survivors[0].squad];
  rec.lastRotate = s.time - 10;
  const offsetNormal = squadRoleOffset(s, survivors[0], survivors);
  assert.ok(
    offsetNormal > offsetBefore,
    '正常情况下交替掩护应轮换',
  );

  // Now trigger vacuum and check the offset stays frozen.
  const s2 = arena();
  const grunts2 = squad(s2, 0, 'infantry', 400);
  run(s2, 0.5);
  const leader2 = leaderOf(grunts2);
  leader2.hp = 0;
  run(s2, 0.1);
  const survivors2 = grunts2.filter((v) => v.hp > 0);
  const offsetVacuumStart = squadRoleOffset(s2, survivors2[0], survivors2);
  // Same force-due setup, but this time the squad is leaderless.
  const rec2 = s2.squadManeuver[survivors2[0].squad];
  rec2.lastRotate = s2.time - 10;
  const offsetVacuumEnd = squadRoleOffset(s2, survivors2[0], survivors2);
  assert.ok(
    offsetVacuumEnd === offsetVacuumStart,
    '真空期间交替掩护应冻结不轮换',
  );
});

// ── 6. Units carry the vacuum flag for animation ────────────
check('真空期间单位带有 vacuum 标志', () => {
  const s = arena();
  const grunts = squad(s, 0, 'infantry', 400);
  run(s, 0.5);
  assert.ok(!grunts[0].vacuum, '正常时不应有 vacuum 标志');
  const leader = leaderOf(grunts);
  leader.hp = 0;
  run(s, 0.1);
  const survivor = grunts.find((v) => v.hp > 0);
  assert.ok(survivor.vacuum, '真空期间幸存单位应有 vacuum 标志');
});

// ── 7. Vacuum only affects the leaderless squad ─────────────
check('真空只影响失去组长的班组', () => {
  const s = arena();
  const a = squad(s, 0, 'infantry', 300);
  const b = squad(s, 0, 'infantry', 700);
  run(s, 0.5);
  const leaderA = leaderOf(a);
  leaderA.hp = 0;
  run(s, 0.1);
  assert.ok(squadInVacuum(s, 0, a[0].squad), 'A 班组应真空');
  assert.ok(!squadInVacuum(s, 0, b[0].squad), 'B 班组不应受影响');
});

// ── Summary ─────────────────────────────────────────────────
const summary = {
  feature: 'v64-command-vacuum',
  passed: results.length,
  failed: failures.length,
  checks: results.map((r) => r.name),
};
fs.writeFileSync(
  path.join(out, 'summary.json'),
  JSON.stringify(summary, null, 2),
);
console.log('\n=== v64 指挥真空 ===');
console.log(`通过 ${results.length} / ${results.length + failures.length}`);
if (failures.length) {
  console.error('失败项:');
  for (const f of failures) console.error(' -', f.name);
  process.exit(1);
}
