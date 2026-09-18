import type { GameState, Side, Unit } from './engine';

/**
 * Spatial acceleration structures rebuilt once per tick.
 *
 * The battlefield is a 3840px-wide 2D side view; every combat query is
 * "units within X pixels of x" along a single axis. A uniform grid over x
 * turns those queries from O(N) full scans into O(cells touched), which is
 * what keeps 450-unit battles at 60fps.
 */

export const GRID_CELL = 256;
/**
 * Padding applied to every range query. No unit moves more than this many
 * pixels per tick (fastest air unit is ~260px/s, tick capped at 0.05s), so a
 * unit sitting just outside its cell cannot be missed.
 */
export const QUERY_PAD = 64;

export interface SpatialIndex {
  cells: Unit[][];
  width: number;
}

export function buildSpatial(units: Unit[], fieldWidth: number): SpatialIndex {
  const width = Math.max(1, Math.ceil(fieldWidth / GRID_CELL));
  const cells: Unit[][] = [];
  for (let i = 0; i < width; i++) cells.push([]);
  for (const u of units) {
    let idx = Math.floor(u.x / GRID_CELL);
    if (idx < 0) idx = 0;
    else if (idx >= width) idx = width - 1;
    cells[idx].push(u);
  }
  return { cells, width };
}

/**
 * Push every unit that *might* be within `range` of x into `out` (cleared
 * first) and return it. The grid is padded by QUERY_PAD, so callers still
 * need their own exact-distance check — this is a candidate filter, not a
 * precise query. Falls back to a full scan when no index exists (code paths
 * exercised outside a tick, e.g. unit tests).
 */
export function nearUnits(
  s: GameState,
  x: number,
  range: number,
  out: Unit[],
): Unit[] {
  out.length = 0;
  const spatial = s.spatial;
  if (!spatial) {
    for (const u of s.units) out.push(u);
    return out;
  }
  const lo = Math.floor((x - range - QUERY_PAD) / GRID_CELL);
  const hi = Math.floor((x + range + QUERY_PAD) / GRID_CELL);
  const from = Math.max(0, lo);
  const to = Math.min(spatial.width - 1, hi);
  for (let i = from; i <= to; i++) {
    const cell = spatial.cells[i];
    for (let j = 0; j < cell.length; j++) out.push(cell[j]);
  }
  return out;
}

export function buildByUid(units: Unit[]): Map<number, Unit> {
  const map = new Map<number, Unit>();
  for (const u of units) map.set(u.uid, u);
  return map;
}

/**
 * Look up a unit by uid. Falls back to a linear scan when the uid is absent
 * from the index, which covers units spawned mid-tick (airlift roping,
 * bailing vehicle crews) after the index was built. The index may also hold
 * units that died this tick, so callers must keep their hp/isCombatant checks.
 */
export function unitByUid(
  s: GameState,
  uid: number | undefined,
): Unit | undefined {
  if (uid === undefined) return undefined;
  const indexed = s.byUid?.get(uid);
  if (indexed) return indexed;
  return s.units.find((u) => u.uid === uid);
}

export function buildSquadIndex(units: Unit[]): Map<number, Unit[]> {
  const map = new Map<number, Unit[]>();
  for (const u of units) {
    const key = u.side * 1048576 + u.squad;
    let arr = map.get(key);
    if (!arr) {
      arr = [];
      map.set(key, arr);
    }
    arr.push(u);
  }
  return map;
}

/**
 * All units sharing a side and squad. The returned array is the live index
 * array (or a fresh array from the fallback path for squads spawned
 * mid-tick) — callers must treat it as read-only.
 */
export function squadMates(s: GameState, side: Side, squad: number): Unit[] {
  const key = side * 1048576 + squad;
  const indexed = s.squadIndex?.get(key);
  if (indexed) return indexed;
  return s.units.filter((v) => v.side === side && v.squad === squad);
}
