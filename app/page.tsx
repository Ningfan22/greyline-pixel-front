'use client';
import { useEffect, useState } from 'react';
import {
  ArrowRight,
  ArrowLeft,
  Plus,
  Search,
  Shield,
  Layers3,
  Check,
  X,
  Crosshair,
} from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  CARDS,
  DECK,
  DECK_SIZE,
  validDeck,
  chooseAiDeck,
  type CardId,
} from '@/game/engine';
import { SpriteArt } from '@/game/card-art';
import Battle from './battle';
const STORAGE = 'greyline-deck-v6';
const allCards = Object.values(CARDS);
export default function Home() {
  const [page, setPage] = useState<'home' | 'builder' | 'battle'>('home');
  const [deck, setDeck] = useState<CardId[]>([...DECK]);
  const [draft, setDraft] = useState<CardId[]>([...DECK]);
  const [loaded, setLoaded] = useState(false);
  const [message, setMessage] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
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
          setDraft([...saved]);
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
  const save = () => {
    if (!validDeck(draft)) return false;
    setDeck([...draft]);
    try {
      localStorage.setItem(STORAGE, JSON.stringify(draft));
      setMessage('编队已保存到当前设备');
    } catch {
      setMessage('本次编队已生效；浏览器未允许本地保存');
    }
    return true;
  };
  const begin = (chosen: CardId[]) => {
    if (!validDeck(chosen)) return;
    const seed = Date.now();
    setMatch({ seed, player: [...chosen], ai: chooseAiDeck(seed) });
    setPage('battle');
  };
  const edit = () => {
    setDraft([...deck]);
    setMessage('');
    setPage('builder');
  };
  const toggle = (id: CardId) => {
    setMessage('');
    setDraft((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length < DECK_SIZE
          ? [...prev, id]
          : prev,
    );
  };
  const visible = allCards.filter(
    (c) =>
      (filter === 'all' ||
        (filter === 'infantry' && !!c.members) ||
        (filter === 'armor' && c.armored) ||
        (filter === 'air' && c.air) ||
        (filter === 'skill' && c.type === 'skill')) &&
      `${c.name}${c.tag}${c.description}`.includes(search.trim()),
  );
  const avg = (
    draft.reduce((a, id) => a + CARDS[id].cost, 0) / Math.max(1, draft.length)
  ).toFixed(1);
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
                {deck
                  .filter((id) => CARDS[id].type === 'unit')
                  .slice(0, 5)
                  .map((id) => (
                    <div key={id}>
                      <SpriteArt id={id} />
                      <b>{CARDS[id].name}</b>
                      <small>{CARDS[id].cost} 指挥点</small>
                    </div>
                  ))}
              </div>
              <p>
                从 40 种卡牌中选 20 种，每种一张。用过的牌在牌库抽空后重新洗入。
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
                <b>9s</b>
                <span>补给抽牌</span>
                <b>AI</b>
                <span>独立编队</span>
              </div>
            </aside>
          </section>
        </>
      ) : (
        <>
          <div className="builder-title">
            <div>
              <button className="back-link" onClick={() => setPage('home')}>
                <ArrowLeft size={15} /> 返回首页
              </button>
              <span className="ops-kicker">BATTLE GROUP / ARMORY</span>
              <h1>组建你的战斗序列</h1>
              <p>
                40 种卡牌，自选 20 种。兵种搭配、火力支援和指挥调度由你决定。
              </p>
            </div>
            <span className="builder-total">
              40 <small>可用卡牌</small>
            </span>
          </div>
          <div className="builder-layout">
            <section className="collection">
              <div className="collection-toolbar">
                <RadioGroup
                  value={filter}
                  onValueChange={(v) => setFilter(String(v))}
                  className="collection-filters"
                  aria-label="卡牌类型"
                >
                  {[
                    ['all', '全部'],
                    ['infantry', '步兵'],
                    ['armor', '装甲'],
                    ['air', '航空'],
                    ['skill', '指令'],
                  ].map(([id, label]) => (
                    <label key={id} className={filter === id ? 'active' : ''}>
                      <RadioGroupItem value={id} />
                      {label}
                    </label>
                  ))}
                </RadioGroup>
                <div className="collection-search">
                  <Search size={16} />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="搜索兵种或特点"
                    aria-label="搜索卡牌"
                  />
                </div>
              </div>
              <div className="collection-grid">
                {visible.map((c) => {
                  const selected = draft.includes(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`collection-card ${selected ? 'picked' : ''} ${c.type}`}
                    >
                      <div className="collection-card-top">
                        <b>
                          {c.cost}
                          <small> 指挥点</small>
                        </b>
                        <Checkbox
                          checked={selected}
                          onCheckedChange={() => toggle(c.id)}
                          disabled={!selected && draft.length === 20}
                          aria-label={`${selected ? '移除' : '加入'}${c.name}`}
                        />
                      </div>
                      <SpriteArt id={c.id} className="collection-art" />
                      <span className="collection-tag">{c.tag}</span>
                      <h3>{c.name}</h3>
                      <p>{c.detail}</p>
                      <div className="collection-stats">
                        {c.members
                          ? `${c.members} 人班组`
                          : c.armored
                            ? '装甲载具'
                            : c.air
                              ? '航空支援'
                              : '战术指令'}
                        <span>
                          {c.range
                            ? `射程 ${c.range}`
                            : selected
                              ? '已编入'
                              : '可选入'}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>
              {visible.length === 0 && (
                <div className="collection-empty">
                  没有匹配的卡牌，请换个关键词。
                </div>
              )}
            </section>
            <aside className="selected-deck">
              <div className="selected-deck-title">
                <Shield size={20} />
                <h2>我的编队</h2>
                <strong className={draft.length === 20 ? 'complete' : ''}>
                  {draft.length}
                  <small> / 20</small>
                </strong>
              </div>
              <div className="deck-composition">
                <span>
                  平均费用 <b>{avg}</b>
                </span>
                <span>
                  部队{' '}
                  <b>
                    {draft.filter((id) => CARDS[id].type === 'unit').length}
                  </b>
                </span>
                <span>
                  指令{' '}
                  <b>
                    {draft.filter((id) => CARDS[id].type === 'skill').length}
                  </b>
                </span>
              </div>
              <div className="selected-deck-list">
                {draft.map((id, i) => (
                  <button
                    key={id}
                    onClick={() => toggle(id)}
                    aria-label={`移除${CARDS[id].name}`}
                  >
                    <small>{String(i + 1).padStart(2, '0')}</small>
                    <span>{CARDS[id].name}</span>
                    <b>{CARDS[id].cost}</b>
                    <X size={13} />
                  </button>
                ))}
                {Array.from({ length: 20 - draft.length }, (_, i) => (
                  <div className="deck-empty-slot" key={i}>
                    <Plus size={12} />
                    <span>待编入</span>
                  </div>
                ))}
              </div>
              <div className="deck-editor-actions">
                <button
                  onClick={() => {
                    setDraft([...DECK]);
                    setMessage('已载入推荐编队，保存后生效');
                  }}
                >
                  推荐编队
                </button>
                <button
                  onClick={() => {
                    setDraft([]);
                    setMessage('');
                  }}
                >
                  清空
                </button>
              </div>
              <output className="deck-save-status">
                {message ||
                  (draft.length === 20
                    ? '编队就绪。双方从各自的 20 张牌库抽牌。'
                    : `还需选择 ${20 - draft.length} 张卡牌`)}
              </output>
              <button
                className="secondary-button"
                disabled={!validDeck(draft)}
                onClick={save}
              >
                <Check size={16} /> 保存卡组
              </button>
              <button
                className="primary-button"
                disabled={!validDeck(draft)}
                onClick={() => {
                  if (save()) begin(draft);
                }}
              >
                保存并出战 <ArrowRight size={17} />
              </button>
            </aside>
          </div>
        </>
      )}
      <footer className="ops-footer">
        <span>GREYLINE / 战术演习 0.6</span>
        <span>可破坏地形 · 独立士兵动作 · 手机触控</span>
      </footer>
    </main>
  );
}
