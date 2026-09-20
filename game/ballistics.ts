import { modelOf, CARDS, type CardId } from './cards';
import type { Blast, Particle, Projectile } from './engine';
import { drawSmokePuff, blendEffectFrame, type PaintedBlasts } from './effect-atlas';
import { blastFrameAt } from './blast-animation';
import { isPrecisionObserver } from './precision-team';
function hexa(hex: string, a: number) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a.toFixed(3)})`;
}
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
  if (id === 'airborne_at') return member < 2 ? 'rocket' : 'rifle';
  if (CARDS[id].emplacement === 'at_gun') return 'ap';
  if (
    id === 'javelin' ||
    id === 'sam_vehicle' ||
    id === 'tow_ifv' ||
    id === 'interceptor'
  )
    return 'rocket';
  const model = modelOf(id);
  if ((model === 'machinegun' || id === 'antiarmor') && member > 0)
    return 'rifle';
  if (CARDS[id].oneWay) return 'drone';
  if (id === 'rocket_heli' || id === 'attack_drone') return 'rocket';
  if (CARDS[id].indirect) return 'mortar';
  if (id === 'grenadiers') return 'grenade';
  if (model === 'rocket') return 'rocket';
  if (model === 'tank') return 'cannon';
  // v106: the strike jet's gun is a real autocannon, not a rifle-calibre
  // door gun — its rounds kick up proper dust columns on soil impacts.
  if (id === 'strike_jet') return 'autocannon';
  if (id === 'pickup' || CARDS[id].vehicleSupport) return 'machinegun';
  if (model === 'ifv') return 'autocannon';
  if (model === 'machinegun' || model === 'helicopter') return 'machinegun';
  return 'rifle';
}

/** Infantry small-arms magazine profile. Heavy weapons (rockets, mortars,
 * grenades, vehicle guns) return null and keep cooldown-only pacing. */
export interface MagazineSpec {
  mag: number;
  reserve: number;
  reload: number; // seconds to swap magazines under fire
}
export function magazine(id: CardId, member = 0): MagazineSpec | null {
  if (isPrecisionObserver({ id, member })) return null;
  if (!CARDS[id].members) return null;
  const kind = ammunition(id, member);
  if (member === 0 && id === 'lmg_team') return { mag: 60, reserve: 180, reload: 2.8 };
  if (member === 0 && id === 'heavy_mg') return { mag: 150, reserve: 300, reload: 5.0 };
  if (kind === 'machinegun') return { mag: 100, reserve: 200, reload: 4.0 };
  if (kind === 'rifle') {
    if (id === 'sniper' || id === 'sniper_team') return { mag: 5, reserve: 25, reload: 3.0 };
    return { mag: 30, reserve: 150, reload: 2.5 };
  }
  return null;
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
export function isCoverBullet(kind: Ammunition) {
  return kind === 'rifle' || kind === 'machinegun' || kind === 'autocannon';
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
    ctx.fillRect(Math.round(x - dx * i), Math.round(y - dy * i), width, width);
}
export function drawProjectile(ctx: CanvasRenderingContext2D, p: Projectile) {
  const kind = p.ammunition ?? (p.radius ? 'cannon' : 'rifle');
  const t = 1 - Math.max(0, p.life) / p.total;
  const dy = p.ty - p.startY - 4 * (p.arc ?? 0) * (1 - 2 * t);
  const angle = p.heading ?? Math.atan2(dy, p.tx - p.startX);
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
        ? 46
        : kind === 'autocannon'
          ? 40
          : kind === 'machinegun'
            ? 34
            : 22,
      Math.max(1, Math.floor(travelled)),
    );
    streak(ctx, p.x, p.y, angle, length, '#e7a847', 2, 0.55);
    streak(
      ctx,
      p.x,
      p.y,
      angle,
      Math.max(1, Math.floor(length * 0.55)),
      '#fff0bc',
      1,
      0.95,
    );
    streak(ctx, p.x, p.y, angle, 3, '#fffad8', 2, 1);
  } else {
    streak(ctx, p.x, p.y, angle, 5, '#e2d5ae', 1, 0.7);
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

/**
 * Muzzle-flash illumination: a brief warm radial glow cast onto the terrain
 * around a firing weapon. Rendered with additive blending so multiple
 * concurrent shooters stack into a flickering firefight ambience.
 */
export function drawMuzzleLight(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  kind: Ammunition,
  intensity: number,
) {
  if (kind === 'drone' || intensity <= 0) return;
  const heavy = kind === 'cannon' || kind === 'ap' || kind === 'autocannon';
  const radius = heavy ? 90 : kind === 'machinegun' ? 55 : kind === 'rocket' || kind === 'mortar' ? 70 : 38;
  const peak = heavy ? 0.5 : kind === 'machinegun' ? 0.34 : 0.24;
  const alpha = peak * intensity;
  if (alpha < 0.02) return;
  const gx = x,
    gy = y + 6;
  const grad = ctx.createRadialGradient(gx, gy, 0, gx, gy, radius);
  grad.addColorStop(0, `rgba(255,214,150,${alpha})`);
  grad.addColorStop(0.35, `rgba(255,170,90,${alpha * 0.55})`);
  grad.addColorStop(1, 'rgba(255,140,60,0)');
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(gx, gy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

export function drawParticle(
  ctx: CanvasRenderingContext2D,
  p: Particle,
  impacts?: HTMLCanvasElement[][],
  smokeFrames?: HTMLCanvasElement[],
) {
  const life = Math.max(0, p.life / p.maxLife),
    smoke =
      p.kind === 'smoke' ||
      p.kind === 'dust' ||
      p.kind === 'cloud' ||
      p.kind === 'mote' ||
      p.kind === 'haze';
  if (p.kind === 'impact') {
    if (impacts) {
      const row = p.variant ?? 0;
      const sprite = impacts[row][Math.min(7, Math.floor((1 - life) * 8))];
      const height = (p.size * sprite.height) / sprite.width;
      ctx.globalAlpha = Math.min(1, life * 4);
      ctx.drawImage(
        sprite,
        Math.round(p.x - p.size / 2),
        Math.round(p.y - height * (row ? 0.79 : 0.885)),
        p.size,
        height,
      );
      ctx.globalAlpha = 1;
    }
    return;
  }
  if (p.kind === 'tracer') {
    const dx = (p.endX ?? p.x) - p.x,
      dy = (p.endY ?? p.y) - p.y;
    streak(
      ctx,
      p.endX ?? p.x,
      p.endY ?? p.y,
      Math.atan2(dy, dx),
      Math.min(65, Math.hypot(dx, dy)),
      '#f8d28e',
      1,
      life * 0.55,
    );
    ctx.globalAlpha = 1;
    return;
  }
  if (p.kind === 'flash') {
    // v111 additive detonation flash / lingering embers, drawn under the
    // blast sprite so the fire reads as glowing from within.
    const r = Math.max(2, p.size * (0.6 + (1 - life) * 0.6));
    const a = Math.min(0.85, life * 2.4);
    const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r);
    grad.addColorStop(0, hexa(p.color, a));
    grad.addColorStop(0.4, hexa(p.color, a * 0.45));
    grad.addColorStop(1, hexa(p.color, 0));
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    return;
  }
  ctx.globalAlpha = smoke
    ? life *
      (p.opacity ?? (p.kind === 'smoke'
        ? 0.22
        : p.kind === 'cloud'
          ? 0.3
          : p.kind === 'mote'
            ? 0.12
            : p.kind === 'haze'
              ? 0.13
              : 0.46))
    : Math.min(1, life * 2);
  ctx.fillStyle = p.color;
  const size = smoke
    ? Math.max(
        2,
        Math.round(
          p.size *
            (p.kind === 'mote'
              ? 1
              : p.kind === 'haze'
                ? 1 + (1 - life) * 1.4
                : 1 + (1 - life) * 0.8),
        ),
      )
    : p.size;
  const x = Math.round(p.x),
    y = Math.round(p.y);
  if (smoke) {
    if (smokeFrames) {
      drawSmokePuff(ctx, smokeFrames, 1 - life, x, y, size * 1.4, p.color, ctx.globalAlpha);
      ctx.globalAlpha = 1;
      return;
    }
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
  legacy: HTMLCanvasElement[][],
  generated?: HTMLCanvasElement[][],
  v13?: HTMLCanvasElement[][],
  painted?: PaintedBlasts,
) {
  const penetration = b.kind === 'penetration',
    grenade = b.kind === 'grenade';
  const air = b.kind === 'air',
    crash = b.kind === 'crash';
  const authored = painted && (crash || b.kind === 'wreck' ? painted.fuel :
    b.kind === 'artillery' ? painted.earth : grenade ? painted.grenade : air ? painted.air :
    b.kind === 'he' ? painted.he : undefined);
  const frames = authored ?? (penetration
    ? legacy[0]
    : !generated
      ? legacy[1]
      : v13 && (crash || b.kind === 'wreck')
        ? v13[0]
        : v13 && b.kind === 'artillery'
          ? v13[1]
          : v13 && grenade
            ? v13[2]
            : generated[air ? 2 : crash || b.kind === 'wreck' ? 1 : 0]);
  // Variety comes from separate painted fuel/earth/air families. Only small
  // physical size and direction differences use the seed, never lifetime/tint.
  const sd = b.seed >>> 0;
  const scaleJ = 0.9 + (sd % 10) / 10 * 0.22; // 0.90 - 1.12
  const clock = blastFrameAt(b,frames.length);
  if (clock.alpha <= 0) return;
  const width = (penetration
    ? 48
    : grenade
      ? Math.max(52, Math.min(76, b.radius * 1.8))
      : air
        ? Math.max(48, Math.min(110, b.radius * 3.2))
        : crash
          ? Math.max(82, Math.min(138, b.radius * 4))
          : b.kind === 'wreck'
            ? Math.max(210, Math.min(290, b.radius * 4.8))
            : b.kind === 'artillery'
              ? Math.max(210, Math.min(320, b.radius * 6))
              : Math.max(90, Math.min(250, b.radius * 5))) * scaleJ;
  const anchor = authored ? (air ? .5 : 154/160) : penetration
    ? 268 / 300
    : air
      ? 0.6
      : generated
        ? 0.975
        : 261 / 300;
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.translate(Math.round(b.x), Math.round(b.y));
  if (b.seed % 2) ctx.scale(-1, 1);
  const sprite = blendEffectFrame(frames[clock.index],frames[Math.min(clock.index+1,frames.length-1)],clock.blend);
  const height = width*sprite.height/sprite.width;
  ctx.globalAlpha *= clock.alpha;
  ctx.drawImage(sprite,Math.round(-width/2),Math.round(-height*anchor),Math.round(width),Math.round(height));
  ctx.restore();
}
