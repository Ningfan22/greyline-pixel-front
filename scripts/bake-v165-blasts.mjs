// Build-time packing only: retain complete painted cels and shared registration.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
import {paintedBlastAtlas} from '../game/battlefield-effects-art.ts';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
const report=[];
const measured={
  he:[
    [128,249,189,287],[425,232,510,287],[726,218,849,287],[986,167,1220,289],
    [22,459,296,605],[321,438,624,606],[645,446,922,606],[958,460,1237,607],
    [30,772,274,917],[340,813,594,915],[661,818,921,916],[1005,839,1200,915],
    [73,1128,254,1218],[401,1157,549,1216],[711,1156,864,1216],[1039,1186,1151,1217],
  ],
  grenade:[
    [140,257,178,288],[427,212,518,291],[725,209,849,294],[1005,165,1185,296],
    [52,405,269,599],[360,382,595,597],[684,410,896,595],[1005,402,1188,595],
    [80,720,246,903],[395,748,548,901],[698,720,859,901],[1021,782,1163,900],
    [114,1089,207,1205],[428,1105,505,1205],[774,1116,819,1204],[1086,1173,1110,1205],
  ],
  air:[
    [135,144,178,188],[434,128,513,204],[733,111,833,216],[1002,65,1196,253],
    [48,352,264,576],[346,342,593,597],[656,354,910,596],[990,358,1208,596],
    [57,686,260,892],[370,688,565,880],[691,704,865,877],[1020,716,1185,877],
    [93,1033,209,1158],[428,1035,536,1170],[744,1046,814,1149],[1050,1034,1153,1164],
  ],
};
for(const kind of ['he','grenade','air']){
  const source=await loadImage(new URL(`../public/art/${kind}-blast-v165.png`,import.meta.url).pathname);
  const packed=createCanvas(576,640),ctx=packed.getContext('2d');ctx.imageSmoothingEnabled=false;
  // The generated air cel15 regrows. Put that whole drawing before the three
  // smaller tail cels; never fabricate a fade frame by shrinking/recoloring it.
  const order=kind==='air'?[0,1,2,3,4,5,6,7,8,9,10,11,15,12,13,14]:Array.from({length:16},(_,i)=>i);
  for(const [i,j]of order.entries()){
    const [l,t,r,b]=measured[kind][j],left=l-4,top=t-4,width=r-l+9,height=b-t+9;
    const originX=[156.75,470.25,783.75,1097.25][j%4];
    const originY=kind==='air'?[166,475,790,1100][Math.floor(j/4)]:b;
    const frame=createCanvas(144,160),c=frame.getContext('2d');c.imageSmoothingEnabled=false;
    c.drawImage(source,left,top,width,height,72+(left-originX)*.4,
      (kind==='air'?80:154)+(top-originY)*.4,width*.4,height*.4);
    ctx.drawImage(frame,i%4*144,Math.floor(i/4)*160);
  }
  const file=new URL(`../public/art/blast-${kind}-frames-v165.png`,import.meta.url);
  const bytes=packed.toBuffer('image/png');writeFileSync(file,bytes);
  report.push({kind,path:file.pathname,bytes:bytes.length,scale:.4,order,bounds:measured[kind]});
}
for(const kind of ['fuel','earth']){
  const source=await loadImage(new URL(`../public/art/${kind}-blast-v145.png`,import.meta.url).pathname);
  const frames=paintedBlastAtlas(source,kind),packed=createCanvas(576,640),c=packed.getContext('2d');
  for(const [i,f]of frames.entries())c.drawImage(f,i%4*144,Math.floor(i/4)*160);
  const file=new URL(`../public/art/blast-${kind}-frames-v165.png`,import.meta.url);
  const bytes=packed.toBuffer('image/png');writeFileSync(file,bytes);report.push({kind,path:file.pathname,bytes:bytes.length});
}
console.log(JSON.stringify(report));
