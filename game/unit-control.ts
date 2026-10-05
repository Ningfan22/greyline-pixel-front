import { CARDS } from './cards';
import type { GameState, Unit } from './engine';
import { isImmobilized } from './vehicle-damage';
import { vehicleOutOfFuel, vehicleTravelX } from './vehicle-logistics';

export function fixedWingUnit(u: Pick<Unit, 'id'>) {
  const c = CARDS[u.id];
  return !!(c.air && c.sortie && !c.airlift);
}

/** True only for an explicit live local order; global army orders stay unchanged. */
export function localUnitOrder(s: GameState, u: Unit) {
  if (u.logisticsOrder === 'hold') return 'watch';
  return u.squadOrder && (u.squadOrderUntil ?? Infinity) > s.time
    ? u.squadOrder
    : null;
}

/**
 * Run after the live unit's per-frame timers and moving=false reset.
 * A true result means navigation was handled: retain targeting/firing/support,
 * but skip automatic towing, aircraft paths, observer movement and ground movement.
 * Infantry movement is handled by the existing squad-order tactical code.
 */
export function stepUnitControl(s: GameState, u: Unit, dt: number) {
  const c = CARDS[u.id];
  let order = localUnitOrder(s, u);
  if(u.glider)return false;
  if (u.logisticsOrder === 'hold' && !c.air) {
    u.moving = false;
    u.vx = 0;
    return true;
  }
  if (isImmobilized(u) || vehicleOutOfFuel(u)) {
    u.moving = false;
    u.vx = 0;
    return true;
  }
  // A close-contact reverse temporarily owns a parked hull's navigation.
  // The engine carries its watch anchor back with the actual vehicle.
  if (!c.air && order === 'watch' && (u.vehicleReverseUntil ?? 0) > s.time)
    return false;
  if (!c.air && order === 'watch' && u.firingGoal != null &&
      Math.abs(u.firingGoal - (u.squadOrderX ?? u.x)) <= 32)
    return false;
  if (c.emplacement && (order === 'attack' || order === 'retreat')) return false;
  if (c.members || !order || order === 'attack' || u.hp <= 0 || u.surrendered)
    return false;
  if (fixedWingUnit(u) && c.patrolTime) {
    u.flightUntil ??= s.time + c.patrolTime;
    if (s.time >= u.flightUntil) {
      order = 'retreat';
      u.squadOrder = 'retreat';
    }
  }
  const oldX = u.x,
    maxX = s.terrain.length;
  if (order === 'watch') {
    const anchor = u.squadOrderX ?? u.x;
    // A completed local firing adjustment keeps its original post anchor.
    // Returning to that exact obstructed pixel would restart the same move.
    if (!c.air && u.firingWatchAnchorX !== undefined && Math.abs(u.x - anchor) <= 32) {
      u.moving = false;
      u.vx = 0;
      return true;
    }
    if (fixedWingUnit(u)) {
      // A selected aeroplane remains in a small local orbit; it never hovers.
      if (u.x >= anchor + 64) u.patrolDir = -1;
      else if (u.x <= anchor - 64) u.patrolDir = 1;
      const dir = u.patrolDir || u.facing || (u.side === 0 ? 1 : -1);
      u.x += dir * Math.max(36, (c.speed ?? 160) * 0.3) * dt;
      u.facing = dir;
    } else {
      const speed=(c.speed??0)*.8*.65;
      u.x=vehicleTravelX(u,u.x+Math.max(-speed*dt,Math.min(speed*dt,anchor-u.x)));
    }
  } else if (order === 'retreat' && !c.static) {
    const goal = fixedWingUnit(u)
      ? u.side === 0
        ? -240
        : maxX + 240
      : (u.squadOrderX ?? u.x);
    const speed = (c.speed ?? 0) * (c.air ? 1 : 0.8 * 0.65);
    const change = Math.max(
      -speed * dt,
      Math.min(speed * dt, goal - u.x),
    );
    u.x = vehicleTravelX(u, u.x + change);
    if (c.air && change) u.facing = Math.sign(change);
    if (fixedWingUnit(u)) {
      u.patrolExiting = true;
      u.patrolDir = u.side === 0 ? -1 : 1;
    } else if (Math.abs(goal - u.x) < 1) {
      if (!c.air && c.indirect) {
        u.squadOrder = undefined; u.squadOrderX = undefined; u.squadOrderUntil = 0;
      } else {
        u.squadOrder = 'watch';
        u.squadOrderX = u.x;
      }
    }
  }
  u.moving = Math.abs(u.x - oldX) > 0.001;
  u.vx = dt > 0 ? (u.x - oldX) / dt : 0;
  if (c.air) u.y = c.altitude ?? u.y;
  return true;
}
