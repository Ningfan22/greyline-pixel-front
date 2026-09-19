import type { Unit } from './engine';
import { magazineReloadActive, stanceTransitionActive } from './infantry-action-timing';

export const CROUCH_STEP_S = .9;
export const CROUCH_STOP_GRACE_S = 1.25;
type LowBody = Pick<Unit, 'pose'> & Partial<Pick<Unit, 'moving' | 'crouchTravel'>>;
export function crouchTravelAmount(u: LowBody) {
  return u.pose === 'crouch' || u.pose === 'hunker'
    ? Math.max(0, Math.min(1, u.crouchTravel ?? (u.moving ? 1 : 0))) : 0;
}
export function crouchMotionActive(u: LowBody) {
  const p = crouchTravelAmount(u); return p > 0 && p < 1;
}
export function crouchStartDelay(u: LowBody) {
  return u.pose === 'crouch' || u.pose === 'hunker' ? (1-crouchTravelAmount(u))*CROUCH_STEP_S : 0;
}
/** Intent is recorded even while the boots must wait for the knee to rise. */
export function requestCrouchStep(u: Unit, time?: number) {
  if (u.pose !== 'crouch' && u.pose !== 'hunker') return true;
  u.crouchMoveRequested = true;
  if (time !== undefined && crouchTravelAmount(u) < 1 &&
      (u.crouchStepCommittedUntil ?? 0) <= time)
    u.crouchStepCommittedUntil = time+(1-crouchTravelAmount(u))*CROUCH_STEP_S+.35;
  return crouchTravelAmount(u) >= 1;
}
/** Called once after all navigation branches, including early-return work. */
export function stepCrouchLocomotion(u: Unit, time: number, dt: number) {
  if (u.hp <= 0 || u.wounded || u.surrendered || u.rappelling || u.parachuting ||
      u.climbing > 0 || u.motion !== 'ground' || !['crouch','hunker'].includes(u.pose)) {
    u.crouchTravel = undefined; u.crouchStoppedFor = 0; u.crouchStepCommittedUntil = 0; return;
  }
  if (stanceTransitionActive(u, time)) {
    u.crouchTravel = u.poseAnimToTravel ?? 0; u.crouchStoppedFor = 0; return;
  }
  const p = crouchTravelAmount(u), moving = u.crouchMoveRequested || u.moving;
  if (!moving && p < 1) u.crouchStepCommittedUntil = 0;
  u.crouchStoppedFor = moving ? 0 : (u.crouchStoppedFor ?? 0) + dt;
  const work = magazineReloadActive(u,time) || u.tending || u.digging ||
    (u.firstAidUntil ?? 0) > time || (u.fragThrow ?? 0) > 0 || (u.overheatedUntil ?? 0) > time;
  // Never freeze halfway up while waiting out the stop grace. If a fresh
  // contact cancels the first step, return smoothly to the planted knee.
  const firingHold = p === 1 && time-(u.lastCombatShotAt ?? -Infinity) < CROUCH_STOP_GRACE_S;
  let target = p;
  if (moving) target = 1;
  else if (work || p < 1 || (!firingHold && u.crouchStoppedFor > CROUCH_STOP_GRACE_S+1e-8)) target = 0;
  const delta = Math.max(-dt/CROUCH_STEP_S, Math.min(dt/CROUCH_STEP_S,target-p));
  const next = p+delta;
  // Explicit endpoints prevent floating-point tails from pinning the feet.
  u.crouchTravel = next < 1e-6 ? 0 : next > 1-1e-6 ? 1 : next;
}
/** Finish lowering before the first magazine cel; preserve all eight beats. */
export function startMagazineDrill(u: Unit, time: number, duration: number) {
  const settle = !u.moving ? crouchTravelAmount(u) * CROUCH_STEP_S : 0;
  u.reloadingStartAt = time + settle;
  u.reloadingUntil = u.reloadingStartAt + duration;
}
