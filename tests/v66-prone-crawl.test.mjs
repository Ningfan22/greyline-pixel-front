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
const out = path.resolve('output/v66-prone-crawl-qa');
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
  const s = createGame(66014);
  startGame(s);
  s.terrain.fill(374);
  s.original.fill(374);
  s.walls = [];
  s.scenery = [];
  s.players[1].deck = [];
  s.players[1].discard = [];
  s.players[1].hand = [];
  s.players[1].energy = 0;
  // Keep the AI director from rewriting orders mid-scenario.
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

// Sample a predicate every tick; returns true if it ever holds.
function runUntilSeen(s, seconds, predicate) {
  const steps = Math.round(seconds / DT);
  for (let i = 0; i < steps; i++) {
    tick(s, DT);
    if (predicate()) return true;
  }
  return false;
}

function silenceFoe(foe) {
  for (const v of foe) {
    v.cooldown = 1e6;
    v.decisionIn = 1e6;
    v.hp = 99999;
    v.maxHp = 99999;
  }
}

function forceWithdrawal(s, grunts, suppression) {
  for (const u of grunts) {
    u.withdrawUntil = s.time + 30;
    u.withdrawGoal = 100;
    u.withdrawStartedAt = s.time;
    u.withdrawGroup = u.member % 2;
    u.withdrawAssessAt = s.time + 100;
    u.suppression = suppression;
    u.decisionIn = 0;
  }
}

// --- v66: prone crawl under fire ---

check('heavy suppression withdrawal crawls prone', () => {
  const s = arena();
  const grunts = squad(s, 0, 'infantry', 400);
  const foe = squad(s, 1, 'infantry', 700);
  silenceFoe(foe);
  setOrder(s, 0, 'advance');
  setOrder(s, 1, 'hold');
  refreshVision(s);
  forceWithdrawal(s, grunts, 90);

  const sawProneCrawl = runUntilSeen(
    s,
    3,
    () => grunts.some((u) => u.moving && u.pose === 'prone'),
  );
  assert.ok(sawProneCrawl, 'expected at least one grunt to crawl prone');

  const leftmost = Math.min(...grunts.map((u) => u.x));
  assert.ok(leftmost < 200, `squad should have fallen back, leftmost=${leftmost.toFixed(0)}`);
  return { leftmost: +leftmost.toFixed(1) };
});

check('light suppression withdrawal crouch-walks (regression)', () => {
  const s = arena();
  const grunts = squad(s, 0, 'infantry', 400);
  const foe = squad(s, 1, 'infantry', 700);
  silenceFoe(foe);
  setOrder(s, 0, 'advance');
  setOrder(s, 1, 'hold');
  refreshVision(s);
  forceWithdrawal(s, grunts, 10);

  const sawCrouchWalk = runUntilSeen(
    s,
    3,
    () => grunts.some((u) => u.moving && u.pose === 'crouch'),
  );
  assert.ok(sawCrouchWalk, 'expected at least one grunt to crouch-walk');
  assert.ok(
    !grunts.some((u) => u.moving && u.pose === 'prone'),
    'light suppression should not drop anyone to prone',
  );
  return {};
});

check('prone crawl emits dust particles', () => {
  const s = arena();
  const grunts = squad(s, 0, 'infantry', 400);
  const foe = squad(s, 1, 'infantry', 700);
  silenceFoe(foe);
  setOrder(s, 0, 'advance');
  setOrder(s, 1, 'hold');
  refreshVision(s);
  forceWithdrawal(s, grunts, 90);

  let maxDust = 0;
  const steps = Math.round(3 / DT);
  for (let i = 0; i < steps; i++) {
    tick(s, DT);
    const dust = s.particles.filter((p) => p.kind === 'dust').length;
    if (dust > maxDust) maxDust = dust;
  }
  assert.ok(maxDust > 0, 'expected dust particles while crawling');
  const crawlers = grunts.filter((u) => (u.crawlFxAt ?? 0) > 0).length;
  assert.ok(crawlers > 0, 'expected at least one grunt with a crawl fx timer');
  return { maxDust, crawlers };
});

check('crouch order under heavy suppression drops to prone', () => {
  const s = arena();
  const grunts = squad(s, 0, 'infantry', 400);
  setOrder(s, 0, 'crouch');
  refreshVision(s);
  for (const u of grunts) {
    u.suppression = 90;
    u.decisionIn = 0;
  }

  const sawProne = runUntilSeen(
    s,
    1.5,
    () => grunts.some((u) => u.moving && u.pose === 'prone'),
  );
  assert.ok(sawProne, 'expected crouch-ordered grunts to drop prone under fire');
  return {};
});

fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`\n${results.length} checks, ${failures.length} failures`);
if (failures.length) process.exit(1);
