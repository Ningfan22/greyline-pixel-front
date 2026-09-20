import type { Unit } from './engine';
import { stanceTransitionActive } from './infantry-action-timing';
import { crouchTravelAmount } from './crouch-locomotion';

/** Loading needs both hands and a settled body. Presentation and simulation
 * share this guard so interrupted work resumes instead of finishing unseen. */
export function launcherDrillBusy(u: Unit, time: number): boolean {
  return u.hp <= 0 || u.wounded || u.surrendered || u.moving ||
    u.motion !== 'ground' || u.climbing > 0 || !!u.parachuting || !!u.rappelling ||
    !!u.digging || !!u.tending || u.flash > 0 || u.draggingUid !== undefined ||
    (u.fragThrow ?? 0) > 0 || (u.firstAidUntil ?? 0) > time ||
    stanceTransitionActive(u, time) || crouchTravelAmount(u) > 0;
}

/** This is work remaining after a real discharge, never a wall-clock loop. */
export function launcherDrillCel(u: Unit): number {
  const remaining = u.launcherCycleRemaining ?? 0;
  const duration = u.launcherCycleDuration ?? 0;
  if (remaining <= 0 || duration <= 0) return 0;
  const p = Math.max(0, Math.min(1, 1 - remaining / duration));
  return p < .04 ? 1 : Math.min(7, 2 + Math.floor((p - .04) / .96 * 6));
}

export function advanceLauncherDrill(u: Unit, time: number, weaponStep: number): void {
  if (u.id !== 'grenadiers' || (u.launcherCycleRemaining ?? 0) <= 0 ||
      launcherDrillBusy(u, time)) return;
  u.launcherCycleRemaining = Math.max(0, u.launcherCycleRemaining! - weaponStep);
}
