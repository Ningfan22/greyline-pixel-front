import {soldierPose,SOLDIER_WEAPON_SIZE,type SoldierBody,type SoldierPose,type Point,type SoldierWeapon} from './soldier-pose';
import type {AdultIdentity} from './adult-animation';
import type {SoldierRagdoll} from './soldier-ragdoll';
type Part='head'|'torso'|'upperArm'|'forearm'|'thigh'|'shin'|'boot'|'rifle'|'backpack'|'pelvis';
type Parts=Record<Part,HTMLCanvasElement>;
type Equipment=Exclude<SoldierWeapon,'rifle'>|'tanks'|'medical'|'shovel'|'wrench';
export const SOLDIER_FRAME={width:128,height:128,anchorX:64,anchorY:96} as const;
export interface SoldierArt {
  bodies:Record<AdultIdentity,Parts>;
  equipment:Record<Equipment,HTMLCanvasElement>;
  uniforms:Map<string,{near:Parts;far:Parts}>;
  frames:Map<string,HTMLCanvasElement>;
}
const make=(w:number,h:number)=>{const c=document.createElement('canvas');c.width=w;c.height=h;return c;};
// Pose alpha is resolved on the CPU. Keep its source parts and costumes in
// the same memory: copying GPU source canvases into a CPU pose also reads back.
const context=(canvas:HTMLCanvasElement)=>canvas.getContext('2d',{willReadFrequently:true})!;
/** Atlas cells contain isolated PARTS. Fitting is done once to declared bone
 * dimensions, never to a whole pose's changing bounding box. */
