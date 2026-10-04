import { CARDS } from './cards';
import { initializeAmmo, logisticsAlert, logisticsControllable } from './ammo-logistics';
import type { GameState } from './engine';

export { logisticsAlert, logisticsNeedsDecision } from './ammo-logistics';
export type LogisticsOrder = 'advance' | 'hold' | 'resupply';

/** A logistics decision addresses this unit, never its entire squad. */
export function issueLogisticsOrder(s: GameState, uid: number, order: LogisticsOrder): boolean {
  const u = s.units.find(unit => unit.uid === uid);
  if (!u || !logisticsControllable(u) || !logisticsAlert(u) ||
      !['advance', 'hold', 'resupply'].includes(order)) return false;
  if (order === 'advance' && CARDS[u.id].static) return false;
  initializeAmmo(u);
  u.logisticsWarning = true;
  u.logisticsOrder = order;
  u.resupplyState = order === 'resupply' ? 'withdrawing' : undefined;
  u.resupplyGoal = undefined;
  u.resupplyReturnX = order === 'resupply' ? u.x : undefined;
  u.squadOrder = order === 'hold' ? 'watch' : 'attack';
  u.squadOrderX = order === 'hold' ? u.x : undefined;
  u.squadOrderUntil = Infinity;
  u.tactic = 'advance';
  u.decisionIn = 0;
  u.escortTankUid = undefined; u.escortGoal = undefined;
  u.escortLane = undefined; u.escortHaltSince = undefined; u.escortAdvanceGoal = undefined;
  u.withdrawHeavyUid = undefined; u.withdrawStandby = false;
  u.withdrawGoal = undefined; u.withdrawUntil = 0; u.retreatUntil = 0;
  u.coverGoal = null; u.firingGoal = null; u.firingTransit = false;
  u.firingWatchAnchorX = undefined; u.mgBoundGoal = undefined;
  u.evadeGoal = null;
  u.vehicleReverseUntil = 0;
  if (order !== 'hold') {
    if (u.garrisonUid !== undefined) {
      u.garrisonDepartUid = u.garrisonUid;
      u.garrisonDepartDir = (u.side === 0 ? 1 : -1) * (order === 'resupply' ? -1 : 1);
    }
    u.garrisonUid = undefined;
    u.garrisonSlot = undefined;
  }
  u.holdLane = undefined; u.digging = false;
  u.ammoBuddyUid = undefined; u.scavengeWreckId = undefined; u.scavengeUntil = undefined;
  return true;
}
