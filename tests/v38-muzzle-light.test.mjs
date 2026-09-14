import assert from 'node:assert/strict';
import { drawMuzzleLight } from '../game/ballistics.ts';

// Minimal mock 2D context that records gradient and blend operations.
function mockCtx() {
  const gradients = [];
  const ctx = {
    _gradients: gradients,
    _fills: [],
    _blends: [],
    save() {},
    restore() {},
    set globalCompositeOperation(v) { this._blends.push(v); },
    get globalCompositeOperation() { return this._blends[this._blends.length - 1]; },
    set fillStyle(v) { this._fills.push(v); },
    get fillStyle() { return this._fills[this._fills.length - 1]; },
    beginPath() {},
    arc() {},
    fill() {},
    createRadialGradient(x0, y0, r0, x1, y1, r1) {
      const stops = [];
      const g = {
        x0, y0, r0, x1, y1, r1,
        addColorStop(offset, color) { stops.push({ offset, color }); },
        _stops: stops,
      };
      gradients.push(g);
      return g;
    },
  };
  return ctx;
}

const results = [], failures = [];
function check(name, fn) {
  if (process.env.TEST_FILTER && !new RegExp(process.env.TEST_FILTER).test(name)) return;
  try { fn(); results.push(name); console.log('PASS', name); }
  catch (e) { failures.push({ name, error: e.stack }); console.error('FAIL', name, e.stack); }
}

check('a rifle shot casts a warm glow with additive blending', () => {
  const ctx = mockCtx();
  drawMuzzleLight(ctx, 500, 120, 'rifle', 1);
  assert.equal(ctx._blends.includes('lighter'), true);
  assert.equal(ctx._gradients.length, 1);
  const g = ctx._gradients[0];
  assert.equal(g.r1 > 0, true);
  assert.equal(g._stops.length, 3);
  // Center stop is warm and opaque-ish
  assert.match(g._stops[0].color, /rgba\(255,214,150/);
  // Outer stop is transparent
  assert.match(g._stops[2].color, /rgba\(255,140,60,0\)/);
});

check('a cannon casts a wider glow than a rifle', () => {
  const rifle = mockCtx();
  drawMuzzleLight(rifle, 500, 120, 'rifle', 1);
  const cannon = mockCtx();
  drawMuzzleLight(cannon, 500, 120, 'cannon', 1);
  assert.ok(cannon._gradients[0].r1 > rifle._gradients[0].r1,
    `cannon radius ${cannon._gradients[0].r1} should exceed rifle ${rifle._gradients[0].r1}`);
});

check('zero intensity produces no glow', () => {
  const ctx = mockCtx();
  drawMuzzleLight(ctx, 500, 120, 'rifle', 0);
  assert.equal(ctx._gradients.length, 0);
});

check('drone ammunition produces no glow', () => {
  const ctx = mockCtx();
  drawMuzzleLight(ctx, 500, 120, 'drone', 1);
  assert.equal(ctx._gradients.length, 0);
});

check('glow alpha scales with intensity', () => {
  const full = mockCtx();
  drawMuzzleLight(full, 500, 120, 'rifle', 1);
  const half = mockCtx();
  drawMuzzleLight(half, 500, 120, 'rifle', 0.5);
  const fullAlpha = parseFloat(full._gradients[0]._stops[0].color.match(/[\d.]+\)$/)[0]);
  const halfAlpha = parseFloat(half._gradients[0]._stops[0].color.match(/[\d.]+\)$/)[0]);
  assert.ok(Math.abs(halfAlpha - fullAlpha * 0.5) < 0.001,
    `half intensity alpha ${halfAlpha} should be ~half of ${fullAlpha}`);
});

check('machinegun glow is wider than rifle but narrower than cannon', () => {
  const rifle = mockCtx();
  drawMuzzleLight(rifle, 500, 120, 'rifle', 1);
  const mg = mockCtx();
  drawMuzzleLight(mg, 500, 120, 'machinegun', 1);
  const cannon = mockCtx();
  drawMuzzleLight(cannon, 500, 120, 'cannon', 1);
  assert.ok(mg._gradients[0].r1 > rifle._gradients[0].r1);
  assert.ok(cannon._gradients[0].r1 > mg._gradients[0].r1);
});

console.log(`\n${results.length}/${results.length + failures.length} passed`);
if (failures.length) process.exit(1);
