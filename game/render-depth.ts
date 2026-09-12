import { CARDS } from './cards';
import type { GameState, Projectile } from './engine';
/** Depth lanes are room to pass, not vertical height. Keep boots within the ground strip. */
export function infantryDepth(lane = 0) {
  return Math.max(-3, Math.min(3, lane / 8));
}
/** A stable depth choice: destroyed objects keep the living unit's UID and its layer. */
export function foregroundObject(seed: number) {
  let n = Math.imul(seed ^ 0x6d2b79f5, 0x45d9f3b);
  n = Math.imul(n ^ (n >>> 16), 0x45d9f3b);
  return ((n ^ (n >>> 16)) >>> 0) / 4294967296 < 1 / 3;
}
/** Preserve physical collision coordinates; only the projected drawing follows squad depth. */
export function projectileForRender(
  s: GameState,
  p: Projectile,
  sourceOffset = { x: 0, y: 0 },
): Projectile {
  const lane = (uid: number | null | undefined) => {
    if (uid == null) return 0;
    const unit = s.units.find((u) => u.uid === uid);
    if (unit) return CARDS[unit.id].members ? infantryDepth(unit.lane) : 0;
    const wreck = s.wrecks.find((w) => w.id === uid);
    return wreck && CARDS[wreck.cardId].members ? infantryDepth(wreck.lane) : 0;
  };
  const sourceLane = lane(p.sourceUid);
  const targetLane = p.radius || p.missed ? 0 : lane(p.targetUid);
  const t = Math.max(
    0,
    Math.min(1, 1 - Math.max(0, p.life) / Math.max(0.001, p.total)),
  );
  return {
    ...p,
    startX: p.startX + sourceOffset.x,
    startY: p.startY + sourceLane + sourceOffset.y,
    ty: p.ty + targetLane,
    x: p.x + sourceOffset.x * (1 - t),
    y: p.y + (sourceLane + sourceOffset.y) * (1 - t) + targetLane * t,
  };
}
