import { ammunition, FLIGHT, isTracer, type Ammunition } from './ballistics';
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
  DURATION = 240,
  MAX_HP = 1000,
  DRAW_TIME = 9,
  ENERGY_TIME = 3.6,
  MAX_HAND = 6;
export const DRAW_COST = 2,
  MAX_CRATER_DEPTH = 24,
  SQUAD_SPACING = 38;
export const AIR_ALTITUDE = 232,
  DROP_HEIGHT = 20,
  CLIMB_HEIGHT = 20;
export interface HandCard {
  uid: number;
  id: CardId;
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
}
export interface Projectile {
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
}
export interface Particle {
  kind?: 'smoke' | 'dust' | 'spark' | 'chip' | 'casing';
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
  deck: CardId[];
  discard: CardId[];
  drawIn: number;
  jam: number;
  morale: number;
  recon: number;
  kills: number;
  played: number;
}
export interface GameState {
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
function shuffle(p: Player, list: CardId[]) {
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
    throw new Error('双方卡组必须各含 20 种不同的有效卡牌');
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
    aiIn: 3.5,
    shake: 0,
    uid: 0,
    seed: seed >>> 0,
    fxSeed: (seed ^ 0x7f4a7c15) >>> 0,
    injurySeed: (seed ^ 0x4cf5ad43) >>> 0,
    explosions: 0,
  };
  for (const side of [0, 1] as Side[]) {
    const player = s.players[side];
    player.deck = shuffle(player, player.loadout);
    draw(s, side, MAX_HAND);
  }
  return s;
}
export function notify(
  s: GameState,
  text: string,
  kind: Notice['kind'] = 'info',
) {
  s.notices.unshift({ text, time: s.time, kind });
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
    const id = p.deck.shift();
    if (!id) break;
    p.hand.push({ uid: ++s.uid, id });
    drawn++;
  }
  return drawn;
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
  const c = CARDS[p.hand[index].id];
  if (p.energy + 1e-6 < c.cost)
    return {
      ok: false,
      message: `还需要 ${Math.ceil(c.cost - p.energy)} 点指挥点`,
    };
  if (
    c.type === 'unit' &&
    (x === undefined ||
      !Number.isFinite(x) ||
      (side === 0 ? x < 110 || x > 440 : x < W - 440 || x > W - 110))
  )
    return { ok: false, message: '请在蓝色部署区域内选择落点' };
  if (
    c.targetGround &&
    (x === undefined || !Number.isFinite(x) || x < 0 || x > W)
  )
    return { ok: false, message: '请在战场上选择作用位置' };
  p.energy = Math.max(0, p.energy - c.cost);
  p.hand.splice(index, 1);
  p.discard.push(c.id);
  p.played++;
  if (c.type === 'unit') {
    spawnUnit(s, side, c.id, x!);
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
  notify(s, message, side === 0 ? 'good' : 'warn');
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
function burst(s: GameState, x: number, y: number, radius: number) {
  s.explosions++;
  s.blasts.push({
    x,
    y,
    age: 0,
    radius,
    soil: y > ground(s, x) - 65,
    seed: s.fxSeed,
  });
  s.blasts = s.blasts.slice(-32);
  s.shake = Math.min(8, radius / 10);
  const soil = y > ground(s, x) - 65;
  for (let i = 0; i < 6; i++) {
    const angle = fxRnd(s) * Math.PI * 2,
      life = 0.09 + fxRnd(s) * 0.12;
    s.particles.push({
      kind: 'spark',
      x,
      y,
      vx: Math.cos(angle) * radius * 1.7,
      vy: Math.sin(angle) * radius * 1.4,
      life,
      maxLife: life,
      color: i % 2 ? '#dcac6d' : '#ecdbb2',
      size: 1,
    });
  }
  for (let i = 0; i < 12; i++) {
    const life = 0.3 + fxRnd(s) * 0.4;
    s.particles.push({
      kind: 'chip',
      x,
      y,
      vx: (fxRnd(s) - 0.5) * radius * 3,
      vy: -fxRnd(s) * radius * 2.5,
      life,
      maxLife: life,
      color: soil
        ? i % 2
          ? '#75674d'
          : '#4e5140'
        : i % 2
          ? '#626b63'
          : '#3e4944',
      size: 1 + Math.floor(fxRnd(s) * 2),
    });
  }
  for (let i = 0; i < 8; i++) {
    const life = 0.45 + fxRnd(s) * 0.4;
    s.particles.push({
      kind: soil && i < 3 ? 'dust' : 'smoke',
      x: x + (fxRnd(s) - 0.5) * radius * 0.25,
      y: y - 3,
      vx: (fxRnd(s) - 0.5) * radius * 0.65,
      vy: -12 - fxRnd(s) * 30,
      life,
      maxLife: life,
      color: soil && i < 3 ? '#92846b' : i % 2 ? '#515c52' : '#8e9382',
      size: 7 + fxRnd(s) * Math.min(14, radius * 0.2),
    });
  }
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
        size: 3 + fxRnd(s) * 3,
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
      );
    }
  }
}
function finishDeath(s: GameState, u: Unit, side: Side) {
  if (u.deadFor > 0) return;
  u.hp = 0;
  u.wounded = false;
  u.deadFor = 1.5;
  u.moving = false;
  u.fire = 0;
  u.secondaryFire = 0;
  if (side !== u.side) s.players[side].kills++;
  for (const friend of s.units)
    if (friend !== u && friend.squad === u.squad && isCombatant(friend)) {
      friend.personalMorale = Math.max(0, friend.personalMorale - 9);
      friend.decisionIn = 0;
    }
  if (!CARDS[u.id].members) burst(s, u.x, u.y - 20, 24);
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
) {
  burst(s, x, y, radius);
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
    const soilRadius = Math.min(18, radius * 0.28);
    crater(s, x, soilRadius, Math.min(5, radius * 0.1));
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
          (CARDS[u.id].armored ? armorMultiplier : 1),
        side,
        0,
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
  if (depth < 7) return 0;
  const dir = threatX >= x ? 1 : -1;
  let lip = y;
  for (let d = 8; d <= 38; d += 2) lip = Math.min(lip, ground(s, x + dir * d));
  return Math.max(0, Math.min(1, (y - lip - 4) / 15));
}
export function terrainIntercept(
  s: GameState,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
) {
  const steps = Math.max(1, Math.ceil(Math.abs(tx - sx) / 2));
  for (let i = 1; i <= steps; i++) {
    const t = i / steps,
      x = sx + (tx - sx) * t,
      y = sy + (ty - sy) * t;
    if (y >= ground(s, x) - 1) return { x, y: ground(s, x) - 1 };
  }
  return null;
}
function retreatingFriendlyHit(
  s: GameState,
  p: Projectile,
  sx: number,
  sy: number,
  tx: number,
  ty: number,
) {
  if (p.radius || p.sourceUid === undefined) return null;
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
function bodyHeight(u: Unit) {
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
  if (!terrainIntercept(s, sx, point.y, tx, ty)) return height;
  // A crouched soldier can briefly rise to fire, rather than stall behind a slope.
  if (c.members && !terrainIntercept(s, sx, u.y - 47, tx, ty)) return 47;
  return null;
}
function seekCover(s: GameState, u: Unit, target: Unit) {
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
      terrainIntercept(s, x, ground(s, x) - 47, target.x, target.y - 27)
    )
      continue;
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
    u.y = ground(s, u.x) - Math.sin(t * Math.PI) * 4;
    if (t >= 1) {
      u.motion = 'ground';
      u.y = ground(s, u.x);
      u.stepCooldown = 0.3;
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
    .filter((v) => v.side !== u.side && isCombatant(v) && !CARDS[v.id].air)
    .sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0];
  const survivors = s.units.filter(
    (v) => v.squad === u.squad && isCombatant(v),
  ).length;
  if (
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
    u.tactic = 'advance';
    if (u.personalMorale < (c.discipline ?? 80))
      u.personalMorale = Math.min(c.discipline ?? 80, u.personalMorale + 1.5);
    return;
  }
  if (u.personalMorale < 35) {
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
  const threats = s.markers
    .filter((m) => {
      const c = ARTILLERY[m.kind ?? 'artillery'];
      return (
        m.side !== u.side &&
        Math.abs(u.x - m.x) <
          ((c.count - 1) * c.spacing) / 2 + c.radius + c.scatter + 45
      );
    })
    .sort((a, b) => a.timer - b.timer);
  for (const m of threats) {
    const c = ARTILLERY[m.kind ?? 'artillery'];
    u.evadeUntil = Math.max(
      u.evadeUntil,
      s.time + m.timer + (c.count - m.wave - 1) * c.interval + 0.7,
    );
  }
  const alarm = threats[0],
    key = alarm ? (alarm.uid ?? -1) : null;
  if (alarm && key !== u.evadeMarker) {
    const preferred =
      Math.abs(u.x - alarm.x) > 18
        ? Math.sign(u.x - alarm.x)
        : (u.member + u.side) % 2
          ? 1
          : -1;
    const candidates = [0, 40, 64, 88, 112, 136, -40, -64, -88, -112, -136]
      .map((d) => {
        const x = Math.max(130, Math.min(W - 130, u.x + d));
        let score = Math.abs(d) * 0.07 + (Math.sign(d) === preferred ? -3 : 0);
        for (const m of threats) {
          const c = ARTILLERY[m.kind ?? 'artillery'];
          for (let wave = m.wave; wave < c.count; wave++) {
            const center = m.x + (wave - (c.count - 1) / 2) * c.spacing;
            score +=
              Math.max(0, c.radius + c.scatter + 24 - Math.abs(x - center)) * 2;
          }
        }
        for (const v of s.units)
          if (
            v !== u &&
            v.side === u.side &&
            isCombatant(v) &&
            CARDS[v.id].members
          )
            score += Math.max(0, 32 - Math.abs(x - (v.evadeGoal ?? v.x))) * 4;
        score += Math.max(0, Math.abs(ground(s, x) - u.y) - 18) * 3;
        return { x, score };
      })
      .sort((a, b) => a.score - b.score);
    u.evadeMarker = key;
    u.evadeGoal = candidates[0].x;
    u.coverGoal = null;
    u.cover = 0;
  }
  if (u.evadeUntil <= s.time) {
    if (u.evadeGoal !== null) {
      u.evadeGoal = null;
      u.decisionIn = 0;
    }
    return false;
  }
  u.fire = 0;
  u.secondaryFire = 0;
  if (alarm && alarm.timer <= 0.4) u.evadeGoal = null;
  if (u.evadeGoal !== null && Math.abs(u.evadeGoal - u.x) > 4) {
    u.pose = 'run';
    moveSoldier(
      s,
      u,
      Math.sign(u.evadeGoal - u.x),
      CARDS[u.id].speed! *
        u.pace *
        1.75 *
        (s.players[u.side].morale > 0 ? 1.2 : 1),
      dt,
    );
    if (u.moving || u.climbing || u.motion !== 'ground') return true;
    u.evadeGoal = null;
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
        !terrainIntercept(s, p.x, p.y, v.x, v.y - bodyHeight(v))
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
    tracer: isTracer('machinegun', u.secondaryShots),
  });
}
function updateAI(s: GameState) {
  const ai = s.players[1];
  if (
    (ai.hand.length === 0 && ai.energy >= 2) ||
    (ai.hand.length <= 2 && ai.energy >= 4)
  )
    requestDraw(s, 1);
  const p = s.players[1],
    foes = s.units.filter((u) => u.side === 0 && isCombatant(u)),
    own = s.units.filter((u) => u.side === 1 && isCombatant(u));
  const patients = s.units.filter(
    (u) =>
      u.side === 1 &&
      canTakeDamage(u) &&
      CARDS[u.id].members &&
      (u.wounded || u.hp < u.maxHp),
  );
  const air = foes.some((u) => CARDS[u.id].air),
    groundFoes = foes.filter((u) => !CARDS[u.id].air);
  if (foes.some((u) => u.x > W - 900)) p.order = 'crouch';
  else if (s.time % 24 < 7) p.order = 'rush';
  else if (s.time % 24 < 11 && foes.some((u) => u.x > W - 1250))
    p.order = 'prone';
  else p.order = 'advance';
  const options = p.hand
    .filter((h) => CARDS[h.id].cost <= p.energy)
    .map((h) => {
      const c = CARDS[h.id];
      let score = rnd(s) * 2;
      if (c.type === 'unit')
        score +=
          4 +
          (own.length < 2 ? 3 : 0) +
          (air && c.antiAir ? 4 : 0) +
          (modelOf(c.id) === 'tank' && p.energy >= 7 ? 2 : 0);
      if (c.airOnly && !air) score -= 12;
      if (c.observer) score += own.length > 2 ? 2 : -2;
      if (modelOf(c.id) === 'artillery')
        score += groundFoes.length > 1 ? 7 : groundFoes.length ? 2 : -10;
      if (modelOf(c.id) === 'morale') score += own.length > 2 ? 6 : -8;
      if (modelOf(c.id) === 'supply') score += p.hand.length < 4 ? 7 : -9;
      if (modelOf(c.id) === 'jam')
        score += s.players[0].hand.length < 4 ? 3 : 0;
      if (c.effect === 'medevac' && patients.length) score += 16;
      if (modelOf(c.id) === 'medic')
        score += patients.length ? 3 : own.length < 4 ? -6 : 0;
      if (modelOf(c.id) === 'sniper')
        score += groundFoes.some((u) => CARDS[u.id].members) ? 2 : 0;
      if (modelOf(c.id) === 'smoke')
        score +=
          own.length > 2 &&
          foes.some((v) => own.some((u) => Math.abs(u.x - v.x) < 650))
            ? 4
            : -10;
      if (modelOf(c.id) === 'recon')
        score +=
          own.length > 3 && (s.smokes.length || groundFoes.length) ? 5 : -8;
      if (modelOf(c.id) === 'repair')
        score += own.some((u) => CARDS[u.id].armored && u.maxHp - u.hp > 100)
          ? 8
          : -12;
      if (modelOf(c.id) === 'precision')
        score += groundFoes.some((u) => CARDS[u.id].armored)
          ? 8
          : groundFoes.length > 3
            ? 3
            : -10;
      return { h, score };
    })
    .sort((a, b) => b.score - a.score);
  let choice = options[0];
  if (!choice || choice.score < 0) {
    if (p.hand.length < MAX_HAND) {
      requestDraw(s, 1);
      return;
    }
    choice = options
      .filter((o) => CARDS[o.h.id].type === 'skill')
      .sort((a, b) => CARDS[a.h.id].cost - CARDS[b.h.id].cost)[0];
    if (!choice) return;
  }
  const c = CARDS[choice.h.id];
  let x: number | undefined;
  if (c.type === 'unit') x = W - 350 + rnd(s) * 120;
  if (modelOf(c.id) === 'smoke')
    x = own.length
      ? own.reduce((a, u) => a + u.x, 0) / own.length - 60
      : W - 600;
  if (modelOf(c.id) === 'precision')
    x =
      groundFoes.find((u) => CARDS[u.id].armored)?.x ?? groundFoes[0]?.x ?? 600;
  if (modelOf(c.id) === 'artillery') {
    let cluster = groundFoes[0];
    let best = -1;
    for (const u of groundFoes) {
      const count = groundFoes.filter((v) => Math.abs(v.x - u.x) < 100).length;
      if (count > best) {
        best = count;
        cluster = u;
      }
    }
    x = cluster ? Math.max(0, Math.min(W, cluster.x + 20)) : 300;
  }
  playCard(s, 1, choice.h.uid, x);
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
  s.aiIn -= dt;
  if (s.aiIn <= 0) {
    updateAI(s);
    s.aiIn = 1.6 + rnd(s) * 1.2;
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
      u.cover = 0;
      u.coverGoal = null;
      u.fire = 0;
      u.pose = 'run';
      u.facing = -dir;
      moveSoldier(s, u, -dir, c.speed! * u.pace * 1.2 * (morale ? 1.2 : 1), dt);
      if (!u.moving && u.motion === 'ground') u.pose = 'idle';
      continue;
    }

    if (c.air && c.patrol) {
      u.x = Math.max(
        125,
        Math.min(
          W - 125,
          u.x + u.patrolDir * c.speed! * (morale ? 1.2 : 1) * dt,
        ),
      );
      if (u.x <= 125 || u.x >= W - 125) u.patrolDir *= -1;
      u.facing = u.patrolDir;
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
          (!CARDS[v.id].air || c.antiAir) &&
          (!c.airOnly || CARDS[v.id].air) &&
          (!c.patrol || (v.x - u.x) * u.patrolDir >= 0) &&
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
            !CARDS[v.id].air &&
            Math.abs(v.x - u.x) < c.minRange!,
        )
      : null;
    if (
      c.members &&
      target &&
      order !== 'rush' &&
      !c.indirect &&
      !treating &&
      (u.tactic === 'cover' || u.cover > 0.2)
    ) {
      if (
        u.coverGoal !== null &&
        (craterCover(s, u.coverGoal, target.x) < 0.2 ||
          Math.abs(target.x - u.coverGoal) > range)
      )
        u.coverGoal = null;
      if (u.coverGoal === null && order !== 'hold' && u.coverSearch <= 0) {
        u.coverGoal = seekCover(s, u, target);
        u.coverSearch = 0.7;
      }
      u.cover = craterCover(s, u.x, target.x);
    } else {
      u.cover = 0;
      u.coverGoal = null;
    }
    const seeking = u.coverGoal !== null && Math.abs(u.coverGoal - u.x) > 3;
    if (u.cover > 0.2 && !seeking) {
      // Rise just before firing, then return behind the crater lip between shots.
      u.pose = u.cooldown < 0.16 || u.fire > 0 ? 'idle' : 'crouch';
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
      const tx = target ? target.x : baseX;
      const ty = target ? target.y - bodyHeight(target) : ground(s, baseX) - 25;
      if (c.indirect) u.pose = 'crouch';
      if (u.cooldown <= 0) {
        if (u.cover > 0.2 || firingHeight(s, u, tx, ty) === 47) u.pose = 'idle';
        const point = muzzlePoint(u, tx),
          sx = point.x,
          sy = point.y;
        if (c.indirect || !terrainIntercept(s, sx, sy, tx, ty)) {
          u.cooldown = c.rate!;
          u.fire = 0.25;
          const kind = ammunition(u.id, u.member),
            flight = FLIGHT[kind];
          const total = Math.max(
            flight.minimum,
            Math.abs(tx - sx) / flight.speed,
          );
          u.facing = Math.sign(tx - u.x) || dir;
          u.shots++;
          u.muzzleX = sx;
          u.muzzleY = sy;
          u.shotAngle = Math.atan2(ty - sy, tx - sx);
          muzzleParticles(s, u, kind, sx, sy);
          s.projectiles.push({
            sourceUid: u.uid,
            x: sx,
            y: sy,
            tx,
            ty,
            side: u.side,
            targetUid: target?.uid ?? null,
            base: target ? null : enemySide,
            damage:
              (c.damage! / (c.members ?? 1)) *
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
            radius: c.radius ?? 0,
            life: total,
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
      const speed = c.speed! * u.pace * orderSpeed * (morale ? 1.2 : 1);
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
      else if (!c.patrol) {
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
    const t = 1 - Math.max(0, p.life) / p.total;
    p.x = p.startX + (p.tx - p.startX) * t;
    p.y =
      p.startY +
      (p.ty - p.startY) * t -
      Math.sin(t * Math.PI) * (p.arc ?? (p.radius ? 35 : 0));
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
    const impact = terrainIntercept(s, oldX, oldY, p.x, p.y);
    const friendly = retreatingFriendlyHit(s, p, oldX, oldY, p.x, p.y);
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
        notify(s, '撤退队员进入友军射线，发生误伤', 'warn');
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
          1,
          p.armorMultiplier,
        );
      else
        bulletImpact(s, impact.x, impact.y, 'soil', Math.sign(p.tx - p.startX));
      continue;
    }
    if (p.life <= 0) {
      if (p.radius)
        explode(
          s,
          p.tx,
          p.ty,
          p.radius,
          p.damage,
          p.side,
          1,
          p.armorMultiplier,
        );
      else if (p.targetUid !== null) {
        const u = s.units.find((u) => u.uid === p.targetUid);
        if (u && canTakeDamage(u)) {
          const cover =
            CARDS[u.id].members && u.motion === 'ground' && !u.climbing
              ? craterCover(s, u.x, p.startX) *
                (p.startY < u.y - 100
                  ? 0
                  : u.pose === 'crouch' || u.pose === 'prone'
                    ? 0.6
                    : 0.25)
              : 0;
          hitUnit(s, u, p.damage, p.side, cover);
          bulletImpact(
            s,
            p.tx,
            p.ty,
            CARDS[u.id].armored ? 'armor' : 'cloth',
            Math.sign(p.tx - p.startX),
          );
        }
      } else if (p.base !== null)
        s.players[p.base].hp = Math.max(0, s.players[p.base].hp - p.damage);
    }
  }
  s.projectiles = s.projectiles.filter((p) => p.life > 0);
  s.units = s.units.filter(
    (u) =>
      (u.hp > 0 || u.deadFor > 0) && (!u.surrendered || u.surrenderTime < 6),
  );
  for (const b of s.blasts) b.age += dt;
  s.blasts = s.blasts.filter((b) => b.age < 4);
  for (const p of s.particles) {
    p.life -= dt;
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
export function snapshot(s: GameState) {
  return {
    status: s.status,
    time: s.time,
    result: s.result,
    players: s.players.map((p, i) => ({
      side: i,
      order: p.order,
      hp: p.hp,
      energy: p.energy,
      hand: p.hand.map((h) => ({ ...h, ...CARDS[h.id] })),
      deckCount: p.deck.length,
      discardCount: p.discard.length,
      drawIn: p.drawIn,
      jam: p.jam,
      morale: p.morale,
      recon: p.recon,
      captures: p.captures,
      fortify: p.fortify,
      kills: p.kills,
      played: p.played,
    })),
    units: s.units.map((u) => ({ ...u })),
    walls: s.walls.map((w) => ({ ...w })),
    smokes: s.smokes.map((f) => ({ ...f })),
    explosions: s.explosions,
    notices: s.notices.map((n) => ({ ...n })),
  };
}