function cropPart(source:HTMLImageElement,x0:number,y0:number,x1:number,y1:number,w:number,h:number) {
  const cell=make(x1-x0,y1-y0),c=context(cell);
  c.drawImage(source,x0,y0,x1-x0,y1-y0,0,0,cell.width,cell.height);
  const data=c.getImageData(0,0,cell.width,cell.height);let l=cell.width,t=cell.height,r=-1,b=-1;
  // Ignore a neighbouring object's isolated gutter pixels. Weapons with a
  // tripod/sling remain one connected component; no fragment may enlarge
  // another weapon's fitted bounds or become a floating pixel in battle.
  const visited=new Uint8Array(cell.width*cell.height);let largest:number[]=[];
  for(let seed=0;seed<visited.length;seed++){
    if(visited[seed]||data.data[seed*4+3]<=150)continue;
    const component=[seed];visited[seed]=1;
    for(let q=0;q<component.length;q++){
      const at=component[q],x=at%cell.width,y=Math.floor(at/cell.width);
      for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){
        const nx=x+dx,ny=y+dy,index=ny*cell.width+nx;
        if(nx<0||ny<0||nx>=cell.width||ny>=cell.height||visited[index]||data.data[index*4+3]<=150)continue;
        visited[index]=1;component.push(index);
      }
    }
    if(component.length>largest.length)largest=component;
  }
  const keep=new Uint8Array(visited.length);for(const at of largest)keep[at]=1;
  for(let at=0;at<keep.length;at++)if(!keep[at])data.data[at*4+3]=0;
  c.putImageData(data,0,0);
  for(let y=0;y<cell.height;y++)for(let x=0;x<cell.width;x++)if(keep[y*cell.width+x]){
    l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);
  }
  if(r<l)throw new Error(`Empty soldier part at ${x0},${y0}`);
  const out=make(w,h),ctx=context(out);ctx.imageSmoothingEnabled=false;
  ctx.drawImage(cell,l,t,r-l+1,b-t+1,0,0,w,h);
  const pixels=ctx.getImageData(0,0,w,h);
  for(let i=3;i<pixels.data.length;i+=4)pixels.data[i]=pixels.data[i]>150?255:0;
  ctx.putImageData(pixels,0,0);return out;
}
export function soldierArt(parts:HTMLImageElement,equipment:HTMLImageElement):SoldierArt {
  // Measured gutters of the generated 1983x793 part atlas. The long rifle
  // owns a wider source cell; unlike the old atlas no cut crosses a part.
  const cuts=[0,205,396,569,737,916,1104,1260,1590,1785,1983];
  const names:Part[]=['head','torso','upperArm','forearm','thigh','shin','boot','rifle','backpack','pelvis'];
  const sizes:Point[]=[[14,14],[15,24],[7,14],[6,15],[8,19],[7,19],[11,5],[36,9],[10,18],[13,8]];
  const bodies={} as SoldierArt['bodies'];
  for(const [row,id] of (['infantry','marines','police','militia'] as const).entries()){
    const body={} as Parts;
    names.forEach((name,col)=>{body[name]=cropPart(parts,Math.round(cuts[col]*parts.width/1983),
      Math.round(row*parts.height/4),Math.round(cuts[col+1]*parts.width/1983),Math.round((row+1)*parts.height/4),sizes[col][0],sizes[col][1]);});
    bodies[id]=body;
  }
  const gear={} as SoldierArt['equipment'];
  const items:Equipment[]=['lmg','hmg','rocket','manpads','sniper','grenade','mortar','flame','tanks','medical','shovel','wrench'];
  const props:Partial<Record<Equipment,Point>>={tanks:[12,22],medical:[11,10],shovel:[8,27],wrench:[4,14]};
  items.forEach((name,i)=>{const col=i%6,row=Math.floor(i/6),size=props[name]??SOLDIER_WEAPON_SIZE[name as SoldierWeapon];
    gear[name]=cropPart(equipment,Math.round(col*equipment.width/6),Math.round(row*equipment.height/2),
      Math.round((col+1)*equipment.width/6),Math.round((row+1)*equipment.height/2),size[0],size[1]);});
  return {bodies,equipment:gear,uniforms:new Map(),frames:new Map()};
}
function costume(art:SoldierArt,p:SoldierPose) {
  const key=p.appearance.identity+'/'+p.appearance.uniform;let cached=art.uniforms.get(key);if(cached)return cached;
  const body=art.bodies[p.appearance.identity],near={} as Parts,far={} as Parts;
  const tint:Record<string,Point|readonly [number,number,number]>={
    elite:[.74,.79,.69],assault:[.76,.81,.68],recon:[.84,.91,.71],heavy:[.90,.87,.68],
    crew:[.88,.87,.78],engineer:[1.02,.88,.63],medic:[.94,1.02,.90],
  };
  for(const name of Object.keys(body) as Part[]){
    const original=body[name],copy=make(original.width,original.height),ctx=context(copy);
    ctx.drawImage(original,0,0);const d=ctx.getImageData(0,0,copy.width,copy.height);
    const palette=tint[p.appearance.uniform];
    for(let i=0;i<d.data.length;i+=4){
      const [r,g,b]=[d.data[i],d.data[i+1],d.data[i+2]];
      // Skin, black gloves/boots and the weapon are never cloth-tinted.
      if(palette&&name!=='head'&&name!=='rifle'&&name!=='boot'&&g>b*1.12&&g>=r*.90){
        d.data[i]=r*palette[0];d.data[i+1]=g*palette[1];d.data[i+2]=b*(palette[2]??1);
      }
    }
    ctx.putImageData(d,0,0);near[name]=copy;
    const dark=make(copy.width,copy.height),dc=context(dark);
    for(let i=0;i<d.data.length;i+=4){d.data[i]*=.68;d.data[i+1]*=.70;d.data[i+2]*=.73;}
    dc.putImageData(d,0,0);far[name]=dark;
  }
  cached={near,far};art.uniforms.set(key,cached);return cached;
}
function segment(ctx:CanvasRenderingContext2D,image:HTMLCanvasElement,from:Point,to:Point,openWrist=false) {
  ctx.save();ctx.translate(Math.round(from[0]),Math.round(from[1]));
  ctx.rotate(Math.atan2(to[1]-from[1],to[0]-from[0])-Math.PI/2);
  // Fixed dimensions, including overlapping joints. No pose can resize a limb.
  if(openWrist){
    ctx.drawImage(image,0,0,image.width,11,-Math.floor(image.width/2),-1,image.width,11);
    ctx.drawImage(image,1,11,4,3,-2,9,4,5); // continuous wrist beneath the separate palm
  }
  else ctx.drawImage(image,-Math.floor(image.width/2),-1);ctx.restore();
}
function at(ctx:CanvasRenderingContext2D,image:HTMLCanvasElement,p:Point,dx=0,dy=0,angle=0) {
  ctx.save();ctx.translate(Math.round(p[0]),Math.round(p[1]));if(angle)ctx.rotate(angle);
  ctx.drawImage(image,dx,dy);ctx.restore();
}
export function paintSoldier(ctx:CanvasRenderingContext2D,art:SoldierArt,p:SoldierPose) {
  const {near:n,far:f}=costume(art,p);
  ctx.imageSmoothingEnabled=false;
  const leg=(parts:Parts,knee:Point,foot:Point,hip:Point)=>{
    const phase=p.phase+(parts===f?Math.PI:0),cycle=((phase/(2*Math.PI))%1+1)%1;
    const ankle=cycle>.5&&p.low<1.5?Math.sin((cycle-.5)*Math.PI*4)*.22*p.travel:0;
    const footAngle=parts===f?p.farFootAngle:p.nearFootAngle;
    segment(ctx,parts.thigh,hip,knee);segment(ctx,parts.shin,knee,foot);at(ctx,parts.boot,foot,-4,-2,footAngle??ankle);
  };
  const handShape=(parts:Parts,hand:Point,shape:SoldierPose['nearHandShape'])=>{
    if(!shape)return;
    const x=Math.round(hand[0]),y=Math.round(hand[1]),glove=parts.forearm;
    // Reuse the glove texture and palette, separating the palm and fingers
    // from the forearm's fixed gun-gripping fist.
    ctx.drawImage(glove,1,11,4,4,x-2,y-3,4,4);
    for(let i=0;i<4;i++)ctx.drawImage(glove,2,11,1,3,x-2+i,y-(shape==='open'?7:4)-(i===1||i===2?1:0),1,shape==='open'?4:2);
    ctx.drawImage(glove,2,11,2,3,x-4,y-3,2,3);
  };
  const arm=(parts:Parts,root:Point,elbow:Point,hand:Point,shape?:SoldierPose['nearHandShape'])=>{
    segment(ctx,parts.upperArm,root,elbow);segment(ctx,parts.forearm,elbow,hand,!!shape);handShape(parts,hand,shape);
  };
  const equipment=(gun:HTMLCanvasElement,carry:number)=>{
    const proneMount=Math.max(0,Math.min(1,(p.low-1.65)/.35));
    const settle=proneMount*proneMount*(3-2*proneMount);
    if(settle>0&&carry<.5&&p.weapon==='hmg'){
      // The lower tripod telescopes when the operator lies behind the gun.
      // Keep the receiver, sights and hand grips at their rigid gun sockets.
      ctx.drawImage(gun,0,0,49,13,0,0,49,13);
      ctx.drawImage(gun,0,13,49,13,0,13,49,13-5*settle);
    }else if(settle>0&&carry<.5&&p.weapon==='mortar'){
      // The base plate/bipod settles onto the ground without raising the tube
      // and the hands that grip its upper half.
      ctx.drawImage(gun,0,0,25,18,0,0,25,18);
      ctx.drawImage(gun,0,18,25,15,0,18,25,15-7*settle);
    }else if(p.weapon==='hmg'&&carry>.5){
      ctx.drawImage(gun,0,0,gun.width,10,0,0,gun.width,10);
      // Keep the feed box; only the deployed tripod folds onto the pack.
      ctx.drawImage(gun,20,10,12,5,20,10,12,5);
    }else if(p.weapon==='mortar'&&carry>.5){
      // The source tube is diagonal: a rectangular strip amputated its lower
      // half. Mask along the actual tube, leaving the unfolded bipod behind.
      ctx.save();ctx.beginPath();ctx.moveTo(15,0);ctx.lineTo(23,2);
      ctx.lineTo(8,31);ctx.lineTo(1,30);ctx.closePath();ctx.clip();
      ctx.drawImage(gun,0,0);ctx.restore();
    }else if((p.weapon==='lmg'||p.weapon==='sniper')&&p.travel>.01){
      // Fold the bipod during travel, retaining the stock, trigger and feed.
      const cut=p.weapon==='lmg'?8:7;
      ctx.drawImage(gun,0,0,gun.width,cut,0,0,gun.width,cut);
      ctx.drawImage(gun,0,cut,22,gun.height-cut,0,cut,22,gun.height-cut);
    }else ctx.drawImage(gun,0,0);
  };
  leg(f,p.farKnee,p.farFoot,[p.hip[0]-1,p.hip[1]]);
  if(!p.hideFarArm)arm(f,[p.shoulder[0]+1,p.shoulder[1]-1],p.farElbow,p.farHand,p.farHandShape);
  const spineAngle=Math.atan2(p.hip[1]-p.neck[1],p.hip[0]-p.neck[0])-Math.PI/2;
  at(ctx,p.weapon==='flame'?art.equipment.tanks:n.backpack,p.neck,-14,2,spineAngle);
  if(p.weaponVisible&&(p.weaponCarry>.5||p.slung)&&(p.weapon==='hmg'||p.weapon==='mortar')){
    const gear=art.equipment[p.weapon];
    ctx.save();ctx.translate(Math.round(p.neck[0]),Math.round(p.neck[1]));ctx.rotate(spineAngle);
    // Reuse the authored support pieces as a folded bundle on the pack.
    // The gun/tube stays in the hands; the mount does not simply disappear.
    if(p.weapon==='hmg')ctx.drawImage(gear,0,12,49,14,-18,4,6,23);
    else {
      ctx.drawImage(gear,0,28,25,5,-17,19,14,5);
      ctx.drawImage(gear,16,12,9,20,-18,1,5,20);
    }
    ctx.restore();
  }
  if(p.slung&&p.weaponVisible){
    const carried=p.weapon==='rifle'?n.rifle:art.equipment[p.weapon];
    ctx.save();ctx.translate(Math.round(p.neck[0]),Math.round(p.neck[1]));ctx.rotate(spineAngle+1.12);
    ctx.translate(-7,3);equipment(carried,1);
    ctx.restore();
  }
  segment(ctx,n.torso,p.neck,p.hip);at(ctx,n.pelvis,p.hip,-6,-4,spineAngle);
  at(ctx,n.head,p.head,-6,-13,p.headAngle);
  leg(n,p.nearKnee,p.nearFoot,p.hip);
  if(p.weaponVisible&&!p.slung){
    const gun=p.weapon==='rifle'?n.rifle:art.equipment[p.weapon];
    ctx.save();ctx.translate(Math.round(p.weaponOrigin[0]),Math.round(p.weaponOrigin[1]));
    ctx.rotate(p.weaponAngle);equipment(gun,p.weaponCarry);ctx.restore();
    // The far forearm crosses over the fore-end. Painting it before the gun
    // hid its glove and made the supporting hand appear to float underneath.
    if(['ready','cover','listen','scan'].includes(p.action))segment(ctx,f.forearm,p.farElbow,p.farHand);
    if(p.weapon==='flame'){
      ctx.strokeStyle='#302d22';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.neck[0]-8,p.neck[1]+16);
      ctx.quadraticCurveTo(p.hip[0]-11,p.hip[1]+9,p.nearHand[0],p.nearHand[1]);ctx.stroke();
    }
  }
  if(p.appearance.uniform==='medic')at(ctx,art.equipment.medical,p.hip,-10,-1);
  arm(n,p.shoulder,p.nearElbow,p.nearHand,p.nearHandShape);
  if(p.prop){
    const hand=p.propHand==='far'?p.farHand:p.nearHand;
    if(p.prop==='shovel'&&p.toolOrigin){
      at(ctx,art.equipment.shovel,p.toolOrigin,0,0,p.toolAngle);
      segment(ctx,f.forearm,p.farElbow,p.farHand);
      segment(ctx,n.forearm,p.nearElbow,p.nearHand);
    }else if(p.prop==='shovel'||p.prop==='wrench')at(ctx,art.equipment[p.prop],hand,-2,-5,p.prop==='shovel'?-.28:.25);
    else if(p.prop==='rocketRound'||p.prop==='mortarRound'||p.prop==='shell'){
      const x=Math.round(hand[0]),y=Math.round(hand[1]),long=p.prop==='rocketRound';
      ctx.fillStyle='#646146';ctx.fillRect(x-1,y-(long?9:5),3,long?15:9);
      ctx.fillStyle='#b4a36c';ctx.fillRect(x,y-(long?11:7),1,2);
      if(p.prop!=='shell'){ctx.fillStyle='#393d33';ctx.fillRect(x-3,y+(long?4:2),7,2);}
    }else if(p.prop==='belt'){
      const x=Math.round(hand[0]),y=Math.round(hand[1]);ctx.fillStyle='#30352b';ctx.fillRect(x-5,y,11,2);
      ctx.fillStyle='#a79158';for(let i=0;i<5;i++)ctx.fillRect(x-5+i*2,y-2,1,5);
    }else {
      const x=Math.round(hand[0]),y=Math.round(hand[1]);
      ctx.fillStyle=p.prop==='bandage'?'#d1caba':p.prop==='grenade'?'#52523a':'#2a302c';
      ctx.fillRect(x-2,y-2,p.prop==='binoculars'?8:4,p.prop==='magazine'?6:4);
    }
  }
}
export function soldierFrame(art:SoldierArt,u:SoldierBody,time:number) {
  const pose=soldierPose(u,time);
  // Quantise only the raster cache key, not simulation or skeletal movement.
  // Full appearance + weapon + action avoids cross-unit cache contamination.
  const key=JSON.stringify(pose,(k,v)=>{
    if(k==='phase')return undefined;
    if(typeof v!=='number')return v;
    // Half a radian would erase head checks and small changes of gun pitch.
    const grid=k.endsWith('Angle')||k==='travel'||k==='low'?1024:2;
    return Math.round(v*grid)/grid;
  });
  const existing=art.frames.get(key);if(existing)return {image:existing,pose,anchorY:SOLDIER_FRAME.anchorY};
  const frame=make(SOLDIER_FRAME.width,SOLDIER_FRAME.height);
  paintFrame(frame,art,pose);art.frames.set(key,frame);
  if(art.frames.size>768)art.frames.delete(art.frames.keys().next().value!);
  return {image:frame,pose,anchorY:SOLDIER_FRAME.anchorY};
}

