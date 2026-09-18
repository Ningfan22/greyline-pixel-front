// v117: animation-layer verification for the per-soldier animation pass.
// 1. Firing from a knee or the deck alternates between two frames so a burst
//    reads as recoil instead of a frozen pose (primary and secondary).
// 2. Contact callout: a soldier who spots the enemy shouts the bearing, arm
//    up and pointing, alternating with the alert stand so it waves.
// 3. Heard-contact glance: a squad mate snaps toward a shouted bearing for a
//    beat before making their own contact.
// 4. Bounding rest: after a bound the lead element drops to a knee.
// 5. idlePoseChoice composes the new layers in priority order.
// 6. Standing secondary-weapon discharge gets its own arm-forward frame.
// 7. Leader signal and ack waves are never a "plain" frame, so the renderer's
//    patrol overlay can't swallow the gesture the way it used to.
import assert from 'node:assert/strict';
import {
  adultFrameChoice,
  contactCalloutChoice,
  heardContactGlanceChoice,
  boundingRestChoice,
  idlePoseChoice,
} from '../game/adult-animation.ts';

const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
  } catch (error) {
    results.push({ name, ok: false, error: error.message });
  }
}

// Minimal unit stub with every field the animation layer reads. Fresh
// stubs start with poseAnimSeen undefined, exactly like a unit the renderer
// has never drawn; poseTransitionChoice seeds it on first use and stays
// transparent for the rest of the case.
function stubUnit(overrides = {}) {
  return {
    uid: 1,
    id: 'infantry',
    hp: 100,
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
    woundedFromPose: undefined,
    woundedTime: 0,
    crawling: false,
    surrendered: false,
    surrenderTime: 0,
    rappelling: false,
    climbing: 0,
    climbDuration: 1,
    motion: 'ground',
    motionTime: 0,
    motionDuration: 0,
    reloadingUntil: 0,
    reloadingStartAt: undefined,
    fragThrow: 0,
    tendingTime: 0,
    flash: 0,
    tactic: 'advance',
    signalUntil: 0,
    squadOrder: undefined,
    side: 0,
    overheatedUntil: 0,
    calloutUntil: 0,
    calloutDir: undefined,
    heardContactAt: undefined,
    heardContactDir: undefined,
    contactUntil: 0,
    boundRestUntil: 0,
    ackUntil: 0,
    ammoShareUntil: 0,
    scavengeUntil: 0,
    firstAidUntil: 0,
    ammoSignalUntil: 0,
    blastGlanceUntil: 0,
    blastGlanceDir: undefined,
    traceGlanceUntil: 0,
    traceGlanceDir: undefined,
    poseAnimSeen: undefined,
    poseAnimFrom: undefined,
    poseAnimAt: undefined,
    vacuum: false,
    facing: 1,
    ...overrides,
  };
}

const isPlain = (c) =>
  c.group === 'walk8' || (c.group === 'actions20' && c.index === 0);

// --- Firing from a knee / the deck: two-frame recoil alternation ---

test('crouched fire alternates kneel with hunched brace', () => {
  // floor(0.1*14)=1 → odd beat → brace frame
  const a = adultFrameChoice(stubUnit({ pose: 'crouch', fire: 0.1 }), 0);
  assert.equal(a.group, 'actions20');
  assert.equal(a.index, 13, 'hunched brace on the odd beat');
  // floor(0.2*14)=2 → even beat → kneel frame
  const b = adultFrameChoice(stubUnit({ pose: 'crouch', fire: 0.2 }), 0);
  assert.equal(b.index, 1, 'back to the kneel on the even beat');
});

test('prone fire alternates lie with prone-reload frame', () => {
  const a = adultFrameChoice(stubUnit({ pose: 'prone', fire: 0.1 }), 0);
  assert.equal(a.group, 'actions20');
  assert.equal(a.index, 3, 'prone working frame on the odd beat');
  const b = adultFrameChoice(stubUnit({ pose: 'prone', fire: 0.2 }), 0);
  assert.equal(b.index, 2, 'flat lie on the even beat');
});

