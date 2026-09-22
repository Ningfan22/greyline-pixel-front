/**
 * Lobby state singleton: holds collection, decks, map/difficulty/night
 * preferences, campaign progress, and the pending match configuration.
 * Replaces the React state in app/page.tsx.
 */

import {
  DECK,
  chooseAiDeck,
  type CardId,
} from '@/game/engine';
import { DEFAULT_MAP, isMapId, type MapId } from '@/game/maps';
import {
  DEFAULT_DIFFICULTY,
  type Difficulty,
} from '@/game/economy';
import { isMissionId, MISSIONS, type MissionId } from '@/game/campaign';
import {
  loadCollection,
  starterState,
  saveCollection,
  validDeckWithCollection,
  type CollectionState,
} from '@/game/collection';
import {
  loadDeckStore,
  defaultDeckStore,
  saveDeckStore,
  activeDeck,
  withActiveDeck,
  addDeck as addDeckSlot,
  deleteDeck as deleteDeckSlot,
  renameDeckById as renameDeckSlot,
  selectDeck as selectDeckSlot,
  type DeckStore,
} from '@/game/decks-store';

export interface MatchConfig {
  seed: number;
  player: CardId[];
  ai: CardId[];
  mapId: MapId;
  missionId?: MissionId;
  difficulty: Difficulty;
  night: boolean;
}

type Listener = () => void;

export class LobbyState {
  // Module imports happen before the platform adapter installs localStorage.
  collection: CollectionState = starterState();
  deckStore: DeckStore = defaultDeckStore();
  mapId: MapId = DEFAULT_MAP;
  difficulty: Difficulty = DEFAULT_DIFFICULTY;
  night = false;
  completed: MissionId[] = [];
  match: MatchConfig | null = null;

  /** Called when a battle should start (wired to router.navigate). */
  onBattle: ((match: MatchConfig) => void) | null = null;
  /** Called when returning to lobby from battle. */
  onExitBattle: (() => void) | null = null;

  private listeners = new Set<Listener>();

  initialize(): void {
    this.collection = loadCollection();
    this.deckStore = loadDeckStore(this.collection);
    this.loadPrefs();
    this.emit();
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit(): void {
    for (const fn of this.listeners) fn();
  }

  private loadPrefs(): void {
    try {
      const savedMap = localStorage.getItem('greyline-map');
      if (isMapId(savedMap)) this.mapId = savedMap;
      const savedDifficulty = localStorage.getItem('greyline-difficulty-v21');
      if (
        savedDifficulty === 'standard' ||
        savedDifficulty === 'veteran' ||
        savedDifficulty === 'elite'
      )
        this.difficulty = savedDifficulty;
      if (localStorage.getItem('greyline-night') === '1') this.night = true;
      const progress = JSON.parse(
        localStorage.getItem('greyline-campaign-v21') ?? '[]',
      );
      if (Array.isArray(progress))
        this.completed = progress.filter(isMissionId);
    } catch {
      /* defaults */
    }
  }

  get deck(): CardId[] {
    return [...activeDeck(this.deckStore).cards];
  }

  setMap(id: MapId): void {
    this.mapId = id;
    localStorage.setItem('greyline-map', id);
    this.emit();
  }

  setDifficulty(d: Difficulty): void {
    this.difficulty = d;
    localStorage.setItem('greyline-difficulty-v21', d);
    this.emit();
  }

  setNight(v: boolean): void {
    this.night = v;
    localStorage.setItem('greyline-night', v ? '1' : '0');
    this.emit();
  }

  /** Save the active deck. Returns error message or null on success. */
  saveDeck(cards: CardId[]): string | null {
    if (!validDeckWithCollection(cards, this.collection))
      return '编队需满 20 张，且不能超过已拥有的卡牌数量';
    this.deckStore = withActiveDeck(this.deckStore, cards);
    saveDeckStore(this.deckStore);
    this.emit();
    return null;
  }

  saveDeckAs(cards: CardId[], name?: string): boolean {
    if (!validDeckWithCollection(cards, this.collection)) return false;
    const created = addDeckSlot(this.deckStore, name);
    if (!created) return false;
    this.deckStore = withActiveDeck(created, cards);
    saveDeckStore(this.deckStore);
    this.emit();
    return true;
  }

  addDeckSlot(): boolean {
    const created = addDeckSlot(this.deckStore);
    if (!created) return false;
    this.deckStore = created;
    saveDeckStore(this.deckStore);
    this.emit();
    return true;
  }

  deleteDeckSlot(id: string): void {
    const next = deleteDeckSlot(this.deckStore, id);
    if (!next) return;
    this.deckStore = next;
    saveDeckStore(this.deckStore);
    this.emit();
  }

  renameDeckSlot(id: string, name: string): void {
    this.deckStore = renameDeckSlot(this.deckStore, id, name);
    saveDeckStore(this.deckStore);
    this.emit();
  }

  selectDeckSlot(id: string): void {
    this.deckStore = selectDeckSlot(this.deckStore, id);
    saveDeckStore(this.deckStore);
    this.emit();
  }

  updateCollection(next: CollectionState): void {
    this.collection = next;
    saveCollection(next);
    this.emit();
  }

  /** Start a battle with the given deck (defaults to active deck). */
  begin(chosen?: CardId[], missionId?: MissionId): string | null {
    const cards = chosen ?? this.deck;
    if (!validDeckWithCollection(cards, this.collection))
      return '编队需满 20 张，且不能超过已拥有的卡牌数量';
    const seed = Date.now();
    this.match = {
      seed,
      player: [...cards],
      ai: chooseAiDeck(seed),
      mapId: this.mapId,
      missionId,
      difficulty: this.difficulty,
      night: this.night,
    };
    this.onBattle?.(this.match);
    return null;
  }

  /** Mark a campaign mission complete. */
  completeMission(id: MissionId): void {
    if (!this.completed.includes(id)) {
      this.completed.push(id);
      localStorage.setItem(
        'greyline-campaign-v21',
        JSON.stringify(this.completed),
      );
      this.emit();
    }
  }

  isMissionUnlocked(index: number): boolean {
    if (index === 0) return true;
    return this.completed.includes(MISSIONS[index - 1].id);
  }
}

export const lobbyState = new LobbyState();
export { DECK };
