import { infantryGeometry } from './infantry-geometry';
import {
  setSquadOrder,
  updateSquadOrders,
  trenchProtection,
  terrainDepthLimit,
  type Entrenchment,
  type SquadOrder,
} from './squad-orders';
import { createMapLayout, DEFAULT_MAP, type MapId } from './maps';
import { wreckContact } from './wreck-geometry';
import { tankGeometry, armorHalf, armorHeight } from './vehicle-geometry';
import {
  ammunition,
  FLIGHT,
  isTracer,
  isCoverBullet,
  type Ammunition,
} from './ballistics';
import {
  obstacleBoxes,
  segmentBox,
  debrisCover,
  createScenery,
  refreshVision,
  visibleToSide,
  pointVisible,
  sceneryIntercept,
  sceneryCoverHits,
  damageScenery,
  type Scenery,
  type Wreck,
  type Mine,
} from './world';
export { refreshVision, visibleToSide, pointVisible } from './world';
import {
  CARDS,
  DECK,
  validDeck,
  chooseAiDeck,
  modelOf,
  weaponCard,
  doctrineOf,
  type CardId,
  type Doctrine,
} from './cards';
export {
  CARDS,
  DECK,
  DECK_SIZE,
  validDeck,
  chooseAiDeck,
  modelOf,
  doctrineOf,
  needsTarget,
} from './cards';
export type { CardId, Card } from './cards';
export type Side = 0 | 1;
export type Order = 'advance' | 'hold' | 'rush' | 'crouch' | 'prone';
export type Status = 'ready' | 'playing' | 'paused' | 'finished';
export const W = 3840,
  VIEW_W = 1440,
  H = 480,
  DURATION = 600,
  MAX_HP = 1000,
  DRAW_TIME = 9,
  ENERGY_TIME = 3.6,
  MAX_HAND = 6;
export const DRAW_COST = 2,
  MAX_CRATER_DEPTH = 28,
  SQUAD_SPACING = 38;
export const AIR_ALTITUDE = 232,
  DROP_HEIGHT = 26,
  CLIMB_HEIGHT = 28;
export interface HandCard {
  uid: number;
  id: CardId;
  readyAt?: number;
  returnedOnce?: boolean;
}
export interface Unit {
  squadOrder?: SquadOrder;
  squadOrderX?: number;
  squadOrderUntil?: number;
  uid: number;
  id: CardId;
  side: Side;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  cooldown: number;
  walk: number;
  flash: number;
  squad: number;
  moving: boolean;
  fire: number;
  deadFor: number;
  lane: number;
  pace: number;
  climbing: number;
  climbFrom: number;
  climbWall: number;
  passedWalls: number[];
  facing: number;
  retreatUntil: number;
  hullAngle: number;
  wounded: boolean;
  woundedFromPose?: Unit['pose'];
  woundedTime: number;
  bleedOut: number;
  woundedBy: Side;
  rescueProgress: number;
  injuryCooldown: number;
  lastAmmo?: Ammunition;
  lastThreat?: { x: number; y: number; until: number };
  aimUntil?: number;
  readyAt?: number;
  exposedUntil?: number;
  firingGoal?: number | null;
  firingSearchAt?: number;
  firingTransit?: boolean;
  contactUid?: number;
  contactScanAt?: number;
  contactUntil?: number;
  dispersionGoal?: number;
  dispersionUntil?: number;
  trafficYieldUntil?: number;
  artilleryChecks?: number[];
  artilleryReactAt?: number;
  lastCombatShotAt?: number;
  stillFor?: number;
  ambushFor?: number;
  rapidUntil?: number;
  smokeAssaultSpent?: boolean;
  assaultBurstUntil?: number;
  buddyRallied?: boolean;
  breachPropId?: number;
  breachShots?: number;
  boundStartedAt?: number;
  boundRestUntil?: number;
  withdrawStartedAt?: number;
  withdrawUntil?: number;
  withdrawGoal?: number;
  withdrawNextAt?: number;
  withdrawGroup?: number;
  originalSquad?: number;
  regroupHost?: number;
  emplaced?: boolean;
  emplacementIdleSince?: number;
  emplacementSetupUntil?: number;
  conflictNextAt?: number;
  regroupProgress?: number;
  regroupedAt?: number;
  conflictUntil?: number;
  conflictTarget?: number;
  conflictChecked?: boolean;
  motionLift?: number;
  shots: number;
  secondaryShots: number;
  muzzleX: number;
  muzzleY: number;
  shotAngle: number;
  secondaryMuzzleX: number;
  secondaryMuzzleY: number;
  secondaryAngle: number;
  member: number;
  personalMorale: number;
  suppression: number;
  decisionIn: number;
  tactic:
    | 'advance'
    | 'prone'
    | 'crouch'
    | 'cover'
    | 'bound'
    | 'retreat'
    | 'surrender';
  surrendered: boolean;
  surrenderTime: number;
  secondaryCooldown: number;
  secondaryFire: number;
  climbDuration: number;
  pose:
    | 'idle'
    | 'walk'
    | 'run'
    | 'climb'
    | 'crouch'
    | 'prone'
    | 'jump'
    | 'land';
  motion: 'ground' | 'jump' | 'land' | 'bank';
  motionTime: number;
  motionDuration: number;
  motionFromX: number;
  motionFromY: number;
  motionToX: number;
  motionToY: number;
  vx: number;
  vy: number;
  stepCooldown: number;
  cover: number;
  coverGoal: number | null;
  trafficWait?: number;
  passingLane?: number;
  coverSearch: number;
  supportCooldown: number;
  healing: number;
  repairTime: number;
  recoverySupportUntil?: number;
  commandSupportUntil?: number;
  patrolDir: number;
  evadeGoal: number | null;
  evadeUntil: number;
  evadeMarker: number | null;
  friendlyWarnAt: number;
  sortieCard: HandCard | null;
  bombsLeft?: number;
  flightUntil?: number;
  patrolExiting?: boolean;
  fpvLock?: { uid: number; x: number; y: number };
  airlift?: {
    x: number;
    phase: 'approach' | 'unload' | 'exit';
    dropped: number;
    nextAt: number;
    squad?: number;
  };
  rappelling?: boolean;
  slowedUntil: number;
  destroyed: boolean;
}
export interface Projectile {
  passedCover?: number[];
  uid?: number;
  guided?: boolean;
  topAttack?: boolean;
  loftX?: number;
  loftY?: number;
  lofted?: boolean;
  heading?: number;
  speed?: number;
  infantryMultiplier?: number;
  baseMultiplier?: number;
  shell?: boolean;
  effect?: Blast['kind'];
  sourceUid?: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  side: Side;
  targetUid: number | null;
  base: Side | null;
  damage: number;
  radius: number;
  life: number;
  total: number;
  startX: number;
  startY: number;
  arc?: number;
  ammunition?: Ammunition;
  tracer?: boolean;
  trailIn?: number;
  weapon?: 'coax';
  armorMultiplier?: number;
  missed?: boolean;
}
export interface Particle {
  kind?: 'smoke' | 'dust' | 'spark' | 'chip' | 'casing' | 'tracer' | 'impact';
  endX?: number;
  endY?: number;
  variant?: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}
