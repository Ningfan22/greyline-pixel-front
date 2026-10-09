import {createRequire} from 'node:module';
import {mkdirSync} from 'node:fs';
const sharp=createRequire(import.meta.url)('sharp');
mkdirSync('public/art/v234',{recursive:true});
// Preserve the generated pixel clusters and aspect ratio. Runtime art already
// has its final world size: the compositor must not smooth or fit it again.
const {data,info}=await sharp('art-source/v234/stealth-bomber-original.png')
  .trim().resize(208,84,{fit:'contain',kernel:'nearest',background:{r:0,g:0,b:0,alpha:0}})
  .ensureAlpha().raw().toBuffer({resolveWithObject:true});
for(let i=3;i<data.length;i+=4)data[i]=data[i]>127?255:0;
await sharp(data,{raw:{width:info.width,height:info.height,channels:4}})
  .png().toFile('public/art/v234/stealth-bomber-sprite.png');
console.log('Stealth bomber: 208×84 world pixels, nearest sampling, hard alpha.');
