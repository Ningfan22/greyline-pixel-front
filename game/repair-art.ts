/** Offline-registered full-body tool drill, twelve columns and three heights. */
export function packedRepairFrames(source: HTMLImageElement): HTMLCanvasElement[] {
  return Array.from({length:34},(_,i)=>{
    const out=document.createElement('canvas');out.width=128;out.height=96;
    const ctx=out.getContext('2d')!;ctx.imageSmoothingEnabled=false;
    ctx.drawImage(source,i%12*128,Math.floor(i/12)*96,128,96,0,0,128,96);
    return out;
  });
}
