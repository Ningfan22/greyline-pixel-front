import type { Blast, GameState, Side } from './engine';
import { pointVisible } from './world';

/** The fire and smoke rise above the impact: a hidden crater floor must not hide the whole sprite. */
export function blastVisible(s: GameState, side: Side, b: Blast) {
  if (pointVisible(s, side, b.x, b.y)) return true;
  if (!b.soil) {
    // Air flashes and armor sparks stay local; never substitute a ray to the ground below them.
    const reach = b.kind === 'penetration' ? 4 : Math.min(24, b.radius);
    return pointVisible(s, side, b.x, b.y - reach);
  }
  const height =
    b.kind === 'grenade'
      ? Math.min(32, Math.max(16, b.radius))
      : Math.min(96, Math.max(32, b.radius * 1.6));
  // Sample inside the authored plume, not arbitrary points beyond observation range.
  return [8, height * 0.5, height].some((dy) =>
    pointVisible(s, side, b.x, b.y - dy),
  );
}
