import { CARDS } from './cards';
import type { Unit } from './engine';

export interface ArtilleryAim {
  key: string;
  x: number;
  y: number;
  originX: number;
  seenAt: number;
  readyAt: number;
}

/** Observation and ranging overlap loading, but a new target or gun position
 * needs a fresh solution. Ordinary corrections do not restart every shell. */
export function artilleryAimReady(u: Unit, time: number, key: string, x: number, y: number) {
  const c = CARDS[u.id];
  if (!c.indirect || c.air) return true;
  const old = u.artilleryAim;
  if (!old || old.key !== key || time - old.seenAt > .75 ||
      Math.abs(old.originX - u.x) > 6 || Math.hypot(old.x - x, old.y - y) > 80) {
    const delay = c.emplacement === 'howitzer' ? (c.radius ?? 0) >= 50 ? 3.2 : 2.4
      : u.id === 'mlrs' ? 2.4 : 1.4;
    u.artilleryAim = { key, x, y, originX: u.x, seenAt: time, readyAt: time + delay };
  } else old.seenAt = time;
  return time >= u.artilleryAim!.readyAt;
}
