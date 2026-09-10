'use client';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Info,
  Layers3,
  Plus,
  Search,
  Undo2,
  X,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { CARDS, DECK, validDeck, type CardId } from '@/game/cards';
import { SpriteArt } from '@/game/card-art';
const pool = Object.values(CARDS).sort(
  (a, b) => a.cost - b.cost || a.name.localeCompare(b.name, 'zh-CN'),
);
export default function DeckBuilder({
  deck,
  onSave,
  onStart,
  onExit,
}: {
  deck: CardId[];
  onSave: (deck: CardId[]) => string;
  onStart: (deck: CardId[]) => void;
  onExit: () => void;
}) {
  const [draft, setDraft] = useState<CardId[]>([...deck]);
  const [history, setHistory] = useState<CardId[][]>([]);
  const [type, setType] = useState('all'),
    [cost, setCost] = useState('all'),
    [owned, setOwned] = useState('all'),
    [search, setSearch] = useState('');
  const [pending, setPending] = useState<CardId | null>(null),
    [detail, setDetail] = useState<CardId | null>(null),
    [drawer, setDrawer] = useState(false);
  const [message, setMessage] = useState(''),
    [filtersOpen, setFiltersOpen] = useState(false);
  const dirty = [...deck].sort().join('|') !== [...draft].sort().join('|');
  const ordered = [...draft].sort(
    (a, b) =>
      CARDS[a].cost - CARDS[b].cost ||
      CARDS[a].name.localeCompare(CARDS[b].name, 'zh-CN'),
  );
  const costs = Array.from(
    { length: 6 },
    (_, i) =>
      draft.filter((id) =>
        i === 5 ? CARDS[id].cost >= 6 : CARDS[id].cost === i + 1,
      ).length,
  );
  const apply = (next: CardId[], text: string) => {
    setHistory((h) => [...h.slice(-19), [...draft]]);
    setDraft(next);
    setMessage(text);
    setPending(null);
  };
  const pick = (id: CardId) => {
    if (draft.includes(id)) {
      apply(
        draft.filter((v) => v !== id),
        `已移除 ${CARDS[id].name}`,
      );
      return;
    }
    if (draft.length < 20) {
      apply([...draft, id], `已编入 ${CARDS[id].name}`);
      return;
    }
    setPending(id);
    setMessage(`选择编队中的一张卡，替换为「${CARDS[id].name}」`);
    if (window.matchMedia('(max-width:900px)').matches) setDrawer(true);
  };
  const changeSlot = (id: CardId) => {
    if (pending) {
      apply(
        draft.map((v) => (v === id ? pending : v)),
        `已用 ${CARDS[pending].name} 替换 ${CARDS[id].name}`,
      );
      setDrawer(false);
    } else pick(id);
  };
  const save = () => {
    if (validDeck(draft)) setMessage(onSave([...draft]));
  };
  const start = () => {
    if (validDeck(draft)) {
      onSave([...draft]);
      onStart([...draft]);
    }
  };
  const visible = pool.filter(
    (c) =>
      (type === 'all' ||
        (type === 'infantry' && c.members) ||
        (type === 'armor' && c.armored) ||
        (type === 'air' && c.air) ||
        (type === 'skill' && c.type === 'skill')) &&
      (cost === 'all' || cost === '6'
        ? cost === 'all' || c.cost >= 6
        : c.cost === Number(cost)) &&
      (owned === 'all' ||
        (owned === 'selected' && draft.includes(c.id)) ||
        (owned === 'available' && !draft.includes(c.id))) &&
      `${c.name}${c.tag}${c.description}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  const average = (
    draft.reduce((n, id) => n + CARDS[id].cost, 0) / Math.max(1, draft.length)
  ).toFixed(1);
  const deckPane = () => (
    <>
      <div className="armory-deck-heading">
        <div>
          <small>MY BATTLE GROUP</small>
          <h2>我的编队</h2>
        </div>
        <strong>
          {draft.length}
          <small>/ 20</small>
        </strong>
      </div>
      <div className="armory-deck-meta">
        <span>
          部队 {draft.filter((id) => CARDS[id].type === 'unit').length}
        </span>
        <span>
          指令 {draft.filter((id) => CARDS[id].type === 'skill').length}
        </span>
        <span>均费 {average}</span>
      </div>
      <div className="cost-curve" aria-label="编队费用分布">
        {costs.map((n, i) => (
          <div key={i}>
            <b>{n || ''}</b>
            <i
              style={{
                height: `${Math.max(2, (n / Math.max(1, ...costs)) * 30)}px`,
              }}
            />
            <small>{i === 5 ? '6+' : i + 1}</small>
          </div>
        ))}
      </div>
      {pending && (
        <div className="replace-banner">
          <span>
            替换为 <b>{CARDS[pending].name}</b>
            <small>点下方旧卡完成替换</small>
          </span>
          <button
            aria-label="取消替换"
            onClick={() => {
              setPending(null);
              setMessage('已取消替换');
            }}
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div className={`armory-deck-list ${pending ? 'replacing' : ''}`}>
        {ordered.map((id) => (
          <button
            key={id}
            onClick={() => changeSlot(id)}
            aria-label={`${pending ? '替换' : '移除'}${CARDS[id].name}`}
          >
            <b>{CARDS[id].cost}</b>
            <span>
              {CARDS[id].name}
              <small>
                {CARDS[id].members
                  ? `${CARDS[id].members} 人`
                  : CARDS[id].type === 'skill'
                    ? '指令'
                    : '载具'}
              </small>
            </span>
            {pending ? <ArrowLeft size={14} /> : <X size={13} />}
          </button>
        ))}
        {draft.length < 20 && (
          <div className="armory-empty">
            <Plus size={17} /> 还可编入 {20 - draft.length} 张
          </div>
        )}
      </div>
      <div className="armory-deck-tools">
        <button
          onClick={() => {
            if (history.length) {
              setDraft(history.at(-1)!);
              setHistory(history.slice(0, -1));
              setPending(null);
              setMessage('已撤销上一步');
            }
          }}
          disabled={!history.length}
        >
          <Undo2 size={13} /> 撤销
        </button>
        <button onClick={() => apply([...DECK], '已载入推荐编队')}>推荐</button>
        <button onClick={() => apply([], '编队已清空，可撤销')}>清空</button>
      </div>
      <output className="armory-status">
        {message ||
          (dirty ? '有未保存的修改' : '每种卡限一张，满编后可直接替换')}
      </output>
      <div className="armory-save">
        <button
          className="secondary-button"
          disabled={!validDeck(draft)}
          onClick={save}
        >
          {dirty ? '保存修改' : '保存卡组'}
        </button>
        <button
          className="primary-button"
          disabled={!validDeck(draft)}
          onClick={start}
        >
          出战 <ArrowRight size={16} />
        </button>
      </div>
    </>
  );
  const selectedCard = detail ? CARDS[detail] : null;
  return (
    <div className="armory">
      <div className="armory-title">
        <button className="back-link" onClick={onExit}>
          <ArrowLeft size={15} /> 返回首页
        </button>
        <div>
          <span>ARMORY / 战斗序列</span>
          <h1>编组室</h1>
        </div>
        <p>
          点击卡牌加入或移除
          <br />
          <b>满 20 张后，点新卡再选旧卡替换</b>
        </p>
      </div>
      <div className="armory-layout">
        <section className="armory-collection">
          <div className="armory-topbar">
            <RadioGroup
              value={type}
              onValueChange={(v) => setType(String(v))}
              className="armory-tabs"
              aria-label="兵种分类"
            >
              {[
                ['all', '全部'],
                ['infantry', '步兵'],
                ['armor', '装甲'],
                ['air', '航空'],
                ['skill', '指令'],
              ].map(([v, label]) => (
                <label key={v} className={type === v ? 'active' : ''}>
                  <RadioGroupItem value={v} />
                  {label}
                </label>
              ))}
            </RadioGroup>
            <button
              className="mobile-filter-toggle"
              onClick={() => setFiltersOpen(!filtersOpen)}
            >
              费用 / 筛选
            </button>
          </div>
          <div className={`armory-filters ${filtersOpen ? 'expanded' : ''}`}>
            <div className="armory-search">
              <Search size={15} />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="搜索卡牌或特点"
                aria-label="搜索卡牌"
              />
            </div>
            <RadioGroup
              value={cost}
              onValueChange={(v) => setCost(String(v))}
              className="cost-filter"
              aria-label="指挥点费用"
            >
              {['all', '1', '2', '3', '4', '5', '6'].map((v) => (
                <label key={v} className={cost === v ? 'active' : ''}>
                  <RadioGroupItem value={v} />
                  {v === 'all' ? '任意' : v === '6' ? '6+' : v}
                </label>
              ))}
            </RadioGroup>
          </div>
          <div className="armory-results">
            <span>{visible.length} / 40 张 · 按费用排列</span>
            <RadioGroup
              value={owned}
              onValueChange={(v) => setOwned(String(v))}
              className="ownership-filter"
              aria-label="编入状态"
            >
              {[
                ['all', '全部'],
                ['available', '未编入'],
                ['selected', '已编入'],
              ].map(([v, label]) => (
                <label key={v} className={owned === v ? 'active' : ''}>
                  <RadioGroupItem value={v} />
                  {label}
                </label>
              ))}
            </RadioGroup>
          </div>
          <div className="armory-grid">
            {visible.map((c) => {
              const picked = draft.includes(c.id);
              return (
                <article
                  key={c.id}
                  className={`armory-card ${c.type} ${picked ? 'picked' : ''} ${pending === c.id ? 'pending' : ''}`}
                >
                  <button
                    className="armory-card-select"
                    onClick={() => pick(c.id)}
                    aria-pressed={picked}
                    aria-label={`${picked ? '移除' : draft.length === 20 ? '替换为' : '编入'}${c.name}，${c.cost} 点，${c.description}`}
                  >
                    <div className="armory-card-cap">
                      <b>{c.cost}</b>
                      <span>
                        {c.type === 'skill'
                          ? '指令'
                          : c.armored
                            ? '装甲'
                            : c.air
                              ? '航空'
                              : '步兵'}
                      </span>
                      <small>
                        {picked ? (
                          <>
                            <Check size={12} /> 已编入
                          </>
                        ) : pending === c.id ? (
                          '待替换'
                        ) : (
                          '+ 编入'
                        )}
                      </small>
                    </div>
                    <SpriteArt id={c.id} className="armory-card-image" />
                    <h3>{c.name}</h3>
                    <p>{c.description}</p>
                    <div className="armory-card-stats">
                      <span>
                        {c.members
                          ? `${c.members} 人`
                          : c.type === 'skill'
                            ? c.tag.split(' · ')[0]
                            : '1 辆 / 架'}
                      </span>
                      <b>{c.hp ? `${c.hp} 生命` : '战术支援'}</b>
                    </div>
                  </button>
                  <button
                    className="armory-card-info"
                    onClick={() => setDetail(c.id)}
                    aria-label={`查看${c.name}详情`}
                  >
                    <Info size={13} /> 详情
                  </button>
                </article>
              );
            })}
            {!visible.length && (
              <div className="collection-empty">
                没有匹配卡牌。
                <button
                  onClick={() => {
                    setType('all');
                    setCost('all');
                    setOwned('all');
                    setSearch('');
                  }}
                >
                  清除筛选
                </button>
              </div>
            )}
          </div>
        </section>
        <aside className="armory-deck desktop-deck">{deckPane()}</aside>
      </div>
      <div className="mobile-deck-bar">
        <button onClick={() => setDrawer(true)}>
          <Layers3 size={18} />
          <span>
            我的编队 <b>{draft.length}/20</b>
            {pending && <small>选择要替换的卡</small>}
          </span>
        </button>
        <button
          className="primary-button"
          disabled={!validDeck(draft)}
          onClick={start}
        >
          保存并出战 <ArrowRight size={16} />
        </button>
      </div>
      <Dialog open={drawer} onOpenChange={setDrawer}>
        <DialogContent className="armory-drawer">
          <DialogTitle className="sr-only">我的编队</DialogTitle>
          <DialogDescription className="sr-only">
            点击已选卡牌移除，或完成替换。
          </DialogDescription>
          <div className="armory-deck">{deckPane()}</div>
        </DialogContent>
      </Dialog>
      <Dialog
        open={!!detail}
        onOpenChange={(v) => {
          if (!v) setDetail(null);
        }}
      >
        <DialogContent className="card-detail-dialog">
          {selectedCard && (
            <>
              <DialogTitle>
                {selectedCard.name}
                <small>{selectedCard.cost} 指挥点</small>
              </DialogTitle>
              <DialogDescription>{selectedCard.tag}</DialogDescription>
              <SpriteArt id={selectedCard.id} className="detail-portrait" />
              <p>{selectedCard.detail}</p>
              {selectedCard.hp && (
                <div className="detail-stat-row">
                  <span>
                    全组生命 <b>{selectedCard.hp}</b>
                  </span>
                  <span>
                    射程 <b>{selectedCard.range}</b>
                  </span>
                  <span>
                    人数 <b>{selectedCard.members ?? 1}</b>
                  </span>
                </div>
              )}
              <button
                className="primary-button"
                onClick={() => {
                  pick(selectedCard.id);
                  setDetail(null);
                }}
              >
                {draft.includes(selectedCard.id)
                  ? '移出编队'
                  : draft.length === 20
                    ? '选择旧卡替换'
                    : '编入卡组'}
                <ArrowRight size={16} />
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
