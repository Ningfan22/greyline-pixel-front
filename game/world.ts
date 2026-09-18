import { villageScenerySites, type MapScenerySite } from './maps';
import { wreckObstacles } from './wreck-geometry';
import { CARDS } from './cards';
import { treeBoxesV17 } from './tree-state-v17';
import { STRIDE, terrainMinima } from './terrain-ray';
import type { GameState, Side, Unit } from './engine';
import { weatherVisibility } from './weather';
export interface SceneryPart {
  id: number;
  x: number;
  y: number;
  w: number;
  h: number;
  hp: number;
  maxHp: number;
  kind: 'wall' | 'roof' | 'trunk' | 'crown';
  brokenAt: number;
}
export interface Scenery {
  id: number;
  kind: 'house' | 'tree';
  x: number;
  y: number;
  seed: number;
  parts: SceneryPart[];
  building?: number;
  damageAt?: number;
  fromStage?: number;
}
export const HOUSE_PROFILES = [
  { width: 176, height: 180, wallHeight: 121 },
  { width: 196, height: 188, wallHeight: 137 },
  { width: 220, height: 122, wallHeight: 80 },
] as const;
export function buildingType(p: Scenery) {
  return p.building ?? Math.floor(p.id / 6) % HOUSE_PROFILES.length;
}
export function buildingStage(p: Scenery) {
  const walls = p.parts.filter((part) => part.kind === 'wall');
  if (walls.length && walls.every((part) => part.hp <= 0)) return 3;
  const health = p.parts.reduce((n, part) => n + Math.max(0, part.hp), 0);
  const full = p.parts.reduce((n, part) => n + part.maxHp, 0);
  const broken = p.parts.filter((part) => part.hp <= 0).length;
  return health < full * 0.48 || broken > 0 ? 2 : health < full * 0.83 ? 1 : 0;
}
export interface Wreck {
  /** Preserve the casualty's final presentation; old serialized wrecks can omit these. */
  pose?: Unit['pose'];
  facing?: number;
  lane?: number;
  /** v83: fallen infantry keep their weapon's remaining ammo so living squadmates can loot it. */
  member?: number;
  ammo?: number;
  ammoReserve?: number;
  id: number;
  cardId: Unit['id'];
  side: Side;
  x: number;
  y: number;
  angle: number;
  age: number;
  falling: boolean;
  vx: number;
  vy: number;
  /**
   * v106: angular velocity (rad/s) for infantry thrown by a blast — the
   * ragdoll tumbles through the air on this spin, then settles on landing.
   */
  spin?: number;
  /**
   * v109: how the hulk died. Picks the authored wreck-state family:
   * blast kills tear the hull apart, bullet kills puncture and riddle it,
   * burns leave a gutted shell. Old serialized wrecks can omit this.
   */
  cause?: 'blast' | 'bullet' | 'burn';
}
export interface Mine {
  kind?: 'antipersonnel';
  uid: number;
  side: Side;
  x: number;
  armAt: number;
}
const floorAt = (s: GameState, x: number) =>
  s.terrain[Math.max(0, Math.min(s.terrain.length - 1, Math.floor(x)))];