test('crouched secondary fire uses the same recoil alternation', () => {
  const c = adultFrameChoice(
    stubUnit({ pose: 'crouch', secondaryFire: 0.1 }),
    0,
  );
  assert.equal(c.group, 'actions20');
  assert.equal(c.index, 13, 'underslung shot from a knee braces the same way');
});

test('prone secondary fire uses the same recoil alternation', () => {
  const c = adultFrameChoice(
    stubUnit({ pose: 'prone', secondaryFire: 0.1 }),
    0,
  );
  assert.equal(c.group, 'actions20');
  assert.equal(c.index, 3, 'underslung shot from the deck works the weapon');
});

// --- Contact callout ---

test('contact callout points at the threat on the gesture beat', () => {
  // calloutUntil=1.0, time=0.1 → wave=floor(0.9*6)=5 → odd → gesture beat
  const c = contactCalloutChoice(
    stubUnit({ calloutUntil: 1.0, calloutDir: -1 }),
    0.1,
  );
  assert.equal(c.group, 'actions20');
  assert.equal(c.index, 9, 'arm up, pointing');
  assert.equal(c.dir, -1, 'pointing at the contact bearing');
});

test('contact callout drops to the alert stand on the pump beat', () => {
  // time=0 → wave=floor(6)=6 → even → alert stand, still facing the threat
  const c = contactCalloutChoice(
    stubUnit({ calloutUntil: 1.0, calloutDir: -1 }),
    0,
  );
  assert.equal(c.index, 0, 'alert stand between points so the shout waves');
  assert.equal(c.dir, -1, 'keeps facing the contact on the pump beat');
});

test('contact callout defaults to facing +x with no stamped dir', () => {
  const c = contactCalloutChoice(stubUnit({ calloutUntil: 1.0 }), 0.1);
  assert.equal(c.index, 9);
  assert.equal(c.dir, 1, 'unstamped dir falls back to +x');
});

test('contact callout yields to a man already in the fight', () => {
  assert.equal(
    contactCalloutChoice(stubUnit({ calloutUntil: 1.0, moving: true }), 0.1),
    null,
    'moving',
  );
  assert.equal(
    contactCalloutChoice(stubUnit({ calloutUntil: 1.0, fire: 0.1 }), 0.1),
    null,
    'firing',
  );
  assert.equal(
    contactCalloutChoice(stubUnit({ calloutUntil: 1.0, aimUntil: 1.0 }), 0.1),
    null,
    'aiming',
  );
  assert.equal(
    contactCalloutChoice(
      stubUnit({ calloutUntil: 1.0, reloadingUntil: 1.0 }),
      0.1,
    ),
    null,
    'reloading',
  );
  assert.equal(
    contactCalloutChoice(
      stubUnit({ calloutUntil: 1.0, pose: 'crouch' }),
      0.1,
    ),
    null,
    'crouched — only upright soldiers call out',
  );
});

// --- Heard-contact glance ---

test('heard-contact glance snaps to the shouted bearing', () => {
  const c = heardContactGlanceChoice(
    stubUnit({ heardContactAt: 0, heardContactDir: -1 }),
    0.5,
  );
  assert.equal(c.group, 'actions20');
  assert.equal(c.index, 0, 'alert stand');
  assert.equal(c.dir, -1, 'looking toward the shout');
});

test('heard-contact glance expires after 0.7s', () => {
  assert.equal(
    heardContactGlanceChoice(stubUnit({ heardContactAt: 0 }), 0.8),
    null,
    'glance window closed',
  );
});

test('heard-contact glance is suppressed by own contact', () => {
  assert.equal(
    heardContactGlanceChoice(
      stubUnit({ heardContactAt: 0, contactUntil: 1.0 }),
      0.5,
    ),
    null,
    'a man in the fight ignores second-hand shouts',
  );
});

