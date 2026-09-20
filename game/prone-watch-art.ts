/** Whole painted breathing/observation cels at one fixed prone baseline. */
export function packedProneWatch(image: HTMLImageElement): HTMLCanvasElement[] {
 return Array.from({length:8},(_,i)=>{
  const frame=document.createElement('canvas');frame.width=frame.height=96;
  frame.getContext('2d')!.drawImage(image,i*96,0,96,96,0,0,96,96);
  return frame;
 });
}
