import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  refreshVision,
} from '../game/engine.ts';
import { squadFocus, squadSuppressionTarget } from '../game/focus-fire.ts';

const DT = 1 / 60;
const out = path.resolve('output/v55-fireteam-distribution-qa');
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
  const s = createGame(55014);
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
  // players[1].order every tick, which would clobber the exact advance/rush
  // orders these checks need to hold steady.
  s.aiIn = 1e9;
  return s;
}

function spawn(s, side, id, x) {
  const at = s.units.length;
  spawnUnit(s, side, id, x);
  return s.units.slice(at);
}

// Flat arena: one 6-man rifle squad on side 1, one 3-man mortar team (the
// only positively-valuable enemy) on side 0. The enemy is made immortal and
// silent so the focus designation stays stable and nothing fires back.
// enemyX is parameterized: side 1 expands right from 2800 (up to 2990), so
// with the default 2500 the rear members sit beyond the 380 rifle range.
// 2620 puts the whole squad in range (2990 - 2620 = 370).
function battleScene(enemyX = 2500) {
  const s = arena();
  const squad = spawn(s, 1, 'infantry', 2800);
  const enemy = spawn(s, 0, 'mortar', enemyX);
  for (const v of enemy) {
    v.hp = 99999;
    v.maxHp = 99999;
    v.cooldown = 9999;
    // Pin the mortar team in place so the range geometry stays deterministic.
    v.squadOrder = 'hold';
    v.squadOrderUntil = 1e9;
  }
  refreshVision(s);
  return { s, squad, enemy, squadId: squad[0].squad };
}

// --- Unit level: the support team gets its own secondary target ---

check('squadSuppressionTarget designates a different visible enemy than the focus target', () => {
  const { s, squadId, enemy } = battleScene();
  const focusUid = squadFocus(s, 1, squadId, s.time);
  assert.notEqual(focusUid, undefined, 'a focus target must exist');
  const suppUid = squadSuppressionTarget(s, 1, squadId, focusUid, s.time);
  assert.notEqual(suppUid, undefined, 'a suppression target must exist');
  assert.notEqual(suppUid, focusUid, 'support target differs from focus target');
  assert.ok(
    enemy.some((v) => v.uid === suppUid),
    'suppression target is an enemy unit',
  );
  return { focusUid, suppUid };
});

check('squadSuppressionTarget returns undefined without a focus target', () => {
  const { s, squadId } = battleScene();
  assert.equal(
    squadSuppressionTarget(s, 1, squadId, undefined, s.time),
    undefined,
    'no focus means no support split',
  );
  return {};
});

check('depleted squads do not split off a support team', () => {
  const { s, squadId, squad } = battleScene();
  // Leave only 3 effective fighters: below SUPPRESSION_MIN_SQUAD (4).
  for (let i = 0; i < squad.length - 3; i++) squad[i].hp = 0;
  const focusUid = squadFocus(s, 1, squadId, s.time);
  assert.notEqual(focusUid, undefined, 'the squad still has a focus target');
  assert.equal(
    squadSuppressionTarget(s, 1, squadId, focusUid, s.time),
    undefined,
    'a 3-man squad keeps every rifle on the focus target',
  );
  return {};
});

// --- Integration: tracer fan-out across the enemy line ---

check('rifle fire distributes across the focus target and a secondary enemy', () => {
  const { s, squadId, squad } = battleScene(2620);
  // Hold: the whole squad is already inside rifle range, and staying put
  // keeps the range geometry deterministic for the full 3 seconds.
  s.players[1].order = 'hold';
  const focusUid = squadFocus(s, 1, squadId, s.time);
  const supportUids = new Set(
    squad.filter((u) => u.member % 3 === 1).map((u) => u.uid),
  );
  const shotsByTarget = new Map();
  let supportShotsOffFocus = 0;
  let supportShotsTotal = 0;
  for (let i = 0; i < 180; i++) {
    tick(s, DT);
    for (const p of s.projectiles) {
      if (p.side !== 1 || p.targetUid === null) continue;
      shotsByTarget.set(
        p.targetUid,
        (shotsByTarget.get(p.targetUid) ?? 0) + 1,
      );
      if (supportUids.has(p.sourceUid)) {
        supportShotsTotal++;
        if (p.targetUid !== focusUid) supportShotsOffFocus++;
      }
    }
    s.projectiles.length = 0;
  }
  const total = [...shotsByTarget.values()].reduce((a, b) => a + b, 0);
  assert.ok(total >= 10, `the squad must actually fight, got ${total} shots`);
  assert.ok(
    shotsByTarget.size >= 2,
    `fire must fan out to at least 2 enemies, got ${shotsByTarget.size}`,
  );
  const focusShots = shotsByTarget.get(focusUid) ?? 0;
  for (const [uid, n] of shotsByTarget) {
    if (uid === focusUid) continue;
    assert.ok(
      focusShots >= n,
      `focus target keeps the plurality: ${focusShots} vs ${n} on uid ${uid}`,
    );
  }
  assert.ok(
    supportShotsTotal >= 2,
    `the support team must fire, got ${supportShotsTotal} shots`,
  );
  assert.ok(
    supportShotsOffFocus >= 1,
    `support team shoots the secondary enemy, got ${supportShotsOffFocus}/${supportShotsTotal} off-focus`,
  );
  return {
    total,
    distinctTargets: shotsByTarget.size,
    focusShots,
    supportShotsTotal,
    supportShotsOffFocus,
  };
});

check('rush orders keep every rifle on the focus target', () => {
  const { s, squadId } = battleScene();
  s.players[1].order = 'rush';
  const focusUid = squadFocus(s, 1, squadId, s.time);
  const targets = new Set();
  for (let i = 0; i < 180; i++) {
    tick(s, DT);
    for (const p of s.projectiles) {
      if (p.side !== 1 || p.targetUid === null) continue;
      targets.add(p.targetUid);
    }
    s.projectiles.length = 0;
  }
  assert.ok(targets.size >= 1, 'the squad still fights while rushing');
  for (const uid of targets) {
    assert.equal(
      uid,
      focusUid,
      'a rushing squad concentrates every shot on the focus target',
    );
  }
  return { targets: targets.size };
});

fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`${results.length} passed, ${failures.length} failed`);
if (failures.length) process.exitCode = 1;