test('heard-contact glance yields to movement', () => {
  assert.equal(
    heardContactGlanceChoice(
      stubUnit({ heardContactAt: 0, moving: true }),
      0.5,
    ),
    null,
  );
});

// --- Bounding rest ---

test('bounding rest drops the lead element to a knee', () => {
  const c = boundingRestChoice(stubUnit({ boundRestUntil: 1.0 }), 0.1);
  assert.equal(c.group, 'actions20');
  assert.equal(c.index, 1, 'single-knee rest after the bound');
});

test('bounding rest yields to movement, fire and expiry', () => {
  assert.equal(
    boundingRestChoice(stubUnit({ boundRestUntil: 1.0, moving: true }), 0.1),
    null,
    'moving',
  );
  assert.equal(
    boundingRestChoice(stubUnit({ boundRestUntil: 1.0, fire: 0.1 }), 0.1),
    null,
    'firing',
  );
  assert.equal(
    boundingRestChoice(stubUnit({ boundRestUntil: 0.5 }), 1.0),
    null,
    'rest window over',
  );
});

// --- idlePoseChoice composition ---

test('idlePoseChoice: contact callout outranks a blast glance', () => {
  const c = idlePoseChoice(
    stubUnit({ calloutUntil: 1.0, blastGlanceUntil: 1.0 }),
    0.1,
  );
  assert.equal(c.group, 'actions20');
  assert.equal(c.index, 9, 'shouting the contact, not glancing at the blast');
});

test('idlePoseChoice: bounding rest beats the routine scan', () => {
  const c = idlePoseChoice(stubUnit({ boundRestUntil: 1.0 }), 0.1);
  assert.equal(c.group, 'actions20');
  assert.equal(c.index, 1, 'knee rest ahead of sector scan and fidgets');
});

test('idlePoseChoice: a fresh ack suppresses every idle layer', () => {
  const c = idlePoseChoice(
    stubUnit({ ackUntil: 1.0, calloutUntil: 1.0, boundRestUntil: 1.0 }),
    0.1,
  );
  assert.equal(c, null, 'ack is answered by adultFrameChoice, not the idle layer');
});

// --- Standing secondary-weapon discharge ---

test('standing secondary fire gets its own arm-forward frame', () => {
  const c = adultFrameChoice(stubUnit({ secondaryFire: 0.09 }), 0);
  assert.equal(c.group, 'actions20');
  assert.equal(c.index, 9, 'GL/pistol shot reads as its own beat');
});

test('secondary fire while moving stays in the walk cycle', () => {
  const c = adultFrameChoice(
    stubUnit({ secondaryFire: 0.09, moving: true, walk: 2 }),
    0,
  );
  assert.equal(c.group, 'walk8', 'movement owns the frame');
});

test('secondary fire from a knee routes through the crouch branch', () => {
  const c = adultFrameChoice(
    stubUnit({ secondaryFire: 0.09, pose: 'crouch' }),
    0,
  );
  assert.equal(c.group, 'actions20');
  assert.equal(c.index, 13, 'crouch brace, not the standing arm-forward frame');
});

// --- Signal / ack waves are never plain frames (patrol overlay guard) ---

test('leader signal wave never lands on a plain frame', () => {
  for (const order of ['attack', 'retreat', 'escort', 'hold']) {
    const u = stubUnit({ signalUntil: 1.0, squadOrder: order });
    for (let t = 0; t < 1.0; t += 0.05) {
      const c = adultFrameChoice(u, t);
      assert.ok(
        !isPlain(c),
        `${order} signal at t=${t.toFixed(2)} landed on plain frame ${c.group}:${c.index}`,
      );
    }
  }
});

test('ack wave never lands on a plain frame', () => {
  const u = stubUnit({ ackUntil: 1.0 });
  for (let t = 0; t < 1.0; t += 0.05) {
    const c = adultFrameChoice(u, t);
    assert.ok(
      !isPlain(c),
      `ack at t=${t.toFixed(2)} landed on plain frame ${c.group}:${c.index}`,
    );
  }
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