export function createScenery(
  terrain: number[],
  sites: readonly MapScenerySite[] = villageScenerySites(terrain.length),
): Scenery[] {
  return sites.map((site, i) => {
    const x = Math.max(0, Math.min(terrain.length - 1, Math.round(site.x))),
      house = site.kind === 'house',
      building = house ? (site.building ?? Math.floor(i / 3) % 3) : undefined,
      y = terrain[x],
      parts: SceneryPart[] = [];
    const add = (
      kind: SceneryPart['kind'],
      dx: number,
      dy: number,
      w: number,
      h: number,
      hp: number,
    ) =>
      parts.push({
        id: parts.length,
        x: x + dx,
        y: y + dy,
        w,
        h,
        hp,
        maxHp: hp,
        kind,
        brokenAt: -1,
      });
    if (house) {
      const profile = HOUSE_PROFILES[building!],
        width = profile.width * 0.9,
        segment = width / 3;
      add(
        'wall',
        -width / 2,
        -profile.wallHeight,
        segment,
        profile.wallHeight,
        100,
      );
      add(
        'wall',
        -width / 2 + segment,
        -profile.wallHeight,
        segment,
        profile.wallHeight,
        110,
      );
      add(
        'wall',
        -width / 2 + segment * 2,
        -profile.wallHeight,
        segment,
        profile.wallHeight,
        100,
      );
      add(
        'roof',
        -profile.width / 2,
        -profile.height,
        profile.width,
        profile.height - profile.wallHeight + 2,
        85,
      );
    } else {
      add('trunk', -6, -85, 12, 85, 60);
      add('crown', -50, -136, 100, 98, 40);
    }
    return {
      id: site.id ?? i,
      kind: site.kind,
      x,
      y,
      parts,
      seed: site.seed,
      building,
    };
  });
}
export function segmentBox(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  p: { x: number; y: number; w: number; h: number },
) {
  // Scalar slab clipping avoids allocating/destructuring three arrays per ray/box.
  let near = 0,
    far = 1;
  const dx = tx - sx,
    dy = ty - sy;
  if (Math.abs(dx) < 0.0001) {
    if (sx < p.x || sx > p.x + p.w) return null;
  } else {
    const a = (p.x - sx) / dx,
      b = (p.x + p.w - sx) / dx;
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
  }
  if (Math.abs(dy) < 0.0001) {
    if (sy < p.y || sy > p.y + p.h) return null;
  } else {
    const a = (p.y - sy) / dy,
      b = (p.y + p.h - sy) / dy;
    near = Math.max(near, Math.min(a, b));
    far = Math.min(far, Math.max(a, b));
  }
  return near <= far && far > 0.015 && near <= 1 ? Math.max(0.01, near) : null;
}

export interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  prop?: Scenery;
  part?: SceneryPart;
  wreck?: Wreck;
  rubble?: boolean;
  foliage?: boolean;
}
/** Surviving structure after a partial collapse, matching the generated facade.
 * Once floors fail the remaining HP belongs to these connected masonry sections,
 * rather than to rectangular wall slices that no longer exist in the artwork. */
// Measured from the imported game-sized stage-2 sprites. Every rectangle is
// inside opaque generated structure; coordinates are relative to its ground anchor.
const PARTIAL_BUILDING_RECTS = [
  [
    [-80, -121, 80, 107],
    [-64, -150, 52, 31],
    [-70, -14, 158, 14],
  ],
  [
    [-90, -137, 90, 123],
    [-64, -168, 40, 33],
    [-78, -14, 176, 12],
  ],
  [
    [-101, -80, 101, 66],
    [-96, -102, 90, 24],
    [-88, -14, 196, 12],
  ],
] as const;
const SETTLED_BUILDING_RECTS = [
  [-79, -22, 149, 22],
  [-88, -22, 158, 22],
  [-99, -22, 181, 22],
] as const;
export function buildingHull(
  p: Scenery,
  groundAt: (x: number) => number,
): Obstacle[] {
  const stage = buildingStage(p),
    row = buildingType(p);
  if (stage < 2)
    return p.parts
      .filter((part) => part.hp > 0)
      .map((part) => ({ ...part, prop: p, part }));
  // The partial building is painted at its original foundation, including its
  // rubble. Only the completely settled ruin follows the current ground.
  const base = stage === 2 ? p.y : groundAt(p.x);
  const rects =
    stage === 2 ? PARTIAL_BUILDING_RECTS[row] : [SETTLED_BUILDING_RECTS[row]];
  return rects.map(([x, y, w, h], index) => ({
    x: p.x + x,
    y: base + y,
    w,
    h,
    prop: p,
    rubble: stage === 3 || index === 2,
  }));
}

const geometryCache = new WeakMap<
  GameState,
  {
    time: number;
    scenery: Scenery[];
    wreckCount: number;
    boxes: Obstacle[];
    hardBoxes: Obstacle[];
    traversals?: Obstacle[];
  }
