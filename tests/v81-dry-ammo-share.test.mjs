import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
} from '../game/engine.ts';
import { adultFrameChoice } from '../game/adult-animation.ts';

const DT = 1 / 60;
const out = path.resolve('output/v81-dry-ammo-share-qa');
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

// Seat the lazy magazine, then burn every round so the unit is bone dry.
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

// ===========================================================================
// Engine: the dry-ammo battle drill
// ===========================================================================

check('A. a dry soldier waves for ammunition on his first dry tick', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  run(s, 2 * DT); // lazy-init
  makeDry(s, u);
  run(s, DT);
  assert.ok(
    (u.ammoSignalUntil ?? 0) > s.time,
    'the signal window should be open',
  );
  return { signalFor: +(u.ammoSignalUntil - s.time).toFixed(2) };
});

check('B. the dry man picks the nearest buddy with a deep reserve', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  run(s, 2 * DT);
  makeDry(s, u);
  const near = donor(s, 174); // 74px away
  const far = donor(s, 210); // 110px away, still inside 120
  u.ammoSearchAt = 0; // the donor setup ticks armed the 0.6s search throttle
  run(s, DT);
  assert.equal(
    u.ammoBuddyUid,
    near.uid,
    'the nearer donor should be chosen',
  );
  return { buddy: u.ammoBuddyUid, near: near.uid, far: far.uid };
});

check('C. the dry man walks to his ammo buddy', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  run(s, 2 * DT);
  makeDry(s, u);
  freeze(u); // hold order: the only motion is the ammo walk
  donor(s, 174); // 74px away
  u.ammoSearchAt = 0; // re-arm the search now that the donor exists
  run(s, 0.5); // ~34px of travel at 68px/s
  assert.ok(
    u.x - 100 > 15,
    `the dry man should have closed most of the gap, moved ${(u.x - 100).toFixed(1)}px`,
  );
  return { moved: +(u.x - 100).toFixed(1) };
});

check('D. within arm\'s reach the squad passes a magazine', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  run(s, 2 * DT);
  makeDry(s, u);
  freeze(u);
  const buddy = donor(s, 174);
  const sharedAt = runUntil(s, () => (u.ammoShareUntil ?? 0) > s.time, 3);
  assert.ok(sharedAt !== null, 'the handoff should happen within 3s');
  assert.equal(buddy.ammoReserve, 120, 'donor gave up half a mag (30)');
  assert.equal(u.ammoReserve, 30, 'receiver took 30 rounds');
  assert.equal(u.ammo, 0, 'the mag is not seated yet');
  assert.ok(
    (u.reloadingUntil ?? 0) > s.time,
    'the receiver is seating the fresh mag',
  );
  assert.ok(
    (buddy.ammoShareUntil ?? 0) > s.time,
    'the donor is also in the share animation',
  );
  assert.equal(
    u.ammoBuddyUid,
    undefined,
    'the buddy link clears once the mag changes hands',
  );
  return { sharedAt, receiverReserve: u.ammoReserve, donorReserve: buddy.ammoReserve };
});

check('E. after the reload seats, the rifleman is back in the fight', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  run(s, 2 * DT);
  makeDry(s, u);
  freeze(u);
  donor(s, 174);
  assert.ok(
    runUntil(s, () => (u.ammoShareUntil ?? 0) > s.time, 3) !== null,
    'handoff should happen',
  );
  const reloadedAt = runUntil(s, () => u.ammo > 0, 5);
  assert.ok(reloadedAt !== null, 'the 2.5s reload should complete');
  assert.equal(u.ammo, 30, 'a full magazine is seated');
  assert.equal(u.ammoReserve, 0, 'the shared rounds are now in the weapon');
  return { reloadedAt, ammo: u.ammo, reserve: u.ammoReserve };
});

check('F. a non-dry soldier drops any stale ammo-buddy link', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  run(s, 2 * DT); // seated 30/150 — not dry
  u.ammoBuddyUid = 999;
  run(s, DT);
  assert.equal(
    u.ammoBuddyUid,
    undefined,
    'the stale link should clear once he has ammunition',
  );
  return { cleared: u.ammoBuddyUid === undefined };
});

check('G. a pinned dry man waves but stays put under fire', () => {
  const s = arena();
  const u = grunt(s, 0, 100);
  run(s, 2 * DT);
  makeDry(s, u);
  freeze(u);
  u.suppression = 100; // pinned: decays ~7/s, still ~89 after 1.5s
  const buddy = donor(s, 174);
  u.ammoSearchAt = 0; // re-arm the search now that the donor exists
  run(s, 1.5);
  assert.ok(
    (u.ammoSignalAt ?? 0) > s.time,
    'he should have signalled at least once',
  );
  assert.equal(
    u.ammoBuddyUid,
    buddy.uid,
    'he still tracks who has the ammunition',
  );
  assert.ok(
    u.x - 100 < 5,
    `a pinned soldier must not walk into the open, drifted ${(u.x - 100).toFixed(2)}px`,
  );
  return { drift: +(u.x - 100).toFixed(2), suppression: +u.suppression.toFixed(1) };
});

