import type { WreckFamily } from './wreck-variants';
import type { WreckKind } from './wreck-geometry';

/** Nine whole painted hulls, wheels registered at (192,184). The source
 * artwork is not recolored, rotated in pieces, or fitted independently. */
export function paintedTankWrecks(image: HTMLImageElement) {
  return Object.fromEntries(['light_tank','tank','heavy_tank'].map((id,row)=>[
    id,Object.fromEntries(['bullet','blast','burn'].map((cause,col)=>{
      const frame=document.createElement('canvas');frame.width=384;frame.height=192;
      const c=frame.getContext('2d')!;c.imageSmoothingEnabled=false;
      c.drawImage(image,col*384,row*192,384,192,0,0,384,192);
      return [cause,[frame]];
    })),
  ])) as Partial<Record<WreckKind,WreckFamily>>;
}
