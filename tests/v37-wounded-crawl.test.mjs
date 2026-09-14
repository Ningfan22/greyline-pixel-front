import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  spawnUnit,
  W,
} from '../game/engine.ts';
import { adultFrameChoice } from '../game/adult-animation.ts';

const DT = 1 / 60;
const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log('PASS', name);
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
    console.error('FAIL', name, error.message);
  }
}

function arena() {
  const s = createGame(32001);
  startGame(s);
  // Clear the garrison so each test controls the battlefield exactly.
  Object.assign(s, {
    units: [],
    scenery: [],
    walls: [],
    wrecks: [],
    aiIn: 1e9,
  });
  s.players.forEach((p) => (p.order = 'hold'));
  return s;
}

function run(s, frames) {
  for (let i = 0; i < frames; i++) tick(s, DT);
}

function casualty(s, side, x) {
  spawnUnit(s, side, 'infantry', x);
  const u = s.units.find(
    (u) => u.side === side && Math.abs(u.x - x) < 4,
  );
  u.wounded = true;
  u.woundedFromPose = u.pose;
  u.woundedTime = 0;
  u.bleedOut = 25;
  u.hp = Math.floor(u.maxHp * 0.3);
  u.rescueProgress = 0;
  return u;
}

// --- crawl-back behaviour ------------------------------------------------------

test('after the shock window a side-0 casualty crawls left toward his baseline', () => {
  const s = arena();
  const u = casualty(s, 0, 500);
  run(s, 150); // 2.5s — past the 2.2s shock window
  assert.equal(u.crawling, true, 'the casualty is crawling');
  assert.ok(u.x < 500, `the casualty crawled left (x=${u.x.toFixed(1)})`);
});

test('a casualty does not crawl during the initial shock window', () => {
  const s = arena();
  const u = casualty(s, 0, 500);
  // v41: squadmates would otherwise drag him, which is a separate behaviour.
  for (const m of s.units) if (m !== u) m.personalMorale = 20;
  run(s, 60); // 1.0s — inside the 2.2s shock window
  assert.equal(u.crawling, false, 'no crawling while in shock');
  assert.ok(Math.abs(u.x - 500) < 1, 'the casualty has not moved');
});

test('a casualty recently treated by a medic stays put instead of crawling', () => {
  const s = arena();
  const u = casualty(s, 0, 500);
  u.woundedTime = 3; // past the shock window
  u.rescuedAt = s.time; // a medic just tended him
  run(s, 120);
  assert.equal(u.crawling, false, 'the casualty waits for the medic');
  assert.ok(Math.abs(u.x - 500) < 1, 'the casualty has not moved');
});

test('a casualty with little bleed-out time left does not crawl', () => {
  const s = arena();
  const u = casualty(s, 0, 500);
  // v41: squadmates would otherwise drag him, which is a separate behaviour.
  for (const m of s.units) if (m !== u) m.personalMorale = 20;
  u.woundedTime = 3;
  u.bleedOut = 7; // not enough time to make crawling worthwhile
  run(s, 60);
  assert.equal(u.crawling, false, 'no crawl when bleedOut <= 8');
  assert.ok(Math.abs(u.x - 500) < 1, 'the casualty has not moved');
});

// --- animation -----------------------------------------------------------------

test('the crawl animation alternates between prone frames 2 and 12', () => {
  const s = arena();
  const u = casualty(s, 0, 500);
  run(s, 150); // past shock, now crawling
  const seen = new Set();
  for (let i = 0; i < 90 && u.crawling; i++) {
    seen.add(adultFrameChoice(u).index);
    tick(s, DT);
  }
  assert.ok(seen.has(2), 'prone crawl frame 2 plays');
  assert.ok(seen.has(12), 'prone crawl frame 12 plays');
});

// --- blood trail ----------------------------------------------------------------

test('crawling leaves a trail of blood particles', () => {
  const s = arena();
  const u = casualty(s, 0, 500);
  run(s, 150); // past shock
  const before = s.particles.length;
  run(s, 150); // 2.5s of crawling
  const blood = s.particles
    .slice(before)
    .filter((p) => p.kind === 'blood');
  assert.ok(blood.length >= 1, 'blood drips onto the ground while crawling');
  for (const d of blood) {
    assert.equal(d.color, '#7a2420', 'blood uses the dark-red colour');
    assert.ok(d.life > 0 && d.maxLife === 0.5, 'blood drops are short-lived');
  }
});

// --- medic chase -----------------------------------------------------------------

test('a medic follows a crawling casualty to keep him in treatment range', () => {
  const s = arena();
  const u = casualty(s, 0, 500);
  spawnUnit(s, 0, 'medic', 600, { member: 0 });
  const medic = s.units.find((m) => m.id === 'medic');
  const medicStart = medic.x;
  run(s, 120); // 2.0s
  assert.ok(
    medic.x < medicStart - 20,
    `the medic advanced toward the casualty (x ${medicStart.toFixed(1)} -> ${medic.x.toFixed(1)})`,
  );
  assert.ok(
    Math.abs(medic.x - u.x) < 100,
    'the medic closed the gap on the crawling casualty',
  );
});

// --- clamp -----------------------------------------------------------------------

test('a casualty crawls only as far as his own baseline and never leaves the map', () => {
  const s = arena();
  const u = casualty(s, 0, 300);
  u.x = 105; // place him just past the 104px stop line
  run(s, 300); // 5s
  assert.ok(u.x >= 90, `the casualty never crosses the baseline clamp (x=${u.x.toFixed(1)})`);
  assert.ok(u.x <= 105, 'the casualty only crawled toward his baseline');
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error(failed.map((f) => f.error).join('\n'));
  process.exit(1);
}