export interface Marker {
  uid?: number;
  x: number;
  timer: number;
  side: Side;
  wave: number;
  kind?: 'artillery' | 'precision' | 'barrage';
  impacts?: number[];
}
export interface Blast {
  kind?:
    | 'he'
    | 'artillery'
    | 'wreck'
    | 'penetration'
    | 'grenade'
    | 'air'
    | 'crash';
  x: number;
  y: number;
  age: number;
  radius: number;
  soil: boolean;
  seed: number;
}
export interface Smoke {
  x: number;
  life: number;
  side: Side;
}
export interface Notice {
  audience?: Side[];
  text: string;
  time: number;
  kind: 'good' | 'warn' | 'info';
}
export interface Wall {
  uid: number;
  x: number;
  width: number;
  height: number;
  hp: number;
}
export interface Player {
  loadout: CardId[];
  drawSeed: number;
  fortify: number;
  captures: number;
  order: Order;
  hp: number;
  energy: number;
  hand: HandCard[];
  deck: HandCard[];
  discard: HandCard[];
  drawIn: number;
  jam: number;
  morale: number;
  recon: number;
  kills: number;
  played: number;
}
export interface GameState {
  entrenchments?: Entrenchment[];
  mapId: MapId;
  scenery: Scenery[];
  wrecks: Wreck[];
  mines: Mine[];
  visible: [number[], number[]];
  sight: [boolean[], boolean[]];
  knownTerrain: [number[], number[]];
  knownWalls: [Record<number, Wall>, Record<number, Wall>];
  knownScenery: [Record<number, Scenery>, Record<number, Scenery>];
  visionIn: number;
  audibleExplosions: [number, number];
  status: Status;
  time: number;
  players: [Player, Player];
  terrain: number[];
  original: number[];
  walls: Wall[];
  units: Unit[];
  projectiles: Projectile[];
  particles: Particle[];
  markers: Marker[];
  smokes: Smoke[];
  blasts: Blast[];
  notices: Notice[];
  result: Side | 'draw' | null;
  aiIn: number;
  aiWaveUntil?: number;
  aiArmorSeenUntil?: number;
  aiAirSeenUntil?: number;
  shake: number;
  uid: number;
  seed: number;
  fxSeed: number;
  injurySeed: number;
  explosions: number;
}
function rnd(s: GameState) {
  s.seed = (Math.imul(1664525, s.seed) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
function fxRnd(s: GameState) {
  s.fxSeed = (Math.imul(1664525, s.fxSeed) + 1013904223) >>> 0;
  return s.fxSeed / 4294967296;
}
function shuffle<T>(p: Player, list: T[]) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    p.drawSeed = (Math.imul(1664525, p.drawSeed) + 1013904223) >>> 0;
    const j = Math.floor((p.drawSeed / 4294967296) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function ground(s: GameState, x: number) {
  return s.terrain[Math.max(0, Math.min(W - 1, Math.floor(x)))];
}
export function createGame(
  seed = Date.now(),
  playerDeck: CardId[] = DECK,
  aiDeck: CardId[] = chooseAiDeck(seed),
  mapId: MapId = DEFAULT_MAP,
): GameState {
  if (!validDeck(playerDeck) || !validDeck(aiDeck))
    throw new Error('双方卡组必须各有20张有效卡牌，且不超过各卡数量上限');
  const layout = createMapLayout(mapId, W),
    original = layout.terrain;
  const p = (side: Side, loadout: CardId[]): Player => ({
    loadout: [...loadout],
    drawSeed: (seed ^ (side === 0 ? 0x9e3779b9 : 0x85ebca6b)) >>> 0,
    fortify: 0,
    captures: 0,
    order: 'advance',
    hp: MAX_HP,
    energy: 6,
    hand: [],
    deck: [],
    discard: [],
    drawIn: 0,
    jam: 0,
    morale: 0,
    recon: 0,
    kills: 0,
    played: 0,
  });
  const s: GameState = {
    mapId: layout.id,
    scenery: createScenery(original, layout.scenerySites),
    wrecks: [],
    mines: [],
    visible: [[], []],
    sight: [[], []],
    knownTerrain: [[...original], [...original]],
    knownScenery: [{}, {}],
    knownWalls: [{}, {}],
    visionIn: 0,
    audibleExplosions: [0, 0],
    status: 'ready',
    time: 0,
    players: [p(0, playerDeck), p(1, aiDeck)],
    terrain: [...original],
    original,
    walls: layout.wallSites.map((wall, i) => ({
      uid: i + 1,
      ...wall,
    })),
    units: [],
    projectiles: [],
    particles: [],
    markers: [],
    smokes: [],
    blasts: [],
    notices: [],
    result: null,
    aiIn: 1.1,
    shake: 0,
    uid: 0,
    seed: seed >>> 0,
    fxSeed: (seed ^ 0x7f4a7c15) >>> 0,
    injurySeed: (seed ^ 0x4cf5ad43) >>> 0,
    explosions: 0,
  };
  for (const side of [0, 1] as Side[]) {
    const player = s.players[side];
    player.deck = shuffle(
      player,
      player.loadout.map((id) => ({
        id,
        uid: ++s.uid,
        readyAt: 0,
        returnedOnce: false,
      })),
    );
    draw(s, side, MAX_HAND);
  }
  for (const side of [0, 1] as Side[])
    s.knownScenery[side] = Object.fromEntries(
      s.scenery.map((p) => [p.id, structuredClone(p)]),
    );
  for (const side of [0, 1] as Side[])
    s.knownWalls[side] = Object.fromEntries(
      s.walls.map((w) => [w.uid, { ...w }]),
    );
  refreshVision(s);
  return s;
}
export function notify(
  s: GameState,
  text: string,
  kind: Notice['kind'] = 'info',
  audience?: Side[],
) {
  s.notices.unshift({ text, time: s.time, kind, audience });
  s.notices = s.notices.slice(0, 5);
}
export function startGame(s: GameState) {
  if (s.status === 'ready') {
    s.status = 'playing';
    notify(s, '战线已开放，部署你的第一支部队', 'good');
  }
}
export function formationPositions(side: Side, id: CardId, x: number) {
  const count = CARDS[id].members ?? 1,
    span = (count - 1) * SQUAD_SPACING;
  const front =
    side === 0
      ? Math.max(112 + span, Math.min(W - 112, x))
      : Math.min(W - 112 - span, Math.max(112, x));
  return Array.from(
    { length: count },
    (_, i) => front - (side === 0 ? 1 : -1) * i * SQUAD_SPACING,
  );
}
export function spawnUnit(
  s: GameState,
  side: Side,
  id: CardId,
  x: number,
  cargo?: { member: number; squad?: number },
) {
  const c = CARDS[id],
    count = c.members ?? 1,
    squad = cargo?.squad ?? ++s.uid,
    dir = side === 0 ? 1 : -1;
  const positions = formationPositions(side, id, x);
  for (
    let i = cargo?.member ?? 0;
    i < (cargo ? cargo.member + 1 : count);
    i++
  ) {
    const px = cargo ? x : positions[i],
      hp = c.hp! / count;
    s.units.push({
      uid: ++s.uid,
      id,
      side,
      x: px,
      y: c.air
        ? (c.altitude ?? AIR_ALTITUDE)
        : c.armored || c.vehicle
          ? vehicleContact(s, px, id).y
          : ground(s, px),
      hp,
      maxHp: hp,
      cooldown: 0.3 + i * 0.13,
      walk: rnd(s) * 8,
      flash: 0,
      squad,
      moving: false,
      fire: 0,
      deadFor: 0,
      lane: count === 1 ? 0 : ((i % 3) - 1) * 3,
      pace: 0.94 + rnd(s) * 0.12,
      climbing: 0,
      climbFrom: 0,
      climbWall: 0,
      passedWalls: [],
      facing: dir,
      retreatUntil: 0,
      hullAngle: c.armored || c.vehicle ? vehicleContact(s, px, id).angle : 0,
      wounded: false,
      woundedTime: 0,
      bleedOut: 0,
      woundedBy: side === 0 ? 1 : 0,
      rescueProgress: 0,
      injuryCooldown: 0,
      shots: i,
      secondaryShots: 0,
      muzzleX: px,
      muzzleY: ground(s, px) - 47,
      shotAngle: 0,
      secondaryMuzzleX: px,
      secondaryMuzzleY: ground(s, px) - 42,
      secondaryAngle: 0,
      member: i,
      personalMorale: c.discipline ?? 80,
      rapidUntil: c.infantryAbility === 'rapid' ? s.time + 8 : undefined,
      suppression: 0,
      decisionIn: i * 0.08,
      tactic: 'advance',
      surrendered: false,
      surrenderTime: 0,
      secondaryCooldown: 0.1,
      secondaryFire: 0,
      climbDuration: 1.2,
      pose: 'idle',
      motion: 'ground',
      motionTime: 0,
      motionDuration: 0,
      motionFromX: px,
      motionFromY: ground(s, px),
      motionToX: px,
      motionToY: ground(s, px),
      vx: 0,
      vy: 0,
      stepCooldown: 0,
      cover: 0,
      coverGoal: null,
      coverSearch: 0,
      supportCooldown: 0,
      healing: 0,
      repairTime: 0,
      patrolDir: side === 0 ? 1 : -1,
      evadeGoal: null,
      evadeUntil: 0,
      evadeMarker: null,
      friendlyWarnAt: -10,
      sortieCard: null,
      flightUntil:
        c.patrolTime || c.flightTime
          ? s.time + (c.patrolTime ?? c.flightTime!)
          : undefined,
      slowedUntil: 0,
      destroyed: false,
    });
  }
}
export function setOrder(s: GameState, side: Side, order: Order) {
  if (!['advance', 'hold', 'rush', 'crouch', 'prone'].includes(order))
    return false;
  s.players[side].order = order;
  return true;
}
export function draw(s: GameState, side: Side, count = 1) {
  const p = s.players[side];
  let drawn = 0;
  for (let i = 0; i < count; i++) {
    if (p.hand.length >= MAX_HAND) break;
    if (!p.deck.length) {
      p.deck = shuffle(p, p.discard);
      p.discard = [];
    }
    const token = p.deck.shift();
    if (!token) break;
    p.hand.push(token);
    drawn++;
  }
  return drawn;
}
export function cardCost(card: HandCard) {
  const c = CARDS[card.id];
  return card.returnedOnce && c.sortie ? (c.returnCost ?? c.cost) : c.cost;
}
export function cardReadyIn(s: GameState, card: HandCard) {
  return Math.max(0, (card.readyAt ?? 0) - s.time);
}
export function requestDraw(
  s: GameState,
  side: Side,
): { ok: boolean; message: string } {
  const p = s.players[side];
  if (s.status !== 'playing')
    return { ok: false, message: '请先开始或继续作战' };
  if (p.jam > 0)
    return { ok: false, message: `通讯受扰，还需 ${Math.ceil(p.jam)} 秒` };
  if (p.hand.length >= MAX_HAND)
    return { ok: false, message: '手牌已满，请先使用一张卡' };
  if (p.drawIn > 0)
    return { ok: false, message: `补给准备中，还需 ${Math.ceil(p.drawIn)} 秒` };
  if (!p.deck.length && !p.discard.length)
    return { ok: false, message: '没有可抽取的卡牌' };
  if (p.energy < DRAW_COST)
    return { ok: false, message: '抽牌需要 2 点指挥点' };
  if (!draw(s, side)) return { ok: false, message: '没有可抽取的卡牌' };
  p.energy -= DRAW_COST;
  p.drawIn = DRAW_TIME;
  return { ok: true, message: '消耗 2 点指挥点，抽取 1 张卡牌' };
}
export const ARTILLERY = {
  artillery: {
    delay: 2.8,
    count: 3,
    interval: 0.85,
    damage: 26,
    radius: 42,
    spacing: 70,
    scatter: 28,
    baseScale: 0.15,
  },
  barrage: {
    delay: 3.6,
    count: 5,
    interval: 0.75,
    damage: 20,
    radius: 40,
    spacing: 60,
    scatter: 25,
    baseScale: 0.15,
  },
  precision: {
    delay: 2.6,
    count: 1,
    interval: 0,
    damage: 150,
    radius: 26,
    spacing: 0,
    scatter: 8,
    baseScale: 0.2,
  },
};
function callArtillery(
  s: GameState,
  side: Side,
  x: number,
  kind: keyof typeof ARTILLERY,
) {
  const c = ARTILLERY[kind];
  const impacts = Array.from({ length: c.count }, (_, i) =>
    Math.max(
      0,
      Math.min(
        W,
        x + (i - (c.count - 1) / 2) * c.spacing + (rnd(s) * 2 - 1) * c.scatter,
      ),
    ),
  );
  s.markers.push({
    uid: ++s.uid,
    x,
    timer: c.delay,
    side,
    wave: 0,
    kind,
    impacts,
  });
}
function defaultLanding(s: GameState, side: Side) {
  const dir = side === 0 ? 1 : -1;
  const visible = s.units.filter(
    (v) =>
      v.side !== side &&
      isCombatant(v) &&
      !CARDS[v.id].air &&
      visibleToSide(s, side, v),
  );
  const rear = visible.length
    ? side === 0
      ? Math.max(...visible.map((v) => v.x))
      : Math.min(...visible.map((v) => v.x))
    : W / 2;
  return rear + dir * 220;
}
function safeLanding(s: GameState, requested: number) {
  const center = Math.max(480, Math.min(W - 480, requested));
  const boxes = obstacleBoxes(s);
  // A clear footprint for all five ropes; wrecks and standing walls are real obstacles.
  for (let distance = 0; distance <= 480; distance += 24) {
    for (const sign of [1, -1]) {
      const x = center + distance * sign;
      if (x < 480 || x > W - 480) continue;
      if (
        !boxes.some(
          (b) =>
            b.x < x + 110 &&
            b.x + b.w > x - 110 &&
            ground(s, b.x + b.w / 2) - b.y > 26,
        ) &&
        !s.walls.some((w) => w.hp > 0 && Math.abs(w.x - x) < 130)
      )
        return x;
    }
  }
  return center;
}
export function playCard(
  s: GameState,
  side: Side,
  uid: number,
  x?: number,
): { ok: boolean; message: string } {
  if (s.status !== 'playing')
    return { ok: false, message: '请先开始或继续作战' };
  const p = s.players[side],
    index = p.hand.findIndex((c) => c.uid === uid);
  if (index < 0) return { ok: false, message: '这张卡牌已不在手牌中' };
  const token = p.hand[index],
    c = CARDS[token.id],
    cost = cardCost(token);
  if (cardReadyIn(s, token) > 0)
    return {
      ok: false,
      message: `返航补给中，还需 ${Math.ceil(cardReadyIn(s, token))} 秒`,
    };
  if (p.energy + 1e-6 < cost)
    return {
      ok: false,
      message: `还需要 ${Math.ceil(cost - p.energy)} 点指挥点`,
    };
  if (
    c.type === 'unit' &&
    x !== undefined &&
    (!Number.isFinite(x) || x < 0 || x > W)
  )
    return { ok: false, message: '无效的入场位置' };
  const landingX = c.airlift
    ? safeLanding(s, x ?? defaultLanding(s, side))
    : undefined;
  // The transport also enters at HQ; its selected point is a flight destination.
  if (c.type === 'unit') x = side === 0 ? 112 : W - 112;
  if (
    c.targetGround &&
    (x === undefined || !Number.isFinite(x) || x < 0 || x > W)
  )
    return { ok: false, message: '请在战场上选择作用位置' };
  if (
    c.id === 'antitank_mine' &&
    s.units.some(
      (u) =>
        u.side !== side &&
        u.hp > 0 &&
        (CARDS[u.id].armored || CARDS[u.id].vehicle) &&
        visibleToSide(s, side, u) &&
        Math.abs(u.x - x!) < 80,
    )
  )
    return { ok: false, message: '请提前布雷，需离敌方装甲至少 80 距离' };
  p.energy = Math.max(0, p.energy - cost);
  p.hand.splice(index, 1);
  if (!c.sortie) p.discard.push(token);
  p.played++;
  if (c.type === 'unit') {
    spawnUnit(s, side, c.id, x!);
    if (c.airlift)
      s.units.at(-1)!.airlift = {
        x: landingX!,
        phase: 'approach',
        dropped: 0,
        nextAt: s.time,
      };
    if (c.sortie) s.units.at(-1)!.sortieCard = token;
    if (c.deployDraw) draw(s, side, c.deployDraw);
    refreshVision(s);
  } else if (c.id === 'antitank_mine') {
    s.mines.push({ uid: ++s.uid, side, x: x!, armAt: s.time + 2 });
  } else if (c.effect) {
    const own = s.units.filter(
      (u) => u.side === side && isCombatant(u) && CARDS[u.id].members,
    );
    const foe = s.players[side === 0 ? 1 : 0];
    if (c.effect === 'rally')
      for (const u of own) {
        u.personalMorale = Math.min(100, u.personalMorale + 40);
        u.suppression *= 0.2;
        u.decisionIn = 0;
        u.retreatUntil = 0;
      }
    if (c.effect === 'ammo') draw(s, side, 3);
    if (c.effect === 'emp') {
      foe.jam = Math.max(foe.jam, 14);
      foe.recon = 0;
      for (const u of s.units)
        if (
          u.side !== side &&
          isCombatant(u) &&
          visibleToSide(s, side, u) &&
          (CARDS[u.id].air || weaponCard(u).guided)
        ) {
          u.cooldown = Math.max(u.cooldown, 4);
          u.secondaryCooldown = Math.max(u.secondaryCooldown, 4);
        }
    }
    if (c.effect === 'barrage') callArtillery(s, side, x!, 'barrage');
    if (c.effect === 'medevac') {
      const patients = s.units.filter(
        (v) => v.side === side && canTakeDamage(v) && CARDS[v.id].members,
      );
      const patient = [...patients]
        .filter((v) => v.wounded || v.hp < v.maxHp)
        .sort(
          (a, b) =>
            Number(b.wounded) - Number(a.wounded) ||
            a.hp / a.maxHp - b.hp / b.maxHp,
        )[0];
      for (const u of patients.filter(
        (v) => patient && Math.abs(v.x - patient.x) <= 220,
      )) {
        u.hp = Math.min(u.maxHp, u.hp + 18);
        u.personalMorale = Math.min(100, u.personalMorale + 8);
        u.healing = 0.7;
        if (u.wounded) u.rescueProgress += 1.6;
      }
    }
    if (c.effect === 'fortify') {
      p.fortify = 10;
      for (const u of own)
        u.personalMorale = Math.min(100, u.personalMorale + 10);
    }
    if (c.effect === 'sabotage')
      for (const u of s.units)
        if (u.side !== side && isCombatant(u) && visibleToSide(s, side, u)) {
          u.cooldown = Math.max(u.cooldown, 3);
          u.secondaryCooldown = Math.max(u.secondaryCooldown, 3);
        }
  } else if (c.id === 'artillery') {
    callArtillery(s, side, x!, 'artillery');
  } else if (c.id === 'precision') {
    callArtillery(s, side, x!, 'precision');
  } else if (c.id === 'smoke') {
    s.smokes.push({ x: x!, life: 10, side });
  } else if (c.id === 'recon') {
    p.recon = 12;
  } else if (c.id === 'repair') {
    const vehicle = s.units
      .filter(
        (u) =>
          u.side === side &&
          isCombatant(u) &&
          CARDS[u.id].armored &&
          !CARDS[u.id].air &&
          u.hp < u.maxHp,
      )
      .sort((a, b) => b.maxHp - b.hp - (a.maxHp - a.hp))[0];
    if (vehicle) {
      vehicle.hp = Math.min(vehicle.maxHp, vehicle.hp + 30);
      vehicle.repairTime = Math.max(vehicle.repairTime, 6);
      vehicle.healing = 0.7;
    }
  } else if (c.id === 'morale') {
    p.morale = 8;
    for (const u of s.units)
      if (u.side === side && isCombatant(u) && CARDS[u.id].members) {
        u.personalMorale = Math.min(100, u.personalMorale + 15);
        u.suppression *= 0.6;
        u.decisionIn = 0;
      }
  } else if (c.id === 'supply') {
    draw(s, side, 2);
  } else if (c.id === 'jam') {
    const foe = s.players[side === 0 ? 1 : 0];
    foe.jam = Math.max(foe.jam, 9);
  }
  const message =
    side === 0
      ? `${c.name}${c.type === 'unit' ? '已部署' : '已下达'}`
      : `敌方${c.type === 'unit' ? '部署' : '使用'}：${c.name}`;
  notify(s, message, side === 0 ? 'good' : 'warn', [side]);
  return { ok: true, message };
}
export function crater(
  s: GameState,
  x: number,
  radius: number,
  depth = radius * 0.5,
) {
  const centerY = ground(s, x);
  for (
    let i = Math.max(125, Math.floor(x - radius));
    i < Math.min(W - 125, x + radius);
    i++
  ) {
    const a = (i - x) / radius,
      dy = Math.sqrt(Math.max(0, 1 - a * a)) * depth;
    s.terrain[i] = Math.min(
      s.original[i] + terrainDepthLimit(s, i, MAX_CRATER_DEPTH),
      Math.max(s.terrain[i], centerY + dy),
    );
  }
  // Loose crater banks settle into walkable slopes, including after overlapping impacts.
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 126; i < W - 125; i++)
      s.terrain[i] = Math.max(
        s.original[i],
        Math.min(s.terrain[i], s.terrain[i - 1] + 0.8),
      );
    for (let i = W - 127; i >= 125; i--)
      s.terrain[i] = Math.max(
        s.original[i],
        Math.min(s.terrain[i], s.terrain[i + 1] + 0.8),
      );
  }
}
function burst(
  s: GameState,
  x: number,
  y: number,
  radius: number,
  kind: Blast['kind'] = 'he',
) {
  const soil =
    kind !== 'penetration' &&
    kind !== 'air' &&
    (kind === 'crash' || y >= ground(s, x) - 80);
  if (soil) y = ground(s, x);
  else if (kind !== 'penetration') kind = 'air';
  s.explosions++;
  for (const side of [0, 1] as Side[])
    if (pointVisible(s, side, x, y)) s.audibleExplosions[side]++;
  s.blasts.push({
    x,
    y,
    age: 0,
    radius,
    kind,
    soil,
    seed: s.fxSeed,
  });
  s.blasts = s.blasts.slice(-32);
  if (pointVisible(s, 0, x, y)) s.shake = Math.min(12, radius / 7);
  // Generated sprite frames contain the fire, smoke and debris. Only animation state is simulated.
  fxRnd(s);
}

function muzzleParticles(
  s: GameState,
  u: Unit,
  kind: Ammunition,
  sx: number,
  sy: number,
  secondary = false,
) {
  if (kind === 'drone') return;
  const heavy = kind === 'cannon';
  s.particles.push({
    kind: 'smoke',
    x: sx,
    y: sy,
    vx: u.side === 0 ? 9 : -9,
    vy: -7,
    life: heavy ? 0.42 : 0.22,
    maxLife: heavy ? 0.42 : 0.22,
    color: '#a7aa98',
    size: heavy ? 8 : 3,
  });
  if (kind === 'rifle' || kind === 'machinegun' || kind === 'autocannon') {
    const life = 0.25;
    s.particles.push({
      kind: 'casing',
      x: u.x + (u.side === 0 ? 1 : -1) * (secondary ? 40 : 4),
      y: sy + 4,
      vx: (u.side === 0 ? -1 : 1) * (14 + fxRnd(s) * 15),
      vy: -25 - fxRnd(s) * 12,
      life,
      maxLife: life,
      color: '#a18a55',
      size: 1,
    });
  }
}
function bulletImpact(
  s: GameState,
  x: number,
  y: number,
  material: 'soil' | 'armor' | 'cloth',
  direction: number,
) {
  if (material === 'soil')
    s.particles.push({
      kind: 'impact',
      x,
      y,
      vx: 0,
      vy: 0,
      life: 0.48,
      maxLife: 0.48,
      color: '#b3a07a',
      size: 26,
      variant: y < ground(s, x) - 5 ? 1 : 0,
    });
  const count = material === 'soil' ? 5 : 3;
  for (let i = 0; i < count; i++) {
    const life = 0.1 + fxRnd(s) * 0.16;
    s.particles.push({
      kind: material === 'armor' ? 'spark' : 'chip',
      x,
      y,
      vx: direction * (10 + fxRnd(s) * 38) + (fxRnd(s) - 0.5) * 20,
      vy: -8 - fxRnd(s) * 45,
      life,
      maxLife: life,
      color:
        material === 'armor'
          ? i
            ? '#b7a17a'
            : '#ddc9a1'
          : material === 'cloth'
            ? '#777b63'
            : i % 2
              ? '#71624b'
              : '#a79571',
      size: 1,
    });
  }
  if (material === 'soil')
    for (let i = 0; i < 3; i++) {
      const life = 0.2 + fxRnd(s) * 0.18;
      s.particles.push({
        kind: 'dust',
        x: x + (fxRnd(s) - 0.5) * 4,
        y: y - 2,
        vx: (fxRnd(s) - 0.5) * 16,
        vy: -8 - fxRnd(s) * 11,
        life,
        maxLife: life,
        color: '#94876b',
        size: 5 + fxRnd(s) * 4,
      });
    }
}
function hitUnit(
  s: GameState,
  u: Unit,
  damage: number,
  side: Side,
  cover = 0,
  source: 'bullet' | 'blast' = 'bullet',
) {
  if (!canTakeDamage(u)) return;
  const c = CARDS[u.id];
  const protection = u.pose === 'prone' ? 0.7 : u.pose === 'crouch' ? 0.85 : 1;
  const actual =
    damage *
    protection *
    (1 - cover) *
    (c.trait === 'armor_vest' ? 0.88 : 1) *
    (c.members && !u.moving && s.players[u.side].fortify > 0 ? 0.7 : 1);
  u.hp -= actual;
  if (c.members) {
    const supported =
      c.infantryAbility === 'cohesion' &&
      s.units.filter(
        (v) =>
          v !== u &&
          v.side === u.side &&
          v.squad === u.squad &&
          isCombatant(v) &&
          Math.abs(v.x - u.x) <= 90,
      ).length >= 2;
    const resolve = supported || c.infantryAbility === 'elite' ? 0.65 : 1;
    u.suppression = Math.min(
      100,
      u.suppression + ((actual / u.maxHp) * 90 + 6) * resolve,
    );
    u.personalMorale = Math.max(
      0,
      u.personalMorale -
        (actual / u.maxHp) * (135 - (c.discipline ?? 80) * 0.65) * resolve,
    );
    if (u.personalMorale < 35) u.decisionIn = 0;
  }
  u.flash = 0.16;
  if (u.hp <= 0) {
    finishDeath(s, u, side);
    return;
  }
  if (
    c.members &&
    !u.wounded &&
    source === 'bullet' &&
    u.injuryCooldown <= 0 &&
    u.hp <= u.maxHp * 0.55
  ) {
    s.injurySeed = (Math.imul(1664525, s.injurySeed) + 1013904223) >>> 0;
    if (s.injurySeed / 4294967296 < Math.min(0.35, (0.9 * actual) / u.maxHp)) {
      u.woundedFromPose = u.pose;
      u.wounded = true;
      u.woundedTime = 0;
      u.bleedOut = 25;
      u.woundedBy = side;
      u.rescueProgress = 0;
      u.fire = 0;
      u.secondaryFire = 0;
      u.moving = false;
      u.climbing = 0;
      u.motion = 'ground';
      u.coverGoal = null;
      u.pose = 'prone';
      u.y = ground(s, u.x);
      notify(
        s,
        `${u.side === 0 ? '我方' : '敌方'}${c.name}有队员倒地待救`,
        'info',
        ([0, 1] as Side[]).filter((side) => visibleToSide(s, side, u)),
      );
    }
  }
}
function finishDeath(s: GameState, u: Unit, side: Side) {
  if (u.destroyed) return;
  u.destroyed = true;
  u.hp = 0;
  u.wounded = false;
  u.deadFor = 0;
  u.moving = false;
  u.fire = 0;
  u.secondaryFire = 0;
  if (side !== u.side) s.players[side].kills++;
  for (const friend of s.units)
    if (friend !== u && friend.squad === u.squad && isCombatant(friend)) {
      friend.personalMorale = Math.max(0, friend.personalMorale - 9);
      friend.decisionIn = 0;
    }
  const c = CARDS[u.id];
  s.wrecks.push({
    id: u.uid,
    cardId: u.id,
    side: u.side,
    pose: u.pose,
    facing: u.facing,
    lane: u.lane,
    x: u.x,
    y: u.y,
    angle: u.hullAngle,
    age: 0,
    falling: !!c.air,
    vx: c.air ? u.facing * 70 : 0,
    vy: 0,
  });
  if (!c.members && !c.air)
    burst(s, u.x, u.y - 20, c.armored ? 60 : 42, 'wreck');
  else if (c.air) burst(s, u.x, u.y - 20, c.oneWay ? 12 : 24, 'air');
  settleSortie(s, u, false);
}
function settleSortie(s: GameState, u: Unit, success: boolean) {
  const token = u.sortieCard;
  if (!token) return;
  u.sortieCard = null;
  token.returnedOnce = success;
  token.readyAt = s.time + (CARDS[u.id].sortieCooldown ?? 18);
  const p = s.players[u.side];
  if (success && p.hand.length < MAX_HAND) p.hand.push(token);
  else p.discard.push(token);
  if (success)
    notify(
      s,
      `${CARDS[u.id].name}返航${p.hand.includes(token) ? '回手' : '，手牌已满转入弃牌'}，补给后可低费派遣`,
      'info',
      [u.side],
    );
}
function revive(u: Unit) {
  u.wounded = false;
  u.woundedTime = 0;
  u.bleedOut = 0;
  u.rescueProgress = 0;
  u.injuryCooldown = 4;
  u.hp = Math.max(u.hp, u.maxHp * 0.4);
  u.personalMorale = Math.max(55, u.personalMorale);
  u.suppression = 20;
  u.cooldown = Math.max(1.2, u.cooldown);
  u.tactic = 'crouch';
  u.pose = 'crouch';
  u.decisionIn = 1.5;
  u.retreatUntil = 0;
}
export function explode(
  s: GameState,
  x: number,
  y: number,
  radius: number,
  damage: number,
  side: Side,
  baseScale = 1,
  armorMultiplier = 1,
  kind: Blast['kind'] = 'he',
  infantryMultiplier = 1,
) {
  burst(s, x, y, radius, kind);
  const sheltered = new Set(
    s.units
      .filter(
        (u) =>
          CARDS[u.id].members &&
          sceneryIntercept(s, x, y, u.x, u.y - 20, false, true),
      )
      .map((u) => u.uid),
  );
  damageScenery(s, x, y, radius, damage);
  s.visionIn = 0;
  for (const wall of s.walls) {
    if (
      wall.hp > 0 &&
      Math.hypot(wall.x - x, ground(s, wall.x) - wall.height / 2 - y) <
        radius + wall.width / 2
    )
      wall.hp = Math.max(0, wall.hp - damage);
  }
  // Blast reach and the excavated soil footprint are deliberately separate.
  if (y > ground(s, x) - 80) {
    const small = kind === 'grenade';
    const soilRadius = Math.min(small ? 15 : 44, radius * (small ? 0.4 : 0.8));
    crater(
      s,
      x,
      soilRadius,
      Math.min(small ? 3.5 : 10, radius * (small ? 0.1 : 0.18)),
    );
  }
  for (const u of s.units) {
    if (u.side === side || !canTakeDamage(u)) continue;
    let dist = Math.hypot(
      u.x - x,
      u.y - (CARDS[u.id].air ? bodyHeight(u) : 20) - y,
    );
    if (CARDS[u.id].armored || CARDS[u.id].vehicle) {
      // Measure from the hull, including when tracks bridge a crater.
      const dx = x - u.x,
        dy = y - u.y,
        cos = Math.cos(u.hullAngle),
        sin = Math.sin(u.hullAngle),
        localX = dx * cos + dy * sin,
        localY = -dx * sin + dy * cos,
        half = armorHalf(u.id);
      dist = Math.hypot(
        Math.max(0, Math.abs(localX) - half),
        Math.max(0, localY, -armorHeight(u.id) - localY),
      );
    }
    if (dist < radius + 12)
      hitUnit(
        s,
        u,
        damage *
          Math.pow(Math.max(0, 1 - dist / (radius + 12)), 1.25) *
          (CARDS[u.id].armored
            ? armorMultiplier
            : CARDS[u.id].members
              ? infantryMultiplier
              : 1),
        // Weapon modifiers apply to each victim, never to the selected target alone.
        side,
        sheltered.has(u.uid) ? 0.65 : 0,
        'blast',
      );
  }
  for (const target of [0, 1] as Side[]) {
    if (target === side) continue;
    const bx = target === 0 ? 70 : W - 70;
    if (Math.hypot(bx - x, ground(s, bx) - 20 - y) < radius + 40)
      s.players[target].hp = Math.max(
        0,
        s.players[target].hp - damage * baseScale,
      );
  }
}
export function craterCover(s: GameState, x: number, threatX: number) {
  const y = ground(s, x),
    depth = y - s.original[Math.max(0, Math.min(W - 1, Math.floor(x)))];
  const debris = Math.max(debrisCover(s, x, threatX), trenchProtection(s, x));
  if (depth < 6) return debris;
  const dir = threatX >= x ? 1 : -1;
  let lip = y;
  for (let d = 8; d <= 60; d += 2) lip = Math.min(lip, ground(s, x + dir * d));
  return Math.max(debris, Math.max(0, Math.min(1, (y - lip - 4) / 15)));
}
export function terrainIntercept(
  s: GameState,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
  ignoreSoftCover = false,
  ignoreAllCover = false,
) {
  const prop = ignoreAllCover
    ? null
    : sceneryIntercept(s, sx, sy, tx, ty, false, false, ignoreSoftCover);
  const steps = Math.max(1, Math.ceil(Math.abs(tx - sx) / 2));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps,
      x = sx + (tx - sx) * t,
      y = sy + (ty - sy) * t;
    if (y >= ground(s, x) - 1)
      return prop && prop.t < t
        ? { x: prop.x, y: prop.y }
        : { x, y: ground(s, x) - 1 };
  }
  return prop ? { x: prop.x, y: prop.y } : null;
}
export function projectileIntercept(
  s: GameState,
  p: Projectile,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
) {
  // Indirect shells clear nearby scenery throughout the ascent to their apex.
  // Ground is still solid, and buildings/trees intercept the descending shell.
  const progress = 1 - Math.max(0, p.life) / p.total;
  const rising = p.ty - p.startY - 4 * (p.arc ?? 0) * (1 - 2 * progress) < 0;
  if ((p.shell && rising) || (p.topAttack && ty < sy))
    return terrainIntercept(s, sx, sy, tx, ty, true, true);
  if (!isCoverBullet(p.ammunition ?? (p.radius ? 'cannon' : 'rifle')))
    return terrainIntercept(s, sx, sy, tx, ty);
  const hardHit = terrainIntercept(s, sx, sy, tx, ty, true);
  const hardDistance = hardHit
    ? Math.hypot(hardHit.x - sx, hardHit.y - sy)
    : Infinity;
  for (const hit of sceneryCoverHits(s, sx, sy, tx, ty)) {
    if (Math.hypot(hit.x - sx, hit.y - sy) >= hardDistance) break;
    if (p.passedCover?.includes(hit.id)) continue;
    (p.passedCover ??= []).push(hit.id);
    // A projectile rolls once per whole prop, independent of frame rate and wall pieces.
    if (rnd(s) < 0.5) return { x: hit.x, y: hit.y };
  }
  return hardHit;
}
function retreatingFriendlyHit(
  s: GameState,
  p: Projectile,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
) {
  if (p.radius || p.missed || p.damage <= 0 || p.sourceUid === undefined)
    return null;
  let nearest: { u: Unit; t: number; x: number; y: number } | null = null;
  for (const u of s.units) {
    if (
      u.uid === p.sourceUid ||
      u.side !== p.side ||
      u.tactic !== 'retreat' ||
      !canTakeDamage(u) ||
      !CARDS[u.id].members
    )
      continue;
    const height =
      u.wounded || u.pose === 'prone' ? 14 : u.pose === 'crouch' ? 32 : 56;
    let near = 0,
      far = 1;
    for (const [start, delta, min, max] of [
      [sx, tx - sx, u.x - 5, u.x + 5],
      [sy, ty - sy, u.y - height, u.y - 3],
    ]) {
      if (Math.abs(delta) < 1e-8) {
        if (start < min || start > max) {
          near = 2;
          break;
        }
      } else {
        const a = (min - start) / delta,
          b = (max - start) / delta;
        near = Math.max(near, Math.min(a, b));
        far = Math.min(far, Math.max(a, b));
      }
    }
    if (near <= far && near >= 0 && near <= 1 && (!nearest || near < nearest.t))
      nearest = {
        u,
        t: near,
        x: sx + (tx - sx) * near,
        y: sy + (ty - sy) * near,
      };
  }
  return nearest;
}
type MuzzleBody = Pick<
  Unit,
  'id' | 'x' | 'y' | 'pose' | 'moving' | 'hullAngle'