>();
export function obstacleBoxes(s: GameState, ignoreProps = false): Obstacle[] {
  const cached = geometryCache.get(s);
  if (
    cached &&
    cached.time === s.time &&
    cached.scenery === s.scenery &&
    cached.wreckCount === s.wrecks.length
  )
    return ignoreProps ? cached.hardBoxes : cached.boxes;
  const boxes: Obstacle[] = [];
  for (const prop of s.scenery) {
    if (prop.kind === 'house') {
      boxes.push(...buildingHull(prop, (x) => floorAt(s, x)));
      continue;
    }
    if (
      prop.parts.some((p) => p.kind === 'trunk') &&
      prop.parts.some((p) => p.kind === 'crown')
    )
      boxes.push(...treeBoxesV17(prop, s.time, floorAt(s, prop.x)));
    else
      for (const part of prop.parts)
        if (part.hp > 0)
          boxes.push({ ...part, prop, part, foliage: part.kind === 'crown' });
  }
  for (const wreck of s.wrecks)
    if (!wreck.falling && !CARDS[wreck.cardId].members) {
      for (const part of wreckObstacles(wreck))
        boxes.push({ ...part, wreck, rubble: true });
    }
  const hardBoxes = boxes.filter((box) => !box.prop);
  geometryCache.set(s, {
    time: s.time,
    scenery: s.scenery,
    wreckCount: s.wrecks.length,
    boxes,
    hardBoxes,
  });
  return ignoreProps ? hardBoxes : boxes;
}
/** Props and wrecks occupy a depth lane, not the full walking corridor.
 * Their separate obstacleBoxes still stop bullets and provide cover.
 * Physical low walls live in GameState.walls and are vaulted explicitly.
 */
export function traversalBoxes(_s: GameState): Obstacle[] {
  return [];
}
const obstacleQueries = new WeakMap<
  Obstacle[],
  { bins: Map<number, number[]>; ranges: Map<string, Obstacle[]> }
