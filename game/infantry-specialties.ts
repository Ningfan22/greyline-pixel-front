import type { GameState, Side, Unit } from './engine';
import { nearUnits } from './spatial';

export const AMBUSH_SETUP = 3;
export const AMBUSH_REVEAL = 8;
export const AMBUSH_FIRE_RANGE = 300;
export const GUIDE_RADIUS = 220;

function available(u: Unit) {
  return u.hp > 0 && !u.wounded && !u.surrendered && !u.moving &&
    u.motion === 'ground' && !u.rappelling && !u.parachuting && u.climbing <= 0 &&
    !u.tending && u.draggingUid === undefined && u.firstAidTargetUid === undefined &&
    u.tactic !== 'retreat' && u.squadOrder !== 'retreat';
}

export function canPrepareAmbush(u: Unit, time: number) {
  return u.id === 'ambush_squad' && available(u) &&
    ['prone', 'crouch', 'hunker'].includes(u.pose) && u.suppression < 40 &&
    u.fire <= 0 && u.secondaryFire <= 0 && (u.fragThrow ?? 0) <= 0 &&
    time >= (u.camouflageRevealedUntil ?? 0) &&
    time - (u.lastCombatShotAt ?? -Infinity) >= AMBUSH_REVEAL;
}

export function ambushConcealed(u: Unit, time: number) {
  return canPrepareAmbush(u, time) && (u.camouflageFor ?? 0) >= AMBUSH_SETUP;
}

export function pathfinderReady(s: GameState, u: Unit) {
  return u.id === 'pathfinders' && available(u) && (u.stillFor ?? 0) >= 2 &&
    u.suppression < 45 && s.players[u.side].jam <= 0 &&
    (s.players[u.side].blackoutUntil ?? 0) <= s.time;
}

const guideScratch: Unit[] = [];
export function landingGuide(s: GameState, side: Side, x: number) {
  let best: Unit | undefined;
  let distance = GUIDE_RADIUS + 1;
  for (const u of nearUnits(s, x, GUIDE_RADIUS, guideScratch)) {
    const d = Math.abs(u.x - x);
    if (u.side === side && d <= GUIDE_RADIUS && d < distance && pathfinderReady(s, u)) {
      best = u; distance = d;
    }
  }
  return best;
}
