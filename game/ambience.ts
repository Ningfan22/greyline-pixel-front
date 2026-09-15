import { CARDS, W, ground, type GameState, type Scorch, type TreadMark } from './engine';

/** Deterministic hash → [0,1) */
function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

// ── Birds ────────────────────────────────────────────────
const FLOCK_PERIOD = 27; // seconds between flocks
const FLOCK_CROSS = 11; // seconds for a flock to cross the map

/**
 * Small flocks cross the sky, suggesting a living world beyond the trenches.
 * Purely decorative — drawn in world space so the camera transform applies.
 */
export function drawBirds(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  camera: number,
  viewportWidth: number,
) {
  const t = s.time;
  const cycle = t % FLOCK_PERIOD;
  if (cycle >= FLOCK_CROSS) return;

  const flockIdx = Math.floor(t / FLOCK_PERIOD);
  const seed = flockIdx * 91.7;
  const dir = hash(seed) > 0.5 ? 1 : -1;
  const progress = cycle / FLOCK_CROSS;
  const startX = dir > 0 ? -60 : W + 60;
  const endX = dir > 0 ? W + 60 : -60;
  const cx = startX + (endX - startX) * progress;
  const baseY = 28 + hash(seed + 1) * 52;
  const count = 4 + Math.floor(hash(seed + 2) * 5);

  ctx.strokeStyle = 'rgba(35,38,33,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const ox = (i - count / 2) * 9;
    const bx = cx + ox * dir;
    if (bx < camera - 20 || bx > camera + viewportWidth + 20) continue;
    const by =
      baseY + Math.abs(ox) * 0.32 + Math.sin(t * 2.5 + i * 1.3) * 1.5;
    const flap = Math.sin(t * 9 + i * 2.1) * 1.5;
    ctx.moveTo(bx - 2.5, by + flap);
    ctx.lineTo(bx, by - flap * 0.6);
    ctx.lineTo(bx + 2.5, by + flap);
  }
  ctx.stroke();
}

// ── Distant horizon flashes ──────────────────────────────
const FLASH_PERIOD = 18;
const FLASH_DURATION = 0.55;

/**
 * State of the distant-flash cycle at time t. Shared by the renderer and the
 * audio layer so the delayed thunder stays in sync with the horizon glow.
 */
export function distantFlashState(t: number): {
  active: boolean;
  x: number;
  index: number;
} {
  const index = Math.floor(t / FLASH_PERIOD);
  const cycle = t % FLASH_PERIOD;
  if (cycle >= FLASH_DURATION) return { active: false, x: 0, index };
  const fseed = index * 57.3;
  const side = hash(fseed) > 0.5 ? 0 : 1;
  const x =
    side === 0
      ? 24 + hash(fseed + 1) * 90
      : W - 24 - hash(fseed + 1) * 90;
  return { active: true, x, index };
}

/**
 * Brief flashes at the far left/right edges suggest a larger battle
 * happening just beyond the playable area.
 */
