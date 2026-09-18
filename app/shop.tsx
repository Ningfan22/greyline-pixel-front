'use client';
/* oxlint-disable next/no-img-element -- 静态托管下直接使用生成的 WebP 素材。 */
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { Coins, Package, Play, RotateCcw, X } from 'lucide-react';
import { CARDS, type CardId } from '@/game/cards';
import { CardFace } from '@/game/card-art';
import { assetUrl } from '@/game/asset-url';
import TearCanvas from './tear-canvas';
import {
  AD_COOLDOWN_MS,
  AD_REWARD,
  PACK_COST,
  RARITY_LABEL,
  TEN_PACK_COST,
  collectionProgress,
  grantAdReward,
  openPack,
  openTenPacks,
  ownedCount,
  rarityOf,
  type CollectionState,
  type PackDraw,
  type Rarity,
} from '@/game/collection';

const RARITY_COLOR: Record<Rarity, string> = {
  common: '#8b9578',
  rare: '#c0c8d0',
  epic: '#e8c25a',
  legendary: '#b06fd0',
};

const AD_COOLDOWN_STORAGE = 'greyline-ad-cooldown';

type Phase = 'idle' | 'tearing' | 'fanned';

interface RevealResult {
  draws: PackDraw[];
  ten: boolean;
  goldGained: number;
  pity: boolean;
}

function readAdCooldown(): number {
  try {
    return Number(localStorage.getItem(AD_COOLDOWN_STORAGE) ?? 0) || 0;
  } catch {
    return 0;
  }
}

