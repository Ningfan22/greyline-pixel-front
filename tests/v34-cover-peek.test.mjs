import assert from 'node:assert/strict';
import {
  coverProp,
  coverPropKind,
  peekRise,
  transportCrewCount,
  transportCrewSlot,
} from '../game/cover-animation.ts';

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

// --- coverPropKind -----------------------------------------------------------

test('coverPropKind returns null below the 0.2 threshold', () => {
  assert.equal(coverPropKind(0), null);
  assert.equal(coverPropKind(0.19), null);
});

test('coverPropKind maps light cover to rubble and heavy to sandbags', () => {
  assert.equal(coverPropKind(0.2), 'rubble');
  assert.equal(coverPropKind(0.54), 'rubble');
  assert.equal(coverPropKind(0.55), 'sandbags');
  assert.equal(coverPropKind(1), 'sandbags');
});

// --- coverProp ---------------------------------------------------------------

test('coverProp is deterministic for the same uid and cover', () => {
  const a = coverProp(42, 0.8);
  const b = coverProp(42, 0.8);
  assert.deepEqual(a, b);
});

test('coverProp returns no blocks below threshold', () => {
  assert.deepEqual(coverProp(7, 0.1), []);
});

test('sandbag prop has two staggered courses (4 + 3 blocks)', () => {
  const blocks = coverProp(1, 0.9);
  assert.equal(blocks.length, 7);
  // Bottom course rests on the ground (dy 0), top course sits 5px up.
  assert.equal(blocks.filter((b) => b.dy === 0).length, 4);
  assert.equal(blocks.filter((b) => b.dy === 5).length, 3);
  // Top course is staggered: its mean dx is offset from the bottom course.
  const bottom = blocks.filter((b) => b.dy === 0);
  const top = blocks.filter((b) => b.dy === 5);
  const mean = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;
  assert.notEqual(
    Math.round(mean(bottom.map((b) => b.dx))),
    Math.round(mean(top.map((b) => b.dx))),
    'top course should be staggered relative to bottom',
  );
});

test('rubble prop is an irregular pile of 5-7 blocks', () => {
  for (let uid = 1; uid <= 20; uid++) {
    const blocks = coverProp(uid, 0.3);
    assert.ok(
      blocks.length >= 5 && blocks.length <= 7,
      `uid ${uid}: expected 5-7 rubble blocks, got ${blocks.length}`,
    );
  }
});

test('cover blocks carry positive dimensions and earthy colors', () => {
  for (const b of coverProp(99, 0.9)) {
    assert.ok(b.w > 0 && b.h > 0, 'blocks must have positive size');
    assert.match(b.color, /^#[0-9a-f]{6}$/);
  }
});

// --- peekRise ----------------------------------------------------------------

test('peekRise is zero for same-pose and lateral transitions', () => {
  assert.equal(peekRise('idle', 'idle', 0), 0);
  assert.equal(peekRise('walk', 'run', 0.05), 0);
  assert.equal(peekRise('crouch', 'prone', 0.05), 0);
  assert.equal(peekRise('prone', 'crouch', 0.05), 0);
});

test('rising from crouch/prone starts sunk and eases up to 0', () => {
  const at0 = peekRise('crouch', 'idle', 0);
  assert.ok(at0 > 0, 'should start shifted down (positive offset)');
  assert.equal(at0, 4, 'crouch rise amplitude is 4px');
  assert.equal(peekRise('prone', 'idle', 0), 6, 'prone rise amplitude is 6px');
  // Halfway through the 0.16s window the offset has eased off but not vanished.
  const mid = peekRise('crouch', 'idle', 0.08);
  assert.ok(mid > 0 && mid < 4, 'should be mid-ease at 0.08s');
  assert.equal(peekRise('crouch', 'idle', 0.16), 0, 'settles at 0 after 0.16s');
  assert.equal(peekRise('crouch', 'idle', 1), 0, 'stays at 0 well after');
});

test('dropping from stand eases down: 0 at first, positive by the end', () => {
  assert.equal(
    peekRise('idle', 'crouch', 0),
    0,
    'drop starts from the standing sprite position',
  );
  const mid = peekRise('idle', 'crouch', 0.07);
  assert.ok(mid > 0 && mid < 4, 'should be sinking at 0.07s');
  assert.equal(peekRise('idle', 'crouch', 0.14), 4, 'fully sunk after 0.14s');
  assert.equal(peekRise('idle', 'prone', 0.14), 6, 'prone drop amplitude is 6px');
});

// --- transportCrewCount ------------------------------------------------------

test('transportCrewCount decrements as troops drop', () => {
  assert.equal(transportCrewCount(5, 0), 3, 'capped at the 3 visible slots');
  assert.equal(transportCrewCount(5, 2), 3);
  assert.equal(transportCrewCount(5, 3), 2);
  assert.equal(transportCrewCount(5, 5), 0);
});

test('transportCrewCount clamps to [0, 3]', () => {
  assert.equal(transportCrewCount(2, 0), 2);
  assert.equal(transportCrewCount(2, 5), 0);
  assert.equal(transportCrewCount(5, -3), 3);
});

// --- transportCrewSlot -------------------------------------------------------

test('single crew member rides the centered middle slot', () => {
  const slot = transportCrewSlot(0, 1, 0, 11);
  assert.equal(slot.dx, 2, 'middle slot dx is 2');
  // Base dy is -28; the gentle airframe bob shifts it by at most ±2.
  assert.ok(
    slot.dy >= -30 && slot.dy <= -26,
    `middle slot dy ~-28 (got ${slot.dy})`,
  );
});

test('three crew members fill all three door slots', () => {
  const dxs = [0, 1, 2].map((i) => transportCrewSlot(i, 3, 0, 5).dx);
  assert.deepEqual(dxs, [-11, 2, 13]);
});

test('two crew members use the two centered slots', () => {
  const dxs = [0, 1].map((i) => transportCrewSlot(i, 2, 0, 5).dx);
  assert.deepEqual(dxs, [-11, 2]);
});

test('crew head bob stays bounded and varies with time', () => {
  const base = transportCrewSlot(0, 3, 0, 7).dy;
  let sawDelta = false;
  for (let t = 0; t <= 2; t += 0.05) {
    const dy = transportCrewSlot(0, 3, t, 7).dy;
    assert.ok(Math.abs(dy - base) <= 2, 'bob within ±2px of base');
    if (dy !== base) sawDelta = true;
  }
  assert.ok(sawDelta, 'bob should actually move over time');
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.error(failed.map((f) => f.error).join('\n'));
  process.exit(1);
}
