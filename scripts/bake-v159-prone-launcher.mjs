// Pack unchanged whole painted bodies with a shared scale and measured anchors.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
const source=await loadImage(new URL('../public/art/prone-launcher-v159.png',import.meta.url).pathname);
const previous=await loadImage(new URL('../public/art/grenade-launcher-frames-v152.png',import.meta.url).pathname);
// Measured whole-figure rectangles, not assumed equal generated rows.
const cels=[
  [40,65,710,285,354,269],[735,65,1410,285,1044,269],
  [40,330,710,565,357,543],[735,325,1410,560,1045,539],
  [40,590,710,830,357,808],[735,590,1410,830,1045,808],
  [40,845,710,1068,357,1047],[735,850,1410,1070,1047,1051],
];
const scale=.12,out=createCanvas(2048,288),ctx=out.getContext('2d');
ctx.imageSmoothingEnabled=false;ctx.drawImage(previous,0,0);
for(const [i,[l,t,r,b,hip,ground]]of cels.entries()){
  const frame=createCanvas(128,96),c=frame.getContext('2d');c.imageSmoothingEnabled=false;
  c.drawImage(source,l,t,r-l,b-t,64+(l-hip)*scale,96+(t-ground)*scale,(r-l)*scale,(b-t)*scale);
  ctx.drawImage(frame,i*128,192);
  if(i===0){ctx.clearRect(15*128,96,128,96);ctx.drawImage(frame,15*128,96);}
}
const path=new URL('../public/art/grenade-launcher-frames-v159.png',import.meta.url);
const png=out.toBuffer('image/png');writeFileSync(path,png);
console.log(JSON.stringify({path:path.pathname,bytes:png.length,cels,scale}));
