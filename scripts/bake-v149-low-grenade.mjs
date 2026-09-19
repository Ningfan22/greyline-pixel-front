// Calibrate and pack original RGBA drawings; no code-painted anatomy/props.
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {writeFileSync} from 'node:fs';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
export const LOW_GRENADE_REGISTRATION=[
  {posture:'kneeling',scale:.157,anchor:149},
  {posture:'prone',scale:.175,anchor:135},
];
export async function lowGrenadeOriginalFrames() {
  const frames=[];
  for(const {posture,scale,anchor} of LOW_GRENADE_REGISTRATION) {
    const source=await loadImage(new URL(`../public/art/grenade-${posture}-v149.png`,import.meta.url).pathname);
    const c=createCanvas(source.width,source.height),ctx=c.getContext('2d');ctx.drawImage(source,0,0);
    const rgba=ctx.getImageData(0,0,c.width,c.height).data;
    for(let i=0;i<16;i++){
      // Half-pixel grid boundaries become shared integer cuts, never overlapping.
      const x0=Math.round(i%4*c.width/4),x1=Math.round((i%4+1)*c.width/4);
      const y0=Math.round(Math.floor(i/4)*c.height/4),y1=Math.round((Math.floor(i/4)+1)*c.height/4);
      let bottom=-1;
      for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(rgba[(y*c.width+x)*4+3]>=16)bottom=Math.max(bottom,y);
      if(bottom<0||bottom>=y1-2)throw new Error(`Unsafe contact ${posture}/${i}`);
      const out=createCanvas(128,96),q=out.getContext('2d');q.imageSmoothingEnabled=true;
      // Ground contact (not the grenade/arm bounding box) controls y. One
      // common body anchor/scale retains stable knees, hips and anatomy.
      q.drawImage(source,x0,y0,x1-x0,y1-y0,64-anchor*scale,
        96-(bottom-y0+1)*scale,(x1-x0)*scale,(y1-y0)*scale);
      frames.push(out);
    }
  }
  return frames;
}
if(import.meta.url===pathToFileURL(process.argv[1]).href){
  const frames=await lowGrenadeOriginalFrames(),atlas=createCanvas(2048,192),ctx=atlas.getContext('2d');
  ctx.imageSmoothingEnabled=false;frames.forEach((f,i)=>ctx.drawImage(f,i%16*128,Math.floor(i/16)*96));
  const out=new URL('../public/art/low-grenade-frames-v149.png',import.meta.url),png=atlas.toBuffer('image/png');
  writeFileSync(out,png);console.log(JSON.stringify({output:out.pathname,bytes:png.length,width:atlas.width,height:atlas.height}));
}
