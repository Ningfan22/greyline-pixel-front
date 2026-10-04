import { gunPose, type GunBody } from './gun-geometry';
import { CARDS } from './cards';

/** Original painted pixels split into a fixed chassis and an independent gun. */
export interface PaintedGunParts {
  body: HTMLCanvasElement;
  barrel: HTMLCanvasElement;
  barrelPivot: [number, number];
  sourceElevation: number;
  barrelBehindBody?: boolean;
}
export function drawArticulatedGun(
  ctx: CanvasRenderingContext2D, parts: PaintedGunParts,
  body: GunBody & { fire?: number; moving?: boolean }, alpha = 1, depth = 0,
) {
  const pose = gunPose(body);
  if (!pose) return;
  const hullAngle = CARDS[body.id].emplacement ? 0 : body.hullAngle ?? 0;
  const recoil = body.moving || body.id==='mlrs' ? 0 : Math.min(1, Math.max(0, (body.fire ?? 0) / .25)) ** 2 * 5;
  const drawBody = () => {
    ctx.save();
    ctx.translate(body.x, body.y + depth);
    ctx.rotate(hullAngle);
    ctx.scale(pose.facing, 1);
    ctx.drawImage(parts.body, -parts.body.width / 2, -parts.body.height);
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
