'use client';
/* oxlint-disable next/no-img-element -- Generated WebP cards are already optimized and must work on static hosting. */
import { memo, useState } from 'react';
import { assetUrl } from './asset-url';
import { CARDS, copyLimit, type CardId } from './cards';
import { CARD_COPY } from './card-copy';
import { rarityOf } from './collection';

import { cardPicturePath } from './card-picture-path';
import { CARD_IMAGE_VARIANTS } from './card-image-data';
export const cardPictureUrl = (id: CardId) => assetUrl(cardPicturePath(id));
export function cardImageSources(path: string, detail = false) {
  const entries = (
    CARD_IMAGE_VARIANTS as Record<string, { path: string; width: number }[]>
  )[path];
  const choices=entries?.filter(v=>detail||v.width<=320);
  return choices?.length
    ? {
        src: assetUrl(choices[0].path),
        srcSet: choices
          .map((v) => `${assetUrl(v.path)} ${v.width}w`)
          .join(', '),
      }
    : { src: assetUrl(path) };
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
    : c.type === 'fortification'
      ? [
          ['工期', `${c.buildTime ?? 0}秒`],
          ['生命', String(c.hp ?? '—')],
          ['驻守', c.garrisonCapacity ? `${c.garrisonCapacity}人` : '不可'],
          ['射程', c.range ? String(c.range) : '—'],
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
            c.armorTier ? '护甲' : c.range ? '射程' : '视野',
            c.armorTier
              ? String(c.armorTier)
              : String(c.range || c.sight || (c.observer ? 820 : '—')),
          ],
        ];
}

/** One generated print frame, with live text for balance changes and accessibility. */
export const CardFace = memo(function CardFace({
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
  const [pictureFailed, setPictureFailed] = useState(false);
  const [pictureOriginal,setPictureOriginal]=useState(false);
  const [frameOriginal,setFrameOriginal]=useState(false);
  const [frameFailed,setFrameFailed]=useState(false);
  const rarity = rarityOf(id);
  const detail=className.includes('detail-card');
  const picture = cardImageSources(cardPicturePath(id),detail),
    frame = cardImageSources(
      rarity === 'common'
        ? '/art/cards-v10/frame.webp'
        : `/art/cards-v10/frame-${rarity}.webp`,detail,
    );
  const imageSizes = detail ? '(max-width: 600px) 280px, 360px' : eager
    ? '(max-width: 600px) 100px, 160px'
    : '(max-width: 600px) 160px, 240px';
  const nameLen = c.name.length;
  const enLen = copy.en.length;
  const ruleLen = copy.rule.length;
  const flavorLen = copy.flavor.length;
  return (
    <figure
      className={`printed-card ${frameFailed?"printed-card-fallback":""} ${className}`}
      aria-label={`${c.name}，${value}指挥点。${stats.map(([k, v]) => `${k}${v}`).join('，')}。${copy.ability}：${copy.rule} ${copy.flavor}`}
    >
      <img
        width={1024}
        height={1536}
        className="printed-card-frame"
        src={frameOriginal?assetUrl(rarity==='common'?'/art/cards-v10/frame.webp':`/art/cards-v10/frame-${rarity}.webp`):frame.src}
        srcSet={frameOriginal?undefined:frame.srcSet}
        onError={()=>frameOriginal?setFrameFailed(true):setFrameOriginal(true)}
        style={frameFailed?{visibility:'hidden'}:undefined}
        sizes={imageSizes}
        alt=""
        aria-hidden="true"
        decoding="async"
        loading={eager ? 'eager' : 'lazy'}
        draggable={false}
      />
      <img
        width={720}
        height={720}
        className="printed-card-picture"
        src={pictureOriginal?cardPictureUrl(id):picture.src}
        srcSet={pictureOriginal?undefined:picture.srcSet}
        sizes={imageSizes}
        fetchPriority={eager ? 'high' : 'auto'}
        alt=""
        aria-hidden="true"
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        draggable={false}
        style={pictureFailed ? { visibility: 'hidden' } : undefined}
        onError={() => pictureOriginal?setPictureFailed(true):setPictureOriginal(true)}
      />
      <span className="printed-card-cost" aria-hidden="true">
        <span>{value}</span>
      </span>
      <span className="printed-card-heading" aria-hidden="true">
        <span
          className={`printed-card-name${nameLen >= 7 ? ' long-name' : ''}`}
        >
          {c.name}
        </span>
        <span
          className={`printed-card-english${enLen >= 22 ? ' long-english' : ''}`}
        >
          {copy.en}
        </span>
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
      <span
        className={`printed-card-rule${ruleLen >= 13 ? ' long-rule' : ''}`}
        aria-hidden="true"
      >
        {copy.rule}
      </span>
      <span
        className={`printed-card-flavor${flavorLen >= 13 ? ' long-flavor' : ''}`}
        aria-hidden="true"
      >
        {copy.flavor}
      </span>
    </figure>
  );
});

const warming = new Set<string>();
/** Warm only the selected deck's display-sized art, after the lobby paints. */
export function preloadCardFaces(ids: readonly CardId[]) {
  if (typeof Image === 'undefined') return;
  const paths = [
    ...new Set(ids.map(cardPicturePath)),
    ...['frame', 'frame-rare', 'frame-epic', 'frame-legendary'].map(
      (id) => `/art/cards-v10/${id}.webp`,
    ),
  ];
  const queue=paths.filter(path=>!warming.has(cardImageSources(path).src));
  async function worker(){
    for(let path=queue.shift();path;path=queue.shift()){
      const sources=cardImageSources(path);
      if(warming.has(sources.src))continue;
      warming.add(sources.src);
      await new Promise<void>(resolve=>{
        const image=new Image();image.decoding='async';image.fetchPriority='low';
        image.sizes='(max-width: 600px) 100px, 160px';
        image.onload=()=>resolve();image.onerror=()=>{warming.delete(sources.src);resolve();};
        if(sources.srcSet)image.srcset=sources.srcSet;
        image.src=sources.src;
      });
    }
  }
  void worker();void worker();
}
