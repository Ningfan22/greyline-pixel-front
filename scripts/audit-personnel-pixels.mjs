import {createRequire} from 'node:module';
import {mkdirSync,writeFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
const {soldierArt,soldierFrame,actorSoldierPoseFrame,SOLDIER_FRAME}=await import('../game/soldier-art.ts');
const {CARDS}=await import('../game/cards.ts');
const {vehicleCrewPose}=await import('../game/vehicle-crew-pose.ts');
const {artilleryCrewPose}=await import('../game/artillery-crew-pose.ts');
const art=soldierArt(await loadImage('public/art/soldier-parts-v178.png'),await loadImage('public/art/soldier-equipment-v178.png'));
const directory=process.argv[2]??'output/v234/personnel';mkdirSync(directory,{recursive:true});
const base={id:'infantry',uid:1,x:950,y:374,lane:0,member:0,hp:100,side:0,pose:'idle',motion:'ground',moving:false,walk:0,facing:1,rifleReady:.7};
const cases=[{}, {pose:'walk',moving:true,walk:2,gaitWeight:1}, {pose:'run',moving:true,gaitWeight:1,gaitRun:1,gaitPhase:2},
 {pose:'crouch'}, {pose:'prone'}, {pose:'walk',moving:true,ammo:0,reloadingStartAt:19,reloadingUntil:21},
 {rappelling:true}, {parachuting:true}, {wounded:true,woundedTime:.7}, {surrendered:true,surrenderTime:1}];
const report={worldPixelsPerRasterPixel:1,frame:SOLDIER_FRAME,sourcePartSizes:{},cards:[],crew:[],checkedFrames:0};
for(const [identity,body] of Object.entries(art.bodies)){
 const sizes=Object.fromEntries(Object.entries(body).map(([name,p])=>[name,[p.width,p.height]]));
 report.sourcePartSizes[identity]=sizes;
 assert.deepEqual(sizes,report.sourcePartSizes.infantry);
}
function inspect(frame){
 assert.equal(frame.image.width,SOLDIER_FRAME.width);assert.equal(frame.image.height,SOLDIER_FRAME.height);
 const pixels=frame.image.getContext('2d').getImageData(0,0,frame.image.width,frame.image.height).data;
 let count=0;for(let i=3;i<pixels.length;i+=4){assert(pixels[i]===0||pixels[i]===255);if(pixels[i])count++;}
 assert(count>100,'Empty personnel sprite');report.checkedFrames++;return frame;
}
const entries=[];
for(const [id,c] of Object.entries(CARDS))if(c.members){
 const weapons=new Set(),identities=new Set();
 for(let member=0;member<c.members;member++)for(const pose of cases){
  const frame=inspect(soldierFrame(art,{...base,id,member,...pose},20));
  weapons.add(frame.pose.weapon);identities.add(frame.pose.appearance.identity);
 }
 report.cards.push({id,name:c.name,members:c.members,identities:[...identities],weapons:[...weapons],worldScale:1});
 entries.push([id,inspect(soldierFrame(art,{...base,id},20))]);
}
const crewEntries=[];
for(const [id,c] of Object.entries(CARDS)){
 const owner={...base,id,uid:9,gunFacing:1,hullAngle:0,reloadingStartAt:19,reloadingUntil:21};
 const vehicle=vehicleCrewPose(owner,20);
 if(vehicle){crewEntries.push([id+' / vehicle crew',inspect(actorSoldierPoseFrame(art,owner,vehicle.pose,3))]);report.crew.push({id,kind:'vehicle',worldScale:1});}
 if(c.emplacement)for(const moving of [false,true])for(let member=0;member<2;member++){
  const crew=artilleryCrewPose({...owner,moving},member,20,()=>374);
  const frame=inspect(actorSoldierPoseFrame(art,owner,crew.pose,member+1));
  report.crew.push({id,kind:'artillery',moving,member,worldScale:1});
  if(!moving&&!member)crewEntries.push([id+' / gun crew',frame]);
 }
}
function plate(name,items,columns=8){
 const canvas=createCanvas(columns*256,Math.ceil(items.length/columns)*280+40),ctx=canvas.getContext('2d');
 ctx.fillStyle='#abb5a6';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.imageSmoothingEnabled=false;
 ctx.fillStyle='#1e2a22';ctx.font='16px sans-serif';ctx.fillText('Native personnel / 2x nearest preview / 1 raster pixel = 1 world pixel',12,25);
 items.forEach(([label,frame],i)=>{const x=i%columns*256,y=40+Math.floor(i/columns)*280;
  ctx.drawImage(frame.image,x,y,256,256);ctx.fillText(label,x+12,y+270);});
 writeFileSync(directory+'/'+name+'.png',canvas.toBuffer('image/png'));
}
plate('all-infantry',entries);plate('all-crew',crewEntries);
plate('identities',['infantry','marines','armed_police','militia'].flatMap(id=>['idle','crouch','prone','run'].map(pose=>[id+' / '+pose,inspect(soldierFrame(art,{...base,id,pose,moving:pose==='run'},20))])),4);
writeFileSync(directory+'/report.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({cards:report.cards.length,crewSamples:report.crew.length,frames:report.checkedFrames,identities:Object.keys(report.sourcePartSizes),nativeFrame:SOLDIER_FRAME,worldScale:1}));
