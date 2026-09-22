/**
 * Deck builder screen: draft a 20-card deck with filters, search, undo,
 * replace mode, cost curve, presets, and deck-slot management.
 * Replaces app/deck-builder.tsx.
 */

import {
  Screen,
  Button,
  ScrollList,
  Widget,
  Container,
  Panel,
  type Router,
} from './framework';
import {
  COLORS,
  LAYOUT,
  drawTextCentered,
  drawTextLeft,
  drawTextRight,
  drawPanel,
  roundRect,
  clamp,
} from './theme';
import { drawCardMini } from './card-render';
import { CardDetailDialog } from './card-detail-dialog';
import { lobbyState } from '../lobby-state';
import { CARDS, DECK_SIZE, type CardId } from '@/game/engine';
import { copyLimit } from '@/game/cards';
import {
  deckLimit,
  ownedCount,
  validDeckWithCollection,
  clampToCollection,
} from '@/game/collection';
import { DECK_PRESETS } from '@/game/deck-presets';
import { MAX_DECKS, activeDeck } from '@/game/decks-store';
import { promptText } from './input';

const TOP_H = 42;
const FILTER_H = 30;
const BANNER_H = 22;
const STAT_H = 86;
const ROW_H = 50;

const TYPE_FILTERS = [
  { key: 'all', label: '全部' },
  { key: 'infantry', label: '步兵' },
  { key: 'artillery', label: '炮兵' },
  { key: 'armor', label: '装甲' },
  { key: 'air', label: '空军' },
  { key: 'skill', label: '指令' },
] as const;

const COST_FILTERS = [
  { key: 'all', label: '费用' },
  { key: '1', label: '1 费' },
  { key: '2', label: '2 费' },
  { key: '3', label: '3 费' },
  { key: '4', label: '4 费' },
  { key: '5', label: '5 费' },
  { key: '6', label: '6+ 费' },
] as const;

const OWNED_FILTERS = [
  { key: 'all', label: '筛选' },
  { key: 'available', label: '可编入' },
  { key: 'selected', label: '已选' },
] as const;

/** A list row showing a mini card face plus a right-aligned count. */
class CardRow extends Widget {
  id: CardId;
  rightText: string;
  subText: string;
  highlight = false;

  constructor(id: CardId, rightText: string, subText: string) {
    super();
    this.id = id;
    this.rightText = rightText;
    this.subText = subText;
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    if (this.highlight) {
      roundRect(ctx, 0, 1, this.w, this.h - 2, 4);
      ctx.fillStyle = 'rgba(212,168,67,.18)';
      ctx.fill();
      ctx.strokeStyle = COLORS.accent;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    const miniW = 28;
    const miniH = miniW * 1.5;
    drawCardMini(ctx, this.id, 4, (this.h - miniH) / 2, miniW);
    const c = CARDS[this.id];
    drawTextLeft(ctx, c.name, miniW + 10, this.h / 2 - 5, 12, COLORS.text, 'bold');
    if (this.subText) {
      drawTextLeft(ctx, this.subText, miniW + 10, this.h / 2 + 9, 10, COLORS.textDim);
    }
    if (this.rightText) {
      drawTextRight(ctx, this.rightText, this.w - 8, this.h / 2, 12, COLORS.accent, 'bold');
    }
  }
}

/** Simple message dialog with up to two buttons. */
class ConfirmDialog extends Widget {
  onConfirm: (() => void) | null = null;
  onCancel: (() => void) | null = null;
  private msg: string;
  private okLabel: string;
  private cancelLabel: string;

  constructor(msg: string, okLabel = '确认', cancelLabel = '取消') {
    super();
    this.w = 300;
    this.h = 130;
    this.msg = msg;
    this.okLabel = okLabel;
    this.cancelLabel = cancelLabel;

    const panel = new Panel(this.w, this.h, COLORS.bgPanel, COLORS.border, 6);
    this.addChild(panel);

    const btnW = 110;
    const btnH = 30;
    const ok = new Button(this.okLabel, btnW, btnH, { bg: COLORS.accentDark, textColor: COLORS.text });
    ok.x = this.w / 2 - btnW - 6;
    ok.y = this.h - btnH - 12;
    ok.onTap = () => {
      this.onConfirm?.();
    };
    this.addChild(ok);

    const cancel = new Button(this.cancelLabel, btnW, btnH);
    cancel.x = this.w / 2 + 6;
    cancel.y = ok.y;
    cancel.onTap = () => {
      this.onCancel?.();
    };
    this.addChild(cancel);
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    ctx.font = `13px -apple-system, "PingFang SC", sans-serif`;
    ctx.fillStyle = COLORS.text;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    const lines = this.msg.split('\n');
    let y = 18;
    for (const line of lines) {
      ctx.fillText(line, this.w / 2, y);
      y += 18;
    }
  }
}

export class DeckBuilderScreen extends Screen {
  private router: Router;
  private draft: CardId[] = [];
  private history: CardId[][] = [];
  private typeFilter = 0;
  private costFilter = 0;
  private ownedFilter = 0;
  private search = '';
  private pending: CardId | null = null;
  private toastMsg = '';
  private toastTime = 0;

