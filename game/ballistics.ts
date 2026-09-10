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

function cloud(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  rx: number,
  ry: number,
  color: string,
  alpha: number,
  seed: number,
) {
  ctx.fillStyle = color;
  ctx.globalAlpha = Math.max(0, alpha);
  const q = 2;
  for (let yy = -ry; yy <= ry; yy += q) {
    const n =
      (Math.sin((Math.floor(yy / q) + seed) * 12.9898) * 43758.5453) % 1;
    const half =
      Math.sqrt(Math.max(0, 1 - (yy * yy) / (ry * ry))) *
      rx *
      (0.88 + Math.abs(n) * 0.16);
    const offset = Math.sin(yy * 0.18 + seed) * rx * 0.1;
    ctx.fillRect(
      Math.round((x - half + offset) / q) * q,
      Math.round((y + yy) / q) * q,
      Math.ceil((half * 2) / q) * q,
      q,
    );
  }
}
export function drawBlast(ctx: CanvasRenderingContext2D, b: Blast) {
  const t = b.age;
  ctx.save();
  if (b.kind === 'penetration') {
    if (t < 0.09) {
      ctx.fillStyle = t < 0.04 ? '#fff3d2' : '#e7b36c';
      ctx.fillRect(b.x - 3, b.y - 2, 6, 4);
      ctx.fillRect(b.x - 1, b.y - 4, 2, 8);
    }
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI + i * 0.7 + (b.seed % 7) * 0.1,
        r = t * (80 + i * 14);
      streak(
        ctx,
        b.x + Math.cos(a) * r,
        b.y + Math.sin(a) * r + t * t * 110,
        a,
        4,
        '#e8ba77',
        1,
        Math.max(0, 1 - t * 5),
      );
    }
    ctx.restore();
    return;
  }
  const scale =
    Math.max(0.55, b.radius / 36) *
    (b.kind === 'artillery' ? 1.6 : b.kind === 'wreck' ? 1.35 : 1.15);
  // Low, broad soil shock, rising incandescent fragments, then several turbulent smoke columns.
  if (b.soil && t < 2.5)
    for (let i = 0; i < 11; i++) {
      const dir = i - 5,
        x = b.x + dir * (7 + Math.min(t, 1.1) * 13) * scale;
      cloud(
        ctx,
        x,
        b.y - 4 - (i % 3) * 3,
        (10 + Math.min(t, 1) * 10) * scale,
        (4 + Math.min(t, 1) * 5) * scale,
        i % 2 ? '#887961' : '#ab9471',
        Math.min(0.65, t * 6) * Math.min(1, (2.5 - t) / 1.3),
        b.seed + i,
      );
    }
  if (t > 0.07)
    for (let i = 0; i < 9; i++) {
      const phase = ((b.seed >>> i) % 13) / 13;
      const rise = (12 + Math.min(t, 4) * 18 + (i % 3) * 11) * scale;
      const sx =
        b.x +
        ((i - 4) * (5 + Math.min(t, 3) * 2) + Math.sin(t * 0.6 + i) * 6) *
          scale;
      const sy = b.y - rise;
      const size = (8 + Math.min(t, 2) * 6 + phase * 5) * scale;
      const opacity = Math.min(0.92, t * 4) * Math.min(1, (7 - t) / 2.6);
      cloud(
        ctx,
        sx,
        sy,
        size,
        size * (1.1 + phase * 0.25),
        i % 3 === 0 ? '#282a27' : i % 3 === 1 ? '#4a4941' : '#636055',
        opacity,
        b.seed + i,
      );
      for (let l = 0; l < 3; l++)
        cloud(
          ctx,
          sx + Math.sin(i + l * 2.1) * size * 0.55,
          sy + Math.cos(i + l * 2.1) * size * 0.45,
          size * 0.42,
          size * 0.38,
          l % 2 ? '#a19a83' : '#191e1b',
          opacity * 0.18,
          b.seed + i + l * 17,
        );
    }
  if (t < 0.65) {
    const expand = Math.min(1, t / 0.065),
      fade = Math.min(1, (0.65 - t) / 0.3);
    for (let i = 0; i < 11; i++) {
      const a = -Math.PI + (i / 10) * Math.PI,
        reach = (15 + ((i * 17 + b.seed) % 23)) * scale * expand;
      const x = b.x + Math.cos(a) * reach * 0.85,
        y = b.y + Math.sin(a) * reach - t * 14;
      cloud(
        ctx,
        x,
        y,
        (7 + (i % 3) * 3) * scale,
        (8 + (i % 4) * 3) * scale,
        '#9e411d',
        fade,
        b.seed + i,
      );
      cloud(
        ctx,
        x,
        y + 3,
        5 * scale,
        (6 + (i % 3) * 2) * scale,
        '#f09936',
        fade * 0.95,
        b.seed + i + 8,
      );
      if (t < 0.25)
        cloud(
          ctx,
          x,
          y + 4,
          3 * scale,
          4 * scale,
          '#ffe7a0',
          fade,
          b.seed + i + 3,
        );
    }
    if (t < 0.075)
      cloud(
        ctx,
        b.x,
        b.y - 7 * scale,
        19 * scale * expand,
        13 * scale * expand,
        '#fff3c6',
        1,
        b.seed,
      );
    for (let i = 0; i < 15; i++) {
      const a = -Math.PI + 0.12 + i * 0.19,
        velocity = (75 + ((i * 23) % 120)) * scale;
      const x = b.x + Math.cos(a) * velocity * t,
        y = b.y + Math.sin(a) * velocity * t + t * t * 130;
      streak(
        ctx,
        x,
        y,
        a,
        Math.max(2, 8 - t * 8),
        '#e4b275',
        1,
        Math.max(0, 1 - t * 1.7),
      );
    }
  }
  ctx.restore();
}
