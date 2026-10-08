/** Import imagegen component plates without painting or stretching their pixels. */
import {createRequire} from 'node:module';import {readFileSync,writeFileSync,copyFileSync,mkdirSync} from 'node:fs';import {createHash} from 'node:crypto';
const sharp=createRequire(import.meta.url)('sharp');const input=JSON.parse(readFileSync(process.argv[2]??'public/art/v230-guns/provenance.json','utf8'));const assets=Array.isArray(input)?input:input.assets;
mkdirSync('art-source/v230',{recursive:true});mkdirSync('public/art/v230-guns',{recursive:true});
for(const a of assets){
 const source=`art-source/v230/${a.id}.png`;if(a.source!==source)copyFileSync(a.source,source);a.source=source;
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});const rows=[];
 for(let y=0;y<info.height;y++){let count=0;for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>100)count++;if(count>8)rows.push(y);}
 let gap=0,split=0;for(let n=1;n<rows.length;n++){const d=rows[n]-rows[n-1];if(d>gap&&rows[n]>info.height*.5){gap=d;split=Math.round((rows[n]+rows[n-1])/2);}}
 if(gap<35)throw Error('Components not isolated: '+a.id);
 for(const [name,start,end] of [['body',0,split],['barrel',split,info.height]]){
 let l=info.width,r=0,t=end,b=start;for(let y=start;y<end;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>32){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}
 const crop={left:l,top:t,width:r-l+1,height:b-t+1};a[name+'Crop']=crop;
 await sharp(source).extract(crop).png().toFile(`public/art/v230-guns/${a.id}-${name}.png`);
 }
 a.sha256=createHash('sha256').update(readFileSync(source)).digest('hex');delete a.hint;
}
writeFileSync('public/art/v230-guns/provenance.json',JSON.stringify({version:230,tool:'built-in image_gen',assets},null,2)+'\n');
console.log(assets.map(a=>({id:a.id,body:a.bodyCrop,barrel:a.barrelCrop})));
