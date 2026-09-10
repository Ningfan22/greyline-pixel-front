export type Side = 0 | 1;
export type CardId =
  | 'infantry'
  | 'machinegun'
  | 'rocket'
  | 'tank'
  | 'helicopter'
  | 'morale'
  | 'artillery'
  | 'supply'
  | 'jam';
export type Order = 'advance' | 'hold' | 'rush' | 'crouch' | 'prone';
export type Status = 'ready' | 'playing' | 'paused' | 'finished';
export interface Card {
  id: CardId;
  name: string;
  en: string;
  cost: number;
  type: 'unit' | 'skill';
  tag: string;
  description: string;
  detail: string;
  atlas: number;
  hp?: number;
  damage?: number;
  range?: number;
  speed?: number;
  rate?: number;
  air?: boolean;
  antiAir?: boolean;
  radius?: number;
  members?: number;
}
export const CARDS: Record<CardId, Card> = {
  infantry: {
    id: 'infantry',
    name: '步兵班组',
    en: 'RIFLE SQUAD',
    cost: 2,
    type: 'unit',
    tag: '前线 · 地面',
    description: '快速推进，低费主力',
    detail:
      '6 名独立士兵 · 全班 210 生命、24 伤害 / 秒。快速推进的基础班组，适合掩护后排。',
    atlas: 0,
    hp: 210,
    damage: 24,
    range: 145,
    speed: 68,
    rate: 1,
    members: 6,
  },
  machinegun: {
    id: 'machinegun',
    name: '机枪班组',
    en: 'MACHINE GUN',
    cost: 3,
    type: 'unit',
    tag: '压制 · 对空',
    description: '持续压制，可对空',
    detail:
      '5 名独立机枪手 · 全班 225 生命，每 0.35 秒共 12 伤害。压制步兵，也能攻击直升机。',
    atlas: 1,
    hp: 225,
    damage: 12,
    range: 215,
    speed: 54,
    rate: 0.35,
    antiAir: true,
    members: 5,
  },
  rocket: {
    id: 'rocket',
    name: '重火力支援',
    en: 'FIRE SUPPORT',
    cost: 4,
    type: 'unit',
    tag: '爆破 · 对空',
    description: '远距爆破，破坏地形',
    detail:
      '5 名独立火箭兵 · 全班 200 生命，每 2.6 秒共 100 范围伤害。射程远，可对空，地面爆炸会留下弹坑。',
    atlas: 2,
    hp: 200,
    damage: 100,
    range: 280,
    speed: 48,
    rate: 2.6,
    radius: 34,
    antiAir: true,
    members: 5,
  },
  tank: {
    id: 'tank',
    name: '主战坦克',
    en: 'MAIN BATTLE TANK',
    cost: 6,
    type: 'unit',
    tag: '装甲 · 爆破',
    description: '重装推进，范围炮击',
    detail: '650 生命 · 每 1.9 秒 80 范围伤害。高生命地面前排，无法对空。',
    atlas: 3,
    hp: 650,
    damage: 80,
    range: 235,
    speed: 40,
    rate: 1.9,
    radius: 44,
  },
  helicopter: {
    id: 'helicopter',
    name: '武装直升机',
    en: 'ATTACK HELICOPTER',
    cost: 6,
    type: 'unit',
    tag: '空中 · 突袭',
    description: '越过弹坑，从空中支援',
    detail: '260 生命 · 30 伤害 / 秒。无视地形，从空中攻击地面单位。',
    atlas: 4,
    hp: 260,
    damage: 30,
    range: 195,
    speed: 94,
    rate: 1,
    air: true,
  },
  morale: {
    id: 'morale',
    name: '士气鼓舞',
    en: 'RALLY THE TROOPS',
    cost: 2,
    type: 'skill',
    tag: '增益 · 全军',
    description: '伤害 +35%，移速 +20%',
    detail: '全体己方部队获得 8 秒鼓舞，包含期间新部署单位。重复使用刷新时长。',
    atlas: 6,
  },
  artillery: {
    id: 'artillery',
    name: '火炮覆盖',
    en: 'ARTILLERY BARRAGE',
    cost: 4,
    type: 'skill',
    tag: '支援 · 范围',
    description: '三轮炮击，炸毁地面',
    detail:
      '选择落点，0.8 秒后开始三轮炮击，每轮 55 范围伤害。只伤害敌军；对基地伤害为 35%。',
    atlas: 7,
  },
  supply: {
    id: 'supply',
    name: '战地补给',
    en: 'FIELD RESUPPLY',
    cost: 1,
    type: 'skill',
    tag: '调度 · 抽牌',
    description: '立即补充 2 张手牌',
    detail: '立即抽 2 张牌，最多持有 6 张。用过的牌会在牌库抽空后洗回。',
    atlas: 8,
  },
  jam: {
    id: 'jam',
    name: '通讯干扰',
    en: 'SIGNAL JAMMING',
    cost: 2,
    type: 'skill',
    tag: '干扰 · 抽牌',
    description: '暂停敌方自动抽牌 9 秒',
    detail: '暂停敌方自动抽牌倒计时 9 秒；不影响补给卡。重复使用刷新时长。',
    atlas: 9,
  },
};
export const W = 3840,
  VIEW_W = 1440,
  H = 480,
  DURATION = 240,
  MAX_HP = 1000,
  DRAW_TIME = 9,
  ENERGY_TIME = 2.8,
  MAX_HAND = 6;
