import type { Unit } from './engine';
// Shared by simulation and authored cels: a release cannot lead its animation.
export const POSE_TRANSITION_S = 1.2;
export type StanceClass = 'stand' | 'crouch' | 'prone';
export function stanceHeightClass(pose: Unit['pose']): StanceClass {
  return pose === 'prone' ? 'prone' : pose === 'crouch' || pose === 'hunker' ? 'crouch' : 'stand';
}
type PoseClock = Partial<Pick<Unit, 'poseAnimFrom' | 'poseAnimSeen' | 'poseAnimAt'>>;
export function stanceTransitionDuration(u: PoseClock): number {
  // Going all the way to/from the ground traverses BOTH authored segments.
  return POSE_TRANSITION_S * ((u.poseAnimFrom === 'stand' && u.poseAnimSeen === 'prone') ||
    (u.poseAnimFrom === 'prone' && u.poseAnimSeen === 'stand') ? 2 : 1);
}
/** Pure read: drawing (or not drawing) a soldier must never change his clock. */
export function stanceTransitionProgress(u: PoseClock, time: number): number | null {
  if (u.poseAnimFrom === undefined || u.poseAnimSeen === undefined ||
      u.poseAnimAt === undefined || u.poseAnimFrom === u.poseAnimSeen) return null;
  const elapsed = time - u.poseAnimAt;
  return elapsed >= stanceTransitionDuration(u) ? null
    : Math.max(0, elapsed / stanceTransitionDuration(u));
}
export function stanceTransitionActive(u: PoseClock, time: number): boolean {
  return stanceTransitionProgress(u, time) !== null;
}
export const GRENADE_THROW_S = 1.1;
// Cel five still paints the grenade at the fingertips; cel six is empty.
export const GRENADE_RELEASE_S = GRENADE_THROW_S * 5 / 8;
