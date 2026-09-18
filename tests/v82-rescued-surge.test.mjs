import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
} from '../game/engine.ts';

const DT = 1 / 60;
const out = path.resolve('output/v82-rescued-surge-qa');
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
  const s = createGame(81014);
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

// Spawn a single infantry member so the unit sits exactly at x.
function grunt(s, side, x) {
  const before = s.units.length;
  spawnUnit(s, side, 'infantry', x, { member: 0 });
  return s.units[before];
}

// Freeze a unit on a hold order so it never wanders under its own steam.
function freeze(u) {
  u.squadOrder = 'hold';
  u.squadOrderUntil = 1e9;
}

// Burn every round so the unit is bone dry.
function makeDry(s, u) {
  u.ammo = 0;
  u.ammoReserve = 0;
  u.reloadingUntil = 0;
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

// A fresh donor: full kit, parked on a hold order.
function donor(s, x) {
  const buddy = grunt(s, 0, x);
  run(s, 2 * DT); // lazy-init: 30 in the mag, 150 in reserve
  freeze(buddy);
  return buddy;
}

// A frozen enemy who never fires — a pure target dummy.
function enemy(s, x) {
  const e = grunt(s, 1, x);
  run(s, 2 * DT); // lazy-init
  freeze(e);
  e.cooldown = 1e9; // never fires
  return e;
}

// ===========================================================================
// Engine: the rescued-man surge
// ===========================================================================

check('A. the handoff drops suppression by about 35', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  run(s, 2 * DT);
  makeDry(s, u);
  freeze(u);
  u.suppression = 50; // under the 55 walk gate, so the share still happens
  donor(s, 130);
  u.ammoSearchAt = 0;
  assert.ok(
    runUntil(s, () => (u.ammoShareUntil ?? 0) > s.time, 3) !== null,
    'the handoff should happen',
  );
  assert.ok(
    u.suppression < 20,
    `suppression should drop ~35 from 50, got ${u.suppression.toFixed(1)}`,
  );
  return { suppression: +u.suppression.toFixed(1) };
});

check('B. the rescued man always gets a faster burst window', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  run(s, 2 * DT);
  makeDry(s, u);
  freeze(u);
  donor(s, 130);
  u.ammoSearchAt = 0;
  assert.ok(
    runUntil(s, () => (u.ammoShareUntil ?? 0) > s.time, 3) !== null,
    'the handoff should happen',
  );
  assert.ok(
    (u.assaultBurstUntil ?? 0) > s.time,
    'the burst window should be open even with no enemy in sight',
  );
  return { burstFor: +(u.assaultBurstUntil - s.time).toFixed(2) };
});

check('C. with the enemy in sight, the rescued man surges', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  run(s, 2 * DT);
  makeDry(s, u);
  enemy(s, 470); // 370px away — inside the 380 rifle range, beyond the 320 surge gate
  donor(s, 130);
  u.ammoSearchAt = 0;
  assert.ok(
    runUntil(s, () => (u.ammoShareUntil ?? 0) > s.time, 3) !== null,
    'the handoff should happen',
  );
  assert.ok(
    (u.assaultSurgeUntil ?? 0) > s.time,
    'assaultSurgeUntil should be set on an advance order',
  );
  assert.ok(
    (u.rescuedUntil ?? 0) > s.time,
    'rescuedUntil should be set so the surge goal engages',
  );
  return {
    surgeFor: +(u.assaultSurgeUntil - s.time).toFixed(2),
    rescuedFor: +(u.rescuedUntil - s.time).toFixed(2),
  };
});

check('D. the rescued man charges back toward the enemy', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  run(s, 2 * DT);
  makeDry(s, u);
  enemy(s, 470);
  donor(s, 130);
  u.ammoSearchAt = 0;
  assert.ok(
    runUntil(s, () => (u.ammoShareUntil ?? 0) > s.time, 3) !== null,
    'the handoff should happen',
  );
  const shareX = u.x;
  run(s, 1.0); // the surge carries him ~46px at run speed
  assert.ok(
    u.x - shareX > 20,
    `he should charge toward the enemy, moved ${(u.x - shareX).toFixed(1)}px`,
  );
  return { shareX: +shareX.toFixed(1), afterX: +u.x.toFixed(1), charged: +(u.x - shareX).toFixed(1) };
});

check('E. with no enemy there is no surge — only the burst', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  run(s, 2 * DT);
  makeDry(s, u);
  donor(s, 130);
  u.ammoSearchAt = 0;
  assert.ok(
    runUntil(s, () => (u.ammoShareUntil ?? 0) > s.time, 3) !== null,
    'the handoff should happen',
  );
  assert.equal(
    u.assaultSurgeUntil,
    undefined,
    'no enemy means no charge',
  );
  assert.equal(
    u.rescuedUntil,
    undefined,
    'no enemy means no surge goal',
  );
  assert.ok(
    (u.assaultBurstUntil ?? 0) > s.time,
    'the burst window is still set — it is unconditional',
  );
  return { burstSet: true, surgeSet: false };
});

check('F. a man wounded mid-surge stops charging', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  run(s, 2 * DT);
  makeDry(s, u);
  enemy(s, 470);
  donor(s, 130);
  u.ammoSearchAt = 0;
  assert.ok(
    runUntil(s, () => (u.ammoShareUntil ?? 0) > s.time, 3) !== null,
    'the handoff should happen',
  );
  assert.ok(
    (u.rescuedUntil ?? 0) > s.time,
    'the surge should be live before the wound',
  );
  const shareX = u.x;
  u.wounded = true; // hit mid-charge
  run(s, 0.5);
  assert.ok(
    u.x - shareX < 5,
    `a wounded man must not keep charging, drifted ${(u.x - shareX).toFixed(2)}px`,
  );
  return { drift: +(u.x - shareX).toFixed(2) };
});

check('G. a hold order keeps the rescued man at his post', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  run(s, 2 * DT);
  makeDry(s, u);
  freeze(u); // hold order: he walks to the donor but does not surge
  enemy(s, 470);
  donor(s, 130);
  u.ammoSearchAt = 0;
  assert.ok(
    runUntil(s, () => (u.ammoShareUntil ?? 0) > s.time, 3) !== null,
    'the handoff should happen',
  );
  assert.equal(
    u.assaultSurgeUntil,
    undefined,
    'a hold order must not trigger a charge',
  );
  assert.equal(
    u.rescuedUntil,
    undefined,
    'a hold order must not set a surge goal',
  );
  assert.ok(
    (u.assaultBurstUntil ?? 0) > s.time,
    'the burst window is still set — rate of fire is not order-gated',
  );
  return { burstSet: true, surgeSet: false };
});

fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`\n${results.length} checks, ${failures.length} failures`);
if (failures.length) process.exit(1);
