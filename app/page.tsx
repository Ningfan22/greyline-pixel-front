'use client';
import { useEffect, useMemo, useState } from 'react';
import { DECK, chooseAiDeck, type CardId } from '@/game/engine';
import Battle from './battle';
import { getBattleAudio } from '@/game/audio';
import DeckBuilder from './deck-builder';
import HomeMenu, { type LobbyPage } from './home-menu';
import { DEFAULT_MAP, isMapId, type MapId } from '@/game/maps';
import { DEFAULT_DIFFICULTY, type Difficulty } from '@/game/economy';
import { isMissionId, MISSIONS, type MissionId } from '@/game/campaign';
import {
  loadCollection,
  validDeckWithCollection,
  type CollectionState,
} from '@/game/collection';
import {
  loadDeckStore,
  activeDeck,
  withActiveDeck,
  addDeck as addDeckSlot,
  deleteDeck as deleteDeckSlot,
  renameDeck as renameDeckSlot,
  selectDeck as selectDeckSlot,
  type DeckStore,
} from '@/game/decks-store';
export default function Home() {
  const [page, setPage] = useState<LobbyPage | 'battle'>('home');
  const [builderOpened, setBuilderOpened] = useState(false);
  const [collection, setCollection] = useState<CollectionState | null>(null);
  const [deckStore, setDeckStore] = useState<DeckStore | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [mapId, setMapId] = useState<MapId>(DEFAULT_MAP);
  const [difficulty, setDifficulty] = useState<Difficulty>(DEFAULT_DIFFICULTY);
  const [night, setNight] = useState(false);
  const [completed, setCompleted] = useState<MissionId[]>([]);
  const [match, setMatch] = useState<{
    seed: number;
    player: CardId[];
    ai: CardId[];
    mapId: MapId;
    missionId?: MissionId;
    difficulty: Difficulty;
    night: boolean;
  } | null>(null);
  const deck = useMemo<CardId[]>(
    () => (deckStore ? [...activeDeck(deckStore).cards] : [...DECK]),
    [deckStore],
  );
  useEffect(() => {
    let live = true;
    queueMicrotask(() => {
      if (!live) return;
      try {
        const savedMap = localStorage.getItem('greyline-map');
        const savedDifficulty = localStorage.getItem('greyline-difficulty-v21');
        if (
          savedDifficulty === 'standard' ||
          savedDifficulty === 'veteran' ||
          savedDifficulty === 'elite'
        )
          setDifficulty(savedDifficulty);
        const progress = JSON.parse(
          localStorage.getItem('greyline-campaign-v21') ?? '[]',
        );
        if (Array.isArray(progress)) setCompleted(progress.filter(isMissionId));
        if (isMapId(savedMap)) setMapId(savedMap);
        const savedNight = localStorage.getItem('greyline-night');
        if (savedNight === '1') setNight(true);
        const col = loadCollection();
        setCollection(col);
        setDeckStore(loadDeckStore(col));
      } catch {
        /* 存储不可用时退回默认收藏与默认编队。 */
        const fallback = loadCollection();
        setCollection(fallback);
        setDeckStore(loadDeckStore(fallback));
      }
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, []);
  const save = (next: CardId[]) => {
    if (!collection) return '收藏仍在加载，请稍候';
    if (!validDeckWithCollection(next, collection))
      return '编队需满 20 张，且不能超过已拥有的卡牌数量';
    setDeckStore((prev) => (prev ? withActiveDeck(prev, next) : prev));
    return '编队已保存到当前卡组';
  };
  const saveDeckAs = (cards: CardId[], name?: string) => {
    if (!collection || !deckStore) return false;
    if (!validDeckWithCollection(cards, collection)) return false;
    const created = addDeckSlot(deckStore, name);
    if (!created) return false;
    setDeckStore(withActiveDeck(created, cards));
    return true;
  };
  const begin = (chosen: CardId[], missionId?: MissionId) => {
    if (!collection || !validDeckWithCollection(chosen, collection)) return;
    void getBattleAudio().unlock();
    const seed = Date.now();
    setMatch({
      seed,
      player: [...chosen],
      ai: chooseAiDeck(seed),
      mapId,
      missionId,
      difficulty,
      night,
    });
    setPage('battle');
  };
  const navigate = (next: LobbyPage) => {
    if (next === 'builder') setBuilderOpened(true);
    setPage(next);
  };
  if (page === 'battle' && match)
    return (
      <Battle
        key={`${match.seed}-${match.missionId ?? 'skirmish'}`}
        playerDeck={match.player}
        aiDeck={match.ai}
        seed={match.seed}
        mapId={match.mapId}
        difficulty={match.difficulty}
        night={match.night}
        missionId={match.missionId}
        onMissionComplete={(id) => {
          setCompleted((previous) => {
            const next = Array.from(new Set([...previous, id]));
            try {
              localStorage.setItem(
                'greyline-campaign-v21',
                JSON.stringify(next),
              );
            } catch {
              /* Current session progress remains usable. */
            }
            return next;
          });
        }}
        onNextMission={
          match.missionId &&
          MISSIONS.findIndex((m) => m.id === match.missionId) <
            MISSIONS.length - 1
            ? () =>
                begin(
                  deck,
                  MISSIONS[
                    MISSIONS.findIndex((m) => m.id === match.missionId) + 1
                  ].id,
                )
            : undefined
        }
        onExit={() => {
          setPage(match.missionId ? 'campaign' : 'home');
          setBuilderOpened(false);
        }}
      />
    );
  return (
    <HomeMenu
      page={page === 'battle' ? 'home' : page}
      ready={loaded}
      deckCount={deck.length}
      gold={collection?.gold ?? 0}
      collection={collection}
      onCollectionChange={setCollection}
      mapId={mapId}
      difficulty={difficulty}
      completed={completed}
      onMissionStart={(id) => begin(deck, id)}
      onDifficultyChange={(value) => {
        setDifficulty(value);
        try {
          localStorage.setItem('greyline-difficulty-v21', value);
        } catch {
          /* Keep this session setting. */
        }
      }}
      onMapChange={(id) => {
        setMapId(id);
        try {
          localStorage.setItem('greyline-map', id);
        } catch {
          /* Selection remains valid this session. */
        }
      }}
      night={night}
      onNightChange={(value) => {
        setNight(value);
        try {
          localStorage.setItem('greyline-night', value ? '1' : '0');
        } catch {
          /* Selection remains valid this session. */
        }
      }}
      onNavigate={navigate}
      onStart={() => begin(deck)}
    >
      {builderOpened && loaded && (
        <DeckBuilder
          deck={deck}
          onSave={save}
          onSaveAs={saveDeckAs}
          onStart={begin}
          onExit={() => setPage('home')}
          collection={collection}
          deckStore={deckStore}
          onSelectDeck={(id) =>
            setDeckStore((prev) => (prev ? selectDeckSlot(prev, id) : prev))
          }
          onDeleteDeck={(id) =>
            setDeckStore((prev) =>
              prev ? deleteDeckSlot(prev, id) ?? prev : prev,
            )
          }
          onRenameDeck={(name) =>
            setDeckStore((prev) => (prev ? renameDeckSlot(prev, name) : prev))
          }
        />
      )}
    </HomeMenu>
  );
}
