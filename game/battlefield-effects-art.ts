/** Calibration of the original 1254-square painted atlases. The generator did
 * not place origins on equal grid lines. Integer per-cel bounds retain soft
 * edges without ever sampling a neighbouring event. One .4 scale throughout. */
const FUEL = [
  [106,221,218,290],[402,168,545,291],[677,115,891,292],[964,64,1217,296],
  [15,349,303,612],[329,356,617,612],[639,378,927,612],[982,384,1218,613],
  [29,656,297,904],[361,680,580,904],[685,680,890,904],[1053,696,1172,902],
  [95,981,212,1204],[435,992,524,1204],[767,1051,826,1204],[1086,1127,1122,1204],
] as const;
const EARTH = [
  [115,224,202,276],[411,157,538,277],[704,85,870,278],[989,31,1217,279],
  [34,318,297,625],[347,355,609,625],[642,437,927,625],[964,484,1232,626],
  [25,796,292,921],[341,786,611,919],[656,803,922,918],[975,815,1225,917],
  [43,1117,291,1219],[363,1141,589,1218],[687,1140,877,1216],[1040,1165,1171,1216],
] as const;
const ORIGIN_X=[156,472,785,1100];
export function paintedBlastAtlas(image: HTMLImageElement, kind: 'fuel'|'earth') {
  const bounds=kind==='fuel'?FUEL:EARTH;
  return bounds.map(([l,t,r,b],i)=>{
    const frame=document.createElement('canvas');frame.width=144;frame.height=160;
    const c=frame.getContext('2d')!;c.imageSmoothingEnabled=false;
    const left=l-4,top=t-4,width=r-l+9,height=b-t+9;
    c.drawImage(image,left,top,width,height,
      72+(left-ORIGIN_X[i%4])*.4,154+(top-b)*.4,width*.4,height*.4);
    return frame;
  });
}

export function paintedFootings(image: HTMLImageElement) {
  return [313,631,947].map(y=>{
    const frame=document.createElement('canvas');frame.width=112;frame.height=24;
    const c=frame.getContext('2d')!;c.imageSmoothingEnabled=false;
    // Intact interior only; the jagged export silhouette is outside this crop.
    // The supplied art's interior alpha is 248–254. Two source-over passes
    // make solid masonry opaque without changing/repainting the original PNG.
    for(let i=0;i<2;i++)c.drawImage(image,88,y,1076,116,0,0,112,24);
    return frame;
  });
}
