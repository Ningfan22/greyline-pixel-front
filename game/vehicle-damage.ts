import { CARDS } from './cards';
import type { Ammunition } from './ballistics';
import type { Unit } from './engine';
import { armorHalf, armorHeight } from './vehicle-geometry';

export const TRACK_INTEGRITY = 100;
export const TRACK_REPAIR_SECONDS = 6;

/** Hull health and running gear are independent. Repair work accumulates only
 * while stopped, and several mechanics cannot count the same second twice. */
export interface VehicleDamageState extends Pick<Unit,
  'id' | 'x' | 'y' | 'hp' | 'maxHp' | 'hullAngle' | 'moving' | 'motion'> {
  trackIntegrity?: number;
  trackRepairProgress?: number;
  trackLastRepairAt?: number;
  trackDamagedAt?: number;
}

export interface VehicleTrackHit {
  /** Damage that actually passed armor, cover and blast protection. */
  damage: number;
  source: 'bullet' | 'blast' | 'gas';
  ammunition?: Ammunition;
  hitX?: number;
  hitY?: number;
  time: number;
}

function mobileVehicle(u: VehicleDamageState) {
  const c = CARDS[u.id];
  return !!(c.armored || c.vehicle) && !c.air && !c.static && !c.emplacement && u.hp > 0;
}

export function isImmobilized(u: VehicleDamageState): boolean {
  return mobileVehicle(u) && (u.trackIntegrity ?? TRACK_INTEGRITY) <= 0;
}

export function vehicleNeedsRepair(u: VehicleDamageState): boolean {
  return mobileVehicle(u) &&
    (u.hp < u.maxHp || (u.trackIntegrity ?? TRACK_INTEGRITY) < TRACK_INTEGRITY);
}

function directPenetration(ammo: Ammunition) {
  return ammo === 'ap' || ammo === 'cannon' ? 3
    : ammo === 'rocket' ? 2
    : ammo === 'autocannon' || ammo === 'drone' ? 1 : 0;
}

/** A lower-hull impact wears the exposed running gear. An upper-hull hit is
 * still ordinary HP damage: taking any armor hit does not pin a tank. */
export function damageVehicleTracks(u: VehicleDamageState, hit: VehicleTrackHit): boolean {
  if (!mobileVehicle(u) || !Number.isFinite(hit.damage) || hit.damage <= 0 ||
      hit.source === 'gas' || hit.hitX === undefined || hit.hitY === undefined ||
      !Number.isFinite(hit.hitX) || !Number.isFinite(hit.hitY)) return false;
  const ammo = hit.ammunition;
  if (ammo === 'rifle' || ammo === 'machinegun' || ammo === 'flame' || ammo === 'grenade')
    return false;
  if (hit.source === 'bullet' &&
      (!ammo || directPenetration(ammo) < (CARDS[u.id].armorTier ?? 0))) return false;
  // Weak splash and light autocannon rounds cannot grind through tracks in a
  // few grazing hits. A penetrated light vehicle can still suffer cumulative wear.
  if (hit.damage < (ammo === 'autocannon' ? 10 : 20)) return false;
  const dx = hit.hitX - u.x, dy = hit.hitY - u.y;
  const angle = u.hullAngle ?? 0, cos = Math.cos(angle), sin = Math.sin(angle);
  const localX = dx * cos + dy * sin;
  const localY = -dx * sin + dy * cos;
  const half = armorHalf(u.id);
  const trackTop = -Math.max(12, armorHeight(u.id) * .22);
  const splashReach = hit.source === 'blast' ? 32 : 4;
  if (Math.abs(localX) > half + splashReach || localY < trackTop || localY > 14)
    return false;
  const before = Math.max(0, u.trackIntegrity ?? TRACK_INTEGRITY);
  if (before <= 0) {
    // A hit during repairs destroys the newly fitted work, not the turret.
    u.trackRepairProgress = 0;
    u.trackLastRepairAt = undefined;
    u.trackDamagedAt = hit.time;
    return false;
  }
  const force = ammo === 'autocannon' ? .22 : .42;
  u.trackIntegrity = Math.max(0, before - Math.min(TRACK_INTEGRITY, hit.damage * force));
  u.trackRepairProgress = 0;
  u.trackLastRepairAt = undefined;
  u.trackDamagedAt = hit.time;
  if (u.trackIntegrity > 0) return false;
  u.moving = false;
  return true;
}

/** Return true on the tick where genuine stationary repair restores mobility.
 * HP healing alone never resets a damaged track. */
export function advanceTrackRepair(u: VehicleDamageState, dt: number, time: number): boolean {
  if (!mobileVehicle(u) || (u.trackIntegrity ?? TRACK_INTEGRITY) >= TRACK_INTEGRITY ||
      u.moving || u.motion !== 'ground' || !Number.isFinite(dt) || dt <= 0 ||
      !Number.isFinite(time) || (u.trackDamagedAt ?? -Infinity) >= time) return false;
  const last = u.trackLastRepairAt;
  const active = last === undefined ? dt : Math.min(dt, Math.max(0, time - last));
  if (active <= 0) return false;
  u.trackLastRepairAt = time;
  u.trackRepairProgress = Math.min(TRACK_REPAIR_SECONDS, (u.trackRepairProgress ?? 0) + active);
  if (u.trackRepairProgress + 1e-8 < TRACK_REPAIR_SECONDS) return false;
  const restored = isImmobilized(u);
  u.trackIntegrity = TRACK_INTEGRITY;
  u.trackRepairProgress = 0;
  u.trackLastRepairAt = undefined;
  return restored;
}
