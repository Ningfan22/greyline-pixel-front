import { CARDS } from './cards';
import type { GameState, Unit } from './engine';
import { visibleToSide } from './world';

const marchPlans = new WeakMap<GameState, Map<number, { nextAt: number; goal: number }>>();

/** Rocket batteries follow the fighting line; they are not the line's scouts.
 * Only friendly positions and currently observed contacts set this march goal.
 * Range/visibility still decide whether a real rocket can be fired. */
export function rocketBatteryMarchGoal(s: GameState, battery: Unit, range: number): number | null {
  if (battery.id !== 'mlrs' && !CARDS[battery.id].selfPropelled) return null;
  // Keep a firing position through a reload or a brief loss of observation.
  if (s.time - (battery.lastCombatShotAt ?? -Infinity) < 8) return battery.x;
  let plans = marchPlans.get(s);
  if (!plans) marchPlans.set(s, plans = new Map());
  const previous = plans.get(battery.uid);
  if (previous && s.time < previous.nextAt)
    return Math.abs(previous.goal - battery.x) <= 12 ? battery.x : previous.goal;
  const dir = battery.side === 0 ? 1 : -1;
  let front: number | undefined;
  let safeLine: number | undefined;
  for (const u of s.units) {
    const c = CARDS[u.id];
    if (u === battery || u.hp <= 0 || u.wounded || u.surrendered || c.air ||
        u.parachuting || u.rappelling || u.glider) continue;
    if (u.side === battery.side) {
      if (c.static || c.indirect || c.vehicleSupport ||
          !(c.members || c.armored || c.vehicle) || (c.damage ?? 0) <= 0 ||
          u.tactic === 'retreat' || u.squadOrder === 'retreat' ||
          u.resupplyState === 'withdrawing') continue;
      if (front === undefined || u.x * dir > front * dir) front = u.x;
    } else if (visibleToSide(s, battery.side, u) && (u.x - battery.x) * dir >= 0) {
      const line = u.x - dir * Math.max((CARDS[battery.id].minRange ?? 0) + 120, range * .7);
      if (safeLine === undefined || line * dir < safeLine * dir) safeLine = line;
    }
  }
  // Unsupported batteries stay at the deployed position instead of driving
  // across the map to discover targets with their own short-range vision.
  let goal = front === undefined ? battery.x : front - dir * 300;
  if (safeLine !== undefined && goal * dir > safeLine * dir) goal = safeLine;
  // A screen near home is not an instruction to drive out of the map.
  const width = s.terrain.length;
  goal = Math.max(112, Math.min(width - 112, goal));
  // Rear-line assessment is staggered, not another full-army scan per frame.
  plans.set(battery.uid, { nextAt: s.time + .3 + battery.uid % 5 * .025, goal });
  // A narrow arrival band prevents alternating starts/stops behind a squad.
  return Math.abs(goal - battery.x) <= 12 ? battery.x : goal;
}
