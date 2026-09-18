import assert from 'node:assert/strict';
import { adultFrameChoice } from '../game/adult-animation.ts';

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}

// Minimal unit stub with every field adultFrameChoice reads before reaching
// the v81/v83/v84 action branches.
function stubUnit(overrides = {}) {
  return {
    uid: 1,
    id: 'infantry',
    hp: 100,
    walk: 0,
    backpedaling: false,
    rappelling: false,
    surrendered: false,
    surrenderTime: 0,
    wounded: false,
    crawling: false,
    woundedFromPose: 'idle',
    woundedTime: 0,
    fragThrow: 0,
    tending: false,
    tendingTime: 0,
    overheatedUntil: 0,
    motion: undefined,
    motionTime: 0,
    motionDuration: 0,
    climbing: 0,
    climbDuration: 0,
    signalUntil: 0,
    ackUntil: 0,
    aimUntil: 0,
    reloadingUntil: 0,
    ammoSignalUntil: 0,
    ammoShareUntil: 0,
    scavengeUntil: 0,
    firstAidUntil: 0,
    pose: 'idle',
    moving: false,
    fire: 0,
    suppression: 0,
    draggingUid: undefined,
    tactic: 'advance',
    flash: 0,
    facing: 1,
    ...overrides,
  };
}

// --- v81 ammo share: giver and receiver strike different poses ---

test('ammo-share receiver (mid-reload) hunches over the mag well', () => {
  const u = stubUnit({ ammoShareUntil: 10, reloadingUntil: 11 });
  assert.deepEqual(adultFrameChoice(u, 9.5), {
    group: 'actions20',
    index: 13,
  });
});

test('ammo-share giver (not reloading) extends the magazine', () => {
  const u = stubUnit({ uid: 2, ammoShareUntil: 10, reloadingUntil: 0 });
  assert.deepEqual(adultFrameChoice(u, 9.5), {
    group: 'actions20',
    index: 9,
  });
});

test('an ammo-share pair never shows identical poses', () => {
  const receiver = stubUnit({
    uid: 5,
    ammoShareUntil: 10,
    reloadingUntil: 11,
  });
  const giver = stubUnit({ uid: 6, ammoShareUntil: 10, reloadingUntil: 0 });
  for (let t = 9.0; t < 10.0; t += 0.1) {
    assert.notDeepEqual(
      adultFrameChoice(receiver, t),
      adultFrameChoice(giver, t),
      `pair mirrored at t=${t}`,
    );
  }
});

// --- v83 scavenge: alternates between knee-rummage and huddle ---

test('scavenging alternates between the knee and huddle beats', () => {
  const u = stubUnit({ uid: 3, scavengeUntil: 10 });
  const seen = new Set();
  for (let t = 9.0; t < 10.0; t += 0.05) {
    const c = adultFrameChoice(u, t);
    assert.equal(c.group, 'actions20');
    assert.ok(
      [1, 13].includes(c.index),
      `unexpected scavenge index ${c.index} at t=${t}`,
    );
    seen.add(c.index);
  }
  assert.equal(seen.size, 2, 'both beats should appear over the window');
});

// --- v84 first aid: medic kneel / low-crouch rhythm ---

test('first aid alternates between medic kneel and low crouch', () => {
  const u = stubUnit({ uid: 4, firstAidUntil: 10 });
  const seen = new Set();
  for (let t = 9.0; t < 10.0; t += 0.05) {
    const c = adultFrameChoice(u, t);
    const key = `${c.group}:${c.index}`;
    assert.ok(
      (c.group === 'actions20' && c.index === 17) ||
        (c.group === 'reactions8' && c.index === 5),
      `unexpected first-aid choice ${key} at t=${t}`,
    );
    seen.add(key);
  }
  assert.equal(seen.size, 2, 'both beats should appear over the window');
});

// --- the three behaviors now have distinct visual signatures ---

test('the three behaviors show different frame sets over their windows', () => {
  const frames = (u) => {
    const s = new Set();
    for (let t = 9.0; t < 10.0; t += 0.05) {
      const c = adultFrameChoice(u, t);
      s.add(`${c.group}:${c.index}`);
    }
    return s;
  };
  const share = frames(
    stubUnit({ uid: 7, ammoShareUntil: 10, reloadingUntil: 11 }),
  );
  const scav = frames(stubUnit({ uid: 7, scavengeUntil: 10 }));
  const aid = frames(stubUnit({ uid: 7, firstAidUntil: 10 }));
  assert.deepEqual(share, new Set(['actions20:13']));
  assert.deepEqual(scav, new Set(['actions20:1', 'actions20:13']));
  assert.deepEqual(aid, new Set(['actions20:17', 'reactions8:5']));
});

// --- guards: prone soldiers skip the action poses ---

test('prone soldiers skip the action animations', () => {
  const u = stubUnit({
    pose: 'prone',
    ammoShareUntil: 10,
    reloadingUntil: 11,
  });
  const choice = adultFrameChoice(u, 9.5);
  assert.ok(
    [2, 3].includes(choice.index),
    `expected a prone reload frame, got ${choice.group}:${choice.index}`,
  );
});

// --- Report ---

let failed = 0;
for (const r of results) {
  if (r.ok) {
    console.log(`  ok  ${r.name}`);
  } else {
    failed++;
    console.log(`  FAIL  ${r.name}`);
    console.log(`        ${r.error}`);
  }
}
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