>();
/** Broad phase only: preserve original obstacle order and all exact slab/cover tests. */
export function nearbyObstacles(
  s: GameState,
  left: number,
  right: number,
  ignoreProps = false,
) {
  const boxes = obstacleBoxes(s, ignoreProps);
  let index = obstacleQueries.get(boxes);
  if (!index) {
    index = { bins: new Map(), ranges: new Map() };
    boxes.forEach((box, i) => {
      for (
        let bin = Math.floor(box.x / 128);
        bin <= Math.floor((box.x + box.w) / 128);
        bin++
      ) {
        const list = index!.bins.get(bin);
        if (list) list.push(i);
        else index!.bins.set(bin, [i]);
      }
    });
    obstacleQueries.set(boxes, index);
  }
  const first = Math.floor(Math.min(left, right) / 128),
    last = Math.floor(Math.max(left, right) / 128),
    key = `${first}:${last}`;
  const known = index.ranges.get(key);
  if (known) return known;
  const candidates = new Set<number>();
  for (let bin = first; bin <= last; bin++)
    for (const i of index.bins.get(bin) ?? []) candidates.add(i);
  const result = [...candidates].sort((a, b) => a - b).map((i) => boxes[i]);
  index.ranges.set(key, result);
  return result;
}
export function sceneryIntercept(
  s: GameState,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  vision = false,
  includeOrigin = false,
  ignoreProps = false,
  ignoreRubble = false,
) {
  let hit: { box: Obstacle; x: number; y: number; t: number } | null = null;
  const left = Math.min(sx, tx),
    right = Math.max(sx, tx),
    top = Math.min(sy, ty),
    bottom = Math.max(sy, ty);
  for (const box of nearbyObstacles(s, left, right, ignoreProps)) {
    // Indirect fire ignores debris, while surviving walls and trunks stay solid.
    if (ignoreRubble && (box.rubble || box.wreck)) continue;
    if (
      box.x > right ||
      box.x + box.w < left ||
      box.y > bottom ||
      box.y + box.h < top
    )
      continue;
    if (!vision && box.foliage) continue;
    // A soldier sheltering inside a footprint can shoot out above/along its edge.
    if (
      !includeOrigin &&
      sx >= box.x &&
      sx <= box.x + box.w &&
      sy >= box.y &&
      sy <= box.y + box.h
    )
      continue;
    const t = segmentBox(sx, sy, tx, ty, box);
    if (t !== null && (!hit || t < hit.t))
      hit = { box, x: sx + (tx - sx) * t, y: sy + (ty - sy) * t, t };
  }
  return hit;
}
export function sceneryCoverHits(
  s: GameState,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
) {
  const hits = new Map<
    number,
    { id: number; x: number; y: number; t: number }
  >();
  for (const box of nearbyObstacles(s, sx, tx)) {
    if (!box.prop) continue;
    const t = segmentBox(sx, sy, tx, ty, box);
    if (t !== null && t < (hits.get(box.prop.id)?.t ?? Infinity))
      hits.set(box.prop.id, {
        id: box.prop.id,
        x: sx + (tx - sx) * t,
        y: sy + (ty - sy) * t,
        t,
      });
  }
  return [...hits.values()].sort((a, b) => a.t - b.t);
}
export function debrisCover(s: GameState, x: number, threatX: number) {
  const y = floorAt(s, x),
    dir = Math.sign(threatX - x) || 1;
  let cover = 0;
  for (const b of nearbyObstacles(s, x - 48, x + 48)) {
    if (b.foliage) continue;
    const edge = dir > 0 ? b.x : b.x + b.w,
      d = (edge - x) * dir;
    if (d < -b.w || d > 48 || Math.abs(threatX - x) < Math.max(0, d)) continue;
    const height = y - b.y;
    if (height > 8)
      cover = Math.max(
        cover,
        Math.min(0.9, height / 44) * (1 - Math.max(0, d) / 85),
      );
  }
  return cover;
}
export function clearSight(
  s: GameState,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  throughSmoke = false,
) {
  const dx = tx - sx,
    dy = ty - sy,
    steps = Math.ceil(Math.abs(dx) / 12);
  // Same 12px samples as before, but walked in blocks of 32: a block whose
  // ray stays strictly below the terrain minimum (minus the same 2px margin)
  // can be skipped wholesale. On flat ground every block skips, turning an
  // O(distance) march into O(distance / 2048) bin lookups.
  if (steps > 1) {
    const minima = terrainMinima(s),
      maxX = s.terrain.length - 1,
      binCount = minima.length;
    for (let i = 1; i < steps; ) {
      const end = Math.min(steps - 1, i + 31);
      const x0 = sx + (dx * i) / steps,
        x1 = sx + (dx * end) / steps;
      const lo = Math.floor(
          (Math.max(0, Math.min(maxX, Math.min(x0, x1)))) / STRIDE,
        ),
        hi = Math.floor(
          (Math.max(0, Math.min(maxX, Math.max(x0, x1)))) / STRIDE,
        );
      let minimum = Infinity;
      for (let b = lo; b <= hi && b < binCount; b++)
        if (minima[b] < minimum) minimum = minima[b];
      if (
        Math.max(sy + (dy * i) / steps, sy + (dy * end) / steps) <
        minimum - 2
      ) {
        i = end + 1;
        continue;
      }
      for (; i <= end; i++) {
        const t = i / steps;
        if (sy + dy * t >= floorAt(s, sx + dx * t) - 2) return false;
      }
    }
  }
  if (
    !throughSmoke &&
    s.smokes.some(
      (f) =>
        f.life > 0 &&
        f.x + 95 > Math.min(sx, tx) &&
        f.x - 95 < Math.max(sx, tx),
    ) &&
    Math.abs(tx - sx) > 140
  )
    return false;
  return true;
}
// Scratch storage for observationPenalty's per-obstruction max-loss dedup.
// Prop keys are positive (id + 1), wreck keys negative (-(id + 1)), so the two
// namespaces never collide.
const penaltyKeys: number[] = [];
const penaltyLoss: number[] = [];
function penaltyAdd(key: number, loss: number) {
  for (let i = 0; i < penaltyKeys.length; i++)
    if (penaltyKeys[i] === key) {
      if (loss > penaltyLoss[i]) penaltyLoss[i] = loss;
      return;
    }
  penaltyKeys.push(key);
  penaltyLoss.push(loss);
}
export function observationPenalty(
  s: GameState,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  range: number,
) {
  // One house/tree is one obstruction even when its ray crosses several parts.
  // Scratch dedup: this runs thousands of times per vision refresh, so reuse
  // module-level arrays instead of allocating a Map with string keys per call.
  // Not reentrant — it is only invoked synchronously from pointVisible.
  penaltyKeys.length = 0;
  penaltyLoss.length = 0;
  for (const box of nearbyObstacles(s, sx, tx)) {
    if (segmentBox(sx, sy, tx, ty, box) === null) continue;
    const key = box.prop ? box.prop.id + 1 : -(box.wreck!.id + 1);
    const loss = box.rubble ? 8 : box.prop?.kind === 'house' ? 60 : 25;
    penaltyAdd(key, loss);
  }
  let sum = 0;
  for (let i = 0; i < penaltyKeys.length; i++) sum += penaltyLoss[i];
  for (const wall of s.walls) {
    if (wall.hp <= 0) continue;
    const box = {
      x: wall.x - 20,
      y: floorAt(s, wall.x) - wall.height,
      w: 40,
      h: wall.height,
    };
    if (segmentBox(sx, sy, tx, ty, box) !== null) sum += 8;
  }
  return Math.min(range * 0.25, sum);
}
export function sightRange(u: Unit) {
  const c = CARDS[u.id];
  return (
    (c.sight ??
      (c.observer
        ? 820
        : c.air
          ? 690
          : c.members
            ? Math.min(650, (c.range ?? 380) + 100)
            : c.armored
              ? 570
              : 440)) *
    (u.squadOrder === 'watch' && !u.moving && c.members ? 1.15 : 1)
  );
}
const observers = new WeakMap<
  GameState,
  { units: Unit[]; length: number; sides: [Unit[], Unit[]] }
