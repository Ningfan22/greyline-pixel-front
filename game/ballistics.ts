import { modelOf, CARDS, type CardId } from './cards';
import type { Particle, Projectile } from './engine';
export type Ammunition =
  | 'rifle'
  | 'machinegun'
  | 'autocannon'
  | 'cannon'
  | 'rocket'
  | 'grenade'
  | 'mortar';
export function ammunition(id: CardId): Ammunition {
  const model = modelOf(id);
  if (CARDS[id].indirect) return 'mortar';
  if (id === 'grenadiers') return 'grenade';
  if (model === 'rocket') return 'rocket';
  if (model === 'tank') return 'cannon';
  if (model === 'ifv') return 'autocannon';
  if (model === 'machinegun' || model === 'helicopter') return 'machinegun';
  return 'rifle';
}
export const FLIGHT: Record<
  Ammunition,
  { speed: number; minimum: number; arc: number }
> = {
  rifle: { speed: 3800, minimum: 0.035, arc: 0 },
  machinegun: { speed: 3400, minimum: 0.04, arc: 0 },
  autocannon: { speed: 2600, minimum: 0.05, arc: 0 },
  cannon: { speed: 1450, minimum: 0.07, arc: 3 },
  rocket: { speed: 680, minimum: 0.16, arc: 6 },
  grenade: { speed: 650, minimum: 0.25, arc: 70 },
  mortar: { speed: 550, minimum: 0.9, arc: 170 },
};
export function isTracer(kind: Ammunition, shot: number) {
  return kind === 'machinegun'
    ? shot % 4 === 1
    : kind === 'rifle'
      ? shot % 3 === 1
      : kind === 'autocannon'
        ? shot % 2 === 1
        : false;
}
// Rasterize the line directly to integer pixels: rotated rectangles blur narrow tracers.
function streak(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  length: number,
  color: string,
  width = 1,
  alpha = 1,
) {
  ctx.fillStyle = color;
  ctx.globalAlpha = alpha;
  const dx = Math.cos(angle),
    dy = Math.sin(angle);
  for (let i = 0; i < length; i++)
    ctx.fillRect(Math.round(x - dx * i), Math.round(y - dy * i), width, 1);
}
export function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile) {
  const kind = p.ammunition ?? (p.radius ? 'cannon' : 'rifle');
  const t = 1 - Math.max(0, p.life) / p.total;
  const dy = p.ty - p.startY - Math.PI * (p.arc ?? 0) * Math.cos(Math.PI * t);
  const angle = Math.atan2(dy, p.tx - p.startX);
  const dx = Math.cos(angle),
    vy = Math.sin(angle);
  const travelled = Math.hypot(p.x - p.startX, p.y - p.startY);
  ctx.save();
  if (kind === 'rocket') {
    streak(ctx, p.x, p.y, angle, 7, '#3e443b', 2);
    streak(ctx, p.x, p.y - 1, angle, 5, '#b6b7a3');
    streak(ctx, p.x - dx * 7, p.y - vy * 7, angle, 3, '#d7a467', 1, 0.85);
  } else if (kind === 'cannon' || kind === 'mortar' || kind === 'grenade') {
    const size = kind === 'cannon' ? 6 : kind === 'mortar' ? 5 : 3;
    streak(ctx, p.x, p.y, angle, size, '#394139', 2);
    streak(ctx, p.x, p.y - 1, angle, Math.max(2, size - 2), '#b8b8a1');
    if (kind === 'cannon')
      streak(
        ctx,
        p.x - dx * size,
        p.y - vy * size,
        angle,
        Math.min(6, Math.floor(travelled)),
        '#c4b992',
        1,
        0.28,
      );
  } else if (p.tracer) {
    const length = Math.min(
      kind === 'autocannon' ? 12 : kind === 'machinegun' ? 10 : 7,
      Math.max(1, Math.floor(travelled)),
    );
    streak(ctx, p.x, p.y, angle, length, '#b39259', 1, 0.24);
    streak(
      ctx,
      p.x,
      p.y,
      angle,
      Math.max(1, Math.floor(length * 0.55)),
      '#d6bb82',
      1,
      0.7,
    );
    streak(ctx, p.x, p.y, angle, 2, '#e5d6ab', 1, 0.9);
  } else {
    streak(ctx, p.x, p.y, angle, 2, '#c1c3b1', 1, 0.32);
  }
  ctx.restore();
}
export function drawMuzzle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  angle: number,
  kind: Ammunition,
  age: number,
) {
  const heavy = kind === 'cannon',
    duration = heavy ? 0.07 : 0.035;
  if (age < 0 || age > duration) return;
  const dx = Math.cos(angle),
    dy = Math.sin(angle),
    len = heavy ? 14 : kind === 'rocket' ? 4 : 5;
  ctx.save();
  // A brief asymmetric jet aligned with the barrel, followed by imported smoke particles.
  streak(
    ctx,
    x + dx * len,
    y + dy * len,
    angle,
    len,
    heavy ? '#d9a86b' : '#d8b77a',
    heavy ? 2 : 1,
    0.8,
  );
  streak(
    ctx,
    x + dx * 3,
    y + dy * 3,
    angle,
    heavy ? 5 : 3,
    '#eee0b6',
    heavy ? 2 : 1,
    0.95,
  );
  if (heavy)
    streak(
      ctx,
      x + dx * 7 - dy * 2,
      y + dy * 7 + dx * 2,
      angle,
      6,
      '#bc844f',
      1,
      0.65,
    );
  ctx.restore();
}
export function drawParticle(ctx: CanvasRenderingContext2D, p: Particle) {
  const life = Math.max(0, p.life / p.maxLife),
    smoke = p.kind === 'smoke' || p.kind === 'dust';
  ctx.globalAlpha = smoke
    ? life * (p.kind === 'smoke' ? 0.22 : 0.32)
    : Math.min(1, life * 2);
  ctx.fillStyle = p.color;
  const size = smoke
    ? Math.max(2, Math.round(p.size * (1 + (1 - life) * 0.8)))
    : p.size;
  const x = Math.round(p.x),
    y = Math.round(p.y);
  if (smoke) {
    ctx.fillRect(
      x - Math.floor(size / 2),
      y - Math.floor(size / 3),
      size,
      Math.max(1, Math.round(size * 0.65)),
    );
    ctx.fillRect(
      x - Math.floor(size / 3),
      y - Math.floor(size / 2),
      Math.max(1, Math.round(size * 0.65)),
      size,
    );
  } else if (p.kind === 'spark')
    streak(ctx, x, y, Math.atan2(p.vy, p.vx), 3, p.color, 1, life);
  else ctx.fillRect(x, y, size, p.kind === 'casing' ? 2 : size);
  ctx.globalAlpha = 1;
}
