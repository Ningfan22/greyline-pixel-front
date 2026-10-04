import type { CardId } from './cards';
export const VEHICLE_MISSILE_ROOT = '/art/v209-vehicles-missiles';
export const VEHICLE_IDS_V209 = ['sam_vehicle', 'scout_car'] as const;
export type VehicleIdV209 = typeof VEHICLE_IDS_V209[number];
/** Alpha bounds measured from independently authored sources. One uniform
 * scale preserves body proportions; wheels share the world ground anchor. */
export const VEHICLE_LAYOUT_V209 = {
  sam_vehicle: {stem:'sam', crop:[93,94,1377,857], width:180, height:113,
    wreckCrop:[26,242,1477,698], wreckWidth:180, wreckHeight:86},
  scout_car: {stem:'scout', crop:[115,60,1262,937], width:145, height:108,
    wreckCrop:[105,124,1288,844], wreckWidth:145, wreckHeight:96},
} as const;
export function isVehicleV209(id:string): id is VehicleIdV209 {
  return Object.hasOwn(VEHICLE_LAYOUT_V209,id);
}
export function vehicleSourceV209(id:VehicleIdV209,wreck=false) {
  return `${VEHICLE_MISSILE_ROOT}/${VEHICLE_LAYOUT_V209[id].stem}${wreck?'-wreck':''}.png`;
}
export function authoredFrameV209(image:HTMLImageElement, rect:readonly number[], width:number, height=Math.ceil(rect[3]*width/rect[2])) {
  const frame=document.createElement('canvas');frame.width=width;frame.height=height;
  const ctx=frame.getContext('2d')!;ctx.imageSmoothingEnabled=false;
  const scale=width/rect[2];
  ctx.drawImage(image,rect[0],rect[1],rect[2],rect[3],0,height-rect[3]*scale,width,rect[3]*scale);
  return frame;
}
export function vehicleFrameV209(id:VehicleIdV209,image:HTMLImageElement,wreck=false) {
  const a=VEHICLE_LAYOUT_V209[id];
  return authoredFrameV209(image,wreck?a.wreckCrop:a.crop,wreck?a.wreckWidth:a.width,wreck?a.wreckHeight:a.height);
}
export const MISSILE_LAYOUT_V209 = {
  tow:{stem:'tow-missile',crop:[248,183,1639,360],width:32},
  antitank:{stem:'infantry-missile',crop:[138,188,1707,406],width:27},
  antiair:{stem:'sam-missile',crop:[67,296,1784,291],width:36},
} as const;
export type MissileFamily = keyof typeof MISSILE_LAYOUT_V209 | 'rocket';
/** Dedicated missile families; unguided weapons keep the authored rocket. */
export function missileFamily(id?:CardId):MissileFamily {
  if(id==='tow_ifv')return 'tow';
  if(id==='javelin'||id==='attack_drone')return 'antitank';
  if(id==='sam_vehicle'||id==='manpads'||id==='interceptor')return 'antiair';
  return 'rocket';
}
