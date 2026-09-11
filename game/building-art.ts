import { HOUSE_PROFILES, buildingStage, type Scenery } from './world';
import { transparentSheet } from './sprite-atlas';

export interface BuildingArt {
  states: HTMLCanvasElement[][];
  collapse: HTMLCanvasElement[][];
}

/** Measured atlas rows; a single footprint scale is shared by all damage frames. */
export function buildingFrames(
  states: HTMLImageElement,
  collapse: HTMLImageElement,
): BuildingArt {
  const importSheet = (image: HTMLImageElement, animated: boolean) => {
    const source = transparentSheet(image, animated);
    const xCuts = animated
      ? [0, 267, 523, 779, 1032, 1293, 1540, 1794, 2048]
      : [0, 362, 724, 1086, 1448];
    const yCuts = animated ? [0, 296, 561, 768] : [0, 399, 781, 1086];
    const ground = animated ? [276, 533, 723] : [363, 728, 1013];
    const centers = animated ? [135, 138, 139] : [177, 182, 182];
    const widths = animated ? [221, 234, 242] : [277, 300, 329];
    const heights = animated ? [213, 220, 135] : [280, 295, 180];
    return HOUSE_PROFILES.map((profile, row) =>
      xCuts.slice(0, -1).map((left, col) => {
        const out = document.createElement('canvas');
        out.width = Math.ceil((profile.width + 60) / 2);
        out.height = Math.ceil((profile.height + 24) / 2);
        const ctx = out.getContext('2d')!;
        ctx.imageSmoothingEnabled = false;
        const sx = profile.width / widths[row] / 2,
          sy = profile.height / heights[row] / 2;
        const top = yCuts[row],
          right = xCuts[col + 1];
        // Exclude an isolated export speck below the warehouse's baseline.
        const bottom = Math.min(yCuts[row + 1], ground[row] + 7);
        const originX = centers[row] + col * (animated ? 256 : 362);
        ctx.drawImage(
          source,
          left,
          top,
          right - left,
          bottom - top,
          Math.round(out.width / 2 + (left - originX) * sx),
          Math.round(out.height - 4 + (top - ground[row]) * sy),
          Math.round((right - left) * sx),
          Math.round((bottom - top) * sy),
        );
        return out;
      }),
    );
  };
  return {
    states: importSheet(states, false),
    collapse: importSheet(collapse, true),
  };
}

/** Damage stages stop early; complete structural failure continues into settled rubble. */
export function buildingAnimation(p: Scenery, time: number): number | null {
  if (p.damageAt === undefined) return null;
  const elapsed = Math.max(0, time - p.damageAt),
    stage = buildingStage(p);
  if (stage === 1)
    return elapsed < 0.32 ? Math.min(1, Math.floor(elapsed / 0.16)) : null;
  if (stage === 2)
    return elapsed < 0.42 ? 2 + Math.min(1, Math.floor(elapsed / 0.21)) : null;
  if (stage === 3) {
    const first = p.fromStage === 2 ? 4 : p.fromStage === 1 ? 2 : 0;
    const frame = first + Math.floor(elapsed / 0.2);
    return frame < 8 ? frame : null;
  }
  return null;
}