>;
type FiringBody = MuzzleBody & Pick<Unit, 'side' | 'member'>;
export function muzzleOffset(u: MuzzleBody) {
  if (CARDS[u.id].members && modelOf(u.id) !== 'mortar')
    return infantryGeometry(u).muzzleX;
  const tank = tankGeometry(u.id);
  if (tank) return tank.muzzleX;
  if (CARDS[u.id].emplacement)
    return CARDS[u.id].emplacement === 'aa_gun' ? 45 : 90;
  if (CARDS[u.id].airframe)
    return CARDS[u.id].airframe === 'rocket_heli'
      ? 72
      : CARDS[u.id].airframe === 'interceptor'
        ? 75
        : 20;
  return modelOf(u.id) === 'tank'
    ? 88
    : modelOf(u.id) === 'ifv'
      ? 65
      : CARDS[u.id].air
        ? 90
        : modelOf(u.id) === 'mortar'
          ? 12
          : 18;
}
export function muzzleHeight(u: MuzzleBody) {
  if (CARDS[u.id].members && modelOf(u.id) !== 'mortar')
    return infantryGeometry(u).muzzleHeight;
  const tank = tankGeometry(u.id);
  if (tank) return tank.muzzleY;
  if (CARDS[u.id].emplacement)
    return CARDS[u.id].emplacement === 'aa_gun'
      ? 92
      : CARDS[u.id].emplacement === 'at_gun'
        ? 30
        : 60;
  return CARDS[u.id].air
    ? 16
    : modelOf(u.id) === 'mortar'
      ? 30
      : modelOf(u.id) === 'tank'
        ? 54
        : modelOf(u.id) === 'ifv'
          ? 42
          : u.pose === 'prone'
            ? 9
            : u.pose === 'crouch' || u.pose === 'land'
              ? 28
              : 47;
}
export function muzzlePoint(
  u: MuzzleBody,
  tx: number,
  height = muzzleHeight(u),
  coax = false,
) {
  const tank = tankGeometry(u.id);
  const dx =
      Math.sign(tx - u.x) * (coax ? (tank?.coaxX ?? 58) : muzzleOffset(u)),
    dy = -(coax ? (tank?.coaxY ?? height) : height);
  const angle = CARDS[u.id].armored || CARDS[u.id].vehicle ? u.hullAngle : 0,
    c = Math.cos(angle),
    sn = Math.sin(angle);
  return { x: u.x + dx * c - dy * sn, y: u.y + dx * sn + dy * c };
}
function bodyHeight(
  u: Pick<Unit, 'pose'> & Partial<Pick<Unit, 'id' | 'moving'>>,
) {
  if (u.id && CARDS[u.id].members) return infantryGeometry(u).bodyHeight;
  if (u.id && (CARDS[u.id].armored || CARDS[u.id].vehicle))
    return armorHeight(u.id) * 0.55;
  return u.pose === 'prone'
    ? 7
    : u.pose === 'crouch' || u.pose === 'land'
      ? 18
      : 27;
}
export function unitRange(s: GameState, u: Unit) {
  return (
    weaponCard(u).range! *
    (CARDS[u.id].infantryAbility === 'mountain_fire' &&
    !u.moving &&
    u.motion === 'ground' &&
    (u.stillFor ?? 0) >= 0.65 &&
    craterCover(s, u.x, u.lastThreat?.x ?? u.x + u.facing * 400) > 0.2
      ? 1.25
      : 1) *
    (s.players[u.side].recon > 0 ? 1.2 : droneRecon(s, u.side, u.x) ? 1.1 : 1)
  );
}
export function droneRecon(s: GameState, side: Side, x: number) {
  return (
    s.players[side].jam <= 0 &&
    s.units.some(
      (u) =>
        u.side === side &&
        CARDS[u.id].observer &&
        isCombatant(u) &&
        Math.abs(u.x - x) <= 650,
    )
  );
}
export function smokeBlocks(s: GameState, side: Side, sx: number, tx: number) {
  if (
    s.players[side].recon > 0 ||
    droneRecon(s, side, sx) ||
    Math.abs(tx - sx) <= 140
  )
    return false;
  const left = Math.min(sx, tx),
    right = Math.max(sx, tx);
  return s.smokes.some(
    (f) => f.life > 0 && f.x + 95 > left && f.x - 95 < right,
  );
}
function firingHeight(
  s: GameState,
  u: FiringBody,
  tx: number,
  ty: number,
): number | null {
  const c = CARDS[u.id],
    height = muzzleHeight(u);
  if (c.indirect) return height;
  if (smokeBlocks(s, u.side, u.x, tx)) return null;
  const softCover = isCoverBullet(ammunition(u.id, u.member));
  const clear = (shooter: MuzzleBody, h: number) => {
    const point = muzzlePoint(shooter, tx, h);
    // A long prone barrel cannot start a projectile inside or beyond a nearby wall.
    if (
      c.members &&
      terrainIntercept(s, shooter.x, shooter.y - h, point.x, point.y, softCover)
    )
      return false;
    return (
      u.id === 'javelin' ||
      !terrainIntercept(s, point.x, point.y, tx, ty, softCover)
    );
  };
  if (clear(u, height)) return height;
  // Check both the standing height and its shorter barrel before rising to fire.
  if (
    c.members &&
    clear(
      {
        id: u.id,
        x: u.x,
        y: u.y,
        hullAngle: u.hullAngle,
        pose: 'idle',
        moving: false,
      },
      47,
    )
  )
    return 47;
  return null;
}

type CoverTarget = Pick<Unit, 'x' | 'y'> &
  Partial<Pick<Unit, 'pose' | 'id' | 'moving'>>;
function canFireFromCover(
  s: GameState,
  u: Unit,
  x: number,
  target: CoverTarget,
) {
  return (
    firingHeight(
      s,
      {
        id: u.id,
        side: u.side,
        member: u.member,
        x,
        y: ground(s, x),
        hullAngle: u.hullAngle,
        pose: 'idle',
        moving: u.moving,
      },
      target.x,
      target.y -
        bodyHeight({
          id: target.id,
          moving: target.moving,
          pose: target.pose ?? 'prone',
        }),
    ) !== null
  );
}
function seekCover(s: GameState, u: Unit, target: CoverTarget) {
  let best: number | null = null,
    score = 0;
  // Every rifleman can use nearby shelter; designated cover/scout roles search farther.
  const reach =
    CARDS[u.id].trait === 'scout' ? 120 : u.tactic === 'cover' ? 58 : 32;
  for (
    let x = Math.max(125, u.x - reach);
    x <= Math.min(W - 125, u.x + reach);
    x += 4
  ) {
    if (Math.abs(target.x - x) > unitRange(s, u)) continue;
    const cover = craterCover(s, x, target.x);
    if (
      cover < 0.25 ||
      obstacleBoxes(s).some(
        (b) =>
          !b.foliage &&
          x > b.x - (b.rubble ? 2 : 10) &&
          x < b.x + b.w + (b.rubble ? 2 : 10),
      )
    )
      continue;
    if (!canFireFromCover(s, u, x, target)) continue;
    if (
      s.units.some(
        (v) =>
          v !== u &&
          v.side === u.side &&
          isCombatant(v) &&
          CARDS[v.id].members &&
          Math.abs(v.lane - u.lane) < 5 &&
          [v.x, v.coverGoal, v.firingGoal].some(
            (reserved) => reserved != null && Math.abs(reserved - x) < 26,
          ),
      )
    )
      continue;
    const value = cover * 50 - Math.abs(x - u.x) * 0.4;
    if (value > score) {
      score = value;
      best = x;
    }
  }
  return best;
}
function coveringMate(
  s: GameState,
  u: Unit,
  target: Unit,
  requireShot = false,
) {
  return s.units.some((v) => {
    if (v === u || v.side !== u.side || v.squad !== u.squad || !isCombatant(v))
      return false;
    const c = weaponCard(v);
    if (
      !c.members ||
      c.indirect ||
      v.moving ||
      v.motion !== 'ground' ||
      v.climbing > 0 ||
      v.tactic === 'retreat' ||
      (v.coverGoal !== null && Math.abs(v.coverGoal - v.x) > 0.5) ||
      (v.firingGoal != null && Math.abs(v.firingGoal - v.x) > 0.5) ||
      v.evadeUntil > s.time
    )
      return false;
    const distance = Math.abs(v.x - target.x);
    return (
      distance <= unitRange(s, v) &&
      distance >= (c.minRange ?? 0) &&
      visibleToSide(s, v.side, target) &&
      firingHeight(s, v, target.x, target.y - bodyHeight(target)) !== null &&
      ((!requireShot && v.cooldown <= 0) ||
        s.time - (v.lastCombatShotAt ?? -Infinity) <=
          Math.max(0.8, c.rate! * 1.35))
    );
  });
}

function nearbyFiringPosition(s: GameState, u: Unit, target: CoverTarget) {
  const range = unitRange(s, u),
    currentDistance = Math.abs(target.x - u.x);
  // Reposition around this contact; never turn an obstructed ray into an unlimited charge.
  const insideCover = obstacleBoxes(s).some(
    (b) => !b.foliage && u.x > b.x - 16 && u.x < b.x + b.w + 16,
  );
  const minimumDistance = Math.min(
    range * (insideCover ? 0.38 : 0.62),
    currentDistance,
  );
  let best: number | null = null,
    bestScore = -Infinity;
  const edges = obstacleBoxes(s)
    .flatMap((box) => [box.x - 12 - u.x, box.x + box.w + 12 - u.x])
    .filter((offset) => Math.abs(offset) > 64 && Math.abs(offset) <= 320);
  for (const offset of [-64, -48, -32, -16, -8, 8, 16, 32, 48, 64, ...edges]) {
    const x = u.x + offset,
      distance = Math.abs(target.x - x);
    if (
      x < 125 ||
      x > W - 125 ||
      distance < minimumDistance ||
      distance > range
    )
      continue;
    if (
      obstacleBoxes(s).some(
        (b) => !b.foliage && x > b.x - 10 && x < b.x + b.w + 10,
      )
    )
      continue;
    if (
      s.units.some(
        (v) =>
          v !== u &&
          v.side === u.side &&
          isCombatant(v) &&
          CARDS[v.id].members &&
          Math.abs(v.lane - u.lane) < 5 &&
          [v.x, v.coverGoal, v.firingGoal].some(
            (reserved) => reserved != null && Math.abs(reserved - x) < 26,
          ),
      )
    )
      continue;
    if (!canFireFromCover(s, u, x, target)) continue;
    const score = craterCover(s, x, target.x) * 20 - Math.abs(offset);
    if (score > bestScore) {
      bestScore = score;
      best = x;
    }
  }
  return best;
}

function enemyCoverShot(s: GameState, u: Unit, target: Unit | undefined) {
  const c = weaponCard(u);
  if (
    !target ||
    !c.members ||
    c.indirect ||
    !c.radius ||
    ammunition(u.id, u.member) !== 'rocket' ||
    u.id === 'javelin' ||
    CARDS[target.id].air ||
    !visibleToSide(s, u.side, target) ||
    smokeBlocks(s, u.side, u.x, target.x)
  )
    return null;
  const standing = { ...u, pose: 'idle' as const, moving: false };
  const point = muzzlePoint(standing, target.x, 47),
    ty = target.y - bodyHeight(target);
  if (terrainIntercept(s, u.x, u.y - 47, point.x, point.y)) return null;
  const hit = sceneryIntercept(s, point.x, point.y, target.x, ty);
  if (!hit?.box.prop || hit.box.rubble) return null;
  const first = terrainIntercept(s, point.x, point.y, target.x, ty);
  if (!first || Math.hypot(first.x - hit.x, first.y - hit.y) > 3) return null;
  const distance = Math.abs(target.x - u.x),
    toEnemy = Math.abs(target.x - hit.x);
  // Only attack an enemy-side obstruction. Do not shell the squad's own nearby shelter.
  if (
    toEnemy > Math.min(230, distance * 0.65) ||
    Math.abs(hit.x - u.x) < Math.max(120, c.radius * 2.5)
  )
    return null;
  if (
    s.units.some(
      (v) =>
        v.side === u.side &&
        canTakeDamage(v) &&
        Math.hypot(v.x - hit.x, v.y - 20 - hit.y) < c.radius! + 45,
    )
  )
    return null;
  if (u.breachPropId === hit.box.prop.id && (u.breachShots ?? 0) >= 2)
    return null;
  return { x: hit.x, y: hit.y, propId: hit.box.prop.id };
}

function beginDrop(u: Unit, dir: number, speed: number, falling = false) {
  u.motion = 'jump';
  u.motionTime = 0;
  u.motionDuration = 0.6;
  u.vx = dir * Math.min(45, speed);
  u.vy = falling ? 0 : -18;
  u.motionFromY = u.y;
  u.pose = 'jump';
  u.cover = 0;
}
function traverse(s: GameState, u: Unit, dt: number) {
  if (u.motion === 'ground') return false;
  u.motionTime += dt;
  u.moving = true;
  u.cover = 0;
  if (u.motion === 'jump') {
    u.pose = 'jump';
    u.x = Math.max(55, Math.min(W - 55, u.x + u.vx * dt));
    u.vy += 430 * dt;
    u.y += u.vy * dt;
    if (u.vy > 0 && u.y >= ground(s, u.x)) {
      u.y = ground(s, u.x);
      u.motion = 'land';
      u.motionTime = 0;
      u.motionDuration = 0.22;
      u.pose = 'land';
      u.vy = 0;
      u.stepCooldown = 0.6;
    }
  } else if (u.motion === 'land') {
    u.pose = 'land';
    u.y = ground(s, u.x);
    if (u.motionTime >= u.motionDuration) u.motion = 'ground';
  } else {
    u.pose = 'climb';
    const t = Math.min(1, u.motionTime / u.motionDuration),
      ease = t * t * (3 - 2 * t);
    u.x = u.motionFromX + (u.motionToX - u.motionFromX) * ease;
    u.y = ground(s, u.x) - Math.sin(t * Math.PI) * (u.motionLift ?? 4);
    if (t >= 1) {
      u.motion = 'ground';
      u.y = ground(s, u.x);
      u.stepCooldown = 0.6;
      u.motionLift = 0;
    }
  }
  return true;
}
/** Squad orders remain local; an attack still allows sensible use of cover. */
function infantryOrder(s: GameState, u: Unit): Order {
  if (u.squadOrder && (u.squadOrderUntil ?? Infinity) > s.time) {
    if (u.squadOrder === 'hold' || u.squadOrder === 'watch') return 'hold';
    return 'advance';
  }
  return s.players[u.side].order;
}
function orderedWithdrawal(s: GameState, u: Unit) {
  return (
    u.squadOrder === 'retreat' &&
    (u.squadOrderUntil ?? Infinity) > s.time &&
    u.squadOrderX !== undefined
  );
}
function moveSoldier(
  s: GameState,
  u: Unit,
  dir: number,
  speed: number,
  dt: number,
  mayTraverse = true,
) {
  if (!dir || speed <= 0) return;
  u.facing = dir;
  const y = ground(s, u.x),
    ahead = ground(s, u.x + dir * 24);
  const depth = y - s.original[Math.floor(u.x)];
  const aheadDepth =
    ahead -
    s.original[Math.max(0, Math.min(W - 1, Math.floor(u.x + dir * 24)))];
  if (
    u.stepCooldown <= 0 &&
    aheadDepth >= DROP_HEIGHT &&
    ahead - y >= DROP_HEIGHT &&
    depth < 12
  ) {
    if (mayTraverse) beginDrop(u, dir, speed);
    return;
  }
  if (
    u.stepCooldown <= 0 &&
    depth >= CLIMB_HEIGHT &&
    y - ahead >= CLIMB_HEIGHT
  ) {
    if (!mayTraverse) return;
    let destination = u.x + dir * 12;
    for (let d = 12; d <= 52; d += 2) {
      destination = Math.max(125, Math.min(W - 125, u.x + dir * d));
      if (ground(s, destination) - s.original[Math.floor(destination)] < 3)
        break;
    }
    const goal = u.coverGoal ?? u.firingGoal;
    if (
      goal != null &&
      (goal - u.x) * dir > 0 &&
      (destination - goal) * dir > 0
    )
      destination = goal;
    u.motion = 'bank';
    u.motionTime = 0;
    u.motionDuration = CARDS[u.id].trait === 'mountain' ? 0.5 : 0.8;
    u.motionFromX = u.x;
    u.motionFromY = u.y;
    u.motionToX = destination;
    u.motionToY = ground(s, destination);
    u.motionLift = 4;
    u.pose = 'climb';
    return;
  }
  const wall = s.walls.find(
    (w) =>
      w.hp > 0 &&
      (w.x - u.x) * dir >= w.width / 2 + 5 &&
      Math.abs(w.x - u.x) < w.width / 2 + 14,
  );
  if (wall) {
    if (!mayTraverse) return;
    if (CARDS[u.id].trait === 'engineer') {
      u.pose = 'crouch';
      if (u.supportCooldown <= 0) {
        wall.hp = Math.max(0, wall.hp - 70);
        u.supportCooldown = 1.2;
        burst(s, wall.x, ground(s, wall.x) - 8, 10);
      }
      return;
    }
    u.climbDuration = CARDS[u.id].trait === 'mountain' ? 0.65 : 1.2;
    u.climbing = u.climbDuration;
    u.climbFrom = u.x;
    u.motionToX = wall.x + dir * (wall.width / 2 + 10);
    u.climbWall = wall.uid;
    u.pose = 'climb';
    return;
  }
  const neighbors = s.units.filter(
    (v) =>
      v !== u &&
      v.side === u.side &&
      isCombatant(v) &&
      CARDS[v.id].members &&
      Math.abs(v.x - u.x) < 72,
  );
  const nearestBlocker = () =>
    neighbors
      .filter(
        (v) =>
          v.facing === dir &&
          Math.abs(v.lane - u.lane) < 4 &&
          (v.x - u.x) * dir > 0,
      )
      .sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0];
  const flow = (v: Unit | undefined) =>
    v ? Math.max(0, Math.min(1, (Math.abs(v.x - u.x) - 24) / 12)) : 1;
  const laneFree = (lane: number) =>
    !neighbors.some(
      (v) => Math.abs(v.x - u.x) < 36 && Math.abs(v.lane - lane) < 4,
    );
  const blocker = nearestBlocker();
  u.trafficWait =
    blocker && flow(blocker) < 0.35 ? (u.trafficWait ?? 0) + dt : 0;
  if (u.passingLane === undefined && u.trafficWait > 0.4) {
    const preferred = u.uid % 2 ? 1 : -1;
    const lanes = [6, -6, 12, -12, 18, -18, 24, -24].map((offset) =>
      Math.max(-24, Math.min(24, u.lane + preferred * offset)),
    );
    u.passingLane = lanes.find(laneFree);
    // A dense front rank is not a solid wall: use a neighboring depth passage.
    if (u.trafficWait > 0.75 && u.passingLane === undefined) {
      u.passingLane = lanes.sort(
        (a, b) =>
          neighbors.filter((v) => Math.abs(v.lane - a) < 4).length -
          neighbors.filter((v) => Math.abs(v.lane - b) < 4).length,
      )[0];
    }
  }
  const beforeLane = u.lane;
  if (u.passingLane !== undefined) {
    if (!laneFree(u.passingLane) && (u.trafficWait ?? 0) <= 0.75)
      u.passingLane = undefined;
    else {
      const change = u.passingLane - u.lane;
      u.lane += Math.max(-12 * dt, Math.min(12 * dt, change));
      if (Math.abs(change) <= 12 * dt) {
        u.lane = u.passingLane;
        u.passingLane = undefined;
        u.trafficWait = 0;
      }
    }
  }
  if ((u.trafficWait ?? 0) > 0.75) u.trafficYieldUntil = s.time + 1.8;
  const passage = (u.trafficYieldUntil ?? 0) > s.time ? 0.55 : 0;
  speed *= Math.max(passage, flow(nearestBlocker()));
  const beforeX = u.x;
  u.facing = dir;
  u.x = Math.max(55, Math.min(W - 55, u.x + dir * speed * dt));
  const distance = Math.hypot(u.x - beforeX, u.lane - beforeLane);
  // Gait advances by travelled distance so feet stop when the soldier stops.
  u.walk += distance / (u.pose === 'prone' ? 4 : 6);
  u.y = ground(s, u.x);
  u.moving = distance > 0.001;
}
export function isCombatant(u: Unit) {
  return u.hp > 0 && !u.surrendered && !u.wounded;
}
export function canTakeDamage(u: Unit) {
  return u.hp > 0 && !u.surrendered;
}
export function vehicleContact(s: GameState, x: number, id: CardId) {
  const half = armorHalf(id);
  const left = ground(s, x - half),
    right = ground(s, x + half);
  const slope = Math.max(-0.18, Math.min(0.18, (right - left) / (half * 2)));
  let y = (left + right) / 2;
  for (let i = -half; i <= half; i++)
    y = Math.min(y, ground(s, x + i) - slope * i);
  return { y, angle: Math.atan(slope) };
}
const roles: Record<Doctrine, Unit['tactic'][]> = {
  balanced: ['prone', 'cover', 'crouch', 'bound', 'cover', 'bound'],
  assault: ['bound', 'cover', 'crouch', 'bound', 'prone', 'bound'],
  defensive: ['prone', 'crouch', 'cover', 'prone', 'cover', 'crouch'],
  recon: ['prone', 'cover', 'bound', 'cover'],
  support: ['prone', 'crouch', 'cover', 'crouch', 'prone'],
  irregular: ['crouch', 'cover', 'prone', 'bound'],
  elite: ['bound', 'cover', 'bound', 'prone'],
};
function planWithdrawal(s: GameState, u: Unit, threat: Unit) {
  const order = infantryOrder(s, u);
  if (
    order === 'hold' ||
    order === 'rush' ||
    CARDS[u.id].indirect ||
    CARDS[u.id].airOnly ||
    s.time < (u.withdrawNextAt ?? 0) ||
    Math.abs(threat.x - u.x) > Math.min(560, unitRange(s, u))
  )
    return;
  const fighters = s.units.filter(
    (v) =>
      isCombatant(v) &&
      !CARDS[v.id].air &&
      !weaponCard(v).airOnly &&
      v.tactic !== 'retreat' &&
      (!CARDS[v.id].members || v.personalMorale >= 35),
  );
  const friends = fighters.filter(
    (v) => v.side === u.side && Math.abs(v.x - u.x) <= 260,
  );
  const foes = fighters.filter(
    (v) =>
      v.side !== u.side &&
      visibleToSide(s, u.side, v) &&
      Math.abs(v.x - u.x) <= Math.min(560, unitRange(s, v) + 80),
  );
  const armor = foes.filter((v) => CARDS[v.id].armored);
  const armorValue = armor.length
    ? armor.reduce((sum, v) => sum + CARDS[v.id].cost, 0) / armor.length
    : 0;
  const strength = (v: Unit, friendly: boolean) => {
    let value = CARDS[v.id].cost / (CARDS[v.id].members ?? 1);
    const weapon = weaponCard(v);
    // A covered RPG/Javelin team exists to fight armor, not flee its card-price tag.
    if (
      friendly &&
      (weapon.armorMultiplier ?? 1) > 1.2 &&
      armor.some((enemy) => {
        const distance = Math.abs(enemy.x - v.x);
        return (
          distance <= unitRange(s, v) && distance >= (weapon.minRange ?? 0)
        );
      })
    )
      value = Math.max(value, armorValue * 0.6);
    return value * Math.max(0.25, Math.min(1, v.hp / v.maxHp));
  };
  const friendlyPower = friends.reduce((n, v) => n + strength(v, true), 0),
    enemyPower = foes.reduce((n, v) => n + strength(v, false), 0);
  if (enemyPower < Math.max(1.5, friendlyPower * 2.1)) return;
  const squad = friends
    .filter(
      (v) =>
        v.squad === u.squad &&
        CARDS[v.id].members &&
        !CARDS[v.id].indirect &&
        infantryOrder(s, v) !== 'hold' &&
        !orderedWithdrawal(s, v),
    )
    .sort((a, b) => a.uid - b.uid);
  const away = Math.sign(u.x - threat.x) || (u.side === 0 ? -1 : 1);
  for (const [index, mate] of squad.entries()) {
    mate.withdrawStartedAt = s.time;
    mate.withdrawUntil = s.time + 4.8;
    mate.withdrawNextAt = s.time + 10;
    mate.withdrawGroup = index % 2;
    mate.withdrawGoal = Math.max(80, Math.min(W - 80, mate.x + away * 72));
    mate.coverGoal = null;
    mate.firingGoal = null;
  }
}

