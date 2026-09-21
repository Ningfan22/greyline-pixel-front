/**
 * Shop screen: buy card packs, watch the tear animation, reveal draws
 * (fan for single packs, scrollable grid for ten-packs), watch ads for
 * gold, and browse the owned-card collection.
 * Replaces app/shop.tsx.
 */

import {
  Screen,
  Button,
  ScrollList,
  Widget,
  type Router,
} from './framework';
import {
  COLORS,
  clamp,
  drawTextCentered,
  drawTextLeft,
  drawTextRight,
  roundRect,
} from './theme';
import { drawCardFace, drawCardMini, loadCardImage } from './card-render';
import { CardDetailDialog } from './card-detail-dialog';
import { lobbyState } from '../lobby-state';
import { CARDS, type CardId } from '@/game/engine';
import {
  PACK_COST,
  TEN_PACK_COST,
  AD_REWARD,
  AD_COOLDOWN_MS,
  RARITY_LABEL,
  RARITY_RATE,
  collectionProgress,
  grantAdReward,
  openPack,
  openTenPacks,
  ownedCount,
  rarityOf,
  type PackDraw,
  type PackResult,
  type Rarity,
} from '@/game/collection';
import {
  PACK_CANVAS,
  PACK_DURATION,
  packFrameRect,
  packMotion,
} from '@/game/pack-animation';
import { assetUrl } from '@/game/asset-url';

const TOP_H = 40;
const BOTTOM_H = 100;
const LEFT_W = 216;
const ROW_H = 50;

const RARITY_COLOR: Record<Rarity, string> = {
  common: '#8b9578',
  rare: '#c0c8d0',
  epic: '#e8c25a',
  legendary: '#b06fd0',
};

const AD_COOLDOWN_STORAGE = 'greyline-ad-cooldown';

// ── Owned-card list row ──────────────────────────────────────────────────────

class OwnedRow extends Widget {
  id: CardId;
  count: number;

  constructor(id: CardId, count: number) {
    super();
    this.id = id;
    this.count = count;
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    const c = CARDS[this.id];
    drawCardMini(ctx, this.id, 6, 4, 28);
    drawTextLeft(ctx, c.name, 44, 13, 12, COLORS.text);
    drawTextLeft(
      ctx,
      RARITY_LABEL[rarityOf(this.id)],
      44,
      30,
      9,
      RARITY_COLOR[rarityOf(this.id)],
    );
    drawTextRight(ctx, `×${this.count}`, this.w - 8, 26, 12, COLORS.textDim);
  }
}

// ── Pack tear animation (full screen) ───────────────────────────────────────

class TearWidget extends Widget {
  onDone: (() => void) | null = null;
  private atlas: HTMLImageElement | null = null;
  private t = 0;
  private finished = false;
  private loadTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(w: number, h: number) {
    super();
    this.w = w;
    this.h = h;
    this.loadTimer = setTimeout(() => this.finish(), 5000);
    loadCardImage(assetUrl('art/pack-tear-v139.png'))
      .then((img) => {
        if (this.loadTimer) clearTimeout(this.loadTimer);
        this.loadTimer = null;
        this.atlas = img;
      })
      .catch(() => this.finish());
  }

  update(dt: number): void {
    if (!this.atlas || this.finished) return;
    this.t += dt;
    if (this.t >= PACK_DURATION) this.finish();
  }

  private finish(): void {
    if (this.finished) return;
    this.finished = true;
    if (this.loadTimer) {
      clearTimeout(this.loadTimer);
      this.loadTimer = null;
    }
    this.onDone?.();
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.w, this.h);
    if (!this.atlas) {
      drawTextCentered(ctx, '准备拆封…', this.w / 2, this.h / 2, 14, COLORS.textDim);
      return;
    }
    const motion = packMotion(this.t);
    const s = Math.min(this.w / PACK_CANVAS.width, this.h / PACK_CANVAS.height) * 0.85;
    const img = this.atlas;
    const cell = packFrameRect(img.width, img.height, motion.frame);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha = motion.alpha;
    ctx.translate(this.w / 2, this.h / 2);
    ctx.scale(s, s);
    ctx.translate(motion.x - PACK_CANVAS.width / 2, motion.y - PACK_CANVAS.height / 2);
    ctx.drawImage(
      img,
      cell.x,
      cell.y,
      cell.width,
      cell.height,
      0,
      0,
      cell.width,
      cell.height,
    );
    ctx.restore();
    drawTextCentered(ctx, '点击跳过', this.w / 2, this.h - 24, 11, COLORS.textMuted);
  }

  onTouchDown(): boolean {
    return true;
  }

  onTouchUp(): void {
    this.finish();
  }
}

