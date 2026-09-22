/**
 * Canvas card renderer: draws a full card face (frame + art + text) on Canvas.
 * Replaces the React CardFace component.
 */

import { CARDS, copyLimit, type CardId } from '@/game/cards';
import { CARD_COPY } from '@/game/card-copy';
import { rarityOf } from '@/game/collection';
import { assetUrl } from '@/game/asset-url';

// ── Image cache ──────────────────────────────────────────────────────────────

const imageCache = new Map<string, HTMLImageElement>();
const loadingPromises = new Map<string, Promise<HTMLImageElement>>();

export function loadCardImage(url: string): Promise<HTMLImageElement> {
  const cached = imageCache.get(url);
  if (cached) return Promise.resolve(cached);
  const pending = loadingPromises.get(url);
  if (pending) return pending;

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      imageCache.set(url, img);
      loadingPromises.delete(url);
      resolve(img);
    };
    img.onerror = () => {
      loadingPromises.delete(url);
      reject(new Error(`Failed to load ${url}`));
    };
    img.src = url;
  });
  loadingPromises.set(url, promise);
  return promise;
}

// ── Card picture URL (mirrors card-art.tsx logic) ───────────────────────────

const ADDITIONAL_CARD_ART = new Set([
  'pickup',
  'tow_ifv',
  'mortar_carrier',
  'recovery_vehicle',
  'command_vehicle',
  'mine_clearer',
]);