function prepareInfantry(s: GameState, u: Unit, dt: number) {
  const c = CARDS[u.id];
  if (orderedWithdrawal(s, u)) {
    if (u.withdrawGoal !== u.squadOrderX) {
      u.withdrawStartedAt = s.time;
      u.withdrawGroup = u.member % 2;
    }
    u.withdrawUntil = s.time + 1;
    u.withdrawGoal = u.squadOrderX;
    u.coverGoal = null;
    u.firingGoal = null;
    u.dispersionGoal = undefined;
    // A commanded fallback is not a morale rout and cannot cause friendly conflict.
    if (u.tactic === 'retreat') u.tactic = 'crouch';
  } else if (infantryOrder(s, u) === 'hold') {
    u.withdrawUntil = 0;
    u.coverGoal = null;
    u.firingGoal = null;
    u.dispersionGoal = undefined;
  }
  const settled = !u.moving && u.motion === 'ground' && u.climbing <= 0;
  u.stillFor = settled ? (u.stillFor ?? 0) + dt : 0;
  u.ambushFor =
    settled && u.fire <= 0 && s.time - (u.lastCombatShotAt ?? -Infinity) > 0.3
      ? (u.ambushFor ?? 0) + dt
      : 0;
  if (
    c.infantryAbility === 'buddy_rally' &&
    !u.buddyRallied &&
    s.units.some(
      (v) =>
        v !== u &&
        v.squad === u.squad &&
        v.side === u.side &&
        v.hp > 0 &&
        (v.wounded || v.hp < v.maxHp * 0.5) &&
        Math.abs(v.x - u.x) <= 96,
    )
  ) {
    for (const mate of s.units.filter(
      (v) => v.side === u.side && v.squad === u.squad,
    )) {
      mate.buddyRallied = true;
      if (isCombatant(mate) && Math.abs(mate.x - u.x) <= 96) {
        mate.personalMorale = Math.max(
          mate.personalMorale,
          Math.min(CARDS[mate.id].discipline ?? 80, mate.personalMorale + 10),
        );
        mate.suppression = Math.max(0, mate.suppression - 15);
      }
    }
  }
  if (
    c.trait === 'engineer' &&
    u.motion === 'ground' &&
    u.climbing <= 0 &&
    u.supportCooldown <= 0
  ) {
    const mine = s.mines.find(
      (m) => m.side !== u.side && Math.abs(m.x - u.x) <= 36,
    );
    if (mine) {
      s.mines = s.mines.filter((m) => m !== mine);
      u.supportCooldown = 1.2;
    }
  }
}

function decideTactic(s: GameState, u: Unit, dt: number) {
  u.decisionIn -= dt;
  const quickContact =
    u.tactic === 'advance' && (u.contactScanAt ?? 0) <= s.time;
  if (u.decisionIn > 0 && !quickContact) return;
  u.contactScanAt = s.time + 0.09 + (u.uid % 3) * 0.015;
  const c = CARDS[u.id];
  const threat = s.units
    .filter(
      (v) =>
        v.side !== u.side &&
        isCombatant(v) &&
        visibleToSide(s, u.side, v) &&
        !CARDS[v.id].air,
    )
    .sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0];
  const inContact =
    !!threat &&
    Math.abs(threat.x - u.x) <=
      Math.max(unitRange(s, u), Math.min(560, unitRange(s, threat) + 40));
  const newContact = inContact && (u.contactUntil ?? 0) <= s.time;
  if (inContact) {
    u.contactUid = threat.uid;
    u.contactUntil = s.time + 1.2;
  }
  const reactNow = newContact && u.tactic === 'advance';
  if (!reactNow && u.decisionIn > 0) return;
  u.decisionIn = 1.1 + (u.member % 4) * 0.18;
  if (
    reactNow &&
    infantryOrder(s, u) !== 'hold' &&
    infantryOrder(s, u) !== 'rush' &&
    !orderedWithdrawal(s, u) &&
    !c.indirect &&
    u.member % 3 !== 0 &&
    s.units.some(
      (v) =>
        v !== u &&
        v.side === u.side &&
        isCombatant(v) &&
        CARDS[v.id].members &&
        Math.abs(v.x - u.x) < 30 &&
        Math.abs(v.lane - u.lane) < 8,
    )
  ) {
    const away = Math.sign(u.x - threat.x) || (u.side === 0 ? -1 : 1);
    u.dispersionGoal = Math.max(
      80,
      Math.min(W - 80, u.x + away * (14 + (u.uid % 3) * 5)),
    );
    u.dispersionUntil = s.time + 2.5;
    u.passingLane = Math.max(
      -24,
      Math.min(24, u.lane + (u.uid % 2 ? 1 : -1) * 8),
    );
  }
  const survivors = s.units.filter(
    (v) => v.squad === u.squad && isCombatant(v),
  ).length;
  if (
    !c.neverSurrender &&
    u.personalMorale < 18 &&
    survivors <= 2 &&
    u.hp / u.maxHp < 0.35 &&
    threat &&
    Math.abs(threat.x - u.x) < 320
  ) {
    u.surrendered = true;
    u.tactic = 'surrender';
    u.surrenderTime = 0;
    u.fire = 0;
    u.secondaryFire = 0;
    u.coverGoal = null;
    u.climbing = 0;
    u.motion = 'ground';
    s.players[u.side === 0 ? 1 : 0].captures++;
    notify(
      s,
      `${u.side === 0 ? '我方' : '敌方'}${c.name}有队员放下武器`,
      'info',
      ([0, 1] as Side[]).filter((side) => visibleToSide(s, side, u)),
    );
    return;
  }
  if (u.tactic === 'retreat') {
    if (
      u.personalMorale < 70 &&
      (!threat ||
        Math.abs(threat.x - u.x) > Math.max(560, unitRange(s, u)) + 130)
    )
      u.personalMorale = Math.min(70, u.personalMorale + 8);
    if (s.time < u.retreatUntil || u.personalMorale < 52) {
      u.coverGoal = null;
      return;
    }
  }
  if (!inContact) {
    u.tactic = u.suppression > 68 ? 'prone' : 'advance';
    if (u.personalMorale < (c.discipline ?? 80))
      u.personalMorale = Math.min(c.discipline ?? 80, u.personalMorale + 1.5);
    return;
  }
  if (u.personalMorale < 35 && !orderedWithdrawal(s, u)) {
    u.originalSquad = u.squad;
    u.conflictChecked = false;
    u.regroupProgress = 0;
    u.tactic = 'retreat';
    u.retreatUntil = s.time + 4;
    u.coverGoal = null;
    return;
  }
  if (!orderedWithdrawal(s, u)) planWithdrawal(s, u, threat);
  const doctrine = doctrineOf(u.id),
    list = roles[doctrine];
  // Stable member roles; short bounds alternate locally while contact continues.
  u.tactic = u.suppression > 65 ? 'prone' : list[u.member % list.length];
}
function evadeArtillery(s: GameState, u: Unit, dt: number) {
  const eta = (p: Projectile) =>
    p.guided
      ? Math.hypot(p.tx - p.x, p.ty - p.y) /
        FLIGHT[p.ammunition ?? 'mortar'].speed
      : p.life;
  const incoming = s.projectiles.find((p) => {
    const progress = 1 - Math.max(0, p.life) / p.total;
    const descending =
      p.ty - p.startY - 4 * (p.arc ?? 0) * (1 - 2 * progress) > 0;
    return (
      p.side !== u.side &&
      p.shell &&
      descending &&
      eta(p) > 0 &&
      eta(p) < 0.58 &&
      Math.hypot(p.x - u.x, p.y - (u.y - 30)) < 145
    );
  });
  if (incoming && !(u.artilleryChecks ?? []).includes(incoming.uid ?? -1)) {
    const id = incoming.uid ?? -1;
    u.artilleryChecks = [...(u.artilleryChecks ?? []).slice(-7), id];
    // One local perception roll per shell/member; no impact marker or squad-wide alert.
    let hash = Math.imul((id + 1) ^ Math.imul(u.uid + 1, 374761393), 668265263);
    hash = Math.imul(hash ^ (hash >>> 13), 1274126177);
    const roll = ((hash ^ (hash >>> 16)) >>> 0) / 4294967296;
    const distance = Math.hypot(incoming.x - u.x, incoming.y - (u.y - 30));
    const chance = Math.max(
      0.3,
      Math.min(
        0.88,
        0.48 + (CARDS[u.id].discipline ?? 70) * 0.004 - distance / 650,
      ),
    );
    if (roll < chance) {
      u.evadeMarker = id;
      u.artilleryReactAt = s.time + 0.04 + ((hash >>> 20) / 4096) * 0.13;
      u.evadeUntil = s.time + 1.1 + (u.uid % 4) * 0.08;
      const dir = hash & 1 ? 1 : -1;
      u.evadeGoal = Math.max(
        80,
        Math.min(W - 80, u.x + dir * (10 + (u.uid % 3) * 5)),
      );
    }
  }
  if (u.evadeUntil <= s.time) {
    u.evadeGoal = null;
    return false;
  }
  if ((u.artilleryReactAt ?? 0) > s.time) return false;
  u.coverGoal = null;
  u.firingGoal = null;
  u.fire = 0;
  u.secondaryFire = 0;
  const noticed = s.projectiles.find((p) => p.uid === u.evadeMarker);
  if (!noticed || eta(noticed) < 0.18) u.evadeGoal = null;
  if (u.evadeGoal !== null && Math.abs(u.evadeGoal - u.x) > 4) {
    u.pose = 'run';
    moveSoldier(
      s,
      u,
      Math.sign(u.evadeGoal - u.x),
      CARDS[u.id].speed! * u.pace * 1.5,
      dt,
      false,
    );
    if (u.moving) return true;
  }
  u.evadeGoal = null;
  u.pose = 'prone';
  u.moving = false;
  return true;
}
function fireCoax(s: GameState, u: Unit) {
  if (u.secondaryCooldown > 0) return;
  const personal = !!CARDS[u.id].armorOnly;
  const selfRange = personal ? 240 : 420;
  const selfHeight = personal ? (CARDS[u.id].members ? 38 : 30) : 42;
  const target = s.units
    .filter(
      (v) =>
        v.side !== u.side &&
        isCombatant(v) &&
        visibleToSide(s, u.side, v) &&
        CARDS[v.id].members &&
        Math.abs(v.x - u.x) <=
          selfRange *
            (s.players[u.side].recon > 0
              ? 1.2
              : droneRecon(s, u.side, u.x)
                ? 1.1
                : 1),
    )
    .sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))
    .find((v) => {
      const p = muzzlePoint(u, v.x, selfHeight, true);
      return (
        !smokeBlocks(s, u.side, u.x, v.x) &&
        !terrainIntercept(s, p.x, p.y, v.x, v.y - bodyHeight(v), true)
      );
    });
  if (!target) return;
  const point = muzzlePoint(u, target.x, selfHeight, true),
    sx = point.x,
    sy = point.y,
    total = Math.max(
      FLIGHT.machinegun.minimum,
      Math.abs(target.x - sx) / FLIGHT.machinegun.speed,
    );
  u.secondaryShots++;
  u.secondaryMuzzleX = sx;
  u.secondaryMuzzleY = sy;
  u.secondaryAngle = Math.atan2(
    target.y - bodyHeight(target) - sy,
    target.x - sx,
  );
  muzzleParticles(s, u, 'machinegun', sx, sy, true);
  u.secondaryCooldown = personal
    ? 1.4
    : u.secondaryShots % 4 === 0
      ? 1.2
      : 0.12;
  u.secondaryFire = 0.09;
  s.projectiles.push({
    sourceUid: u.uid,
    x: sx,
    y: sy,
    tx: target.x,
    ty: target.y - bodyHeight(target),
    side: u.side,
    targetUid: target.uid,
    base: null,
    damage: 3 * (s.players[u.side].morale > 0 ? 1.35 : 1),
    radius: 0,
    life: total,
    total,
    startX: sx,
    startY: sy,
    arc: 0,
    weapon: 'coax',
    ammunition: personal ? 'rifle' : 'machinegun',
    tracer: true,
  });
}
/** Local service work happens before mine contact. Return true while parked at a job. */
function serviceVehicle(s: GameState, u: Unit) {
  const support = CARDS[u.id].vehicleSupport;
  if (support === 'repair') {
    const patients = s.units
      .filter(
        (v) =>
          v !== u &&
          v.side === u.side &&
          isCombatant(v) &&
          CARDS[v.id].armored &&
          !CARDS[v.id].air &&
          CARDS[v.id].vehicleSupport !== 'repair' &&
          v.hp < v.maxHp &&
          Math.abs(v.x - u.x) <= 180,
      )
      .sort(
        (a, b) =>
          a.hp / a.maxHp - b.hp / b.maxHp ||
          Math.abs(a.x - u.x) - Math.abs(b.x - u.x),
      );
    const patient =
      patients.find((v) => (v.recoverySupportUntil ?? 0) <= s.time) ??
      patients[0];
    if (!patient) return false;
    if (
      u.supportCooldown <= 0 &&
      (patient.recoverySupportUntil ?? 0) <= s.time
    ) {
      patient.hp = Math.min(patient.maxHp, patient.hp + 9);
      patient.recoverySupportUntil = s.time + 0.5;
      patient.healing = u.healing = 0.6;
      u.supportCooldown = 0.5;
    }
    return true;
  }
  if (support === 'command') {
    if (u.supportCooldown > 0) return false;
    u.supportCooldown = 1;
    for (const v of s.units) {
      if (
        v.side !== u.side ||
        !isCombatant(v) ||
        !CARDS[v.id].members ||
        Math.abs(v.x - u.x) > 220 ||
        (v.commandSupportUntil ?? 0) > s.time
      )
        continue;
      v.commandSupportUntil = s.time + 1;
      if (v.personalMorale < 85)
        v.personalMorale = Math.min(85, v.personalMorale + 2);
      v.suppression = Math.max(0, v.suppression - 3);
      v.cooldown = Math.max(0, v.cooldown - 0.12);
    }
    return false;
  }
  if (support === 'mine_clear') {
    // Search only the local tool reach; no mine information is added to team vision or UI.
    const reach = Math.max(110, armorHalf(u.id) + 35);
    const mine = s.mines
      .filter(
        (m) =>
          m.side !== u.side &&
          m.armAt !== Infinity &&
          Math.abs(m.x - u.x) <= reach,
      )
      .sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0];
    if (mine) {
      if (u.supportCooldown <= 0) {
        mine.armAt = Infinity;
        u.supportCooldown = 0.6;
      }
      // Keep the vehicle stopped between operations in a dense minefield.
      return true;
    }
    const dir = u.side === 0 ? 1 : -1;
    const wall = s.walls.find(
      (w) => w.hp > 0 && (w.x - u.x) * dir >= 0 && Math.abs(w.x - u.x) <= 65,
    );
    if (wall) {
      if (u.supportCooldown <= 0) {
        wall.hp = Math.max(0, wall.hp - 90);
        u.supportCooldown = 0.6;
      }
      return true;
    }
  }
  return false;
}
function emplacementPosition(s: GameState, side: Side, id: CardId) {
  const dir = side === 0 ? 1 : -1,
    base = side === 0 ? 112 : W - 112;
  const escorts = s.units.filter(
    (u) =>
      u.side === side &&
      isCombatant(u) &&
      !CARDS[u.id].air &&
      !CARDS[u.id].static &&
      u.tactic !== 'retreat',
  );
  if (!escorts.length) return base;
  const front = escorts.reduce((a, u) => (dir * u.x > dir * a ? u.x : a), base);
  let goal = front - dir * (CARDS[id].emplacement === 'howitzer' ? 360 : 180);
  for (const foe of s.units.filter(
    (u) =>
      u.side !== side &&
      isCombatant(u) &&
      !CARDS[u.id].air &&
      visibleToSide(s, side, u),
  )) {
    const safe = foe.x - dir * Math.max(220, (CARDS[id].minRange ?? 0) + 100);
    if (dir * safe < dir * goal) goal = safe;
  }
  return side === 0
    ? Math.max(base, Math.min(W - 220, goal))
    : Math.min(base, Math.max(220, goal));
}

