/** Measured original cels. Equal 4×4 cuts would sever feet and import neighbors.
 * Bounds are exclusive; anchors register the body's planted progression, not
 * its changing bounding-box center. One 0.21 scale for all sixteen drawings. */
export const STANCE_CELS = [
  [79,64,266,364,142], [389,83,581,364,447],
  [694,106,894,364,750], [985,130,1208,361,1047],
  [43,443,273,673,125], [362,454,585,673,441],
  [679,467,899,674,752], [987,467,1216,674,1065],
  [49,755,279,961,137], [353,788,624,961,473],
  [629,819,937,961,769], [930,850,1250,959,1085],
  [21,1098,332,1194,170], [329,1102,626,1193,472],
  [630,1113,944,1194,786], [948,1114,1251,1194,1095],
] as const;

export function stanceAtlas(image: HTMLImageElement): HTMLCanvasElement[] {
  const source = document.createElement('canvas');
  source.width=image.width; source.height=image.height;
  const sc=source.getContext('2d')!; sc.drawImage(image,0,0);
  return STANCE_CELS.map(([left,top,right,bottom,anchor])=>{
    const w=right-left,h=bottom-top,pixels=sc.getImageData(left,top,w,h);
    // A long rifle overlaps a neighbor's rectangular crop in three cels.
    // Keep the largest connected figure, just as the adult atlas importer
    // does; never alter the original PNG or normalize every body to a box.
    const labels=new Int32Array(w*h),queue=new Int32Array(w*h);
    let serial=0,best=0,bestSize=0;
    for(let start=0;start<w*h;start++) {
      if(labels[start] || pixels.data[start*4+3]<128) continue;
      const label=++serial; let head=0,tail=1;
      queue[0]=start;labels[start]=label;
      while(head<tail) {
        const at=queue[head++],x=at%w;
        for(const next of [x?at-1:-1,x<w-1?at+1:-1,at-w,at+w]) {
          if(next<0 || next>=w*h || labels[next] || pixels.data[next*4+3]<128) continue;
          labels[next]=label;queue[tail++]=next;
        }
      }
      if(tail>bestSize){bestSize=tail;best=label;}
    }
    for(let at=0;at<w*h;at++) if(labels[at]!==best) pixels.data[at*4+3]=0;
    const cel=document.createElement('canvas');cel.width=w;cel.height=h;
    cel.getContext('2d')!.putImageData(pixels,0,0);
    const out=document.createElement('canvas');out.width=out.height=96;
    const ctx=out.getContext('2d')!;ctx.imageSmoothingEnabled=true;
    ctx.drawImage(cel,48+(left-anchor)*.21,96-h*.21,w*.21,h*.21);
    return out;
  });
}
