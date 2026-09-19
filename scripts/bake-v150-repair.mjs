// Register unchanged generated cels; no anatomical painting or per-cel rescaling.
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';
import {writeFileSync} from 'node:fs';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
export const REPAIR_POSTURES=['standing','kneeling','prone'];
export const REPAIR_REGISTRATION=[
  {scale:.172,anchorX:140}, {scale:.148,anchorX:130}, {scale:.207,anchorX:184},
];
// Two prone cels drop the wrench below the ground. Do not ship clipped tools
// or register the whole body against that moving hand; retain the ten valid cels.
export const REPAIR_SOURCE_CELS=[
  Array.from({length:12},(_,i)=>i),Array.from({length:12},(_,i)=>i),[0,1,2,3,6,7,8,9,10,11],
];
export async function repairOriginalFrames(){
  const frames=[];
  for(const [row,pose] of REPAIR_POSTURES.entries()){
    const im=await loadImage(new URL(`../public/art/repair-${pose}-v150.png`,import.meta.url).pathname);
    const source=createCanvas(im.width,im.height),c=source.getContext('2d');c.drawImage(im,0,0);
    const d=c.getImageData(0,0,im.width,im.height).data;
    for(const cel of REPAIR_SOURCE_CELS[row]){
      const x0=Math.round(cel%4*im.width/4),x1=Math.round((cel%4+1)*im.width/4);
      const y0=Math.round(Math.floor(cel/4)*im.height/3),y1=Math.round((Math.floor(cel/4)+1)*im.height/3);
      let left=x1,right=-1,top=y1,bottom=-1,contact=-1;
      for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++)if(d[(y*im.width+x)*4+3]>=16){
        left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);
        // Ground registration follows the planted feet, never the moving tool.
        if(x-x0<190)contact=Math.max(contact,y);
      }
      if(left-x0<2||x1-right<2||top-y0<2||y1-bottom<2||contact<0||bottom-contact>2)
        throw new Error(`Unsafe repair cel ${pose}/${cel}, body/tool contact ${contact}/${bottom}`);
      const {scale,anchorX}=REPAIR_REGISTRATION[row],out=createCanvas(128,96),q=out.getContext('2d');
      q.imageSmoothingEnabled=true;
      q.drawImage(im,x0,y0,x1-x0,y1-y0,64-anchorX*scale,96-(contact-y0+1)*scale,
        (x1-x0)*scale,(y1-y0)*scale);
      frames.push(out);
    }
  }
  return frames;
}
if(import.meta.url===pathToFileURL(process.argv[1]).href){
  const frames=await repairOriginalFrames(),atlas=createCanvas(1536,288),c=atlas.getContext('2d');
  c.imageSmoothingEnabled=false;frames.forEach((f,i)=>c.drawImage(f,i%12*128,Math.floor(i/12)*96));
  const out=new URL('../public/art/repair-work-frames-v150.png',import.meta.url),png=atlas.toBuffer('image/png');
  writeFileSync(out,png);console.log(JSON.stringify({path:out.pathname,bytes:png.length,frames:frames.length}));
}