// ── Reveal area (fan for 5, scrollable grid for 50) ─────────────────────────

interface RevealCallbacks {
  onFlip: () => void;
  onFlipAll: () => void;
  onDetail: (id: CardId) => void;
}

class RevealAreaWidget extends Widget {
  private draws: PackDraw[];
  private flipped: boolean[];
  private prevOwned: Partial<Record<CardId, number>>;
  private cb: RevealCallbacks;
  private backImg: HTMLImageElement | null = null;
  private ten: boolean;

  // Grid scroll state
  private scrollY = 0;
  private maxScroll = 0;
  private dragging = false;
  private moved = false;
  private downX = 0;
  private downY = 0;
  private startScroll = 0;

  constructor(
    w: number,
    h: number,
    draws: PackDraw[],
    flipped: boolean[],
    prevOwned: Partial<Record<CardId, number>>,
    cb: RevealCallbacks,
  ) {
    super();
    this.w = w;
    this.h = h;
    this.draws = draws;
    this.flipped = flipped;
    this.prevOwned = prevOwned;
    this.cb = cb;
    this.ten = draws.length > 5;
    if (this.ten) {
      const cols = 10;
      const gap = 6;
      const cardW = (this.w - 16 - (cols - 1) * gap) / cols;
      const rows = Math.ceil(draws.length / cols);
      const contentH = rows * (cardW * 1.5 + gap) + 8;
      this.maxScroll = Math.max(0, contentH - this.h);
    }
    loadCardImage(assetUrl('art/card-back-v1.webp'))
      .then((img) => {
        this.backImg = img;
      })
      .catch(() => {});
  }

  private isNew(d: PackDraw): boolean {
    return !d.converted && (this.prevOwned[d.id] ?? 0) === 0;
  }

  // ── Geometry ──

  private fanCardW(): number {
    return clamp(96, this.w * 0.14, 130);
  }

  /** Returns draw rect + rotation for fan mode, or null if offscreen. */
  private fanRect(i: number): { x: number; y: number; w: number; h: number; rot: number } {
    const cw = this.fanCardW();
    const ch = cw * 1.5;
    const fanX = clamp(34, this.w * 0.12, 64);
    const cx = this.w / 2;
    const cy = this.h * 0.42;
    const n = this.draws.length;
    const mid = (n - 1) / 2;
    const rot = (i - mid) * 11 * (Math.PI / 180);
    const spread = fanX + cw * 0.62;
    const x = cx + (i - mid) * spread - cw / 2;
    const y = cy + Math.abs(i - mid) * 12 - ch / 2;
    return { x, y, w: cw, h: ch, rot };
  }

  private gridRect(i: number): { x: number; y: number; w: number; h: number } {
    const cols = 10;
    const gap = 6;
    const cw = (this.w - 16 - (cols - 1) * gap) / cols;
    const ch = cw * 1.5;
    const col = i % cols;
    const row = Math.floor(i / cols);
    return {
      x: 8 + col * (cw + gap),
      y: 8 + row * (ch + gap) - this.scrollY,
      w: cw,
      h: ch,
    };
  }

