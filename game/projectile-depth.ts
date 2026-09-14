import type { GameState, Projectile, Unit } from './engine';
import { CARDS, modelOf } from './cards';
import { isCoverBullet } from './ballistics';
import { sceneryIntercept, segmentBox } from './world';

/** Deterministic FX randomness, mirroring engine.fxRnd without a circular import. */
function fxRnd(s: GameState) {
  s.fxSeed = (Math.imul(1664525, s.fxSeed) + 1013904223) >>> 0;
  return s.fxSeed / 4294967296;
}

/** Four 12-unit depth lanes share the side-on projection. Aim is fixed at firing. */
export function aimProjectileDepth(s: GameState, p: Projectile) {
  if (
    p.startLane !== undefined ||
    p.sourceUid === undefined ||
    p.radius ||
    !isCoverBullet(p.ammunition ?? 'rifle')
  )
    return;
  const shooter = s.units.find((u) => u.uid === p.sourceUid);
  const target = s.units.find((u) => u.uid === p.targetUid);
  if (!shooter || !target || (!CARDS[target.id].members && !p.smallArmsAir))
    return;
  let hash = ((p.uid ?? 0) ^ s.seed ^ 0x541a87) >>> 0;
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  hash = Math.imul(hash ^ (hash >>> 16), 0x45d9f3b);
  const error = (((hash ^ (hash >>> 16)) >>> 0) / 0xffffffff) * 2 - 1;
  const distance = Math.abs(p.tx - p.startX);
  const spread =
    (p.smallArmsAir ? 70 + distance / 6 : 3 + distance / 65) *
    (1 + shooter.suppression / 90) *
    (shooter.moving ? 1.35 : 1) *
    (modelOf(shooter.id) === 'sniper' ? 0.4 : 1);
  p.startLane = shooter.lane;
  p.targetLane = target.lane + error * spread;
}

export function projectileLane(p: Projectile, x: number) {
  if (p.startLane === undefined || p.targetLane === undefined) return null;
  const t =
    Math.abs(p.tx - p.startX) < 0.01
      ? 1
      : Math.max(0, Math.min(1, (x - p.startX) / (p.tx - p.startX)));
  return p.startLane + (p.targetLane - p.startLane) * t;
}

export function depthHit(p: Projectile, u: Unit, x = u.x) {
  const lane = projectileLane(p, x);
  if (lane === null || (!CARDS[u.id].members && !p.smallArmsAir)) return true;
  const half =
    p.smallArmsAir && CARDS[u.id].air
      ? 14
      : u.pose === 'prone'
        ? 3.2
        : u.pose === 'crouch'
          ? 4
          : 5;
  return Math.abs(u.lane - lane) <= half;
}

/** A stopped bullet cannot project pressure or a shooter hint through a nearby wall. */
function shelteredFromRay(
  s: GameState,
  x: number,
  y: number,
  tx: number,
  ty: number,
) {
  if (sceneryIntercept(s, x, y, tx, ty, false, true)) return true;
  const floor = (at: number) =>
    s.terrain[Math.max(0, Math.min(s.terrain.length - 1, Math.round(at)))];
  for (const wall of s.walls)
    if (
      wall.hp > 0 &&
      segmentBox(x, y, tx, ty, {
        x: wall.x - wall.width / 2,
        y: floor(wall.x) - wall.height,
        w: wall.width,
        h: wall.height,
      }) !== null
    )
      return true;
  const steps = Math.max(1, Math.ceil(Math.hypot(tx - x, ty - y) / 2));
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      at = x + (tx - x) * t;
    if (y + (ty - y) * t >= floor(at) - 1) return true;
  }
  return false;
}

/** Near misses suppress only people alongside the traversed ray, once per bullet. */
export function suppressNearMiss(
  s: GameState,
  p: Projectile,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
) {
  if (p.radius || p.damage <= 0 || p.missed || p.startLane === undefined)
    return;
  const dx = tx - sx,
    dy = ty - sy,
    length2 = dx * dx + dy * dy;
  if (length2 < 0.01) return;
  for (const u of s.units) {
    if (
      u.hp <= 0 ||
      u.wounded ||
      u.surrendered ||
      u.side === p.side ||
      !CARDS[u.id].members ||
      p.suppressedUids?.includes(u.uid)
    )
      continue;
    const chest =
      u.y - (u.pose === 'prone' ? 9 : u.pose === 'crouch' ? 22 : 36);
    const t = Math.max(
      0,
      Math.min(1, ((u.x - sx) * dx + (chest - sy) * dy) / length2),
    );
    const x = sx + dx * t,
      y = sy + dy * t;
    if (
      Math.hypot(u.x - x, chest - y) > 26 ||
      Math.abs(u.lane - (projectileLane(p, x) ?? u.lane)) > 12 ||
      shelteredFromRay(s, x, y, u.x, chest)
    )
      continue;
    (p.suppressedUids ??= []).push(u.uid);
    u.suppression = Math.min(
      100,
      u.suppression + (p.ammunition === 'machinegun' ? 4 : 2),
    );
    u.lastThreat = { x: p.startX, y: p.startY, until: s.time + 2 };
    if (u.suppression > 22) u.decisionIn = 0;
    // Rounds cracking overhead kick up dust where they pass, making the
    // suppressing fire visible on the ground below the bullet's path.
    const gx = Math.max(0, Math.min(s.terrain.length - 1, Math.floor(x)));
    const puffs = fxRnd(s) < 0.5 ? 1 : 2;
    for (let i = 0; i < puffs; i++) {
      const life = 0.2 + fxRnd(s) * 0.2;
      s.particles.push({
        kind: 'dust',
        x: x + (fxRnd(s) - 0.5) * 10,
        y: s.terrain[gx] - 1,
        vx: (fxRnd(s) - 0.5) * 14,
        vy: -7 - fxRnd(s) * 10,
        life,
        maxLife: life,
        color: '#94876b',
        size: 4 + fxRnd(s) * 4,
      });
    }
  }
}
