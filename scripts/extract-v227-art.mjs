// Crop and import existing image_gen plate pixels; never author replacement artwork.
import {createRequire} from 'node:module';import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
const sharp=createRequire(import.meta.url)('sharp');
const doc=JSON.parse(readFileSync('public/art/v227-installations/provenance.json','utf8'));
mkdirSync('art-source/v227',{recursive:true});const thumbs=[],layouts={};
const pink=(r,g,b)=>r>55&&b>55&&r-g>25&&b-g>25;
for(const [i,a] of doc.assets.entries()){
 if(!existsSync(a.source))a.source=a.projectSource;
 if(a.source!==`art-source/v227/${a.id}.png`)copyFileSync(a.source,`art-source/v227/${a.id}.png`);a.projectSource=`art-source/v227/${a.id}.png`;
 const {data,info}=await sharp(a.source).ensureAlpha().raw().toBuffer({resolveWithObject:true});const w=info.width,h=info.height;a.width=w;a.height=h;
 if(a.kind==='card'){await sharp(a.source).resize({width:1024,withoutEnlargement:true}).webp({quality:92}).toFile(`public/art/v227-cards/${a.id}.webp`);continue;}
 let divider=0;for(let y=0;y<h;y++){let count=0;for(let x=0;x<w;x++){const n=(y*w+x)*4;if(pink(data[n],data[n+1],data[n+2]))count++;}if(count>w*.48){divider=y;break;}}
 if(!divider)throw Error('No isolated sprite plate: '+a.id);
 await sharp(a.source).extract({left:0,top:0,width:w,height:divider}).webp({quality:92}).toFile(`public/art/v227-cards/${a.id}.webp`);a.cardCrop=[0,0,w,divider];
 const lower=Buffer.from(data);const rows=[];const spriteTop=divider+8;
 for(let y=divider;y<spriteTop;y++)for(let x=0;x<w;x++)lower[(y*w+x)*4+3]=0;
 for(let y=spriteTop;y<h;y++){let count=0;for(let x=0;x<w;x++){const n=(y*w+x)*4;if(pink(lower[n],lower[n+1],lower[n+2]))lower[n+3]=0;else if(lower[n+3]>200)count++;}if(count>3)rows.push(y);}
 const groups=[];for(const y of rows){const last=groups.at(-1);if(!last||y-last[1]>12)groups.push([y,y]);else last[1]=y;}
 async function save(region,name){let l=w,t=h,r=0,b=0;for(let y=region[0];y<=region[1];y++)for(let x=0;x<w;x++){if(lower[(y*w+x)*4+3]>200){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}}
 const rect={left:l,top:t,width:r-l+1,height:b-t+1};await sharp(lower,{raw:{width:w,height:h,channels:4}}).extract(rect).png().toFile(`public/art/v227-installations/${a.id}${name}.png`);return rect;}
 if(a.kind==='fort'){a.spriteCrop=await save([spriteTop,h-1],'');}
 else {if(groups.length<2)throw Error('Gun body/barrel not split: '+a.id);const last=groups.at(-1);a.bodyCrop=await save([groups[0][0],groups.at(-2)[1]],'-body');a.barrelCrop=await save(last,'-barrel');layouts[a.id]={bodyAspect:a.bodyCrop.height/a.bodyCrop.width,barrelAspect:a.barrelCrop.height/a.barrelCrop.width};}
 thumbs.push({input:await sharp(a.source).resize(256,384,{fit:'fill'}).png().toBuffer(),left:(i%4)*256,top:Math.floor(i/4)*384});
}
await sharp({create:{width:1024,height:Math.ceil(doc.assets.filter(a=>a.kind!=='card').length/4)*384,channels:4,background:'#171d19'}}).composite(thumbs).png().toFile('output/v227/asset-plates-contact.png');
writeFileSync('public/art/v227-installations/provenance.json',JSON.stringify(doc,null,2)+'\n');writeFileSync('output/v227/asset-layouts.json',JSON.stringify(layouts,null,2));console.log(doc.assets.filter(a=>a.kind!=='card').map(a=>({id:a.id,cardHeight:a.cardCrop[3],body:a.bodyCrop,sprite:a.spriteCrop,barrel:a.barrelCrop})));
