'use client';
import { useEffect, useState } from 'react';
import { DECK, validDeck, chooseAiDeck, type CardId } from '@/game/engine';
import Battle from './battle';
import { getBattleAudio } from '@/game/audio';
import DeckBuilder from './deck-builder';
import HomeMenu, { type LobbyPage } from './home-menu';
const STORAGE = 'greyline-deck-v6';
export default function Home() {
  const [page, setPage] = useState<LobbyPage | 'battle'>('home');
  const [builderOpened, setBuilderOpened] = useState(false);
  const [deck, setDeck] = useState<CardId[]>([...DECK]);
  const [loaded, setLoaded] = useState(false);
  const [match, setMatch] = useState<{
    seed: number;
    player: CardId[];
    ai: CardId[];
  } | null>(null);
  useEffect(() => {
    let live = true;
    queueMicrotask(() => {
      if (!live) return;
      try {
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
  const begin = (chosen: CardId[]) => {
    if (!validDeck(chosen)) return;
    void getBattleAudio().unlock();
    const seed = Date.now();
    setMatch({ seed, player: [...chosen], ai: chooseAiDeck(seed) });
    setPage('battle');
  };
  const navigate = (next: LobbyPage) => {
    if (next === 'builder') setBuilderOpened(true);
    setPage(next);
  };
  if (page === 'battle' && match)
    return (
      <Battle
        playerDeck={match.player}
        aiDeck={match.ai}
        seed={match.seed}
        onExit={() => {
          setPage('home');
          setBuilderOpened(false);
        }}
      />
    );
  return (
    <HomeMenu
      page={page === 'battle' ? 'home' : page}
      ready={loaded}
      deckCount={deck.length}
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