  // ── Drawing ──

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.w, this.h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, this.w, this.h);
    ctx.clip();
    if (this.ten) this.drawGrid(ctx);
    else this.drawFan(ctx);
    ctx.restore();
  }

  private drawFan(ctx: CanvasRenderingContext2D): void {
    // Draw order: edges first, center last (on top).
    const n = this.draws.length;
    const order = [0, n - 1, 1, n - 2, 2].filter((i) => i >= 0 && i < n);
    const seen = new Set<number>();
    for (const i of order) {
      if (seen.has(i)) continue;
      seen.add(i);
      this.drawFanCard(ctx, i);
    }
    // Any remaining (n>5 safety)
    for (let i = 0; i < n; i++) {
      if (!seen.has(i)) this.drawFanCard(ctx, i);
    }
  }

  private drawFanCard(ctx: CanvasRenderingContext2D, i: number): void {
    const r = this.fanRect(i);
    const d = this.draws[i];
    ctx.save();
    ctx.translate(r.x + r.w / 2, r.y + r.h / 2);
    ctx.rotate(r.rot);
    if (!this.flipped[i]) {
      this.drawBack(ctx, -r.w / 2, -r.h / 2, r.w, r.h);
    } else {
      drawCardFace(ctx, d.id, -r.w / 2, -r.h / 2, r.w);
      this.drawBadges(ctx, d, -r.w / 2, -r.h / 2, r.w, r.h);
      // Rarity label under the card
      const label =
        RARITY_LABEL[d.rarity] +
        (this.isNew(d) ? '·新卡' : d.converted ? '·转化' : '');
      drawTextCentered(
        ctx,
        label,
        0,
        r.h / 2 + 10,
        9,
        RARITY_COLOR[d.rarity],
      );
    }
    ctx.restore();
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    for (let i = 0; i < this.draws.length; i++) {
      const r = this.gridRect(i);
      if (r.y + r.h < 0 || r.y > this.h) continue;
      const d = this.draws[i];
      if (!this.flipped[i]) {
        this.drawBack(ctx, r.x, r.y, r.w, r.h);
      } else {
        drawCardFace(ctx, d.id, r.x, r.y, r.w);
        this.drawBadges(ctx, d, r.x, r.y, r.w, r.h);
      }
    }
  }

  private drawBack(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    if (this.backImg) {
      ctx.drawImage(this.backImg, x, y, w, h);
    } else {
      ctx.fillStyle = '#2a332a';
      ctx.fillRect(x, y, w, h);
    }
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }

  private drawBadges(
    ctx: CanvasRenderingContext2D,
    d: PackDraw,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    if (this.isNew(d)) {
      ctx.fillStyle = COLORS.red;
      roundRect(ctx, x + 2, y + 2, 20, 11, 2);
      ctx.fill();
      drawTextCentered(ctx, '新', x + 12, y + 8, 9, '#ffffff', 'bold');
    }
    if (d.converted) {
      ctx.fillStyle = COLORS.accentDark;
      const bw = 34;
      roundRect(ctx, x + w - bw - 2, y + 2, bw, 11, 2);
      ctx.fill();
      drawTextCentered(ctx, `+${d.gold}金`, x + w - bw / 2 - 2, y + 8, 8, '#ffffff');
    }
    void h;
  }

  // ── Hit testing ──

  /** Returns the draw index at a point, or -1. */
  private hitIndex(px: number, py: number): number {
    if (this.ten) {
      for (let i = this.draws.length - 1; i >= 0; i--) {
        const r = this.gridRect(i);
        if (px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h) return i;
      }
      return -1;
    }
    // Fan: test in reverse draw order
    const n = this.draws.length;
    const order = [2, 3, 1, 4, 0].filter((i) => i >= 0 && i < n);
    for (const i of order) {
      const r = this.fanRect(i);
      // Inverse-rotate the point around the card center
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const dx = px - cx;
      const dy = py - cy;
      const cos = Math.cos(-r.rot);
      const sin = Math.sin(-r.rot);
      const lx = dx * cos - dy * sin;
      const ly = dx * sin + dy * cos;
      if (Math.abs(lx) <= r.w / 2 && Math.abs(ly) <= r.h / 2) return i;
    }
    return -1;
  }

  // ── Touch ──

  onTouchDown(x: number, y: number): boolean {
    this.dragging = true;
    this.moved = false;
    this.downX = x;
    this.downY = y;
    this.startScroll = this.scrollY;
    return true;
  }

  onTouchMove(x: number, y: number): void {
    if (!this.dragging) return;
    const dx = x - this.downX;
    const dy = y - this.downY;
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) this.moved = true;
    if (this.ten && this.moved) {
      this.scrollY = clamp(this.startScroll - dy, 0, this.maxScroll);
    }
  }

  onTouchUp(x: number, y: number): void {
    if (!this.dragging) return;
    this.dragging = false;
    if (this.moved) return;
    const idx = this.hitIndex(x, y);
    if (idx >= 0) {
      if (!this.flipped[idx]) {
        this.flipped[idx] = true;
        this.cb.onFlip();
      } else {
        this.cb.onDetail(this.draws[idx].id);
      }
    } else {
      this.cb.onFlipAll();
    }
  }
}