// A howitzer can redeploy after its observed firing sector has stayed empty.
// Reloading and brief losses of sight never make it pack up between shots.
function towHowitzer(s: GameState, u: Unit, dt: number) {
  const c = CARDS[u.id],
    range = unitRange(s, u),
    baseX = u.side === 0 ? W - 70 : 70,
    baseDistance = Math.abs(baseX - u.x);
  const canEngage =
    (baseDistance >= (c.minRange ?? 0) && baseDistance <= range) ||
    s.units.some(
      (v) =>
        v.side !== u.side &&
        isCombatant(v) &&
        !CARDS[v.id].air &&
        visibleToSide(s, u.side, v) &&
        Math.abs(v.x - u.x) >= (c.minRange ?? 0) &&
        Math.abs(v.x - u.x) <= range,
    );
  if (canEngage) {
    u.emplacementIdleSince = undefined;
    if (!u.emplaced) {
      u.emplaced = true;
      u.emplacementSetupUntil = s.time + 1.2;
    }
    if (s.time < (u.emplacementSetupUntil ?? 0)) {
      u.moving = false;
      u.fire = 0;
      u.secondaryFire = 0;
      return true;
    }
    return false;
  }
  const goal = emplacementPosition(s, u.side, u.id),
    delta = goal - u.x;
  if (u.emplaced) {
    u.emplacementIdleSince ??= s.time;
    if (
      s.players[u.side].order === 'hold' ||
      s.time - u.emplacementIdleSince < 6 ||
      Math.abs(delta) < 1
    )
      return false;
    u.emplaced = false;
    u.emplacementSetupUntil = undefined;
  }
  if (s.players[u.side].order === 'hold' || Math.abs(delta) < 1) return false;
  const change = Math.sign(delta) * Math.min(Math.abs(delta), 28 * dt);
  u.x += change;
  u.y = ground(s, u.x);
  u.facing = Math.sign(change);
  u.moving = true;
  u.walk += Math.abs(change) / 6;
  u.fire = 0;
  u.secondaryFire = 0;
  return true;
}

// Direct-fire emplacements remain fixed after their initial deployment.
function towEmplacement(s: GameState, u: Unit, dt: number) {
  const c = CARDS[u.id];
  if (c.emplacement === 'howitzer') return towHowitzer(s, u, dt);
  if (!c.emplacement || u.emplaced) return false;
  const canEngage = s.units.some(
    (v) =>
      v.side !== u.side &&
      isCombatant(v) &&
      visibleToSide(s, u.side, v) &&
      (!CARDS[v.id].air || c.antiAir) &&
      (!c.airOnly || CARDS[v.id].air) &&
      Math.abs(v.x - u.x) >= (c.minRange ?? 0) &&
      Math.abs(v.x - u.x) <= unitRange(s, u) &&
      firingHeight(s, u, v.x, v.y - bodyHeight(v)) !== null,
  );
  if (canEngage || u.shots > 0) {
    u.emplaced = true;
    return false;
  }
  const goal = emplacementPosition(s, u.side, u.id),
    delta = goal - u.x;
  if (Math.abs(delta) < 1) return false;
  const change = Math.sign(delta) * Math.min(Math.abs(delta), 28 * dt);
  u.x += change;
  u.y = ground(s, u.x);
  u.facing = Math.sign(change);
  u.moving = true;
  u.walk += Math.abs(change) / 6;
  u.fire = 0;
  u.secondaryFire = 0;
  return true;
}

const aiSquadCommandState = new WeakMap<
  GameState,
  Map<
    number,
    {
      at: number;
      order: 'hold' | 'watch' | 'retreat' | null;
    }
  >
>();
function commandAiSquads(
  s: GameState,
  own: Unit[],
  visibleFoes: Unit[],
  staging: boolean,
) {
  let state = aiSquadCommandState.get(s);
  if (!state) {
    state = new Map();
    aiSquadCommandState.set(s, state);
  }
  const groups = new Map<number, Unit[]>();
  for (const u of own)
    if (CARDS[u.id].members && !u.rappelling) {
      const group = groups.get(u.squad) ?? [];
      group.push(u);
      groups.set(u.squad, group);
    }
  for (const id of state.keys()) if (!groups.has(id)) state.delete(id);
  for (const [squad, members] of groups) {
    const previous = state.get(squad);
    const clearLocalOrder = () => {
      // Only clear orders owned by this AI hook, including retreat's automatic watch.
      if (!previous?.order) return;
      for (const u of members)
        if (
          u.squadOrder === previous.order ||
          (previous.order === 'retreat' && u.squadOrder === 'watch')
        ) {
          u.squadOrder = undefined;
          u.squadOrderX = undefined;
          u.squadOrderUntil = undefined;
          u.decisionIn = 0;
        }
      state.set(squad, { at: s.time, order: null });
    };
    const center = members.reduce((n, u) => n + u.x, 0) / members.length;
    const enemies = visibleFoes.filter(
      (u) => !CARDS[u.id].air && Math.abs(u.x - center) < 420,
    );
    const friends = own.filter(
      (u) => !CARDS[u.id].air && Math.abs(u.x - center) < 420,
    );
    const weight = (u: Unit) =>
      (CARDS[u.id].cost * Math.max(0, u.hp)) / (CARDS[u.id].hp ?? u.maxHp);
    const danger = enemies.reduce((n, u) => n + weight(u), 0);
    const support = friends.reduce((n, u) => n + weight(u), 0);
    const meanMorale =
      members.reduce((n, u) => n + u.personalMorale, 0) / members.length;
    const fallback = own.some(
      (u) =>
        CARDS[u.id].members &&
        u.squad !== squad &&
        u.x > center + 100 &&
        u.x < center + 420 &&
        u.personalMorale >= 55,
    );
    // The autonomous infantry logic handles ordinary bounding withdrawals. A
    // squad-level retreat is only a short regroup behind an existing healthy line.
    const retreat =
      enemies.length &&
      danger > support * 1.8 &&
      meanMorale < 55 &&
      fallback &&
      center < W - 500 &&
      !members.some(
        (u) =>
          weaponCard(u).armorOnly ||
          weaponCard(u).airOnly ||
          weaponCard(u).indirect,
      );
    const guarding = own.find(
      (u) =>
        CARDS[u.id].emplacement === 'howitzer' &&
        u.emplaced &&
        u.x > center &&
        u.x - center < 450 &&
        s.time - (u.lastCombatShotAt ?? -100) < 25,
    );
    // Only an engaged guard digs in. Reinforcements outside weapon range continue
    // forward, and a favourable line releases its defensive order to advance.
    const canFire = members.some((u) =>
      enemies.some(
        (v) =>
          Math.abs(v.x - u.x) <= unitRange(s, u) &&
          firingHeight(s, u, v.x, v.y - bodyHeight(v)) !== null,
      ),
    );
    const next = retreat
      ? 'retreat'
      : guarding && canFire && danger > support * 1.2
        ? 'hold'
        : members.every((u) => CARDS[u.id].observer) && enemies.length
          ? 'watch'
          : null;
    if (staging || next === null) {
      clearLocalOrder();
      continue;
    }
    if (members.some((u) => u.squadOrder === 'retreat')) {
      if (previous && s.time - previous.at >= 12) clearLocalOrder();
      continue;
    }
    if (s.time - (previous?.at ?? -Infinity) < 9) continue;
    if (next === null) clearLocalOrder();
    else if (!members.every((u) => u.squadOrder === next))
      setSquadOrder(s, 1, squad, next);
    state.set(squad, { at: s.time, order: next });
  }
}

function updateAI(s: GameState) {
  const p = s.players[1];
  const own = s.units.filter((u) => u.side === 1 && isCombatant(u));
  // Every enemy-dependent branch below uses this visible set, never hidden units
  // or the opposing player's hand, energy, or deck.
  const foes = s.units.filter(
    (u) => u.side === 0 && isCombatant(u) && visibleToSide(s, 1, u),
  );
  const groundFoes = foes.filter((u) => !CARDS[u.id].air);
  const armor = groundFoes.filter(
    (u) => CARDS[u.id].armored || CARDS[u.id].vehicle,
  );
  const air = foes.filter((u) => CARDS[u.id].air);
  const foot = groundFoes.filter((u) => CARDS[u.id].members);
  const groups = (list: Unit[]) => new Set(list.map((u) => u.squad)).size;
  const fighters = own.filter(
    (u) => !CARDS[u.id].observer && u.tactic !== 'retreat',
  );
  const cohorts = groups(fighters.filter((u) => !CARDS[u.id].air));
  const armedAir = air.filter((u) => !CARDS[u.id].observer);
  // Count healthy counters already travelling to this contact, so reinforcements
  // are combined arms instead of spending every new point on the same role.
  const canSupportContact = (u: Unit, target: Unit) => {
    const c = weaponCard(u),
      distance = Math.abs(target.x - u.x);
    if (c.members && (u.personalMorale < 40 || u.hp < u.maxHp * 0.35))
      return false;
    if (distance >= (c.minRange ?? 0) && distance <= unitRange(s, u))
      return (
        firingHeight(s, u, target.x, target.y - bodyHeight(target)) !== null
      );
    if (u.x <= target.x || (c.static && u.emplaced)) return false;
    const travelSpeed = c.emplacement
      ? 28
      : (c.speed ?? 0) * (c.members ? 0.8 : 1);
    return distance - unitRange(s, u) <= travelSpeed * 20;
  };
  const antitank = groups(
    fighters.filter((u) => {
      const c = weaponCard(u);
      if (c.airOnly || !((c.armorMultiplier ?? 1) >= 1.5 || c.penetration))
        return false;
      return armor.some((target) => canSupportContact(u, target));
    }),
  );
  const antiair = groups(
    fighters.filter(
      (u) =>
        weaponCard(u).antiAir &&
        armedAir.some((target) => canSupportContact(u, target)),
    ),
  );
  const urgentArmor = armor.length > antitank,
    urgentAir = armedAir.length > antiair;
  const lineInfantry = (id: CardId) => {
    const c = CARDS[id];
    return (
      !!c.members &&
      !c.indirect &&
      !c.airOnly &&
      !c.heal &&
      !['scouts', 'engineers', 'supply_team'].includes(id) &&
      ((c.damage ?? 0) >= 12 || modelOf(id) === 'machinegun') &&
      (c.armorMultiplier ?? 1) < 1.5
    );
  };
  // A lone survivor is not a complete screen, even after it absorbs stragglers.
  const screens = fighters
    .filter((u) => lineInfantry(u.id))
    .reduce((n, u) => n + u.hp / CARDS[u.id].hp!, 0);
  const opposingScreen = foot.reduce((n, u) => n + u.hp / CARDS[u.id].hp!, 0);
  const requiredScreens = Math.max(2.4, Math.min(5, opposingScreen * 1.05));
  const screenNeed = screens < requiredScreens;
  const pressure = (list: Unit[]) =>
    list.reduce((n, u) => n + 0.4 + Math.max(0, (u.x - (W - 1800)) / 1800), 0);
  const armorPressure = pressure(armor) / Math.max(1, antitank),
    airPressure = pressure(armedAir) / Math.max(1, antiair);
  const emergency = groundFoes.some((u) => u.x > W - 650);
  const battle = foes.some((v) =>
    fighters.some((u) => Math.abs(v.x - u.x) < 850),
  );
  const patients = s.units.filter(
    (u) =>
      u.side === 1 &&
      canTakeDamage(u) &&
      CARDS[u.id].members &&
      (u.wounded || u.maxHp - u.hp >= 5),
  );
  const armorDamage = own
    .filter((u) => CARDS[u.id].armored)
    .reduce((n, u) => n + u.maxHp - u.hp, 0);
  const moraleNeed = own.filter(
    (u) =>
      CARDS[u.id].members && (u.personalMorale < 45 || u.tactic === 'retreat'),
  ).length;
  const front = fighters
    .filter((u) => !CARDS[u.id].air)
    .reduce((x, u) => Math.min(x, u.x), W - 112);

  // Stage a short opening/rebuilding wave by squad, not individual soldier.
  if (!cohorts) s.aiWaveUntil = s.time + 10;
  const staging =
    !emergency && !battle && cohorts < 2 && s.time < (s.aiWaveUntil ?? 0);
  // Double-time only between contacts. Once a threat is close, normal advance
  // gives each squad its own firing/cover decisions instead of a global rush.
  p.order = staging ? 'hold' : !battle && cohorts >= 2 ? 'rush' : 'advance';
  // Keep newly deployed reinforcements mobile; local cover orders defend the line.
  commandAiSquads(s, own, foes, staging);

  const options = p.hand
    .filter((h) => cardReadyIn(s, h) <= 0)
    .map((h) => {
      const c = CARDS[h.id],
        model = modelOf(h.id);
      let score = -100,
        x: number | undefined;
      if (c.type === 'unit') {
        score = 6 + (cohorts < 2 ? 4 : 0);
        const counterArmor =
          !c.airOnly && ((c.armorMultiplier ?? 1) >= 1.5 || !!c.penetration);
        if (counterArmor) score += armor.length ? (urgentArmor ? 19 : -2) : 0;
        if (c.antiAir) score += armedAir.length ? (urgentAir ? 19 : -2) : 0;
        if (lineInfantry(c.id))
          score += screens < 1.5 ? 27 : screenNeed ? 20 : 5;
        if (c.members && counterArmor && !armor.length && screens === 0)
          score -= 3;
        if (c.airOnly && !air.length) {
          const covered = own.some((v) => weaponCard(v).antiAir);
          score = !screenNeed && !covered ? (c.patrolTime ? 8 : 10) : -100;
        }
        if (c.observer)
          score = own.some((u) => CARDS[u.id].observer)
            ? -100
            : cohorts
              ? own.some((u) => (CARDS[u.id].range ?? 0) >= 700)
                ? 16
                : 10
              : 1;
        if (c.heal)
          score =
            patients.length >= 2 && screens >= 1
              ? 26
              : patients.length
                ? 12
                : screens >= 2
                  ? 4
                  : 0;
        if (foot.length >= 4 && (model === 'machinegun' || c.indirect))
          score += 6;
        if (model === 'sniper' && foot.length) score += 3;
        if (c.deployDraw && p.hand.length <= 4) score += 3;
        if (c.armored && !c.airOnly && cohorts >= 1) score += 3;
        if (c.id === 'pickup') score += foot.length >= 4 ? 8 : 0;
        if (c.vehicleSupport === 'repair')
          score = own.some(
            (u) => CARDS[u.id].armored && !CARDS[u.id].vehicleSupport,
          )
            ? armorDamage >= 100
              ? 19
              : 7
            : -100;
        if (c.vehicleSupport === 'command')
          score = screens >= requiredScreens ? 15 : screens >= 2 ? 5 : 1;
        if (c.vehicleSupport === 'mine_clear')
          score =
            own.some((u) => CARDS[u.id].armored) &&
            Object.values(s.knownWalls[1]).some(
              (w) => w.hp > 0 && Math.abs(w.x - front) < 450,
            )
              ? 15
              : cohorts >= 2
                ? 5
                : -100;
        if (c.sortie && !c.patrolTime && !foes.length) score = -100;
        if (c.id === 'fpv_drone')
          score += armor.length ? 10 : foot.length ? -2 : -8;
        if (c.airlift) {
          x = safeLanding(s, defaultLanding(s, 1));
          score = cohorts >= 2 && groundFoes.length ? 18 : -2;
        }
        if (c.air && !c.observer && !c.airOnly) {
          const enemyAA = groups(foes.filter((u) => weaponCard(u).antiAir));
          score +=
            (c.attackRun === 'strafe' || c.attackRun === 'bomb') &&
            foot.length >= 6
              ? 12
              : 0;
          score -= Math.min(12, enemyAA * 5);
        }
        if (c.emplacement) {
          const position = emplacementPosition(s, 1, c.id);
          const valid = foes.some(
            (v) =>
              (!CARDS[v.id].air || c.antiAir) &&
              (!c.airOnly || CARDS[v.id].air) &&
              Math.abs(v.x - position) >= (c.minRange ?? 0) &&
              Math.abs(v.x - position) <= c.range!,
          );
          // Evaluate the position a guarded gun can actually reach on foot.
          if (!valid) score = -100;
        }
        // Expensive support cannot substitute for the infantry that must protect it.
        // Heavy anti-tank ammunition has no useful target in an infantry-only contact.
        if (c.armorOnly && !armor.length) score = -100;
        if ((c.indirect || c.vehicleSupport) && screens < 1.5) score = -100;
        // Avoid continuously buying a specialised role already covered by own units.
        score -= Math.min(6, groups(own.filter((u) => u.id === c.id)) * 2);
      } else if (c.id === 'antitank_mine') {
        x = armor
          .flatMap((v) => [v.x + 120, v.x + 220, v.x + 320])
          .filter((a) => a >= 100 && a <= W - 120)
          .find(
            (a) =>
              armor.every((v) => Math.abs(v.x - a) >= 85) &&
              !s.mines.some((m) => m.side === 1 && Math.abs(m.x - a) < 90),
          );
        score = x === undefined ? -100 : urgentArmor ? 18 : 7;
      } else if (c.id === 'smoke') {
        const needsCover = own.some(
          (u) =>
            CARDS[u.id].members &&
            (u.tactic === 'retreat' || u.hp < u.maxHp * 0.5),
        );
        const assault = fighters.find(
          (u) =>
            CARDS[u.id].members &&
            CARDS[u.id].trait === 'close_assault' &&
            groundFoes.some((v) => Math.abs(v.x - u.x) < 500),
        );
        if (battle && needsCover) {
          x = Math.max(100, Math.min(W - 100, front - 90));
          score = 22;
        } else if (battle && assault) {
          x = Math.max(100, assault.x - 110);
          score = 19;
        }
        if (
          x !== undefined &&
          s.smokes.some(
            (m) => m.side === 1 && m.life > 2 && Math.abs(m.x - x!) < 160,
          )
        )
          score = -100;
      } else if (c.id === 'recon') {
        if (p.recon <= 0 && cohorts && (battle || front < W - 900))
          score = fighters.some((u) => (CARDS[u.id].range ?? 0) >= 650)
            ? 19
            : 9;
      } else if (c.id === 'repair') {
        if (
          armorDamage > 80 &&
          own.some((u) => CARDS[u.id].armored && u.repairTime <= 0)
        )
          score = 20 + Math.min(6, armorDamage / 50);
      } else if (c.id === 'morale') {
        if (battle && cohorts >= 2 && p.morale <= 0) score = 22;
      } else if (c.id === 'supply' || c.effect === 'ammo') {
        if (p.hand.length <= 4) score = 25;
      } else if (c.effect === 'rally') {
        if (moraleNeed >= 2) score = 26;
      } else if (c.effect === 'medevac') {
        if (patients.some((u) => u.wounded) || patients.length >= 2)
          score =
            22 + Math.min(6, patients.filter((u) => u.wounded).length * 2);
      } else if (c.effect === 'fortify') {
        if (
          battle &&
          own.filter((u) => CARDS[u.id].members && !u.moving).length >= 3 &&
          p.fortify <= 0
        )
          score = 20;
      } else if (c.effect === 'barrage') {
        const cluster = groundFoes
          .map((v) => ({
            x: v.x,
            n: groundFoes.filter((a) => Math.abs(a.x - v.x) < 120).length,
          }))
          .sort((a, b) => b.n - a.n)[0];
        if (cluster && cluster.n >= 3) {
          x = cluster.x;
          score = 13;
        }
      } else if (c.effect === 'sabotage') {
        if (battle && foes.some((u) => u.cooldown < 1.2))
          score = foes.some(
            (u) => CARDS[u.id].penetration || CARDS[u.id].indirect,
          )
            ? 24
            : foes.length >= 4
              ? 19
              : 8;
      } else if (c.effect === 'emp') {
        if (battle && foes.some((u) => CARDS[u.id].air || weaponCard(u).guided))
          score = 25;
      } else if (c.id === 'jam') {
        if (battle && cohorts >= 2 && s.players[0].jam <= 0) score = 8;
      }
      if (c.targetGround && (x === undefined || !Number.isFinite(x)))
        score = -100;
      return {
        h,
        x,
        score: score - cardCost(h) * (lineInfantry(h.id) ? 0.9 : 0.05),
      };
    })
    .filter((v) => v.score > 0)
    .sort((a, b) => b.score - a.score || a.h.uid - b.h.uid);

  const armorRole = (id: CardId) => {
    const c = CARDS[id];
    return (
      c.type === 'unit' &&
      !c.airOnly &&
      ((c.armorMultiplier ?? 1) >= 1.5 || !!c.penetration)
    );
  };
  const airRole = (id: CardId) =>
    CARDS[id].type === 'unit' && !!CARDS[id].antiAir;
  const healthyRole = (role: (id: CardId) => boolean) =>
    fighters.some(
      (u) => role(u.id) && (!CARDS[u.id].members || u.personalMorale >= 40),
    );
  if (armor.length) s.aiArmorSeenUntil = s.time + 15;
  if (armedAir.length) s.aiAirSeenUntil = s.time + 15;
  const seekArmor =
    (armor.length > 0 && urgentArmor) ||
    (!armor.length &&
      s.time < (s.aiArmorSeenUntil ?? 0) &&
      !healthyRole(armorRole));
  const seekAir =
    (armedAir.length > 0 && urgentAir) ||
    (!armedAir.length &&
      s.time < (s.aiAirSeenUntil ?? 0) &&
      !healthyRole(airRole));

  if (seekArmor || seekAir) {
    // A ready counter already in hand is more reliable than buying another draw.
    // Unlike ordinary scoring, short-lived lost sight does not disqualify a MANPADS
    // card held in reserve. Mines still require the already-computed legal target.
    const counterChoices = p.hand
      .filter((h) => cardReadyIn(s, h) <= 0)
      .flatMap((h) => {
        if (
          ((seekArmor && armorRole(h.id)) || (seekAir && airRole(h.id))) &&
          (!CARDS[h.id].emplacement || options.some((o) => o.h.uid === h.uid))
        )
          return [{ h, x: undefined as number | undefined }];
        const mine =
          seekArmor && h.id === 'antitank_mine'
            ? options.find((o) => o.h.uid === h.uid)
            : undefined;
        return mine ? [{ h, x: mine.x }] : [];
      })
      .sort((a, b) => {
        const importance = (choice: typeof a) =>
          Math.max(
            seekArmor &&
              (armorRole(choice.h.id) || choice.h.id === 'antitank_mine')
              ? armorPressure
              : 0,
            seekAir && airRole(choice.h.id) ? airPressure : 0,
          );
        return (
          importance(b) - importance(a) ||
          cardCost(a.h) - cardCost(b.h) ||
          a.h.uid - b.h.uid
        );
      });
    if (counterChoices.length) {
      const counter = counterChoices[0];
      if (cardCost(counter.h) <= p.energy + 1e-6)
        playCard(s, 1, counter.h.uid, counter.x);
      return; // Save for this known counter; do not spend its budget drawing.
    }

    const canSearch = p.deck.length > 0 || p.discard.length > 0;
    if (canSearch && p.hand.length < MAX_HAND) {
      if (p.energy < DRAW_COST) return;
      if (requestDraw(s, 1).ok) return;
      // While the normal draw cooldown/jam runs, preserve exactly its real cost.
      const support = options.find(
        (o) => cardCost(o.h) <= p.energy - DRAW_COST + 1e-6,
      );
      if (support) playCard(s, 1, support.h.uid, support.x);
      return;
    }
    if (canSearch && p.hand.length >= MAX_HAND) {
      const release = p.hand
        .filter(
          (h) =>
            cardReadyIn(s, h) <= 0 &&
            !CARDS[h.id].targetGround &&
            cardCost(h) <= p.energy + 1e-6,
        )
        .map((h) => {
          const c = CARDS[h.id];
          // Supply/ammo/deployDraw replace cards using their real paid effects.
          // Otherwise deploy a cheap defender; no discard or replacement cheat.
          const searchCard =
            c.deployDraw || c.id === 'supply' || c.effect === 'ammo';
          return {
            h,
            rank: searchCard
              ? 3
              : c.type === 'unit'
                ? 2
                : options.some((o) => o.h.uid === h.uid)
                  ? 1
                  : 0,
          };
        })
        .sort((a, b) => b.rank - a.rank || cardCost(a.h) - cardCost(b.h))[0];
      if (release) playCard(s, 1, release.h.uid);
      return;
    }
    // If no draw pool remains, ordinary affordable defence is still preferable
    // to waiting forever. Fall through to the existing choice logic.
  }

  const reserve = !emergency && !battle && !screenNeed ? 2 : 0;
  const usefulSupply = options.find(
    (o) =>
      (CARDS[o.h.id].id === 'supply' || CARDS[o.h.id].effect === 'ammo') &&
      cardCost(o.h) <= p.energy,
  );
  if (
    usefulSupply &&
    p.hand.length <= 4 &&
    playCard(s, 1, usefulSupply.h.uid).ok
  )
    return;
  // Buy the next real card while an established screen fights. Two CP are never gifted.
  if (
    !emergency &&
    !screenNeed &&
    p.hand.length <= 3 &&
    p.drawIn <= 0 &&
    p.energy >= DRAW_COST + (battle ? 1 : 0) &&
    requestDraw(s, 1).ok
  )
    return;
  const best = options[0];
  // When points would otherwise cap, prepare the next choice while keeping the
  // budget for the current one. Urgent counters have already been handled above.
  if (
    !emergency &&
    p.energy >= 9 &&
    p.hand.length <= 3 &&
    (!best || best.score < 16) &&
    (!best || p.energy >= cardCost(best.h) + DRAW_COST) &&
    requestDraw(s, 1).ok
  )
    return;
  if (best && cardCost(best.h) > p.energy + 1e-6) {
    // Reserve real command points for the best ready card, including counters.
    // An urgent HQ fight may use an already affordable useful defender instead.
    if (!emergency) return;
    const defender = options.find(
      (o) => cardCost(o.h) <= p.energy + 1e-6 && CARDS[o.h.id].type === 'unit',
    );
    if (!defender) return;
    if (playCard(s, 1, defender.h.uid, defender.x).ok) return;
  }
  for (const option of options) {
    if (cardCost(option.h) > p.energy + 1e-6) continue;
    const highNeed = option.score >= 18 || screenNeed;
    if (!highNeed && cardCost(option.h) > p.energy - reserve + 1e-6) continue;
    if (playCard(s, 1, option.h.uid, option.x).ok) return;
  }
  // A completely blocked full hand needs one cheap slot cleared before drawing.
  if (p.hand.length >= MAX_HAND && !options.length) {
    const clear = p.hand
      .filter(
        (h) =>
          !CARDS[h.id].targetGround &&
          cardReadyIn(s, h) <= 0 &&
          cardCost(h) <= p.energy,
      )
      .sort(
        (a, b) =>
          Number(!!CARDS[a.id].airOnly) - Number(!!CARDS[b.id].airOnly) ||
          cardCost(a) - cardCost(b),
      )[0];
    if (clear) playCard(s, 1, clear.uid);
  }
  // Draw only after deciding there is no useful card to buy or reserve for.
  if (p.hand.length < MAX_HAND) requestDraw(s, 1);
}

