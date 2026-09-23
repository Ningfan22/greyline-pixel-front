import {createRequire} from 'node:module';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {createCanvas,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
const {soldierArt,soldierFrame}=await import('../game/soldier-art.ts');
const {CARDS}=await import('../game/cards.ts');
const {soldierPose}=await import('../game/soldier-pose.ts');
const art=soldierArt(await loadImage('public/art/soldier-parts-v178.png'),await loadImage('public/art/soldier-equipment-v178.png'));
const out=mkdtempSync(join(tmpdir(),'greyline-rig-review-'));
const base={id:'infantry',uid:1,member:0,hp:100,pose:'idle',motion:'ground',moving:false,walk:0};
const cases=[['ready',{}],...Array.from({length:8},(_,i)=>['walk-'+i,{pose:'walk',moving:true,walk:i}]),
  ['knee',{pose:'crouch'}],['knee-walk',{pose:'crouch',moving:true,crouchTravel:1,walk:1}],
  ['prone',{pose:'prone'}],['crawl',{pose:'prone',moving:true,proneTravel:1,walk:2}],
  ['reload',{ammo:0,reloadingStartAt:19.2,reloadingUntil:21}],
  ['moving-reload',{pose:'walk',moving:true,walk:3,ammo:0,reloadingStartAt:19.2,reloadingUntil:21}],
  ['throw',{fragThrow:.6,fragThrowStartedAt:19.5}],['medic',{pose:'crouch',tending:true,tendingKind:'medical',tendingTime:.7}],
  ['dig',{pose:'crouch',digging:true,digElapsed:1}],['rappel',{rappelling:true}],
  ['wounded',{wounded:true,woundedTime:1}],['surrender',{surrendered:true,surrenderTime:1}],
  ['share',{ammoShareUntil:21}],['drag',{draggingUid:99,pose:'walk',moving:true,walk:3}],
  ['observe',{observingUntil:21}],['barrel',{pose:'crouch',overheatedUntil:21}],
  ['deploy',{pose:'crouch',emplacementSetupUntil:21}],['signal',{pointUntil:21,pointDir:-1}],
];
function plate(name,entries,columns=7){
  const c=createCanvas(columns*256,Math.ceil(entries.length/columns)*225+35),ctx=c.getContext('2d');
  ctx.fillStyle='#adb6ad';ctx.fillRect(0,0,c.width,c.height);ctx.imageSmoothingEnabled=false;
  ctx.fillStyle='#17271e';ctx.font='18px monospace';ctx.fillText(name,10,24);
  entries.forEach(([label,u],i)=>{const {image}=soldierFrame(art,{...base,...u},20),x=i%columns*256,y=35+Math.floor(i/columns)*225;
    ctx.drawImage(image,x,y,256,192);ctx.fillStyle='#17271e';ctx.font='14px monospace';ctx.fillText(label,x+10,y+214);});
  writeFileSync(join(out,name+'.png'),c.toBuffer('image/png'));
}
for(const id of ['infantry','marines','armed_police','militia'])plate(id,cases.map(([n,u])=>[n,{...u,id}]));
for(const id of ['rocket','heavy_mg','light_mortar','sniper_team','flame_team','grenadiers'])
  plate(id,cases.map(([n,u])=>[n,{...u,id}]));
plate('roles',Object.entries(CARDS).filter(([,c])=>c.members).map(([id])=>[id,{id,pose:'crouch'}]));
plate('stance-chain',Array.from({length:32},(_,i)=>['pose-'+i,{id:'marines',pose:'prone',poseAnimAt:20-i/31*2.4,poseAnimFrom:'stand',poseAnimSeen:'prone'}]),8);
const fallFrom=soldierPose({...base,id:'marines',pose:'run',moving:true,gaitWeight:1,gaitPhase:2.3},20);
plate('fall-chain',Array.from({length:24},(_,i)=>['fall-'+i,{id:'marines',pose:'prone',wounded:true,woundedTime:i/23*.7,soldierFall:fallFrom}]),8);
const riseFrom=soldierPose({...base,id:'marines',pose:'prone',wounded:true,woundedTime:1},20);
plate('revive-chain',Array.from({length:24},(_,i)=>['rise-'+i,{id:'marines',pose:'crouch',poseAnimFrom:'prone',poseAnimSeen:'crouch',
  poseAnimAt:20-i/23*1.2,soldierRise:{at:20-i/23*1.2,pose:riseFrom}}]),8);
let checked=0;
for(const [id,c]of Object.entries(CARDS))if(c.members)for(let member=0;member<c.members;member++)for(const [,u]of cases){
  const p=soldierPose({...base,...u,id,member},20);
  const points=['hip','neck','nearKnee','farKnee','nearFoot','farFoot','nearElbow','farElbow','nearHand','farHand','muzzle'];
  if(points.some(k=>p[k].some(n=>!Number.isFinite(n))))throw new Error('Invalid joint '+id+'/'+member);
  checked++;
}
console.log(JSON.stringify({out,checked,frames:art.frames.size}));
