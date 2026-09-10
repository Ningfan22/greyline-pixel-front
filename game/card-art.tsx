'use client';
import Image from 'next/image';
import { CARDS, copyLimit, type CardId } from './cards';
import { CARD_COPY } from './card-copy';

export function cardStats(id: CardId, cost = CARDS[id].cost) {
  const c = CARDS[id];
  return c.type === 'skill'
    ? [
        ['类型', '指令'],
        ['费用', String(cost)],
        ['携带', `${copyLimit(id)}张`],
        ['目标', c.targetGround ? '落点' : '全局'],
      ]
    : [
        [
          '编制',
          c.members
            ? `${c.members}人`
            : c.emplacement
              ? '1门'
              : c.air
                ? '1架'
                : '1辆',
        ],
        ['生命', String(c.hp ?? '—')],
        ['火力', String(c.damage || '—')],
        [
          c.range ? '射程' : '视野',
          String(c.range || c.sight || (c.observer ? 820 : '—')),
        ],
      ];
}

/** One generated print frame, with live text for balance changes and accessibility. */
export function CardFace({
  id,
  cost,
  className = '',
  eager = false,
}: {
  id: CardId;
  cost?: number;
  className?: string;
  eager?: boolean;
}) {
  const c = CARDS[id],
    copy = CARD_COPY[id],
    value = cost ?? c.cost;
  const stats = cardStats(id, value);
  return (
    <figure
      className={`printed-card ${className}`}
      aria-label={`${c.name}，${value}指挥点。${stats.map(([k, v]) => `${k}${v}`).join('，')}。${copy.ability}：${copy.rule} ${copy.flavor}`}
    >
      <Image
        width={1024}
        height={1536}
        unoptimized
        className="printed-card-frame"
        src="/art/cards-v10/frame.webp"
        alt=""
        aria-hidden="true"
        decoding="async"
        draggable={false}
      />
      <Image
        width={720}
        height={720}
        unoptimized
        className="printed-card-picture"
        src={`/art/cards-v10/${id}.webp`}
        alt=""
        aria-hidden="true"
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
      />
      <span className="printed-card-cost" aria-hidden="true">
        <span>{value}</span>
        <span>指挥</span>
      </span>
      <span className="printed-card-heading" aria-hidden="true">
        <span className="printed-card-name">{c.name}</span>
        <span className="printed-card-english">{copy.en}</span>
      </span>
      <span className="printed-card-type" aria-hidden="true">
        {copy.typeLabel}
      </span>
      <span className="printed-card-stats" aria-hidden="true">
        {stats.map(([label, stat]) => (
          <span key={label}>
            <span>{label}</span>
            <span>{stat}</span>
          </span>
        ))}
      </span>
      <span className="printed-card-ability" aria-hidden="true">
        {copy.ability}
      </span>
      <span className="printed-card-rule" aria-hidden="true">
        {copy.rule}
      </span>
      <span className="printed-card-flavor" aria-hidden="true">
        {copy.flavor}
      </span>
    </figure>
  );
}