// Called inside the existing footsoldier retreat branch, before moveSoldier.
// true means this frame was spent regrouping/in a conflict; false means keep fleeing.
function recoverRetreat(s: GameState, u: Unit, dt: number) {
  u.originalSquad ??= u.squad;
  const friends = s.units.filter(
    (v) =>
      v !== u &&
      v.side === u.side &&
      isCombatant(v) &&
      CARDS[v.id].members &&
      v.tactic !== 'retreat',
  );
  const groups = new Map<number, Unit[]>();
  for (const v of friends)
    if (Math.abs(v.x - u.x) <= 140) {
      const list = groups.get(v.squad) ?? [];
      list.push(v);
      groups.set(v.squad, list);
    }
  const host = [...groups.entries()]
    .map(([squad, members]) => ({
      squad,
      members,
      morale:
        members.reduce((n, v) => n + v.personalMorale, 0) / members.length,
      x: members.reduce((n, v) => n + v.x, 0) / members.length,
    }))
    .filter((g) => g.members.length >= 4 && g.morale >= 55)
    .sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0];
  if (host && s.time - (u.regroupedAt ?? -100) >= 6) {
    if (u.regroupHost !== host.squad) {
      u.regroupHost = host.squad;
      u.regroupProgress = 0;
    }
    u.regroupProgress = (u.regroupProgress ?? 0) + dt;
    u.moving = false;
    u.fire = 0;
    u.secondaryFire = 0;
    u.coverGoal = null;
    u.cover = 0;
    u.pose = 'crouch';
    u.facing = u.side === 0 ? 1 : -1;
    if (u.regroupProgress >= 1.2) {
      // member and id define the weapon: never overwrite them when joining.
      u.squad = host.squad;
      u.personalMorale = Math.max(
        u.personalMorale,
        Math.min(70, Math.max(52, host.morale - 10)),
      );
      u.suppression = Math.min(25, u.suppression);
      u.tactic = 'advance';
      u.retreatUntil = 0;
      u.decisionIn = 0.5;
      u.regroupedAt = s.time;
      u.regroupProgress = 0;
      u.regroupHost = undefined;
      u.conflictUntil = 0;
      u.conflictTarget = undefined;
      u.conflictChecked = false;
      notify(
        s,
        `${u.side === 0 ? '我方' : '敌方'}撤退士兵加入附近部队`,
        'info',
        ([0, 1] as Side[]).filter((side) => visibleToSide(s, side, u)),
      );
    }
    return true;
  }
  u.regroupProgress = 0;
  u.regroupHost = undefined;
  const former =
    friends.find(
      (v) =>
        v.uid === u.conflictTarget &&
        v.squad === u.originalSquad &&
        Math.abs(v.x - u.x) < 120,
    ) ??
    friends
      .filter((v) => v.squad === u.originalSquad && Math.abs(v.x - u.x) < 65)
      .sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0];
  if (!former) {
    u.conflictTarget = undefined;
    u.conflictChecked = false;
    return false;
  }
  if (u.conflictTarget !== former.uid) {
    u.conflictTarget = former.uid;
    u.conflictChecked = false;
  }
  if (!u.conflictChecked && s.time >= (u.conflictNextAt ?? 0)) {
    u.conflictChecked = true;
    u.conflictNextAt = s.time + 3;
    const chance =
      u.personalMorale < 35 && former.personalMorale < 55
        ? Math.min(
            0.4,
            (35 - u.personalMorale) / 100 + (55 - former.personalMorale) / 200,
          )
        : 0;
    if (chance > 0 && rnd(s) < chance) {
      // One brief low-morale clash per encounter, not a new hostile faction.
      u.conflictUntil = s.time + 0.7;
      u.personalMorale = Math.max(0, u.personalMorale - 3);
      u.suppression = Math.min(100, u.suppression + 10);
      u.fire = 0.25;
      const point = muzzlePoint(u, former.x, 47);
      // The conflict shot must also clear the solid wreck between shoulder and muzzle.
      if (
        sceneryIntercept(s, u.x, u.y - 47, point.x, point.y, false, true, true)
      ) {
        u.fire = 0;
        return true;
      }
      u.muzzleX = point.x;
      u.muzzleY = point.y;
      u.shotAngle = Math.atan2(former.y - 27 - point.y, former.x - point.x);
      u.aimUntil = s.time + 1;
      u.lastAmmo = 'rifle';
      const duration = Math.max(
        0.04,
        Math.hypot(former.x - point.x, former.y - 27 - point.y) /
          FLIGHT.rifle.speed,
      );
      s.projectiles.push({
        uid: ++s.uid,
        sourceUid: u.uid,
        side: u.side,
        targetUid: former.uid,
        x: point.x,
        y: point.y,
        startX: point.x,
        startY: point.y,
        tx: former.x,
        ty: former.y - 27,
        base: null,
        damage: 3,
        radius: 0,
        life: duration,
        total: duration,
        ammunition: 'rifle',
        tracer: true,
      });
      notify(
        s,
        `${u.side === 0 ? '我方' : '敌方'}低士气士兵与原部队发生冲突`,
        'warn',
        ([0, 1] as Side[]).filter((side) => visibleToSide(s, side, u)),
      );
    }
  }
  if (s.time < (u.conflictUntil ?? 0)) {
    u.moving = false;
    u.pose = 'idle';
    u.facing = Math.sign(former.x - u.x) || u.facing;
    return true;
  }
  return false;
}

// A bomber releases a bounded salvo at fixed forward landing points.
function fireBombRun(s: GameState, u: Unit) {
  const c = CARDS[u.id],
    dir = u.side === 0 ? 1 : -1;
  if (u.bombsLeft === undefined) {
    const contact = s.units.some(
      (v) =>
        v.side !== u.side &&
        isCombatant(v) &&
        !CARDS[v.id].air &&
        visibleToSide(s, u.side, v) &&
        (v.x - u.x) * dir >= 0 &&
        (v.x - u.x) * dir <= 180,
    );
    const baseX = u.side === 0 ? W - 70 : 70;
    const baseContact = (baseX - u.x) * dir >= 0 && (baseX - u.x) * dir <= 180;
    if (!contact && !baseContact) return;
    u.bombsLeft = c.sortieAmmo ?? 6;
  }
  if (u.bombsLeft <= 0 || u.cooldown > 0 || u.shots >= (c.sortieAmmo ?? 6))
    return;
  const sx = u.x,
    sy = u.y + 10;
  const tx = sx + dir * 160;
  const ty = ground(s, tx) - 8;
  const total = Math.max(0.5, Math.sqrt(Math.max(0, (2 * (ty - sy)) / 800)));
  u.bombsLeft--;
  u.cooldown = c.rate!;
  u.shots++;
  u.lastCombatShotAt = s.time;
  u.lastAmmo = 'mortar';
  u.fire = 0.12;
  u.muzzleX = sx;
  u.muzzleY = sy;
  u.shotAngle = Math.atan2(ty - sy, tx - sx);
  s.projectiles.push({
    uid: ++s.uid,
    sourceUid: u.uid,
    side: u.side,
    x: sx,
    y: sy,
    startX: sx,
    startY: sy,
    tx,
    ty,
    targetUid: null,
    base: null,
    // This value makes the shared parabola y = startY + (ty-startY)*t*t.
    arc: Math.max(0, (ty - sy) / 4),
    total,
    life: total,
    guided: false,
    shell: true,
    ammunition: 'mortar',
    effect: 'artillery',
    damage: c.damage! * (s.players[u.side].morale > 0 ? 1.35 : 1),
    radius: c.radius ?? 42,
    armorMultiplier: c.armorMultiplier,
    infantryMultiplier: c.infantryMultiplier,
    baseMultiplier: c.baseMultiplier,
    tracer: false,
  });
}

