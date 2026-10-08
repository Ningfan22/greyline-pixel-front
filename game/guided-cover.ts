import type { GameState } from './engine';
import { nearbyObstacles, segmentBox } from './world';
import { heightfieldIntercept } from './terrain-ray';

export interface GuidancePoint { x: number; y: number }

/** Guided ordnance clears intervening roof and tree silhouettes. The same
 * waypoints govern launch eligibility and the actual missile's flight.
 * Unguided weapons retain their own collision rules. */
export function guidedCoverRoute(s: GameState, sx: number, sy: number, tx: number, ty: number): GuidancePoint[] {
  const boxes = nearbyObstacles(s, sx, tx).filter(b =>
    b.prop?.kind === 'house' || (b.prop?.kind === 'tree' && !b.foliage));
  const obstructing = boxes.filter(b => segmentBox(sx, sy, tx, ty, b) !== null);
  if (!obstructing.length || Math.abs(tx - sx) < 2) return [];
  const dir = Math.sign(tx - sx), left = Math.min(sx, tx), right = Math.max(sx, tx);
  // Include every intervening silhouette, so a second tree or taller house
  // cannot intercept the horizontal leg planned above the first obstacle.
  const roofs = boxes.filter(b => b.x + b.w > left && b.x < right);
  const roofY = Math.min(sy, ty, ...roofs.map(b => b.y)) - 24;
  const first = Math.max(left + 1, Math.min(...roofs.map(b => b.x)) - 24);
  const last = Math.min(right - 1, Math.max(...roofs.map(b => b.x + b.w)) + 24);
  return dir > 0 ? [{ x: first, y: roofY }, { x: last, y: roofY }]
    : [{ x: last, y: roofY }, { x: first, y: roofY }];
}

/** Houses are depth scenery; soil and live trunks remain solid. Ruins and
 * decorative wrecks are already excluded by the shared obstacle index. */
export function guidedSegmentIntercept(s: GameState, sx: number, sy: number, tx: number, ty: number) {
  let hit = heightfieldIntercept(s, sx, sy, tx, ty);
  for (const box of nearbyObstacles(s, sx, tx)) {
    if (box.prop?.kind === 'house' || box.foliage) continue;
    const t = segmentBox(sx, sy, tx, ty, box);
    if (t !== null && (!hit || t < hit.t))
      hit = { x: sx + (tx - sx) * t, y: sy + (ty - sy) * t, t };
  }
  return hit;
}

export function guidedShotIntercept(s: GameState, sx: number, sy: number, tx: number, ty: number) {
  for (const point of [...guidedCoverRoute(s, sx, sy, tx, ty), { x: tx, y: ty }]) {
    const hit = guidedSegmentIntercept(s, sx, sy, point.x, point.y);
    if (hit) return hit;
    sx = point.x; sy = point.y;
  }
  return null;
}