  private poolList!: ScrollList;
  private deckList!: ScrollList;
  private poolCards: CardId[] = [];
  private deckCards: CardId[] = [];

  // Top bar widgets
  private deckNameBtn!: Button;
  private saveBtn!: Button;
  private startBtn!: Button;
  private undoBtn!: Button;
  private clearBtn!: Button;
  private presetBtn!: Button;
  private typeBtn!: Button;
  private costBtn!: Button;
  private ownedBtn!: Button;
  private searchBtn!: Button;

  constructor(screenW: number, screenH: number, router: Router) {
    super(screenW, screenH);
    this.router = router;
    this.buildTopBar();
    this.buildFilters();
    this.buildLists();
    this.buildStats();
  }

  onEnter(): void {
    this.draft = lobbyState.deck;
    this.history = [];
    this.pending = null;
    this.search = '';
    this.refresh();
  }

  // ── Layout ──────────────────────────────────────────────────────────────

  private listY(): number {
    return TOP_H + FILTER_H + (this.pending ? BANNER_H : 0);
  }
  private listH(): number {
    return this.screenH - this.listY() - STAT_H - 6;
  }

  // ── Top bar ─────────────────────────────────────────────────────────────

  private buildTopBar(): void {
    const h = 30;
    const y = (TOP_H - h) / 2;
    let x = 8;

    const back = new Button('返回', 52, h);
    back.x = x;
    back.y = y;
    back.onTap = () => this.router.navigate('lobby');
    this.addChild(back);
    x += 52 + 6;

    this.deckNameBtn = new Button('卡组', 120, h);
    this.deckNameBtn.x = x;
    this.deckNameBtn.y = y;
    this.deckNameBtn.onTap = () => this.openSwitchDialog();
    this.addChild(this.deckNameBtn);
    x += 120 + 6;

    const rename = new Button('重命名', 56, h);
    rename.x = x;
    rename.y = y;
    rename.onTap = () => this.renameDeck();
    this.addChild(rename);
    x += 56 + 6;

    this.saveBtn = new Button('保存', 56, h);
    this.saveBtn.x = x;
    this.saveBtn.y = y;
    this.saveBtn.onTap = () => this.save();
    this.addChild(this.saveBtn);
    x += 56 + 6;

    const saveAs = new Button('另存为', 60, h);
    saveAs.x = x;
    saveAs.y = y;
    saveAs.onTap = () => this.saveAsNew();
    this.addChild(saveAs);
    x += 60 + 6;

    const del = new Button('删除', 52, h, { bg: COLORS.red, border: COLORS.red });
    del.x = x;
    del.y = y;
    del.onTap = () => this.confirmDelete();
    this.addChild(del);
    x += 52 + 6;

    this.startBtn = new Button('出战', 64, h, {
      bg: COLORS.accentDark,
      textColor: COLORS.text,
      bold: true,
    });
    this.startBtn.x = x;
    this.startBtn.y = y;
    this.startBtn.onTap = () => this.start();
    this.addChild(this.startBtn);
  }

  // ── Filters ─────────────────────────────────────────────────────────────

