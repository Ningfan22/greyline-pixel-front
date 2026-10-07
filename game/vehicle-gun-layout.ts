import {pickupMountV223} from './vehicle-art-v223';
import {ifvLayoutV220} from './ifv-art-v220';
import type { CardId } from './cards';
/** Measured painted barrel bounds in the existing final world-sized frames.
 * These are original pixels, not replacement illustrations or drawn shapes. */
export const VEHICLE_GUNS = {
  apc_transport:{size:[180,69],barrel:[115,6,45,8],pivot:[115,6],muzzle:[160,6],recoil:.7,elevation:35},
  ifv: { size:[165,105], barrel:[104,44,40,6], pivot:[104,45.5], muzzle:[144,45.5], recoil:1.5, elevation:70 },
  scout_car: { size:[145,108], barrel:[91,37,16,5], pivot:[91,39.5], muzzle:[107,39.5], recoil:.7, elevation:35 },
  command_vehicle: { size:[151,115], barrel:[90,32,22,5], pivot:[90,34.5], muzzle:[112,34.5], recoil:.7, elevation:35 },
  pickup: { size:[160,88], barrel:[72,9,32,5], pivot:[72,10.5], muzzle:[104,10.5], recoil:.7, elevation:35 },
  mine_clearer: { size:[245,114], barrel:[104,14,21,6], pivot:[104,17], muzzle:[125,17], recoil:.7, elevation:35 },
} as const;
export type VehicleGunId = keyof typeof VEHICLE_GUNS;
export function hasVehicleGun(id: string): id is VehicleGunId {
  return Object.hasOwn(VEHICLE_GUNS,id);
}
export function vehicleGunMount(id: CardId) {
  if(!hasVehicleGun(id)) return null;
  if(id==='apc_transport')return {pivotX:25,pivotHeight:63,barrelLength:44.5,minElevation:-12*Math.PI/180,maxElevation:35*Math.PI/180,restElevation:0};
  if(id==='pickup')return pickupMountV223();
  if(id==='ifv') { const a=ifvLayoutV220(); return {pivotX:a.pivotX,pivotHeight:a.pivotHeight,barrelLength:a.barrelLength,minElevation:-12*Math.PI/180,maxElevation:70*Math.PI/180,restElevation:0}; }
  const a=VEHICLE_GUNS[id];
  return {pivotX:a.pivot[0]-a.size[0]/2,pivotHeight:a.size[1]-a.pivot[1]-3,
    barrelLength:a.muzzle[0]-a.pivot[0],minElevation:-12*Math.PI/180,
    maxElevation:a.elevation*Math.PI/180,restElevation:0};
}
