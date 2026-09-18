import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
} from '../game/engine.ts';

const W = 3840;
const DT = 1 / 60;
const out = path.resolve('output/v91-vehicle-reverse-qa');
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

// Flat open arena, AI director disabled.
function arena() {
  const s = createGame(91014);
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
  s.aiIn = 1e9;
  return s;
}

const mx = (side, v) => (side === 0 ? v : W - v);
const dir = (side) => (side === 0 ? 1 : -1);

let squadCounter = 900;

function tank(s, side, x) {
  const before = s.units.length;
  spawnUnit(s, side, 'tank', x);
  return s.units[before];
}

// An enemy tank that never shoots: a pure anti-tank threat on the horizon.
function atThreat(s, side, x) {
  const t = tank(s, 1 - side, x);
  t.cooldown = 1e9;
  return t;
}

// A single rifleman parked on a hold order — the infantry screen a damaged
// vehicle falls back behind.
function screen(s, side, x) {
  const before = s.units.length;
  spawnUnit(s, side, 'infantry', x, { member: 0, squad: ++squadCounter });
  const u = s.units[before];
  u.squadOrder = 'hold';
  u.squadOrderUntil = 1e9;
  return u;
}

// A single rifleman who is NOT an anti-tank threat (no pen, no armour).
function nonThreat(s, side, x) {
  const before = s.units.length;
  spawnUnit(s, 1 - side, 'infantry', x, { member: 0, squad: ++squadCounter });
  const u = s.units[before];
  u.squadOrder = 'hold';
  u.squadOrderUntil = 1e9;
  u.cooldown = 1e9;
  u.hp = 100000;
  u.maxHp = 100000;
  return u;
}

function run(s, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) tick(s, DT);
}

function runUntil(s, predicate, timeout) {
  const steps = Math.round(timeout / DT);
  for (let i = 0; i < steps; i++) {
    tick(s, DT);
    if (predicate()) return s.time;
  }
  return null;
}

const reversing = (t, s) => (t.vehicleReverseUntil ?? 0) > s.time;

// A. A badly mauled tank under anti-tank fire reverses behind its infantry
//    screen, hull still facing the threat.
for (const side of [0, 1]) {
  check(`A${side}. damaged tank reverses behind its infantry screen`, () => {
    const s = arena();
    const t = tank(s, side, mx(side, 1500));
    t.hp = 150;
    atThreat(s, side, mx(side, 1900)); // 400px ahead
    screen(s, side, mx(side, 1350)); // 150px behind
    assert.ok(
      runUntil(s, () => reversing(t, s), 1) !== null,
      'the tank should decide to reverse on the first assessment',
    );
    assert.ok(
      Math.abs(t.vehicleReverseGoal - mx(side, 1350)) < 1,
      `it makes for the nearest screen behind it, goal=${t.vehicleReverseGoal}`,
    );
    const tX = t.x;
    run(s, 1);
    assert.ok(
      (t.x - tX) * dir(side) < -10,
      `it backs up more than 10px in a second, dx=${(t.x - tX).toFixed(1)}`,
    );
    assert.equal(
      t.facing,
      dir(side),
      'the hull keeps its face toward the enemy while reversing',
    );
    assert.ok(reversing(t, s), 'it is still in its reverse window');
    return { backed: +((tX - t.x) * dir(side)).toFixed(1) };
  });
}

// B. A healthy tank holds its ground and fights.
for (const side of [0, 1]) {
  check(`B${side}. healthy tank does not reverse`, () => {
    const s = arena();
    const t = tank(s, side, mx(side, 1500));
    t.hp = 650; // full
    atThreat(s, side, mx(side, 1900));
    screen(s, side, mx(side, 1350));
    const tX = t.x;
    run(s, 1.5);
    assert.ok(!reversing(t, s), 'a healthy vehicle stays in the fight');
    assert.ok(
      (t.x - tX) * dir(side) >= -1,
      `it does not back up, dx=${(t.x - tX).toFixed(1)}`,
    );
    return { hp: t.hp };
  });
}

// C. A tank repaired above the threshold stops reversing and plants.
for (const side of [0, 1]) {
  check(`C${side}. repaired tank stops reversing`, () => {
    const s = arena();
    const t = tank(s, side, mx(side, 1500));
    t.hp = 150;
    atThreat(s, side, mx(side, 1900));
    screen(s, side, mx(side, 1350));
    assert.ok(runUntil(s, () => reversing(t, s), 1) !== null, 'reverse starts');
    run(s, 0.3);
    const afterReverseX = t.x;
    t.hp = 400; // 400 > 55% of 650 = 357.5
    run(s, 0.2);
    assert.equal(t.vehicleReverseUntil, 0, 'the reverse order is cleared');
    assert.ok(
      (t.x - afterReverseX) * dir(side) >= -1,
      `it stops backing up once repaired, dx=${(t.x - afterReverseX).toFixed(1)}`,
    );
    return { hp: t.hp };
  });
}

// D. No anti-tank threat, no reverse — riflemen don't scare a tank.
check('D. damaged tank ignores infantry that cannot penetrate it', () => {
  const s = arena();
  const t = tank(s, 0, 1500);
  t.hp = 150;
  nonThreat(s, 0, 1900); // riflemen, no AT capability
  const tX = t.x;
  run(s, 1.5);
  assert.ok(!reversing(t, s), 'small arms do not trigger a reverse');
  assert.ok(
    (t.x - tX) * dir(0) >= -1,
    `the tank holds its ground, dx=${(t.x - tX).toFixed(1)}`,
  );
  return { reversed: false };
});

// E. With no infantry screen to hide behind, the tank falls back a fixed
//    distance toward its own baseline.
for (const side of [0, 1]) {
  check(`E${side}. no screen means a fixed 220px fallback`, () => {
    const s = arena();
    const t = tank(s, side, mx(side, 1500));
    t.hp = 150;
    atThreat(s, side, mx(side, 1900));
    assert.ok(runUntil(s, () => reversing(t, s), 1) !== null, 'reverse starts');
    assert.ok(
      Math.abs(t.vehicleReverseGoal - mx(side, 1280)) < 1,
      `it falls back 220px toward its baseline, goal=${t.vehicleReverseGoal}`,
    );
    return { goal: t.vehicleReverseGoal };
  });
}

// F. The tank stops the moment it reaches the screen.
for (const side of [0, 1]) {
  check(`F${side}. tank stops upon reaching its infantry screen`, () => {
    const s = arena();
    const t = tank(s, side, mx(side, 1500));
    t.hp = 150;
    atThreat(s, side, mx(side, 1900));
    screen(s, side, mx(side, 1380)); // 120px behind
    assert.ok(runUntil(s, () => reversing(t, s), 1) !== null, 'reverse starts');
    assert.ok(
      runUntil(s, () => (t.vehicleReverseUntil ?? 0) === 0, 5) !== null,
      'the reverse clears when it arrives',
    );
    assert.ok(
      Math.abs(t.x - mx(side, 1380)) < 12,
      `it settles on the screen line, x=${t.x.toFixed(0)}`,
    );
    return { x: +t.x.toFixed(0) };
  });
}

fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`\n${results.length} checks, ${failures.length} failures`);
if (failures.length) process.exit(1);
