import type { GameState } from './engine';
import type { MapId } from './maps';

/**
 * Battlefield weather (v62). Each map owns one signature weather that cycles
 * with clear spells. Weather is strictly symmetric: it degrades vision for
 * both sides through the same pointVisible multiplier, so the AI gains no
 * information the player does not have. Precipitation is decorative on top
 * of a real gameplay effect (sight range, smoke lifetime, flare demand).
 */
export type WeatherKind = 'clear' | 'rain' | 'fog' | 'snow' | 'sandstorm';

export interface WeatherState {
  kind: WeatherKind;
  /** 0..1 current strength of the active weather; eases in/out over ~6s. */
  intensity: number;
  /** seconds until the next clear↔weather flip. */
  in: number;
  /** 0..1 ground wetness accumulated by rain (dries slowly in clear weather). */
  wet: number;
  /** local LCG state — weather randomness never touches combat rnd. */
  rnd: number;
  /** when true the sky stays clear (MatchOptions.weather === false). */
  disabled: boolean;
}

const MAP_WEATHER: Record<MapId, Exclude<WeatherKind, 'clear'>> = {
  greyline: 'rain',
  jungle: 'fog',
  mountains: 'snow',
  desert: 'sandstorm',
};

/** Full-intensity vision multiplier per weather kind. */
const VISION: Record<WeatherKind, number> = {
  clear: 1,
  rain: 0.85,
  fog: 0.6,
  snow: 0.72,
  sandstorm: 0.55,
};

function wrnd(w: WeatherState): number {
  w.rnd = (w.rnd * 1664525 + 1013904223) >>> 0;
  return w.rnd / 4294967296;
}

export function createWeather(
  mapId: MapId,
  seed: number,
  disabled = false,
): WeatherState {
  const w: WeatherState = {
    kind: 'clear',
    intensity: 0,
    in: 45,
    wet: 0,
    rnd: ((seed ^ 0x5e91a7c3) >>> 0) || 1,
    disabled,
  };
  if (disabled) {
    w.in = 1e9;
    return w;
  }
  // The front opens under a clear sky; the first front arrives 30–70s in.
  w.in = 30 + wrnd(w) * 40;
  return w;
}

export function updateWeather(s: GameState, dt: number): void {
  const w = s.weather;
  if (w.disabled) return;
  w.in -= dt;
  if (w.in <= 0) {
    if (w.kind === 'clear') {
      w.kind = MAP_WEATHER[s.mapId];
      w.in = 35 + wrnd(w) * 45;
    } else {
      w.kind = 'clear';
      w.in = 45 + wrnd(w) * 55;
    }
  }
  const target = w.kind === 'clear' ? 0 : 1;
  w.intensity += (target - w.intensity) * Math.min(1, dt / 6);
  if (w.intensity < 0.004) w.intensity = 0;
  if (w.kind === 'rain') w.wet = Math.min(1, w.wet + dt / 40);
  else w.wet = Math.max(0, w.wet - dt / 120);
}

/** Vision multiplier applied to every observer's sight range. */
export function weatherVisibility(s: GameState): number {
  const w = s.weather;
  const base = VISION[w.kind];
  return 1 + (base - 1) * w.intensity;
}

/** Rain washes smoke out of the air faster. */
export function smokeDecayMultiplier(s: GameState): number {
  const w = s.weather;
  return w.kind === 'rain' ? 1 + 0.9 * w.intensity : 1;
}

/** True when the weather is bad enough that flares earn their cost. */
export function weatherDegradesVision(s: GameState): boolean {
  return weatherVisibility(s) < 0.86;
}

// ── Rendering ────────────────────────────────────────────
// All precipitation is drawn in screen space (close to the camera) so it
// stays cheap: counts are bounded and wrap with the viewport. Deterministic
// hash placement keeps two clients with the same state pixel-identical.

