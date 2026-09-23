import {soldierPose,SOLDIER_WEAPON_SIZE,type SoldierBody,type SoldierPose,type Point,type SoldierWeapon} from './soldier-pose';
import type {AdultIdentity} from './adult-animation';
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
/** Atlas cells contain isolated PARTS. Fitting is done once to declared bone
 * dimensions, never to a whole pose's changing bounding box. */
function cropPart(source:HTMLImageElement,x0:number,y0:number,x1:number,y1:number,w:number,h:number) {
  const cell=make(x1-x0,y1-y0),c=cell.getContext('2d')!;
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
  const out=make(w,h),ctx=out.getContext('2d')!;ctx.imageSmoothingEnabled=false;
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
    const original=body[name],copy=make(original.width,original.height),ctx=copy.getContext('2d')!;
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
    const dark=make(copy.width,copy.height),dc=dark.getContext('2d')!;
    for(let i=0;i<d.data.length;i+=4){d.data[i]*=.68;d.data[i+1]*=.70;d.data[i+2]*=.73;}
    dc.putImageData(d,0,0);far[name]=dark;
  }
  cached={near,far};art.uniforms.set(key,cached);return cached;
}
function segment(ctx:CanvasRenderingContext2D,image:HTMLCanvasElement,from:Point,to:Point) {
  ctx.save();ctx.translate(Math.round(from[0]),Math.round(from[1]));
  ctx.rotate(Math.atan2(to[1]-from[1],to[0]-from[0])-Math.PI/2);
  // Fixed dimensions, including overlapping joints. No pose can resize a limb.
  ctx.drawImage(image,-Math.floor(image.width/2),-1);ctx.restore();
}
function at(ctx:CanvasRenderingContext2D,image:HTMLCanvasElement,p:Point,dx=0,dy=0,angle=0) {
  ctx.save();ctx.translate(Math.round(p[0]),Math.round(p[1]));if(angle)ctx.rotate(angle);
  ctx.drawImage(image,dx,dy);ctx.restore();
}
export function paintSoldier(ctx:CanvasRenderingContext2D,art:SoldierArt,p:SoldierPose) {
  const {near:n,far:f}=costume(art,p);
  ctx.imageSmoothingEnabled=false;
  const leg=(parts:Parts,knee:Point,foot:Point,hip:Point)=>{
    segment(ctx,parts.thigh,hip,knee);segment(ctx,parts.shin,knee,foot);at(ctx,parts.boot,foot,-4,-2);
  };
  const arm=(parts:Parts,root:Point,elbow:Point,hand:Point)=>{
    segment(ctx,parts.upperArm,root,elbow);segment(ctx,parts.forearm,elbow,hand);
  };
  leg(f,p.farKnee,p.farFoot,[p.hip[0]-1,p.hip[1]]);
  arm(f,[p.shoulder[0]+1,p.shoulder[1]-1],p.farElbow,p.farHand);
  const spineAngle=Math.atan2(p.hip[1]-p.neck[1],p.hip[0]-p.neck[0])-Math.PI/2;
  at(ctx,p.weapon==='flame'?art.equipment.tanks:n.backpack,p.neck,-14,2,spineAngle);
  if(p.slung&&p.weaponVisible){
    const carried=p.weapon==='rifle'?n.rifle:art.equipment[p.weapon];
    ctx.save();ctx.translate(Math.round(p.neck[0]),Math.round(p.neck[1]));ctx.rotate(spineAngle+1.12);
    if(p.weapon==='hmg'){
      ctx.drawImage(carried,0,0,carried.width,10,-7,3,carried.width,10);
      ctx.fillStyle='#3c4034';ctx.fillRect(-6,14,23,3);
    }else ctx.drawImage(carried,-7,3);
    ctx.restore();
  }
  segment(ctx,n.torso,p.neck,p.hip);at(ctx,n.pelvis,p.hip,-6,-4,spineAngle);
  at(ctx,n.head,p.head,-6,-13,p.headAngle);
  leg(n,p.nearKnee,p.nearFoot,p.hip);
  if(p.weaponVisible&&!p.slung){
    const gun=p.weapon==='rifle'?n.rifle:art.equipment[p.weapon];
    if(p.weapon==='hmg'&&(p.travel>.01||p.low<.9)){
      // Carry the gun and a folded support, not a deployed floating tripod.
      ctx.drawImage(gun,0,0,gun.width,10,Math.round(p.muzzle[0]-gun.width),Math.round(p.muzzle[1]-3),gun.width,10);
      ctx.fillStyle='#3c4034';ctx.fillRect(Math.round(p.neck[0]-12),Math.round(p.neck[1]+4),3,23);
    }else if(p.weapon==='mortar'&&p.travel>.01){
      // The tube/baseplate stay with their crew while moving, at hand height.
      at(ctx,gun,p.nearHand,-13,-16,-.45);
    }else if(p.weapon==='mortar')at(ctx,gun,p.muzzle,-17,0);
    else at(ctx,gun,p.muzzle,-gun.width,-3,p.weaponAngle);
    if(p.weapon==='flame'){
      ctx.strokeStyle='#302d22';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.neck[0]-8,p.neck[1]+16);
      ctx.quadraticCurveTo(p.hip[0]-11,p.hip[1]+9,p.nearHand[0],p.nearHand[1]);ctx.stroke();
    }
  }
  if(p.appearance.uniform==='medic')at(ctx,art.equipment.medical,p.hip,-10,-1);
  arm(n,p.shoulder,p.nearElbow,p.nearHand);
  if(p.prop){
    const hand=p.propHand==='far'?p.farHand:p.nearHand;
    if(p.prop==='shovel'||p.prop==='wrench')at(ctx,art.equipment[p.prop],hand,-2,-5,p.prop==='shovel'?-.28:.25);
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
  // Padding below the unchanged boot anchor fits a downhill foot. Canvas
  // dimensions never resize the man; the renderer keeps this exact anchor.
  const frame=make(SOLDIER_FRAME.width,SOLDIER_FRAME.height),ctx=frame.getContext('2d')!;
  ctx.save();ctx.translate(SOLDIER_FRAME.anchorX,SOLDIER_FRAME.anchorY);paintSoldier(ctx,art,pose);ctx.restore();
  // Rotations may produce edge coverage even with nearest sampling. Resolve
  // once onto the canonical ONE-world-pixel grid; every action uses this path.
  const d=ctx.getImageData(0,0,frame.width,frame.height);for(let i=3;i<d.data.length;i+=4)d.data[i]=d.data[i]>127?255:0;
  ctx.putImageData(d,0,0);art.frames.set(key,frame);
  if(art.frames.size>768)art.frames.delete(art.frames.keys().next().value!);
  return {image:frame,pose,anchorY:SOLDIER_FRAME.anchorY};
}