function paintFrame(frame:HTMLCanvasElement,art:SoldierArt,pose:SoldierPose,readbackFree=false) {
  const ctx=readbackFree?frame.getContext('2d')!:context(frame);
  ctx.clearRect(0,0,frame.width,frame.height);
  ctx.save();ctx.translate(SOLDIER_FRAME.anchorX,SOLDIER_FRAME.anchorY);
  paintSoldier(ctx,art,pose);ctx.restore();
  // The small-screen renderer keeps the native nearest-neighbour rotated
  // sprite edges. Its live pose stays GPU-backed, with no per-actor readback.
  // Full hard-alpha export/desktop rasters retain their exact previous pixels.
  if(!readbackFree){
    const d=ctx.getImageData(0,0,frame.width,frame.height);
    for(let i=3;i<d.data.length;i+=4)d.data[i]=d.data[i]>127?255:0;
    ctx.putImageData(d,0,0);
  }
}
type ActorRaster={image:HTMLCanvasElement;key:string;version:number};
const actorRasters=new WeakMap<SoldierArt,WeakMap<object,Map<number,ActorRaster>>>();
/** Renderer-only raster. Draw it immediately: the same actor owns and reuses
 * this canvas on subsequent frames. Different actors and crew slots never
 * share mutable pixels. The public soldierFrame API remains immutable. */