export const DECK: CardId[] = [
  'infantry',
  'infantry',
  'infantry',
  'machinegun',
  'machinegun',
  'rocket',
  'rocket',
  'tank',
  'tank',
  'helicopter',
  'morale',
  'morale',
  'artillery',
  'artillery',
  'supply',
  'supply',
  'jam',
  'jam',
];
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
  pose: 'idle' | 'walk' | 'run' | 'climb' | 'crouch' | 'prone';
}
export interface Projectile {
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
}
export interface Particle {
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
  x: number;
  timer: number;
  side: Side;
  wave: number;
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
  order: Order;
  hp: number;
  energy: number;
  hand: HandCard[];
  deck: CardId[];
  discard: CardId[];
  drawIn: number;
  jam: number;
  morale: number;
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
  notices: Notice[];
  result: Side | 'draw' | null;
  aiIn: number;
  shake: number;
  uid: number;
  seed: number;
  explosions: number;
}
function rnd(s: GameState) {
  s.seed = (Math.imul(1664525, s.seed) + 1013904223) >>> 0;
  return s.seed / 4294967296;
}
function shuffle(s: GameState, list: CardId[]) {
  const out = [...list];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd(s) * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
export function ground(s: GameState, x: number) {
  return s.terrain[Math.max(0, Math.min(W - 1, Math.floor(x)))];
}
export function createGame(seed = Date.now()): GameState {
  const original = Array.from({ length: W }, (_, x) =>
    x < 125 || x > W - 125
      ? 374
      : 374 + Math.round(Math.sin(x * 0.004) * 13 + Math.sin(x * 0.013) * 5),
  );
  const p = (): Player => ({
    order: 'advance',
    hp: MAX_HP,
    energy: 7,
    hand: [],
    deck: [],
    discard: [],
    drawIn: DRAW_TIME,
    jam: 0,
    morale: 0,
    kills: 0,
    played: 0,
  });
  const s: GameState = {
    status: 'ready',
    time: 0,
    players: [p(), p()],
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
    notices: [],
    result: null,
    aiIn: 3.5,
    shake: 0,
    uid: 0,
    seed: seed >>> 0,
    explosions: 0,
  };
  for (const side of [0, 1] as Side[]) {
    const deck = [...DECK];
    const opening: CardId[] = [
      'infantry',
      'machinegun',
      'tank',
      'artillery',
      'supply',
    ];
    for (const id of opening) {
      deck.splice(deck.indexOf(id), 1);
      s.players[side].hand.push({ uid: ++s.uid, id });
    }
    s.players[side].deck = shuffle(s, deck);
    spawnUnit(s, side, 'infantry', side === 0 ? 175 : W - 175);
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
export function spawnUnit(s: GameState, side: Side, id: CardId, x: number) {
  const c = CARDS[id],
    count = c.members ?? 1,
    squad = ++s.uid,
    dir = side === 0 ? 1 : -1;
  for (let i = 0; i < count; i++) {
    const px = Math.max(112, Math.min(W - 112, x - dir * i * 22)),
      hp = c.hp! / count;
    s.units.push({
      uid: ++s.uid,
      id,
      side,
      x: px,
      y: c.air ? 240 : ground(s, px),
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
      pose: 'idle',
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
      p.deck = shuffle(s, p.discard);
      p.discard = [];
    }
    const id = p.deck.shift();
    if (!id) break;
    p.hand.push({ uid: ++s.uid, id });
    drawn++;
  }
  return drawn;
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
    c.id === 'artillery' &&
    (x === undefined || !Number.isFinite(x) || x < 0 || x > W)
  )
    return { ok: false, message: '请在战场上选择炮击位置' };
  p.energy = Math.max(0, p.energy - c.cost);
  p.hand.splice(index, 1);
  p.discard.push(c.id);
  p.played++;
  if (c.type === 'unit') {
    spawnUnit(s, side, c.id, x!);
  } else if (c.id === 'artillery') {
    s.markers.push({ x: x!, timer: 0.8, side, wave: 0 });
  } else if (c.id === 'morale') {
    p.morale = 8;
  } else if (c.id === 'supply') {
    draw(s, side, 2);
  } else if (c.id === 'jam') {
    s.players[side === 0 ? 1 : 0].jam = 9;
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
      s.original[i] + 64,
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
  s.shake = Math.min(8, radius / 10);
  for (let i = 0; i < 24; i++) {
    const life = 0.3 + rnd(s) * 0.65;
    s.particles.push({
      x,
      y,
      vx: (rnd(s) - 0.5) * radius * 4,
      vy: -rnd(s) * radius * 3,
      life,
      maxLife: life,
      color: ['#f4dc8a', '#f1ab54', '#d87845', '#3e4437', '#9c9168'][
        Math.floor(rnd(s) * 5)
      ],
      size: 3 + Math.floor(rnd(s) * 8),
    });
  }
}
function hitUnit(s: GameState, u: Unit, damage: number, side: Side) {
  if (u.hp <= 0) return;
  const protection = u.pose === 'prone' ? 0.7 : u.pose === 'crouch' ? 0.85 : 1;
  u.hp -= damage * protection;
  u.flash = 0.16;
  if (u.hp <= 0) {
    s.players[side].kills++;
    u.deadFor = 1.5;
    u.moving = false;
    u.fire = 0;
    if (!CARDS[u.id].members) burst(s, u.x, u.y - 20, 24);
  }
}
export function explode(
  s: GameState,
  x: number,
  y: number,
  radius: number,
  damage: number,
  side: Side,
  baseScale = 1,
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
  if (y > ground(s, x) - 80) crater(s, x, radius, radius * 0.45);
  for (const u of s.units) {
    if (u.side === side || u.hp <= 0) continue;
    const dist = Math.hypot(u.x - x, u.y - 20 - y);
    if (dist < radius + 18)
      hitUnit(s, u, damage * Math.max(0.45, 1 - dist / (radius * 2)), side);
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
function updateAI(s: GameState) {
  const p = s.players[1],
    foes = s.units.filter((u) => u.side === 0 && u.hp > 0),
    own = s.units.filter((u) => u.side === 1 && u.hp > 0);
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
          (c.id === 'tank' && p.energy >= 7 ? 2 : 0);
      if (c.id === 'artillery')
        score += groundFoes.length > 1 ? 7 : groundFoes.length ? 2 : -10;
      if (c.id === 'morale') score += own.length > 2 ? 6 : -8;
      if (c.id === 'supply') score += p.hand.length < 4 ? 7 : -9;
      if (c.id === 'jam') score += s.players[0].hand.length < 4 ? 3 : 0;
      return { h, score };
    })
    .sort((a, b) => b.score - a.score);
  const choice = options[0];
  if (!choice || choice.score < 0) return;
  const c = CARDS[choice.h.id];
  let x: number | undefined;
  if (c.type === 'unit') x = W - 350 + rnd(s) * 120;
  if (c.id === 'artillery') {
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
    if (p.jam > 0) p.jam = Math.max(0, p.jam - dt);
    else {
      p.drawIn -= dt;
      if (p.drawIn <= 0) {
        draw(s, side);
        p.drawIn += DRAW_TIME;
      }
    }
  }
  s.aiIn -= dt;
  if (s.aiIn <= 0) {
    updateAI(s);
    s.aiIn = 1.6 + rnd(s) * 1.2;
  }
  for (const m of s.markers) {
    m.timer -= dt;
    if (m.timer <= 0) {
      const x = m.x + (m.wave - 1) * 37;
      explode(s, x, ground(s, x) - 8, 68, 55, m.side, 0.35);
      m.wave++;
      m.timer = 0.28;
    }
  }
  s.markers = s.markers.filter((m) => m.wave < 3);
  for (const u of s.units) {
    if (u.hp <= 0) {
      u.deadFor -= dt;
      u.y = Math.min(ground(s, u.x), u.y + 110 * dt);
      continue;
    }
    const c = CARDS[u.id],
      dir = u.side === 0 ? 1 : -1,
      enemySide: Side = u.side === 0 ? 1 : 0,
      baseX = enemySide === 0 ? 70 : W - 70;
    const morale = s.players[u.side].morale > 0;
    u.cooldown -= dt;
    u.flash = Math.max(0, u.flash - dt);
    u.fire = Math.max(0, u.fire - dt);
    u.moving = false;
    const order = s.players[u.side].order;
    u.pose = c.members
      ? order === 'crouch'
        ? 'crouch'
        : order === 'prone'
          ? 'prone'
          : 'idle'
      : 'idle';
    if (c.members && u.climbing > 0) {
      const wall = s.walls.find((w) => w.uid === u.climbWall)!;
      if (wall.hp <= 0) {
        u.climbing = 0;
        u.passedWalls.push(wall.uid);
      } else {
        u.climbing = Math.max(0, u.climbing - dt);
        const progress = 1 - u.climbing / 1.2;
        u.x = u.climbFrom + dir * (wall.width + 30) * progress;
        u.y = ground(s, u.x) - Math.sin(progress * Math.PI) * wall.height;
        u.pose = 'climb';
        u.walk += dt * 5;
        u.moving = true;
        if (u.climbing === 0) u.passedWalls.push(wall.uid);
        continue;
      }
    }
    const candidates = s.units
      .filter(
        (v) =>
          v.side !== u.side &&
          v.hp > 0 &&
          (!CARDS[v.id].air || c.antiAir) &&
          Math.abs(v.x - u.x) <= c.range!,
      )
      .sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x));
    const target = candidates[0];
    const baseInRange = Math.abs(baseX - u.x) <= c.range!;
    if ((target || baseInRange) && u.cooldown <= 0) {
      u.cooldown = c.rate!;
      u.fire = 0.25;
      const tx = target ? target.x : baseX,
        ty = target
          ? target.y -
            (target.pose === 'prone' ? 7 : target.pose === 'crouch' ? 18 : 27)
          : ground(s, baseX) - 25;
      const sx = u.x + dir * 18,
        sy =
          u.y -
          (c.air
            ? 16
            : c.id === 'tank'
              ? 54
              : u.pose === 'prone'
                ? 9
                : u.pose === 'crouch'
                  ? 28
                  : 47),
        total = c.radius ? 0.48 : 0.13;
      s.projectiles.push({
        x: sx,
        y: sy,
        tx,
        ty,
        side: u.side,
        targetUid: target?.uid ?? null,
        base: target ? null : enemySide,
        damage: (c.damage! / (c.members ?? 1)) * (morale ? 1.35 : 1),
        radius: c.radius ?? 0,
        life: total,
        total,
        startX: sx,
        startY: sy,
      });
    } else if (!target && !baseInRange && (!c.members || order !== 'hold')) {
      const wall = c.members
        ? s.walls.find(
            (w) =>
              w.hp > 0 &&
              !u.passedWalls.includes(w.uid) &&
              (w.x - u.x) * dir > 0 &&
              Math.abs(w.x - u.x) < w.width / 2 + 18,
          )
        : null;
      if (wall) {
        u.climbing = 1.2;
        u.climbFrom = u.x;
        u.climbWall = wall.uid;
        u.pose = 'climb';
        continue;
      }
      if (c.members)
        u.pose =
          order === 'rush'
            ? 'run'
            : order === 'crouch'
              ? 'crouch'
              : order === 'prone'
                ? 'prone'
                : 'walk';
      const orderSpeed = c.members
        ? order === 'rush'
          ? 1.7
          : order === 'crouch'
            ? 0.55
            : order === 'prone'
              ? 0.25
              : 1
        : 1;
      const slope = Math.abs(ground(s, u.x + dir * 12) - ground(s, u.x));
      u.x = Math.max(
        55,
        Math.min(
          W - 55,
          u.x +
            dir *
              c.speed! *
              u.pace *
              orderSpeed *
              dt *
              (morale ? 1.2 : 1) *
              (c.air ? 1 : 1 - Math.min(0.52, slope * 0.025)),
        ),
      );
      u.walk += dt * (u.pose === 'run' ? 11 : u.pose === 'prone' ? 3 : 6);
      u.moving = true;
    }
    if (u.id === 'tank') {
      for (const wall of s.walls) {
        if (wall.hp > 0 && Math.abs(u.x - wall.x) < 26) {
          wall.hp = 0;
          burst(s, wall.x, ground(s, wall.x) - 12, 22);
        }
      }
    }
    u.y = c.air ? 232 + Math.sin(s.time * 2 + u.uid) * 6 : ground(s, u.x);
  }
  for (const p of s.projectiles) {
    p.life -= dt;
    const t = 1 - Math.max(0, p.life) / p.total;
    p.x = p.startX + (p.tx - p.startX) * t;
    p.y =
      p.startY +
      (p.ty - p.startY) * t -
      (p.radius ? Math.sin(t * Math.PI) * 35 : 0);
    if (p.life <= 0) {
      if (p.radius) explode(s, p.tx, p.ty, p.radius, p.damage, p.side);
      else if (p.targetUid !== null) {
        const u = s.units.find((u) => u.uid === p.targetUid);
        if (u) {
          hitUnit(s, u, p.damage, p.side);
          for (let i = 0; i < 4; i++) {
            const life = 0.15 + rnd(s) * 0.2;
            s.particles.push({
              x: p.tx,
              y: p.ty,
              vx: (rnd(s) - 0.5) * 50,
              vy: -15 - rnd(s) * 30,
              life,
              maxLife: life,
              color: i === 0 ? '#e4c38a' : '#a59b83',
              size: i === 0 ? 2 : 1,
            });
          }
        }
      } else if (p.base !== null)
        s.players[p.base].hp = Math.max(0, s.players[p.base].hp - p.damage);
    }
  }
  s.projectiles = s.projectiles.filter((p) => p.life > 0);
  s.units = s.units.filter((u) => u.hp > 0 || u.deadFor > 0);
  for (const p of s.particles) {
    p.life -= dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 190 * dt;
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
      kills: p.kills,
      played: p.played,
    })),
    units: s.units.map((u) => ({ ...u })),
    walls: s.walls.map((w) => ({ ...w })),
    explosions: s.explosions,
    notices: s.notices.map((n) => ({ ...n })),
  };
}
