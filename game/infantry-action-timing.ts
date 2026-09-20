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
/** Cycling a bolt/receiver after a shot is not replacing a magazine. */
export function magazineReloadActive(
  u: Partial<Pick<Unit, 'ammo' | 'tacticalReload' | 'reloadingUntil'>>, time: number,
): boolean {
  return (u.ammo === 0 || !!u.tacticalReload) && (u.reloadingUntil ?? 0) > time;
}
/** Magazine work has one clock even when the soldier starts or stops walking. */
export function magazineReloadCel(
  u: Partial<Pick<Unit, 'reloadingStartAt' | 'reloadingUntil'>>, time: number,
): number {
  const until = u.reloadingUntil ?? 0;
  const start = u.reloadingStartAt ?? until - 1.4;
  const duration = Math.max(.001, until - start);
  return Math.min(7, Math.floor(Math.max(0, time - start) / duration * 8));
}
/** Advance only the deadline, not the work, while another action owns the body.
 * Run once in simulation before casualty/descent branches can return early.
 * Walking is not an interruption; this does not freeze retreat or its refill.
 * A pre-booked knee-settling delay is not charged a second time. */
export function pauseMagazineDrill(u: Unit, time: number, dt: number): void {
  const previous = time - dt;
  if (!magazineReloadActive(u,previous)) return;
  const busy = u.hp <= 0 || u.wounded || u.surrendered || u.rappelling || u.parachuting ||
    u.climbing > 0 || (u.motion !== 'ground' && u.motion !== 'bank') ||
    stanceTransitionActive(u,previous) ||
    ((u.pose === 'crouch' || u.pose === 'hunker') &&
      (u.crouchTravel ?? 0) > 0 && (u.crouchTravel ?? 0) < 1) ||
    (u.pose === 'prone' && (u.proneTravel ?? 0) > 0 && (u.proneTravel ?? 0) < 1) ||
    (u.fragThrow ?? 0) > 0 || u.tending || u.draggingUid !== undefined ||
    (u.firstAidUntil ?? 0) > previous;
  if (!busy) return;
  const start = u.reloadingStartAt ?? u.reloadingUntil! - 1.4;
  const delay = Math.max(0, time - Math.max(previous,start));
  if (delay === 0) return;
  u.reloadingStartAt = start + delay;
  u.reloadingUntil! += delay;
}
export const GRENADE_THROW_S = 1.1;
// Cel five still paints the grenade at the fingertips; cel six is empty.
export const GRENADE_RELEASE_S = GRENADE_THROW_S * 5 / 8;

type ThrowClock = Partial<Pick<Unit, 'fragThrowStartedAt' | 'fragThrow'>>;
/** Simulation and every posture's painted drill read the identical clock. */
export function grenadeElapsed(u: ThrowClock, time: number): number {
  return Math.max(0, Math.min(GRENADE_THROW_S,
    u.fragThrowStartedAt === undefined ? GRENADE_THROW_S - (u.fragThrow ?? 0)
      : time - u.fragThrowStartedAt));
}
export function grenadeReleased(elapsed: number): boolean {
  return elapsed + 1e-9 >= GRENADE_RELEASE_S;
}
export function grenadeCel(u: ThrowClock, time: number, count: 8 | 16): number {
  return Math.min(count - 1, Math.floor((grenadeElapsed(u, time) + 1e-9) / GRENADE_THROW_S * count));
}
