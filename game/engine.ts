import {
  ammunition,
  FLIGHT,
  isTracer,
  isCoverBullet,
  type Ammunition,
} from './ballistics';
import {
  obstacleBoxes,
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
  MAX_CRATER_DEPTH = 36,
  SQUAD_SPACING = 38;
export const AIR_ALTITUDE = 232,
  DROP_HEIGHT = 20,
  CLIMB_HEIGHT = 20;
export interface HandCard {
  uid: number;
  id: CardId;
  readyAt?: number;
  returnedOnce?: boolean;
}
export interface Unit {
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
  woundedTime: number;
  bleedOut: number;
  woundedBy: Side;
  rescueProgress: number;
  injuryCooldown: number;
  lastAmmo?: Ammunition;
  lastThreat?: { x: number; y: number; until: number };
  aimUntil?: number;
  exposedUntil?: number;
  originalSquad?: number;
  regroupHost?: number;
  emplaced?: boolean;
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
  coverSearch: number;
  supportCooldown: number;
  healing: number;
  repairTime: number;
  patrolDir: number;
  evadeGoal: number | null;
  evadeUntil: number;
  evadeMarker: number | null;
  friendlyWarnAt: number;
  sortieCard: HandCard | null;
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
): GameState {
  if (!validDeck(playerDeck) || !validDeck(aiDeck))
    throw new Error('双方卡组必须各有20张有效卡牌，且不超过各卡数量上限');
  const original = Array.from({ length: W }, (_, x) =>
    x < 125 || x > W - 125
      ? 374
      : 374 + Math.round(Math.sin(x * 0.004) * 13 + Math.sin(x * 0.013) * 5),
  );
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
    scenery: createScenery(original),
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
    walls: [510, 1150, 1920, 2690, W - 510].map((x, i) => ({
      uid: i + 1,
      x,
      width: 34,
      height: 32,
      hp: 140,
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
export function spawnUnit(s: GameState, side: Side, id: CardId, x: number) {
  const c = CARDS[id],
    count = c.members ?? 1,
    squad = ++s.uid,
    dir = side === 0 ? 1 : -1;
  const positions = formationPositions(side, id, x);
  for (let i = 0; i < count; i++) {
    const px = positions[i],
      hp = c.hp! / count;
    s.units.push({
      uid: ++s.uid,
      id,
      side,
      x: px,
      y: c.air
        ? (c.altitude ?? AIR_ALTITUDE)
        : c.armored
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
      hullAngle: c.armored ? vehicleContact(s, px, id).angle : 0,
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
  // Reinforcements always enter at their own HQ, regardless of the camera/drop point.
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
        CARDS[u.id].armored &&
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
    }
    if (c.effect === 'barrage') callArtillery(s, side, x!, 'barrage');
    if (c.effect === 'medevac')
      for (const u of s.units.filter(
        (v) => v.side === side && canTakeDamage(v) && CARDS[v.id].members,
      )) {
        u.hp = Math.min(u.maxHp, u.hp + 10);
        u.personalMorale = Math.min(100, u.personalMorale + 8);
        u.healing = 0.7;
        if (u.wounded) u.rescueProgress += 1.6;
      }
    if (c.effect === 'fortify') {
      p.fortify = 10;
      for (const u of own)
        u.personalMorale = Math.min(100, u.personalMorale + 10);
    }
    if (c.effect === 'sabotage')
      for (const u of s.units)
        if (u.side !== side && isCombatant(u)) {
          u.cooldown = Math.max(0, u.cooldown) + 1.8;
          u.secondaryCooldown = Math.max(0, u.secondaryCooldown) + 1.8;
        }
  } else if (c.id === 'artillery') {
    callArtillery(s, side, x!, 'artillery');
  } else if (c.id === 'precision') {
    callArtillery(s, side, x!, 'precision');
  } else if (c.id === 'smoke') {
    s.smokes.push({ x: x!, life: 8, side });
  } else if (c.id === 'recon') {
    p.recon = 10;
  } else if (c.id === 'repair') {
    for (const u of s.units)
      if (u.side === side && isCombatant(u) && CARDS[u.id].armored)
        u.repairTime = 8;
  } else if (c.id === 'morale') {
    p.morale = 8;
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
      s.original[i] + MAX_CRATER_DEPTH,
      Math.max(s.terrain[i], centerY + dy),
    );
  }
  for (let pass = 0; pass < 3; pass++) {
    for (let i = 126; i < W - 125; i++)
      s.terrain[i] = Math.min(s.terrain[i], s.terrain[i - 1] + 1.25);
    for (let i = W - 127; i >= 125; i--)
      s.terrain[i] = Math.min(s.terrain[i], s.terrain[i + 1] + 1.25);
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
    (c.members && !u.moving && s.players[u.side].fortify > 0 ? 0.8 : 1);
  u.hp -= actual;
  if (c.members) {
    u.suppression = Math.min(100, u.suppression + (actual / u.maxHp) * 90 + 6);
    u.personalMorale = Math.max(
      0,
      u.personalMorale -
        (actual / u.maxHp) * (135 - (c.discipline ?? 80) * 0.65),
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
    const soilRadius = Math.min(
      small ? 13 : 36,
      radius * (small ? 0.35 : 0.65),
    );
    crater(
      s,
      x,
      soilRadius,
      Math.min(small ? 4.5 : 14, radius * (small ? 0.12 : 0.25)),
    );
  }
  for (const u of s.units) {
    if (u.side === side || !canTakeDamage(u)) continue;
    let dist = Math.hypot(u.x - x, u.y - 20 - y);
    if (CARDS[u.id].armored) {
      // Measure from the hull, including when tracks bridge a crater.
      const dx = x - u.x,
        dy = y - u.y,
        cos = Math.cos(u.hullAngle),
        sin = Math.sin(u.hullAngle),
        localX = dx * cos + dy * sin,
        localY = -dx * sin + dy * cos,
        half = modelOf(u.id) === 'tank' ? 62 : 48;
      dist = Math.hypot(
        Math.max(0, Math.abs(localX) - half),
        Math.max(0, localY, -48 - localY),
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
  const debris = debrisCover(s, x, threatX);
  if (depth < 7) return debris;
  const dir = threatX >= x ? 1 : -1;
  let lip = y;
  for (let d = 8; d <= 38; d += 2) lip = Math.min(lip, ground(s, x + dir * d));
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
export function muzzleOffset(u: Unit) {
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
export function muzzleHeight(u: Unit) {
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
  u: Unit,
  tx: number,
  height = muzzleHeight(u),
  coax = false,
) {
  const dx = Math.sign(tx - u.x) * (coax ? 58 : muzzleOffset(u)),
    dy = -height;
  const angle = CARDS[u.id].armored ? u.hullAngle : 0,
    c = Math.cos(angle),
    sn = Math.sin(angle);
  return { x: u.x + dx * c - dy * sn, y: u.y + dx * sn + dy * c };
}
function bodyHeight(u: Pick<Unit, 'pose'>) {
  return u.pose === 'prone'
    ? 7
    : u.pose === 'crouch' || u.pose === 'land'
      ? 18
      : 27;
}
export function unitRange(s: GameState, u: Unit) {
  return (
    weaponCard(u).range! *
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
    Math.abs(tx - sx) <= 110
  )
    return false;
  const left = Math.min(sx, tx),
    right = Math.max(sx, tx);
  return s.smokes.some(
    (f) => f.life > 0 && f.x + 110 > left && f.x - 110 < right,
  );
}
function firingHeight(
  s: GameState,
  u: Unit,
  tx: number,
  ty: number,
): number | null {
  const c = CARDS[u.id],
    height = muzzleHeight(u),
    point = muzzlePoint(u, tx, height),
    sx = point.x;
  if (c.indirect) return height;
  if (smokeBlocks(s, u.side, u.x, tx)) return null;
  if (u.id === 'javelin') return height;
  const softCover = isCoverBullet(ammunition(u.id, u.member));
  if (!terrainIntercept(s, sx, point.y, tx, ty, softCover)) return height;
  // A crouched soldier can briefly rise to fire, rather than stall behind a slope.
  if (c.members && !terrainIntercept(s, sx, u.y - 47, tx, ty, softCover))
    return 47;
  return null;
}
type CoverTarget = Pick<Unit, 'x' | 'y'> & Partial<Pick<Unit, 'pose'>>;
function canFireFromCover(
  s: GameState,
  u: Unit,
  x: number,
  target: CoverTarget,
) {
  return (
    firingHeight(
      s,
      { ...u, x, y: ground(s, x), pose: 'idle' },
      target.x,
      target.y - bodyHeight({ pose: target.pose ?? 'prone' }),
    ) !== null
  );
}
function seekCover(s: GameState, u: Unit, target: CoverTarget) {
  let best: number | null = null,
    score = 0;
  for (
    let x = Math.max(125, u.x - (CARDS[u.id].trait === 'scout' ? 120 : 48));
    x <= Math.min(W - 125, u.x + (CARDS[u.id].trait === 'scout' ? 120 : 58));
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
          Math.abs((v.coverGoal ?? v.x) - x) < 18,
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
function moveSoldier(
  s: GameState,
  u: Unit,
  dir: number,
  speed: number,
  dt: number,
) {
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
    beginDrop(u, dir, speed);
    return;
  }
  if (depth >= CLIMB_HEIGHT && y - ahead >= CLIMB_HEIGHT) {
    let destination = u.x + dir * 12;
    for (let d = 12; d <= 52; d += 2) {
      destination = Math.max(125, Math.min(W - 125, u.x + dir * d));
      if (ground(s, destination) - s.original[Math.floor(destination)] < 3)
        break;
    }
    u.motion = 'bank';
    u.motionTime = 0;
    u.motionDuration = CARDS[u.id].trait === 'mountain' ? 0.5 : 0.8;
    u.motionFromX = u.x;
    u.motionFromY = u.y;
    u.motionToX = destination;
    u.motionToY = ground(s, destination);
    u.pose = 'climb';
    return;
  }
  const debris = obstacleBoxes(s).find(
    (b) =>
      b.rubble &&
      (dir > 0 ? b.x - u.x : u.x - b.x - b.w) > 0 &&
      (dir > 0 ? b.x - u.x : u.x - b.x - b.w) < 17,
  );
  if (debris && u.stepCooldown <= 0 && u.coverGoal === null) {
    u.motion = 'bank';
    u.motionTime = 0;
    u.motionDuration = 0.65 + debris.w / 150;
    u.motionFromX = u.x;
    u.motionFromY = u.y;
    u.motionToX = dir > 0 ? debris.x + debris.w + 18 : debris.x - 18;
    u.motionToY = ground(s, u.motionToX);
    u.motionLift = debris.h + 5;
    u.pose = 'climb';
    return;
  }
  const wall = s.walls.find(
    (w) =>
      w.hp > 0 &&
      !u.passedWalls.includes(w.uid) &&
      (w.x - u.x) * dir > 0 &&
      Math.abs(w.x - u.x) < w.width / 2 + 18,
  );
  if (wall) {
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
    u.motionToX = u.x + dir * (wall.width + 30);
    u.climbWall = wall.uid;
    u.pose = 'climb';
    return;
  }
  const blocker = s.units
    .filter(
      (v) =>
        v !== u &&
        v.side === u.side &&
        isCombatant(v) &&
        visibleToSide(s, u.side, v) &&
        CARDS[v.id].members &&
        v.facing === dir &&
        Math.abs(v.lane - u.lane) < 4 &&
        (v.x - u.x) * dir > 0,
    )
    .sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0];
  if (blocker)
    speed *= Math.max(0, Math.min(1, (Math.abs(blocker.x - u.x) - 24) / 12));
  const beforeX = u.x;
  u.facing = dir;
  u.x = Math.max(55, Math.min(W - 55, u.x + dir * speed * dt));
  const distance = Math.abs(u.x - beforeX);
  // Gait advances by travelled distance so feet stop when the soldier stops.
  u.walk += distance / (u.pose === 'run' ? 8 : u.pose === 'prone' ? 4 : 6);
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
  const half = modelOf(id) === 'tank' ? 62 : 48;
  const left = ground(s, x - half),
    right = ground(s, x + half);
  const slope = Math.max(-0.18, Math.min(0.18, (right - left) / (half * 2)));
  let y = (left + right) / 2;
  for (let i = -half; i <= half; i += 2)
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
function decideTactic(s: GameState, u: Unit, dt: number) {
  u.decisionIn -= dt;
  if (u.decisionIn > 0) return;
  u.decisionIn = 1.1 + (u.member % 4) * 0.18;
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
  if (!threat || Math.abs(threat.x - u.x) > Math.max(560, unitRange(s, u))) {
    u.tactic = u.suppression > 68 ? 'prone' : 'advance';
    if (u.personalMorale < (c.discipline ?? 80))
      u.personalMorale = Math.min(c.discipline ?? 80, u.personalMorale + 1.5);
    return;
  }
  if (u.personalMorale < 35) {
    u.originalSquad = u.squad;
    u.conflictChecked = false;
    u.regroupProgress = 0;
    u.tactic = 'retreat';
    u.retreatUntil = s.time + 4;
    u.coverGoal = null;
    return;
  }
  const doctrine = doctrineOf(u.id),
    list = roles[doctrine];
  const rotation =
    doctrine === 'assault' || doctrine === 'elite' || doctrine === 'balanced'
      ? Math.floor(s.time / 4) % 2
      : 0;
  u.tactic =
    u.suppression > 65
      ? 'prone'
      : list[(u.member + rotation * 3) % list.length];
}
function evadeArtillery(s: GameState, u: Unit, dt: number) {
  const incoming = s.projectiles.find(
    (p) =>
      p.side !== u.side &&
      p.shell &&
      Math.hypot(p.x - u.x, p.y - u.y) < 240 &&
      (p.guided
        ? Math.hypot(p.tx - p.x, p.ty - p.y) /
          FLIGHT[p.ammunition ?? 'mortar'].speed
        : p.life) <
        0.45 + (u.uid % 5) * 0.055,
  );
  if (incoming && incoming.uid !== u.evadeMarker) {
    u.evadeMarker = incoming.uid ?? -1;
    u.evadeUntil = Math.max(u.evadeUntil, s.time + 1.5);
    const dir = (u.uid + u.member) % 2 ? 1 : -1;
    u.evadeGoal = Math.max(
      80,
      Math.min(W - 80, u.x + dir * (14 + (u.uid % 4) * 7)),
    );
    u.coverGoal = null;
    u.fire = 0;
  }
  if (u.evadeUntil <= s.time) {
    u.evadeGoal = null;
    return false;
  }
  u.fire = 0;
  u.secondaryFire = 0;
  const timeLeft = incoming
    ? incoming.guided
      ? Math.hypot(incoming.tx - incoming.x, incoming.ty - incoming.y) /
        FLIGHT[incoming.ammunition ?? 'mortar'].speed
      : incoming.life
    : 0;
  if (timeLeft < 0.18) u.evadeGoal = null;
  if (u.evadeGoal !== null && Math.abs(u.evadeGoal - u.x) > 4) {
    u.pose = 'run';
    moveSoldier(
      s,
      u,
      Math.sign(u.evadeGoal - u.x),
      CARDS[u.id].speed! * u.pace * 1.5,
      dt,
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
  const target = s.units
    .filter(
      (v) =>
        v.side !== u.side &&
        isCombatant(v) &&
        visibleToSide(s, u.side, v) &&
        CARDS[v.id].members &&
        Math.abs(v.x - u.x) <=
          420 *
            (s.players[u.side].recon > 0
              ? 1.2
              : droneRecon(s, u.side, u.x)
                ? 1.1
                : 1),
    )
    .sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))
    .find((v) => {
      const p = muzzlePoint(u, v.x, 42, true);
      return (
        !smokeBlocks(s, u.side, u.x, v.x) &&
        !terrainIntercept(s, p.x, p.y, v.x, v.y - bodyHeight(v), true)
      );
    });
  if (!target) return;
  const point = muzzlePoint(u, target.x, 42, true),
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
  u.secondaryCooldown = 0.18;
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
    ammunition: 'machinegun',
    tracer: true,
  });
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

// Shared by both sides: a gun follows its own screen until it can engage, then
// stays emplaced permanently. No teleport, no fire while towing, no stat bonus.
function towEmplacement(s: GameState, u: Unit, dt: number) {
  const c = CARDS[u.id];
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

function updateAI(s: GameState) {
  const p = s.players[1];
  const own = s.units.filter((u) => u.side === 1 && isCombatant(u));
  // Every enemy-dependent branch below uses this visible set, never hidden units
  // or the opposing player's hand, energy, or deck.
  const foes = s.units.filter(
    (u) => u.side === 0 && isCombatant(u) && visibleToSide(s, 1, u),
  );
  const groundFoes = foes.filter((u) => !CARDS[u.id].air);
  const armor = groundFoes.filter((u) => CARDS[u.id].armored);
  const air = foes.filter((u) => CARDS[u.id].air);
  const foot = groundFoes.filter((u) => CARDS[u.id].members);
  const groups = (list: Unit[]) => new Set(list.map((u) => u.squad)).size;
  const fighters = own.filter(
    (u) => !CARDS[u.id].observer && u.tactic !== 'retreat',
  );
  const cohorts = groups(fighters.filter((u) => !CARDS[u.id].air));
  const antitank = groups(
    fighters.filter((u) => {
      const c = weaponCard(u);
      if (c.airOnly || !((c.armorMultiplier ?? 1) >= 1.5 || c.penetration))
        return false;
      // A shaken or currently unusable counter cannot protect the visible front.
      if (c.members && u.personalMorale < 40) return false;
      return armor.some((target) => {
        const distance = Math.abs(target.x - u.x);
        return (
          distance >= (c.minRange ?? 0) &&
          distance <= unitRange(s, u) &&
          firingHeight(s, u, target.x, target.y - bodyHeight(target)) !== null
        );
      });
    }),
  );
  const antiair = groups(fighters.filter((u) => weaponCard(u).antiAir));
  const urgentArmor = armor.length > antitank,
    urgentAir = air.length > antiair;
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
  if (!cohorts) s.aiWaveUntil = s.time + 7;
  const staging =
    !emergency && !battle && cohorts < 2 && s.time < (s.aiWaveUntil ?? 0);
  p.order = emergency ? 'crouch' : staging ? 'hold' : 'advance';

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
        if (counterArmor) score += armor.length ? (urgentArmor ? 19 : 3) : 0;
        if (c.antiAir) score += air.length ? (urgentAir ? 19 : 3) : 0;
        if (c.airOnly && !air.length) score = -100;
        if (c.observer)
          score = own.some((u) => CARDS[u.id].observer)
            ? -100
            : cohorts
              ? 10
              : 1;
        if (c.heal) score = patients.length ? 13 : cohorts >= 2 ? 5 : 0;
        if (foot.length >= 4 && (model === 'machinegun' || c.indirect))
          score += 6;
        if (model === 'sniper' && foot.length) score += 3;
        if (c.deployDraw && p.hand.length <= 4) score += 3;
        if (c.armored && !c.airOnly && cohorts >= 1) score += 3;
        if (c.sortie && !foes.length) score -= 4;
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
        // Avoid continuously buying a specialised role already covered by own units.
        score -= Math.min(3, groups(own.filter((u) => u.id === c.id)));
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
        if (
          battle &&
          own.some((u) => u.tactic === 'retreat' || u.hp < u.maxHp * 0.5)
        ) {
          x = Math.max(100, Math.min(W - 100, front - 90));
          score = 11;
        }
      } else if (c.id === 'recon') {
        if (p.recon <= 0 && cohorts && (battle || front < W - 900)) score = 7;
      } else if (c.id === 'repair') {
        if (
          armorDamage > 100 &&
          own.some((u) => CARDS[u.id].armored && u.repairTime <= 0)
        )
          score = 15;
      } else if (c.id === 'morale') {
        if (battle && cohorts >= 2 && p.morale <= 0) score = 13;
      } else if (c.id === 'supply' || c.effect === 'ammo') {
        if (p.hand.length <= 4) score = 11;
      } else if (c.effect === 'rally') {
        if (moraleNeed >= 2) score = 18;
      } else if (c.effect === 'medevac') {
        if (patients.length >= 2) score = 17;
      } else if (c.effect === 'fortify') {
        if (battle && cohorts >= 2 && p.fortify <= 0) score = 10;
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
        if (battle && foes.length >= 2) score = 8;
      } else if (c.id === 'jam' || c.effect === 'emp') {
        if (battle && cohorts >= 2) score = 5;
      }
      if (c.targetGround && (x === undefined || !Number.isFinite(x)))
        score = -100;
      return { h, x, score: score - cardCost(h) * 0.05 };
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
  const armedAir = air.filter((u) => !CARDS[u.id].observer);
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
      .sort((a, b) => cardCost(a.h) - cardCost(b.h) || a.h.uid - b.h.uid);
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

  const best = options[0];
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

export function tick(s: GameState, dt: number) {
  if (s.status !== 'playing') return;
  dt = Math.min(0.05, Math.max(0, dt));
  if (!dt) return;
  s.time = Math.min(DURATION, s.time + dt);
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
    const morale = s.players[u.side].morale > 0;
    u.injuryCooldown = Math.max(0, u.injuryCooldown - dt);
    u.cooldown -= dt;
    u.secondaryCooldown -= dt;
    u.secondaryFire = Math.max(0, u.secondaryFire - dt);
    u.suppression = Math.max(0, u.suppression - dt * 7);
    if (c.members) decideTactic(s, u, dt);
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
    const order = s.players[u.side].order;
    u.stepCooldown = Math.max(0, u.stepCooldown - dt);
    u.coverSearch -= dt;
    u.pose = c.members
      ? order === 'crouch'
        ? 'crouch'
        : order === 'prone'
          ? 'prone'
          : u.tactic === 'prone'
            ? 'prone'
            : u.tactic === 'crouch' || u.tactic === 'cover'
              ? 'crouch'
              : 'idle'
      : 'idle';
    if (c.members && u.climbing > 0) {
      u.cover = 0;
      const wall = s.walls.find((w) => w.uid === u.climbWall)!;
      if (wall.hp <= 0) {
        u.climbing = 0;
        u.passedWalls.push(wall.uid);
        if (ground(s, u.x) - u.y > 3) beginDrop(u, dir, 0, true);
      } else {
        u.climbing = Math.max(0, u.climbing - dt);
        const progress = 1 - u.climbing / u.climbDuration;
        u.x = u.climbFrom + (u.motionToX - u.climbFrom) * progress;
        u.y = ground(s, u.x) - Math.sin(progress * Math.PI) * wall.height;
        u.pose = 'climb';
        u.walk += dt * 5;
        u.moving = true;
        if (u.climbing === 0) u.passedWalls.push(wall.uid);
        continue;
      }
    }
    if (
      c.members &&
      (u.motion === 'ground' || u.motion === 'bank') &&
      ground(s, u.x) - u.y > DROP_HEIGHT
    )
      beginDrop(u, dir, 0, true);
    if (c.members && traverse(s, u, dt)) continue;
    if (c.members && !c.air && evadeArtillery(s, u, dt)) continue;
    if (c.members && u.tactic === 'retreat') {
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

    if (c.air && c.sortie) {
      u.x += dir * c.speed! * (morale ? 1.2 : 1) * dt;
      u.facing = dir;
      u.moving = true;
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
    let treating = false;
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
          (!c.sortie || (v.x - u.x) * dir >= -40) &&
          Math.abs(v.x - u.x) <= range &&
          Math.abs(v.x - u.x) >= (c.minRange ?? 0),
      )
      .sort(
        (a, b) =>
          (modelOf(u.id) === 'sniper'
            ? Number(!CARDS[a.id].members) - Number(!CARDS[b.id].members)
            : modelOf(u.id) === 'tank' || c.armorMultiplier
              ? Number(!CARDS[a.id].armored) - Number(!CARDS[b.id].armored)
              : 0) || Math.abs(a.x - u.x) - Math.abs(b.x - u.x),
      );
    if (candidates[0])
      u.lastThreat = {
        x: candidates[0].x,
        y: candidates[0].y,
        until: s.time + 3,
      };
    const threat =
      candidates[0] ??
      (u.lastThreat && u.lastThreat.until > s.time ? u.lastThreat : null);
    const target = candidates.find(
      (v) => firingHeight(s, u, v.x, v.y - bodyHeight(v)) !== null,
    );
    const baseInRange =
      !target &&
      !c.airOnly &&
      Math.abs(baseX - u.x) <= range &&
      Math.abs(baseX - u.x) >= (c.minRange ?? 0) &&
      firingHeight(s, u, baseX, ground(s, baseX) - 25) !== null;
    const closeThreat = c.minRange
      ? s.units.find(
          (v) =>
            v.side !== u.side &&
            isCombatant(v) &&
            visibleToSide(s, u.side, v) &&
            !CARDS[v.id].air &&
            Math.abs(v.x - u.x) < c.minRange!,
        )
      : null;
    if (
      c.members &&
      threat &&
      order !== 'rush' &&
      !c.indirect &&
      !treating &&
      (u.tactic === 'cover' || u.cover > 0.2)
    ) {
      if (
        u.coverGoal !== null &&
        (craterCover(s, u.coverGoal, threat.x) < 0.2 ||
          Math.abs(threat.x - u.coverGoal) > range ||
          !canFireFromCover(s, u, u.coverGoal, threat))
      )
        u.coverGoal = null;
      if (u.coverGoal === null && order !== 'hold' && u.coverSearch <= 0) {
        u.coverGoal = seekCover(s, u, threat);
        u.coverSearch = 0.7;
      }
      u.cover = craterCover(s, u.x, threat.x);
    } else {
      u.cover = 0;
      u.coverGoal = null;
    }
    const seeking = u.coverGoal !== null && Math.abs(u.coverGoal - u.x) > 0.5;
    if (threat && c.members) u.aimUntil = s.time + 2.5;
    if (u.cover > 0.2 && !seeking && threat) {
      // Keep the firing stance through a whole engagement, not one reload cycle.
      if (firingHeight(s, u, threat.x, threat.y - 20) === 47)
        u.exposedUntil = s.time + 2.5;
      u.pose = (u.exposedUntil ?? 0) > s.time ? 'idle' : 'crouch';
    }
    const bounding =
      c.members &&
      order === 'advance' &&
      u.tactic === 'bound' &&
      target &&
      Math.abs(target.x - u.x) > range * 0.62;
    const retreating = c.members && u.tactic === 'retreat';
    if (modelOf(u.id) === 'tank') fireCoax(s, u);
    if (
      (target || baseInRange) &&
      !seeking &&
      !closeThreat &&
      !treating &&
      !bounding &&
      !retreating
    ) {
      let tx = target ? target.x : baseX;
      let ty = target ? target.y - bodyHeight(target) : ground(s, baseX) - 25;
      if (c.indirect && u.cooldown <= 0) {
        const scatter = u.id === 'precision' ? 14 : c.emplacement ? 42 : 26;
        tx += (rnd(s) - 0.5) * scatter * 2;
        ty = ground(s, tx) - 8;
      }
      if (c.indirect) u.pose = 'crouch';
      if (u.cooldown <= 0) {
        if (firingHeight(s, u, tx, ty) === 47) {
          u.pose = 'idle';
          u.exposedUntil = s.time + 2.5;
        }
        const point = muzzlePoint(u, tx),
          sx = point.x,
          sy = point.y;
        if (
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
          u.cooldown = c.rate!;
          u.fire = 0.25;
          const ap = !!(c.penetration && target && CARDS[target.id].armored);
          const kind: Ammunition = ap ? 'ap' : ammunition(u.id, u.member),
            flight = FLIGHT[kind];
          const total = Math.max(
            c.indirect ? 2 : flight.minimum,
            Math.abs(tx - sx) / flight.speed,
          );
          u.facing = Math.sign(tx - u.x) || dir;
          u.shots++;
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
            base: target ? null : enemySide,
            damage:
              ((ap ? c.penetration! : c.damage!) / (c.members ?? 1)) *
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
      (seeking ||
        bounding ||
        retreating ||
        !!closeThreat ||
        (!target && !baseInRange && (!c.members || order !== 'hold')))
    ) {
      if (c.members)
        u.pose =
          order === 'rush' || bounding || retreating
            ? 'run'
            : order === 'crouch'
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
        (morale ? 1.2 : 1) *
        (u.slowedUntil > s.time ? 0.5 : 1);
      const moveDir = retreating
        ? -dir
        : closeThreat
          ? u.x > closeThreat.x
            ? 1
            : -1
          : seeking
            ? Math.sign(u.coverGoal! - u.x)
            : dir;
      if (c.members)
        moveSoldier(
          s,
          u,
          moveDir,
          seeking ? Math.min(speed, Math.abs(u.coverGoal! - u.x) / dt) : speed,
          dt,
        );
      else if (!c.sortie && !c.static) {
        u.x = Math.max(55, Math.min(W - 55, u.x + dir * speed * dt));
        u.moving = true;
      }
    }
    if (c.armored) {
      for (const wall of s.walls) {
        if (wall.hp > 0 && Math.abs(u.x - wall.x) < 26) {
          wall.hp = 0;
          burst(s, wall.x, ground(s, wall.x) - 12, 22);
        }
      }
    }
    if (c.armored) {
      const contact = vehicleContact(s, u.x, u.id),
        blend = 1 - Math.exp(-dt * 9);
      u.y += (contact.y - u.y) * blend;
      u.hullAngle += (contact.angle - u.hullAngle) * blend;
    } else if (!c.members || u.motion === 'ground')
      u.y = c.air ? (c.altitude ?? AIR_ALTITUDE) : ground(s, u.x);
  }
  for (const p of s.projectiles) {
    const oldX = p.x,
      oldY = p.y;
    p.life -= dt;
    if (p.guided) {
      const tracked = s.units.find(
        (u) => u.uid === p.targetUid && canTakeDamage(u),
      );
      if (tracked) {
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
            (CARDS[u.id].armored ? 70 : CARDS[u.id].air ? 80 : 18) &&
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
            CARDS[u.id].armored ? 'armor' : 'cloth',
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
        CARDS[u.id].armored &&
        Math.abs(u.x - mine.x) < 24,
    );
    if (victim) {
      mine.armAt = Infinity;
      victim.slowedUntil = s.time + 3;
      hitUnit(s, victim, 260, mine.side, 0, 'blast');
      burst(s, mine.x, ground(s, mine.x) - 4, 32, 'he');
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
    if (w.falling) {
      w.x = Math.max(20, Math.min(W - 20, w.x + w.vx * dt));
      w.vy += 250 * dt;
      w.y += w.vy * dt;
      w.angle += dt * 0.7 * Math.sign(w.vx || 1);
      if (w.y >= ground(s, w.x)) {
        w.falling = false;
        w.y = ground(s, w.x);
        w.angle = 0.09 * Math.sign(w.vx || 1);
        burst(s, w.x, w.y, CARDS[w.cardId].oneWay ? 18 : 30, 'crash');
        s.visionIn = 0;
      }
    } else w.y = ground(s, w.x);
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
