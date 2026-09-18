import { CARDS, modelOf, type CardId } from './cards';
import { unitSelectionBounds } from './selection-render';
import { fixedWingUnit } from './unit-control';
import { obstacleBoxes, pointVisible } from './world';
import type { GameState, Side, Unit } from './engine';

export type SquadOrder = 'hold' | 'retreat' | 'attack' | 'watch' | 'escort';
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
  {
    id: 'escort',
    label: '伴随',
    description: '分散跟随最近友方坦克，在后方掩护交战',
  },
];
export const TRENCH_DEPTH = 36;
export const MAX_TRENCH_DEPTH = 48;
const living = (u: Unit) =>
  u.hp > 0 && !u.wounded && !u.surrendered && !u.rappelling;
export const controllableUnit = living;

export function ordersForUnit(id: CardId) {
  const c = CARDS[id];
  if (c.members) return SQUAD_ORDERS;
  if (c.static) return SQUAD_ORDERS.filter((o) => o.id === 'watch');
  if (fixedWingUnit({ id }))
    return [
      {
        id: 'attack' as const,
        label: '继续航线',
        description: '离开当前留空区域，继续原定飞行任务',
      },
      {
        id: 'retreat' as const,
        label: '返航',
        description: '结束本轮任务，从己方边界撤离',
      },
    ];
  return [
    {
      id: 'attack' as const,
      label: c.airlift ? '继续投送' : '前进',
      description: '继续向前执行任务，接敌时自主还击',
    },
    {
      id: 'retreat' as const,
      label: '后退',
      description: '向后转移一段距离，再停下警戒',
    },
    {
      id: 'watch' as const,
      label: c.air ? '悬停' : '警戒',
      description: '留在当前位置观察还击，不追击',
    },
  ];
}
const floorAt = (s: GameState, x: number) =>
  s.terrain[Math.max(0, Math.min(s.terrain.length - 1, Math.round(x)))];
const SITE_SEARCH_DISTANCE = 240;
const SITE_CLEARANCE = 6;
type OccupiedGround = { left: number; right: number };

/** Use remembered scenery plus the visible site, never hidden enemy wrecks or units. */
function constructionObstacles(s: GameState, side: Side): OccupiedGround[] {
  const scenery = s.scenery.flatMap((prop) => {
    const seen =
      pointVisible(s, side, prop.x, prop.y - 12) ||
      prop.parts.some(
        (part) =>
          pointVisible(s, side, part.x - 1, part.y + part.h / 2) ||
          pointVisible(s, side, part.x + part.w + 1, part.y + part.h / 2),
      );
    const known = seen ? prop : s.knownScenery[side][prop.id];
    return known ? [known] : [];
  });
  const wrecks = s.wrecks.filter(
    (w) =>
      !w.falling &&
      !CARDS[w.cardId].members &&
      (w.side === side || pointVisible(s, side, w.x, w.y - 12)),
  );
  const view = { ...s, scenery, wrecks, terrain: s.knownTerrain[side] };
  const footprints = new Map<string, OccupiedGround>();
  for (const box of obstacleBoxes(view)) {
    // Standing tree crowns leave walkable earth underneath; fallen crowns occupy it.
    if (box.foliage && !box.rubble) continue;
    const key = box.wreck ? `wreck:${box.wreck.id}` : `prop:${box.prop!.id}`;
    const previous = footprints.get(key);
    footprints.set(key, {
      left: Math.min(previous?.left ?? Infinity, box.x),
      right: Math.max(previous?.right ?? -Infinity, box.x + box.w),
    });
  }
  for (const wall of s.walls) {
    const known = pointVisible(
      s,
      side,
      wall.x,
      floorAt(s, wall.x) - wall.height - 1,
    )
      ? wall
      : s.knownWalls[side][wall.uid];
    if (known && known.hp > 0)
      footprints.set(`wall:${wall.uid}`, {
        left: known.x - known.width / 2,
        right: known.x + known.width / 2,
      });
  }
  return [...footprints.values()];
}

function clearConstructionSite(
  center: number,
  radius: number,
  blocks: OccupiedGround[],
) {
  return blocks.every(
    (b) =>
      center + radius + SITE_CLEARANCE <= b.left ||
      center - radius - SITE_CLEARANCE >= b.right,
  );
}

