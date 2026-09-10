'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, Layers3, Crosshair } from 'lucide-react';
import {
  CARDS,
  DECK,
  validDeck,
  chooseAiDeck,
  type CardId,
} from '@/game/engine';
import { SpriteArt } from '@/game/card-art';
import Battle from './battle';
import DeckBuilder from './deck-builder';
const STORAGE = 'greyline-deck-v6';
export default function Home() {
  const [page, setPage] = useState<'home' | 'builder' | 'battle'>('home');
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
    const seed = Date.now();
    setMatch({ seed, player: [...chosen], ai: chooseAiDeck(seed) });
    setPage('battle');
  };
  const edit = () => {
    setPage('builder');
  };
  if (page === 'battle' && match)
    return (
      <Battle
        playerDeck={match.player}
        aiDeck={match.ai}
        seed={match.seed}
        onExit={() => setPage('home')}
      />
    );
  return (
    <main className="operations-shell">
      <header className="ops-header">
        <button className="ops-brand" onClick={() => setPage('home')}>
          灰线 <span>GREYLINE</span>
        </button>
        <span>战术卡牌 / 林间前线</span>
        <b>
          <i /> 指挥中心
        </b>
      </header>
      {page === 'home' ? (
        <>
          <section className="ops-hero">
            <div className="ops-hero-art" aria-hidden="true" />
            <div className="ops-hero-copy">
              <span className="ops-kicker">OPERATION 01 / FOREST FRONT</span>
              <h1>
                每一张牌，
                <br />
                都是一支力量。
              </h1>
              <p>
                组建你的战斗序列，穿过被炮火撕开的林地。
                <br />
                让步兵寻找掩体，让装甲打开前路。
              </p>
              <div className="ops-actions">
                <button
                  className="primary-button"
                  disabled={!loaded}
                  onClick={() => begin(deck)}
                >
                  开始作战 <ArrowRight size={18} />
                </button>
                <button className="secondary-button" onClick={edit}>
                  <Layers3 size={17} /> 调整卡组
                </button>
              </div>
              <div className="ops-brief">
                <span>01 / 自由组牌</span>
                <span>02 / 独立抽取</span>
                <span>03 / 即时交战</span>
              </div>
            </div>
            <div className="ops-coordinate">
              38°40′ N / 21°06′ E<br />
              SECTOR G — 林间战区
            </div>
          </section>
          <section className="ops-bottom">
            <div className="ops-current">
              <div className="ops-section-heading">
                <div>
                  <span className="ops-kicker">YOUR BATTLE GROUP</span>
                  <h2>
                    当前编队 <small>{deck.length} / 20</small>
                  </h2>
                </div>
                <button onClick={edit}>
                  检阅编队 <ArrowRight size={16} />
                </button>
              </div>
              <div className="ops-roster-preview">
                {[...new Set(deck)]
                  .filter((id) => CARDS[id].type === 'unit')
                  .slice(0, 5)
                  .map((id) => (
                    <div key={id}>
                      <SpriteArt id={id} />
                      <b>
                        {CARDS[id].name} ×{deck.filter((v) => v === id).length}
                      </b>
                      <small>{CARDS[id].cost} 指挥点</small>
                    </div>
                  ))}
              </div>
              <p>
                从 {Object.keys(CARDS).length} 种卡牌中选 20
                张，各卡有数量上限。用过的牌在牌库抽空后重新洗入。
              </p>
            </div>
            <aside className="ops-briefing">
              <Crosshair size={24} />
              <span className="ops-kicker">MISSION BRIEFING</span>
              <h2>一条战线，四分钟。</h2>
              <p>摧毁敌方指挥部，或在倒计时结束时保有更多基地生命。</p>
              <div>
                <b>6</b>
                <span>随机起手</span>
                <b>2 点</b>
                <span>主动抽牌</span>
                <b>AI</b>
                <span>独立编队</span>
              </div>
            </aside>
          </section>
        </>
      ) : (
        <DeckBuilder
          deck={deck}
          onSave={save}
          onStart={begin}
          onExit={() => setPage('home')}
        />
      )}
      <footer className="ops-footer">
        <span>GREYLINE / 战术演习 0.9</span>
        <span>可破坏地形 · 独立士兵动作 · 手机触控</span>
      </footer>
    </main>
  );
}