// ── Shop screen ─────────────────────────────────────────────────────────────

type Phase = 'idle' | 'tearing' | 'fanned';

export class ShopScreen extends Screen {
  private router: Router;
  private phase: Phase = 'idle';

  private result: PackResult | null = null;
  private prevOwned: Partial<Record<CardId, number>> = {};
  private flipped: boolean[] = [];

  private message = '';
  private messageAt = 0;
  private adReadyAt = 0;

  private packImg: HTMLImageElement | null = null;
  private tearWidget: TearWidget | null = null;
  private revealWidget: RevealAreaWidget | null = null;
  private ownedList: ScrollList | null = null;

  private btnPack: Button | null = null;
  private btnTen: Button | null = null;
  private btnAd: Button | null = null;
  private bottomButtons: Button[] = [];

  constructor(screenW: number, screenH: number, router: Router) {
    super(screenW, screenH);
    this.router = router;
    try {
      const saved = Number(localStorage.getItem(AD_COOLDOWN_STORAGE) ?? '0');
      this.adReadyAt = Number.isFinite(saved) ? saved : 0;
      if (this.adReadyAt < Date.now()) this.adReadyAt = 0;
    } catch {
      this.adReadyAt = 0;
    }
    loadCardImage(assetUrl('art/card-pack-v1.webp'))
      .then((img) => {
        this.packImg = img;
      })
      .catch(() => {});
  }

  onEnter(): void {
    this.buildIdle();
  }

  // ── Idle layout ──

  private buildIdle(): void {
    this.phase = 'idle';
    this.clearChildren();
    this.result = null;
    this.bottomButtons = [];

    // Top bar
    const back = new Button('返回', 64, 28);
    back.x = 8;
    back.y = 6;
    back.onTap = () => this.router.navigate('lobby');
    this.addChild(back);

    // Left column panel content
    const btnW = 168;
    const btnX = 8 + (LEFT_W - btnW) / 2;
    let btnY = TOP_H + 206;

    this.btnPack = new Button(`开一包 · ${PACK_COST}金`, btnW, 30);
    this.btnPack.x = btnX;
    this.btnPack.y = btnY;
    this.btnPack.onTap = () => this.startReveal(false);
    this.addChild(this.btnPack);
    btnY += 34;

    this.btnTen = new Button(`连开十包 · ${TEN_PACK_COST}金`, btnW, 30);
    this.btnTen.x = btnX;
    this.btnTen.y = btnY;
    this.btnTen.onTap = () => this.startReveal(true);
    this.addChild(this.btnTen);
    btnY += 34;

    this.btnAd = new Button('', btnW, 30);
    this.btnAd.x = btnX;
    this.btnAd.y = btnY;
    this.btnAd.onTap = () => this.watchAd();
    this.addChild(this.btnAd);

    // Right side: owned cards
    this.ownedList = new ScrollList(
      this.screenW - 240,
      this.screenH - 82,
      ROW_H,
    );
    this.ownedList.x = 232;
    this.ownedList.y = 74;
    this.ownedList.onItemTap = (index) => {
      const rows = this.ownedRows();
      const row = rows[index];
      if (!row) return;
      this.showDialog(new CardDetailDialog(row.id, () => this.closeDialog()));
    };
    this.addChild(this.ownedList);

    this.refreshIdle();
  }

  private ownedRows(): OwnedRow[] {
    const col = lobbyState.collection;
    const ids = (Object.keys(CARDS) as CardId[]).filter(
      (id) => !CARDS[id].internal && ownedCount(col, id) > 0,
    );
    ids.sort((a, b) => {
      const ca = CARDS[a];
      const cb = CARDS[b];
      if (ca.cost !== cb.cost) return ca.cost - cb.cost;
      return ca.name.localeCompare(cb.name, 'zh-CN');
    });
    return ids.map((id) => new OwnedRow(id, ownedCount(col, id)));
  }

