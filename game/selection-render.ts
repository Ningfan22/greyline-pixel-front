import { CARDS } from './cards';
import { unitSize } from './art';
import { infantryDepth } from './render-depth';
import { tankGeometry } from './vehicle-geometry';
import type { Unit } from './engine';

/** A body-sized hit region, excluding long barrels, antennas and transparent atlas margins. */
export function unitSelectionBounds(u: Unit) {
  const c = CARDS[u.id],
    geometry = tankGeometry(u.id);
  const feet = u.y + (c.members ? infantryDepth(u.lane) : 0);
  if (c.members) {
    const height =
      u.wounded || u.pose === 'prone'
        ? 19
        : u.pose === 'hunker'
          ? 30
          : u.pose === 'crouch'
            ? 39
            : 61;
    const half =
      u.wounded || u.pose === 'prone' ? 27 : u.pose === 'hunker' ? 16 : 13;
    return { x: u.x - half, y: feet - height, w: half * 2, h: height + 3 };
  }
  const [w, h] = unitSize(u.id);
  const half = geometry?.half ?? w * (c.air ? 0.36 : 0.42);
  const height = geometry?.hullHeight ?? h * (c.air ? 0.62 : 0.85);
  return { x: u.x - half, y: feet - height, w: half * 2, h: height + 4 };
}

/** Cheap screen-space rectangle test against only the cover already drawn in front. */
export function selectionOccluded(
  u: Unit,
  cover: readonly { x: number; y: number; w: number; h: number }[],
) {
  const b = unitSelectionBounds(u),
    x = u.x,
    y = b.y + b.h * 0.5;
  return cover.some(
    (r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h,
  );
}

/** Call after foreground cover, only for visible units inside the viewport. No vision queries here. */
export function drawUnitSelection(
  ctx: CanvasRenderingContext2D,
  u: Unit,
  options: { selected: boolean; visible: boolean; occluded?: boolean },
) {
  if (!options.visible || u.hp <= 0 || u.surrendered) return;
  const c = CARDS[u.id],
    feet = Math.round(u.y + (c.members ? infantryDepth(u.lane) : 0) + 2);
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (options.selected) {
    const width = c.members ? 18 : c.air ? 26 : 30;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.95;
    ctx.strokeRect(Math.round(u.x - width / 2) + 0.5, feet + 0.5, width, 4);
  }
  if (options.occluded) {
    const b = unitSelectionBounds(u),
      y = Math.round(b.y - 5),
      x = Math.round(u.x);
    ctx.globalAlpha = options.selected ? 0.85 : 0.55;
    ctx.fillStyle = u.side === 0 ? '#edf3e5' : '#d9b2a0';
    // A restrained three-pixel chevron identifies a known body without erasing wrecks.
    ctx.fillRect(x - 3, y, 2, 1);
    ctx.fillRect(x - 1, y + 1, 2, 1);
    ctx.fillRect(x + 1, y, 2, 1);
  }
  ctx.restore();
}
