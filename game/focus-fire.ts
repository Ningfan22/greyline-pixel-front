import { CARDS } from './cards';
import { visibleToSide } from './world';
import { nearUnits, unitByUid, squadMates } from './spatial';
import type { GameState, Side, Unit } from './engine';

/** A squad re-picks its priority target at most this often, so fire stays concentrated. */
const FOCUS_TTL = 0.6;
/** Only targets within this radius of the squad centre can be designated. */
const FOCUS_RADIUS = 720;
/** Squads with fewer combat-effective members than this keep all rifles on the focus target. */
const SUPPRESSION_MIN_SQUAD = 4;
/** Reused across calls — the near-units query only ever needs a temporary list. */
const focusNearScratch: Unit[] = [];

/** Per-game cache: `${side}:${squad}` -> the designated target uid and when it was chosen. */
const focusCache = new WeakMap<
  GameState,
  Map<string, { uid: number | undefined; at: number; tick: number }>
>();

/** Per-game cache for the support team's secondary suppression target. */
const suppCache = new WeakMap<
  GameState,
  Map<
    string,
    {
      uid: number | undefined;
      at: number;
      tick: number;
      focusUid: number | undefined;
    }
  >
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
  if (cached) {
    // Every living infantry member calls this once per tick with identical
    // inputs; the first call's result holds for the whole tick (v100).
    if (cached.tick === s.time) return cached.uid;
    if (cached.uid !== undefined && now - cached.at < FOCUS_TTL) {
      const target = unitByUid(s, cached.uid);
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
  }

  // Squad centre from its living ground members, so the radius is measured
  // from where the squad actually is, not from a single soldier. The squad
  // index already narrows this to side+squad; just filter out the dead.
  const mates = squadMates(s, side, squad);
  let centerSum = 0;
  let centerCount = 0;
  for (let i = 0; i < mates.length; i++) {
    const u = mates[i];
    if (
      u.hp > 0 &&
      !u.surrendered &&
      !u.wounded &&
      !CARDS[u.id].air
    ) {
      centerSum += u.x;
      centerCount++;
    }
  }
  if (!centerCount) {
    cache.set(key, { uid: undefined, at: now, tick: s.time });
    return undefined;
  }
  const center = centerSum / centerCount;

  let best: Unit | undefined;
  let bestValue = 0;
  for (const v of nearUnits(s, center, FOCUS_RADIUS, focusNearScratch)) {
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
    cache.set(key, { uid: undefined, at: now, tick: s.time });
    return undefined;
  }
  cache.set(key, { uid: best.uid, at: now, tick: s.time });
  return best.uid;
}

/**
 * Designate a secondary enemy for the squad's support team to suppress while
 * the rest of the squad pours fire into the focus target. Real infantry
 * squads split into a fire team (concentrating on the priority threat) and a
 * support team (keeping the rest of the enemy line's heads down); this makes
 * the tracer fan-out cross the whole enemy line instead of every rifle
 * pointing at one man.
 *
 * Returns undefined when the squad is too depleted to split, when the focus
 * target is unknown, or when no other visible enemy is in range — callers
 * fall back to the focus target in that case.
 */
export function squadSuppressionTarget(
  s: GameState,
  side: Side,
  squad: number,
  focusUid: number | undefined,
  now: number,
): number | undefined {
  if (focusUid === undefined) return undefined;
  const key = `${side}:${squad}`;
  let cache = suppCache.get(s);
  if (!cache) {
    cache = new Map();
    suppCache.set(s, cache);
  }
  const cached = cache.get(key);
  if (cached) {
    // Same per-tick memo as squadFocus; focusUid is itself memoized per tick,
    // so it is constant across a squad's calls within one tick (v100).
    if (cached.tick === s.time && cached.focusUid === focusUid)
      return cached.uid;
    if (
      cached.uid !== undefined &&
      cached.focusUid === focusUid &&
      now - cached.at < FOCUS_TTL
    ) {
      const target = unitByUid(s, cached.uid);
      if (
        target &&
        target.hp > 0 &&
        !target.surrendered &&
        !target.wounded &&
        !CARDS[target.id].air &&
        target.uid !== focusUid &&
        visibleToSide(s, side, target)
      ) {
        return cached.uid;
      }
    }
  }

  // Squad centre from living ground members, same as squadFocus, and bail if
  // the squad is too depleted to spare a support team.
  const mates = squadMates(s, side, squad);
  let centerSum = 0;
  let centerCount = 0;
  for (let i = 0; i < mates.length; i++) {
    const u = mates[i];
    if (
      u.hp > 0 &&
      !u.surrendered &&
      !u.wounded &&
      !CARDS[u.id].air
    ) {
      centerSum += u.x;
      centerCount++;
    }
  }
  if (centerCount < SUPPRESSION_MIN_SQUAD) {
    cache.set(key, { uid: undefined, at: now, tick: s.time, focusUid });
    return undefined;
  }
  const center = centerSum / centerCount;

  let best: Unit | undefined;
  for (const v of nearUnits(s, center, FOCUS_RADIUS, focusNearScratch)) {
    if (v.side === side) continue;
    if (v.uid === focusUid) continue;
    if (v.hp <= 0 || v.surrendered || v.wounded) continue;
    if (CARDS[v.id].air) continue;
    if (Math.abs(v.x - center) > FOCUS_RADIUS) continue;
    if (!visibleToSide(s, side, v)) continue;
    if (
      !best ||
      Math.abs(v.x - center) < Math.abs(best.x - center) ||
      (Math.abs(v.x - center) === Math.abs(best.x - center) &&
        v.uid < best.uid)
    ) {
      best = v;
    }
  }

  if (!best) {
    cache.set(key, { uid: undefined, at: now, tick: s.time, focusUid });
    return undefined;
  }
  cache.set(key, { uid: best.uid, at: now, tick: s.time, focusUid });
  return best.uid;
}