// ===========================================================================
// Animation: the signal and the handoff read on the field
// ===========================================================================

function stubUnit(overrides = {}) {
  return {
    uid: 1,
    id: 'infantry',
    hp: 100,
    maxHp: 100,
    moving: false,
    fire: 0,
    aimUntil: 0,
    suppression: 0,
    digging: false,
    tending: false,
    tendingTime: 0,
    draggingUid: undefined,
    vacuum: false,
    fragThrow: 0,
    pose: 'idle',
    facing: 1,
    wounded: false,
    crawling: false,
    woundedFromPose: 'idle',
    woundedTime: 0,
    surrendered: false,
    surrenderTime: 0,
    rappelling: false,
    backpedaling: false,
    walk: 0,
    motion: 'ground',
    motionTime: 0,
    motionDuration: 0,
    motionToX: 0,
    climbing: 0,
    climbDuration: 0,
    climbFrom: 0,
    signalUntil: 0,
    ackUntil: 0,
    reloadingUntil: 0,
    overheatedUntil: 0,
    tactic: 'cover',
    flash: 0,
    ammoShareUntil: 0,
    ammoSignalUntil: 0,
    ...overrides,
  };
}

const action = (i) => ({ group: 'actions20', index: i });

check('H. during a handoff the giver extends the mag and the receiver hunches', () => {
  // v86: the pair splits into a giver (arm extended) and a receiver
  // (hunched over the mag well) instead of two identical hunches.
  const giver = adultFrameChoice(stubUnit({ ammoShareUntil: 10 }), 3.0);
  assert.deepEqual(giver, action(9));
  const receiver = adultFrameChoice(
    stubUnit({ ammoShareUntil: 10, reloadingUntil: 11 }),
    3.0,
  );
  assert.deepEqual(receiver, action(13));
  return { giver, receiver };
});

check('I. a prone soldier does not huddle — he stays on the deck', () => {
  const c = adultFrameChoice(
    stubUnit({ ammoShareUntil: 10, pose: 'prone' }),
    3.0,
  );
  assert.notDeepEqual(c, action(13), 'prone must not pop up to work the weapon');
  return c;
});

check('J. a dry, upright soldier waves or checks his mag well', () => {
  const c = adultFrameChoice(stubUnit({ ammoSignalUntil: 1.4 }), 0.5);
  assert.ok(
    (c.group === 'actions20' && (c.index === 8 || c.index === 13)),
    `expected a wave (8) or mag-well check (13), got ${JSON.stringify(c)}`,
  );
  return c;
});

check('K. a moving soldier does not wave — he keeps his stride', () => {
  const c = adultFrameChoice(
    stubUnit({ ammoSignalUntil: 1.4, moving: true, walk: 2 }),
    0.5,
  );
  assert.ok(
    !(c.group === 'actions20' && c.index === 8),
    `a moving man must not wave, got ${JSON.stringify(c)}`,
  );
  return c;
});

check('L. the signal alternates between the overhead wave and the mag check', () => {
  const u = stubUnit({ ammoSignalUntil: 1.4 });
  const seen = new Set();
  for (let t = 0; t < 1.35; t += 0.05) {
    const c = adultFrameChoice(u, t);
    if (c.group === 'actions20') seen.add(c.index);
  }
  assert.ok(seen.has(8), 'the overhead wave appears');
  assert.ok(seen.has(13), 'the mag-well check appears');
  return { frames: [...seen] };
});

check('M. a live handoff outranks the wave — the share pose always wins', () => {
  const u = stubUnit({ ammoShareUntil: 10, ammoSignalUntil: 10 });
  for (let t = 0; t < 9; t += 0.5) {
    assert.deepEqual(
      adultFrameChoice(u, t),
      action(9),
      `share pose must hold at t=${t}`,
    );
  }
  return { priority: 'share > signal' };
});

check('N. a prone soldier does not wave for ammo — he stays low', () => {
  const c = adultFrameChoice(
    stubUnit({ ammoSignalUntil: 1.4, pose: 'prone' }),
    0.5,
  );
  assert.ok(
    !(c.group === 'actions20' && c.index === 8),
    `a pinned man must not pop up to wave, got ${JSON.stringify(c)}`,
  );
  return c;
});

fs.writeFileSync(
  path.join(out, 'checks.json'),
  JSON.stringify({ results, failures }, null, 2),
);
console.log(`\n${results.length} checks, ${failures.length} failures`);
if (failures.length) process.exit(1);
