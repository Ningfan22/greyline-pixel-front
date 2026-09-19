/* 卡牌收藏、金币与卡包。新玩家只有初始牌库，其余卡牌靠开卡包解锁。 */
import { CARDS, copyLimit, validDeck, type CardId } from './cards';

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export const RARITY_LABEL: Record<Rarity, string> = {
  common: '常规',
  rare: '精锐',
  epic: '王牌',
  legendary: '传奇',
};

export const PACK_COST = 100;
export const PACK_SIZE = 5;
export const TEN_PACK_COST = 1000;
export const TEN_PACK_SIZE = 50;
export const AD_REWARD = 100;
export const AD_COOLDOWN_MS = 15_000;
export const STARTER_GOLD = 100;
/** 测试期一次性发放的金币，方便联调商店与抽卡。 */
export const TEST_GOLD_GRANT = 10000;

/** 抽到已达携带上限的卡时，按稀有度转化为金币。 */
export const RARITY_COMPENSATION: Record<Rarity, number> = {
  common: 5,
  rare: 10,
  epic: 20,
  legendary: 50,
};

export const COLLECTION_STORAGE = 'greyline-collection-v1';
export const LEGACY_DECK_STORAGE = 'greyline-deck-v6';

export interface CollectionState {
  gold: number;
  owned: Partial<Record<CardId, number>>;
  packsOpened: number;
  adsWatched: number;
  /** 测试金币是否已发放，保证只发一次。 */
  testGoldGranted?: boolean;
}

/** 初始牌库：30 种、共 45 张，覆盖默认「机步协同」编队。 */
export const STARTER_COLLECTION: Partial<Record<CardId, number>> = {
  infantry: 4,
  fire_team: 2,
  antiarmor: 2,
  supply: 2,
  scouts: 2,
  machinegun: 2,
  rocket: 2,
  mortar: 2,
  ifv: 2,
  pickup: 2,
  morale: 2,
  smoke: 2,
  recon: 2,
  javelin: 1,
  manpads: 1,
  sam_vehicle: 1,
  supply_team: 1,
  medic: 1,
  tank: 1,
  tow_ifv: 1,
  lmg_team: 1,
  smoke_withdrawal: 1,
  command_expansion: 1,
  sniper: 1,
  field_logistics: 1,
  war_bonds: 1,
  steadfast: 1,
  fortify: 1,
  aa_gun: 1,
  anti_tank_gun: 1,
};

export function rarityOf(id: CardId): Rarity {
  const c = CARDS[id];
  if (copyLimit(id) === 1) return 'legendary';
  if (c.air || c.cost >= 6) return 'epic';
  if (c.cost >= 4 || c.vehicle) return 'rare';
  return 'common';
}

const RARITY_POOLS: Record<Rarity, CardId[]> = (() => {
  const pools: Record<Rarity, CardId[]> = {
    common: [],
    rare: [],
    epic: [],
    legendary: [],
  };
  for (const id of Object.keys(CARDS) as CardId[])
    if (!CARDS[id].internal) pools[rarityOf(id)].push(id);
  return pools;
})();

export const RARITY_RATE: Record<Rarity, number> = {
  common: 0.6,
  rare: 0.28,
  epic: 0.1,
  legendary: 0.02,
};

function rollRarity(rng: () => number): Rarity {
  const roll = rng();
  let acc = 0;
  for (const rarity of ['legendary', 'epic', 'rare', 'common'] as Rarity[]) {
    acc += RARITY_RATE[rarity];
    if (roll <= acc) return rarity;
  }
  return 'common';
}

function rollCard(rarity: Rarity, rng: () => number): CardId {
  const pool = RARITY_POOLS[rarity];
  return pool[Math.floor(rng() * pool.length)];
}

/** 一张卡在收藏中的实际上限：min(游戏内携带上限, 已拥有数量)。 */
export function deckLimit(state: CollectionState, id: CardId): number {
  return Math.min(copyLimit(id), state.owned[id] ?? 0);
}

export function ownedCount(state: CollectionState, id: CardId): number {
  return state.owned[id] ?? 0;
}

export function collectionProgress(state: CollectionState): {
  species: number;
  total: number;
  copies: number;
} {
  let species = 0;
  let copies = 0;
  for (const id of Object.keys(CARDS) as CardId[]) {
    if (CARDS[id].internal) continue;
    const n = state.owned[id] ?? 0;
    if (n > 0) species += 1;
    copies += n;
  }
  return { species, total: Object.values(CARDS).filter(c => !c.internal).length, copies };
}

/** 编队校验：满 20 张、每张不超过收藏上限。 */
export function validDeckWithCollection(
  value: unknown,
  state: CollectionState,
): value is CardId[] {
  return (
    validDeck(value) &&
    (value as CardId[]).every(
      (id) =>
        (value as CardId[]).filter((v) => v === id).length <=
        deckLimit(state, id),
    )
  );
}

/** 把一份卡牌列表按收藏上限夹紧（用于推荐编队与旧数据迁移）。 */
export function clampToCollection(
  cards: CardId[],
  state: CollectionState,
): CardId[] {
  const seen = new Map<CardId, number>();
  const out: CardId[] = [];
  for (const id of cards) {
    const n = seen.get(id) ?? 0;
    if (n < deckLimit(state, id)) {
      out.push(id);
      seen.set(id, n + 1);
    }
  }
  return out;
}

function starterState(): CollectionState {
  return {
    gold: STARTER_GOLD,
    owned: { ...STARTER_COLLECTION },
    packsOpened: 0,
    adsWatched: 0,
    testGoldGranted: false,
  };
}

/**
 * 读取收藏。首次访问时建立初始牌库，并把旧版单卡组（greyline-deck-v6）
 * 里已编入的卡按数量赠予所有权，保证老玩家收藏不缩水。
 */
