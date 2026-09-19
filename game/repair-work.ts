import { CARDS } from './cards';
import type { GameState, Unit } from './engine';
import { armorHalf } from './vehicle-geometry';

// The tool reaches the nearest hull end; the mechanic never has to stand
// inside the tank's centre. This is work reach, not a healing aura.
export const REPAIR_REACH = 24;
export const REPAIR_CONTACT_TOLERANCE = 3;
export const REPAIR_FIRST_WORK_S = .35;

export function clearRepairAssignment(u: Unit) {
  if (u.repairTargetUid === undefined && u.repairSide === undefined) return;
  u.repairTargetUid = undefined;
  u.repairSide = undefined;
}

export function repairStation(u: Unit, vehicle: Unit): number {
  const side = u.repairSide ?? (u.x < vehicle.x ? -1 : u.x > vehicle.x ? 1 : u.side === 0 ? -1 : 1);
  return vehicle.x + side * (armorHalf(vehicle.id) + REPAIR_REACH);
}

/** Keep a valid assignment until finished, instead of swapping every health pulse. */
export function pickRepairVehicle(s: GameState, u: Unit): Unit | undefined {
  // One mechanic at either hull end. Other members remain available for
  // protection or another vehicle, instead of drawing three identical bodies
  // on top of one wrench point. Two linear scans replace filter+sort.
  const occupied = new Map<number,number>();
  for (const worker of s.units) {
    if (worker === u || worker.hp <= 0 || worker.wounded || worker.surrendered ||
        worker.tactic === 'retreat' || worker.repairTargetUid === undefined || worker.repairSide === undefined ||
        (worker.squadOrder === 'retreat' && (worker.squadOrderUntil ?? Infinity) > s.time)) continue;
    const bit = worker.repairSide === -1 ? 1 : 2;
    occupied.set(worker.repairTargetUid,(occupied.get(worker.repairTargetUid) ?? 0)|bit);
  }
  let assigned: Unit | undefined, best: Unit | undefined;
  let assignedSide: -1 | 1 | undefined, bestSide: -1 | 1 | undefined;
  for (const v of s.units) {
    const card = CARDS[v.id];
    if (v === u || v.side !== u.side || v.hp <= 0 || v.wounded || v.surrendered ||
        !card.armored || card.air || card.vehicleSupport || v.hp >= v.maxHp ||
        Math.abs(v.x-u.x) > 300) continue;
    const preferred = v.uid === u.repairTargetUid && u.repairSide !== undefined ? u.repairSide
      : u.x < v.x ? -1 : u.x > v.x ? 1 : u.side === 0 ? -1 : 1;
    const other = preferred === -1 ? 1 : -1;
    const half = armorHalf(v.id)+REPAIR_REACH, busy = occupied.get(v.uid) ?? 0;
    const reachable = (side: -1 | 1) => !(busy & (side === -1 ? 1 : 2)) &&
      v.x+side*half >= 125 && v.x+side*half <= s.terrain.length-125;
    const side = reachable(preferred) ? preferred : reachable(other) ? other : undefined;
    if (side === undefined) continue;
    if (v.uid === u.repairTargetUid) { assigned = v; assignedSide = side; }
    if (!best || v.hp/v.maxHp < best.hp/best.maxHp ||
        (v.hp/v.maxHp === best.hp/best.maxHp && Math.abs(v.x-u.x) < Math.abs(best.x-u.x))) {
      best = v; bestSide = side;
    }
  }
  const target = assigned ?? best;
  if (!target) { clearRepairAssignment(u); return; }
  u.repairTargetUid = target.uid;
  u.repairSide = assigned ? assignedSide : bestSide;
  return target;
}

export function atRepairContact(u: Unit, vehicle: Unit): boolean {
  return !vehicle.moving && vehicle.motion === 'ground' &&
    Math.abs(u.x-repairStation(u,vehicle)) <= REPAIR_CONTACT_TOLERANCE &&
    Math.abs(u.y-vehicle.y) < 22;
}
