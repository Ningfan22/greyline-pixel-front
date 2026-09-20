// Whole drawings with shared scale, not independently fitted body boxes.
// Nominal 2x4 slicing would sever elbows in the first three generated rows.
import {createRequire} from 'node:module';
import {writeFileSync} from 'node:fs';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
const source=await loadImage(new URL('../public/art/prone-watch-v163.png',import.meta.url).pathname);
const frames=[
 [30,94,738,283,383,275], [798,94,1510,283,1151,275],
 [30,343,738,537,383,529], [798,343,1510,537,1151,529],
 [29,595,738,786,383,778], [798,595,1510,785,1151,777],
 [29,821,738,1011,383,1003], [798,821,1510,1011,1151,1003],
];
const scale=.095,atlas=createCanvas(96*8,96),ctx=atlas.getContext('2d');
ctx.imageSmoothingEnabled=true;
for(const [i,[l,t,r,b,x,y]]of frames.entries()){
 ctx.save();ctx.beginPath();ctx.rect(i*96,0,96,96);ctx.clip();
 ctx.drawImage(source,l,t,r-l,b-t,i*96+48+(l-x)*scale,96+(t-y)*scale,(r-l)*scale,(b-t)*scale);
 ctx.restore();
}
writeFileSync(new URL('../public/art/prone-watch-frames-v163.png',import.meta.url),atlas.toBuffer('image/png'));
console.log(JSON.stringify({width:atlas.width,height:atlas.height,frames,scale}));
