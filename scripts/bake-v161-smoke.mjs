// Isolate complete painted cels; no equal-grid crop, repaint or per-cel fit.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
const source=await loadImage(new URL('../public/art/powder-smoke-v161.png',import.meta.url).pathname);
const bounds=[
  [119,145,210,234],[392,105,529,254],[677,81,864,270],[967,73,1190,288],
  [36,368,288,600],[342,361,613,607],[642,355,918,612],[950,357,1226,612],
  [37,671,304,919],[354,669,611,922],[665,665,924,933],[978,669,1223,938],
  [59,981,290,1214],[367,991,596,1205],[681,998,899,1189],[992,1006,1191,1151],
];
const originX=[160,472,785,1098],originY=[190,487,800,1100],scale=.29;
const out=createCanvas(384,384),ctx=out.getContext('2d');ctx.imageSmoothingEnabled=false;
for(const [i,[l,t,r,b]]of bounds.entries()){
  const frame=createCanvas(96,96),c=frame.getContext('2d');c.imageSmoothingEnabled=false;
  const left=l-6,top=t-6,width=r-l+13,height=b-t+13;
  c.drawImage(source,left,top,width,height,48+(left-originX[i%4])*scale,
    48+(top-originY[Math.floor(i/4)])*scale,width*scale,height*scale);
  ctx.drawImage(frame,(i%4)*96,Math.floor(i/4)*96);
}
const path=new URL('../public/art/powder-smoke-frames-v161.png',import.meta.url);
const png=out.toBuffer('image/png');writeFileSync(path,png);
console.log(JSON.stringify({path:path.pathname,bytes:png.length,scale,bounds}));