>();
export function observerUnits(s: GameState, side: Side) {
  let index = observers.get(s);
  if (!index || index.units !== s.units || index.length !== s.units.length) {
    index = { units: s.units, length: s.units.length, sides: [[], []] };
    for (const u of s.units)
      if (CARDS[u.id].observer) index.sides[u.side].push(u);
    observers.set(s, index);
  }
  return index.sides[side];
}
export function pointVisibleWith(
  s: GameState,
  side: Side,
  x: number,
  y: number,
  candidates?: Unit[],
) {
  if (Math.abs(x - (side === 0 ? 70 : 3770)) < 200 && y > floorAt(s, x) - 170)
    return true;
  if (
    s.flares.some(
      (f) =>
        f.life > 0 && Math.hypot(f.x - x, (f.y - y) * 0.65) <= 260,
    )
  )
    return true;
  const pool = candidates ?? s.units;
  return pool.some((u) => {
    if (u.side !== side || u.hp <= 0 || u.wounded || u.surrendered)
      return false;
    const range =
      sightRange(u) *
      (s.players[side].recon > 0 ? 1.15 : 1) *
      ((s.players[side].sensorBlindUntil ?? 0) > s.time ? 0.45 : 1) *
      (s.night ? 0.45 : 1) *
      weatherVisibility(s);
    const distance = Math.hypot(u.x - x, (u.y - 45 - y) * 0.65);
    if (distance > range) return false;
    const eye =
      u.y -
      (CARDS[u.id].air
        ? 20
        : u.pose === 'prone'
          ? 12
          : u.pose === 'hunker'
            ? 20
            : 48);
    if (distance > range - observationPenalty(s, u.x, eye, x, y, range))
      return false;
    return clearSight(
      s,
      u.x,
      eye,
      x,
      y,
      s.players[side].recon > 0 ||
        (s.players[side].jam <= 0 &&
          observerUnits(s, side).some(
            (v) =>
              v.side === side &&
              v.hp > 0 &&
              !v.wounded &&
              !v.surrendered &&
              CARDS[v.id].observer &&
              Math.abs(v.x - u.x) <= 650,
          )),
    );
  });
}
export function pointVisible(s: GameState, side: Side, x: number, y: number) {
  return pointVisibleWith(s, side, x, y);
}
const visibleLookup = new WeakMap<
  number[],
  { length: number; ids: Set<number> }
