// v115: engine-layer verification for the v114 "contact reload stop" promise.
// A soldier caught mid-reload while in contact must stop advancing and drop
// to a knee (or hunker when pinned), so the mag swap reads as a deliberate,
// vulnerable drill instead of an invisible walk-and-gun.
import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  setOrder,
} from '../game/engine.ts';

const DT = 1 / 60;
let count = 0;
const failures = [];

function check(name, fn) {
  try {
    fn();
    count++;
    console.log('✓ ' + name);
  } catch (error) {
    failures.push(name);
    console.error('FAIL ' + name + '\n' + error.stack);
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

// Spawn a single member so the unit sits exactly at x.
function single(s, side, id, x, member = 0) {
  const before = s.units.length;
  spawnUnit(s, side, id, x, { member });
  return s.units[before];
}

// Invincible, silent enemy that never fires or moves.
function silentFoe(s, side, x) {
  const v = single(s, side, 'infantry', x, 0);
  v.cooldown = 1e6;
  v.decisionIn = 1e6;
  v.hp = 99999;
  v.maxHp = 99999;
  return v;
}

function run(s, seconds) {
  for (let i = 0; i < Math.round(seconds / DT); i++) tick(s, DT);
}

// An advancing rifleman with a distant foe (out of contact range) so he
// genuinely moves toward the enemy. Returns the soldier mid-advance.
function advancingRifleman() {
  const s = arena();
  const u = single(s, 0, 'infantry', 100, 0);
  silentFoe(s, 1, 1400);
  setOrder(s, 0, 'advance');
  run(s, 1.5);
  assert.ok(u.moving, 'precondition: the rifleman should be advancing');
  assert.ok(u.x > 150, 'precondition: the rifleman should have gained ground');
  return { s, u };
}

// Catch the soldier mid-reload while in contact.
function catchReloading(s, u, reloadSeconds = 2) {
  u.ammo = 0;
  u.ammoReserve = 30;
  u.reloadingUntil = s.time + reloadSeconds;
  u.reloadingStartAt = s.time;
  u.contactUntil = s.time + 5;
}

check('推进中接敌换弹：士兵停下并蹲下', () => {
  const { s, u } = advancingRifleman();
  const xBefore = u.x;
  catchReloading(s, u);
  run(s, 0.5);
  assert.equal(u.moving, false, 'soldier must stop advancing');
  assert.equal(u.pose, 'crouch', 'soldier must drop to a knee');
  assert.ok(Math.abs(u.x - xBefore) < 1, 'soldier must not gain ground');
});

check('压制中接敌换弹：士兵蹲下改为蜷缩(hunker)', () => {
  const { s, u } = advancingRifleman();
  catchReloading(s, u);
  u.suppression = 70; // > 55 pins him
  run(s, 0.3);
  assert.equal(u.moving, false, 'pinned reloader must not move');
  assert.equal(u.pose, 'hunker', 'pinned reloader must hunker, not crouch');
});

check('换弹完成后：士兵恢复推进', () => {
  const { s, u } = advancingRifleman();
  catchReloading(s, u, 0.4); // short reload window
  run(s, 0.3); // inside the window
  assert.equal(u.moving, false, 'stopped while the window is open');
  assert.equal(u.pose, 'crouch', 'crouched while the window is open');
  run(s, 1.5); // well past the window
  assert.ok(u.moving, 'soldier should resume advancing after the reload');
  assert.ok(u.x > 260, 'soldier should regain ground after the reload');
});

check('冲锋(rush)命令下换弹：士兵不停下', () => {
  const s = arena();
  const u = single(s, 0, 'infantry', 100, 0);
  silentFoe(s, 1, 1400);
  setOrder(s, 0, 'rush');
  run(s, 1.5);
  assert.ok(u.moving, 'precondition: rushing soldier should be moving');
  catchReloading(s, u);
  run(s, 0.5);
  assert.ok(u.moving, 'rush overrides the reload stop');
});

check('非接敌状态换弹：士兵不被强制蹲下', () => {
  const { s, u } = advancingRifleman();
  u.ammo = 0;
  u.ammoReserve = 30;
  u.reloadingUntil = s.time + 2;
  u.reloadingStartAt = s.time;
  // contactUntil left at 0 — no contact, gate must not fire
  run(s, 0.5);
  assert.ok(u.moving, 'soldier keeps advancing without contact');
  assert.notEqual(u.pose, 'crouch', 'no forced crouch without contact');
});

console.log(`\n${count} passed, ${failures.length} failed`);
if (failures.length) {
  console.error('FAILURES:', failures.join(', '));
  process.exit(1);
}
