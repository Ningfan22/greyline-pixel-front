import {hasVehicleGun,VEHICLE_GUNS} from './vehicle-gun-layout';
import { gunPose, type GunBody } from './gun-geometry';
import { CARDS } from './cards';

/** Original painted pixels split into a fixed chassis and an independent gun. */
export interface PaintedGunParts {
  body: HTMLCanvasElement;
  bodyFrames?: HTMLCanvasElement[];
  barrel: HTMLCanvasElement;
  barrelPivot: [number, number];
  sourceElevation: number;
  barrelBehindBody?: boolean;
  bodyGroundOffset?: number;
}
export function drawArticulatedGun(
  ctx: CanvasRenderingContext2D, parts: PaintedGunParts,
  body: GunBody & { fire?: number; moving?: boolean }, alpha = 1, depth = 0, motionFrame = 0,
) {
  const pose = gunPose(body);
  if (!pose) return;
  const hullAngle = body.hullAngle ?? 0;
  const recoil = gunRecoil(body);
  const drawBody = () => {
    ctx.save();
    ctx.translate(body.x, body.y + depth + (parts.bodyGroundOffset ?? 0));
    ctx.rotate(hullAngle);
    ctx.scale((CARDS[body.id].emplacement ? (body.gunFacing ?? pose.facing) : (body.facing ?? pose.facing)) < 0 ? -1 : 1, 1);
    const chassis = parts.bodyFrames?.[motionFrame % parts.bodyFrames.length] ?? parts.body;
    ctx.drawImage(chassis, -chassis.width / 2, -chassis.height);
    ctx.restore();
  };
  const drawBarrel = () => {
    ctx.save();
    ctx.translate(pose.pivot.x - Math.cos(pose.angle) * recoil, pose.pivot.y + depth - Math.sin(pose.angle) * recoil);
    ctx.rotate(pose.angle);
    // Keep the painted top of the barrel uppermost when facing left.
    ctx.scale(1, pose.facing);
    ctx.rotate(parts.sourceElevation);
    ctx.drawImage(parts.barrel, -parts.barrelPivot[0], -parts.barrelPivot[1]);
    ctx.restore();
  };
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  ctx.globalAlpha = alpha;
  if (parts.barrelBehindBody) { drawBarrel(); drawBody(); }
  else { drawBody(); drawBarrel(); }
  ctx.restore();
}

/** Vehicle suspension stays planted; rapid weapons only vibrate their tube. */
export function gunRecoil(body:GunBody & {fire?:number;moving?:boolean}) {
  const length = hasVehicleGun(body.id) ? VEHICLE_GUNS[body.id].recoil : 5;
  return body.moving || body.id === 'mlrs' ? 0 : Math.min(1,Math.max(0,(body.fire ?? 0)/.25)) ** 2 * length;
}
export function visualGunMuzzle(body:GunBody & {fire?:number;moving?:boolean}) {
  const pose=gunPose(body);if(!pose)return null;
  const recoil=gunRecoil(body);
  return {x:pose.muzzle.x-Math.cos(pose.angle)*recoil,y:pose.muzzle.y-Math.sin(pose.angle)*recoil};
}