  private buildFilters(): void {
    const h = 24;
    const y = TOP_H + (FILTER_H - h) / 2;
    let x = 8;

    this.typeBtn = new Button('全部', 64, h, { fontSize: 11 });
    this.typeBtn.x = x;
    this.typeBtn.y = y;
    this.typeBtn.onTap = () => {
      this.typeFilter = (this.typeFilter + 1) % TYPE_FILTERS.length;
      this.refresh();
    };
    this.addChild(this.typeBtn);
    x += 64 + 6;

    this.costBtn = new Button('费用', 64, h, { fontSize: 11 });
    this.costBtn.x = x;
    this.costBtn.y = y;
    this.costBtn.onTap = () => {
      this.costFilter = (this.costFilter + 1) % COST_FILTERS.length;
      this.refresh();
    };
    this.addChild(this.costBtn);
    x += 64 + 6;

    this.ownedBtn = new Button('筛选', 64, h, { fontSize: 11 });
    this.ownedBtn.x = x;
    this.ownedBtn.y = y;
    this.ownedBtn.onTap = () => {
      this.ownedFilter = (this.ownedFilter + 1) % OWNED_FILTERS.length;
      this.refresh();
    };
    this.addChild(this.ownedBtn);
    x += 64 + 6;

    this.searchBtn = new Button('搜索…', 100, h, { fontSize: 11 });
    this.searchBtn.x = x;
    this.searchBtn.y = y;
    this.searchBtn.onTap = () => this.openSearch();
    this.addChild(this.searchBtn);
  }

  // ── Lists ───────────────────────────────────────────────────────────────

  private buildLists(): void {
    const listW = Math.floor((this.screenW - 20) * 0.52);
    this.poolList = new ScrollList(listW, this.listH(), ROW_H);
    this.poolList.x = 8;
    this.poolList.y = this.listY();
    this.poolList.onItemTap = (i) => this.pick(this.poolCards[i]);
    this.poolList.onItemLongPress = (i) => this.showDetail(this.poolCards[i]);
    this.addChild(this.poolList);

    this.deckList = new ScrollList(this.screenW - listW - 24, this.listH(), ROW_H);
    this.deckList.x = listW + 16;
    this.deckList.y = this.listY();
    this.deckList.onItemTap = (i) => this.changeSlot(this.deckCards[i]);
    this.deckList.onItemLongPress = (i) => this.showDetail(this.deckCards[i]);
    this.addChild(this.deckList);
  }

  // ── Stats panel ─────────────────────────────────────────────────────────

  private buildStats(): void {
    const h = 30;
    const y = this.screenH - STAT_H + 10;
    this.undoBtn = new Button('撤销', 64, h, { fontSize: 12 });
    this.undoBtn.x = 8;
    this.undoBtn.y = y + 8;
    this.undoBtn.onTap = () => this.undo();
    this.addChild(this.undoBtn);

    this.clearBtn = new Button('清空', 64, h, { fontSize: 12 });
    this.clearBtn.x = 78;
    this.clearBtn.y = y + 8;
    this.clearBtn.onTap = () => this.apply([], '编队已清空，可撤销');
    this.addChild(this.clearBtn);

    this.presetBtn = new Button('推荐编队', 134, h, { fontSize: 12 });
    this.presetBtn.x = 8;
    this.presetBtn.y = y + 44;
    this.presetBtn.onTap = () => this.openPresetDialog();
    this.addChild(this.presetBtn);
  }

  // ── Data helpers ────────────────────────────────────────────────────────

  private countOf(id: CardId): number {
    return this.draft.filter((v) => v === id).length;
  }
  private limitOf(id: CardId): number {
    return deckLimit(lobbyState.collection, id);
  }
  private ownedOf(id: CardId): number {
    return ownedCount(lobbyState.collection, id);
  }
  private isValid(): boolean {
    return validDeckWithCollection(this.draft, lobbyState.collection);
  }
  private dirty(): boolean {
    const a = [...lobbyState.deck].sort().join('|');
    const b = [...this.draft].sort().join('|');
    return a !== b;
  }

  private apply(next: CardId[], msg: string): void {
    this.history = [...this.history.slice(-19), [...this.draft]];
    this.draft = next;
    this.pending = null;
    this.toast(msg);
    this.refresh();
  }

  private toast(msg: string): void {
    this.toastMsg = msg;
    this.toastTime = 3;
  }

  // ── Actions ─────────────────────────────────────────────────────────────

  private pick(id: CardId): void {
    if (this.countOf(id) >= this.limitOf(id)) {
      this.toast(`${CARDS[id].name}最多编入 ${this.limitOf(id)} 张（已拥有 ${this.ownedOf(id)}）`);
      return;
    }
    if (this.draft.length < DECK_SIZE) {
      this.apply([...this.draft, id], `已增加一张${CARDS[id].name}`);
      return;
    }
    this.pending = id;
    this.toast(`选择一张旧卡，替换为「${CARDS[id].name}」`);
    this.refresh();
  }

