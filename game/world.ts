import { wreckObstacles } from './wreck-geometry';
import { CARDS } from './cards';
import type { GameState, Side, Unit } from './engine';
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
}
export interface Mine {
  uid: number;
  side: Side;
  x: number;
  armAt: number;
}
const floorAt = (s: GameState, x: number) =>
  s.terrain[Math.max(0, Math.min(s.terrain.length - 1, Math.floor(x)))];
export function createScenery(terrain: number[]): Scenery[] {
  return [
    620, 820, 1040, 1250, 1450, 1680, 1910, 2140, 2370, 2570, 2790, 3000, 3220,
  ].flatMap((x, i) => {
    const house = i % 3 === 0,
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
      const profile = HOUSE_PROFILES[Math.floor(i / 3) % 3];
      const width = profile.width * 0.9,
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
    const base: Scenery = {
      id: i * 2,
      kind: house ? 'house' : 'tree',
      x,
      y,
      parts,
      seed: 119 + i * 47,
      building: house ? Math.floor(i / 3) % 3 : undefined,
    };
    if (house) return [base];
    const xx = x + 72,
      yy = terrain[xx];
    return [
      base,
      {
        ...base,
        id: i * 2 + 1,
        x: xx,
        y: yy,
        seed: base.seed + 7,
        parts: parts.map((p) => ({ ...p, x: p.x + 72, y: p.y + yy - y })),
      },
    ];
  });
}
function segmentBox(
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  p: { x: number; y: number; w: number; h: number },
) {
  let near = 0,
    far = 1;
  for (const [start, delta, min, max] of [
    [sx, tx - sx, p.x, p.x + p.w],
    [sy, ty - sy, p.y, p.y + p.h],
  ]) {
    if (Math.abs(delta) < 0.0001) {
      if (start < min || start > max) return null;
    } else {
      const a = (min - start) / delta,
        b = (max - start) / delta;
      near = Math.max(near, Math.min(a, b));
      far = Math.min(far, Math.max(a, b));
    }
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
    traversals?: Obstacle[];
  }
>();
export function obstacleBoxes(s: GameState): Obstacle[] {
  const cached = geometryCache.get(s);
  if (
    cached &&
    cached.time === s.time &&
    cached.scenery === s.scenery &&
    cached.wreckCount === s.wrecks.length
  )
    return cached.boxes;
  const boxes: Obstacle[] = [];
  for (const prop of s.scenery) {
    if (prop.kind === 'house') {
      boxes.push(...buildingHull(prop, (x) => floorAt(s, x)));
      continue;
    }
    for (const part of prop.parts) {
      if (part.hp > 0)
        boxes.push({ ...part, prop, part, foliage: part.kind === 'crown' });
      else if (part.kind === 'wall')
        boxes.push({
          x: part.x,
          y: floorAt(s, part.x + part.w / 2) - 22,
          w: part.w,
          h: 22,
          prop,
          part,
          rubble: true,
        });
    }
    if (
      prop.kind === 'tree' &&
      prop.parts.find((p) => p.kind === 'trunk')?.hp === 0
    )
      boxes.push({
        x: prop.x - 12,
        y: floorAt(s, prop.x) - 20,
        w: 140,
        h: 20,
        prop,
        rubble: true,
      });
  }
  for (const wreck of s.wrecks)
    if (!wreck.falling && !CARDS[wreck.cardId].members) {
      for (const part of wreckObstacles(wreck))
        boxes.push({ ...part, wreck, rubble: true });
    }
  geometryCache.set(s, {
    time: s.time,
    scenery: s.scenery,
    wreckCount: s.wrecks.length,
    boxes,
  });
  return boxes;
}
/** A whole wreck is one traversal, even though bullets collide with separate solid pieces. */
export function traversalBoxes(s: GameState): Obstacle[] {
  const boxes = obstacleBoxes(s),
    cached = geometryCache.get(s)!;
  if (cached.traversals) return cached.traversals;
  const result = boxes.filter((b) => !b.wreck);
  for (const wreck of s.wrecks) {
    if (wreck.falling || CARDS[wreck.cardId].members) continue;
    const pieces = boxes.filter((b) => b.wreck === wreck);
    if (!pieces.length) continue;
    const left = Math.min(...pieces.map((p) => p.x)),
      top = Math.min(...pieces.map((p) => p.y));
    result.push({
      x: left,
      y: top,
      w: Math.max(...pieces.map((p) => p.x + p.w)) - left,
      h: wreck.y - top,
      wreck,
      rubble: true,
    });
  }
  cached.traversals = result;
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
) {
  let hit: { box: Obstacle; x: number; y: number; t: number } | null = null;
  for (const box of obstacleBoxes(s)) {
    if (ignoreProps && box.prop) continue;
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
  for (const box of obstacleBoxes(s)) {
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
  for (const b of obstacleBoxes(s)) {
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
  const steps = Math.ceil(Math.abs(tx - sx) / 12);
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    if (sy + (ty - sy) * t >= floorAt(s, sx + (tx - sx) * t) - 2) return false;
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
export function observationPenalty(
  s: GameState,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  range: number,
) {
  // One house/tree is one obstruction even when its ray crosses several parts.
  const obstacles = new Map<string, number>();
  for (const box of obstacleBoxes(s)) {
    if (segmentBox(sx, sy, tx, ty, box) === null) continue;
    const key = box.prop ? `prop:${box.prop.id}` : `wreck:${box.wreck!.id}`;
    const loss = box.rubble ? 8 : box.prop?.kind === 'house' ? 60 : 25;
    obstacles.set(key, Math.max(obstacles.get(key) ?? 0, loss));
  }
  for (const wall of s.walls) {
    if (wall.hp <= 0) continue;
    const box = {
      x: wall.x - 20,
      y: floorAt(s, wall.x) - wall.height,
      w: 40,
      h: wall.height,
    };
    if (segmentBox(sx, sy, tx, ty, box) !== null)
      obstacles.set(`wall:${wall.uid}`, 8);
  }
  return Math.min(
    range * 0.25,
    [...obstacles.values()].reduce((sum, loss) => sum + loss, 0),
  );
}
export function sightRange(u: Unit) {
  const c = CARDS[u.id];
  return (
    c.sight ??
    (c.observer
      ? 820
      : c.air
        ? 690
        : c.members
          ? Math.min(650, (c.range ?? 380) + 100)
          : c.armored
            ? 570
            : 440)
  );
}
export function pointVisible(s: GameState, side: Side, x: number, y: number) {
  if (Math.abs(x - (side === 0 ? 70 : 3770)) < 200 && y > floorAt(s, x) - 170)
    return true;
  return s.units.some((u) => {
    if (u.side !== side || u.hp <= 0 || u.wounded || u.surrendered)
      return false;
    const range = sightRange(u) * (s.players[side].recon > 0 ? 1.15 : 1);
    const distance = Math.hypot(u.x - x, (u.y - 45 - y) * 0.65);
    if (distance > range) return false;
    const eye = u.y - (CARDS[u.id].air ? 20 : u.pose === 'prone' ? 12 : 48);
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
          s.units.some(
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
export function visibleToSide(s: GameState, side: Side, u: Unit) {
  return u.side === side || s.visible[side].includes(u.uid);
}
export function refreshVision(s: GameState) {
  for (const side of [0, 1] as Side[]) {
    s.visible[side] = s.units
      .filter(
        (u) =>
          u.side === side ||
          pointVisible(s, side, u.x, u.y - (u.pose === 'prone' ? 8 : 28)),
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
