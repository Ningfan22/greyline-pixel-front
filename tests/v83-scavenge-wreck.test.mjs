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
const out = path.resolve('output/v83-scavenge-wreck-qa');
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

// A fallen comrade lying in the dirt, still carrying his weapon's ammo.
// Synthetic wrecks bypass the kill pipeline; ids start at 90000 so they
// never collide with living unit uids.
function casualty(
  s,
  side,
  x,
  ammo,
  reserve,
  cardId = 'infantry',
  member = 0,
) {
  const w = {
    id: 90000 + s.wrecks.length,
    cardId,
    side,
    x,
    y: 374,
    angle: 0,
    age: 0,
    falling: false,
    vx: 0,
    vy: 0,
    member,
    ammo,
    ammoReserve: reserve,
  };
  s.wrecks.push(w);
  return w;
}

// ===========================================================================
// Engine: looting the fallen
// ===========================================================================

check('A. a dry rifleman walks to a fallen comrade with ammo', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  freeze(u);
  run(s, 2 * DT);
  makeDry(s, u);
  casualty(s, 0, 200, 30, 150);
  u.ammoSearchAt = 0;
  assert.ok(
    runUntil(s, () => (u.scavengeWreckId ?? 0) > 0, 2) !== null,
    'the search should tag the wreck',
  );
  assert.ok(
    runUntil(s, () => u.x > 168, 4) !== null,
    `he should walk to the body, stalled at x=${u.x.toFixed(1)}`,
  );
  return { x: +u.x.toFixed(1), wreckId: u.scavengeWreckId };
});

check('B. on arrival he hunkers over the weapon for 1.2s', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  freeze(u);
  run(s, 2 * DT);
  makeDry(s, u);
  casualty(s, 0, 150, 30, 150);
  u.ammoSearchAt = 0;
  assert.ok(
    runUntil(s, () => (u.scavengeUntil ?? 0) > s.time, 4) !== null,
    'the scavenge window should open once he reaches the body',
  );
  const windowLeft = u.scavengeUntil - s.time;
  assert.ok(
    windowLeft > 1.0 && windowLeft <= 1.2 + 1e-6,
    `the window should be ~1.2s, got ${windowLeft.toFixed(2)}s`,
  );
  return { windowLeft: +windowLeft.toFixed(2) };
});

check('C. after the window he takes up to 30 rounds and reloads', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  freeze(u);
  run(s, 2 * DT);
  makeDry(s, u);
  const body = casualty(s, 0, 150, 30, 150);
  u.ammoSearchAt = 0;
  assert.ok(
    runUntil(s, () => (u.scavengeUntil ?? 0) > s.time, 4) !== null,
    'the scavenge window should open',
  );
  assert.ok(
    runUntil(s, () => (u.ammoReserve ?? 0) > 0, 3) !== null,
    'ammo should transfer once the window closes',
  );
  assert.equal(u.ammoReserve, 30, 'he takes 30 rounds');
  assert.equal(body.ammoReserve, 120, 'reserve is drained first');
  assert.equal(body.ammo, 30, 'the magazine in the weapon is untouched');
  assert.ok(
    (u.reloadingUntil ?? 0) > s.time,
    'he reloads after looting',
  );
  assert.equal(
    u.scavengeWreckId,
    undefined,
    'the scavenge flag clears',
  );
  return {
    took: u.ammoReserve,
    bodyReserve: body.ammoReserve,
    bodyMag: body.ammo,
  };
});

check('D. with no reserve, he pulls rounds from the weapon itself', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  freeze(u);
  run(s, 2 * DT);
  makeDry(s, u);
  const body = casualty(s, 0, 150, 15, 0);
  u.ammoSearchAt = 0;
  assert.ok(
    runUntil(s, () => (u.ammoReserve ?? 0) > 0, 4) !== null,
    'ammo should transfer',
  );
  assert.equal(u.ammoReserve, 15, 'he takes what is left');
  assert.equal(body.ammo, 0, 'the weapon is emptied');
  return { took: u.ammoReserve };
});

check('E. enemy dead are left alone', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  freeze(u);
  run(s, 2 * DT);
  makeDry(s, u);
  casualty(s, 1, 150, 30, 150);
  u.ammoSearchAt = 0;
  run(s, 2);
  assert.equal(
    u.scavengeWreckId,
    undefined,
    'he must not loot the other side',
  );
  assert.ok(Math.abs(u.x - 100) < 1, 'he stays put');
  return { x: +u.x.toFixed(1) };
});

check('F. a dead machinegunner has the wrong caliber', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  freeze(u);
  run(s, 2 * DT);
  makeDry(s, u);
  // member 0 of a machinegun team carries the gun itself — machinegun ammo.
  casualty(s, 0, 150, 50, 100, 'machinegun', 0);
  u.ammoSearchAt = 0;
  run(s, 2);
  assert.equal(
    u.scavengeWreckId,
    undefined,
    'a rifleman cannot feed a belt-fed weapon',
  );
  assert.ok(Math.abs(u.x - 100) < 1, 'he stays put');
  return { x: +u.x.toFixed(1) };
});

check('G. an empty body is ignored', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  freeze(u);
  run(s, 2 * DT);
  makeDry(s, u);
  casualty(s, 0, 150, 0, 0);
  u.ammoSearchAt = 0;
  run(s, 2);
  assert.equal(
    u.scavengeWreckId,
    undefined,
    'nothing to take',
  );
  return { x: +u.x.toFixed(1) };
});

check('H. under fire he does not break cover to loot', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  freeze(u);
  run(s, 2 * DT);
  makeDry(s, u);
  // Pinned deep enough that the 7/s decay cannot bleed under the 55 walk
  // gate inside the 2s window — he must not break cover to loot.
  u.suppression = 90;
  casualty(s, 0, 150, 30, 150);
  u.ammoSearchAt = 0;
  run(s, 2);
  assert.ok(Math.abs(u.x - 100) < 1, 'he stays in cover');
  return { x: +u.x.toFixed(1), suppression: u.suppression };
});

check('I. a living donor is preferred over a corpse', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  freeze(u);
  run(s, 2 * DT);
  makeDry(s, u);
  donor(s, 130);
  casualty(s, 0, 200, 30, 150);
  u.ammoSearchAt = 0;
  assert.ok(
    runUntil(s, () => u.ammoBuddyUid !== undefined, 2) !== null,
    'the search should find the living buddy',
  );
  assert.equal(
    u.scavengeWreckId,
    undefined,
    'the wreck is not even tagged while a donor exists',
  );
  assert.ok(
    runUntil(s, () => (u.ammoShareUntil ?? 0) > s.time, 4) !== null,
    'the living handoff should happen',
  );
  return { buddy: u.ammoBuddyUid, shared: true };
});

check('J. a body beyond 160px is out of reach', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  freeze(u);
  run(s, 2 * DT);
  makeDry(s, u);
  casualty(s, 0, 290, 30, 150); // 190px away
  u.ammoSearchAt = 0;
  run(s, 2);
  assert.equal(
    u.scavengeWreckId,
    undefined,
    'too far to justify the walk',
  );
  assert.ok(Math.abs(u.x - 100) < 1, 'he stays put');
  return { x: +u.x.toFixed(1) };
});

fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`\n${results.length} checks, ${failures.length} failures`);
if (failures.length) process.exit(1);