export default function Shop({
  collection,
  onChange,
}: {
  collection: CollectionState;
  onChange: (state: CollectionState) => void;
}) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [result, setResult] = useState<RevealResult | null>(null);
  const [prevOwned, setPrevOwned] = useState<
    Partial<Record<CardId, number>>
  >({});
  const [flipped, setFlipped] = useState<boolean[]>([]);
  const [message, setMessage] = useState('');
  const [adReadyAt, setAdReadyAt] = useState(readAdCooldown);
  const [, forceTick] = useState(0);
  const flipTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    return () => {
      for (const timer of flipTimers.current) clearTimeout(timer);
      flipTimers.current = [];
    };
  }, []);

  useEffect(() => {
    if (!adReadyAt) return;
    const timer = setInterval(() => {
      if (Date.now() >= adReadyAt) {
        setAdReadyAt(0);
        try {
          localStorage.removeItem(AD_COOLDOWN_STORAGE);
        } catch {
          /* 忽略 */
        }
      }
      forceTick((n) => n + 1);
    }, 250);
    return () => clearInterval(timer);
  }, [adReadyAt]);

  const progress = useMemo(() => collectionProgress(collection), [collection]);
  const ownedCards = useMemo(
    () =>
      (Object.keys(CARDS) as CardId[])
        .filter((id) => ownedCount(collection, id) > 0)
        .sort(
          (a, b) =>
            CARDS[a].cost - CARDS[b].cost ||
            CARDS[a].name.localeCompare(CARDS[b].name, 'zh-CN'),
        ),
    [collection],
  );

  const startReveal = (ten: boolean) => {
    const cost = ten ? TEN_PACK_COST : PACK_COST;
    if (collection.gold < cost) {
      setMessage(`金币不足：${ten ? '十连' : '一包'}需要 ${cost} 金币`);
      return;
    }
    const r = ten ? openTenPacks(collection) : openPack(collection);
    setPrevOwned(collection.owned);
    onChange(r.state);
    setResult({
      draws: r.drawn,
      ten,
      goldGained: r.goldGained,
      pity: r.pity,
    });
    setFlipped(r.drawn.map(() => false));
    setMessage('');
    setPhase('tearing');
  };

  const watchAd = () => {
    if (adReadyAt && Date.now() < adReadyAt) return;
    const next = grantAdReward(collection);
    onChange(next);
    const ready = Date.now() + AD_COOLDOWN_MS;
    setAdReadyAt(ready);
    try {
      localStorage.setItem(AD_COOLDOWN_STORAGE, String(ready));
    } catch {
      /* 忽略 */
    }
    setMessage(`广告播放完毕，获得 ${AD_REWARD} 金币（模拟）`);
  };

  const flipOne = (i: number) => {
    setFlipped((prev) => {
      if (prev[i]) return prev;
      const next = [...prev];
      next[i] = true;
      return next;
    });
  };

  const flipAll = () => {
    if (!result) return;
    for (const timer of flipTimers.current) clearTimeout(timer);
    flipTimers.current = [];
    let delay = 0;
    result.draws.forEach((_, i) => {
      if (!flipped[i]) {
        const idx = i;
        flipTimers.current.push(setTimeout(() => flipOne(idx), delay));
        delay += result.ten ? 28 : 120;
      }
    });
  };

  const resetCounter = () => {
    setPhase('idle');
    setResult(null);
    setFlipped([]);
  };

  const allFlipped = result !== null && flipped.every(Boolean);
  const newCardCount =
    result?.draws.filter(
      (d) => !d.converted && (prevOwned[d.id] ?? 0) === 0,
    ).length ?? 0;

  const adSecondsLeft = adReadyAt
    ? Math.max(0, Math.ceil((adReadyAt - Date.now()) / 1000))
    : 0;

  return (
    <div className="shop">
      <header className="shop-header">
        <div>
          <span>SUPPLY DROP / 军需补给</span>
          <h2>军需商店</h2>
        </div>
        <div className="shop-gold" aria-label="当前金币">
          <Coins size={18} />
          <b>{collection.gold}</b>
        </div>
      </header>

      {phase === 'idle' ? (
        <section className="shop-counter">
          <figure className="shop-pack">
            <img
              src={assetUrl('/art/card-pack-v1.webp')}
              alt="前线卡包"
              width={384}
              height={576}
              draggable={false}
            />
            <figcaption>
              <b>前线卡包</b>
              <small>每包 5 张 · 十连必出王牌 · 溢出转金币</small>
            </figcaption>
          </figure>
          <div className="shop-actions">
            <button
              type="button"
              className="primary-button shop-buy"
              disabled={collection.gold < PACK_COST}
              onClick={() => startReveal(false)}
            >
              <Package size={16} /> 开一包 · {PACK_COST} 金币
            </button>
            <button
              type="button"
              className="primary-button shop-buy shop-buy-ten"
              disabled={collection.gold < TEN_PACK_COST}
              onClick={() => startReveal(true)}
            >
              <Package size={16} /> 连开十包 · {TEN_PACK_COST} 金币
            </button>
            <button
              type="button"
              className="secondary-button"
              disabled={adSecondsLeft > 0}
              onClick={watchAd}
            >
              <Play size={15} />
              {adSecondsLeft > 0
                ? `广告冷却 ${adSecondsLeft}s`
                : `看广告领 ${AD_REWARD} 金币（模拟）`}
            </button>
            <p className="shop-rates">
              出率：常规 60% · 精锐 28% · 王牌 10% · 传奇 2%
              <br />
              溢出转化：常规 +5 · 精锐 +10 · 王牌 +20 · 传奇 +50 金币
            </p>
            {message && <p className="shop-message">{message}</p>}
          </div>
        </section>
      ) : phase === 'tearing' ? (
        <section className="shop-reveal" aria-label="开包动画">
          <div className="shop-tear-wrap">
            <TearCanvas onDone={() => setPhase('fanned')} />
          </div>
          <p className="shop-hint">点击跳过动画</p>
        </section>
      ) : (
        result && (
        <section className="shop-reveal" aria-label="开包结果">
          {result.ten ? (
            <div className="shop-ten-wrap" onClick={flipAll}>
              <div className="shop-ten-grid">
                {result.draws.map((d, i) => {
                  const isNew =
                    !d.converted && (prevOwned[d.id] ?? 0) === 0;
                  return (
                    <button
                      type="button"
                      key={`${d.id}-${i}`}
                      className={`shop-flip shop-ten-card ${flipped[i] ? 'open' : ''} rarity-${d.rarity}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        flipOne(i);
                      }}
                      aria-label={
                        flipped[i]
                          ? `${CARDS[d.id].name}，${RARITY_LABEL[d.rarity]}`
                          : '未翻开的卡'
                      }
                    >
                      <span className="shop-flip-inner">
                        <img
                          className="shop-flip-back"
                          src={assetUrl('/art/card-back-v1.webp')}
                          alt=""
                          width={200}
                          height={300}
                          draggable={false}
                        />
                        <span className="shop-flip-front">
                          <CardFace id={d.id} className="shop-card-face" />
                          <span
                            className="shop-card-rarity"
                            style={{ color: RARITY_COLOR[d.rarity] }}
                          >
                            {RARITY_LABEL[d.rarity]}
                            {isNew ? ' · 新卡' : ''}
                            {d.converted
                              ? ` · 转化 +${d.gold}金`
                              : ''}
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="shop-fan" onClick={flipAll}>
              {result.draws.map((d, i) => {
                const isNew =
                  !d.converted && (prevOwned[d.id] ?? 0) === 0;
                const style = {
                  '--fan-x': `${(i - 2) * 62}px`,
                  '--fan-r': `${(i - 2) * 11}deg`,
                  '--fan-y': `${Math.abs(i - 2) * 12}px`,
                  zIndex: 10 - Math.abs(i - 2),
                } as CSSProperties;
                return (
                  <button
                    type="button"
                    key={`${d.id}-${i}`}
                    style={style}
                    className={`shop-flip shop-fan-card ${flipped[i] ? 'open' : ''} rarity-${d.rarity}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      flipOne(i);
                    }}
                    aria-label={
                      flipped[i]
                        ? `${CARDS[d.id].name}，${RARITY_LABEL[d.rarity]}`
                        : '未翻开的卡'
                    }
                  >
                    <span className="shop-flip-inner">
                      <img
                        className="shop-flip-back"
                        src={assetUrl('/art/card-back-v1.webp')}
                        alt=""
                        width={200}
                        height={300}
                        draggable={false}
                      />
                      <span className="shop-flip-front">
                        <CardFace id={d.id} className="shop-card-face" />
                        <span
                          className="shop-card-rarity"
                          style={{ color: RARITY_COLOR[d.rarity] }}
                        >
                          {RARITY_LABEL[d.rarity]}
                          {isNew ? ' · 新卡' : ''}
                          {d.converted ? ` · 转化 +${d.gold}金` : ''}
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}
          <div className="shop-reveal-summary">
            <span>
              新卡 <b>{newCardCount}</b> 张
            </span>
            {result.goldGained > 0 && (
              <span className="shop-conversion">
                溢出转化 <b>+{result.goldGained}</b> 金币
              </span>
            )}
            {result.pity && <span className="shop-pity">保底王牌已触发</span>}
          </div>
          <div className="shop-reveal-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={!allFlipped}
              onClick={resetCounter}
            >
              <X size={15} /> 收下
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={collection.gold < PACK_COST}
              onClick={() => startReveal(false)}
            >
              <RotateCcw size={15} /> 再开一包
            </button>
            <button
              type="button"
              className="primary-button shop-buy-ten"
              disabled={collection.gold < TEN_PACK_COST}
              onClick={() => startReveal(true)}
            >
              <RotateCcw size={15} /> 再开十包
            </button>
          </div>
          {!allFlipped && <p className="shop-hint">点击卡片翻一张 · 点击桌面全翻</p>}
        </section>
        )
      )}

      <section className="shop-progress">
        <span>
          已收集 <b>{progress.species}</b> / {progress.total} 种
        </span>
        <span>
          共 <b>{progress.copies}</b> 张
        </span>
        <span>
          已开 <b>{collection.packsOpened}</b> 包
        </span>
      </section>

      <section className="shop-collection">
        <h3>我的卡牌</h3>
        <div className="shop-collection-grid">
          {ownedCards.map((id) => (
            <div
              key={id}
              className={`shop-owned-card rarity-${rarityOf(id)}`}
              title={`${CARDS[id].name} ×${ownedCount(collection, id)}`}
            >
              <CardFace id={id} className="shop-owned-face" />
              <span className="shop-owned-count">
                ×{ownedCount(collection, id)}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
