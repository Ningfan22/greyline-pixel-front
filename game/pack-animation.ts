// Measured original: 1254² RGBA, 4×4 cels, 313/314 px proportional grid.
// Use integer cell boundaries, never fractional sampling across a neighbor.
export const PACK_CANVAS = { width: 640, height: 480 } as const;
export const PACK_FRAMES = 16;
export const PACK_FPS = 24;
const LIFT = .48;
const TEAR = PACK_FRAMES / PACK_FPS;
const HOLD = .20;
const SETTLE = .35;
export const PACK_DURATION = LIFT + TEAR + HOLD + SETTLE;
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ease = (v: number) => 1 - (1 - clamp(v)) ** 3;

export function packFrameRect(width: number, height: number, index: number) {
  const frame = Math.max(0, Math.min(PACK_FRAMES - 1, Math.floor(index)));
  const col = frame % 4, row = Math.floor(frame / 4);
  const x = Math.round(col * width / 4), y = Math.round(row * height / 4);
  return { x, y, width: Math.round((col + 1) * width / 4) - x,
    height: Math.round((row + 1) * height / 4) - y };
}

export function packMotion(seconds: number) {
  const lift = ease(seconds / LIFT);
  const settle = ease((seconds - LIFT - TEAR - HOLD) / SETTLE);
  const frame = Math.max(0, Math.min(PACK_FRAMES - 1, Math.floor((seconds - LIFT) * PACK_FPS)));
  const scale = 1.05 + .30 * lift - .04 * settle;
  // Body bottom/center measured in source pixels. Even the entire source cel,
  // including faint gutter alpha, stays inside the padded landscape canvas.
  return { frame, scale, alpha: 1 - settle,
    x: PACK_CANVAS.width / 2 - 161 * scale,
    y: 445 - 15 * lift + 4 * settle - 290 * scale };
}
