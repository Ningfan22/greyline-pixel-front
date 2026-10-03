import type { WreckFamily } from './wreck-variants';
import type { WreckKind } from './wreck-geometry';
import { tankWreckDimensions } from './tank-wreck-geometry';

/** Nine whole painted hulls, wheels registered at (192,184) in the source.
 * One uniform resize follows the new live-vehicle scale; source art stays intact. */
export function paintedTankWrecks(image: HTMLImageElement) {
  return Object.fromEntries((['light_tank','tank','heavy_tank'] as const).map((id,row)=>[
    id,Object.fromEntries(['bullet','blast','burn'].map((cause,col)=>{
      const frame=document.createElement('canvas');
      [frame.width,frame.height]=tankWreckDimensions(id);
      const c=frame.getContext('2d')!;c.imageSmoothingEnabled=false;
      c.drawImage(image,col*384,row*192,384,192,0,0,frame.width,frame.height);
      return [cause,[frame]];
    })),
  ])) as Partial<Record<WreckKind,WreckFamily>>;
}