export function drawDistantFlashes(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  camera: number,
  viewportWidth: number,
) {
  const t = s.time;
  const flash = distantFlashState(t);
  if (!flash.active) return;
  const fx = flash.x;
  if (fx < camera - 60 || fx > camera + viewportWidth + 60) return;

  const cycle = t % FLASH_PERIOD;
  const fseed = flash.index * 57.3;
  const fy = ground(s, fx) - 55 - hash(fseed + 2) * 45;
  const intensity = 1 - cycle / FLASH_DURATION;
  const r = 14 + hash(fseed + 3) * 20;

  const grad = ctx.createRadialGradient(fx, fy, 0, fx, fy, r);
  grad.addColorStop(0, `rgba(255,210,130,${0.45 * intensity})`);
  grad.addColorStop(0.4, `rgba(255,160,70,${0.18 * intensity})`);
  grad.addColorStop(1, 'rgba(255,100,30,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(fx - r, fy - r, r * 2, r * 2);
}

// ── Wreck smoke columns ──────────────────────────────────
const SMOKE_PUFF_INTERVAL = 0.38;
const SMOKE_PUFF_LIFE = 4.0;
const SMOKE_COLUMN_HEIGHT = 62;

/**
 * Destroyed vehicles bleed slow smoke columns that drift with the wind.
 * Fresh wrecks smoke heavily; the column thins over two minutes.
 */
export function drawWreckSmoke(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  camera: number,
  viewportWidth: number,
) {
  const now = s.time;
  for (const w of s.wrecks) {
    const c = CARDS[w.cardId];
    if (!c.armored && !c.vehicle) continue;
    if (w.x < camera - 80 || w.x > camera + viewportWidth + 80) continue;

    const strength = Math.max(0, 1 - w.age / 120);
    if (strength <= 0.02) continue;

    const baseY = w.y - 10;
    const seedBase = w.id * 13.7;
    const latestPuff = Math.floor(now / SMOKE_PUFF_INTERVAL);
    const maxPuffs = Math.ceil(SMOKE_PUFF_LIFE / SMOKE_PUFF_INTERVAL);

    for (let p = 0; p < maxPuffs; p++) {
      const puffIdx = latestPuff - p;
      if (puffIdx < 0) continue;
      const puffStart = puffIdx * SMOKE_PUFF_INTERVAL;
      const age = now - puffStart;
      if (age > SMOKE_PUFF_LIFE) continue;

      const lifeT = age / SMOKE_PUFF_LIFE;
      const rise = lifeT * SMOKE_COLUMN_HEIGHT;
      const sway =
        Math.sin(now * 0.7 + puffIdx * 1.3) * 3 * lifeT +
        s.wind * age * 0.6;
      const jitter = (hash(seedBase + puffIdx * 7.1) - 0.5) * 6;
      const px = w.x + sway + jitter;
      const py = baseY - rise;
      const size = Math.round(
        (3 + lifeT * 12) * (0.65 + strength * 0.35),
      );
      const alpha = (1 - lifeT) * 0.3 * strength;
      if (alpha < 0.015) continue;

      ctx.fillStyle = `rgba(68,66,60,${alpha.toFixed(3)})`;
      // Two overlapping rects → soft blob, matching the particle style.
      ctx.fillRect(
        Math.round(px - size / 2),
        Math.round(py - size / 3),
        size,
        Math.max(1, Math.round(size * 0.65)),
      );
      ctx.fillRect(
        Math.round(px - size / 3),
        Math.round(py - size / 2),
        Math.max(1, Math.round(size * 0.65)),
        size,
      );
    }
  }
}

// ── Scorch marks ─────────────────────────────────────────

function drawScorch(ctx: CanvasRenderingContext2D, sc: Scorch, gy: number) {
  let seed = sc.seed;
  const rnd = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const r = sc.radius;
  ctx.save();
  // Core dark patch
  ctx.fillStyle = '#1c1712';
  ctx.globalAlpha = 0.42;
  const core = 6 + Math.floor(rnd() * 5);
  for (let i = 0; i < core; i++) {
    const a = rnd() * Math.PI * 2;
    const d = rnd() * r * 0.45;
    const w = r * (0.3 + rnd() * 0.4);
    const h = Math.max(1, Math.round(w * 0.4));
    ctx.fillRect(
      Math.round(sc.x + Math.cos(a) * d - w / 2),
      Math.round(gy - h / 2 - 1),
      Math.round(w),
      h,
    );
  }
  // Burnt rim
  ctx.fillStyle = '#33281e';
  ctx.globalAlpha = 0.3;
  const rim = 5 + Math.floor(rnd() * 4);
  for (let i = 0; i < rim; i++) {
    const a = rnd() * Math.PI * 2;
    const d = r * (0.35 + rnd() * 0.4);
    const w = r * (0.15 + rnd() * 0.2);
    ctx.fillRect(
      Math.round(sc.x + Math.cos(a) * d - w / 2),
      Math.round(gy - 2),
      Math.round(w),
      2,
    );
  }
  // Scattered char flecks
  ctx.fillStyle = '#241d18';
  ctx.globalAlpha = 0.35;
  const flecks = 8 + Math.floor(rnd() * 8);
  for (let i = 0; i < flecks; i++) {
    const a = rnd() * Math.PI * 2;
    const d = r * (0.5 + rnd() * 0.55);
    ctx.fillRect(
      Math.round(sc.x + Math.cos(a) * d),
      Math.round(gy - 1 - rnd() * 2),
      2,
      1,
    );
  }
  ctx.restore();
}

/** Persistent blast scorches drawn on the ground, under units and props. */
export function drawScorches(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  camera: number,
  viewportWidth: number,
) {
  for (const sc of s.scorches) {
    if (sc.x < camera - 80 || sc.x > camera + viewportWidth + 80) continue;
    drawScorch(ctx, sc, ground(s, sc.x));
  }
}

// ── Vehicle tread marks ──────────────────────────────────

const TREAD_LIFETIME = 40; // seconds before a mark fully fades

function drawTread(
  ctx: CanvasRenderingContext2D,
  t: TreadMark,
  gy: number,
  age: number,
) {
  const fade = Math.max(0, 1 - age / TREAD_LIFETIME);
  if (fade <= 0) return;
  let seed = t.seed;
  const rnd = () => {
    seed = (Math.imul(1664525, seed) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const spacing = t.half * 0.88; // track centres sit just inside the hull edge
  const bandW = 7; // track width, px
  const bandL = 15; // mark length along the direction of travel
  ctx.save();
  for (const side of [-1, 1]) {
    const bx = t.x + side * spacing;
    // Compressed earth band
    ctx.fillStyle = '#241f19';
    ctx.globalAlpha = 0.3 * fade;
    ctx.fillRect(
      Math.round(bx - bandL / 2),
      Math.round(gy - bandW / 2),
      bandL,
      bandW,
    );
    // Slight ridge at the leading edge
    ctx.fillStyle = '#3a322a';
    ctx.globalAlpha = 0.18 * fade;
    ctx.fillRect(
      Math.round(bx - bandL / 2),
      Math.round(gy - bandW / 2 - 1),
      bandL,
      1,
    );
    // Texture flecks
    ctx.fillStyle = '#1a1612';
    ctx.globalAlpha = 0.22 * fade;
    const flecks = 3 + Math.floor(rnd() * 3);
    for (let i = 0; i < flecks; i++) {
      ctx.fillRect(
        Math.round(bx - bandL / 2 + rnd() * bandL),
        Math.round(gy - bandW / 2 + rnd() * bandW),
        2,
        1,
      );
    }
  }
  ctx.restore();
}

/** Persistent vehicle tread marks drawn on the ground, under units and props. */
export function drawTreads(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  camera: number,
  viewportWidth: number,
) {
  const now = s.time;
  for (const t of s.treads) {
    if (t.x < camera - 80 || t.x > camera + viewportWidth + 80) continue;
    const age = now - t.born;
    if (age >= TREAD_LIFETIME) continue;
    drawTread(ctx, t, t.y, age);
  }
}

/** One-call entry for the render pipeline. */
// ── Wreck fire ───────────────────────────────────────────

const FIRE_LIFETIME = 40; // seconds of visible flame after destruction

/**
 * Fresh vehicle wrecks burn with flickering pixel flames that die out
 * well before the smoke column does, matching real wreck behaviour.
 */
export function drawWreckFire(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  camera: number,
  viewportWidth: number,
) {
  const now = s.time;
  for (const w of s.wrecks) {
    const c = CARDS[w.cardId];
    if (!c.armored && !c.vehicle) continue;
    if (w.x < camera - 80 || w.x > camera + viewportWidth + 80) continue;

    const strength = Math.max(0, 1 - w.age / FIRE_LIFETIME);
    if (strength <= 0.03) continue;

    const baseY = w.y - 8;
    const seedBase = w.id * 57.3;
    // Three flame tongues at slightly different offsets.
    for (let t = 0; t < 3; t++) {
      const flick = hash(seedBase + t * 11.7 + Math.floor(now * 14));
      const flick2 = hash(seedBase + t * 7.3 + Math.floor(now * 7.5));
      const h =
        Math.round((10 + flick * 14) * strength * (t === 1 ? 1.25 : 1));
      if (h < 2) continue;
      const wHalf = Math.round(
        (3 + flick2 * 3) * strength * (t === 1 ? 1.15 : 1),
      );
      const fx = w.x + (t - 1) * 5 + (flick - 0.5) * 3;
      // Outer orange
      ctx.fillStyle = `rgba(214,108,34,${(0.55 * strength).toFixed(3)})`;
      ctx.fillRect(
        Math.round(fx - wHalf),
        Math.round(baseY - h),
        wHalf * 2,
        h,
      );
      // Inner yellow
      const innerH = Math.round(h * 0.65);
      ctx.fillStyle = `rgba(240,196,72,${(0.65 * strength).toFixed(3)})`;
      ctx.fillRect(
        Math.round(fx - Math.max(1, wHalf - 2)),
        Math.round(baseY - innerH),
        Math.max(1, (wHalf - 2) * 2),
        innerH,
      );
      // Hot core
      if (strength > 0.4) {
        const coreH = Math.round(h * 0.35);
        ctx.fillStyle = `rgba(255,244,200,${(0.5 * strength).toFixed(3)})`;
        ctx.fillRect(
          Math.round(fx - 1),
          Math.round(baseY - coreH),
          2,
          coreH,
        );
      }
    }
    // Occasional sparks
    const sparkPhase = Math.floor(now * 6 + seedBase);
    if (hash(sparkPhase) > 0.72 && strength > 0.25) {
      const sx = w.x + (hash(sparkPhase * 1.3) - 0.5) * 16;
      const sy = baseY - 6 - hash(sparkPhase * 2.1) * 14 * strength;
      ctx.fillStyle = `rgba(255,210,120,${(0.7 * strength).toFixed(3)})`;
      ctx.fillRect(Math.round(sx), Math.round(sy), 2, 2);
    }
  }
}

/** One-call entry for the render pipeline. */
export function drawAmbience(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  camera: number,
  viewportWidth: number,
) {
  drawBirds(ctx, s, camera, viewportWidth);
  drawDistantFlashes(ctx, s, camera, viewportWidth);
  drawWreckSmoke(ctx, s, camera, viewportWidth);
}
