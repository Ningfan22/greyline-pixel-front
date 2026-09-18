import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  setOrder,
  refreshVision,
} from '../game/engine.ts';
import { magazine } from '../game/ballistics.ts';

const DT = 1 / 60;
const out = path.resolve('output/v69-ammo-reload-qa');
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
  const s = createGame(69014);
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

// Spawn a single member via cargo so the unit sits exactly at x.
function single(s, side, id, x, member = 0) {
  const before = s.units.length;
  spawnUnit(s, side, id, x, { member });
  return s.units[before];
}

function grunt(s, side, x) {
  return single(s, side, 'infantry', x, 0);
}

// Invincible, silent enemy that never fires or moves (prone after first scan).
function silentFoe(s, side, x) {
  const v = grunt(s, side, x);
  v.cooldown = 1e6;
  v.decisionIn = 1e6;
  v.hp = 99999;
  v.maxHp = 99999;
  return v;
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

function lastShot(u) {
  return u.lastCombatShotAt ?? -1;
}

// --- A. Pure magazine() profiles ---

check('magazine: rifleman carries 30 rounds, 150 reserve, 2.5s swap', () => {
  const m = magazine('infantry', 0);
  assert.deepEqual(m, { mag: 30, reserve: 150, reload: 2.5 });
  return m;
});

check('magazine: machinegunner carries 100 rounds, 200 reserve, 4s swap', () => {
  const m = magazine('machinegun', 0);
  assert.deepEqual(m, { mag: 100, reserve: 200, reload: 4.0 });
  return m;
});

check('magazine: mg escort member is a rifleman', () => {
  const m = magazine('machinegun', 1);
  assert.deepEqual(m, { mag: 30, reserve: 150, reload: 2.5 });
  return m;
});

check('magazine: sniper carries 5 rounds, 25 reserve, 3s swap', () => {
  const m = magazine('sniper', 0);
  assert.deepEqual(m, { mag: 5, reserve: 25, reload: 3.0 });
  return m;
});

check('magazine: rocket has no magazine management', () => {
  assert.equal(magazine('rocket', 0), null);
  return {};
});

check('magazine: mortar has no magazine management', () => {
  assert.equal(magazine('mortar', 0), null);
  return {};
});

check('magazine: ifv has no magazine management', () => {
  assert.equal(magazine('ifv', 0), null);
  return {};
});

check('magazine: grenadiers have no magazine management', () => {
  assert.equal(magazine('grenadiers', 0), null);
  return {};
});

check('magazine: antiarmor leader is a rocketeer', () => {
  assert.equal(magazine('antiarmor', 0), null);
  return {};
});

check('magazine: antiarmor escort is a rifleman', () => {
  const m = magazine('antiarmor', 1);
  assert.deepEqual(m, { mag: 30, reserve: 150, reload: 2.5 });
  return m;
});

// --- B. Lazy initialisation on first tick ---

check('a fresh rifleman is seated a full magazine on his first tick', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  run(s, 2 * DT);
  assert.equal(u.ammo, 30, 'magazine seated');
  assert.equal(u.ammoReserve, 150, 'reserve seated');
  return { ammo: u.ammo, reserve: u.ammoReserve };
});

check('a machinegunner gets a 100-round belt, his escort a 30-round mag', () => {
  const s = arena();
  const gunner = single(s, 0, 'machinegun', 100, 0);
  const escort = single(s, 0, 'machinegun', 200, 1);
  run(s, 2 * DT);
  assert.equal(gunner.ammo, 100, 'gunner belt');
  assert.equal(escort.ammo, 30, 'escort magazine');
  return { gunner: gunner.ammo, escort: escort.ammo };
});

check('a sniper gets a 5-round magazine and 25 reserve', () => {
  const s = arena();
  const u = single(s, 0, 'sniper', 100, 0);
  run(s, 2 * DT);
  assert.equal(u.ammo, 5);
  assert.equal(u.ammoReserve, 25);
  return { ammo: u.ammo, reserve: u.ammoReserve };
});

check('a rocketeer is marked ammo -1 (no magazine management)', () => {
  const s = arena();
  const u = single(s, 0, 'rocket', 100, 0);
  run(s, 2 * DT);
  assert.equal(u.ammo, -1);
  return { ammo: u.ammo };
});

// --- C. Shooting dry and reloading ---

check('a rifleman who fires dry locks into a reload, then resumes', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  silentFoe(s, 1, 350); // 250px away, inside 380 rifle range
  run(s, 2 * DT); // lazy-init
  u.ammo = 1; // one round left

  const dryAt = runUntil(
    s,
    () => u.ammo === 0 && (u.reloadingUntil ?? 0) > s.time,
    5,
  );
  assert.ok(dryAt !== null, 'the rifleman should have fired his last round');
  assert.equal(u.ammo, 0, 'magazine dry');
  assert.ok(u.reloadingUntil > s.time, 'reload window open');

  const lastDry = lastShot(u);
  run(s, 1); // 1s inside the 2.5s reload window
  assert.equal(lastShot(u), lastDry, 'no shots while the magazine is out');

  const reloadedAt = runUntil(s, () => u.ammo > 0, 5);
  assert.ok(reloadedAt !== null, 'reload should complete');
  assert.ok(u.ammo > 0, 'fresh magazine seated');
  assert.equal(
    u.ammoReserve,
    120,
    'one 30-round mag transferred from reserve',
  );

  run(s, 1);
  assert.ok(
    lastShot(u) > lastDry,
    'the rifleman should resume fire after reloading',
  );
  return { dryAt, reloadedAt, ammo: u.ammo, reserve: u.ammoReserve };
});