export function cardPictureUrl(id: CardId): string {
  if (id === 'glider_transport') return cardPictureUrl('glider_assault');
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

export function cardFrameUrl(rarity: string): string {
  return rarity === 'common'
    ? assetUrl('/art/cards-v10/frame.webp')
    : assetUrl(`/art/cards-v10/frame-${rarity}.webp`);
}

// ── Card stats (mirrors card-art.tsx) ────────────────────────────────────────

export function cardStats(id: CardId, cost?: number): [string, string][] {
  const c = CARDS[id];
  const value = cost ?? c.cost;
  return c.type === 'skill'
    ? [
        ['类型', '指令'],
        ['费用', String(value)],
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

// ── Preloaded card art ──────────────────────────────────────────────────────

export interface CardArtBundle {
  frame: HTMLImageElement | null;
  picture: HTMLImageElement | null;
}

const cardArtCache = new Map<CardId, CardArtBundle>();

/** Preload frame + picture for a card. Safe to call multiple times. */
export function preloadCardArt(id: CardId): void {
  if (cardArtCache.has(id)) return;
  const placeholder: CardArtBundle = { frame: null, picture: null };
  cardArtCache.set(id, placeholder);

  const rarity = rarityOf(id);
  loadCardImage(cardFrameUrl(rarity))
    .then((img) => {
      placeholder.frame = img;
    })
    .catch(() => {});
  loadCardImage(cardPictureUrl(id))
    .then((img) => {
      placeholder.picture = img;
    })
    .catch(() => {});
}

/** Preload art for all cards. */
export function preloadAllCardArt(): void {
  for (const id of Object.keys(CARDS) as CardId[]) {
    preloadCardArt(id);
  }
}

// ── Draw card face ──────────────────────────────────────────────────────────

/**
 * Draw a complete card face at (x, y) with the given width.
 * Height is auto-computed as w * 1.5 (2:3 aspect ratio).
 */
export function drawCardFace(
  ctx: CanvasRenderingContext2D,
  id: CardId,
  x: number,
  y: number,
  w: number,
  costOverride?: number,
): void {
  preloadCardArt(id);
  const h = w * 1.5;
  const c = CARDS[id];
  const copy = CARD_COPY[id];
  const value = costOverride ?? c.cost;
  const stats = cardStats(id, value);
  const art = cardArtCache.get(id);

  ctx.save();
  ctx.translate(x, y);

  // Frame background
  if (art?.frame) {
    ctx.drawImage(art.frame, 0, 0, w, h);
  } else {
    // Fallback: draw a simple card frame
    ctx.fillStyle = '#2a332a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#4a5a4a';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);
  }

  // Picture area: left 2.05%, top 10.68%, width 95.9%, height 58%
  const picX = w * 0.0205;
  const picY = h * 0.1068;
  const picW = w * 0.959;
  const picH = h * 0.58;

  ctx.save();
  // Clip to the angled picture shape
  ctx.beginPath();
  ctx.moveTo(picX + picW * 0.18, picY);
  ctx.lineTo(picX + picW, picY);
  ctx.lineTo(picX + picW, picY + picH * 0.96);
  ctx.lineTo(picX + picW * 0.965, picY + picH);
  ctx.lineTo(picX + picW * 0.035, picY + picH);
  ctx.lineTo(picX, picY + picH * 0.96);
  ctx.lineTo(picX, picY + picH * 0.058);
  ctx.lineTo(picX + picW * 0.145, picY + picH * 0.058);
  ctx.lineTo(picX + picW * 0.18, picY + picH * 0.018);
  ctx.closePath();
  ctx.clip();

  if (art?.picture) {
    // Cover fit
    const imgRatio = art.picture.width / art.picture.height;
    const boxRatio = picW / picH;
    let dw = picW;
    let dh = picH;
    let dx = picX;
    let dy = picY;
    if (imgRatio > boxRatio) {
      dw = picH * imgRatio;
      dx = picX - (dw - picW) / 2;
    } else {
      dh = picW / imgRatio;
      dy = picY - (dh - picH) / 2;
    }
    ctx.drawImage(art.picture, dx, dy, dw, dh);
  } else {
    // Placeholder while loading
    ctx.fillStyle = '#3a4a3a';
    ctx.fillRect(picX, picY, picW, picH);
  }
  ctx.restore();

  // All text uses cqw = 1% of card width
  const cqw = w / 100;
  const textColor = '#20221e';
  const headingColor = '#e8e1c8';

  // Cost: left 2.4%, top 2.7%, font 15cqw bold Impact
  ctx.font = `900 ${15 * cqw}px Impact, 'Arial Narrow', sans-serif`;
  ctx.fillStyle = headingColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), w * 0.024 + (w * 0.155) / 2, h * 0.027 + 7.5 * cqw);

  // Name heading: left 23%, top 2.45%, width 73%
  const nameLen = c.name.length;
  const nameSize = nameLen >= 7 ? 6.15 * cqw : 7.15 * cqw;
  ctx.font = `900 ${nameSize}px 'PingFang SC', 'Microsoft YaHei', sans-serif`;
  ctx.fillStyle = headingColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(c.name, w * 0.23, h * 0.0245, w * 0.73);

  // English name
  const enLen = copy.en.length;
  const enSize = enLen >= 22 ? 1.85 * cqw : 2.15 * cqw;
  ctx.font = `700 ${enSize}px 'Arial Narrow', Arial, sans-serif`;
  ctx.fillStyle = headingColor;
  ctx.fillText(copy.en, w * 0.23, h * 0.0245 + nameSize * 1.25 + 0.4 * cqw, w * 0.73);

  // Type label: right 4.5%, top 8.25%, font 2.45cqw
  ctx.font = `700 ${2.45 * cqw}px 'PingFang SC', 'Microsoft YaHei', sans-serif`;
  ctx.fillStyle = headingColor;
  ctx.textAlign = 'right';
  ctx.fillText(copy.typeLabel, w * 0.955, h * 0.0825);

  // Stats: left 3%, top 71.35%, width 94%, 4 columns
  const statsY = h * 0.7135;
  const colW = (w * 0.94) / 4;
  ctx.textAlign = 'center';
  for (let i = 0; i < stats.length; i++) {
    const [label, stat] = stats[i];
    const cx = w * 0.03 + colW * i + colW / 2;
    // Label
    ctx.font = `800 ${3.4 * cqw}px 'PingFang SC', 'Microsoft YaHei', sans-serif`;
    ctx.fillStyle = textColor;
    ctx.textBaseline = 'top';
    ctx.fillText(label, cx, statsY);
    // Value
    ctx.font = `800 ${7.2 * cqw}px Impact, 'Arial Narrow', 'PingFang SC', sans-serif`;
    ctx.fillText(stat, cx, statsY + 3.4 * cqw * 1.2 + 0.85 * cqw);
  }

  // Ability: left 6.4%, top 81.3%, font 5cqw bold
  ctx.font = `900 ${5 * cqw}px 'PingFang SC', 'Microsoft YaHei', sans-serif`;
  ctx.fillStyle = textColor;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(copy.ability, w * 0.064, h * 0.813, w * 0.872);

  // Rule: left 6.4%, top 85%, font 3.7cqw
  const ruleLen = copy.rule.length;
  const ruleSize = ruleLen >= 13 ? 3.3 * cqw : 3.7 * cqw;
  ctx.font = `600 ${ruleSize}px 'PingFang SC', 'Microsoft YaHei', sans-serif`;
  ctx.fillText(copy.rule, w * 0.064, h * 0.85, w * 0.872);

  // Flavor: left 6.4%, top 91.05%, font 3.4cqw, serif
  const flavorLen = copy.flavor.length;
  const flavorSize = flavorLen >= 13 ? 3.05 * cqw : 3.4 * cqw;
  ctx.font = `${flavorSize}px 'Kaiti SC', KaiTi, 'Noto Serif CJK SC', serif`;
  ctx.fillText(copy.flavor, w * 0.064, h * 0.9105, w * 0.872);

  ctx.restore();
}

