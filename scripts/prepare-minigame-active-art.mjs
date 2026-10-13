/** Publish only current UI/battle sources to the mini-game resource directory. */
import {createRequire} from 'node:module';import {readFileSync,mkdirSync,copyFileSync,writeFileSync} from 'node:fs';import{dirname}from'node:path';import{createHash}from'node:crypto';import{CARDS}from'../game/cards.ts';import{cardPicturePath}from'../game/card-picture-path.ts';
const sharp=createRequire(import.meta.url)('sharp'),provenance=JSON.parse(readFileSync('public/art/v204-battle/provenance.json'));
const sources=new Set([...provenance.sourceFiles,...provenance.originalSources].map(x=>x.path));
for(const c of Object.values(CARDS))if(!c.internal)sources.add(cardPicturePath(c.id));
for(const id of ['frame','frame-rare','frame-epic','frame-legendary'])sources.add(`/art/cards-v10/${id}.webp`);
for(const p of ['/art/card-pack-v1.webp','/art/card-back-v1.webp','/art/pack-tear-v139.png','/art/home-camp-v14.png'])sources.add(p);
const files=[];
for(const source of sources){const path=source.replace(/\.png$/i,'.webp'),target='minigame-cdn'+path;mkdirSync(dirname(target),{recursive:true});if(source.endsWith('.png'))await sharp('public'+source).webp({lossless:true,effort:6}).toFile(target);else copyFileSync('public'+source,target);const data=readFileSync(target);files.push({source,path:path.replace(/^\//,''),bytes:data.length,sha256:createHash('sha256').update(data).digest('hex')});}
writeFileSync('minigame-cdn/active-art-manifest.json',JSON.stringify({version:235,files},null,2)+'\n');console.log(JSON.stringify({files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0)}));
