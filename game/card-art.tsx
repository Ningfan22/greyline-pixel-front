'use client';
/* oxlint-disable next/no-img-element -- Generated WebP cards are already optimized and must work on static hosting. */
import { assetUrl } from './asset-url';
import { CARDS, copyLimit, type CardId } from './cards';
import { CARD_COPY } from './card-copy';

const ADDITIONAL_CARD_ART = new Set([
  'pickup',
  'tow_ifv',
  'mortar_carrier',
  'recovery_vehicle',
  'command_vehicle',
  'mine_clearer',
]);
export function cardPictureUrl(id: CardId) {
  if (
    id === 'field_logistics' ||
    id === 'command_expansion' ||
    id === 'war_bonds'
  )
    return assetUrl(`/art/v21-economy/cards/${id}.webp`);
  if (
    id === 'toxic_cloud' ||
    id === 'smoke_withdrawal' ||
    id === 'reserve_mobilization'
  )
    return assetUrl(`/art/v18-comeback/cards/${id}.webp`);
  if (id === 'fpv_drone' || id === 'air_assault')
    return assetUrl(`/art/v16-air/cards/${id}.webp`);
  if (
    id === 'overdraft' ||
    id === 'signal_jam' ||
    id === 'airborne_insertion' ||
    id === 'forced_march' ||
    id === 'cyber_suppression'
  )
    return assetUrl(`/art/v23-doctrine/cards/${id}.webp`);
  return assetUrl(
    `/art/${ADDITIONAL_CARD_ART.has(id) ? 'cards-v15' : 'cards-v10'}/${id}.webp`,
  );
}

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
            : c.airlift
              ? '1机5人'
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
      <img
        width={1024}
        height={1536}
        className="printed-card-frame"
        src={assetUrl('/art/cards-v10/frame.webp')}
        alt=""
        aria-hidden="true"
        decoding="async"
        draggable={false}
      />
      <img
        width={720}
        height={720}
        className="printed-card-picture"
        src={cardPictureUrl(id)}
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
