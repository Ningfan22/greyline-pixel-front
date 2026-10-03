import { CARDS } from './cards';
import type { Unit } from './engine';

export const VEHICLE_FUEL_CAPACITY = 100;
// A full tank must cover the 3840px battlefield to a gun line and its return
// route. The former 4200px range triggered the return reserve halfway across
// the map, before even an MLRS could reach the enemy base's firing range.
export const VEHICLE_FUEL_RANGE = 6400;
export const VEHICLE_FUEL_REFILL_RATE = 10;

export function hasVehicleFuel(u: Pick<Unit, 'id'>) {
  const c = CARDS[u.id];
  return !!(c.vehicle || c.armored) && !c.air && !c.members &&
    !c.static && !c.emplacement && (c.speed ?? 0) > 0;
}

export function vehicleFuelRatio(u: Pick<Unit, 'id' | 'fuel'>) {
  return hasVehicleFuel(u)
    ? Math.max(0, Math.min(1, (u.fuel ?? VEHICLE_FUEL_CAPACITY) / VEHICLE_FUEL_CAPACITY))
    : 1;
}

export function vehicleOutOfFuel(u: Pick<Unit, 'id' | 'fuel'>) {
  return hasVehicleFuel(u) && vehicleFuelRatio(u) <= 1e-8;
}

/** Commit powered travel only. Shells are never spent by driving; both stores
 * feed the same small logistics bar. Collision-limited distance is passed in,
 * so an idle, blocked, airborne or physically pushed hull burns no fuel here. */
export function vehicleTravelX(u: Pick<Unit, 'id' | 'x' | 'fuel'>, proposedX: number) {
  if (!hasVehicleFuel(u)) return proposedX;
  u.fuel ??= VEHICLE_FUEL_CAPACITY;
  const delta = proposedX - u.x;
  const distance = Math.min(Math.abs(delta), vehicleFuelRatio(u) * VEHICLE_FUEL_RANGE);
  u.fuel = Math.max(0, u.fuel - distance / VEHICLE_FUEL_RANGE * VEHICLE_FUEL_CAPACITY);
  return u.x + Math.sign(delta) * distance;
}
