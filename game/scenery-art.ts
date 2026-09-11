import { buildingStage, buildingType, type Scenery } from './world';
import { buildingAnimation, type BuildingArt } from './building-art';

export function drawScenery(
  ctx: CanvasRenderingContext2D,
  p: Scenery,
  time: number,
  art: HTMLCanvasElement[],
  buildings: BuildingArt,
  groundAt: (x: number) => number = () => p.y,
) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (p.kind === 'tree') {
    const trunk = p.parts.find((a) => a.kind === 'trunk')!,
      crown = p.parts.find((a) => a.kind === 'crown')!;
    const fallen = trunk.hp <= 0,
      t = fallen ? Math.min(1, (time - trunk.brokenAt) / 0.85) : 0;
    const pine = p.seed % 2 === 0,
      img = art[pine ? 2 : 1],
      w = pine ? 86 : 112,
      h = 140;
    ctx.translate(p.x, p.y - t * 5);
    ctx.scale(1, 1 - t * 0.7);
    ctx.rotate((t * Math.PI) / 2);
    if (fallen) ctx.filter = 'saturate(.55) brightness(.8)';
    if (crown.hp <= 0 && !fallen) {
      ctx.beginPath();
      ctx.rect(-10, -70, 20, 70);
      ctx.clip();
    }
    ctx.drawImage(img, -w / 2, -h, w, h);
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
      frame,
      Math.round(p.x - frame.width),
      Math.round(base - (frame.height - 4) * 2),
      frame.width * 2,
      frame.height * 2,
    );
  }
  ctx.restore();
}