export function loadCollection(): CollectionState {
  let state: CollectionState | null = null;
  try {
    const raw = localStorage.getItem(COLLECTION_STORAGE);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<CollectionState>;
      if (parsed && typeof parsed.gold === 'number' && parsed.owned) {
        state = {
          gold: parsed.gold,
          owned: { ...parsed.owned } as Partial<Record<CardId, number>>,
          packsOpened: parsed.packsOpened ?? 0,
          adsWatched: parsed.adsWatched ?? 0,
          testGoldGranted: parsed.testGoldGranted ?? false,
        };
      }
    }
  } catch {
    state = null;
  }
  if (!state) {
    state = starterState();
    try {
      const legacy = JSON.parse(
        localStorage.getItem(LEGACY_DECK_STORAGE) ?? 'null',
      ) as CardId[] | null;
      if (Array.isArray(legacy)) {
        for (const id of legacy) {
          if (Object.hasOwn(CARDS, id)) {
            state.owned[id] = Math.min(
              copyLimit(id),
              (state.owned[id] ?? 0) + 1,
            );
          }
        }
      }
    } catch {
      /* 没有旧卡组就保持初始牌库。 */
    }
    saveCollection(state);
  }
  if (!state.testGoldGranted) {
    state.gold += TEST_GOLD_GRANT;
    state.testGoldGranted = true;
    saveCollection(state);
  }
  return state;
}

export function saveCollection(state: CollectionState) {
  try {
    localStorage.setItem(COLLECTION_STORAGE, JSON.stringify(state));
  } catch {
    /* 存储不可用时本次会话仍然有效。 */
  }
}

/** 一次开包的逐张结果：抽到的卡、是否转化、转化金币。 */
export interface PackDraw {
  id: CardId;
  rarity: Rarity;
  converted: boolean;
  gold: number;
}

export interface PackResult {
  state: CollectionState;
  drawn: PackDraw[];
  /** 本次转化获得的金币总数。 */
  goldGained: number;
  /** 十连保底是否触发（把一张低于王牌的卡替换成了王牌）。 */
  pity: boolean;
}

/** 抽一张并结算：已达携带上限则转化为金币，否则入收藏。 */
function settleDraw(
  id: CardId,
  owned: Partial<Record<CardId, number>>,
): PackDraw {
  const rarity = rarityOf(id);
  const have = owned[id] ?? 0;
  if (have >= copyLimit(id)) {
    return { id, rarity, converted: true, gold: RARITY_COMPENSATION[rarity] };
  }
  owned[id] = have + 1;
  return { id, rarity, converted: false, gold: 0 };
}

/** 开一包卡：随机 5 张（可重复），按稀有度加权；溢出转金币。 */
export function openPack(
  state: CollectionState,
  rng: () => number = Math.random,
): PackResult {
  requireGold(state, PACK_COST);
  const owned = { ...state.owned };
  const drawn: PackDraw[] = [];
  let goldGained = 0;
  for (let i = 0; i < PACK_SIZE; i += 1) {
    const draw = settleDraw(rollCard(rollRarity(rng), rng), owned);
    drawn.push(draw);
    goldGained += draw.gold;
  }
  const next: CollectionState = {
    ...state,
    gold: state.gold - PACK_COST + goldGained,
    owned,
    packsOpened: state.packsOpened + 1,
  };
  saveCollection(next);
  return { state: next, drawn, goldGained, pity: false };
}

/** 连开十包：50 张，至少保底一张王牌（epic）；溢出转金币。 */
export function openTenPacks(
  state: CollectionState,
  rng: () => number = Math.random,
): PackResult {
  requireGold(state, TEN_PACK_COST);
  const owned = { ...state.owned };
  const drawn: PackDraw[] = [];
  let goldGained = 0;
  let pity = false;
  for (let i = 0; i < TEN_PACK_SIZE; i += 1) {
    const id = rollCard(rollRarity(rng), rng);
    drawn.push({ id, rarity: rarityOf(id), converted: false, gold: 0 });
  }
  // 全精锐也必须保底；先替换常规，没有常规则替换第一张精锐。
  if (!drawn.some((d) => d.rarity === 'epic' || d.rarity === 'legendary')) {
    const idx = Math.max(0, drawn.findIndex((d) => d.rarity === 'common'));
    // 有未满的王牌就从其中选；全满时仍按正常溢出规则返还 20 金币。
    const available = RARITY_POOLS.epic.filter((id) => (owned[id] ?? 0) < copyLimit(id));
    const pool = available.length ? available : RARITY_POOLS.epic;
    const pityId = pool[Math.floor(rng() * pool.length)];
    drawn[idx] = { id: pityId, rarity: 'epic', converted: false, gold: 0 };
    pity = true;
  }
  for (const draw of drawn) {
    const settled = settleDraw(draw.id, owned);
    draw.converted = settled.converted;
    draw.gold = settled.gold;
    goldGained += settled.gold;
  }
  const next: CollectionState = {
    ...state,
    gold: state.gold - TEN_PACK_COST + goldGained,
    owned,
    packsOpened: state.packsOpened + 10,
  };
  saveCollection(next);
  return { state: next, drawn, goldGained, pity };
}

export function grantAdReward(state: CollectionState): CollectionState {
  const next: CollectionState = {
    ...state,
    gold: state.gold + AD_REWARD,
    adsWatched: state.adsWatched + 1,
  };
  saveCollection(next);
  return next;
}

function requireGold(state: CollectionState, cost: number) {
  if (!Number.isFinite(state.gold) || state.gold < cost) {
    throw new RangeError('金币不足，未购买卡包');
  }
}
