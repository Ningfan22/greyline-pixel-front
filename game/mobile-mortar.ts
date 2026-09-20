import type { Unit } from './engine';
import { CARDS } from './cards';

export const CARRIER_SCOOT = 96;
export const CARRIER_SETTLE = 0.55;

/** Plan only after a real shot. No enemy reports or hidden-unit queries:
 * the vehicle crew knows its own firing position and selected aim point. */
export function carrierScootGoal(u: Unit, aimX: number, order: string, width: number): number | null {
  if (u.id !== 'mortar_carrier' || order === 'hold' || u.hp <= 0) return null;
  const dir = u.side === 0 ? 1 : -1;
  const gap = (aimX - u.x) * dir;
  if (gap <= 0) return null; // Do not reverse toward an enemy behind the battery.
  const rangeRoom = CARDS.mortar_carrier.range! - gap - 80;
  const edgeRoom = u.side === 0 ? u.x - 80 : width - 80 - u.x;
  const distance = Math.min(CARRIER_SCOOT, rangeRoom, edgeRoom);
  return distance >= 48 ? u.x - dir * distance : null;
}
