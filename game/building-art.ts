import { HOUSE_PROFILES, buildingStage, type Scenery } from './world';
import { transparentSheet } from './sprite-atlas';

export interface BuildingArt {
  states: HTMLCanvasElement[][];
  collapse: HTMLCanvasElement[][];
  footings?: HTMLCanvasElement[];
}

const footingSpans = new WeakMap<HTMLCanvasElement, readonly [number, number] | null>();
/** The damaged facade/rubble can extend beyond the nominal intact footprint.
 * Measure its painted bottom once, not the roof overhang or isolated specks. */
export function paintedBuildingFootprint(frame: HTMLCanvasElement): readonly [number, number] | null {
  if (footingSpans.has(frame)) return footingSpans.get(frame)!;
  const {width,height}=frame, pixels=frame.getContext('2d')!.getImageData(0,0,width,height).data;
  let left=width,right=-1;
  for(let x=0;x<width;x++)for(let y=height-1;y>=Math.max(1,height-14);y--){
    if(pixels[(y*width+x)*4+3]>=160&&pixels[((y-1)*width+x)*4+3]>=160){
      left=Math.min(left,x);right=Math.max(right,x);break;
    }
  }
  // One source pixel covers the soft masonry edge; bounds are right-exclusive.
  const span: readonly [number,number] | null=right<left?null:[Math.max(0,left-1),Math.min(width,right+2)];
  footingSpans.set(frame,span);return span;
}

/** Painted masonry remains at the original floor level when adjacent soil is
 * excavated. Clip to the terrain silhouette, never extend a flat colour block. */
export function drawBuildingFooting(
  ctx: CanvasRenderingContext2D, p: Scenery, row: number, base: number,
  texture: HTMLCanvasElement, groundAt: (x: number) => number,
  frame?: HTMLCanvasElement,
) {
  const half=HOUSE_PROFILES[row].width/2;
  const span=frame?paintedBuildingFootprint(frame):null;
  const origin=frame?Math.round(p.x-frame.width):0;
  const left=span?origin+span[0]*2:Math.floor(p.x-half),
    right=span?origin+span[1]*2:Math.ceil(p.x+half),top=Math.round(base-7);
  let bottom=base+7;
  ctx.save();ctx.beginPath();ctx.moveTo(left,top);ctx.lineTo(right,top);
  for(let x=right;x>=left;x-=2){const y=Math.max(base+7,groundAt(x)+3);bottom=Math.max(bottom,y);ctx.lineTo(x,y);}
  ctx.lineTo(left,Math.max(base+7,groundAt(left)+3));ctx.closePath();ctx.clip();
  const tileHeight=48;
  // Damage can widen support without stretching the bricks or sliding their
  // pattern. Keep the same world origin and material scale across all stages.
  const tileWidth=HOUSE_PROFILES[row].width,tileOrigin=Math.floor(p.x-half);
  const firstTile=tileOrigin+Math.floor((left-tileOrigin)/tileWidth)*tileWidth;
  for(let y=top;y<bottom;y+=tileHeight)for(let x=firstTile;x<right;x+=tileWidth)
    ctx.drawImage(texture,x,y,tileWidth,tileHeight);
  ctx.restore();
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
  // Minor damage uses its final authored facade immediately. Borrowing early frames
  // from a different collapse sheet briefly restored intact walls and caused a flash.
  if (stage === 1 || stage === 2) return null;
  if (stage === 3) {
    const first = p.fromStage === 2 ? 4 : p.fromStage === 1 ? 2 : 0;
    const frame = first + Math.floor(elapsed / 0.2);
    return frame < 8 ? frame : null;
  }
  return null;
}
