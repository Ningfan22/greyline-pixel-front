import { isBattleTank } from './tank-doctrine';
import type { Unit } from './engine';

export interface TankAim { key: string; x: number; y: number; originX: number; seenAt: number; readyAt: number }
export const TANK_ACQUIRE_S = 3;
/** A new contact needs ranging; stopping/repositioning needs a fresh stable
 * firing platform. Loading overlaps observation, never restarts every round. */
export function tankAimReady(u: Unit, time: number, key: string, x: number, y: number) {
  if (!isBattleTank(u.id)) return true;
  const old = u.tankAim;
  if (!old || old.key !== key || time - old.seenAt > 2 ||
      Math.abs(old.originX - u.x) > .5 || Math.hypot(old.x-x, old.y-y) > 100 ||
      (u.tankMovedAt ?? -Infinity) > old.readyAt-TANK_ACQUIRE_S) {
    u.tankAim = { key, x, y, originX:u.x, seenAt:time, readyAt:time+TANK_ACQUIRE_S };
  } else { old.seenAt=time; old.x=x; old.y=y; }
  return time >= u.tankAim!.readyAt;
}