  private changeSlot(id: CardId): void {
    const index = this.draft.indexOf(id);
    if (index < 0) return;
    if (this.pending) {
      if (this.pending === id) {
        this.pending = null;
        this.toast('已取消替换');
        this.refresh();
        return;
      }
      if (this.countOf(this.pending) >= this.limitOf(this.pending)) return;
      const next = [...this.draft];
      next[index] = this.pending;
      this.apply(next, `已用一张${CARDS[this.pending].name}替换${CARDS[id].name}`);
    } else {
      const next = [...this.draft];
      next.splice(index, 1);
      this.apply(next, `已减少一张${CARDS[id].name}`);
    }
  }

  private undo(): void {
    if (!this.history.length) return;
    this.draft = this.history[this.history.length - 1];
    this.history = this.history.slice(0, -1);
    this.pending = null;
    this.toast('已撤销上一步');
    this.refresh();
  }

  private save(): void {
    const err = lobbyState.saveDeck([...this.draft]);
    this.toast(err ?? '已保存');
    this.refresh();
  }

  private saveAsNew(): void {
    if (lobbyState.deckStore.decks.length >= MAX_DECKS) {
      this.toast('卡组槽已满（最多 6 套）');
      return;
    }
    if (!this.isValid()) {
      this.toast('编队满 20 张才能另存为新卡组');
      return;
    }
    const ok = lobbyState.saveDeckAs([...this.draft]);
    this.toast(ok ? '已另存为新卡组' : '另存失败：卡组槽已满或编队无效');
    this.refresh();
  }

  private start(): void {
    const err = lobbyState.saveDeck([...this.draft]);
    if (err) {
      this.toast(err);
      return;
    }
    const beginErr = lobbyState.begin([...this.draft]);
    if (beginErr) this.toast(beginErr);
  }

  private renameDeck(): void {
    const slot = activeDeck(lobbyState.deckStore);
    promptText({
      defaultValue: slot.name,
      maxLength: 12,
      onDone: (value) => {
        const name = value.trim();
        if (name) {
          lobbyState.renameDeckSlot(slot.id, name.slice(0, 12));
          this.toast('卡组已重命名');
          this.refresh();
        }
      },
    });
  }

  private confirmDelete(): void {
    if (lobbyState.deckStore.decks.length <= 1) {
      this.toast('至少保留一套卡组');
      return;
    }
    const slot = activeDeck(lobbyState.deckStore);
    const dlg = new ConfirmDialog(`删除卡组「${slot.name}」？`, '删除');
    dlg.onConfirm = () => {
      lobbyState.deleteDeckSlot(slot.id);
      this.draft = lobbyState.deck;
      this.closeDialog();
      this.toast('当前卡组已删除');
      this.refresh();
    };
    dlg.onCancel = () => this.closeDialog();
    this.showDialog(dlg);
  }

  private openSwitchDialog(): void {
    const store = lobbyState.deckStore;
    const dlg = new Container();
    dlg.w = 280;
    dlg.h = 40 + store.decks.length * 36 + 12;
    const panel = new Panel(dlg.w, dlg.h, COLORS.bgPanel, COLORS.border, 6);
    dlg.addChild(panel);
    let y = 8;
    for (const slot of store.decks) {
      const btn = new Button(
        slot.id === store.activeId ? `● ${slot.name}` : slot.name,
        dlg.w - 24,
        30,
        { fontSize: 12 },
      );
      btn.x = 12;
      btn.y = y;
      btn.onTap = () => {
        if (slot.id === store.activeId) {
          this.closeDialog();
          return;
        }
        if (this.dirty()) {
          const confirm = new ConfirmDialog('当前卡组有未保存的修改，\n切换将丢失。确定切换吗？', '切换');
          confirm.onConfirm = () => {
            lobbyState.selectDeckSlot(slot.id);
            this.draft = lobbyState.deck;
            this.history = [];
            this.pending = null;
            this.closeDialog();
            this.refresh();
          };
          confirm.onCancel = () => this.closeDialog();
          this.showDialog(confirm);
        } else {
          lobbyState.selectDeckSlot(slot.id);
          this.draft = lobbyState.deck;
          this.history = [];
          this.pending = null;
          this.closeDialog();
          this.refresh();
        }
      };
      dlg.addChild(btn);
      y += 36;
    }
    this.showDialog(dlg);
  }

