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
export const AD_REWARD = 50;
export const AD_COOLDOWN_MS = 15_000;
export const STARTER_GOLD = 100;

export const COLLECTION_STORAGE = 'greyline-collection-v1';
export const LEGACY_DECK_STORAGE = 'greyline-deck-v6';

export interface CollectionState {
  gold: number;
  owned: Partial<Record<CardId, number>>;
  packsOpened: number;
  adsWatched: number;
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
  for (const id of Object.keys(CARDS) as CardId[]) pools[rarityOf(id)].push(id);
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
    const n = state.owned[id] ?? 0;
    if (n > 0) species += 1;
    copies += n;
  }
  return { species, total: Object.keys(CARDS).length, copies };
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
  return state;
}

export function saveCollection(state: CollectionState) {
  try {
    localStorage.setItem(COLLECTION_STORAGE, JSON.stringify(state));
  } catch {
    /* 存储不可用时本次会话仍然有效。 */
  }
}

/** 开一包卡：随机 5 张（可重复），按稀有度加权。 */
export function openPack(
  state: CollectionState,
  rng: () => number = Math.random,
): { state: CollectionState; drawn: CardId[] } {
  const drawn: CardId[] = [];
  const owned = { ...state.owned };
  for (let i = 0; i < PACK_SIZE; i += 1) {
    const id = rollCard(rollRarity(rng), rng);
    drawn.push(id);
    owned[id] = (owned[id] ?? 0) + 1;
  }
  const next: CollectionState = {
    ...state,
    gold: state.gold - PACK_COST,
    owned,
    packsOpened: state.packsOpened + 1,
  };
  saveCollection(next);
  return { state: next, drawn };
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
