import type { GameState } from './engine';

const STRIDE = 64;
const cache = new WeakMap<
  GameState,
  {
    time: number;
    terrain: number[];
    minima: Float64Array;
    first: number;
    last: number;
  }
>();
function terrainMinima(s: GameState) {
  const terrain = s.terrain,
    last = terrain.length - 1,
    old = cache.get(s);
  if (
    old &&
    old.time === s.time &&
    old.terrain === terrain &&
    old.first === terrain[0] &&
    old.last === terrain[last]
  )
    return old.minima;
  const minima = new Float64Array(Math.ceil(terrain.length / STRIDE)).fill(
    Infinity,
  );
  for (let x = 0; x < terrain.length; x++)
    minima[Math.floor(x / STRIDE)] = Math.min(
      minima[Math.floor(x / STRIDE)],
      terrain[x],
    );
  cache.set(s, {
    time: s.time,
    terrain,
    minima,
    first: terrain[0],
    last: terrain[last],
  });
  return minima;
}

/** Same 2px samples as the original ray; skip only blocks provably above every surface. */
export function heightfieldIntercept(
  s: GameState,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  limit = 1,
) {
  const dx = tx - sx,
    dy = ty - sy,
    steps = Math.max(1, Math.ceil(Math.abs(dx) / 2));
  const last = Math.min(steps, Math.ceil(steps * limit)),
    maxX = s.terrain.length - 1,
    minima = terrainMinima(s);
  for (let i = 1; i <= last;) {
    const end = Math.min(last, i + 31),
      x0 = sx + (dx * i) / steps,
      x1 = sx + (dx * end) / steps;
    const lo = Math.floor(
        Math.max(0, Math.min(maxX, Math.min(x0, x1))) / STRIDE,
      ),
      hi = Math.floor(Math.max(0, Math.min(maxX, Math.max(x0, x1))) / STRIDE);
    let minimum = Infinity;
    for (let bin = lo; bin <= hi; bin++)
      minimum = Math.min(minimum, minima[bin]);
    // Explosions and digging only lower the surface during a tick, so its old minimum remains conservative.
    if (
      Math.max(sy + (dy * i) / steps, sy + (dy * end) / steps) <
      minimum - 1
    ) {
      i = end + 1;
      continue;
    }
    for (; i <= end; i++) {
      const t = i / steps,
        x = sx + dx * t,
        y = sy + dy * t,
        ground = s.terrain[Math.max(0, Math.min(maxX, Math.floor(x)))];
      if (y >= ground - 1) return { x, y: ground - 1, t };
    }
  }
  return null;
}