function nearestConstructionSite(
  s: GameState,
  side: Side,
  origin: number,
  radius: number,
  blocks: OccupiedGround[],
) {
  const left = Math.max(126 + radius, origin - SITE_SEARCH_DISTANCE);
  const right = Math.min(
    s.terrain.length - 127 - radius,
    origin + SITE_SEARCH_DISTANCE,
  );
  if (left > right) return null;
  const candidates = [
    Math.max(left, Math.min(right, origin)),
    left,
    right,
    ...blocks.flatMap((b) => [
      b.left - radius - SITE_CLEARANCE,
      b.right + radius + SITE_CLEARANCE,
    ]),
  ];
  return (
    candidates
      .filter(
        (x) =>
          x >= left && x <= right && clearConstructionSite(x, radius, blocks),
      )
      .sort(
        (a, b) =>
          Math.abs(a - origin) - Math.abs(b - origin) ||
          (side === 0 ? a - b : b - a),
      )[0] ?? null
  );
}

function trenchFloor(s: GameState, center: number, innerRadius: number) {
  let total = 0;
  for (let i = 0; i < 9; i++)
    total +=
      s.original[Math.round(center - innerRadius + (innerRadius * 2 * i) / 8)];
  return total / 9 + TRENCH_DEPTH;
}

function constructionWatch(members: Unit[]) {
  for (const u of members) {
    u.squadOrder = 'watch';
    u.squadOrderX = u.x;
    u.squadOrderUntil = Infinity;
    u.holdLane = undefined;
    u.digging = false;
    u.coverGoal = null;
    u.firingGoal = null;
    u.dispersionGoal = undefined;
    u.withdrawUntil = 0;
    u.decisionIn = 0;
  }
}

