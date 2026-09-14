import assert from 'node:assert/strict';
import {
  createGame,
  startGame,
  tick,
  emitParticle,
} from '../game/engine.ts';

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

function arena(seed = 40001) {
  const s = createGame(seed);
  startGame(s);
  s.aiIn = 1e6;
  s.terrain.fill(374);
  s.original.fill(374);
  s.scenery = [];
  s.walls = [];
  return s;
}

function run(s, seconds) {
  for (let i = 0; i < Math.round(seconds * 60); i++) tick(s, DT);
}

// --- recycling -------------------------------------------------------------------

test('dead particles are returned to the pool instead of being dropped', () => {
  const s = arena();
  for (let i = 0; i < 10; i++) {
    emitParticle(s, {
      x: 100 + i,
      y: 300,
      vx: 0,
      vy: 0,
      life: 0.05,
      maxLife: 0.05,
      color: '#888',
      size: 2,
      kind: 'smoke',
    });
  }
  assert.equal(s.particles.length, 10, 'all ten should be live');
  run(s, 0.2);
  assert.equal(s.particles.length, 0, 'all should have died');
  assert.ok(
    (s.particlePool?.length ?? 0) >= 10,
    `the dead particles should be pooled, got ${s.particlePool?.length ?? 0}`,
  );
});

test('a fresh emission reuses a pooled object and shrinks the pool', () => {
  const s = arena();
  emitParticle(s, {
    x: 50,
    y: 300,
    vx: 0,
    vy: 0,
    life: 0.05,
    maxLife: 0.05,
    color: '#888',
    size: 2,
    kind: 'smoke',
  });
  run(s, 0.2);
  const pooled = s.particlePool.length;
  assert.ok(pooled > 0, 'need a pooled object to reuse');
  emitParticle(s, {
    x: 60,
    y: 300,
    vx: 0,
    vy: 0,
    life: 1,
    maxLife: 1,
    color: '#fff',
    size: 3,
    kind: 'dust',
  });
  assert.equal(
    s.particlePool.length,
    pooled - 1,
    'emission should pop one object back out of the pool',
  );
  assert.equal(s.particles.length, 1, 'the reused object should be live again');
});

// --- stale field clearing ---------------------------------------------------------

test('reusing a tracer object for smoke clears its stale endX/endY fields', () => {
  const s = arena();
  emitParticle(s, {
    x: 50,
    y: 300,
    vx: 0,
    vy: 0,
    life: 0.05,
    maxLife: 0.05,
    color: '#ffd',
    size: 1,
    kind: 'tracer',
    endX: 999,
    endY: 888,
  });
  run(s, 0.2);
  assert.equal(s.particlePool.length, 1, 'the tracer should be pooled');
  emitParticle(s, {
    x: 60,
    y: 300,
    vx: 0,
    vy: 0,
    life: 1,
    maxLife: 1,
    color: '#888',
    size: 2,
    kind: 'smoke',
  });
  const p = s.particles[0];
  assert.equal(p.kind, 'smoke', 'the object should now be smoke');
  assert.equal(
    p.endX,
    undefined,
    `stale tracer endX must be wiped, got ${p.endX}`,
  );
  assert.equal(
    p.endY,
    undefined,
    `stale tracer endY must be wiped, got ${p.endY}`,
  );
});

test('reusing an impact object for a tracer leaves no stale variant', () => {
  const s = arena();
  emitParticle(s, {
    x: 50,
    y: 300,
    vx: 0,
    vy: 0,
    life: 0.05,
    maxLife: 0.05,
    color: '#fc6',
    size: 2,
    kind: 'impact',
    variant: 7,
  });
  run(s, 0.2);
  emitParticle(s, {
    x: 60,
    y: 300,
    vx: 0,
    vy: 0,
    life: 1,
    maxLife: 1,
    color: '#ffd',
    size: 1,
    kind: 'tracer',
    endX: 700,
    endY: 300,
  });
  const p = s.particles[0];
  assert.equal(p.kind, 'tracer', 'the object should now be a tracer');
  assert.equal(
    p.variant,
    undefined,
    `stale impact variant must be wiped, got ${p.variant}`,
  );
});

// --- cap ---------------------------------------------------------------------------

test('a burst over the 700-particle cap compacts in place and pools the excess', () => {
  const s = arena();
  for (let i = 0; i < 800; i++) {
    s.particles.push({
      x: i,
      y: 300,
      vx: 0,
      vy: 0,
      life: 10,
      maxLife: 10,
      color: '#888',
      size: 2,
      kind: 'smoke',
    });
  }
  tick(s, DT);
  assert.equal(
    s.particles.length,
    700,
    `the frame should trim to the 700 cap, got ${s.particles.length}`,
  );
  assert.ok(
    (s.particlePool?.length ?? 0) >= 100,
    `the 100 excess particles should be pooled, got ${s.particlePool?.length ?? 0}`,
  );
  for (const p of s.particles) assert.ok(p.life > 0, 'survivors must be alive');
});

test('pool growth is itself capped at 800 objects', () => {
  const s = arena();
  for (let i = 0; i < 2000; i++) {
    s.particles.push({
      x: i,
      y: 300,
      vx: 0,
      vy: 0,
      life: 0.05,
      maxLife: 0.05,
      color: '#888',
      size: 2,
      kind: 'smoke',
    });
  }
  run(s, 0.2);
  assert.equal(s.particles.length, 0, 'all short-lived particles die');
  assert.ok(
    (s.particlePool?.length ?? 0) <= 800,
    `the pool must not grow past 800, got ${s.particlePool?.length ?? 0}`,
  );
});

const failed = results.filter((r) => !r.ok);
console.log(
  failed.length
    ? `\n${failed.length}/${results.length} failed`
    : `\n${results.length}/${results.length} passed`,
);
process.exit(failed.length ? 1 : 0);
