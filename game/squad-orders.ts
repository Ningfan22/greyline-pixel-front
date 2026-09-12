import { CARDS } from './cards';
import { infantryDepth } from './render-depth';
import type { GameState, Side, Unit } from './engine';

export type SquadOrder = 'hold' | 'retreat' | 'attack' | 'watch';
export interface Entrenchment {
  squad: number;
  side: Side;
  x: number;
  radius: number;
  innerRadius: number;
  floorY: number;
  progress: number;
  built: boolean;
  minesLaid: boolean;
  workRows?: number;
  workStartedAt?: number;
}
export const SQUAD_ORDERS: {
  id: SquadOrder;
  label: string;
  description: string;
}[] = [
  {
    id: 'hold',
    label: '据守',
    description: '全队共挖战壕，完成后布置两枚防步兵雷',
  },
  { id: 'retreat', label: '撤退', description: '交替掩护后撤，到达后转为警戒' },
  {
    id: 'attack',
    label: '进攻',
    description: '向前推进，接敌后自主分散与利用掩体',
  },
  { id: 'watch', label: '警戒', description: '原地观察还击，视野更远，不追击' },
];
export const TRENCH_DEPTH = 36;
export const MAX_TRENCH_DEPTH = 48;
const living = (u: Unit) =>
  u.hp > 0 && !u.wounded && !u.surrendered && !u.rappelling;
const floorAt = (s: GameState, x: number) =>
  s.terrain[Math.max(0, Math.min(s.terrain.length - 1, Math.round(x)))];

export function setSquadOrder(
  s: GameState,
  side: Side,
  squad: number,
  order: SquadOrder,
) {
  if (s.status !== 'playing') return { ok: false, message: '请先继续作战' };
  if (!SQUAD_ORDERS.some((v) => v.id === order))
    return { ok: false, message: '无效的小队指令' };
  const members = s.units.filter(
    (u) =>
      u.side === side && u.squad === squad && CARDS[u.id].members && living(u),
  );
  if (!members.length) return { ok: false, message: '这支小队已无法接令' };
  const x = members.reduce((n, u) => n + u.x, 0) / members.length;
  const repeated = members.every((u) => u.squadOrder === order);
  if (repeated)
    return {
      ok: true,
      message: `小队正在${SQUAD_ORDERS.find((v) => v.id === order)!.label}`,
    };
  let trench = (s.entrenchments ?? []).find(
    (v) => v.squad === squad && v.side === side,
  );
  if (order === 'hold' && !trench) {
    s.entrenchments ??= [];
    const span =
      Math.max(...members.map((u) => u.x)) -
      Math.min(...members.map((u) => u.x));
    const oldInnerRadius = Math.min(165, Math.max(36, span / 2 + 14));
    const radius = Math.max(43.5, (oldInnerRadius + 96) / 4);
    const innerRadius = radius - 25;
    const center = Math.max(
      126 + radius,
      Math.min(s.terrain.length - 127 - radius, x),
    );
    const samples = Array.from(
      { length: 9 },
      (_, i) =>
        s.original[
          Math.round(center - innerRadius + (innerRadius * 2 * i) / 8)
        ],
    );
    trench = {
      squad,
      side,
      x: center,
      radius,
      innerRadius,
      floorY:
        samples.reduce((a, b) => a + b, 0) / samples.length + TRENCH_DEPTH,
      progress: 0,
      built: false,
      minesLaid: false,
    };
    s.entrenchments.push(trench);
  }
  // Preserve left-to-right ordering while packing six members into three columns,
  // two physical depth lanes. Moving into these slots always goes through engine movement.
  const ordered = [...members].sort((a, b) => a.x - b.x || a.uid - b.uid);
  const rows = members.length <= 3 ? 1 : Math.ceil(members.length / 3);
  const columns = Math.ceil(members.length / rows);
  const halfSpan = trench
    ? Math.min((columns - 1) * 11, trench.innerRadius - 2)
    : 0;
  if (order === 'hold' && trench) {
    trench.workRows = rows;
    trench.workStartedAt ??= s.time;
  }
  for (let i = 0; i < ordered.length; i++) {
    const u = ordered[i];
    u.squadOrder = order;
    u.squadOrderX =
      order === 'retreat'
        ? Math.max(
            100,
            Math.min(s.terrain.length - 100, u.x + (side === 0 ? -240 : 240)),
          )
        : order === 'hold' && trench
          ? trench.x +
            (columns === 1
              ? 0
              : -halfSpan +
                (Math.floor(i / rows) * halfSpan * 2) / (columns - 1))
          : u.x;
    u.holdLane =
      order === 'hold'
        ? rows === 1
          ? 0
          : -20 + ((i % rows) * 40) / (rows - 1)
        : undefined;
    u.digging = false;
    u.digElapsed ??= 0;
    u.squadOrderUntil = Infinity;
    u.coverGoal = null;
    u.decisionIn = 0;
    u.firingGoal = null;
    if (order !== 'retreat') u.withdrawUntil = 0;
  }
  return {
    ok: true,
    message: `${CARDS[members[0].id].name}：${SQUAD_ORDERS.find((v) => v.id === order)!.label}`,
  };
}