  private refreshIdle(): void {
    const col = lobbyState.collection;
    this.btnPack!.disabled = col.gold < PACK_COST;
    this.btnTen!.disabled = col.gold < TEN_PACK_COST;
    this.refreshAdButton();
    if (this.ownedList) {
      this.ownedList.setItems(this.ownedRows());
    }
  }

  private refreshAdButton(): void {
    if (!this.btnAd) return;
    const col = lobbyState.collection;
    const remaining = this.adReadyAt - Date.now();
    if (remaining > 0) {
      this.btnAd.label = `广告冷却 ${Math.ceil(remaining / 1000)}s`;
      this.btnAd.disabled = true;
    } else {
      this.btnAd.label = `看广告领 ${AD_REWARD} 金`;
      this.btnAd.disabled = false;
    }
    void col;
  }

  // ── Pack opening ──

  private startReveal(ten: boolean): void {
    const col = lobbyState.collection;
    try {
      const r = ten ? openTenPacks(col) : openPack(col);
      this.prevOwned = { ...col.owned };
      lobbyState.updateCollection(r.state);
      this.result = r;
      this.flipped = r.drawn.map(() => false);
      this.buildTearing();
    } catch (e) {
      this.message = e instanceof Error ? e.message : String(e);
      this.messageAt = Date.now();
    }
  }

  private buildTearing(): void {
    this.phase = 'tearing';
    this.clearChildren();
    this.tearWidget = new TearWidget(this.screenW, this.screenH);
    this.tearWidget.onDone = () => this.buildFanned();
    this.addChild(this.tearWidget);
  }

  private buildFanned(): void {
    this.phase = 'fanned';
    this.clearChildren();
    this.tearWidget = null;
    if (!this.result) {
      this.buildIdle();
      return;
    }
    this.revealWidget = new RevealAreaWidget(
      this.screenW,
      this.screenH - BOTTOM_H,
      this.result.drawn,
      this.flipped,
      this.prevOwned,
      {
        onFlip: () => this.refreshBottomBar(),
        onFlipAll: () => {
          for (let i = 0; i < this.flipped.length; i++) this.flipped[i] = true;
          this.refreshBottomBar();
        },
        onDetail: (id) => {
          this.showDialog(new CardDetailDialog(id, () => this.closeDialog()));
        },
      },
    );
    this.addChild(this.revealWidget);
    this.refreshBottomBar();
  }

  private get allFlipped(): boolean {
    return this.flipped.every((f) => f);
  }

  private refreshBottomBar(): void {
    for (const b of this.bottomButtons) this.removeChild(b);
    this.bottomButtons = [];
    if (this.phase !== 'fanned' || !this.result) return;

    const y = this.screenH - 62;
    const h = 30;
    let x = 8;
    const add = (label: string, w: number, onTap: () => void, disabled = false) => {
      const b = new Button(label, w, h);
      b.x = x;
      b.y = y;
      b.onTap = onTap;
      b.disabled = disabled;
      this.addChild(b);
      this.bottomButtons.push(b);
      x += w + 6;
    };

    if (!this.allFlipped) {
      add('全部翻开', 84, () => {
        for (let i = 0; i < this.flipped.length; i++) this.flipped[i] = true;
        this.refreshBottomBar();
      });
    }
    add('收下', 72, () => this.buildIdle(), !this.allFlipped);
    add(
      '再开一包',
      92,
      () => this.startReveal(false),
      lobbyState.collection.gold < PACK_COST,
    );
    add(
      '再开十包',
      92,
      () => this.startReveal(true),
      lobbyState.collection.gold < TEN_PACK_COST,
    );
  }

  private summaryText(): string {
    if (!this.result) return '';
    const newCount = this.result.drawn.filter(
      (d) => !d.converted && (this.prevOwned[d.id] ?? 0) === 0,
    ).length;
    let parts = [`新卡 ${newCount} 张`];
    if (this.result.goldGained > 0) {
      parts.push(`溢出转化 +${this.result.goldGained} 金币`);
    }
    if (this.result.pity) {
      parts.push('保底王牌已触发');
    }
    return parts.join(' · ');
  }

