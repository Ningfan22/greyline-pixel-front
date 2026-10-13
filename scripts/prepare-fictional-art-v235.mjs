/** Convert imagegen-edited originals into native-sized assets, preserving all other atlas cells. */
import{createRequire}from'node:module';import{mkdirSync}from'node:fs';const sharp=createRequire(import.meta.url)('sharp');
const out='public/art/v235-content';mkdirSync(out,{recursive:true});
for(const id of ['command_lockdown','armed_police','medic_team','field_hospital','fort_medical_post']){
 const old=id==='fort_medical_post'?`public/art/v227-cards/${id}.webp`:`public/art/cards-v10/${id}.webp`;const m=await sharp(old).metadata();await sharp(`art-source/v235/${id}.png`).resize(m.width,m.height,{fit:'contain',kernel:'nearest'}).webp({quality:90,effort:6}).toFile(`${out}/${id}.webp`);
}
await sharp('art-source/v235/fort_medical_post_sprite.png').resize(957,398,{fit:'contain',background:'#ff00ff',kernel:'nearest'}).png().toFile(`${out}/fort_medical_post-sprite.png`);
const {data:atlas,info}=await sharp('public/art/soldier-equipment-v178.png').ensureAlpha().raw().toBuffer({resolveWithObject:true});
const pitch=362,left=1086,top=362;let minX=pitch,minY=pitch,maxX=-1,maxY=-1;
for(let y=0;y<pitch;y++)for(let x=0;x<pitch;x++){const i=((y+top)*info.width+x+left)*4;if(atlas[i+3]>=128){minX=Math.min(minX,x);minY=Math.min(minY,y);maxX=Math.max(maxX,x);maxY=Math.max(maxY,y);}atlas.fill(0,i,i+4);}
const w=maxX-minX+1,h=maxY-minY+1;
const {data:bag,binfo}=await sharp('art-source/v235/medical_equipment_prop.png').trim().resize(w,h,{fit:'contain',background:{r:0,g:0,b:0,alpha:0},kernel:'nearest'}).ensureAlpha().raw().toBuffer({resolveWithObject:true}).then(({data,info})=>({data,binfo:info}));
for(let i=3;i<bag.length;i+=4)bag[i]=bag[i]>=128?255:0;
const encoded=await sharp(bag,{raw:{width:w,height:h,channels:4}}).png().toBuffer();
await sharp(atlas,{raw:{width:info.width,height:info.height,channels:4}}).composite([{input:encoded,left:left+minX,top:top+minY}]).png().toFile(`${out}/soldier-equipment.png`);
console.log(JSON.stringify({cards:5,fortSprite:[957,398],equipmentAtlas:[info.width,info.height],editedCell:[left,top,pitch,pitch],medicalBounds:[minX,minY,w,h]}));
