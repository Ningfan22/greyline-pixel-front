/** Lossless platform-format export, not an art transformation. Source PNGs
 * remain canonical. Verify all visible RGBA values after WebP decoding. */
import {createRequire} from 'node:module';
import {mkdir} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const sharp=createRequire(import.meta.url)('sharp');
const root=fileURLToPath(new URL('..',import.meta.url));
await mkdir(root+'/minigame-cdn/art',{recursive:true});
for(const name of ['soldier-parts-v178','soldier-equipment-v178']){
  const source=root+'/public/art/'+name+'.png',target=root+'/minigame-cdn/art/'+name+'.webp';
  await sharp(source).webp({lossless:true,effort:6}).toFile(target);
  const a=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  const b=await sharp(target).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  assert.equal(a.info.width,b.info.width);assert.equal(a.info.height,b.info.height);
  for(let i=0;i<a.data.length;i+=4){
    assert.equal(a.data[i+3],b.data[i+3]);
    if(a.data[i+3])for(let j=0;j<3;j++)assert.equal(a.data[i+j],b.data[i+j],`${name} pixel ${i/4}`);
  }
  console.log(name+': lossless RGBA verified');
}
