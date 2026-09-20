/** Individually registered, complete painted smoke cels. The build-time atlas
 * has six-pixel source padding and a shared .29 scale, never per-frame fitting. */
export function packedSmokeFrames(image: HTMLImageElement) {
  return Array.from({length:16},(_,i)=>{
    const frame=document.createElement('canvas');frame.width=frame.height=96;
    const ctx=frame.getContext('2d')!;ctx.imageSmoothingEnabled=false;
    ctx.drawImage(image,(i%4)*96,Math.floor(i/4)*96,96,96,0,0,96,96);
    return frame;
  });
}
