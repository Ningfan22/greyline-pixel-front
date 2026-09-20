import type { Unit } from './engine';
import { CARDS, weaponCard, weaponModel, type CardId } from './cards';

export function isBattleTank(id: CardId): boolean {
  return id === 'tank' || id === 'light_tank' || id === 'heavy_tank';
}

/** Count only the already-observed, in-range infantry supplied by targeting.
 * A sorted sliding window avoids an all-pairs scan for every heavy tank.
 * This is a formation preference, not a guarantee of damage through cover. */
export type InfantryConcentration = { count: number; spread: number };
export function infantryConcentrations(candidates: readonly Unit[]): Map<number, InfantryConcentration> {
  const foot = candidates.filter(v => CARDS[v.id].members).sort((a,b) => a.x-b.x);
  const counts = new Map<number, InfantryConcentration>();
  const sums = [0];
  for (const v of foot) sums.push(sums[sums.length-1]+v.x);
  let left = 0, right = 0;
  for (const [i,v] of foot.entries()) {
    while (left < foot.length && foot[left].x < v.x-32) left++;
    while (right < foot.length && foot[right].x <= v.x+32) right++;
    const spread = (v.x*(i-left)-(sums[i]-sums[left])+
      sums[right]-sums[i] - v.x*(right-i))/(right-left);
    counts.set(v.uid, { count: right-left, spread });
  }
  return counts;
}

/** Main-gun doctrine, after the ordinary visibility/range filters. Coaxial
 * weapons retain their independent targets. Lower score is preferred. */
export function tankTargetPriority(
  tank: Unit, target: Unit, concentrations?: ReadonlyMap<number, InfantryConcentration>,
): number {
  const c = CARDS[target.id], distance = Math.abs(target.x-tank.x);
  if (tank.id === 'tank') return c.armored ? 0 : 1;
  // Do not chase a preferred soft target while armor is on top of us.
  if (c.armored && distance <= 220) return 0;
  if (tank.id === 'light_tank') {
    const weapon = weaponCard(target);
    if (c.emplacement === 'at_gun' ||
        (c.members && weaponModel(target) === 'rocket' && !weapon.airOnly)) return 1;
    if ((c.armored || c.vehicle) && (!c.armored || (c.hp ?? 0) <= 430)) return 2;
    if (c.members && ['machinegun','mortar'].includes(weaponModel(target))) return 3;
    if (c.members || c.emplacement) return 4;
    return c.armored ? 5 : 6;
  }
  const group = concentrations?.get(target.uid), count = group?.count ?? 0;
  if (c.emplacement) return 1;
  if (count >= 3) return 2 - Math.min(8,count)*.05 + (group?.spread ?? 0)*.001;
  if (c.armored) return 3;
  if (c.members) return 4 - Math.min(2,count)*.05;
  return 5;
}

/** Receives only the AI's visible opponents; hidden inventory is not intel. */
export function tankPurchaseBonus(id: CardId, known: readonly Unit[]): number {
  if (!isBattleTank(id)) return 0;
  const heavyArmor = known.some(v => CARDS[v.id].armored && (CARDS[v.id].hp ?? 0)>430);
  if (id === 'tank') return heavyArmor ? 10 : 0;
  if (heavyArmor) return 0;
  if (id === 'light_tank') return known.some(v => {
    const c = CARDS[v.id], w = weaponCard(v);
    return (c.members && weaponModel(v) === 'rocket' && !w.airOnly) ||
      ((c.vehicle || c.armored) && (c.hp ?? 0)<=430);
  }) ? 10 : 0;
  return known.some(v => CARDS[v.id].emplacement) ||
    [...infantryConcentrations(known).values()].some(group => group.count>=3) ? 10 : 0;
}
