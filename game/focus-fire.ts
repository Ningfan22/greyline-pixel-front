import { CARDS } from './cards';
import { visibleToSide } from './world';
import type { GameState, Side, Unit } from './engine';

/** A squad re-picks its priority target at most this often, so fire stays concentrated. */
const FOCUS_TTL = 0.6;
/** Only targets within this radius of the squad centre can be designated. */
const FOCUS_RADIUS = 720;

/** Per-game cache: `${side}:${squad}` -> the designated target uid and when it was chosen. */
const focusCache = new WeakMap<
  GameState,
  Map<string, { uid: number; at: number }>
>();

/**
 * Heuristic "threat value" of a unit, used to pick which enemy a squad should
 * concentrate fire on. Observers and medics are worth more than riflemen;
 * half-dead units are worth finishing off.
 */
export function targetValue(v: Unit): number {
  const c = CARDS[v.id];
  let value = 0;
  if (c.observer || v.id === 'scouts') value += 8;
  if (c.vehicleSupport === 'command') value += 7;
  if (c.heal) value += 6;
  if (c.indirect) value += 5;
  if (c.members && ((c.armorMultiplier ?? 1) >= 1.5 || c.penetration)) value += 5;
  if (c.antiAir) value += 4;
  if (v.hp > 0 && v.hp < v.maxHp * 0.4) value += 3;
  return value;
}

/**
 * Designate a single enemy for the given infantry squad to focus fire on.
 * The designation is sticky (cached for FOCUS_TTL) so a squad keeps pouring
 * fire into one target instead of everyone picking a different nearest foe.
 * Returns undefined when no positively-valuable, visible target is in range.
 */
export function squadFocus(
  s: GameState,
  side: Side,
  squad: number,
  now: number,
): number | undefined {
  const key = `${side}:${squad}`;
  let cache = focusCache.get(s);
  if (!cache) {
    cache = new Map();
    focusCache.set(s, cache);
  }
  const cached = cache.get(key);
  if (cached && now - cached.at < FOCUS_TTL) {
    const target = s.units.find((u) => u.uid === cached.uid);
    if (
      target &&
      target.hp > 0 &&
      !target.surrendered &&
      !target.wounded &&
      !CARDS[target.id].air &&
      visibleToSide(s, side, target)
    ) {
      return cached.uid;
    }
  }

  // Squad centre from its living ground members, so the radius is measured
  // from where the squad actually is, not from a single soldier.
  const members = s.units.filter(
    (u) =>
      u.side === side &&
      u.squad === squad &&
      u.hp > 0 &&
      !u.surrendered &&
      !u.wounded &&
      !CARDS[u.id].air,
  );
  if (!members.length) {
    cache.delete(key);
    return undefined;
  }
  const center =
    members.reduce((sum, u) => sum + u.x, 0) / members.length;

  let best: Unit | undefined;
  let bestValue = 0;
  for (const v of s.units) {
    if (v.side === side) continue;
    if (v.hp <= 0 || v.surrendered || v.wounded) continue;
    if (CARDS[v.id].air) continue;
    if (Math.abs(v.x - center) > FOCUS_RADIUS) continue;
    if (!visibleToSide(s, side, v)) continue;
    const value = targetValue(v);
    if (value <= 0) continue;
    if (
      !best ||
      value > bestValue ||
      (value === bestValue &&
        (Math.abs(v.x - center) < Math.abs(best.x - center) ||
          (Math.abs(v.x - center) === Math.abs(best.x - center) &&
            v.uid < best.uid)))
    ) {
      best = v;
      bestValue = value;
    }
  }

  if (!best) {
    cache.delete(key);
    return undefined;
  }
  cache.set(key, { uid: best.uid, at: now });
  return best.uid;
}
