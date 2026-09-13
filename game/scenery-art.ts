import { buildingStage, buildingType, type Scenery } from './world';
import { buildingAnimation, type BuildingArt } from './building-art';
import { drawTreeV17, treeFrameV17, type TreeArtV17 } from './tree-art-v17';
import { treeStateV17 } from './tree-state-v17';
import { filteredSprite } from './render-cache';

export function drawScenery(
  ctx: CanvasRenderingContext2D,
  p: Scenery,
  time: number,
  art: HTMLCanvasElement[],
  buildings: BuildingArt,
  trees: TreeArtV17,
  groundAt: (x: number) => number = () => p.y,
) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (p.kind === 'tree') {
    const state = treeStateV17(p, time);
    const frame = treeFrameV17(
      trees,
      state.kind,
      state.health,
      state.fallAge,
      state.bare,
    );
    drawTreeV17(
      ctx,
      state.fallAge !== null
        ? filteredSprite(frame, 'grayscale(1) brightness(.76)')
        : frame,
      p.x,
      p.y + (groundAt(p.x) - p.y) * state.settled,
      state.flip,
    );
  } else {
    const row = buildingType(p),
      stage = buildingStage(p);
    const animation = buildingAnimation(p, time);
    const frame =
      animation === null
        ? stage === 3
          ? buildings.collapse[row][7]
          : buildings.states[row][stage]
        : buildings.collapse[row][animation];
    const settle =
      stage === 3
        ? animation === null
          ? 1
          : Math.max(0, (animation - 4) / 3)
        : 0;
    const base = p.y + (groundAt(p.x) - p.y) * settle;
    // Use complete painted structural states: no floating roofs made from clips.
    // The same state drives the remaining masonry collision in buildingHull.
    ctx.drawImage(
      stage === 3
        ? filteredSprite(frame, 'grayscale(1) brightness(.76)')
        : frame,
      Math.round(p.x - frame.width),
      Math.round(base - (frame.height - 4) * 2),
      frame.width * 2,
      frame.height * 2,
    );
  }
  ctx.restore();
}
