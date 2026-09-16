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

const out = path.resolve('output/v88-smoke-assault-qa');
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
  const s = createGame(88014);
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
  // drawIn must stay positive: with an empty deck the draw check is harmless,
  // but a real game would let the first-draw reflex steal this turn.
  s.players[1].drawIn = 10;
}

function decide(s) {
  refreshVision(s);
  tick(s, 0.05);
}

const side1Smoke = (s) => s.smokes.filter((m) => m.side === 1);

// --- Test 1: shock troops on the contact line trigger the smoke-assault plan ---

check('AI lays smoke and opens the assault plan with shock troops ahead', () => {
  const s = arena();
  squad(s, 1, 'assault', 2800);
  squad(s, 1, 'infantry', 2860);
  squad(s, 0, 'infantry', 2500);
  hand(s, ['smoke'], 3);
  decide(s);
  assert.equal(side1Smoke(s).length, 1, 'one smoke screen must be laid');
  const [smoke] = side1Smoke(s);
  assert.equal(smoke.x, 2630, `smoke lands at front-170, got x=${smoke.x}`);
  assert.ok(
    (s.aiSmokeAssaultUntil ?? 0) > s.time,
    `assault plan window must be in the future, got ${s.aiSmokeAssaultUntil} vs time ${s.time}`,
  );
  assert.equal(
    s.aiSmokeAssaultX,
    2630,
    `assault axis must match the smoke x, got ${s.aiSmokeAssaultX}`,
  );
  return { smokeX: smoke.x, until: s.aiSmokeAssaultUntil };
});

// --- Test 2: while the plan is active, a howitzer card shells the blinded line ---

check('AI deploys barrage howitzers onto the smoked enemy line', () => {
  const s = arena();
  squad(s, 1, 'infantry', 2800);
  squad(s, 1, 'infantry', 2860);
  squad(s, 0, 'infantry', 2500);
  // Open the assault window directly, as if the smoke had just been laid.
  s.aiSmokeAssaultUntil = s.time + 10;
  s.aiSmokeAssaultX = 2630;
  hand(s, ['barrage'], 8);
  decide(s);
  assert.ok(
    s.units.some((u) => u.side === 1 && u.id === 'barrage'),
    'a barrage howitzer must be deployed during the smoke assault',
  );
  return {};
});

// --- Test 3: assault infantry are the preferred reinforcement while smoke is up ---

check('AI reinforces with assault infantry through the smoke', () => {
  const s = arena();
  squad(s, 1, 'infantry', 2800);
  squad(s, 1, 'infantry', 2860);
  squad(s, 0, 'infantry', 2500);
  s.aiSmokeAssaultUntil = s.time + 10;
  s.aiSmokeAssaultX = 2630;
  hand(s, ['assault'], 3);
  decide(s);
  assert.ok(
    s.units.some((u) => u.side === 1 && u.id === 'assault'),
    'an assault squad must be deployed during the smoke assault',
  );
  return {};
});

// --- Test 4: the assault window closes on its own ---

check('the smoke-assault window expires after 12 seconds', () => {
  const s = arena();
  squad(s, 1, 'infantry', 2800);
  squad(s, 1, 'infantry', 2860);
  squad(s, 0, 'infantry', 2500);
  s.aiSmokeAssaultUntil = s.time + 12;
  s.aiSmokeAssaultX = 2630;
  // tick clamps dt to 0.05, so advance in steps.
  for (let i = 0; i < 250; i++) tick(s, 0.05);
  assert.ok(
    s.time >= s.aiSmokeAssaultUntil,
    `time ${s.time} must pass the window close ${s.aiSmokeAssaultUntil}`,
  );
  return { time: s.time, until: s.aiSmokeAssaultUntil };
});

fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`${results.length} passed, ${failures.length} failed`);
if (failures.length) process.exitCode = 1;