/** Draw a simplified card (for hand/minimap) — just frame + picture + cost. */
export function drawCardMini(
  ctx: CanvasRenderingContext2D,
  id: CardId,
  x: number,
  y: number,
  w: number,
  costOverride?: number,
): void {
  preloadCardArt(id);
  const h = w * 1.5;
  const c = CARDS[id];
  const value = costOverride ?? c.cost;
  const art = cardArtCache.get(id);

  ctx.save();
  ctx.translate(x, y);

  // Frame
  if (art?.frame) {
    ctx.drawImage(art.frame, 0, 0, w, h);
  } else {
    ctx.fillStyle = '#2a332a';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#4a5a4a';
    ctx.lineWidth = 1;
    ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  }

  // Picture
  if (art?.picture) {
    const picX = w * 0.0205;
    const picY = h * 0.1068;
    const picW = w * 0.959;
    const picH = h * 0.58;
    ctx.save();
    ctx.beginPath();
    ctx.rect(picX, picY, picW, picH);
    ctx.clip();
    const imgRatio = art.picture.width / art.picture.height;
    const boxRatio = picW / picH;
    let dw = picW;
    let dh = picH;
    let dx = picX;
    let dy = picY;
    if (imgRatio > boxRatio) {
      dw = picH * imgRatio;
      dx = picX - (dw - picW) / 2;
    } else {
      dh = picW / imgRatio;
      dy = picY - (dh - picH) / 2;
    }
    ctx.drawImage(art.picture, dx, dy, dw, dh);
    ctx.restore();
  }

  // Cost badge
  const cqw = w / 100;
  ctx.font = `900 ${15 * cqw}px Impact, sans-serif`;
  ctx.fillStyle = '#e8e1c8';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(value), w * 0.1, h * 0.075);

  // Name (bottom)
  ctx.font = `900 ${6 * cqw}px 'PingFang SC', sans-serif`;
  ctx.fillStyle = '#e8e1c8';
  ctx.textBaseline = 'bottom';
  ctx.fillText(c.name, w / 2, h * 0.97, w * 0.9);

  ctx.restore();
}
