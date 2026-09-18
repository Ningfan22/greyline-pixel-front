'use client';
/* oxlint-disable next/no-img-element -- 静态托管下直接使用生成的 WebP 素材。 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Coins, Package, Play, RotateCcw, X } from 'lucide-react';
import { CARDS, type CardId } from '@/game/cards';
import { CardFace } from '@/game/card-art';
import { assetUrl } from '@/game/asset-url';
import {
  AD_COOLDOWN_MS,
  AD_REWARD,
  PACK_COST,
  RARITY_LABEL,
  collectionProgress,
  grantAdReward,
  openPack,
  ownedCount,
  rarityOf,
  type CollectionState,
  type Rarity,
} from '@/game/collection';

const RARITY_COLOR: Record<Rarity, string> = {
  common: '#8b9578',
  rare: '#5b8dd9',
  epic: '#a06fd0',
  legendary: '#e0a93f',
};

const AD_COOLDOWN_STORAGE = 'greyline-ad-cooldown';

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
  const [drawn, setDrawn] = useState<CardId[] | null>(null);
  const [prevOwned, setPrevOwned] = useState<
    Partial<Record<CardId, number>>
  >({});
  const [revealed, setRevealed] = useState(0);
  const [message, setMessage] = useState('');
  const [adReadyAt, setAdReadyAt] = useState(readAdCooldown);
  const [, forceTick] = useState(0);
  const revealTimers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (!drawn) return;
    revealTimers.current = drawn.map((_, i) =>
      setTimeout(() => setRevealed((n) => Math.max(n, i + 1)), 350 * (i + 1)),
    );
    return () => {
      for (const timer of revealTimers.current) clearTimeout(timer);
      revealTimers.current = [];
    };
  }, [drawn]);

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

  const buyPack = () => {
    if (collection.gold < PACK_COST) {
      setMessage(`金币不足：一包需要 ${PACK_COST} 金币`);
      return;
    }
    const { state, drawn: cards } = openPack(collection);
    setPrevOwned(collection.owned);
    onChange(state);
    setDrawn(cards);
    setRevealed(0);
    setMessage('');
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

      {!drawn ? (
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
              <small>每包 5 张 · 可重复 · 按稀有度加权</small>
            </figcaption>
          </figure>
          <div className="shop-actions">
            <button
              type="button"
              className="primary-button shop-buy"
              disabled={collection.gold < PACK_COST}
              onClick={buyPack}
            >
              <Package size={16} /> 开一包 · {PACK_COST} 金币
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
            </p>
            {message && <p className="shop-message">{message}</p>}
          </div>
        </section>
      ) : (
        <section className="shop-reveal" aria-label="开包结果">
          <div className="shop-cards">
            {drawn.map((id, i) => {
              const rarity = rarityOf(id);
              const isOpen = i < revealed;
              const isNew = (prevOwned[id] ?? 0) === 0;
              return (
                <button
                  type="button"
                  key={`${id}-${i}`}
                  className={`shop-flip ${isOpen ? 'open' : ''} rarity-${rarity}`}
                  onClick={() => setRevealed((n) => Math.max(n, i + 1))}
                  aria-label={isOpen ? `${CARDS[id].name}，${RARITY_LABEL[rarity]}` : '未翻开的卡'}
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
                      <CardFace id={id} className="shop-card-face" />
                      <span
                        className="shop-card-rarity"
                        style={{ color: RARITY_COLOR[rarity] }}
                      >
                        {RARITY_LABEL[rarity]}
                        {isNew ? ' · 新卡' : ''}
                      </span>
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="shop-reveal-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={revealed < drawn.length}
              onClick={() => {
                setDrawn(null);
                setRevealed(0);
              }}
            >
              <X size={15} /> 收下
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={collection.gold < PACK_COST}
              onClick={buyPack}
            >
              <RotateCcw size={15} /> 再开一包
            </button>
          </div>
          {revealed < drawn.length && (
            <p className="shop-hint">点击卡面可立即翻开</p>
          )}
        </section>
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