function constructionNotice(s: GameState, side: Side, text: string) {
  s.notices.unshift({ text, time: s.time, kind: 'warn', audience: [side] });
  s.notices = s.notices.slice(0, 5);
}

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
    (u) => u.side === side && u.squad === squad && living(u),
  );
  if (!members.length) return { ok: false, message: '这支小队已无法接令' };
  const card = CARDS[members[0].id];
  // Selection may internally park a fixed-wing unit in watch, without offering hover as a flight command.
  if (order !== 'watch' && !ordersForUnit(card.id).some((o) => o.id === order))
    return { ok: false, message: '该单位不支持此指令' };
  if (!card.members) {
    for (const u of members) {
      u.squadOrder = order;
      u.squadOrderUntil = Infinity;
      u.squadOrderX =
        order === 'retreat'
          ? Math.max(
              100,
              Math.min(s.terrain.length - 100, u.x + (side === 0 ? -240 : 240)),
            )
          : u.x;
      u.coverGoal = null;
      u.firingGoal = null;
      u.evadeGoal = null;
      u.moving = false;
      u.vx = 0;
      u.decisionIn = 0;
      if (order === 'attack') {
        u.patrolExiting = false;
        u.patrolDir = side === 0 ? 1 : -1;
      }
    }
    return {
      ok: true,
      message: `${card.name}：${ordersForUnit(card.id).find((o) => o.id === order)?.label ?? '留空待命'}`,
    };
  }
  const x = members.reduce((n, u) => n + u.x, 0) / members.length;
  const repeated = members.every((u) => u.squadOrder === order);
  if (repeated && order !== 'escort')
    return {
      ok: true,
      message: `小队正在${SQUAD_ORDERS.find((v) => v.id === order)!.label}`,
    };
  let trench = (s.entrenchments ?? []).find(
    (v) => v.squad === squad && v.side === side,
  );
  const blocks =
    order === 'hold' && !trench?.built ? constructionObstacles(s, side) : [];
  if (
    order === 'hold' &&
    trench &&
    !trench.built &&
    !clearConstructionSite(trench.x, trench.radius, blocks)
  ) {
    const center =
      trench.progress === 0
        ? nearestConstructionSite(s, side, x, trench.radius, blocks)
        : null;
    if (center === null) {
      constructionWatch(members);
      const message =
        trench.progress > 0
          ? '施工处被废墟占用，已暂停并警戒'
          : '附近没有可施工空地，已转为警戒';
      constructionNotice(s, side, message);
      return { ok: false, message };
    }
    trench.x = center;
    trench.floorY = trenchFloor(s, center, trench.innerRadius);
    trench.workStartedAt = s.time;
  }
  if (order === 'hold' && !trench) {
    s.entrenchments ??= [];
    const span =
      Math.max(...members.map((u) => u.x)) -
      Math.min(...members.map((u) => u.x));
    const oldInnerRadius = Math.min(165, Math.max(36, span / 2 + 14));
    const radius = Math.max(43.5, (oldInnerRadius + 96) / 4);
    const innerRadius = radius - 25;
    const center = nearestConstructionSite(s, side, x, radius, blocks);
    if (center === null) {
      constructionWatch(members);
      const message = '附近没有可施工空地，已转为警戒';
      constructionNotice(s, side, message);
      return { ok: false, message };
    }
    trench = {
      squad,
      side,
      x: center,
      radius,
      innerRadius,
      floorY: trenchFloor(s, center, innerRadius),
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
  // The squad leader (lowest uid among the living) punctuates a fresh order
  // with a hand signal so the chain of command reads on the field, not just
  // in the order UI. Repeated orders return earlier and never re-signal, and
  // a per-squad cooldown (v121) keeps the gesture rare — a leader waving
  // every few seconds read as noise, not command.
  let leader = members[0];
  for (const m of members) if (m.uid < leader.uid) leader = m;
  const SIGNAL_COOLDOWN = 5;
  const cmdKey = side * 1048576 + squad;
  const cmdRec = s.squadCommand?.[cmdKey];
  if (!cmdRec || s.time - (cmdRec.lastSignalAt ?? -Infinity) >= SIGNAL_COOLDOWN) {
    leader.signalUntil = s.time + 1.1;
    if (cmdRec) cmdRec.lastSignalAt = s.time;
    // Nearby squad mates answer the signal with a quick return pump of the arm,
    // so the chain of command reads as a two-way exchange instead of a one-man
    // wave. The window is staggered by uid so acknowledgments ripple through the
    // squad, and only members close enough to have seen the gesture answer.
    for (const m of members) {
      if (m === leader) continue;
      if (Math.hypot(m.x - leader.x, m.y - leader.y) > 230) continue;
      m.ackUntil = s.time + 0.55 + (m.uid % 3) * 0.18;
    }
  }
  for (let i = 0; i < ordered.length; i++) {
    const u = ordered[i];
    u.squadOrder = order;
    u.escortTankUid = undefined;
    u.escortGoal = undefined;
    u.escortLane = undefined;
    u.escortScanAt = 0;
    u.escortLostAt = undefined;
    u.withdrawHeavyUid = undefined;
    u.withdrawStandby = false;
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
  if (order === 'escort') updateEscorts(s);
  return {
    ok: true,
    message: `${CARDS[members[0].id].name}：${SQUAD_ORDERS.find((v) => v.id === order)!.label}`,
  };
}

/** Own tanks are known friendly information; no enemy position is read here. */
function updateEscorts(s: GameState) {
  const tanks = s.units.filter(
    (u) =>
      living(u) &&
      modelOf(u.id) === 'tank' &&
      !CARDS[u.id].static &&
      (CARDS[u.id].damage ?? 0) > 0,
  );
  const groups = new Map<number, Unit[]>();
  for (const u of s.units) {
    if (!living(u) || !CARDS[u.id].members || CARDS[u.id].indirect) continue;
    const manual = u.squadOrder && (u.squadOrderUntil ?? Infinity) > s.time;
    if (
      (manual && u.squadOrder !== 'escort') ||
      (!manual && s.players[u.side].order === 'hold')
    ) {
      u.escortTankUid = undefined;
      u.escortGoal = undefined;
      continue;
    }
    const list = groups.get(u.squad) ?? [];
    list.push(u);
    groups.set(u.squad, list);
  }
  for (const members of groups.values()) {
    members.sort((a, b) => a.uid - b.uid);
    const first = members[0],
      dir = first.side === 0 ? 1 : -1;
    const center = members.reduce((n, u) => n + u.x, 0) / members.length;
    let tank = tanks.find(
      (v) => v.uid === first.escortTankUid && Math.abs(v.x - center) <= 760,
    );
    if (!tank && (first.escortScanAt ?? 0) <= s.time) {
      tank = tanks
        .filter((v) => v.side === first.side && Math.abs(v.x - center) <= 600)
        .sort(
          (a, b) =>
            Math.abs(a.x - center) - Math.abs(b.x - center) || a.uid - b.uid,
        )[0];
      for (const u of members) u.escortScanAt = s.time + 0.6;
    }
    if (tank) {
      const preceding = [...groups.entries()].filter(
        ([id, group]) =>
          id < first.squad &&
          group[0].side === first.side &&
          group[0].escortTankUid === tank.uid,
      ).length;
      for (const [i, u] of members.entries()) {
        u.escortTankUid = tank.uid;
        u.escortLostAt = undefined;
        u.escortLastX = tank.x;
        u.escortGoal = Math.max(
          80,
          Math.min(
            s.terrain.length - 80,
            tank.x - dir * (105 + preceding * 78 + Math.floor(i / 2) * 26),
          ),
        );
        u.escortLane = i % 2 ? 18 : -18;
      }
    } else {
      for (const u of members) {
        if (u.escortTankUid !== undefined) {
          u.escortLostAt = s.time;
          u.escortGoal = Math.max(
            80,
            Math.min(s.terrain.length - 80, u.x - dir * 60),
          );
        }
        u.escortTankUid = undefined;
        if (u.escortLostAt === undefined || s.time - u.escortLostAt > 4) {
          u.escortGoal = u.squadOrder === 'escort' ? u.x : undefined;
          u.escortLostAt = undefined;
        }
      }
    }
  }
}

/** Construction requires nearby, grounded troops; repeated orders never create more mines. */
export function updateSquadOrders(s: GameState, dt: number) {
  updateEscorts(s);
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
    if (
      !clearConstructionSite(
        trench.x,
        trench.radius,
        constructionObstacles(s, trench.side),
      )
    ) {
      const members = s.units.filter(
        (u) => u.squad === trench.squad && u.side === trench.side && living(u),
      );
      constructionWatch(members);
      if (trench.progress === 0) {
        // Reuse an untouched plan; every member still walks to its replacement station.
        const result = setSquadOrder(s, trench.side, trench.squad, 'hold');
        if (result.ok)
          constructionNotice(
            s,
            trench.side,
            '施工点被废墟占用，正转移到附近空地',
          );
      } else {
        // Excavated soil and progress are permanent. Never reset a partial pit to farm another.
        constructionNotice(s, trench.side, '施工处被废墟占用，已暂停并警戒');
      }
      continue;
    }
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
    s.terrainVersion++;
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
  const radius = touch ? 18 : 8;
  const unit = s.units
    .filter((u) => u.side === side && living(u))
    .map((u) => {
      const b = unitSelectionBounds(u);
      return {
        u,
        distance: Math.hypot(
          Math.max(b.x - x, 0, x - b.x - b.w),
          Math.max(b.y - y, 0, y - b.y - b.h),
        ),
        centerDistance: Math.hypot(u.x - x, b.y + b.h / 2 - y),
      };
    })
    .filter((v) => v.distance < radius)
    .sort(
      (a, b) => a.distance - b.distance || a.centerDistance - b.centerDistance,
    )[0]?.u;
  return unit?.squad ?? null;
}

/** Opening the command fan is itself an explicit stop/watch order, never a temporary UI pause. */
export function selectUnitGroup(s: GameState, side: Side, squad: number) {
  const result = setSquadOrder(s, side, squad, 'watch');
  if (!result.ok) return result;
  for (const u of s.units) {
    if (u.side !== side || u.squad !== squad || !living(u)) continue;
    u.squadOrderX = u.x;
    u.squadOrderUntil = Infinity;
    u.moving = false;
    u.vx = 0;
    u.vy = 0;
    u.coverGoal = null;
    u.firingGoal = null;
    u.dispersionGoal = undefined;
    u.escortGoal = undefined;
    u.escortTankUid = undefined;
    u.escortLane = undefined;
    u.withdrawGoal = undefined;
    u.withdrawUntil = 0;
    u.withdrawStandby = false;
    u.retreatUntil = 0;
    u.evadeGoal = null;
    u.evadeUntil = 0;
    u.digging = false;
    u.climbing = 0;
    u.motion = 'ground';
    u.decisionIn = 0;
    u.backpedaling = false;
    if (CARDS[u.id].members) {
      u.tactic = 'crouch';
      u.pose = 'crouch';
    }
  }
  return result;
}
