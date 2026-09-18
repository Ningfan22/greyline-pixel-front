'use client';
import { useEffect, useState } from 'react';
import { DECK, validDeck, chooseAiDeck, type CardId } from '@/game/engine';
import Battle from './battle';
import { getBattleAudio } from '@/game/audio';
import DeckBuilder from './deck-builder';
import HomeMenu, { type LobbyPage } from './home-menu';
import { DEFAULT_MAP, isMapId, type MapId } from '@/game/maps';
import { DEFAULT_DIFFICULTY, type Difficulty } from '@/game/economy';
import { isMissionId, MISSIONS, type MissionId } from '@/game/campaign';
const STORAGE = 'greyline-deck-v6';
export default function Home() {
  const [page, setPage] = useState<LobbyPage | 'battle'>('home');
  const [builderOpened, setBuilderOpened] = useState(false);
  const [deck, setDeck] = useState<CardId[]>([...DECK]);
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
        const saved = JSON.parse(localStorage.getItem(STORAGE) ?? 'null');
        if (validDeck(saved)) {
          setDeck([...saved]);
        }
      } catch {
        /* Keep the recommended deck when device storage is unavailable. */
      }
      setLoaded(true);
    });
    return () => {
      live = false;
    };
  }, []);
  const save = (next: CardId[]) => {
    if (!validDeck(next)) return '编队需满 20 张，且各卡数量不能超过上限';
    setDeck([...next]);
    try {
      localStorage.setItem(STORAGE, JSON.stringify(next));
      return '编队已保存到当前设备';
    } catch {
      return '编队本次已生效；浏览器未允许本地保存';
    }
  };
  const begin = (chosen: CardId[], missionId?: MissionId) => {
    if (!validDeck(chosen)) return;
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
          onStart={begin}
          onExit={() => setPage('home')}
        />
      )}
    </HomeMenu>
  );
}
