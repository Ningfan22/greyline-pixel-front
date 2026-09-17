import assert from 'node:assert/strict';
import { adultFrameChoice } from '../game/adult-animation.ts';

const results = [];
function test(name, fn) {
  try {
    const value = fn();
    results.push({ name, ok: true, ...value });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}

function stubUnit(overrides = {}) {
  return {
    uid: 1,
    id: 'infantry',
    hp: 100,
    maxHp: 100,
    moving: false,
    fire: 0,
    secondaryFire: 0,
    aimUntil: 0,
    suppression: 0,
    digging: false,
    tending: false,
    draggingUid: undefined,
    pose: 'idle',
    walk: 0,
    backpedaling: false,
    wounded: false,
    crawling: false,
    surrendered: false,
    rappelling: false,
    climbing: 0,
    climbDuration: 1,
    motion: 'ground',
    motionTime: 0,
    motionDuration: 0,
    reloadingUntil: 0,
    fragThrow: 0,
    tendingTime: 0,
    woundedTime: 0,
    woundedFromPose: undefined,
    surrenderTime: 0,
    flash: 0,
    tactic: 'advance',
    ...overrides,
  };
}
const action = (index) => ({ group: 'actions20', index });

// --- v119: emplacement crews work the gun while setting up ---

test('emplacement setup: crew alternates work beats (index 1 or 13)', () => {
  const seen = new Set();
  for (const uid of [1, 2, 3, 4]) {
    const c = adultFrameChoice(
      stubUnit({ uid, pose: 'idle', emplacementSetupUntil: 10 }),
      0,
    );
    assert.equal(c.group, 'actions20');
    assert.ok([1, 13].includes(c.index), `unexpected index ${c.index}`);
    seen.add(c.index);
  }
  assert.equal(seen.size, 2, 'both work beats should appear across uids');
  return { frames: [...seen] };
});

test('emplacement setup: prone crew stays low (no work beats)', () => {
  const c = adultFrameChoice(
    stubUnit({ pose: 'prone', emplacementSetupUntil: 10 }),
    0,
  );
  assert.equal(c.group, 'actions20');
  assert.equal(c.index, 2, 'prone idle is the lie frame');
  return { index: c.index };
});

// --- v119: crouched overwatch keeps the gun shouldered between bursts ---

test('crouch + aimUntil: alternates kneel and brace (index 1 or 13)', () => {
  const seen = new Set();
  for (const uid of [1, 4, 7, 10]) {
    const c = adultFrameChoice(
      stubUnit({ uid, pose: 'crouch', aimUntil: 10 }),
      0,
    );
    assert.equal(c.group, 'actions20');
    assert.ok([1, 13].includes(c.index), `unexpected index ${c.index}`);
    seen.add(c.index);
  }
  assert.equal(seen.size, 2);
  return { frames: [...seen] };
});

test('crouch without aimUntil: plain kneel (index 1)', () => {
  const c = adultFrameChoice(stubUnit({ pose: 'crouch', aimUntil: 0 }), 0);
  assert.deepEqual(c, action(1));
  return { index: c.index };
});

// --- v119: prone overwatch works the weapon between bursts ---

test('prone + aimUntil: alternates lie and work (index 2 or 3)', () => {
  const seen = new Set();
  for (const uid of [1, 4, 7, 10]) {
    const c = adultFrameChoice(
      stubUnit({ uid, pose: 'prone', aimUntil: 10 }),
      0,
    );
    assert.equal(c.group, 'actions20');
    assert.ok([2, 3].includes(c.index), `unexpected index ${c.index}`);
    seen.add(c.index);
  }
  assert.equal(seen.size, 2);
  return { frames: [...seen] };
});

test('prone without aimUntil: plain lie (index 2)', () => {
  const c = adultFrameChoice(stubUnit({ pose: 'prone', aimUntil: 0 }), 0);
  assert.deepEqual(c, action(2));
  return { index: c.index };
});

let failed = 0;
for (const r of results) {
  if (r.ok) console.log(`  ok - ${r.name}`);
  else {
    failed++;
    console.error(`  FAIL - ${r.name}: ${r.error}`);
  }
}
console.log(`${results.length - failed}/${results.length} passed`);
if (failed) process.exit(1);
