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
  for (const u of members) {
    u.squadOrder = order;
    u.squadOrderX =
      order === 'retreat'
        ? Math.max(
            100,
            Math.min(s.terrain.length - 100, u.x + (side === 0 ? -240 : 240)),
          )
        : u.x;
    u.squadOrderUntil = Infinity;
    u.coverGoal = null;
    u.decisionIn = 0;
    u.firingGoal = null;
    if (order !== 'retreat') u.withdrawUntil = 0;
  }
  if (order === 'hold') {
    s.entrenchments ??= [];
    if (!s.entrenchments.some((v) => v.squad === squad)) {
      const span =
        Math.max(...members.map((u) => u.x)) -
        Math.min(...members.map((u) => u.x));
      const innerRadius = Math.min(165, Math.max(36, span / 2 + 14));
      const samples = Array.from(
        { length: 9 },
        (_, i) =>
          s.original[
            Math.max(
              0,
              Math.min(
                s.original.length - 1,
                Math.round(x - innerRadius + (innerRadius * 2 * i) / 8),
              ),
            )
          ],
      );
      const floorY =
        samples.reduce((a, b) => a + b, 0) / samples.length + TRENCH_DEPTH;
      s.entrenchments.push({
        squad,
        side,
        x,
        innerRadius,
        radius: innerRadius + 96,
        floorY,
        progress: 0,
        built: false,
        minesLaid: false,
      });
    }
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
        !u.moving &&
        !u.climbing &&
        u.motion === 'ground' &&
        u.suppression < 65 &&
        Math.abs(u.x - trench.x) <= trench.radius + 20,
    );
    if (!workers.length) continue;
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
    Math.max(left + 84, trench.x - trench.innerRadius),
  );
  const floorRight = Math.max(
    middle,
    Math.min(right - 84, trench.x + trench.innerRadius),
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
