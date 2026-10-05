import {VEHICLE_GUNS, type VehicleGunId} from './vehicle-gun-layout';
import type {PaintedGunParts} from './gun-art';
/** Split only the projecting tube. Keep its painted receiver/mantlet on the
 * vehicle, so a 1px recoil cannot open a hole through the original hull. */
export function splitVehicleGun(id:VehicleGunId,frame:HTMLCanvasElement):PaintedGunParts {
  const a=VEHICLE_GUNS[id],body=document.createElement('canvas'),barrel=document.createElement('canvas');
  [body.width,body.height]=a.size;
  const ctx=body.getContext('2d')!;ctx.imageSmoothingEnabled=false;
  ctx.drawImage(frame,0,0,body.width,body.height);
  const [x,y,w,h]=a.barrel;
  barrel.width=w;barrel.height=h;barrel.getContext('2d')!.drawImage(body,x,y,w,h,0,0,w,h);
  ctx.clearRect(x,y,w,h);
  return {body,barrel,barrelPivot:[a.pivot[0]-x,a.pivot[1]-y],sourceElevation:0,bodyGroundOffset:3};
}