  private openPresetDialog(): void {
    const dlg = new Container();
    dlg.w = 300;
    dlg.h = 40 + DECK_PRESETS.length * 44 + 12;
    const panel = new Panel(dlg.w, dlg.h, COLORS.bgPanel, COLORS.border, 6);
    dlg.addChild(panel);
    let y = 8;
    for (const preset of DECK_PRESETS) {
      const btn = new Button(`${preset.name}`, dlg.w - 24, 38, { fontSize: 11 });
      btn.x = 12;
      btn.y = y;
      btn.onTap = () => {
        const cards = clampToCollection([...preset.cards], lobbyState.collection);
        const missing = preset.cards.length - cards.length;
        this.apply(
          cards,
          missing
            ? `${preset.name}：${preset.plan}（${missing} 张未拥有已跳过）`
            : `${preset.name}：${preset.plan}`,
        );
        this.closeDialog();
      };
      dlg.addChild(btn);
      y += 44;
    }
    this.showDialog(dlg);
  }

  private openSearch(): void {
    promptText({
      defaultValue: this.search,
      maxLength: 12,
      onDone: (value) => {
        this.search = value.trim();
        this.refresh();
      },
    });
  }

  private showDetail(id: CardId): void {
    const dlg = new CardDetailDialog(id, () => this.closeDialog());
    this.showDialog(dlg);
  }

  // ── Refresh ─────────────────────────────────────────────────────────────

  private refresh(): void {
    // Filter labels
    this.typeBtn.label = TYPE_FILTERS[this.typeFilter].label;
    this.costBtn.label = COST_FILTERS[this.costFilter].label;
    this.ownedBtn.label = OWNED_FILTERS[this.ownedFilter].label;
    this.searchBtn.label = this.search ? `搜:${this.search}` : '搜索…';

    const slot = activeDeck(lobbyState.deckStore);
    this.deckNameBtn.label = slot.name;
    this.saveBtn.label = this.dirty() ? '保存修改' : '保存卡组';
    this.startBtn.enabled = this.isValid();
    this.undoBtn.enabled = this.history.length > 0;

    // Pool
    const tf = TYPE_FILTERS[this.typeFilter].key;
    const cf = COST_FILTERS[this.costFilter].key;
    const of = OWNED_FILTERS[this.ownedFilter].key;
    const pool = Object.values(CARDS)
      .filter((c) => !c.internal)
      .sort(
        (a, b) => a.cost - b.cost || a.name.localeCompare(b.name, 'zh-CN'),
      )
      .filter(
        (c) =>
          (tf === 'all' ||
            (tf === 'infantry' && c.members) ||
            (tf === 'artillery' && c.emplacement) ||
            (tf === 'armor' && (c.armored || c.vehicle)) ||
            (tf === 'air' && c.air) ||
            (tf === 'skill' && c.type === 'skill')) &&
          (cf === 'all' ||
            (cf === '6' ? c.cost >= 6 : c.cost === Number(cf))) &&
          (of === 'all' ||
            (of === 'selected' && this.draft.includes(c.id)) ||
            (of === 'available' && this.countOf(c.id) < this.limitOf(c.id))) &&
          `${c.name}${c.tag}${c.description}`
            .toLowerCase()
            .includes(this.search.toLowerCase()),
      );
    this.poolCards = pool.map((c) => c.id);
    const poolRows = this.poolCards.map((id) => {
      const c = CARDS[id];
      const sub = c.members
        ? `${c.members} 人`
        : c.type === 'skill'
          ? '指令'
          : c.air
            ? '空军'
            : c.emplacement
              ? '炮兵'
              : '载具';
      const row = new CardRow(
        id,
        `${this.countOf(id)}/${this.limitOf(id)}`,
        sub,
      );
      row.highlight = this.pending === id;
      return row;
    });
    this.poolList.setItems(poolRows);

    // Deck (ordered unique)
    this.deckCards = [...new Set(this.draft)].sort(
      (a, b) =>
        CARDS[a].cost - CARDS[b].cost ||
        CARDS[a].name.localeCompare(CARDS[b].name, 'zh-CN'),
    );
    const deckRows = this.deckCards.map((id) => {
      const c = CARDS[id];
      const sub = `拥 ${this.ownedOf(id)} · 限 ${this.limitOf(id)}`;
      const row = new CardRow(id, `×${this.countOf(id)}`, sub);
      row.highlight = this.pending !== null;
      return row;
    });
    this.deckList.setItems(deckRows);

    // Reposition lists (banner may have changed)
    this.poolList.y = this.listY();
    this.poolList.h = this.listH();
    this.deckList.y = this.listY();
    this.deckList.h = this.listH();
  }

  update(dt: number): void {
    if (this.toastTime > 0) this.toastTime -= dt;
  }

