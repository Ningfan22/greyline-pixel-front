import type { Unit } from './engine';
import type { SpecialistSprite, AdultSpecialistArt, SpecialistFrame } from './adult-specialists';
import { launcherDrillBusy, launcherDrillCel } from './launcher-drill';
import { LAUNCHER_CEL_FEET as feet, LAUNCHER_CEL_MUZZLES as muzzle, WEAPON_POSES } from './weapon-pose-data';

// The generated rows are unequal. Measured crops, fixed anatomical scale,
// and foot anchors keep planted feet still while the hands cycle the breech.
const xs = [0,222,444,666,888,1110,1329,1554,1774];
export function grenadeLauncherAtlas(source: HTMLImageElement): SpecialistSprite[] {
  return Array.from({length:16},(_,i)=>{
    const row=Math.floor(i/8),col=i%8,top=row?425:0,bottom=row?730:425;
    const image=document.createElement('canvas');image.width=128;image.height=96;
    const ctx=image.getContext('2d')!;ctx.imageSmoothingEnabled=false;
    const scale=.195,dx=64-feet[row][col]*scale,dy=96-(row?697:387)*scale;
    ctx.drawImage(source,xs[col],top,xs[col+1]-xs[col],bottom-top,
      dx+xs[col]*scale,dy+top*scale,(xs[col+1]-xs[col])*scale,(bottom-top)*scale);
    const ready=[0,1,6,7].indexOf(col),point=ready>=0?muzzle[row*4+ready]:null;
    return {image,muzzle:point?{x:dx+point[0]*scale-64,height:96-dy-point[1]*scale}:null};
  });
}
export function packedGrenadeLauncher(source: HTMLImageElement): {
  cycle: SpecialistSprite[]; stances: AdultSpecialistArt;
} {
  const images=Array.from({length:40},(_,i)=>{
    const image=document.createElement('canvas');image.width=128;image.height=96;
    const c=image.getContext('2d')!;c.imageSmoothingEnabled=false;
    c.drawImage(source,i%16*128,Math.floor(i/16)*96,128,96,0,0,128,96);return image;
  });
  const cycle=[...images.slice(0,16),...images.slice(32,40)].map((image,i)=>{
    if(i>=16)return {image,muzzle:i===16||i===17||i===23?
      {x:WEAPON_POSES.grenade.prone.muzzle[0]-64,height:96-WEAPON_POSES.grenade.prone.muzzle[1]}:null};
    const row=Math.floor(i/8),col=i%8,ready=[0,1,6,7].indexOf(col);
    const p=ready>=0?muzzle[row*4+ready]:null;
    return {image,muzzle:p?{x:(p[0]-feet[row][col])*.195,
      height:((row?697:387)-p[1])*.195}:null};
  });
  const stance16:SpecialistFrame[]=images.slice(16,32).map(image=>({image,waist:[64,80],muzzle:null}));
  // Exactly the same whole-body endpoints during firing, resting and transitions.
  for(const [i,cel,pose] of [[0,0,'stand'],[7,8,'crouch']] as const){
    stance16[i]={image:cycle[cel].image,...WEAPON_POSES.grenade[pose]};
  }
  stance16[8]=stance16[7];
  Object.assign(stance16[15],WEAPON_POSES.grenade.prone);
  return {cycle,stances:{standing:stance16[0],crouch:stance16[7],prone:stance16[15],stance16}};
}
/** Pure presentation of the actual single-shot cooldown. Never restarts a
 * reload from wall-clock modulo, pose changes, hits, or idle decoration. */
export function grenadeLauncherFrame(u: Unit,time: number): number | null {
  if(u.id!=='grenadiers'||launcherDrillBusy(u,time))return null;
  const cel=launcherDrillCel(u);
  return (u.pose==='prone'?16:u.pose==='crouch'||u.pose==='hunker'?8:0)+cel;
}
export function grenadeLauncherSprite(u: Unit,time: number,frames?: SpecialistSprite[]) {
  const i=grenadeLauncherFrame(u,time);return i===null?null:frames?.[i]??null;
}