/** Construction requires nearby, grounded troops; repeated orders never create more mines. */
export function updateSquadOrders(s: GameState, dt: number) {
  for (const u of s.units) {
    if (
      u.squadOrder === 'retreat' &&
      u.squadOrderX !== undefined &&
      living(u) &&
      Math.abs(u.x - u.squadOrderX) <= 12
    ) {
      u.squadOrder = 'watch';
      u.withdrawUntil = 0;
      u.decisionIn = 0;
    }
  }
  for (const trench of s.entrenchments ?? []) {
    if (trench.built) continue;
    const workers = s.units.filter(
      (u) =>
        u.squad === trench.squad &&
        u.side === trench.side &&
        living(u) &&
        u.squadOrder === 'hold' &&
        u.digging &&
        u.squadOrderX !== undefined &&
        Math.abs(u.x - u.squadOrderX) <= 1 &&
        Math.abs(u.lane - (u.holdLane ?? u.lane)) <= 0.5 &&
        u.fire <= 0 &&
        u.secondaryFire <= 0 &&
        !u.moving &&
        !u.climbing &&
        u.motion === 'ground' &&
        u.suppression < 35 &&
        Math.abs(u.x - trench.x) <= trench.radius + 20,
    );
    for (const u of s.units)
      if (
        u.squad === trench.squad &&
        u.side === trench.side &&
        u.digging &&
        !workers.includes(u)
      )
        u.digging = false;
    if (!workers.length) continue;
    for (const u of workers) u.digElapsed = (u.digElapsed ?? 0) + dt;
    trench.progress = Math.min(
      1,
      trench.progress + (dt / 6) * Math.min(1, workers.length / 2),
    );
    // One continuous chamber for the whole squad, with eased earth banks at both ends.
    for (
      let x = Math.max(126, Math.ceil(trench.x - trench.radius));
      x <= Math.min(s.terrain.length - 127, trench.x + trench.radius);
      x++
    ) {
      const cut = trenchCutDepth(s, trench, x);
      s.terrain[x] = Math.max(
        s.terrain[x],
        s.original[x] + cut * trench.progress,
      );
    }
    for (const u of s.units)
      if (
        living(u) &&
        u.motion === 'ground' &&
        !u.climbing &&
        Math.abs(u.x - trench.x) <= trench.radius
      )
        u.y = floorAt(s, u.x);
    s.visionIn = 0;
    if (trench.progress < 1) continue;
    trench.built = true;
    if (trench.minesLaid) continue;
    trench.minesLaid = true;
    const dir = trench.side === 0 ? 1 : -1;
    for (const offset of [45, 95]) {
      const x = trench.x + dir * (trench.radius + offset);
      if (
        x < 150 ||
        x > s.terrain.length - 150 ||
        s.mines.filter(
          (m) => m.side === trench.side && m.kind === 'antipersonnel',
        ).length >= 10 ||
        s.mines.some((m) => Math.abs(m.x - x) < 24) ||
        s.units.some(
          (u) => u.side !== trench.side && u.hp > 0 && Math.abs(u.x - x) < 80,
        )
      )
        continue;
      s.mines.push({
        uid: ++s.uid,
        side: trench.side,
        x,
        armAt: s.time + 2.5,
        kind: 'antipersonnel',
      });
    }
  }
}

/** Smoothstep has zero slope at the shared floor and the outer ground, avoiding square lips. */
export function trenchCutDepth(s: GameState, trench: Entrenchment, x: number) {
  const left = Math.max(126, trench.x - trench.radius),
    right = Math.min(s.terrain.length - 127, trench.x + trench.radius);
  if (x <= left || x >= right) return 0;
  const middle = (left + right) / 2;
  const floorLeft = Math.min(
    middle,
    Math.max(left + 25, trench.x - trench.innerRadius),
  );
  const floorRight = Math.max(
    middle,
    Math.min(right - 25, trench.x + trench.innerRadius),
  );
  const t =
    x < floorLeft
      ? (x - left) / (floorLeft - left)
      : x > floorRight
        ? (right - x) / (right - floorRight)
        : 1;
  const eased = t * t * (3 - 2 * t);
  return (
    Math.min(
      MAX_TRENCH_DEPTH,
      Math.max(
        0,
        trench.floorY -
          s.original[
            Math.max(0, Math.min(s.original.length - 1, Math.round(x)))
          ],
      ),
    ) * eased
  );
}