>();
export function visibleToSide(s: GameState, side: Side, u: Unit) {
  if (u.side === side) return true;
  const ids = s.visible[side];
  let lookup = visibleLookup.get(ids);
  if (!lookup || lookup.length !== ids.length) {
    lookup = { length: ids.length, ids: new Set(ids) };
    visibleLookup.set(ids, lookup);
  }
  return lookup.ids.has(u.uid);
}
export function refreshVision(s: GameState) {
  for (const side of [0, 1] as Side[]) {
    s.visible[side] = s.units
      .filter(
        (u) =>
          u.side === side ||
          pointVisible(
            s,
            side,
            u.x,
            u.y - (u.pose === 'prone' ? 8 : u.pose === 'hunker' ? 16 : 28),
          ) ||
          // Night: a muzzle flash betrays the shooter to anyone nearby.
          (s.night &&
            (u.flashUntil ?? 0) > s.time &&
            s.units.some(
              (v) =>
                v.side === side &&
                v.hp > 0 &&
                !v.wounded &&
                !v.surrendered &&
                Math.abs(v.x - u.x) <= 560,
            )),
      )
      .map((u) => u.uid);
    for (let bin = 0; bin < 60; bin++) {
      const x = bin * 64 + 32,
        seen = pointVisible(s, side, x, floorAt(s, x) - 35);
      s.sight[side][bin] = seen;
      if (seen)
        for (let j = bin * 64; j < Math.min(3840, (bin + 1) * 64); j++)
          s.knownTerrain[side][j] = s.terrain[j];
    }
    for (const w of s.walls)
      if (pointVisible(s, side, w.x, floorAt(s, w.x) - w.height - 1))
        s.knownWalls[side][w.uid] = { ...w };
    for (const prop of s.scenery)
      if (
        prop.parts.some(
          (p) =>
            pointVisible(s, side, p.x - 1, p.y + p.h / 2) ||
            pointVisible(s, side, p.x + p.w + 1, p.y + p.h / 2),
        ) ||
        pointVisible(s, side, prop.x, prop.y - 12)
      )
        s.knownScenery[side][prop.id] = structuredClone(prop);
  }
}
export function damageScenery(
  s: GameState,
  x: number,
  y: number,
  radius: number,
  damage: number,
) {
  geometryCache.delete(s);
  const stages = new Map(
    s.scenery
      .filter((p) => p.kind === 'house')
      .map((p) => [p.id, buildingStage(p)]),
  );
  for (const prop of s.scenery) {
    if (prop.kind === 'house' && buildingStage(prop) >= 2) {
      if (buildingStage(prop) === 3) continue;
      const distance = Math.min(
        ...buildingHull(prop, (at) => floorAt(s, at)).map((box) =>
          Math.hypot(
            Math.max(box.x - x, 0, x - box.x - box.w),
            Math.max(box.y - y, 0, y - box.y - box.h),
          ),
        ),
      );
      if (distance > radius) continue;
      const health = prop.parts.reduce(
        (n, part) => n + Math.max(0, part.hp),
        0,
      );
      const hit = damage * Math.max(0.15, 1 - distance / (radius + 1));
      const fraction = Math.max(0, 1 - hit / Math.max(0.001, health));
      for (const part of prop.parts)
        if (part.hp > 0) {
          part.hp = fraction < 0.00001 ? 0 : part.hp * fraction;
          if (!part.hp) part.brokenAt = s.time;
        }
      continue;
    }
    for (const p of prop.parts) {
      if (p.hp <= 0) continue;
      const distance = Math.hypot(
        Math.max(p.x - x, 0, x - p.x - p.w),
        Math.max(p.y - y, 0, y - p.y - p.h),
      );
      if (distance > radius) continue;
      p.hp = Math.max(
        0,
        p.hp - damage * Math.max(0.15, 1 - distance / (radius + 1)),
      );
      if (!p.hp) p.brokenAt = s.time;
    }
  }
  for (const prop of s.scenery) {
    const support = prop.parts.filter(
      (p) => p.kind === 'wall' || p.kind === 'trunk',
    );
    if (support.every((p) => p.hp <= 0))
      for (const p of prop.parts)
        if (p.hp > 0) {
          p.hp = 0;
          p.brokenAt = s.time;
        }
  }
  for (const prop of s.scenery) {
    if (prop.kind !== 'house') continue;
    const previous = stages.get(prop.id) ?? 0;
    if (buildingStage(prop) > previous) {
      prop.damageAt = s.time;
      prop.fromStage = previous;
    }
  }
}
