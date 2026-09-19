import type { Unit } from './engine';
import type { SpecialistSprite } from './adult-specialists';
import { isHeavyGunner } from './machinegun-team';
import { POSE_TRANSITION_S, stanceTransitionActive } from './infantry-action-timing';
import { crouchTravelAmount } from './crouch-locomotion';

// Measured cells of the original transparent image, not assumed 512px tiles.
// Preserve authored pixels/alpha, one scale and a shared knee/foot baseline.
export function heavyMGAtlas(source: HTMLImageElement): SpecialistSprite[] {
  const xs = [0, 444, 887, 1330, 1774], ys = [0, 444, 887];
  const scale = .14, offsets = [0, -1, 0, 1];
  return Array.from({ length: 8 }, (_, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    const image = document.createElement('canvas');
    image.width = 128; image.height = 96;
    const ctx = image.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    const dx = 64 - (148 + offsets[col]) * scale;
    const dy = 93 - (row ? 395 : 396) * scale;
    ctx.drawImage(source, xs[col], ys[row], xs[col+1]-xs[col], ys[row+1]-ys[row],
      dx, dy, (xs[col+1]-xs[col])*scale, (ys[row+1]-ys[row])*scale);
    return { image, muzzle: { x: dx + (421 + offsets[col])*scale - 64,
      height: 96 - (dy + 185*scale) } };
  });
}

/** A real kneeling gun drill, never a replacement for a move, hit or transition. */
export function heavyMGFrame(u: Unit, time: number): number | null {
  if (!isHeavyGunner(u) || u.hp <= 0 || u.wounded || u.surrendered || u.moving ||
      u.pose !== 'crouch' || u.motion !== 'ground' || u.climbing > 0 ||
      u.parachuting || u.rappelling || u.digging || u.tending || u.flash > 0 ||
      u.draggingUid !== undefined || (u.fragThrow ?? 0) > 0 ||
      (u.overheatedUntil ?? 0) > time ||
      stanceTransitionActive(u,time) || crouchTravelAmount(u) > 0 ||
      time - (u.poseAnimAt ?? -Infinity) < POSE_TRANSITION_S) return null;
  if ((u.reloadingUntil ?? 0) > time && (u.ammo === 0 || u.tacticalReload)) {
    const start = u.reloadingStartAt ?? time;
    const progress = Math.max(0, (time-start)/Math.max(.01,u.reloadingUntil!-start));
    return 4 + Math.min(3, Math.floor(progress*4));
  }
  const age = time - (u.lastCombatShotAt ?? -Infinity);
  return age >= 0 && age < .25 ? Math.min(3, Math.floor(age*16)) : 0;
}

export function heavyMGSprite(u: Unit, time: number, frames?: SpecialistSprite[]) {
  const i = heavyMGFrame(u,time);
  return i === null ? null : frames?.[i] ?? null;
}
