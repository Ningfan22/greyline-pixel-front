import type { Unit } from './engine';
import { magazineReloadActive, stanceTransitionActive } from './infantry-action-timing';
import { crouchTravelAmount } from './crouch-locomotion';

export type SupportWork = 'medical' | 'repair';
type PreviousWork = Pick<Unit, 'tending' | 'tendingKind' | 'tendingTime' | 'tendingTargetUid'>;

export function supportWorkSettled(u: Unit, time: number) {
  return u.hp > 0 && !u.wounded && !u.surrendered && !u.rappelling && !u.parachuting &&
    !u.moving && u.motion === 'ground' && u.climbing <= 0 &&
    !stanceTransitionActive(u,time) && crouchTravelAmount(u) === 0;
}

/** The shovel artwork is kneeling work, never an alternate standing/prone
 * body. Construction and rendering must agree when hands and knees are free. */
export function digWorkSettled(u: Unit, time: number) {
  return (u.pose === 'crouch' || u.pose === 'hunker') && supportWorkSettled(u,time) &&
    !magazineReloadActive(u,time) && !u.tending && u.draggingUid === undefined &&
    (u.firstAidUntil ?? 0) <= time && (u.fragThrow ?? 0) <= 0 &&
    (u.overheatedUntil ?? 0) <= time && u.flash <= 0 && u.fire <= 0 && u.secondaryFire <= 0;
}

/** Work is renewed by the actual service branch, never left latched by an early exit. */
export function beginSupportTick(u: Unit): PreviousWork {
  const previous = {
    tending: u.tending, tendingKind: u.tendingKind,
    tendingTime: u.tendingTime, tendingTargetUid: u.tendingTargetUid,
  };
  u.tending = false;
  u.tendingKind = undefined;
  u.tendingTargetUid = undefined;
  u.tendingTime = 0;
  return previous;
}

export function continueSupportWork(
  u: Unit, previous: PreviousWork, kind: SupportWork,
  targetUid: number, time: number, dt: number,
) {
  const sameTask = previous.tending && previous.tendingKind === kind &&
    previous.tendingTargetUid === targetUid;
  u.tending = true;
  u.tendingKind = kind;
  u.tendingTargetUid = targetUid;
  // Finish the real lowering/rising drill before playing hand work. Keep
  // this clock independent of health pulses and how often the canvas draws.
  const settled = supportWorkSettled(u, time);
  u.tendingTime = settled ? (sameTask ? previous.tendingTime ?? 0 : 0) + dt : 0;
}
