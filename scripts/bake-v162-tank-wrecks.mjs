// Whole painted states only. Register wheels/ground at a common world scale;
// derive conservative solid-cover rectangles from the same packed alpha.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
const models=[
  {id:'light_tank',file:'light-tank',half:82,centre:606,scale:164/600,
    cells:[[286,69,1012,438,426],[286,456,973,840,827],[286,856,1012,1215,1204]]},
  {id:'tank',file:'main-battle-tank',half:110,centre:590,scale:220/776,
    cells:[[174,37,1135,444,432],[174,461,1120,864,849],[174,872,1134,1231,1219]]},
  {id:'heavy_tank',file:'heavy-tank',half:137,centre:600,scale:274/835,
    cells:[[150,15,1116,444,430],[151,451,1113,870,855],[150,870,1116,1239,1225]]},
];
const width=384,height=192,baseline=184;
const atlas=createCanvas(width*3,height*3),ctx=atlas.getContext('2d');ctx.imageSmoothingEnabled=false;
const geometries={};
function solidRects(frame){
  const d=frame.getContext('2d').getImageData(0,0,width,height).data,rects=[];
  let previous=new Map();
  for(let y=0;y<baseline;y+=4){
    const spans=[];let start=-1;
    for(let x=0;x<=width;x+=4){
      let solid=0;
      if(x<width)for(let dy=0;dy<4;dy++)for(let dx=0;dx<4;dx++)solid+=d[((y+dy)*width+x+dx)*4+3]>=160?1:0;
      if(solid>=10&&start<0)start=x;
      if(solid<10&&start>=0){spans.push([start,x-start]);start=-1;}
    }
    const next=new Map();
    for(const [x,w]of spans){
      const key=`${x}/${w}`,old=previous.get(key);
      if(old){old[3]+=4;next.set(key,old);}else{const r=[x,y,w,4];rects.push(r);next.set(key,r);}
    }
    previous=next;
  }
  return rects.map(r=>r.map((v,i)=>Number((v/(i%2?height:width)).toFixed(6))));
}
for(const [row,m]of models.entries()){
  const source=await loadImage(new URL(`../public/art/${m.file}-wrecks-v162.png`,import.meta.url).pathname);
  const parts={};
  for(const [col,[l,t,r,b,ground]]of m.cells.entries()){
    const frame=createCanvas(width,height),c=frame.getContext('2d');c.imageSmoothingEnabled=false;
    c.drawImage(source,l,t,r-l,b-t,width/2+(l-m.centre)*m.scale,
      baseline+(t-ground)*m.scale,(r-l)*m.scale,(b-t)*m.scale);
    ctx.drawImage(frame,col*width,row*height);
    parts[['bullet','blast','burn'][col]]=solidRects(frame);
  }
  geometries[m.id]={support:[(width/2-m.half)/width,(width/2+m.half)/width,baseline/height],parts};
}
writeFileSync(new URL('../public/art/tank-wreck-frames-v162.png',import.meta.url),atlas.toBuffer('image/png'));
writeFileSync(new URL('../game/tank-wreck-collision.json',import.meta.url),JSON.stringify(geometries,null,2)+'\n');
console.log(JSON.stringify({models,width,height,baseline,rectangles:Object.fromEntries(Object.entries(geometries).map(([id,g])=>[id,Object.fromEntries(Object.entries(g.parts).map(([cause,v])=>[cause,v.length]))]))}));
