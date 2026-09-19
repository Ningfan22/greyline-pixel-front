// Deterministic registration/packing of original generated RGBA cels, not painting.
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { writeFileSync } from 'node:fs';
const { createCanvas, loadImage } = createRequire(import.meta.url)('@napi-rs/canvas');
export const MEDICAL_POSTURES = ['standing','kneeling','prone'];
// One fixed anatomical scale and body anchor per posture: never fit each cel
// to its changing bandage/hand bounds. Contact baselines register to y=96.
export const MEDICAL_REGISTRATION = [
  {scale:.152,anchorFromLeft:74},
  {scale:.112,anchorFromLeft:161},
  {scale:.141,anchorFromLeft:200},
];
export async function medicalOriginalFrames() {
  const frames=[];
  for(const [row,posture] of MEDICAL_POSTURES.entries()) {
    const source=await loadImage(new URL(`../public/art/medical-${posture}-v148.png`,import.meta.url).pathname);
    const c=createCanvas(source.width,source.height),ctx=c.getContext('2d');ctx.drawImage(source,0,0);
    const rgba=ctx.getImageData(0,0,c.width,c.height).data;
    for(let i=0;i<8;i++) {
      const x0=Math.round(i%4*c.width/4),x1=Math.round((i%4+1)*c.width/4);
      const y0=Math.round(Math.floor(i/4)*c.height/2),y1=Math.round((Math.floor(i/4)+1)*c.height/2);
      let left=x1,right=-1,top=y1,bottom=-1;
      for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++) if(rgba[(y*c.width+x)*4+3]>=16) {
        left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
      }
      if(right<left || left-x0<2 || x1-right<2 || top-y0<2 || y1-bottom<2)
        throw new Error(`Unsafe medical cel ${posture}/${i}`);
      // Leave the original antialiased fringe intact, but never sample across a cell.
      const sx=left-2,sy=top-2,w=right-left+5,h=bottom-top+5;
      const {scale,anchorFromLeft}=MEDICAL_REGISTRATION[row];
      const out=createCanvas(128,96),q=out.getContext('2d');q.imageSmoothingEnabled=true;
      q.drawImage(source,sx,sy,w,h,64-(anchorFromLeft+2)*scale,96-(h-2)*scale,w*scale,h*scale);
      frames.push(out);
    }
  }
  return frames;
}
if(import.meta.url===pathToFileURL(process.argv[1]).href) {
  const frames=await medicalOriginalFrames(),atlas=createCanvas(1024,288),ctx=atlas.getContext('2d');
  ctx.imageSmoothingEnabled=false;
  frames.forEach((frame,i)=>ctx.drawImage(frame,i%8*128,Math.floor(i/8)*96));
  const out=new URL('../public/art/medical-work-frames-v148.png',import.meta.url);
  const png=atlas.toBuffer('image/png');writeFileSync(out,png);
  console.log(JSON.stringify({output:out.pathname,bytes:png.length,width:atlas.width,height:atlas.height}));
}
