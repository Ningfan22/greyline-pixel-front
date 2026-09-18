'use client';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Info,
  Layers3,
  Minus,
  Pencil,
  Plus,
  Search,
  Trash2,
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
import { CARDS, copyLimit, type CardId } from '@/game/cards';
import { DECK_PRESETS } from '@/game/deck-presets';
import { CardFace, cardStats } from '@/game/card-art';
import { CARD_COPY } from '@/game/card-copy';
import {
  clampToCollection,
  deckLimit,
  ownedCount,
  validDeckWithCollection,
  type CollectionState,
} from '@/game/collection';
import { MAX_DECKS, activeDeck, type DeckStore } from '@/game/decks-store';
const pool = Object.values(CARDS).sort(
  (a, b) => a.cost - b.cost || a.name.localeCompare(b.name, 'zh-CN'),
);
export default function DeckBuilder({
  deck,
  onSave,
  onSaveAs,
  onStart,
  onExit,
  collection,
  deckStore,
  onSelectDeck,
  onDeleteDeck,
  onRenameDeck,
}: {
  deck: CardId[];
  onSave: (deck: CardId[]) => string;
  onSaveAs: (deck: CardId[], name?: string) => boolean;
  onStart: (deck: CardId[]) => void;
  onExit: () => void;
  collection: CollectionState | null;
  deckStore: DeckStore | null;
  onSelectDeck: (id: string) => void;
  onDeleteDeck: (id: string) => void;
  onRenameDeck: (name: string) => void;
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
  const [renaming, setRenaming] = useState(false),
    [renameValue, setRenameValue] = useState(''),
    [confirmDelete, setConfirmDelete] = useState(false);
  const confirmTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeId = deckStore?.activeId ?? '';
  useEffect(() => {
    setDraft([...deck]);
    setHistory([]);
    setPending(null);
    setConfirmDelete(false);
    setRenaming(false);
    if (confirmTimer.current !== null) {
      clearTimeout(confirmTimer.current);
      confirmTimer.current = null;
    }
    // 切换卡组时重置编辑区；message 故意保留，让保存反馈不被吞掉。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);
  useEffect(
    () => () => {
      if (confirmTimer.current !== null) clearTimeout(confirmTimer.current);
    },
    [],
  );
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const press = useRef<{
    id: CardId;
    pointer: number;
    x: number;
    y: number;
    active: boolean;
    consumed: boolean;
  } | null>(null);
  const clearPressTimer = () => {
    if (pressTimer.current !== null) clearTimeout(pressTimer.current);
    pressTimer.current = null;
  };
  const cancelPress = () => {
    clearPressTimer();
    if (press.current?.active) {
      press.current.active = false;
      press.current.consumed = true;
    }
  };
  const controlPress = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    cancelPress();
  };
  useEffect(
    () => () => {
      if (pressTimer.current !== null) clearTimeout(pressTimer.current);
    },
    [],
  );
  const dirty = [...deck].sort().join('|') !== [...draft].sort().join('|');
  const countOf = (id: CardId) => draft.filter((v) => v === id).length;
  const limitOf = (id: CardId) =>
    collection ? deckLimit(collection, id) : copyLimit(id);
  const ownedOf = (id: CardId) =>
    collection ? ownedCount(collection, id) : copyLimit(id);
  const isValidDeck = (value: CardId[]) =>
    collection
      ? validDeckWithCollection(value, collection)
      : value.length === 20;
  const ordered = [...new Set(draft)].sort(
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
    if (collection && ownedCount(collection, id) === 0) {
      setMessage(`「${CARDS[id].name}」未拥有，去商店开卡包解锁`);
      return;
    }
    if (countOf(id) >= limitOf(id)) {
      setMessage(
        `${CARDS[id].name}最多编入 ${limitOf(id)} 张（已拥有 ${ownedOf(id)}）`,
      );
      return;
    }
    if (draft.length < 20) {
      apply([...draft, id], `已增加一张${CARDS[id].name}`);
      return;
    }
    setPending(id);
    setMessage(`选择一张旧卡，替换为「${CARDS[id].name}」`);
    if (window.matchMedia('(max-width:900px)').matches) setDrawer(true);
  };
  const remove = (id: CardId) => {
    const index = draft.indexOf(id);
    if (index < 0) return;
    const next = [...draft];
    next.splice(index, 1);
    apply(next, `已减少一张${CARDS[id].name}`);
  };
  const changeSlot = (id: CardId) => {
    const index = draft.indexOf(id);
    if (index < 0) return;
    const next = [...draft];
    if (pending) {
      if (pending === id) {
        setPending(null);
        return;
      }
      if (countOf(pending) >= limitOf(pending)) return;
      next[index] = pending;
      apply(next, `已用一张${CARDS[pending].name}替换${CARDS[id].name}`);
      setDrawer(false);
    } else {
      next.splice(index, 1);
      apply(next, `已减少一张${CARDS[id].name}`);
    }
  };
  const save = () => {
    if (isValidDeck(draft)) setMessage(onSave([...draft]));
  };
  const start = () => {
    if (isValidDeck(draft)) {
      onSave([...draft]);
      onStart([...draft]);
    }
  };
  const switchDeck = (id: string) => {
    if (!deckStore || id === activeId) return;
    if (
      dirty &&
      !window.confirm('当前卡组有未保存的修改，切换将丢失。确定切换吗？')
    )
      return;
    onSelectDeck(id);
  };
  const saveAsNew = () => {
    if (!deckStore) return;
    if (deckStore.decks.length >= MAX_DECKS) {
      setMessage('卡组槽已满（最多 6 套）');
      return;
    }
    if (!isValidDeck(draft)) {
      setMessage('编队满 20 张才能另存为新卡组');
      return;
    }
    if (onSaveAs([...draft])) setMessage('已另存为新卡组');
    else setMessage('另存失败：卡组槽已满或编队无效');
  };
  const confirmDeleteDeck = () => {
    if (!deckStore) return;
    if (deckStore.decks.length <= 1) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      if (confirmTimer.current !== null) clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmDelete(false), 3000);
      return;
    }
    if (confirmTimer.current !== null) {
      clearTimeout(confirmTimer.current);
      confirmTimer.current = null;
    }
    onDeleteDeck(activeId);
    setConfirmDelete(false);
    setMessage('当前卡组已删除');
  };
  const commitRename = () => {
    const name = renameValue.trim();
    if (name) onRenameDeck(name.slice(0, 12));
    setRenaming(false);
    setMessage('卡组已重命名');
  };
  const visible = pool.filter(
    (c) =>
      (type === 'all' ||
        (type === 'infantry' && c.members) ||
        (type === 'artillery' && c.emplacement) ||
        (type === 'armor' && (c.armored || c.vehicle)) ||
        (type === 'air' && c.air) ||
        (type === 'skill' && c.type === 'skill')) &&
      (cost === 'all' || cost === '6'
        ? cost === 'all' || c.cost >= 6
        : c.cost === Number(cost)) &&
      (owned === 'all' ||
        (owned === 'selected' && draft.includes(c.id)) ||
        (owned === 'available' && countOf(c.id) < limitOf(c.id))) &&
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
              {CARDS[id].name} ×{countOf(id)}
              <small>
                已拥有 {ownedOf(id)} · 上限 {limitOf(id)} ·
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
        <select
          aria-label="推荐编队"
          value=""
          onChange={(event) => {
            const preset = DECK_PRESETS.find(
              (p) => p.id === event.target.value,
            );
            if (preset) {
              const cards = collection
                ? clampToCollection([...preset.cards], collection)
                : [...preset.cards];
              const missing = preset.cards.length - cards.length;
              apply(
                cards,
                missing
                  ? `${preset.name}：${preset.plan}（${missing} 张未拥有已跳过）`
                  : `${preset.name}：${preset.plan}`,
              );
            }
          }}
        >
          <option value="" disabled>
            推荐编队
          </option>
          {DECK_PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <button onClick={() => apply([], '编队已清空，可撤销')}>清空</button>
      </div>
      <output className="armory-status">
        {message ||
          (dirty ? '有未保存的修改' : '卡面加减调整数量，长按查看详情')}
      </output>
      <div className="armory-save">
        <button
          className="secondary-button"
          disabled={!isValidDeck(draft)}
          onClick={save}
        >
          {dirty ? '保存修改' : '保存卡组'}
        </button>
        <button
          className="primary-button"
          disabled={!isValidDeck(draft)}
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
          卡面加减调整数量，长按查看详情
          <br />
          <b>满 20 张后，点新卡再选旧卡替换</b>
        </p>
      </div>
      {deckStore && collection && (
        <div className="armory-decks">
          <select
            aria-label="切换卡组"
            value={activeId}
            onChange={(event) => switchDeck(event.target.value)}
          >
            {deckStore.decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} · {d.cards.length}/20
              </option>
            ))}
          </select>
          {renaming ? (
            <span className="deck-rename">
              <input
                autoFocus
                value={renameValue}
                maxLength={12}
                onChange={(event) => setRenameValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') commitRename();
                  if (event.key === 'Escape') setRenaming(false);
                }}
                aria-label="卡组新名称"
              />
              <button
                type="button"
                aria-label="确认重命名"
                onClick={commitRename}
              >
                <Check size={14} />
              </button>
              <button
                type="button"
                aria-label="取消重命名"
                onClick={() => setRenaming(false)}
              >
                <X size={14} />
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => {
                setRenameValue(activeDeck(deckStore).name);
                setRenaming(true);
              }}
            >
              <Pencil size={13} /> 重命名
            </button>
          )}
          <button
            type="button"
            disabled={
              deckStore.decks.length >= MAX_DECKS || !isValidDeck(draft)
            }
            onClick={saveAsNew}
          >
            另存为新卡组
          </button>
          <button
            type="button"
            className={confirmDelete ? 'danger-confirm' : ''}
            disabled={deckStore.decks.length <= 1}
            onClick={confirmDeleteDeck}
          >
            <Trash2 size={13} /> {confirmDelete ? '再点一次确认删除' : '删除本卡组'}
          </button>
        </div>
      )}
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
                ['armor', '载具'],
                ['artillery', '火炮'],
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
            <span>
              {visible.length} / {pool.length} 张 · 按费用排列
            </span>
            <RadioGroup
              value={owned}
              onValueChange={(v) => setOwned(String(v))}
              className="ownership-filter"
              aria-label="编入状态"
            >
              {[
                ['all', '全部'],
                ['available', '可增加'],
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
              const locked =
                !!collection && ownedCount(collection, c.id) === 0;
              return (
                <article
                  key={c.id}
                  className={`armory-card ${c.type} ${picked ? 'picked' : ''} ${pending === c.id ? 'pending' : ''} ${locked ? 'locked' : ''}`}
                >
                  <button
                    className="armory-card-select"
                    onPointerDown={(event) => {
                      if (!event.isPrimary || event.button !== 0) return;
                      clearPressTimer();
                      press.current = {
                        id: c.id,
                        pointer: event.pointerId,
                        x: event.clientX,
                        y: event.clientY,
                        active: true,
                        consumed: false,
                      };
                      pressTimer.current = setTimeout(() => {
                        pressTimer.current = null;
                        if (
                          press.current?.active &&
                          press.current.id === c.id
                        ) {
                          press.current.consumed = true;
                          setDetail(c.id);
                        }
                      }, 450);
                    }}
                    onPointerMove={(event) => {
                      const current = press.current;
                      if (
                        current?.pointer === event.pointerId &&
                        Math.hypot(
                          event.clientX - current.x,
                          event.clientY - current.y,
                        ) > 10
                      )
                        cancelPress();
                    }}
                    onPointerUp={() => {
                      clearPressTimer();
                      if (press.current) press.current.active = false;
                    }}
                    onPointerCancel={cancelPress}
                    onLostPointerCapture={cancelPress}
                    onPointerLeave={cancelPress}
                    onContextMenu={(event) => event.preventDefault()}
                    onDragStart={(event) => event.preventDefault()}
                    onClick={(event) => {
                      event.stopPropagation();
                      const consumed =
                        press.current?.id === c.id && press.current.consumed;
                      press.current = null;
                      if (event.detail > 0 && consumed) return;
                      pick(c.id);
                    }}
                    aria-pressed={picked}
                    aria-label={`${draft.length === 20 ? '替换为' : '增加一张'}${c.name}，${c.cost} 点，${c.description}`}
                  >
                    <CardFace id={c.id} />
                    {locked && (
                      <span className="armory-card-lock">抽卡解锁</span>
                    )}
                  </button>
                  <div className="armory-card-controls">
                    <button
                      type="button"
                      disabled={countOf(c.id) === 0}
                      onPointerDown={controlPress}
                      onClick={(event) => {
                        event.stopPropagation();
                        remove(c.id);
                      }}
                      aria-label={`减少一张${c.name}`}
                    >
                      <Minus size={16} />
                    </button>
                    <span
                      className="armory-card-count"
                      aria-label={`${c.name}已编入${countOf(c.id)}张，上限${limitOf(c.id)}张`}
                    >
                      <b>{countOf(c.id)}</b> / {limitOf(c.id)}
                    </span>
                    <button
                      type="button"
                      disabled={
                        draft.length >= 20 ||
                        countOf(c.id) >= limitOf(c.id) ||
                        ownedOf(c.id) === 0
                      }
                      onPointerDown={controlPress}
                      onClick={(event) => {
                        event.stopPropagation();
                        if (draft.length < 20) pick(c.id);
                      }}
                      aria-label={`增加一张${c.name}`}
                    >
                      <Plus size={16} />
                    </button>
                    <button
                      type="button"
                      className="armory-card-info"
                      onPointerDown={controlPress}
                      onClick={(event) => {
                        event.stopPropagation();
                        setDetail(c.id);
                      }}
                      aria-label={`查看${c.name}详情`}
                    >
                      <Info size={15} />
                    </button>
                  </div>
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
          <Layers3 size={16} />
          <span>
            <span className="mobile-deck-label">我的编队</span>{' '}
            <b>{draft.length}/20</b>
          </span>
        </button>
        <output className="mobile-deck-status" aria-live="polite">
          {pending
            ? '选择要替换的卡'
            : message || (dirty ? '有未保存的修改' : '')}
        </output>
        <button
          className="secondary-button"
          disabled={!isValidDeck(draft)}
          onClick={save}
        >
          保存
        </button>
        <button
          className="primary-button"
          disabled={!isValidDeck(draft)}
          onClick={start}
        >
          出战 <ArrowRight size={14} />
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
              <CardFace
                id={selectedCard.id}
                className="detail-card-face"
                eager
              />
              <p>{selectedCard.detail}</p>
              <blockquote className="card-flavor-quote">
                {CARD_COPY[selectedCard.id].flavor}
              </blockquote>
              <p>
                已拥有 {ownedOf(selectedCard.id)} · 可编入{' '}
                {limitOf(selectedCard.id)} · 已编入 {countOf(selectedCard.id)} 张
              </p>
              {selectedCard.hp && (
                <div className="detail-stat-row">
                  <span>
                    全组生命 <b>{selectedCard.hp}</b>
                  </span>
                  <span>
                    {cardStats(selectedCard.id)[3][0]}{' '}
                    <b>{cardStats(selectedCard.id)[3][1]}</b>
                  </span>
                  <span>
                    人数 <b>{selectedCard.members ?? 1}</b>
                  </span>
                </div>
              )}
              <button
                className="primary-button"
                disabled={
                  countOf(selectedCard.id) >= limitOf(selectedCard.id) ||
                  ownedOf(selectedCard.id) === 0
                }
                onClick={() => {
                  pick(selectedCard.id);
                  setDetail(null);
                }}
              >
                {ownedOf(selectedCard.id) === 0
                  ? '未拥有 · 去商店开包'
                  : countOf(selectedCard.id) >= limitOf(selectedCard.id)
                  ? '数量已满'
                  : draft.length === 20
                    ? '选择旧卡替换'
                    : '增加一张'}
                <ArrowRight size={16} />
              </button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
