/** Authored transparent cels, with one fixed registration for every state. */
export function gliderAtlas(image: HTMLImageElement) {
  const cuts=[0,272,543,815,1086];
  return Array.from({length:8},(_,i)=>{
    const frame=document.createElement('canvas');frame.width=256;frame.height=100;
    const ctx=frame.getContext('2d')!;ctx.imageSmoothingEnabled=false;
    const row=i>>1,h=cuts[row+1]-cuts[row];
    ctx.drawImage(image,(i%2)*724,cuts[row],724,h,12.16,11.68,231.68,h*.32);
    return frame;
  });
}
