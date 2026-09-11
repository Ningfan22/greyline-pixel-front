import { CARDS } from './cards';
import type { GameState, Projectile } from './engine';
/** Preserve physical collision coordinates; only the projected drawing follows squad depth. */
export function projectileForRender(
  s: GameState,
  p: Projectile,
  sourceOffset = { x: 0, y: 0 },
): Projectile {
  const lane = (uid: number | null | undefined) => {
    if (uid == null) return 0;
    const unit = s.units.find((u) => u.uid === uid);
    if (unit) return CARDS[unit.id].members ? unit.lane : 0;
    const wreck = s.wrecks.find((w) => w.id === uid);
    return wreck && CARDS[wreck.cardId].members ? (wreck.lane ?? 0) : 0;
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
