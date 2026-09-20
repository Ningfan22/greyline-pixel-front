// Deterministic packing of unchanged painted bodies, not new artwork.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {grenadeLauncherAtlas} from '../game/grenade-launcher-art.ts';
import {isolateFigure} from '../game/weapon-stance-art.ts';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
const firing=await loadImage(new URL('../public/art/grenade-launcher-v152.png',import.meta.url).pathname);
const source=await loadImage(new URL('../public/art/grenade-launcher-stance-v152.png',import.meta.url).pathname);
const cycle=grenadeLauncherAtlas(firing);
// Standing and lower rows have different authored head scales. Each row
// has one uniform scale; never fit a frame to its changing bounding box.
function cel(rect,anchor,scale){
  const [l,t,r,b]=rect,pad=2,w=r-l+pad*2,h=b-t+pad*2;
  const original=isolateFigure(source,l-pad,t-pad,w,h),out=createCanvas(128,96),c=out.getContext('2d');
  c.imageSmoothingEnabled=false;c.drawImage(original,64+(l-pad-anchor)*scale,96-(h-pad)*scale,w*scale,h*scale);
  return out;
}
const upper=[
  cel([293,76,513,394],367,.184),cel([554,111,774,394],630,.184),
  cel([820,129,1052,394],901,.184),cel([1098,150,1335,392],1178,.184),
];
const lower=[
  cel([272,502,531,680],358,.215),cel([529,516,801,679],615,.215),
  cel([771,538,1087,679],857,.215),cel([1042,569,1359,675],1128,.215),
  cel([1322,588,1626,675],1408,.215),cel([1618,593,1910,676],1704,.215),
];
// Hold the settled knee/prone cels at the seam. The crowded right-edge final
// drawing and the below-ground prone loading row are deliberately not used.
const stance=[cycle[0].image,...upper,cycle[8].image,cycle[8].image,cycle[8].image,
  cycle[8].image,...lower,lower.at(-1)];
const out=createCanvas(2048,192),ctx=out.getContext('2d');ctx.imageSmoothingEnabled=false;
[...cycle.map(f=>f.image),...stance].forEach((im,i)=>ctx.drawImage(im,i%16*128,Math.floor(i/16)*96));
const path=new URL('../public/art/grenade-launcher-frames-v152.png',import.meta.url);
const png=out.toBuffer('image/png');writeFileSync(path,png);console.log(JSON.stringify({path:path.pathname,bytes:png.length,uniqueWholeBodies:26}));
