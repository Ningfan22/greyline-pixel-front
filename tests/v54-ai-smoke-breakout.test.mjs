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

const DT = 1 / 60;
const out = path.resolve('output/v54-ai-smoke-breakout-qa');
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
  const s = createGame(54014);
  startGame(s);
  s.terrain.fill(374);
  s.original.fill(374);
  s.walls = [];
  s.scenery = [];
  s.players[1].deck = [];
  s.players[1].discard = [];
  s.players[1].hand = [];
  s.players[1].energy = 0;
  s.players[1].played = 0;
  s.aiIn = 0;
  return s;
}

function squad(s, side, id, x) {
  const at = s.units.length;
  spawnUnit(s, side, id, x);
  return s.units.slice(at);
}

function hand(s, ids, energy) {
  s.players[1].hand = ids.map((id, i) => ({ id, uid: 10000 + i, readyAt: 0 }));
  s.players[1].energy = energy;
}

// Drive one AI decision.
function decide(s) {
  refreshVision(s);
  tick(s, 0.05);
}

const side1Smoke = (s) => s.smokes.filter((m) => m.side === 1);

// Two AI squads on the front, two enemy squads in small-arms range.
function battleScene(s) {
  squad(s, 1, 'infantry', 2800);
  squad(s, 1, 'infantry', 2860);
  squad(s, 0, 'infantry', 2500);
  squad(s, 0, 'infantry', 2560);
}

const pin = (s) =>
  s.units
    .filter((u) => u.side === 1)
    .forEach((u) => {
      u.suppression = 80;
    });

// --- Pinned front: the AI smokes the contact line and pushes through ---

check('AI plays smoke when two squads are pinned at the front', () => {
  const s = arena();
  battleScene(s);
  pin(s);
  hand(s, ['smoke'], 3);
  decide(s);
  assert.equal(side1Smoke(s).length, 1, 'one smoke screen must be laid');
  const [smoke] = side1Smoke(s);
  assert.ok(
    smoke.x > 2500 && smoke.x < 2800,
    `smoke lands between the lines, got x=${smoke.x}`,
  );
  return { smokeX: smoke.x };
});

check('AI issues a rush order with the breakout smoke', () => {
  const s = arena();
  battleScene(s);
  pin(s);
  hand(s, ['smoke'], 3);
  decide(s);
  assert.ok(
    (s.aiPushUntil ?? 0) > s.time,
    `aiPushUntil ${s.aiPushUntil} must be in the future (time ${s.time})`,
  );
  return { aiPushUntil: s.aiPushUntil };
});

// --- Gates: smoke is a breakout tool, not a reflex ---

check('AI holds smoke when the line is not pinned', () => {
  const s = arena();
  battleScene(s);
  hand(s, ['smoke'], 3);
  decide(s);
  assert.equal(
    side1Smoke(s).length,
    0,
    'unpinned troops do not get a smoke screen',
  );
  return {};
});

check('AI holds smoke when only one squad is pinned', () => {
  const s = arena();
  battleScene(s);
  const [first] = s.units.filter((u) => u.side === 1);
  first.suppression = 80;
  hand(s, ['smoke'], 3);
  decide(s);
  assert.equal(
    side1Smoke(s).length,
    0,
    'one squad having a bad moment does not burn the smoke',
  );
  return {};
});

check('AI does not re-drop smoke when the front is already covered', () => {
  const s = arena();
  battleScene(s);
  pin(s);
  s.smokes.push({ x: 2630, life: 10, side: 1 });
  hand(s, ['smoke'], 3);
  decide(s);
  assert.equal(side1Smoke(s).length, 1, 'the pre-existing screen is kept');
  return {};
});

// --- End-to-end: the breakout actually un-pins the line ---

check('the breakout smoke roughly halves pinned strength after 6 seconds', () => {
  // Same scene twice: the AI may smoke in one run and not the other. Smoke
  // blinds the enemy rifles (300px > 140px block) and speeds suppression
  // recovery 1.5x (v53), so the smoked force must un-pin substantially faster.
  const run = (withSmoke) => {
    const s = arena();
    const ai = squad(s, 1, 'infantry', 2800).concat(
      squad(s, 1, 'infantry', 2860),
    );
    squad(s, 0, 'infantry', 2500);
    squad(s, 0, 'infantry', 2560);
    ai.forEach((u) => {
      u.suppression = 80;
    });
    if (withSmoke) {
      hand(s, ['smoke'], 3);
      decide(s);
      assert.equal(side1Smoke(s).length, 1, 'the breakout smoke is laid');
    }
    for (let i = 0; i < 360; i++) tick(s, DT);
    return {
      pinned: ai.filter((u) => u.suppression >= 68).length,
      avg: ai.reduce((n, u) => n + u.suppression, 0) / ai.length,
    };
  };
  const smoked = run(true);
  const plain = run(false);
  assert.ok(
    smoked.pinned <= plain.pinned / 2,
    `smoke halves pinned strength: smoked ${smoked.pinned} vs plain ${plain.pinned}`,
  );
  assert.ok(
    smoked.avg < plain.avg - 10,
    `smoke lowers average suppression: smoked ${smoked.avg.toFixed(0)} vs plain ${plain.avg.toFixed(0)}`,
  );
  return { smoked, plain };
});

fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`${results.length} passed, ${failures.length} failed`);
if (failures.length) process.exitCode = 1;