function hash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function drawRain(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  vw: number,
  H: number,
): void {
  const w = s.weather;
  const t = s.time;
  const k = w.intensity;
  ctx.fillStyle = `rgba(18, 24, 33, ${0.16 * k})`;
  ctx.fillRect(0, 0, vw, H);
  const count = Math.floor(k * 130);
  if (count === 0) return;
  ctx.strokeStyle = `rgba(174, 193, 214, ${0.32 * k})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  const slant = s.wind * 0.9;
  for (let i = 0; i < count; i++) {
    const seed = i * 7.13;
    const speed = 520 + hash(seed + 3.1) * 200;
    let x = (hash(seed) * (vw + 160) + t * slant * 8) % (vw + 160);
    if (x < 0) x += vw + 160;
    x -= 80;
    let y = (hash(seed + 1.7) * (H + 80) + t * speed) % (H + 80);
    if (y < 0) y += H + 80;
    y -= 40;
    ctx.moveTo(x, y);
    ctx.lineTo(x - slant, y - 15);
  }
  ctx.stroke();
}

function drawSnow(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  vw: number,
  H: number,
): void {
  const w = s.weather;
  const t = s.time;
  const k = w.intensity;
  ctx.fillStyle = `rgba(203, 213, 228, ${0.05 * k})`;
  ctx.fillRect(0, 0, vw, H);
  const count = Math.floor(k * 100);
  if (count === 0) return;
  ctx.fillStyle = `rgba(236, 241, 248, ${0.55 * k})`;
  for (let i = 0; i < count; i++) {
    const seed = i * 5.91;
    const fall = 26 + hash(seed + 2.3) * 24;
    let x =
      (hash(seed) * (vw + 120) +
        Math.sin(t * 0.9 + seed * 3.7) * 18 +
        t * s.wind * 0.6) %
      (vw + 120);
    if (x < 0) x += vw + 120;
    x -= 60;
    let y = (hash(seed + 1.3) * (H + 60) + t * fall) % (H + 60);
    if (y < 0) y += H + 60;
    y -= 30;
    ctx.fillRect(x, y, 2, 2);
  }
}

function drawSandstorm(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  vw: number,
  H: number,
): void {
  const w = s.weather;
  const t = s.time;
  const k = w.intensity;
  ctx.fillStyle = `rgba(176, 138, 84, ${0.17 * k})`;
  ctx.fillRect(0, 0, vw, H);
  const count = Math.floor(k * 80);
  if (count === 0) return;
  const dir = s.wind >= 0 ? 1 : -1;
  ctx.strokeStyle = `rgba(214, 182, 132, ${0.3 * k})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < count; i++) {
    const seed = i * 9.37;
    const speed = (300 + hash(seed + 2.9) * 280) * dir;
    const span = vw + 320;
    let x = (hash(seed) * span + t * speed) % span;
    if (x < 0) x += span;
    x -= 160;
    const y = hash(seed + 1.1) * H;
    const len = 22 + hash(seed + 4.7) * 42;
    ctx.moveTo(x, y);
    ctx.lineTo(x - dir * len, y + 3);
  }
  ctx.stroke();
}

function drawFog(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  vw: number,
  H: number,
): void {
  const w = s.weather;
  const t = s.time;
  const k = w.intensity;
  ctx.fillStyle = `rgba(190, 196, 205, ${0.1 * k})`;
  ctx.fillRect(0, 0, vw, H);
  if (k <= 0.01) return;
  const dir = s.wind >= 0 ? 1 : -1;
  const span = vw + 700;
  for (let layer = 0; layer < 3; layer++) {
    const par = [0.35, 0.6, 0.9][layer];
    const speed = (7 + layer * 6) * dir;
    for (let j = 0; j < 5; j++) {
      const seed = layer * 31 + j * 7.3;
      let x = (hash(seed) * span + t * speed) % span;
      if (x < 0) x += span;
      x -= 350;
      const y = H * (0.22 + 0.6 * hash(seed + 1.9));
      const r = 190 + hash(seed + 5.1) * 230;
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      const a = 0.11 * k * par;
      g.addColorStop(0, `rgba(214, 219, 226, ${a})`);
      g.addColorStop(1, 'rgba(214, 219, 226, 0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Weather overlay drawn after the night veil: rain and snow still read
 * against a dark sky, and fog blurs what little the flares reveal.
 */
export function drawWeather(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  _camera: number,
  viewportWidth: number,
  height: number,
): void {
  const w = s.weather;
  if (w.intensity <= 0.004) return;
  switch (w.kind) {
    case 'rain':
      drawRain(ctx, s, viewportWidth, height);
      break;
    case 'snow':
      drawSnow(ctx, s, viewportWidth, height);
      break;
    case 'sandstorm':
      drawSandstorm(ctx, s, viewportWidth, height);
      break;
    case 'fog':
      drawFog(ctx, s, viewportWidth, height);
      break;
  }
}