// --- D. Machinegunner reload duration ---

check('a machinegunner takes ~4s to swap a 100-round belt', () => {
  const s = arena();
  const gunner = single(s, 0, 'machinegun', 100, 0);
  silentFoe(s, 1, 500); // 400px, inside 500 mg range
  run(s, 2 * DT);
  gunner.ammo = 1;

  runUntil(
    s,
    () => gunner.ammo === 0 && (gunner.reloadingUntil ?? 0) > s.time,
    5,
  );
  const rt = gunner.reloadingUntil - s.time;
  assert.ok(
    Math.abs(rt - 4.0) < 0.3,
    `mg reload should be ~4s, got ${rt.toFixed(2)}s`,
  );
  return { reloadSeconds: +rt.toFixed(2) };
});

// --- E. Sniper magazine capacity ---

check('a sniper holds 5 rounds and 25 reserve', () => {
  const s = arena();
  const u = single(s, 0, 'sniper', 100, 0);
  silentFoe(s, 1, 500); // 400px, inside 780 sniper range
  run(s, 2 * DT);
  assert.equal(u.ammo, 5);
  assert.equal(u.ammoReserve, 25);
  return { ammo: u.ammo, reserve: u.ammoReserve };
});

// --- F. Suppression extends reload ---

check('a pinned rifleman takes 1.5x longer to reload', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  silentFoe(s, 1, 350);
  run(s, 2 * DT);
  u.ammo = 1;
  u.suppression = 60; // > 50 triggers the 1.5x multiplier

  runUntil(
    s,
    () => u.ammo === 0 && (u.reloadingUntil ?? 0) > s.time,
    5,
  );
  const rt = u.reloadingUntil - s.time;
  assert.ok(
    Math.abs(rt - 3.75) < 0.3,
    `pinned reload should be ~3.75s, got ${rt.toFixed(2)}s`,
  );
  return { reloadSeconds: +rt.toFixed(2) };
});

// --- G. Dry reserve = permanent silence ---

check('a rifleman with no reserve falls silent forever after his last mag', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  silentFoe(s, 1, 350);
  run(s, 2 * DT);
  u.ammo = 0;
  u.ammoReserve = 0;
  u.reloadingUntil = s.time + 0.1; // about to complete a reload seating nothing

  run(s, 0.2); // reload completes, seats 0 rounds
  assert.equal(u.ammo, 0, 'still dry');
  assert.equal(u.reloadingUntil, 0, 'reload flag cleared');

  const lastDry = lastShot(u);
  run(s, 2);
  assert.equal(lastShot(u), lastDry, 'no shots possible with a dry reserve');
  return { lastDry };
});

// --- H. AI exploits the enemy reload window ---

function reloadWindowExperiment(foeReloading) {
  const s = arena();
  // 6-man squad; formation spreads [302, 264, 226, 188, 150, 112] for side 0.
  const friendly = squad(s, 0, 'infantry', 100);
  const foe = silentFoe(s, 1, 450); // inside every member's 380 range
  run(s, 2 * DT); // lazy-init both sides

  for (const v of friendly) v.suppression = 100; // pinned
  if (foeReloading) {
    foe.ammo = 0;
    foe.ammoReserve = 30;
    foe.reloadingUntil = s.time + 100; // caught mid-reload
  } else {
    foe.ammo = 30; // ready to fire
  }

  run(s, 3);
  return { s, friendly };
}

check('pinned infantry seize the moment when the enemy is reloading', () => {
  const { friendly } = reloadWindowExperiment(true);
  // member 3 is a "bound" role in the balanced doctrine rotation; with the
  // foe mid-reload his effective suppression (~88.6 - 30 = 58.6) drops below
  // the 65 prone threshold, so he bounds instead of hugging the dirt.
  assert.equal(
    friendly[3].tactic,
    'bound',
    `expected bound, got ${friendly[3].tactic}`,
  );
  return { tactic: friendly[3].tactic };
});

check('pinned infantry stay prone when the enemy is ready to fire', () => {
  const { friendly } = reloadWindowExperiment(false);
  for (let i = 0; i < friendly.length; i++) {
    assert.equal(
      friendly[i].tactic,
      'prone',
      `member ${i} should be prone, got ${friendly[i].tactic}`,
    );
  }
  return { tactics: friendly.map((v) => v.tactic) };
});

fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`\n${results.length} checks, ${failures.length} failures`);
if (failures.length) process.exit(1);
