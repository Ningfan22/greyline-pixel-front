/* 多卡组存储：最多 6 套编队，本地持久化。 */
import { DECK, DECK_SIZE, type CardId } from './cards';
import {
  clampToCollection,
  type CollectionState,
} from './collection';

export const MAX_DECKS = 6;
export const DECKS_STORAGE = 'greyline-decks-v1';
export const LEGACY_DECK_STORAGE = 'greyline-deck-v6';

export interface DeckSlot {
  id: string;
  name: string;
  cards: CardId[];
}

export interface DeckStore {
  decks: DeckSlot[];
  activeId: string;
}

let seq = 0;
export function newDeckId(): string {
  seq += 1;
  return `deck-${Date.now().toString(36)}-${seq}`;
}

export function defaultDeckStore(): DeckStore {
  const id = newDeckId();
  return {
    decks: [{ id, name: '机步协同', cards: [...DECK] }],
    activeId: id,
  };
}

function sanitizeDeck(
  raw: unknown,
  fallbackName: string,
  collection: CollectionState,
): DeckSlot | null {
  if (!raw || typeof raw !== 'object') return null;
  const candidate = raw as Partial<DeckSlot>;
  if (!Array.isArray(candidate.cards)) return null;
  const cards = clampToCollection(
    candidate.cards.filter(
      (id): id is CardId => typeof id === 'string',
    ),
    collection,
  ).slice(0, DECK_SIZE);
  return {
    id: typeof candidate.id === 'string' && candidate.id ? candidate.id : newDeckId(),
    name:
      typeof candidate.name === 'string' && candidate.name.trim()
        ? candidate.name.trim().slice(0, 12)
        : fallbackName,
    cards,
  };
}

/**
 * 读取卡组。首次访问时迁移旧版单卡组；所有卡组按收藏夹紧，
 * 老玩家因收藏迁移已赠予旧卡所有权，编队不会被裁掉。
 */
export function loadDeckStore(collection: CollectionState): DeckStore {
  try {
    const raw = localStorage.getItem(DECKS_STORAGE);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<DeckStore>;
      if (Array.isArray(parsed.decks) && parsed.decks.length) {
        const decks = parsed.decks
          .slice(0, MAX_DECKS)
          .map((d, i) => sanitizeDeck(d, `编队 ${i + 1}`, collection))
          .filter((d): d is DeckSlot => d !== null);
        if (decks.length) {
          // Imported/old saves can reuse slot IDs. Editing or deleting one
          // must not silently edit/delete every other slot with that ID.
          const seen = new Set<string>();
          for (const deck of decks) {
            if (seen.has(deck.id)) deck.id = newDeckId();
            seen.add(deck.id);
          }
          const activeId = decks.some((d) => d.id === parsed.activeId)
            ? (parsed.activeId as string)
            : decks[0].id;
          const store = { decks, activeId };
          saveDeckStore(store);
          return store;
        }
      }
    }
  } catch {
    /* 落到迁移/默认逻辑。 */
  }
  const store = defaultDeckStore();
  try {
    const legacy = JSON.parse(
      localStorage.getItem(LEGACY_DECK_STORAGE) ?? 'null',
    ) as CardId[] | null;
    if (Array.isArray(legacy)) {
      const migrated = sanitizeDeck(
        { id: store.decks[0].id, name: '机步协同', cards: legacy },
        '机步协同',
        collection,
      );
      if (migrated && migrated.cards.length) store.decks[0] = migrated;
    }
  } catch {
    /* 没有旧卡组就用默认。 */
  }
  saveDeckStore(store);
  return store;
}

export function saveDeckStore(store: DeckStore) {
  try {
    localStorage.setItem(DECKS_STORAGE, JSON.stringify(store));
  } catch {
    /* 存储不可用时本次会话仍然有效。 */
  }
}

export function activeDeck(store: DeckStore): DeckSlot {
  return store.decks.find((d) => d.id === store.activeId) ?? store.decks[0];
}

export function withActiveDeck(
  store: DeckStore,
  cards: CardId[],
): DeckStore {
  const decks = store.decks.map((d) =>
    d.id === store.activeId ? { ...d, cards: [...cards] } : d,
  );
  const next = { ...store, decks };
  saveDeckStore(next);
  return next;
}

export function renameDeck(store: DeckStore, name: string): DeckStore {
  const trimmed = name.trim().slice(0, 12);
  if (!trimmed) return store;
  const decks = store.decks.map((d) =>
    d.id === store.activeId ? { ...d, name: trimmed } : d,
  );
  const next = { ...store, decks };
  saveDeckStore(next);
  return next;
}

/** Rename any slot by id (not just the active one). */
export function renameDeckById(store: DeckStore, id: string, name: string): DeckStore {
  const trimmed = name.trim().slice(0, 12);
  if (!trimmed) return store;
  const decks = store.decks.map((d) =>
    d.id === id ? { ...d, name: trimmed } : d,
  );
  const next = { ...store, decks };
  saveDeckStore(next);
  return next;
}

export function addDeck(store: DeckStore, name?: string): DeckStore | null {
  if (store.decks.length >= MAX_DECKS) return null;
  const id = newDeckId();
  const slot: DeckSlot = {
    id,
    name: name?.trim().slice(0, 12) || `编队 ${store.decks.length + 1}`,
    cards: [],
  };
  const next = { decks: [...store.decks, slot], activeId: id };
  saveDeckStore(next);
  return next;
}

export function deleteDeck(store: DeckStore, id: string): DeckStore | null {
  if (store.decks.length <= 1) return null;
  const decks = store.decks.filter((d) => d.id !== id);
  if (!decks.length) return null;
  const activeId = store.activeId === id ? decks[0].id : store.activeId;
  const next = { decks, activeId };
  saveDeckStore(next);
  return next;
}

export function selectDeck(store: DeckStore, id: string): DeckStore {
  if (!store.decks.some((d) => d.id === id)) return store;
  const next = { ...store, activeId: id };
  saveDeckStore(next);
  return next;
}
