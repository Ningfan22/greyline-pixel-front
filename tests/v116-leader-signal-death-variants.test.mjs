// v116: animation-layer verification for the v116 polish pass.
// 1. Leader hand signals vary with the squad order — attack points the arm
//    toward the advance, retreat points back toward friendly lines, escort
//    points at the armour with no global flip, and hold/watch keeps the arm
//    raised overhead — so a veteran can read the order off the leader's hand.
// 2. Death throes widened from three to six seed variants so a platoon's
//    worth of wrecks rarely repeats the same sequence.
// 3. Hit flinches widened from two to three uid variants.
import assert from 'node:assert/strict';
import { adultFrameChoice, adultWreckChoice } from '../game/adult-animation.ts';

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
// the signal / flash branches.
function stubUnit(overrides = {}) {
  return {
    uid: 1,
    id: 'infantry',
    hp: 100,
    moving: false,
    fire: 0,
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
    flash: 0,
    tactic: 'advance',
    signalUntil: 0,
    squadOrder: undefined,
    side: 0,
    overheatedUntil: 0,
    ...overrides,
  };
}

// --- Leader hand signals ---

test('attack order points the arm toward the advance on the gesture beat', () => {
  // signalUntil=1.0, time=0.1 → wave = floor(0.9*6)%2 = 1 → gesture beat
  const u = stubUnit({ signalUntil: 1.0, squadOrder: 'attack', side: 0 });
  const c = adultFrameChoice(u, 0.1);
  assert.equal(c.group, 'actions20');
  assert.equal(c.index, 9, 'arm extended forward');
  assert.equal(c.dir, 1, 'side 0 advances toward +x');
});

test('retreat order points the arm back toward friendly lines', () => {
  const u = stubUnit({ signalUntil: 1.0, squadOrder: 'retreat', side: 0 });
  const c = adultFrameChoice(u, 0.1);
  assert.equal(c.index, 9);
  assert.equal(c.dir, -1, 'reversed from the attack direction');
});

test('escort order points at the armour with no global flip', () => {
  const u = stubUnit({ signalUntil: 1.0, squadOrder: 'escort', side: 0 });
  const c = adultFrameChoice(u, 0.1);
  assert.equal(c.index, 9);
  assert.equal(c.dir, undefined, 'escort uses the sprite\'s natural facing');
});

test('hold order keeps the arm raised overhead', () => {
  const u = stubUnit({ signalUntil: 1.0, squadOrder: 'hold', side: 0 });
  const c = adultFrameChoice(u, 0.1);
  assert.equal(c.index, 9, 'gesture beat pumps the arm');
  assert.equal(
    c.dir,
    undefined,
    'hold never points at a bearing — no flip, the arm stays overhead',
  );
});

test('the gesture alternates with the return pump so it waves', () => {
  const u = stubUnit({ signalUntil: 1.0, squadOrder: 'attack', side: 0 });
  // time=0 → wave = floor(6)%2 = 0 → overhead-pump beat
  const c = adultFrameChoice(u, 0);
  assert.equal(c.index, 8, 'overhead pump between gesture points');
  assert.equal(c.dir, 1, 'pointing beat keeps its facing on the pump beat');
});

// --- Death variants ---

test('seed 2 drops straight to the wreck frame', () => {
  const c = adultWreckChoice(0.0, 'idle', 2);
  assert.equal(c.group, 'actions20');
  assert.equal(c.index, 15);
});

test('seed 3 pitches forward onto the face', () => {
  // age 0.1 (< 0.25) → flinch; age 0.3 (>= 0.25) → pitch frame
  assert.equal(adultWreckChoice(0.1, 'idle', 3).index, 4);
  const pitch = adultWreckChoice(0.3, 'idle', 3);
  assert.equal(pitch.group, 'reactions8');
  assert.equal(pitch.index, 7);
});

test('seed 4 sinks slowly at the knees', () => {
  assert.equal(adultWreckChoice(0.1, 'idle', 4).index, 5);
  assert.equal(adultWreckChoice(0.5, 'idle', 4).index, 7);
});

test('seed 5 twists under the impact before dropping', () => {
  const c = adultWreckChoice(0.1, 'idle', 5);
  assert.equal(c.group, 'reactions8');
  assert.equal(c.index, 6);
});

test('the six seeds do not share a single death sequence', () => {
  const sequences = new Set();
  for (let seed = 0; seed < 6; seed++) {
    let key = '';
    for (let age = 0; age < 1.0; age += 0.1) {
      const c = adultWreckChoice(age, 'idle', seed);
      key += c.group[0] + c.index + ';';
    }
    sequences.add(key);
  }
  assert.ok(
    sequences.size >= 5,
    'expected at least 5 distinct death sequences, got ' + sequences.size,
  );
});

// --- Hit flinches ---

test('hit flinch has three uid variants', () => {
  const a = adultFrameChoice(stubUnit({ uid: 0, flash: 0.5 }), 0);
  const b = adultFrameChoice(stubUnit({ uid: 1, flash: 0.5 }), 0);
  const c = adultFrameChoice(stubUnit({ uid: 2, flash: 0.5 }), 0);
  assert.equal(a.group, 'reactions8');
  assert.equal(a.index, 4, 'uid 0 → tall stagger');
  assert.equal(b.index, 5, 'uid 1 → knee-buck');
  assert.equal(c.index, 6, 'uid 2 → deep cower-flinch');
});

// --- Report ---

let failed = 0;
for (const r of results) {
  if (r.ok) {
    console.log('  ok  ' + r.name);
  } else {
    failed++;
    console.log('FAIL ' + r.name + '\n' + r.error);
  }
}
console.log(`${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