export function actorSoldierFrame(art:SoldierArt,owner:object,u:SoldierBody,time:number,slot=0,readbackFree=false) {
  const pose=soldierPose(u,time);
  return actorSoldierPoseFrame(art,owner,pose,slot,readbackFree);
}
/** Crew actions provide a rig pose while retaining the same bounded raster cache. */
export function actorSoldierPoseFrame(art:SoldierArt,owner:object,pose:SoldierPose,slot=0,readbackFree=false) {
  const rasterSlot=slot*2+(readbackFree?1:0);
  // Include phase and full precision: ankle rotation also depends on phase.
  // This is an exact unchanged-pose check, not an animation frame-rate cap.
  const key=JSON.stringify(pose);
  let actors=actorRasters.get(art);
  if(!actors){actors=new WeakMap();actorRasters.set(art,actors);}
  let slots=actors.get(owner);
  if(!slots){slots=new Map();actors.set(owner,slots);}
  let entry=slots.get(rasterSlot);
  if(!entry){
    entry={image:make(SOLDIER_FRAME.width,SOLDIER_FRAME.height),key:'',version:0};
    slots.set(rasterSlot,entry);
  }
  if(entry.key!==key){
    paintFrame(entry.image,art,pose,readbackFree);entry.key=key;entry.version++;
  }
  return {image:entry.image,pose,anchorY:SOLDIER_FRAME.anchorY,version:entry.version};
}

/** Draw only cached costume/atlas pieces. Physics owns their transforms;
 * rendering creates no per-frame surface and never changes the simulation. */
export function drawSoldierRagdoll(ctx:CanvasRenderingContext2D,art:SoldierArt,pose:SoldierPose,rag:SoldierRagdoll) {
  ctx.save();ctx.imageSmoothingEnabled=false;
  if(rag.age===0){
    ctx.translate(rag.originX,rag.originY);ctx.scale(rag.facing,1);
    paintSoldier(ctx,art,pose);ctx.restore();return;
  }
  const uniform=costume(art,pose);
  for(const part of rag.parts){
    const body=uniform[part.layer];
    const image=part.kind==='weapon'?(pose.weapon==='rifle'?body.rifle:art.equipment[pose.weapon]):
      part.kind==='backpack'&&pose.weapon==='flame'?art.equipment.tanks:
      part.kind==='medical'||part.kind==='shovel'||part.kind==='wrench'?art.equipment[part.kind]:
      body[part.kind as Part];
    ctx.save();ctx.translate(part.x,part.y);ctx.rotate(part.angle);ctx.scale(rag.facing,1);
    ctx.drawImage(image,-part.width/2,-part.height/2);ctx.restore();
  }
  ctx.restore();
}