function moveAirTo(u: Unit, x: number, y: number, speed: number, dt: number) {
  const dx = x - u.x,
    dy = y - u.y,
    distance = Math.hypot(dx, dy);
  const step = Math.min(distance, speed * dt);
  if (distance > 0.01) {
    u.x += (dx / distance) * step;
    u.y += (dy / distance) * step;
    if (Math.abs(dx) > 0.5) u.facing = Math.sign(dx);
  }
  u.moving = step > 0.01;
  return distance <= speed * dt + 1;
}
function flyTransport(s: GameState, u: Unit, dt: number) {
  const c = CARDS[u.id],
    dir = u.side === 0 ? 1 : -1;
  u.airlift ??= {
    x: safeLanding(s, defaultLanding(s, u.side)),
    phase: 'approach',
    dropped: 0,
    nextAt: s.time,
  };
  const flight = u.airlift;
  if (flight.phase === 'exit') {
    moveAirTo(
      u,
      u.side === 0 ? -200 : W + 200,
      c.altitude ?? 154,
      c.speed!,
      dt,
    );
    if (u.x < -150 || u.x > W + 150) {
      u.hp = 0;
      u.destroyed = true;
      u.deadFor = 0;
    }
    return;
  }
  const cargoSize = CARDS[c.airlift!].members ?? 5;
  const ropeX =
    flight.x +
    dir * (Math.min(cargoSize - 1, flight.dropped) - 2) * SQUAD_SPACING;
  if (flight.phase === 'approach') {
    if (
      moveAirTo(
        u,
        ropeX,
        Math.min(c.altitude ?? 154, ground(s, ropeX) - 150),
        c.speed!,
        dt,
      )
    ) {
      // Terrain may have changed during flight; correct once, before unloading starts.
      flight.x = safeLanding(s, flight.x);
      flight.phase = 'unload';
      flight.nextAt = s.time + 0.65;
    }
    return;
  }
  const settled = moveAirTo(u, ropeX, ground(s, ropeX) - 130, 85, dt);
  if (flight.dropped >= cargoSize) {
    if (
      !s.units.some((v) => v.squad === flight.squad && v.hp > 0 && v.rappelling)
    )
      flight.phase = 'exit';
    return;
  }
  if (!settled || s.time < flight.nextAt) return;
  const next = s.units.length;
  spawnUnit(s, u.side, c.airlift!, ropeX, {
    member: flight.dropped,
    squad: flight.squad,
  });
  const soldier = s.units[next];
  flight.squad = soldier.squad;
  soldier.y = u.y + 58;
  soldier.rappelling = true;
  soldier.pose = 'climb';
  soldier.cooldown = 0.7;
  soldier.rapidUntil = 0;
  flight.dropped++;
  flight.nextAt = s.time + 0.85;
}
function detonateFpv(s: GameState, u: Unit, x: number, y: number) {
  const c = CARDS[u.id];
  u.hp = 0;
  u.destroyed = true;
  u.deadFor = 0;
  u.moving = false;
  const wreck: Wreck = {
    id: u.uid,
    cardId: u.id,
    side: u.side,
    facing: u.facing,
    x,
    y,
    angle: 0,
    age: 0,
    falling: y < ground(s, x) - 35,
    vx: u.facing * 12,
    vy: 0,
  };
  if (!wreck.falling)
    Object.assign(
      wreck,
      wreckContact((px) => ground(s, px), wreck),
    );
  s.wrecks.push(wreck);
  explode(
    s,
    x,
    y,
    c.radius!,
    c.damage!,
    u.side,
    0,
    c.armorMultiplier,
    'grenade',
    c.infantryMultiplier,
  );
}
function flyAirPatrol(s: GameState, u: Unit, dt: number) {
  const c = CARDS[u.id],
    sideDir = u.side === 0 ? 1 : -1;
  u.flightUntil ??= s.time + c.patrolTime!;
  const groundFriends = s.units.filter(
    (v) => v !== u && v.side === u.side && isCombatant(v) && !CARDS[v.id].air,
  );
  const localFront = groundFriends.length
    ? Math.max(...groundFriends.map((v) => (u.side === 0 ? v.x : W - v.x)))
    : 680;
  const forward = Math.max(900, Math.min(W - 650, localFront + 220));
  const rear = Math.max(280, forward - 760);
  const local = u.side === 0 ? u.x : W - u.x;
  if (s.time >= u.flightUntil) u.patrolExiting = true;
  if (u.patrolExiting) u.patrolDir = -sideDir;
  else if (local >= forward) u.patrolDir = -sideDir;
  else if (local <= rear) u.patrolDir = sideDir;
  const goal = u.patrolExiting
    ? u.side === 0
      ? -200
      : W + 200
    : (u.patrolDir === sideDir ? forward : rear) * sideDir +
      (u.side === 0 ? 0 : W);
  moveAirTo(
    u,
    goal,
    c.altitude ?? 140,
    c.speed! * (s.players[u.side].morale > 0 ? 1.2 : 1),
    dt,
  );
  u.facing = u.patrolDir;
  u.moving = true;
}
function flyFpv(s: GameState, u: Unit, dt: number) {
  const c = CARDS[u.id],
    dir = u.side === 0 ? 1 : -1;
  if (s.time >= (u.flightUntil ?? Infinity)) {
    finishDeath(s, u, u.side);
    return;
  }
  if (u.cooldown > 0) {
    u.moving = false;
    return;
  }
  if (!u.fpvLock) {
    const target = s.units
      .filter(
        (v) =>
          v.side !== u.side &&
          isCombatant(v) &&
          !CARDS[v.id].air &&
          visibleToSide(s, u.side, v) &&
          Math.abs(v.x - u.x) <= c.range!,
      )
      .sort(
        (a, b) =>
          Number(!CARDS[a.id].armored) - Number(!CARDS[b.id].armored) ||
          Number(!CARDS[a.id].vehicle) - Number(!CARDS[b.id].vehicle) ||
          Math.abs(a.x - u.x) - Math.abs(b.x - u.x),
      )[0];
    if (target)
      u.fpvLock = {
        uid: target.uid,
        x: target.x,
        y: target.y - bodyHeight(target),
      };
  }
  if (u.fpvLock) {
    const lock = u.fpvLock;
    const target = s.units.find((v) => v.uid === lock.uid && isCombatant(v));
    if (target && visibleToSide(s, u.side, target)) {
      lock.x = target.x;
      lock.y = target.y - bodyHeight(target);
    }
    const oldX = u.x,
      oldY = u.y;
    const arrived = moveAirTo(u, lock.x, lock.y, 260, dt);
    const pitch = Math.atan2(lock.y - oldY, Math.abs(lock.x - oldX));
    u.hullAngle = pitch * u.facing;
    let hit: { x: number; y: number; t: number } | null = sceneryIntercept(
      s,
      oldX,
      oldY,
      u.x,
      u.y,
      false,
      true,
    );
    for (const wall of s.walls) {
      if (wall.hp <= 0) continue;
      const t = segmentBox(oldX, oldY, u.x, u.y, {
        x: wall.x - wall.width / 2,
        y: ground(s, wall.x) - wall.height,
        w: wall.width,
        h: wall.height,
      });
      if (t !== null && (!hit || t < hit.t))
        hit = {
          t,
          x: oldX + (u.x - oldX) * t,
          y: oldY + (u.y - oldY) * t,
        };
    }
    if (hit) detonateFpv(s, u, hit.x, hit.y);
    else if (u.y >= ground(s, u.x) - 3) detonateFpv(s, u, u.x, ground(s, u.x));
    else if (arrived) detonateFpv(s, u, lock.x, lock.y);
    return;
  }
  const nextX = Math.max(420, Math.min(W - 420, u.x + dir * c.speed! * dt));
  // Do not snap a newly launched drone to the forward patrol boundary.
  const x =
    (nextX - u.x) * dir > c.speed! * dt + 1 ? u.x + dir * c.speed! * dt : nextX;
  let height = ground(s, x) - 130;
  for (const box of obstacleBoxes(s))
    if (box.x < x + 130 && box.x + box.w > x - 55)
      height = Math.min(height, box.y - 34);
  const y = u.y + Math.max(-80 * dt, Math.min(80 * dt, height - u.y));
  u.facing = dir;
  u.moving = Math.abs(x - u.x) > 0.01;
  u.x = x;
  u.y = y;
  u.hullAngle = 0;
}
export function tick(s: GameState, dt: number) {
  if (s.status !== 'playing') return;
  dt = Math.min(0.05, Math.max(0, dt));
  if (!dt) return;
  const airPositions = new Map(
    s.units
      .filter((u) => CARDS[u.id].air)
      .map((u) => [u.uid, { x: u.x, y: u.y }]),
  );
  s.time = Math.min(DURATION, s.time + dt);
  updateSquadOrders(s, dt);
  s.shake = Math.max(0, s.shake - dt * 24);
  for (const side of [0, 1] as Side[]) {
    const p = s.players[side];
    p.energy = Math.min(10, p.energy + dt / ENERGY_TIME);
    p.morale = Math.max(0, p.morale - dt);
    p.recon = Math.max(0, p.recon - dt);
    p.fortify = Math.max(0, p.fortify - dt);
    p.jam = Math.max(0, p.jam - dt);
    p.drawIn = Math.max(0, p.drawIn - dt);
  }
  s.visionIn -= dt;
  if (s.visionIn <= 0) {
    refreshVision(s);
    s.visionIn = 0.18;
  }
  s.aiIn -= dt;
  if (s.aiIn <= 0) {
    updateAI(s);
    s.aiIn = 0.75 + rnd(s) * 0.6;
  }
  for (const f of s.smokes) f.life -= dt;
  s.smokes = s.smokes.filter((f) => f.life > 0);
  for (const m of s.markers) {
    const c = ARTILLERY[m.kind ?? 'artillery'];
    m.timer -= dt;
    if (m.timer <= 0) {
      const x = m.impacts?.[m.wave] ?? m.x;
      explode(s, x, ground(s, x) - 8, c.radius, c.damage, m.side, c.baseScale);
      m.wave++;
      m.timer = c.interval;
    }
  }
  s.markers = s.markers.filter(
    (m) => m.wave < ARTILLERY[m.kind ?? 'artillery'].count,
  );
  for (const u of s.units) {
    if (u.hp <= 0) {
      u.deadFor -= dt;
      u.y = Math.min(ground(s, u.x), u.y + 110 * dt);
      continue;
    }
    if (u.wounded) {
      u.woundedTime += dt;
      u.bleedOut -= dt;
      u.fire = 0;
      u.secondaryFire = 0;
      u.moving = false;
      u.y = ground(s, u.x);
      u.healing = Math.max(0, u.healing - dt);
      if (
        u.woundedTime >= 1.5 &&
        u.hp >= u.maxHp * 0.4 &&
        u.rescueProgress >= 1.6
      )
        revive(u);
      else if (u.bleedOut <= 0) finishDeath(s, u, u.woundedBy);
      continue;
    }
    if (u.surrendered) {
      u.surrenderTime += dt;
      u.moving = false;
      u.fire = 0;
      u.secondaryFire = 0;
      u.y = ground(s, u.x);
      continue;
    }
    const c = weaponCard(u),
      dir = u.side === 0 ? 1 : -1,
      enemySide: Side = u.side === 0 ? 1 : 0,
      baseX = enemySide === 0 ? 70 : W - 70;
    if (u.rappelling) {
      u.fire = 0;
      u.secondaryFire = 0;
      u.moving = true;
      u.pose = 'climb';
      u.walk += dt * 6;
      u.y = Math.min(ground(s, u.x), u.y + 65 * dt);
      if (u.y >= ground(s, u.x)) {
        u.rappelling = false;
        u.pose = 'land';
        u.motion = 'land';
        u.motionTime = 0;
        u.motionDuration = 0.3;
        u.rapidUntil = s.time + 8;
      }
      continue;
    }
    const morale = s.players[u.side].morale > 0;
    u.injuryCooldown = Math.max(0, u.injuryCooldown - dt);
    u.cooldown -= dt;
    u.secondaryCooldown -= dt;
    u.secondaryFire = Math.max(0, u.secondaryFire - dt);
    u.suppression = Math.max(0, u.suppression - dt * 7);
    if (c.members) {
      prepareInfantry(s, u, dt);
      decideTactic(s, u, dt);
    }
    if (u.surrendered) continue;
    u.supportCooldown -= dt;
    u.healing = Math.max(0, u.healing - dt);
    if (u.repairTime > 0) {
      u.hp = Math.min(u.maxHp, u.hp + Math.min(dt, u.repairTime) * 20);
      u.repairTime = Math.max(0, u.repairTime - dt);
    }
    u.flash = Math.max(0, u.flash - dt);
    u.fire = Math.max(0, u.fire - dt);
    u.moving = false;
    const order = c.members ? infantryOrder(s, u) : s.players[u.side].order;
    if (c.airlift) {
      flyTransport(s, u, dt);
      continue;
    }
    if (u.id === 'fpv_drone') {
      flyFpv(s, u, dt);
      continue;
    }
    u.stepCooldown = Math.max(0, u.stepCooldown - dt);
    u.coverSearch -= dt;
    u.pose = c.members
      ? order === 'crouch'
        ? 'crouch'
        : order === 'prone'
          ? 'prone'
          : u.tactic === 'prone'
            ? 'prone'
            : u.tactic === 'crouch' ||
                u.tactic === 'cover' ||
                u.tactic === 'bound'
              ? 'crouch'
              : 'idle'
      : 'idle';
    if (c.members && u.climbing > 0) {
      u.cover = 0;
      const wall = s.walls.find((w) => w.uid === u.climbWall);
      if (!wall || wall.hp <= 0) {
        u.climbing = 0;
        if (wall) u.passedWalls.push(wall.uid);
        if (ground(s, u.x) - u.y > 3) beginDrop(u, u.facing, 0, true);
      } else {
        u.climbing = Math.max(0, u.climbing - dt);
        const progress = 1 - u.climbing / u.climbDuration;
        const travel = Math.sign(u.motionToX - u.climbFrom) || u.facing;
        const near = wall.x - travel * (wall.width / 2 + 6);
        const far = wall.x + travel * (wall.width / 2 + 6);
        const top = ground(s, wall.x) - wall.height - 1;
        // Lift at the near face, cross on the wall top, then lower at the far face.
        if (progress < 0.28) {
          const t = progress / 0.28;
          u.x = u.climbFrom + (near - u.climbFrom) * t;
          u.y = ground(s, u.climbFrom) + (top - ground(s, u.climbFrom)) * t;
        } else if (progress < 0.72) {
          u.x = near + (far - near) * ((progress - 0.28) / 0.44);
          u.y = top;
        } else {
          const t = (progress - 0.72) / 0.28;
          u.x = far + (u.motionToX - far) * t;
          u.y = top + (ground(s, u.motionToX) - top) * t;
        }
        u.facing = travel;
        u.pose = 'climb';
        u.walk += dt * 5;
        u.moving = true;
        if (u.climbing === 0) u.passedWalls.push(wall.uid);
        continue;
      }
    }
    if (
      c.members &&
      u.motion === 'ground' &&
      ground(s, u.x) - u.y > DROP_HEIGHT
    )
      beginDrop(u, dir, 0, true);
    if (c.members && traverse(s, u, dt)) continue;
    if (c.members && !c.air && evadeArtillery(s, u, dt)) continue;
    if (c.members && u.tactic === 'retreat' && !orderedWithdrawal(s, u)) {
      if (recoverRetreat(s, u, dt)) continue;
      u.cover = 0;
      u.coverGoal = null;
      u.fire = 0;
      u.pose = 'run';
      u.facing = -dir;
      moveSoldier(s, u, -dir, c.speed! * u.pace * 1.2 * (morale ? 1.2 : 1), dt);
      if (!u.moving && u.motion === 'ground') u.pose = 'idle';
      continue;
    }

    if (c.emplacement && towEmplacement(s, u, dt)) continue;

    if (c.patrolTime) flyAirPatrol(s, u, dt);
    else if (c.air && c.sortie) {
      u.x += dir * c.speed! * (morale ? 1.2 : 1) * dt;
      u.facing = dir;
      u.moving = true;
    }
    if (c.attackRun === 'bomb') {
      fireBombRun(s, u);
      u.y = c.altitude ?? AIR_ALTITUDE;
      continue;
    }
    if (c.observer) {
      const front = s.units.filter(
        (v) =>
          v !== u && v.side === u.side && isCombatant(v) && !CARDS[v.id].air,
      );
      const frontX = front.length
        ? dir === 1
          ? Math.max(...front.map((v) => v.x))
          : Math.min(...front.map((v) => v.x))
        : dir === 1
          ? 650
          : W - 650;
      const goal = Math.max(250, Math.min(W - 250, frontX + dir * 180));
      const change = Math.max(
        -c.speed! * (morale ? 1.2 : 1) * dt,
        Math.min(c.speed! * (morale ? 1.2 : 1) * dt, goal - u.x),
      );
      u.x += change;
      u.moving = Math.abs(change) > 0.1;
      u.facing = Math.sign(change) || dir;
      u.y = c.altitude ?? AIR_ALTITUDE;
      u.fire = 0;
      continue;
    }

    const range = unitRange(s, u);
    let treating = serviceVehicle(s, u);
    if (c.heal) {
      const patient = s.units
        .filter(
          (v) =>
            v.side === u.side &&
            canTakeDamage(v) &&
            (v.wounded || v.hp < v.maxHp) &&
            CARDS[v.id].members &&
            Math.abs(v.x - u.x) <= 140,
        )
        .sort(
          (a, b) =>
            Number(b.wounded) - Number(a.wounded) ||
            a.hp / a.maxHp - b.hp / b.maxHp,
        )[0];
      if (patient) {
        treating = true;
        u.pose = 'crouch';
        if (patient.wounded && Math.abs(patient.x - u.x) > 64) {
          u.pose = 'walk';
          moveSoldier(
            s,
            u,
            Math.sign(patient.x - u.x),
            c.speed! * u.pace * 0.8,
            dt,
          );
        } else if (u.supportCooldown <= 0) {
          if (patient.wounded) patient.rescueProgress += 0.8;
          patient.hp = Math.min(patient.maxHp, patient.hp + c.heal);
          patient.healing = 0.6;
          u.healing = 0.6;
          u.supportCooldown = 0.8;
        }
      }
    }
    const candidates = s.units
      .filter(
        (v) =>
          v.side !== u.side &&
          isCombatant(v) &&
          visibleToSide(s, u.side, v) &&
          (!CARDS[v.id].air || c.antiAir) &&
          (!c.airOnly || CARDS[v.id].air) &&
          (!c.armorOnly || CARDS[v.id].armored || CARDS[v.id].vehicle) &&
          (!c.patrolTime || !u.patrolExiting) &&
          (!c.sortie ||
            (v.x - u.x) * (c.patrolTime ? u.facing : dir) >
              muzzleOffset(u) + 8) &&
          (c.attackRun !== 'strafe' ||
            (v.x - u.x) * dir > muzzleOffset(u) + 16) &&
          Math.abs(v.x - u.x) <= range &&
          Math.abs(v.x - u.x) >= (c.minRange ?? 0),
      )
      .sort(
        (a, b) =>
          (c.attackRun === 'strafe' ||
          ((c.armorMultiplier ?? 1) < 0.8 &&
            isCoverBullet(ammunition(u.id, u.member)))
            ? Number(!CARDS[a.id].members) - Number(!CARDS[b.id].members)
            : modelOf(u.id) === 'sniper'
              ? Number(!CARDS[a.id].members) - Number(!CARDS[b.id].members)
              : modelOf(u.id) === 'tank' || (c.armorMultiplier ?? 1) > 1.2
                ? Number(!CARDS[a.id].armored) - Number(!CARDS[b.id].armored)
                : 0) || Math.abs(a.x - u.x) - Math.abs(b.x - u.x),
      );
    if (candidates[0])
      u.lastThreat = {
        x: candidates[0].x,
        y: candidates[0].y,
        until: s.time + 3,
      };
    // Observers hold their useful sight line instead of marching into rifle range.
    const observing =
      u.id === 'scouts' &&
      order !== 'rush' &&
      !candidates.length &&
      s.units.some(
        (v) =>
          v.side !== u.side &&
          isCombatant(v) &&
          !CARDS[v.id].air &&
          Math.abs(v.x - u.x) <= 600 &&
          visibleToSide(s, u.side, v),
      );
    const threat =
      candidates[0] ??
      (u.lastThreat && u.lastThreat.until > s.time ? u.lastThreat : null);
    let target = candidates.find(
      (v) => firingHeight(s, u, v.x, v.y - bodyHeight(v)) !== null,
    );
    if (
      target &&
      CARDS[target.id].members &&
      isCoverBullet(ammunition(u.id, u.member))
    ) {
      const protectedTarget = target;
      target =
        candidates.find(
          (v) =>
            CARDS[v.id].infantryAbility === 'guard' &&
            !v.moving &&
            v.motion === 'ground' &&
            (v.stillFor ?? 0) >= 0.65 &&
            Math.abs(v.x - protectedTarget.x) <= 90 &&
            firingHeight(s, u, v.x, v.y - bodyHeight(v)) !== null,
        ) ?? target;
    }
    if (
      target &&
      c.infantryAbility === 'smoke_assault' &&
      !u.smokeAssaultSpent &&
      !CARDS[target.id].air &&
      Math.abs(target.x - u.x) <= 140
    ) {
      s.smokes.push({ x: u.x, life: 4, side: u.side });
      for (const mate of s.units.filter(
        (v) => v.side === u.side && v.squad === u.squad,
      )) {
        mate.smokeAssaultSpent = true;
        if (isCombatant(mate) && Math.abs(mate.x - u.x) <= 96)
          mate.assaultBurstUntil = s.time + 4;
      }
    }
    const baseInRange =
      !target &&
      !c.airOnly &&
      !c.armorOnly &&
      (c.attackRun !== 'strafe' ||
        (baseX - u.x) * dir > muzzleOffset(u) + 16) &&
      Math.abs(baseX - u.x) <= range &&
      Math.abs(baseX - u.x) >= (c.minRange ?? 0) &&
      firingHeight(s, u, baseX, ground(s, baseX) - 25) !== null;
    // A howitzer's dead zone excludes that target, not a separate valid distant target.
    const closeThreat =
      c.minRange &&
      !(
        (c.emplacement === 'howitzer' || u.id === 'tow_ifv') &&
        (target || baseInRange)
      )
        ? s.units.find(
            (v) =>
              v.side !== u.side &&
              isCombatant(v) &&
              visibleToSide(s, u.side, v) &&
              !CARDS[v.id].air &&
              Math.abs(v.x - u.x) < c.minRange!,
          )
        : null;
    const withdrawing = !!(
      c.members &&
      (u.withdrawUntil ?? 0) > s.time &&
      u.withdrawGoal !== undefined &&
      order !== 'hold' &&
      order !== 'rush'
    );
    const withdrawalThreat = withdrawing
      ? (target ??
        s.units
          .filter(
            (v) =>
              v.side !== u.side &&
              !CARDS[v.id].air &&
              isCombatant(v) &&
              visibleToSide(s, u.side, v) &&
              Math.abs(v.x - u.x) <= 560,
          )
          .sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0])
      : undefined;
    const withdrawalCoverPossible =
      withdrawalThreat &&
      s.units.some(
        (v) =>
          v !== u &&
          v.squad === u.squad &&
          v.side === u.side &&
          isCombatant(v) &&
          CARDS[v.id].members &&
          Math.abs(v.x - withdrawalThreat.x) <= unitRange(s, v) &&
          firingHeight(
            s,
            v,
            withdrawalThreat.x,
            withdrawalThreat.y - bodyHeight(withdrawalThreat),
          ) !== null,
      );
    const withdrawalStep =
      withdrawing &&
      Math.abs(u.withdrawGoal! - u.x) > 0.5 &&
      (!withdrawalThreat ||
        (Math.floor((s.time - u.withdrawStartedAt!) / 0.85) % 2 ===
          u.withdrawGroup &&
          (!withdrawalCoverPossible ||
            coveringMate(s, u, withdrawalThreat, true))));
    if (
      c.members &&
      threat &&
      !withdrawing &&
      order !== 'rush' &&
      !c.indirect &&
      !treating
    ) {
      if (
        u.coverGoal !== null &&
        (craterCover(s, u.coverGoal, threat.x) < 0.2 ||
          Math.abs(threat.x - u.coverGoal) > range ||
          !canFireFromCover(s, u, u.coverGoal, threat))
      )
        u.coverGoal = null;
      u.cover = craterCover(s, u.x, threat.x);
      // Hold an already useful firing position instead of climbing out or bounding past it.
      if (
        u.coverGoal === null &&
        u.cover > 0.2 &&
        canFireFromCover(s, u, u.x, threat)
      )
        u.coverGoal = u.x;
      if (u.coverGoal === null && order !== 'hold' && u.coverSearch <= 0) {
        u.coverGoal = seekCover(s, u, threat);
        u.coverSearch = 0.7;
      }
    } else {
      u.cover = 0;
      u.coverGoal = null;
    }
    const coverShot =
      !target && order !== 'hold' && order !== 'rush'
        ? enemyCoverShot(s, u, candidates[0])
        : null;
    const blockedContact = !!(
      c.members &&
      !c.indirect &&
      !target &&
      !baseInRange &&
      !closeThreat &&
      threat &&
      order !== 'rush' &&
      Math.abs(threat.x - u.x) <= range + 15
    );
    if (
      blockedContact &&
      !coverShot &&
      order !== 'hold' &&
      !treating &&
      !withdrawing
    ) {
      if (
        u.firingGoal != null &&
        ((!u.firingTransit && !canFireFromCover(s, u, u.firingGoal, threat!)) ||
          Math.abs(u.firingGoal - u.x) <= 1)
      )
        u.firingGoal = null;
      if ((u.firingSearchAt ?? 0) <= s.time && u.firingGoal == null) {
        u.firingGoal = nearbyFiringPosition(s, u, threat!);
        u.firingTransit = false;
        if (u.firingGoal === null) {
          const toward = Math.sign(threat!.x - u.x);
          const standoff = Math.max(140, (c.minRange ?? 0) + 25);
          const available = Math.abs(threat!.x - u.x) - standoff;
          if (available > 4) {
            // Walk a depth passage beside the obstacle, then reassess the firing ray.
            u.firingGoal = u.x + toward * Math.min(32, available);
            u.firingTransit = true;
          }
        }
        u.firingSearchAt = s.time + 0.7;
      }
    } else u.firingGoal = null;
    if (
      (u.dispersionUntil ?? 0) <= s.time ||
      (u.dispersionGoal !== undefined && Math.abs(u.dispersionGoal - u.x) <= 1)
    )
      u.dispersionGoal = undefined;
    const moveGoal = withdrawing
      ? u.withdrawGoal!
      : (u.coverGoal ?? u.firingGoal ?? u.dispersionGoal ?? null);
    const seeking =
      !withdrawing && moveGoal !== null && Math.abs(moveGoal - u.x) > 0.5;
    // A ready weapon gets a short stable firing window before another ground move.
    const contactFire = !!(
      c.members &&
      target &&
      (u.cooldown <= 0 ||
        s.time - (u.lastCombatShotAt ?? -Infinity) <
          Math.min(0.18, c.rate! * 0.35))
    );
    if (!seeking && threat && (u.exposedUntil ?? 0) > s.time) u.pose = 'idle';
    if (threat && c.members) {
      if ((u.aimUntil ?? 0) <= s.time) u.readyAt = s.time;
      u.aimUntil = s.time + 2.5;
    }
    if (observing) u.pose = 'prone';
    if (u.cover > 0.2 && !seeking && threat) {
      // Keep the firing stance through a whole engagement, not one reload cycle.
      if (firingHeight(s, u, threat.x, threat.y - 20) === 47)
        u.exposedUntil = s.time + 2.5;
      u.pose =
        (u.exposedUntil ?? 0) > s.time
          ? 'idle'
          : u.tactic === 'prone' || order === 'prone'
            ? 'prone'
            : 'crouch';
    }
    let bounding =
      c.members &&
      !withdrawing &&
      !contactFire &&
      order === 'advance' &&
      u.tactic === 'bound' &&
      u.cover <= 0.2 &&
      u.coverGoal === null &&
      target &&
      Math.abs(target.x - u.x) > range * 0.62 &&
      coveringMate(s, u, target) &&
      s.time >= (u.boundRestUntil ?? 0);
    if (bounding) {
      u.boundStartedAt ??= s.time;
      if (s.time - u.boundStartedAt >= 0.55 + (u.uid % 3) * 0.08) {
        bounding = false;
        u.boundRestUntil = s.time + 1.35;
        u.boundStartedAt = undefined;
      }
    } else u.boundStartedAt = undefined;
    const retreating = c.members && u.tactic === 'retreat';
    if (modelOf(u.id) === 'tank' || u.id === 'tow_ifv' || c.armorOnly)
      fireCoax(s, u);
    if (
      (c.damage ?? 0) > 0 &&
      (!c.armorOnly || !!target) &&
      (target || coverShot || baseInRange) &&
      (!seeking || contactFire) &&
      !closeThreat &&
      !treating &&
      (!bounding || contactFire) &&
      !withdrawalStep &&
      !retreating
    ) {
      let tx = target ? target.x : coverShot ? coverShot.x : baseX;
      let ty = target
        ? target.y - bodyHeight(target)
        : coverShot
          ? coverShot.y
          : ground(s, baseX) - 25;
      if (target && c.antiAir && !c.guided && CARDS[target.id].air) {
        const speed = FLIGHT[ammunition(u.id, u.member)].speed;
        const travel = Math.min(1, Math.hypot(tx - u.x, ty - u.y) / speed);
        tx += target.vx * travel;
        ty += target.vy * travel;
      }
      if (coverShot) {
        u.pose = 'idle';
        u.exposedUntil = s.time + 2.5;
      }
      if (c.indirect && u.cooldown <= 0) {
        const scatter = u.id === 'precision' ? 14 : c.emplacement ? 42 : 26;
        tx += (rnd(s) - 0.5) * scatter * 2;
        ty = ground(s, tx) - 8;
      }
      if (c.indirect && !c.vehicle) u.pose = 'crouch';
      if (
        u.cooldown <= 0 &&
        !(
          c.members &&
          ['idle', 'walk'].includes(u.pose) &&
          ammunition(u.id, u.member) === 'rifle' &&
          s.time - (u.readyAt ?? -100) < 0.24
        ) &&
        (c.sortieAmmo === undefined || u.shots < c.sortieAmmo)
      ) {
        if (firingHeight(s, u, tx, ty) === 47) {
          u.pose = 'idle';
          u.exposedUntil = s.time + 2.5;
        }
        const point = muzzlePoint(u, tx),
          sx = point.x,
          sy = point.y;
        if (
          coverShot ||
          c.indirect ||
          u.id === 'javelin' ||
          !terrainIntercept(
            s,
            sx,
            sy,
            tx,
            ty,
            isCoverBullet(ammunition(u.id, u.member)),
          )
        ) {
          const closeBurst =
            (u.assaultBurstUntil ?? 0) > s.time &&
            target &&
            Math.abs(target.x - u.x) <= 140;
          const ambush =
            target &&
            CARDS[target.id].members &&
            (c.infantryAbility === 'ambush' || c.infantryAbility === 'elite') &&
            (u.ambushFor ?? 0) >= (c.infantryAbility === 'elite' ? 1 : 2);
          const openingDamage = ambush
            ? c.infantryAbility === 'elite'
              ? 1.5
              : 1.8
            : 1;
          u.cooldown =
            c.burstSize && (u.shots + 1) % c.burstSize === 0
              ? c.burstPause!
              : c.rate! * (closeBurst ? 0.65 : 1);
          u.ambushFor = 0;
          u.rapidUntil = 0;
          u.fire = 0.25;
          const ap = !!(c.penetration && target && CARDS[target.id].armored);
          const kind: Ammunition = ap ? 'ap' : ammunition(u.id, u.member),
            flight = FLIGHT[kind];
          const total = Math.max(
            c.indirect ? 2 : flight.minimum,
            Math.abs(tx - sx) / flight.speed,
          );
          u.facing = c.sortie
            ? c.patrolTime
              ? u.patrolDir
              : dir
            : Math.sign(tx - u.x) || dir;
          u.shots++;
          if (target) u.lastCombatShotAt = s.time;
          if (coverShot) {
            u.breachShots =
              u.breachPropId === coverShot.propId
                ? (u.breachShots ?? 0) + 1
                : 1;
            u.breachPropId = coverShot.propId;
          }
          u.lastAmmo = kind;
          u.muzzleX = sx;
          u.muzzleY = sy;
          u.shotAngle = Math.atan2(ty - sy - 4 * flight.arc, tx - sx);
          muzzleParticles(s, u, kind, sx, sy);
          s.projectiles.push({
            uid: ++s.uid,
            guided: c.guided && !c.indirect,
            topAttack: u.id === 'javelin',
            loftX:
              u.id === 'javelin'
                ? sx +
                  Math.sign(tx - sx) * Math.min(160, Math.abs(tx - sx) * 0.25)
                : undefined,
            loftY: u.id === 'javelin' ? Math.min(sy, ty) - 180 : undefined,
            speed: c.guided && c.airOnly ? 1250 : undefined,
            infantryMultiplier: c.infantryMultiplier,
            baseMultiplier: c.baseMultiplier,
            shell: !!c.indirect,
            effect: ap
              ? 'penetration'
              : c.indirect
                ? 'artillery'
                : kind === 'grenade'
                  ? 'grenade'
                  : 'he',
            sourceUid: u.uid,
            x: sx,
            y: sy,
            tx,
            ty,
            side: u.side,
            targetUid: target?.uid ?? null,
            base: target || coverShot ? null : enemySide,
            damage:
              ((ap ? c.penetration! : c.damage!) / (c.members ?? 1)) *
              openingDamage *
              (morale ? 1.35 : 1) *
              (c.trait === 'close_assault' && Math.abs(tx - u.x) < 200
                ? 1.2
                : 1) *
              (modelOf(u.id) === 'sniper' && target && CARDS[target.id].armored
                ? 0.5
                : 1),
            armorMultiplier: c.armorMultiplier,
            ammunition: kind,
            tracer: isTracer(kind, u.shots),
            trailIn: 0,
            arc: flight.arc,
            radius: ap ? 0 : (c.radius ?? 0),
            life: c.guided && !c.indirect ? 8 : total,
            total,
            startX: sx,
            startY: sy,
          });
          if (c.oneWay) {
            u.hp = 0;
            u.deadFor = 0;
            u.fire = 0;
          }
        } else if (c.members && u.pose === 'prone') u.pose = 'crouch';
      }
    } else if (
      !treating &&
      (withdrawalStep ||
        seeking ||
        bounding ||
        retreating ||
        (!!closeThreat &&
          (!c.members ||
            (u.squadOrder !== 'hold' && u.squadOrder !== 'watch'))) ||
        (!withdrawing &&
          !observing &&
          !target &&
          !baseInRange &&
          !blockedContact &&
          (!c.members || order !== 'hold')))
    ) {
      if (c.members)
        u.pose =
          order === 'rush' || bounding || retreating
            ? 'run'
            : order === 'crouch' || (withdrawing && order !== 'prone')
              ? 'crouch'
              : order === 'prone'
                ? 'prone'
                : u.tactic === 'prone'
                  ? 'prone'
                  : u.tactic === 'crouch' || u.tactic === 'cover'
                    ? 'crouch'
                    : 'walk';
      const orderSpeed = c.members
        ? u.pose === 'run'
          ? 1.7
          : u.pose === 'crouch'
            ? 0.55
            : u.pose === 'prone'
              ? 0.25
              : 1
        : 1;
      const speed =
        c.speed! *
        u.pace *
        orderSpeed *
        (!withdrawing &&
        !retreating &&
        !closeThreat &&
        (u.rapidUntil ?? 0) > s.time
          ? 1.8
          : 1) *
        (morale ? 1.2 : 1) *
        (u.slowedUntil > s.time ? 0.5 : 1);
      const moveDir = withdrawing
        ? Math.sign(u.withdrawGoal! - u.x)
        : retreating
          ? -dir
          : closeThreat
            ? u.x > closeThreat.x
              ? 1
              : -1
            : seeking
              ? Math.sign(moveGoal! - u.x)
              : dir;
      if (c.members) {
        // Our atlas turns to travel; never keep a muzzle flash facing the old target.
        u.fire = 0;
        u.secondaryFire = 0;
        moveSoldier(
          s,
          u,
          moveDir,
          seeking || withdrawing
            ? Math.min(speed, Math.abs(moveGoal! - u.x) / dt)
            : speed,
          dt,
          !target || withdrawing,
        );
      } else if (!c.sortie && !c.static && (!c.vehicle || order !== 'hold')) {
        const before = u.x;
        u.x = Math.max(55, Math.min(W - 55, u.x + moveDir * speed * dt));
        u.moving = Math.abs(u.x - before) > 0.001;
        if (u.moving) u.facing = moveDir;
      }
    }
    if (c.armored && c.vehicleSupport !== 'mine_clear') {
      for (const wall of s.walls) {
        if (wall.hp > 0 && Math.abs(u.x - wall.x) < 26) {
          wall.hp = 0;
          burst(s, wall.x, ground(s, wall.x) - 12, 22);
        }
      }
    }
    if (c.armored || c.vehicle) {
      const contact = vehicleContact(s, u.x, u.id),
        blend = 1 - Math.exp(-dt * 9);
      u.y += (contact.y - u.y) * blend;
      u.hullAngle += (contact.angle - u.hullAngle) * blend;
    } else if (!c.members || u.motion === 'ground')
      u.y = c.air ? (c.altitude ?? AIR_ALTITUDE) : ground(s, u.x);
  }
  for (const u of s.units) {
    const previous = airPositions.get(u.uid);
    if (previous) {
      u.vx = (u.x - previous.x) / dt;
      u.vy = (u.y - previous.y) / dt;
    }
  }
  for (const p of s.projectiles) {
    const oldX = p.x,
      oldY = p.y;
    p.life -= dt;
    if (p.guided) {
      const tracked = s.units.find(
        (u) => u.uid === p.targetUid && canTakeDamage(u),
      );
      if (tracked && visibleToSide(s, p.side, tracked)) {
        p.tx = tracked.x;
        p.ty = tracked.y - bodyHeight(tracked);
      }
      const climbing = p.topAttack && !p.lofted;
      const goalX = climbing ? p.loftX! : p.tx,
        goalY = climbing ? p.loftY! : p.ty;
      const dx = goalX - p.x,
        dy = goalY - p.y,
        dist = Math.hypot(dx, dy),
        step = (p.speed ?? FLIGHT[p.ammunition ?? 'rocket'].speed) * dt;
      if (p.life <= 0) {
        continue;
      }
      p.heading = Math.atan2(dy, dx);
      if (dist <= step) {
        p.x = goalX;
        p.y = goalY;
        if (climbing) p.lofted = true;
        else p.life = 0;
      } else {
        p.x += (dx / dist) * step;
        p.y += (dy / dist) * step;
      }
    } else {
      const t = 1 - Math.max(0, p.life) / p.total;
      p.x = p.startX + (p.tx - p.startX) * t;
      p.y = p.startY + (p.ty - p.startY) * t - 4 * t * (1 - t) * (p.arc ?? 0);
    }
    if (p.ammunition === 'rocket') {
      p.trailIn = (p.trailIn ?? 0) - dt;
      if (p.trailIn <= 0) {
        p.trailIn = 0.035;
        const life = 0.22;
        s.particles.push({
          kind: 'smoke',
          x: oldX,
          y: oldY,
          vx: 0,
          vy: -6,
          life,
          maxLife: life,
          color: '#969b8b',
          size: 3,
        });
      }
    }
    const impact = projectileIntercept(s, p, oldX, oldY, p.x, p.y);
    const friendly = retreatingFriendlyHit(s, p, oldX, oldY, p.x, p.y);
    if (p.tracer) {
      const end =
        friendly &&
        (!impact ||
          Math.hypot(friendly.x - oldX, friendly.y - oldY) <
            Math.hypot(impact.x - oldX, impact.y - oldY))
          ? friendly
          : (impact ?? p);
      s.particles.push({
        kind: 'tracer',
        x: oldX,
        y: oldY,
        endX: end.x,
        endY: end.y,
        vx: 0,
        vy: 0,
        life: 0.065,
        maxLife: 0.065,
        color: '#f8d28e',
        size: 1,
      });
    }
    if (
      friendly &&
      (!impact ||
        Math.hypot(friendly.x - oldX, friendly.y - oldY) <
          Math.hypot(impact.x - oldX, impact.y - oldY))
    ) {
      p.life = 0;
      p.x = friendly.x;
      p.y = friendly.y;
      if (s.time - friendly.u.friendlyWarnAt > 3) {
        notify(s, '撤退队员进入友军射线，发生误伤', 'warn', [friendly.u.side]);
        friendly.u.friendlyWarnAt = s.time;
      }
      hitUnit(s, friendly.u, p.damage, p.side);
      bulletImpact(s, p.x, p.y, 'cloth', Math.sign(p.tx - p.startX));
      continue;
    }
    if (impact) {
      p.life = 0;
      if (p.radius)
        explode(
          s,
          impact.x,
          impact.y,
          p.radius,
          p.damage,
          p.side,
          p.baseMultiplier ?? 1,
          p.armorMultiplier,
          p.effect,
          p.infantryMultiplier,
        );
      else {
        damageScenery(s, impact.x, impact.y, 3, p.damage);
        bulletImpact(
          s,
          impact.x,
          impact.y,
          p.ammunition === 'ap' ? 'armor' : 'soil',
          Math.sign(p.tx - p.startX),
        );
      }
      continue;
    }
    if (p.life <= 0) {
      let connected = !!p.radius;
      if (p.radius)
        explode(
          s,
          p.tx,
          p.ty,
          p.radius,
          p.damage,
          p.side,
          p.baseMultiplier ?? 1,
          p.armorMultiplier,
          p.effect,
          p.infantryMultiplier,
        );
      else if (p.targetUid !== null) {
        const u = s.units.find((u) => u.uid === p.targetUid);
        if (
          u &&
          canTakeDamage(u) &&
          Math.abs(u.x - p.tx) <
            (CARDS[u.id].armored || CARDS[u.id].vehicle
              ? armorHalf(u.id) + 8
              : CARDS[u.id].air
                ? 80
                : 18) &&
          !projectileIntercept(s, p, p.x, p.y, u.x, u.y - bodyHeight(u))
        ) {
          connected = true;
          const cover =
            CARDS[u.id].members && u.motion === 'ground' && !u.climbing
              ? craterCover(s, u.x, p.startX) *
                (p.startY < u.y - 100
                  ? 0
                  : u.pose === 'crouch' || u.pose === 'prone'
                    ? 0.6
                    : 0.25)
              : 0;
          hitUnit(
            s,
            u,
            p.damage *
              (CARDS[u.id].armored
                ? (p.armorMultiplier ?? 1)
                : CARDS[u.id].members
                  ? (p.infantryMultiplier ?? 1)
                  : 1),
            p.side,
            cover,
          );
          if (p.ammunition === 'ap')
            s.blasts.push({
              x: p.tx,
              y: p.ty,
              age: 0,
              radius: 4,
              kind: 'penetration',
              soil: false,
              seed: s.fxSeed,
            });
          bulletImpact(
            s,
            p.tx,
            p.ty,
            CARDS[u.id].armored || CARDS[u.id].vehicle ? 'armor' : 'cloth',
            Math.sign(p.tx - p.startX),
          );
        }
      } else if (p.base !== null) {
        connected = true;
        s.players[p.base].hp = Math.max(
          0,
          s.players[p.base].hp - p.damage * (p.baseMultiplier ?? 1),
        );
        bulletImpact(
          s,
          p.tx,
          ground(s, p.tx),
          'soil',
          Math.sign(p.tx - p.startX),
        );
      }
      if (!connected && isCoverBullet(p.ammunition ?? 'rifle')) {
        if (p.missed)
          bulletImpact(
            s,
            p.x,
            ground(s, p.x),
            'soil',
            Math.sign(p.tx - p.startX),
          );
        else {
          // A missed round continues downrange and kicks up earth instead of vanishing.
          const dir = Math.sign(p.tx - p.startX) || 1;
          p.startX = p.x;
          p.startY = p.y;
          p.tx = Math.max(1, Math.min(W - 1, p.x + dir * 90));
          p.ty = ground(s, p.tx);
          p.total = p.life = Math.max(
            0.045,
            Math.hypot(p.tx - p.x, p.ty - p.y) / 2200,
          );
          p.targetUid = null;
          p.base = null;
          p.damage = 0;
          p.missed = true;
        }
      }
    }
  }
  s.projectiles = s.projectiles.filter((p) => p.life > 0);
  for (const mine of s.mines) {
    if (mine.armAt > s.time) continue;
    const victim = s.units.find(
      (u) =>
        u.side !== mine.side &&
        canTakeDamage(u) &&
        (mine.kind === 'antipersonnel'
          ? !!CARDS[u.id].members && !u.rappelling
          : CARDS[u.id].armored || CARDS[u.id].vehicle) &&
        Math.abs(u.x - mine.x) <
          (mine.kind === 'antipersonnel'
            ? 16
            : (tankGeometry(u.id)?.half ?? 24)),
    );
    if (victim) {
      mine.armAt = Infinity;
      victim.slowedUntil = s.time + 3;
      hitUnit(
        s,
        victim,
        mine.kind === 'antipersonnel' ? 22 : 260,
        mine.side,
        0,
        'blast',
      );
      burst(
        s,
        mine.x,
        ground(s, mine.x) - 4,
        mine.kind === 'antipersonnel' ? 16 : 32,
        mine.kind === 'antipersonnel' ? 'grenade' : 'he',
      );
    }
  }
  s.mines = s.mines.filter((m) => m.armAt !== Infinity);
  for (const u of s.units)
    if (u.hp > 0 && CARDS[u.id].sortie && (u.x < -160 || u.x > W + 160)) {
      settleSortie(s, u, true);
      u.hp = 0;
      u.deadFor = 0;
      u.destroyed = true;
    }
  for (const w of s.wrecks) {
    w.age += dt;
    const contact = CARDS[w.cardId].members
      ? null
      : wreckContact((x) => ground(s, x), w);
    if (w.falling) {
      w.x = Math.max(20, Math.min(W - 20, w.x + w.vx * dt));
      w.vy += 250 * dt;
      w.y += w.vy * dt;
      w.angle += dt * 0.7 * Math.sign(w.vx || 1);
      if (w.y >= contact!.y) {
        w.falling = false;
        Object.assign(
          w,
          wreckContact((x) => ground(s, x), w),
        );
        burst(s, w.x, w.y, CARDS[w.cardId].oneWay ? 18 : 30, 'crash');
        s.visionIn = 0;
      }
    } else if (contact) Object.assign(w, contact);
    else w.y = ground(s, w.x);
  }
  s.units = s.units.filter(
    (u) =>
      (u.hp > 0 || u.deadFor > 0) && (!u.surrendered || u.surrenderTime < 6),
  );
  for (const b of s.blasts) {
    b.age += dt;
    if (b.soil) b.y = ground(s, b.x);
  }
  s.blasts = s.blasts.filter(
    (b) =>
      b.age <
      (b.kind === 'penetration'
        ? 0.24
        : b.kind === 'grenade'
          ? 1.25
          : b.kind === 'air'
            ? 1.6
            : b.kind === 'crash'
              ? 3.2
              : 5),
  );
  for (const p of s.particles) {
    p.life -= dt;
    if (p.kind === 'tracer' || p.kind === 'impact') continue;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy +=
      (p.kind === 'smoke'
        ? -2
        : p.kind === 'dust'
          ? 6
          : p.kind === 'casing'
            ? 320
            : 190) * dt;
  }
  s.particles = s.particles.filter((p) => p.life > 0).slice(-700);
  const [a, b] = s.players;
  if (a.hp <= 0 || b.hp <= 0 || s.time >= DURATION) {
    s.status = 'finished';
    s.result = Math.abs(a.hp - b.hp) < 0.01 ? 'draw' : a.hp > b.hp ? 0 : 1;
    notify(
      s,
      s.result === 0
        ? '作战胜利'
        : s.result === 1
          ? '作战结束，防线失守'
          : '作战结束，双方平局',
    );
  }
}
export function snapshot(s: GameState, viewer: Side = 0) {
  return {
    entrenchments: (s.entrenchments ?? [])
      .filter((t) => t.side === viewer)
      .map((t) => ({ ...t })),
    status: s.status,
    time: s.time,
    result: s.result,
    players: s.players.map((p, i) => ({
      side: i,
      order: p.order,
      hp: p.hp,
      energy: i === viewer ? p.energy : 0,
      hand:
        i === viewer
          ? p.hand.map((h) => ({
              ...h,
              ...CARDS[h.id],
              cost: cardCost(h),
              readyIn: cardReadyIn(s, h),
            }))
          : [],
      deckCount: i === viewer ? p.deck.length : 0,
      discardCount: i === viewer ? p.discard.length : 0,
      drawIn: p.drawIn,
      jam: p.jam,
      morale: p.morale,
      recon: p.recon,
      captures: p.captures,
      fortify: p.fortify,
      kills: p.kills,
      played: p.played,
    })),
    units: s.units
      .filter((u) => visibleToSide(s, viewer, u))
      .map((u) => ({ ...u, sortieCard: null })),
    walls: Object.values(s.knownWalls[viewer]).map((w) => ({ ...w })),
    smokes: s.smokes.map((f) => ({ ...f })),
    explosions: s.audibleExplosions[viewer],
    notices: s.notices
      .filter((n) => !n.audience || n.audience.includes(viewer))
      .map((n) => ({ ...n })),
  };
}
