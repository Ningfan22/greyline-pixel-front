import { modelOf, CARDS, type CardId } from './cards';
import type { Blast, Particle, Projectile } from './engine';
export type Ammunition =
  | 'ap'
  | 'rifle'
  | 'machinegun'
  | 'autocannon'
  | 'cannon'
  | 'rocket'
  | 'grenade'
  | 'mortar'
  | 'drone';
export function ammunition(id: CardId, member = 0): Ammunition {
  if (CARDS[id].emplacement === 'at_gun') return 'ap';
  if (id === 'javelin' || id === 'sam_vehicle') return 'rocket';
  const model = modelOf(id);
  if (model === 'machinegun' && member > 0) return 'rifle';
  if (CARDS[id].oneWay) return 'drone';
  if (id === 'rocket_heli' || id === 'attack_drone') return 'rocket';
  if (id === 'interceptor') return 'autocannon';
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
  ap: { speed: 2300, minimum: 0.05, arc: 0 },
  rifle: { speed: 3800, minimum: 0.035, arc: 0 },
  machinegun: { speed: 3400, minimum: 0.04, arc: 0 },
  autocannon: { speed: 2600, minimum: 0.05, arc: 0 },
  cannon: { speed: 1450, minimum: 0.07, arc: 3 },
  rocket: { speed: 680, minimum: 0.16, arc: 6 },
  grenade: { speed: 650, minimum: 0.25, arc: 70 },
  mortar: { speed: 550, minimum: 0.9, arc: 170 },
  drone: { speed: 250, minimum: 0.35, arc: 0 },
};
export function isTracer(kind: Ammunition, shot: number) {
  return kind === 'machinegun'
    ? shot % 2 === 1
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
  if (kind === 'drone') {
    streak(ctx, p.x, p.y, angle, 13, '#384239', 3);
    streak(
      ctx,
      p.x - dx * 5,
      p.y - vy * 5,
      angle + Math.PI / 2,
      10,
      '#687360',
      2,
    );
    streak(
      ctx,
      p.x - dx * 5,
      p.y - vy * 5,
      angle - Math.PI / 2,
      10,
      '#687360',
      2,
    );
    streak(ctx, p.x, p.y, angle, 7, '#a1a795');
  } else if (kind === 'ap') {
    streak(ctx, p.x, p.y, angle, 12, '#baae8d', 1, 0.45);
    streak(ctx, p.x, p.y, angle, 5, '#f5e6c1', 1, 0.95);
  } else if (kind === 'rocket') {
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
      p.weapon === 'coax'
        ? 20
        : kind === 'autocannon'
          ? 14
          : kind === 'machinegun'
            ? 14
            : 7,
      Math.max(1, Math.floor(travelled)),
    );
    streak(ctx, p.x, p.y, angle, length, '#b39259', 1, 0.24);
    streak(
      ctx,
      p.x,
      p.y,
      angle,
      Math.max(1, Math.floor(length * 0.55)),
      '#f2c983',
      1,
      0.95,
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
  if (kind === 'drone') return;
  const heavy = kind === 'cannon' || kind === 'ap',
    duration = heavy ? 0.09 : kind === 'machinegun' ? 0.085 : 0.035;
  if (age < 0 || age > duration) return;
  const dx = Math.cos(angle),
    dy = Math.sin(angle),
    len = heavy ? 22 : kind === 'rocket' ? 4 : kind === 'machinegun' ? 10 : 5;
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

export function drawBlast(
  ctx: CanvasRenderingContext2D,
  b: Blast,
  frames: HTMLCanvasElement[][],
) {
  const penetration = b.kind === 'penetration',
    row = penetration ? 0 : b.kind === 'wreck' || !b.soil ? 2 : 1;
  const times = penetration
    ? [0, 0.025, 0.05, 0.08, 0.11, 0.145, 0.18, 0.215]
    : row === 2
      ? [0, 0.08, 0.2, 0.4, 0.75, 1.3, 2.3, 4]
      : [0, 0.065, 0.14, 0.25, 0.48, 0.85, 1.6, 3];
  let index = 0;
  while (index < 7 && b.age >= times[index + 1]) index++;
  const sprite = frames[row][index];
  const width = penetration
    ? 48
    : b.kind === 'wreck'
      ? Math.max(240, Math.min(340, b.radius * 5.2))
      : b.kind === 'artillery'
        ? Math.max(190, Math.min(350, b.radius * 7))
        : Math.max(80, Math.min(260, b.radius * 5.5));
  const height = (width * sprite.height) / sprite.width,
    anchor = [268 / 300, 261 / 300, 263 / 300][row];
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = penetration
    ? Math.min(1, Math.max(0, (0.24 - b.age) / 0.04))
    : Math.min(1, Math.max(0, (7 - b.age) / 3));
  ctx.translate(Math.round(b.x), Math.round(b.y));
  if (b.seed % 2) ctx.scale(-1, 1);
  ctx.drawImage(
    sprite,
    Math.round(-width / 2),
    Math.round(-height * anchor),
    Math.round(width),
    Math.round(height),
  );
  ctx.restore();
}