  // ── Draw ────────────────────────────────────────────────────────────────

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.screenW, this.screenH);

    // Top bar background
    drawPanel(ctx, 0, 0, this.screenW, TOP_H, COLORS.bgPanel, undefined, 0);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, TOP_H + 0.5);
    ctx.lineTo(this.screenW, TOP_H + 0.5);
    ctx.stroke();

    // Filter row background
    drawPanel(ctx, 0, TOP_H, this.screenW, FILTER_H, COLORS.bgPanel, undefined, 0);

    // Replace banner
    if (this.pending) {
      const by = TOP_H + FILTER_H;
      ctx.fillStyle = 'rgba(212,168,67,.15)';
      ctx.fillRect(0, by, this.screenW, BANNER_H);
      drawTextCentered(
        ctx,
        `替换为「${CARDS[this.pending].name}」— 点右侧编队中的旧卡完成替换`,
        this.screenW / 2,
        by + BANNER_H / 2,
        11,
        COLORS.accent,
        'bold',
      );
    }

    // List labels
    const ly = this.listY() - 12;
    drawTextLeft(ctx, '卡池', 10, ly, 10, COLORS.textDim);
    const listW = Math.floor((this.screenW - 20) * 0.52);
    drawTextLeft(ctx, `编队 ${this.draft.length}/${DECK_SIZE}`, listW + 18, ly, 10, COLORS.textDim);

    // Stats panel
    const sy = this.screenH - STAT_H;
    drawPanel(ctx, 0, sy, this.screenW, STAT_H, COLORS.bgPanel, undefined, 0);
    ctx.strokeStyle = COLORS.border;
    ctx.beginPath();
    ctx.moveTo(0, sy + 0.5);
    ctx.lineTo(this.screenW, sy + 0.5);
    ctx.stroke();

    const unitCount = this.draft.filter((id) => CARDS[id].type === 'unit').length;
    const skillCount = this.draft.length - unitCount;
    const avg = this.draft.length
      ? (this.draft.reduce((n, id) => n + CARDS[id].cost, 0) / this.draft.length).toFixed(1)
      : '0.0';
    drawTextLeft(ctx, `部队 ${unitCount} · 指令 ${skillCount}`, 152, sy + 14, 11, COLORS.text);
    drawTextLeft(ctx, `均费 ${avg}`, 152, sy + 30, 11, COLORS.text);
    drawTextLeft(
      ctx,
      this.dirty() ? '● 有未保存的修改' : '卡面加减调整数量，长按查看详情',
      152,
      sy + 46,
      10,
      this.dirty() ? COLORS.accent : COLORS.textMuted,
    );

    // Cost curve
    const costs = Array.from({ length: 6 }, (_, i) =>
      this.draft.filter((id) =>
        i === 5 ? CARDS[id].cost >= 6 : CARDS[id].cost === i + 1,
      ).length,
    );
    const maxCost = Math.max(1, ...costs);
    const curveX = 300;
    const curveW = 160;
    const barW = (curveW - 30) / 6;
    drawTextLeft(ctx, '费用曲线', curveX, sy + 12, 10, COLORS.textDim);
    for (let i = 0; i < 6; i++) {
      const n = costs[i];
      const barH = Math.max(2, (n / maxCost) * 26);
      const bx = curveX + i * (barW + 6);
      const by2 = sy + STAT_H - 18 - barH;
      ctx.fillStyle = n > 0 ? COLORS.accent : COLORS.border;
      ctx.fillRect(bx, by2, barW, barH);
      if (n > 0) {
        drawTextCentered(ctx, String(n), bx + barW / 2, by2 - 10, 9, COLORS.text);
      }
      drawTextCentered(ctx, i === 5 ? '6+' : String(i + 1), bx + barW / 2, sy + STAT_H - 12, 9, COLORS.textDim);
    }

    // Toast
    if (this.toastTime > 0 && this.toastMsg) {
      const alpha = clamp(this.toastTime / 0.5, 0, 1);
      ctx.globalAlpha = alpha;
      const tw = Math.max(200, this.toastMsg.length * 12 + 32);
      const tx = (this.screenW - tw) / 2;
      const ty = this.screenH - STAT_H - 30;
      roundRect(ctx, tx, ty, tw, 24, 4);
      ctx.fillStyle = COLORS.overlay;
      ctx.fill();
      drawTextCentered(ctx, this.toastMsg, this.screenW / 2, ty + 12, 12, COLORS.text);
      ctx.globalAlpha = 1;
    }
  }
}