/** Only explicit shared-trench hold orders provide a construction/movement slot. */
export function trenchWorksite(s: GameState, u: Unit) {
  if (
    u.squadOrder !== 'hold' ||
    (u.squadOrderUntil ?? Infinity) <= s.time ||
    u.squadOrderX === undefined ||
    u.holdLane === undefined
  )
    return null;
  const trench = (s.entrenchments ?? []).find(
    (t) => t.squad === u.squad && t.side === u.side,
  );
  if (!trench) return null;
  const rows = trench.workRows ?? 1;
  const row = rows <= 1 ? 0 : Math.round(((u.holdLane + 20) / 40) * (rows - 1));
  const activeRow =
    Math.floor((s.time - (trench.workStartedAt ?? 0)) / 1.6) % rows;
  return {
    x: u.squadOrderX,
    lane: u.holdLane,
    pending: !trench.built,
    digTurn: row === activeRow,
  };
}

/** The prepared earth banks are walked, while unrelated bomb-pit lips keep their traversal rules. */
export function preparedTrenchRamp(s: GameState, from: number, to: number) {
  const left = Math.max(0, Math.floor(Math.min(from, to)));
  const right = Math.min(s.terrain.length - 1, Math.ceil(Math.max(from, to)));
  const nearby = (s.entrenchments ?? []).filter(
    (t) => t.progress > 0 && right > t.x - t.radius && left < t.x + t.radius,
  );
  if (!nearby.length) return false;
  // The look-ahead may cross the lip into level ground. It must still follow
  // authored earth, not an adjacent blast pit or a naturally steep slope.
  for (let x = left; x <= right; x++) {
    let preparedDepth = 0;
    for (const trench of nearby)
      preparedDepth = Math.max(
        preparedDepth,
        trenchCutDepth(s, trench, x) * trench.progress,
      );
    if (
      (x > left && Math.abs(s.original[x] - s.original[x - 1]) > 0.8) ||
      s.terrain[x] - s.original[x] > preparedDepth + 6
    )
      return false;
  }
  return true;
}

/** Preserve the authored prepared profile during global crater settling. */
export function terrainSlopeLimit(s: GameState, a: number, b: number) {
  if (!s.entrenchments?.length) return 0.8;
  const depthA = terrainDepthLimit(s, a, 0),
    depthB = terrainDepthLimit(s, b, 0);
  if (depthA === 0 && depthB === 0) return 0.8;
  return Math.max(
    0.8,
    Math.abs(s.original[a] + depthA - s.original[b] - depthB) + 1e-6,
  );
}

/** Bomb craters retain their own shallow cap; prepared trenches have a separate physical depth. */
export function terrainDepthLimit(s: GameState, x: number, craterLimit = 28) {
  return (s.entrenchments ?? []).reduce(
    (depth, t) => Math.max(depth, trenchCutDepth(s, t, x) * t.progress),
    craterLimit,
  );
}

/** The berm is physical cover for either side after capture; walking through it stays possible. */
export function trenchProtection(s: GameState, x: number) {
  return (s.entrenchments ?? []).reduce((best, trench) => {
    const t = Math.max(
      0,
      1 - Math.max(0, Math.abs(x - trench.x) - trench.radius + 24) / 24,
    );
    const remainingDepth = Math.max(
      0,
      floorAt(s, x) -
        s.original[Math.max(0, Math.min(s.original.length - 1, Math.round(x)))],
    );
    return Math.max(
      best,
      Math.min(trench.progress * 0.5, remainingDepth / 72) * t,
    );
  }, 0);
}

export function pickSquad(
  s: GameState,
  side: Side,
  x: number,
  y: number,
  touch = false,
) {
  const radius = touch ? 46 : 32;
  const unit = s.units
    .filter((u) => u.side === side && CARDS[u.id].members && living(u))
    .map((u) => ({
      u,
      distance: Math.hypot(
        u.x - x,
        u.y +
          infantryDepth(u.lane) -
          (u.pose === 'prone' ? 12 : u.pose === 'crouch' ? 25 : 40) -
          y,
      ),
    }))
    .filter((v) => v.distance < radius)
    .sort((a, b) => a.distance - b.distance)[0]?.u;
  return unit?.squad ?? null;
}