  // ── Ads ──

  private watchAd(): void {
    if (this.adReadyAt > Date.now()) return;
    lobbyState.updateCollection(grantAdReward(lobbyState.collection));
    this.adReadyAt = Date.now() + AD_COOLDOWN_MS;
    try {
      localStorage.setItem(AD_COOLDOWN_STORAGE, String(this.adReadyAt));
    } catch {
      /* storage may be unavailable */
    }
    this.message = `广告奖励 +${AD_REWARD} 金币`;
    this.messageAt = Date.now();
    this.refreshIdle();
  }

  // ── Frame ──

  update(dt: number): void {
    if (this.phase === 'tearing' && this.tearWidget) {
      this.tearWidget.update(dt);
    } else if (this.phase === 'idle') {
      this.refreshAdButton();
    }
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.screenW, this.screenH);

    if (this.phase === 'tearing') return;

    if (this.phase === 'idle') {
      this.drawIdle(ctx);
    } else if (this.phase === 'fanned') {
      drawTextCentered(
        ctx,
        this.summaryText(),
        this.screenW / 2,
        this.screenH - 86,
        12,
        COLORS.accent,
        'bold',
      );
      if (!this.allFlipped) {
        drawTextCentered(
          ctx,
          '点击卡片翻一张 · 点击桌面全翻',
          this.screenW / 2,
          this.screenH - 14,
          10,
          COLORS.textMuted,
        );
      }
    }
  }

  private drawIdle(ctx: CanvasRenderingContext2D): void {
    // Top bar title + gold
    drawTextCentered(ctx, '军需商店', this.screenW / 2, 20, 15, COLORS.text, 'bold');
    drawTextRight(
      ctx,
      `金币 ${lobbyState.collection.gold}`,
      this.screenW - 12,
      20,
      13,
      COLORS.accent,
      'bold',
    );

    // Left panel background
    ctx.fillStyle = COLORS.bgPanel;
    roundRect(ctx, 8, TOP_H + 4, LEFT_W, this.screenH - TOP_H - 12, 6);
    ctx.fill();
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Pack image
    const packW = 100;
    const packH = clamp(this.screenH - 220, 90, 150);
    const packX = 8 + (LEFT_W - packW) / 2;
    const packY = TOP_H + 24;
    if (this.packImg) {
      ctx.drawImage(this.packImg, packX, packY, packW, packH);
    } else {
      ctx.fillStyle = COLORS.bgPanelLight;
      roundRect(ctx, packX, packY, packW, packH, 4);
      ctx.fill();
    }
    drawTextCentered(
      ctx,
      '前线卡包',
      8 + LEFT_W / 2,
      packY + packH + 14,
      12,
      COLORS.text,
    );

    // Rates
    const rateY = TOP_H + 206 + 34 * 3 + 40;
    drawTextCentered(
      ctx,
      `常规 ${(RARITY_RATE.common * 100).toFixed(0)}% · 精锐 ${(RARITY_RATE.rare * 100).toFixed(0)}%`,
      8 + LEFT_W / 2,
      rateY,
      9,
      COLORS.textMuted,
    );
    drawTextCentered(
      ctx,
      `王牌 ${(RARITY_RATE.epic * 100).toFixed(0)}% · 传奇 ${(RARITY_RATE.legendary * 100).toFixed(0)}%`,
      8 + LEFT_W / 2,
      rateY + 14,
      9,
      COLORS.textMuted,
    );

    // Message
    if (this.message && Date.now() - this.messageAt < 4000) {
      drawTextCentered(
        ctx,
        this.message,
        8 + LEFT_W / 2,
        rateY + 40,
        11,
        COLORS.redLight,
      );
    }

    // Right side header
    const col = lobbyState.collection;
    const prog = collectionProgress(col);
    drawTextLeft(
      ctx,
      `已收集 ${prog.species}/${prog.total} 种 · 共 ${prog.copies} 张 · 已开 ${col.packsOpened} 包`,
      232,
      52,
      11,
      COLORS.textDim,
    );
    drawTextLeft(ctx, '我的卡牌', 232, 66, 12, COLORS.text, 'bold');
  }
}
