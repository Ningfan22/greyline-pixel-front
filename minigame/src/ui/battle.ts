/**
 * Battle screen — full battlefield UI ported from app/battle.tsx.
 * Canvas-only, touch-first. All features from the React version are preserved.
 */

import {
  W, H, VIEW_W, DURATION, MAX_HP, DRAW_COST, MAX_HAND,
  createGame, startGame, tick, playCard, requestDraw, setOrder, needsTarget,
  snapshot,
  type GameState, type Order,
} from '@/game/engine';
import { createCampaignGame } from '@/game/campaign-game';
import { MISSIONS, missionById } from '@/game/campaign';
import { render } from '@/game/render';
import { loadArt, type Art } from '@/game/art';
import { getBattleAudio } from '@/game/audio';
import { CARDS, type CardId } from '@/game/cards';
import {
  pickSquad, selectUnitGroup, setSquadOrder, ordersForUnit,
  type SquadOrder,
} from '@/game/squad-orders';
import { unitSelectionBounds } from '@/game/selection-render';
import { MAPS } from '@/game/maps';
import type { MatchConfig } from '../lobby-state';
import { lobbyState } from '../lobby-state';
import {
  Screen, Widget, Button, Slider, Toggle, ScrollList, Router,
} from './framework';
import {
  COLORS, font, drawTextCentered, drawTextLeft, drawTextRight,
  roundRect, drawPanel, drawBar, clamp, wrapText,
} from './theme';
import { drawCardFace } from './card-render';
import { CardDetailDialog } from './card-detail-dialog';

declare const tt: any;

// ── Constants ────────────────────────────────────────────────────────────────

const DIFFICULTY_LABEL: Record<string, string> = {
  standard: '标准', veteran: '老练', elite: '精锐',
};
const DIFFICULTY_BONUS: Record<string, string> = {
  standard: '双方同速回点',
  veteran: 'AI 回点速度 +15%',
  elite: 'AI 回点速度 +30%',
};

const ORDER_LABELS: Record<Order, string> = {
  hold: '驻守', advance: '推进', rush: '奔跑', crouch: '蹲行', prone: '卧倒',
};
const ORDER_DESC: Record<Order, string> = {
  rush: '行军速度 ×1.7',
  crouch: '速度 ×0.55 · 受伤 −15%',
  prone: '匍匐速度 ×0.25 · 受伤 −30%',
  hold: '原地警戒，队员自主蹲伏还击',
  advance: '队员自主判断 · 交替掩护推进',
};
const ORDER_KEYS: Order[] = ['hold', 'advance', 'rush', 'crouch', 'prone'];

const WEATHER_LABEL: Record<string, string> = {
  clear: '晴', rain: '雨', fog: '雾', snow: '雪', sandstorm: '沙尘',
};

const ORDER_GLYPHS: Record<string, string> = {
  escort: 'M2 7h12v5H2zM1 12h14v3H1zM6 3h5v4H6zM10 4h6v2h-6zM0 1h2v2h2v2H2v2H0z',
  hold: 'M1 10h3V7h2v3h4V7h2v3h3v4H1zM6 1h4v4H6z',
  retreat: 'M7 1v3H4v3H1v2h3v3h3v3h2v-5h6V6H9V1z',
  attack: 'M7 1v5H1v4h6v5h2v-3h3V9h3V7h-3V4H9V1z',
  watch: 'M5 1h6v2h3v3h2v4h-2v3h-3v2H5v-2H2v-3H0V6h2V3h3zM4 6v4h2v2h4v-2h2V6h-2V4H6v2zM6 6h4v4H6z',
};

const GUIDE_SECTIONS: { num: string; title: string; body: string }[] = [
  {
    num: '01', title: '目标 — 夺下敌方指挥部',
    body: '基地初始 1,000 生命。摧毁敌方基地立即获胜；10 分钟后，基地剩余生命更高的一方获胜，相同则平局。',
  },
  {
    num: '02', title: '部署 — 拖出手牌，松手下令',
    body: '战场横跨多个屏幕，左右拖动移动视野，也可点击小地图。拖出底部扇形手牌区后松手即使用，拖回区域内松手取消；长按查看卡牌。单位从己方基地入场。炮兵随前线护卫牵引，到达有效射程后架设固定。烟幕和地雷以松手位置为目标。每个班组由 2–7 名独立士兵组成。点击己方小队，可选择据守、撤退、进攻、警戒或伴随。未收到明确指令的步兵会自动跟随附近友军坦克，进攻指令可解除伴随。据守约六秒挖好全队共用的战壕并布置两枚地雷，每队一次；撤退会交替掩护，到位后警戒。房屋与废墟可以绕行穿过，仍提供掩护；只有真实墙体和明显陡坎需要攀越。',
  },
  {
    num: '03', title: '补给 — 合理分配指挥点',
    body: '开局随机 6 张手牌、2 指挥点，基础每 3.6 秒恢复 1 点，上限 10。战地后勤可加快恢复，指挥扩编可提升上限，战时公债可在18秒后回款。主动点击牌堆，消耗 2 点抽 1 张，冷却 9 秒；不再自动抽牌。补给技能按卡面费用结算，无需额外支付抽牌费用。',
  },
  {
    num: '04', title: '战术 — 用好不同兵种',
    body: '坦克用穿甲弹攻击装甲、高爆弹和同轴机枪攻击步兵；标枪、反坦克炮和地雷克制重装。防空导弹追踪空军。固定炮兵周期发射，落点有散布，士兵只在炮弹临近时分散卧倒。树木和房屋有约一半概率拦下普通子弹，同一物体对每发子弹只判一次。弹坑、倒树、废墙和载具残骸仍可掩护步兵。房屋、树木缩短观察距离；视野内正常彩色，视野外黑白，未发现的敌人不显示。榴弹烟尘短小，火炮保留大范围爆炸。飞机快速通场，存活返航后回手并整备，再次派遣费用降低；满手回弃牌，被击落恢复原价。撤退队员经过友军射线会遭受误伤。',
  },
];

function timeString(t: number): string {
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
}

// ── Types ────────────────────────────────────────────────────────────────────

type View = ReturnType<typeof snapshot>;
type HandCardView = View['players'][0]['hand'][0];
type Phase = 'ready' | 'dialogue' | 'battle';

// ── Battlefield widget (touch: drag to pan, tap to select/play) ─────────────

class BattlefieldWidget extends Widget {
  private screen: BattleScreen;
  private dragStartX = 0;
  private dragStartY = 0;
  private dragStartCam = 0;
  private moved = false;

  constructor(screen: BattleScreen) {
    super();
    this.screen = screen;
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    this.screen.drawBattlefield(ctx);
  }

  onTouchDown(x: number, y: number): boolean {
    this.dragStartX = x;
    this.dragStartY = y;
    this.dragStartCam = this.screen.camera;
    this.moved = false;
    return true;
  }

  onTouchMove(x: number, y: number): void {
    const dx = x - this.dragStartX;
    if (!this.moved && Math.hypot(dx, y - this.dragStartY) > 8) this.moved = true;
    if (this.moved) {
      this.screen.moveCamera(this.dragStartCam - dx / this.screen.scale);
    }
  }

  onTouchUp(x: number, y: number): void {
    if (!this.moved) {
      this.screen.onBattlefieldTap(x, y);
    }
  }
}

// ── Minimap widget ───────────────────────────────────────────────────────────

class MinimapWidget extends Widget {
  private screen: BattleScreen;
  private dragging = false;

  constructor(screen: BattleScreen) {
    super();
    this.screen = screen;
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    this.screen.drawMinimap(ctx);
  }

  private jump(x: number): void {
    const pct = clamp(x / this.w, 0, 1);
    this.screen.moveCamera(pct * W - this.screen.viewportWidth / 2);
  }

  onTouchDown(x: number): boolean {
    this.dragging = true;
    this.jump(x);
    return true;
  }
  onTouchMove(x: number): void {
    if (this.dragging) this.jump(x);
  }
  onTouchUp(): void {
    this.dragging = false;
  }
  onTouchCancel(): void {
    this.dragging = false;
  }
}

// ── Hand card widget ─────────────────────────────────────────────────────────

class HandCardWidget extends Widget {
  captureOutside = true;
  private screen: BattleScreen;
  readonly uid: number;
  readonly cardId: CardId;

  constructor(screen: BattleScreen, uid: number, cardId: CardId) {
    super();
    this.screen = screen;
    this.uid = uid;
    this.cardId = cardId;
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    this.screen.drawHandCard(ctx, this);
  }

  onTouchDown(lx: number, ly: number): boolean {
    this.screen.onCardGestureDown(this, lx, ly);
    return true;
  }
  onTouchMove(lx: number, ly: number): void {
    this.screen.onCardGestureMove(this, lx, ly);
  }
  onTouchUp(lx: number, ly: number): void {
    this.screen.onCardGestureUp(this, lx, ly);
  }
  onTouchCancel(): void {
    this.screen.onCardGestureCancel(this);
  }
}

// ── Deck button (draw card) ──────────────────────────────────────────────────

class DeckButtonWidget extends Widget {
  private screen: BattleScreen;
  private pressed = false;

  constructor(screen: BattleScreen) {
    super();
    this.screen = screen;
    this.w = 44;
    this.h = 48;
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    const view = this.screen.view;
    if (!view) return;
    const p = view.players[0];
    const canDraw = p.drawIn <= 0 && p.energy >= DRAW_COST && p.hand.length < MAX_HAND && p.deckCount > 0;
    roundRect(ctx, 0, 0, this.w, this.h, 4);
    ctx.fillStyle = canDraw ? (this.pressed ? '#1a2a1a' : COLORS.bgPanelLight) : COLORS.bgPanel;
    ctx.fill();
    ctx.strokeStyle = canDraw ? COLORS.accent : COLORS.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.globalAlpha = canDraw ? 1 : 0.45;
    drawTextCentered(ctx, '抽牌', this.w / 2, 12, 10, COLORS.text);
    drawTextCentered(ctx, `${DRAW_COST}点`, this.w / 2, 26, 9, COLORS.energy);
    drawTextCentered(ctx, p.deckCount > 0 ? `${p.deckCount}` : '耗尽', this.w / 2, 40, 9,
      p.deckCount > 0 ? COLORS.textDim : COLORS.red);
    ctx.globalAlpha = 1;
    if (p.drawIn > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      roundRect(ctx, 0, 0, this.w, this.h, 4);
      ctx.fill();
      drawTextCentered(ctx, `${Math.ceil(p.drawIn)}s`, this.w / 2, this.h / 2, 13, COLORS.text, 'bold');
    }
  }

  onTouchDown(): boolean {
    this.pressed = true;
    return true;
  }
  onTouchUp(): void {
    this.pressed = false;
    this.screen.onDrawCard();
  }
  onTouchCancel(): void {
    this.pressed = false;
  }
}

// ── Squad order button (floating menu) ──────────────────────────────────────

class SquadOrderButton extends Widget {
  label: string;
  glyph: string;
  active = false;
  onTap: (() => void) | null = null;
  private pressed = false;

  constructor(label: string, glyph: string) {
    super();
    this.label = label;
    this.glyph = glyph;
    this.w = label.length > 2 ? 76 : 48;
    this.h = 30;
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    roundRect(ctx, 0, 0, this.w, this.h, 4);
    ctx.fillStyle = this.pressed ? '#1a2a1a' : (this.active ? COLORS.accent : COLORS.bgPanelLight);
    ctx.fill();
    ctx.strokeStyle = this.active ? COLORS.gold : COLORS.border;
    ctx.lineWidth = 1;
    ctx.stroke();
    // glyph
    try {
      const path = new Path2D(this.glyph);
      ctx.fillStyle = this.active ? '#000' : COLORS.text;
      ctx.save();
      ctx.translate(4, 4);
      ctx.fill(path);
      ctx.restore();
    } catch { /* glyph parse failure */ }
    drawTextLeft(ctx, this.label, 24, this.h / 2, 10, this.active ? '#000' : COLORS.text);
  }

  onTouchDown(): boolean {
    this.pressed = true;
    return true;
  }
  onTouchUp(): void {
    this.pressed = false;
    this.onTap?.();
  }
  onTouchCancel(): void {
    this.pressed = false;
  }
}

// ── Squad menu (floating) ────────────────────────────────────────────────────

class SquadMenuWidget extends Widget {
  private screen: BattleScreen;
  private orderBtns: SquadOrderButton[] = [];
  private caption = '';
  private progress: number | null = null;
  private progressLabel = '';
  private closeBtn: Button;

  constructor(screen: BattleScreen) {
    super();
    this.screen = screen;
    this.visible = false;
    this.closeBtn = new Button('×', 18, 18);
    this.closeBtn.onTap = () => this.screen.selectSquad(null);
    this.addChild(this.closeBtn);
  }

  /** Whether any order buttons are currently shown. */
  get hasOrders(): boolean {
    return this.orderBtns.length > 0;
  }

  refresh(
    orders: { id: SquadOrder; label: string }[],
    activeOrder: SquadOrder | undefined,
    caption: string,
    progress: number | null,
    progressLabel: string,
  ): void {
    this.caption = caption;
    this.progress = progress;
    this.progressLabel = progressLabel;
    // Keep the same control while a finger is held across live snapshots.
    const previous = new Map(this.orderBtns.map(b => [b.tag, b]));
    const next: SquadOrderButton[] = [];
    let bx = 4;
    for (const o of orders) {
      const btn = previous.get(o.id) ?? new SquadOrderButton(o.label, ORDER_GLYPHS[o.id] ?? '');
      btn.tag = o.id;
      btn.x = bx;
      btn.y = 4;
      btn.active = activeOrder === o.id;
      btn.onTap = () => this.screen.onSquadOrder(o.id);
      if (!btn.parent) this.addChild(btn);
      next.push(btn);
      bx += btn.w + 4;
    }
    for (const old of this.orderBtns) if (!next.includes(old)) this.removeChild(old);
    this.orderBtns = next;
    this.w = Math.max(bx, 120);
    this.h = 38 + 16 + (this.progress !== null ? 10 : 0);
    this.closeBtn.x = this.w - 20;
    this.closeBtn.y = 2;
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    // background
    drawPanel(ctx, 0, 0, this.w, this.h, COLORS.bgPanel, COLORS.border, 4);
    // caption
    drawTextLeft(ctx, this.caption, 4, this.h - 12, 9, COLORS.textDim);
    // progress bar
    if (this.progress !== null) {
      const barY = this.h - 22;
      ctx.fillStyle = COLORS.bgPanelLight;
      ctx.fillRect(4, barY, this.w - 44, 6);
      ctx.fillStyle = COLORS.gold;
      ctx.fillRect(4, barY, (this.w - 44) * clamp(this.progress, 0, 1), 6);
      if (this.progressLabel) {
        drawTextLeft(ctx, this.progressLabel, this.w - 38, barY + 3, 7, COLORS.textDim);
      }
    }
  }
}

// ── Ready overlay ────────────────────────────────────────────────────────────

class ReadyOverlay extends Widget {
  private screen: BattleScreen;
  private startBtn: Button;
  private exitBtn: Button;

  constructor(screen: BattleScreen) {
    super();
    this.screen = screen;
    this.visible = false;
    this.startBtn = new Button('开始作战', 140, 36);
    this.startBtn.onTap = () => this.screen.onStartBattle();
    this.exitBtn = new Button('返回整备', 100, 28);
    this.exitBtn.onTap = () => this.screen.onExitToLobby();
    this.addChild(this.startBtn);
    this.addChild(this.exitBtn);
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    const s = this.screen;
    ctx.fillStyle = 'rgba(8,12,8,0.82)';
    ctx.fillRect(0, 0, this.w, this.h);
    const cx = this.w / 2;
    drawTextCentered(ctx, 'OPERATION: GREYLINE', cx, this.h * 0.22, 20, COLORS.gold, 'bold');
    drawTextCentered(ctx, '战线，由你推进。', cx, this.h * 0.22 + 28, 12, COLORS.textDim);
    // mission info
    const view = s.view;
    if (view) {
      const mapDef = s.match ? MAPS[s.match.mapId] : null;
      if (mapDef) {
        drawTextCentered(ctx, mapDef.name, cx, this.h * 0.22 + 56, 14, COLORS.text, 'bold');
        drawTextCentered(ctx,
          `${mapDef.terrainLabel} · ${WEATHER_LABEL[view.weather.kind] ?? view.weather.kind}${view.night ? ' · 夜战' : ''}`,
          cx, this.h * 0.22 + 76, 10, COLORS.textDim);
      }
      if (view.campaign) {
        const mission = s.match?.missionId ? missionById(s.match.missionId) : null;
        if (mission) {
          drawTextCentered(ctx, `${mission.chapter} · ${mission.title}`, cx, this.h * 0.22 + 100, 12, COLORS.accent, 'bold');
          drawTextCentered(ctx, mission.goal, cx, this.h * 0.22 + 120, 10, COLORS.textDim);
        }
      }
      const diffLabel = DIFFICULTY_LABEL[s.match?.difficulty ?? 'standard'] ?? '标准';
      const diffBonus = DIFFICULTY_BONUS[s.match?.difficulty ?? 'standard'] ?? '';
      drawTextCentered(ctx, `难度：${diffLabel} · ${diffBonus}`, cx, this.h * 0.22 + 144, 10, COLORS.textDim);
    }
    // buttons
    this.startBtn.x = cx - 70;
    this.startBtn.y = this.h * 0.55;
    this.startBtn.disabled = !s.artLoaded;
    this.startBtn.label = s.artLoaded ? '开始作战' : '资源加载中…';
    this.exitBtn.x = cx - 50;
    this.exitBtn.y = this.h * 0.55 + 46;
  }
}

// ── Dialogue overlay (campaign briefing) ────────────────────────────────────

class DialogueOverlay extends Widget {
  private screen: BattleScreen;
  private nextBtn: Button;
  private closeBtn: Button;

  constructor(screen: BattleScreen) {
    super();
    this.screen = screen;
    this.visible = false;
    this.nextBtn = new Button('下一句', 90, 28);
    this.nextBtn.onTap = () => this.screen.onAdvanceDialogue();
    this.closeBtn = new Button('关闭简报', 90, 28);
    this.closeBtn.onTap = () => this.screen.onCloseDialogue();
    this.addChild(this.nextBtn);
    this.addChild(this.closeBtn);
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    const s = this.screen;
    ctx.fillStyle = 'rgba(8,12,8,0.85)';
    ctx.fillRect(0, 0, this.w, this.h);
    const mission = s.match?.missionId ? missionById(s.match.missionId) : null;
    if (!mission || !mission.openingDialogue.length) return;
    const line = mission.openingDialogue[s.dialogueIndex];
    if (!line) return;
    const cx = this.w / 2;
    const panelW = Math.min(420, this.w - 24);
    const panelX = cx - panelW / 2;
    const panelY = this.h * 0.15;
    const panelH = this.h * 0.55;
    drawPanel(ctx, panelX, panelY, panelW, panelH, COLORS.bgPanel, COLORS.border, 6);
    drawTextCentered(ctx, `${mission.chapter} · ${mission.title}`, cx, panelY + 20, 13, COLORS.gold, 'bold');
    drawTextCentered(ctx, '无线电简报 · 战斗暂停', cx, panelY + 40, 9, COLORS.textDim);
    // speaker
    drawTextLeft(ctx, line.speaker, panelX + 12, panelY + 64, 11, COLORS.accent, 'bold');
    // text (wrapped)
    ctx.save();
    ctx.beginPath();
    ctx.rect(panelX + 8, panelY + 76, panelW - 16, panelH - 120);
    ctx.clip();
    const lines = wrapText(ctx, line.text, panelW - 24, 11);
    let ty = panelY + 80;
    for (const ln of lines) {
      drawTextLeft(ctx, ln, panelX + 12, ty, 11, COLORS.text);
      ty += 16;
    }
    ctx.restore();
    // page indicator
    drawTextCentered(ctx, `${s.dialogueIndex + 1} / ${mission.openingDialogue.length}`, cx, panelY + panelH - 20, 9, COLORS.textDim);
    // buttons
    const isLast = s.dialogueIndex >= mission.openingDialogue.length - 1;
    this.nextBtn.label = isLast ? '开始行动' : '下一句';
    this.nextBtn.x = cx - 45;
    this.nextBtn.y = panelY + panelH + 12;
    this.closeBtn.x = cx - 145;
    this.closeBtn.y = panelY + panelH + 12;
  }
}

// ── Pause overlay ────────────────────────────────────────────────────────────

class PauseOverlay extends Widget {
  private screen: BattleScreen;
  private resumeBtn: Button;
  private resetBtn: Button;
  private deckBtn: Button;
  private guideBtn: Button;
  private exitBtn: Button;
  private audioToggle: Toggle;
  private effectsSlider: Slider;
  private musicSlider: Slider;
  private orderBtns: Button[] = [];

  constructor(screen: BattleScreen) {
    super();
    this.screen = screen;
    this.visible = false;
    this.resumeBtn = new Button('继续作战', 130, 32);
    this.resumeBtn.onTap = () => this.screen.onResume();
    this.resetBtn = new Button('重新整备', 110, 26);
    this.resetBtn.onTap = () => this.screen.onReset();
    this.deckBtn = new Button('检阅牌库', 110, 26);
    this.deckBtn.onTap = () => this.screen.onShowDeckList();
    this.guideBtn = new Button('作战手册', 110, 26);
    this.guideBtn.onTap = () => this.screen.onShowGuide();
    this.exitBtn = new Button('返回整备', 110, 26);
    this.exitBtn.onTap = () => this.screen.onExitToLobby();
    this.audioToggle = new Toggle(44, 22, true);
    this.audioToggle.onChange = (v) => {
      getBattleAudio().configure({ enabled: v });
    };
    this.effectsSlider = new Slider(120, 16, 0.65);
    this.effectsSlider.onChange = (v) => {
      getBattleAudio().configure({ effects: v });
    };
    this.musicSlider = new Slider(120, 16, 0.22);
    this.musicSlider.onChange = (v) => {
      getBattleAudio().configure({ music: v });
    };
    for (const key of ORDER_KEYS) {
      const btn = new Button(ORDER_LABELS[key], 52, 22);
      btn.onTap = () => this.screen.onSetOrder(key);
      this.orderBtns.push(btn);
      this.addChild(btn);
    }
    this.addChild(this.resumeBtn);
    this.addChild(this.resetBtn);
    this.addChild(this.deckBtn);
    this.addChild(this.guideBtn);
    this.addChild(this.exitBtn);
    this.addChild(this.audioToggle);
    this.addChild(this.effectsSlider);
    this.addChild(this.musicSlider);
  }

  syncAudio(): void {
    const s = getBattleAudio().settings;
    this.audioToggle.on = s.enabled;
    this.effectsSlider.value = s.effects;
    this.musicSlider.value = s.music;
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    const s = this.screen;
    ctx.fillStyle = 'rgba(8,12,8,0.82)';
    ctx.fillRect(0, 0, this.w, this.h);
    const cx = this.w / 2;
    drawTextCentered(ctx, '战场已暂停', cx, this.h * 0.14, 18, COLORS.text, 'bold');
    drawTextCentered(ctx, '准备好了，就继续推进。', cx, this.h * 0.14 + 24, 10, COLORS.textDim);
    // buttons
    const bw = 130;
    const bx = cx - bw / 2;
    let by = this.h * 0.28;
    this.resumeBtn.x = bx;
    this.resumeBtn.y = by;
    by += 40;
    const smallBw = 110;
    const sx = cx - smallBw / 2;
    this.resetBtn.x = sx; this.resetBtn.y = by; by += 32;
    this.deckBtn.x = sx; this.deckBtn.y = by; by += 32;
    this.guideBtn.x = sx; this.guideBtn.y = by; by += 32;
    this.exitBtn.x = sx; this.exitBtn.y = by; by += 36;
    // audio settings
    drawTextLeft(ctx, '音效', cx - 130, by + 8, 10, COLORS.textDim);
    this.audioToggle.x = cx - 100;
    this.audioToggle.y = by - 2;
    drawTextLeft(ctx, '音效音量', cx - 130, by + 30, 10, COLORS.textDim);
    this.effectsSlider.x = cx - 60;
    this.effectsSlider.y = by + 22;
    drawTextLeft(ctx, '音乐音量', cx - 130, by + 52, 10, COLORS.textDim);
    this.musicSlider.x = cx - 60;
    this.musicSlider.y = by + 44;
    by += 72;
    // infantry orders
    drawTextCentered(ctx, '步兵指令', cx, by, 10, COLORS.textDim);
    by += 8;
    const totalW = this.orderBtns.length * 56 - 4;
    let ox = cx - totalW / 2;
    const view = s.view;
    const currentOrder = view?.players[0].order ?? 'advance';
    for (let i = 0; i < this.orderBtns.length; i++) {
      const btn = this.orderBtns[i];
      btn.x = ox;
      btn.y = by;
      btn.style = { ...btn.style, bg: currentOrder === ORDER_KEYS[i] ? COLORS.accent : COLORS.bgPanelLight };
      ox += 56;
    }
  }
}

// ── Finished overlay ─────────────────────────────────────────────────────────

class FinishedOverlay extends Widget {
  private screen: BattleScreen;
  private nextBtn: Button;
  private resetBtn: Button;
  private exitBtn: Button;

  constructor(screen: BattleScreen) {
    super();
    this.screen = screen;
    this.visible = false;
    this.nextBtn = new Button('进入下一章', 120, 30);
    this.nextBtn.onTap = () => this.screen.onNextMission();
    this.resetBtn = new Button('再来一局', 110, 28);
    this.resetBtn.onTap = () => this.screen.onReset();
    this.exitBtn = new Button('返回整备', 110, 28);
    this.exitBtn.onTap = () => this.screen.onExitToLobby();
    this.addChild(this.nextBtn);
    this.addChild(this.resetBtn);
    this.addChild(this.exitBtn);
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    const s = this.screen;
    const view = s.view;
    if (!view) return;
    ctx.fillStyle = 'rgba(8,12,8,0.85)';
    ctx.fillRect(0, 0, this.w, this.h);
    const cx = this.w / 2;
    const mission = s.match?.missionId ? missionById(s.match.missionId) : null;
    const title = mission ? `${mission.chapter} · ${mission.title}` : 'OPERATION COMPLETE';
    drawTextCentered(ctx, title, cx, this.h * 0.16, 14, COLORS.gold, 'bold');
    const result = view.result;
    const resultText = result === 0 ? '作战胜利' : result === 1 ? '防线失守' : '双方平局';
    const resultColor = result === 0 ? COLORS.green : result === 1 ? COLORS.red : COLORS.text;
    drawTextCentered(ctx, resultText, cx, this.h * 0.16 + 32, 20, resultColor, 'bold');
    // description
    let desc = '';
    if (mission) {
      desc = result === 0 ? mission.victory : mission.defeat;
    } else {
      desc = result === 0 ? '前线已控制，指挥官。' : result === 1 ? '调整部署，下一次夺回前线。' : '双方坚守阵地，再来一局。';
    }
    const lines = wrapText(ctx, desc, Math.min(400, this.w - 40), 11);
    let dy = this.h * 0.16 + 60;
    for (const ln of lines) {
      drawTextCentered(ctx, ln, cx, dy, 11, COLORS.textDim);
      dy += 16;
    }
    // stats
    const p = view.players[0];
    drawTextCentered(ctx, `${p.kills} 击退单位 · ${p.played} 下达指令 · ${timeString(view.time)} 作战时长`,
      cx, dy + 8, 10, COLORS.textDim);
    // buttons
    const isMissionWin = mission && result === 0;
    this.nextBtn.visible = !!isMissionWin;
    this.resetBtn.label = mission ? '重打本章' : '再来一局';
    this.exitBtn.label = mission ? '返回战役' : '返回整备';
    let by = dy + 32;
    if (isMissionWin) {
      this.nextBtn.x = cx - 60;
      this.nextBtn.y = by;
      by += 38;
    }
    this.resetBtn.x = cx - 115;
    this.resetBtn.y = by;
    this.exitBtn.x = cx + 5;
    this.exitBtn.y = by;
  }
}

// ── Portrait gate ────────────────────────────────────────────────────────────

class PortraitGateWidget extends Widget {
  private screen: BattleScreen;
  private exitBtn: Button;

  constructor(screen: BattleScreen) {
    super();
    this.screen = screen;
    this.visible = false;
    this.exitBtn = new Button('返回整备', 110, 28);
    this.exitBtn.onTap = () => this.screen.onExitToLobby();
    this.addChild(this.exitBtn);
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = 'rgba(8,12,8,0.92)';
    ctx.fillRect(0, 0, this.w, this.h);
    const cx = this.w / 2;
    const cy = this.h / 2;
    drawTextCentered(ctx, '请横屏作战', cx, cy - 20, 18, COLORS.text, 'bold');
    drawTextCentered(ctx, '旋转设备以获得最佳体验', cx, cy + 4, 10, COLORS.textDim);
    this.exitBtn.x = cx - 55;
    this.exitBtn.y = cy + 28;
  }
}

// ── Guide dialog content ─────────────────────────────────────────────────────

class GuideWidget extends Widget {
  private screen: BattleScreen;
  private lines: { text: string; color: string; bold: boolean }[] = [];
  private linesBuilt = false;
  private scrollY = 0;
  private maxScroll = 0;
  private dragStartY = 0;
  private dragStartScroll = 0;
  private dragging = false;
  private closeBtn: Button;

  constructor(screen: BattleScreen) {
    super();
    this.screen = screen;
    this.w = 340;
    this.h = 400;
    this.closeBtn = new Button('关闭', 60, 24);
    this.closeBtn.onTap = () => this.screen.closeDialog();
    this.addChild(this.closeBtn);
  }

  private buildLines(ctx: CanvasRenderingContext2D): void {
    this.lines = [];
    for (const sec of GUIDE_SECTIONS) {
      this.lines.push({ text: `${sec.num} / ${sec.title}`, color: COLORS.gold, bold: true });
      const bodyLines = wrapText(
        ctx, sec.body, 316, 10,
      );
      for (const bl of bodyLines) {
        this.lines.push({ text: bl, color: COLORS.text, bold: false });
      }
      this.lines.push({ text: '', color: COLORS.text, bold: false });
    }
    // difficulty note
    const diffLabel = DIFFICULTY_LABEL[this.screen.match?.difficulty ?? 'standard'] ?? '标准';
    const diffBonus = DIFFICULTY_BONUS[this.screen.match?.difficulty ?? 'standard'] ?? '';
    const note = `AI 从独立组建的 20 张牌库抽牌。当前难度：${diffLabel}，${diffBonus}。双方开局均为2点，卡牌费用和抽牌规则相同。离开页面会自动暂停；返回后点击继续作战。`;
    const noteLines = wrapText(ctx, note, 316, 9);
    for (const nl of noteLines) {
      this.lines.push({ text: nl, color: COLORS.textDim, bold: false });
    }
    this.maxScroll = Math.max(0, this.lines.length * 15 - (this.h - 50));
    this.linesBuilt = true;
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    if (!this.linesBuilt) this.buildLines(ctx);
    drawPanel(ctx, 0, 0, this.w, this.h, COLORS.bgPanel, COLORS.border, 6);
    drawTextCentered(ctx, '作战手册', this.w / 2, 16, 14, COLORS.gold, 'bold');
    this.closeBtn.x = this.w - 66;
    this.closeBtn.y = 4;
    // scrollable text
    ctx.save();
    ctx.beginPath();
    ctx.rect(6, 32, this.w - 12, this.h - 40);
    ctx.clip();
    let y = 36 - this.scrollY;
    for (const line of this.lines) {
      if (y > 28 && y < this.h - 8) {
        ctx.font = font(10, line.bold ? 'bold' : 'normal');
        ctx.fillStyle = line.color;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(line.text, 10, y);
      }
      y += 15;
    }
    ctx.restore();
    // scrollbar
    if (this.maxScroll > 0) {
      const barH = Math.max(20, (this.h - 50) / (this.maxScroll + this.h - 50) * (this.h - 50));
      const barY = 32 + (this.scrollY / this.maxScroll) * (this.h - 50 - barH);
      ctx.fillStyle = COLORS.border;
      ctx.fillRect(this.w - 4, barY, 2, barH);
    }
  }

  onTouchDown(_x: number, y: number): boolean {
    this.dragging = true;
    this.dragStartY = y;
    this.dragStartScroll = this.scrollY;
    return true;
  }
  onTouchMove(_x: number, y: number): void {
    if (!this.dragging) return;
    this.scrollY = clamp(this.dragStartScroll - (y - this.dragStartY), 0, this.maxScroll);
  }
  onTouchUp(): void {
    this.dragging = false;
  }
  onTouchCancel(): void {
    this.dragging = false;
  }
}

// ── Deck list dialog content ─────────────────────────────────────────────────

class DeckListWidget extends Widget {
  private screen: BattleScreen;
  private list: ScrollList;
  private closeBtn: Button;

  constructor(screen: BattleScreen) {
    super();
    this.screen = screen;
    this.w = 300;
    this.h = 380;
    this.closeBtn = new Button('关闭', 60, 24);
    this.closeBtn.onTap = () => this.screen.closeDialog();
    this.addChild(this.closeBtn);
    this.list = new ScrollList(this.w - 16, this.h - 60, 22);
    this.list.x = 8;
    this.list.y = 32;
    this.addChild(this.list);
    this.buildList();
  }

  private buildList(): void {
    const cards = this.screen.match?.player ?? [];
    const counts = new Map<CardId, number>();
    for (const id of cards) {
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const entries = [...counts.entries()].sort((a, b) => CARDS[a[0]].cost - CARDS[b[0]].cost);
    const items: Widget[] = entries.map(([id, count]) => {
      const item = new DeckRowWidget(id, count);
      return item;
    });
    this.list.setItems(items);
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    drawPanel(ctx, 0, 0, this.w, this.h, COLORS.bgPanel, COLORS.border, 6);
    drawTextCentered(ctx, '检阅牌库', this.w / 2, 16, 14, COLORS.gold, 'bold');
    this.closeBtn.x = this.w - 66;
    this.closeBtn.y = 4;
  }
}

class DeckRowWidget extends Widget {
  private cardId: CardId;
  private count: number;

  constructor(cardId: CardId, count: number) {
    super();
    this.cardId = cardId;
    this.count = count;
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    const c = CARDS[this.cardId];
    drawTextLeft(ctx, `${c.cost}`, 4, this.h / 2, 11, COLORS.energy, 'bold');
    drawTextLeft(ctx, c.name, 24, this.h / 2, 11, COLORS.text);
    drawTextLeft(ctx, `×${this.count}`, this.w - 20, this.h / 2, 10, COLORS.textDim);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, this.h - 0.5);
    ctx.lineTo(this.w, this.h - 0.5);
    ctx.stroke();
  }
}

// ── BattleScreen ─────────────────────────────────────────────────────────────

export class BattleScreen extends Screen {
  readonly router: Router;
  match: MatchConfig | null = null;
  camera = 0;
  scale = 1;
  viewportWidth = VIEW_W;
  view: View | null = null;
  artLoaded = false;
  art: Art | null = null;
  dialogueIndex = 0;

  private game: GameState | null = null;
  private phase: Phase = 'ready';
  private topH = 34;
  private bottomH = 140;
  private bfY = 34;
  private bfH = 200;

  private selectedCardUid: number | null = null;
  private hoverX: number | null = null;
  selectedSquad: number | null = null;

  // card gesture
  private pressUid: number | null = null;
  private pressStart = 0;
  private pressSX = 0;
  private pressSY = 0;
  private longPressFired = false;
  private cardDragging = false;
  private dragGhost: { uid: number; x: number; y: number } | null = null;
  private heldClickUid: number | null = null;

  private toastText = '';
  private toastUntil = 0;
  private missionDone = false;
  private accumulator = 0;
  private snapshotTimer = 0;
  private audioUnlocked = false;

  private handWidgets: HandCardWidget[] = [];
  private handUids: number[] = [];
  private handCardW = 58;

  // widgets
  private battlefield: BattlefieldWidget;
  private minimap: MinimapWidget;
  private deckButton: DeckButtonWidget;
  private squadMenu: SquadMenuWidget;
  private pauseButton: Button;
  private readyOverlay: ReadyOverlay;
  private dialogueOverlay: DialogueOverlay;
  private pauseOverlay: PauseOverlay;
  private finishedOverlay: FinishedOverlay;
  private portraitGate: PortraitGateWidget;
  private orderBtns: Button[] = [];

  constructor(screenW: number, screenH: number, router: Router) {
    super(screenW, screenH);
    this.router = router;
    this.layout();

    // create widgets
    this.battlefield = new BattlefieldWidget(this);
    this.minimap = new MinimapWidget(this);
    this.deckButton = new DeckButtonWidget(this);
    this.squadMenu = new SquadMenuWidget(this);
    this.pauseButton = new Button('', 28, 28);
    this.pauseButton.icon = (ctx, w, h) => {
      ctx.fillStyle = COLORS.text;
      ctx.fillRect(w / 2 - 5, h / 2 - 6, 4, 12);
      ctx.fillRect(w / 2 + 1, h / 2 - 6, 4, 12);
    };
    this.pauseButton.onTap = () => this.onTogglePause();
    this.readyOverlay = new ReadyOverlay(this);
    this.dialogueOverlay = new DialogueOverlay(this);
    this.pauseOverlay = new PauseOverlay(this);
    this.finishedOverlay = new FinishedOverlay(this);
    this.portraitGate = new PortraitGateWidget(this);

    // infantry order buttons
    for (const key of ORDER_KEYS) {
      const btn = new Button(ORDER_LABELS[key], 54, 20);
      btn.onTap = () => this.onSetOrder(key);
      this.orderBtns.push(btn);
      this.addChild(btn);
    }

    // add children in order (later = on top)
    this.addChild(this.battlefield);
    this.addChild(this.minimap);
    this.addChild(this.deckButton);
    this.addChild(this.squadMenu);
    this.addChild(this.pauseButton);
    this.addChild(this.readyOverlay);
    this.addChild(this.dialogueOverlay);
    this.addChild(this.pauseOverlay);
    this.addChild(this.finishedOverlay);
    this.addChild(this.portraitGate);

    this.positionWidgets();

    // resize listener
    if (typeof tt !== 'undefined' && typeof tt.onWindowResize === 'function') {
      tt.onWindowResize(() => {
        try {
          const info = tt.getSystemInfoSync();
          this.screenW = info.windowWidth;
          this.screenH = info.windowHeight;
          this.w = this.screenW;
          this.h = this.screenH;
          this.layout();
          this.positionWidgets();
        } catch { /* ignore */ }
      });
    }
  }

  // ── Layout ──

  private layout(): void {
    this.topH = 34;
    this.bottomH = clamp(Math.round(this.screenH * 0.34), 124, 144);
    this.bfY = this.topH;
    this.bfH = this.screenH - this.topH - this.bottomH;
    this.scale = this.bfH / H;
    this.viewportWidth = clamp(Math.round(this.screenW / this.scale), 240, W);
    this.handCardW = Math.min(58, Math.floor((this.screenW - 120) / 7));
  }

  private positionWidgets(): void {
    this.battlefield.x = 0;
    this.battlefield.y = this.bfY;
    this.battlefield.w = this.screenW;
    this.battlefield.h = this.bfH;

    this.minimap.x = 6;
    this.minimap.y = this.bfY + 3;
    this.minimap.w = this.screenW - 12;
    this.minimap.h = 12;

    this.deckButton.x = this.screenW - 50;
    this.deckButton.y = this.screenH - this.bottomH + 24;

    this.pauseButton.x = this.screenW / 2 - 14;
    this.pauseButton.y = 3;

    // overlays full screen
    for (const o of [this.readyOverlay, this.dialogueOverlay, this.pauseOverlay,
      this.finishedOverlay, this.portraitGate]) {
      o.x = 0;
      o.y = 0;
      o.w = this.screenW;
      o.h = this.screenH;
    }

    // order buttons
    const totalW = this.orderBtns.length * 56 - 2;
    let ox = 6;
    for (const btn of this.orderBtns) {
      btn.x = ox;
      btn.y = this.screenH - this.bottomH + 2;
      ox += 56;
    }
    void totalW;

    this.layoutHand();
  }

  private layoutHand(): void {
    const n = this.handWidgets.length;
    if (n === 0) return;
    const cw = this.handCardW;
    const ch = cw * 1.5;
    const spacing = cw * 0.55;
    const totalW = (n - 1) * spacing + cw;
    const startX = clamp((this.screenW - totalW) / 2, 8, this.screenW - totalW - 56);
    const fanY = this.screenH - 4 - ch;
    for (let i = 0; i < n; i++) {
      const w = this.handWidgets[i];
      const fi = i - (n - 1) / 2;
      w.x = startX + i * spacing;
      w.y = fanY + fi * fi * 4;
      w.w = cw;
      w.h = ch;
    }
  }

  // ── Configure / lifecycle ──

  configure(match: MatchConfig): void {
    this.match = match;
    this.phase = 'ready';
    this.missionDone = false;
    this.selectedCardUid = null;
    this.selectedSquad = null;
    this.hoverX = null;
    this.accumulator = 0;
    this.snapshotTimer = 0;
    this.toastText = '';
    this.dialogueIndex = 0;
    this.audioUnlocked = false;
    this.artLoaded = false;
    this.art = null;
    this.dragGhost = null;
    this.pressUid = null;

    if (match.missionId) {
      this.game = createCampaignGame(match.seed, match.player, match.missionId, match.difficulty);
    } else {
      this.game = createGame(
        match.seed, match.player, match.ai, match.mapId,
        { difficulty: match.difficulty, night: match.night },
      );
    }
    this.view = snapshot(this.game, 0);
    this.camera = this.view.campaign?.initialCamera ?? 0;
    this.camera = clamp(this.camera, 0, Math.max(0, W - this.viewportWidth));
    this.layout();
    this.positionWidgets();
    this.syncFromView();

    loadArt()
      .then((a) => { this.art = a; this.artLoaded = true; })
      .catch(() => { this.artLoaded = true; });

    getBattleAudio().setActive(true);
  }

  onEnter(): void {
    getBattleAudio().setActive(true);
  }

  onExit(): void {
    getBattleAudio().setActive(false);
  }

  onAppHide(): void {
    this.cancelTouches();
    this.selectedCardUid = null;
    this.hoverX = null;
    if (this.game && this.game.status === 'playing') {
      this.game.status = 'paused';
    }
    getBattleAudio().setActive(false);
  }

  onAppShow(): void {
    getBattleAudio().setActive(true);
  }

  onAudioInterrupt(begin: boolean): void {
    getBattleAudio().setActive(!begin);
  }

  // ── Game loop ──

  update(dt: number): void {
    if (!this.game || !this.view) return;

    // long press check
    this.checkLongPress();

    // toast expiry
    if (this.toastText && Date.now() > this.toastUntil) this.toastText = '';

    const portrait = this.screenW < this.screenH;
    const blocked = portrait
      || this.phase === 'dialogue'
      || this.hasDialog
      || this.game.status !== 'playing';

    if (!blocked) {
      this.accumulator += dt;
      let steps = 0;
      while (this.accumulator >= 1 / 60 && steps < 3) {
        tick(this.game, 1 / 60);
        this.accumulator -= 1 / 60;
        steps++;
      }
      if (steps === 3) this.accumulator = 0;
    } else {
      this.accumulator = 0;
    }

    // snapshot every 90ms
    this.snapshotTimer += dt;
    if (this.snapshotTimer >= 0.09) {
      this.snapshotTimer = 0;
      this.view = snapshot(this.game, 0);
      this.syncFromView();
    }

    // audio
    const audio = getBattleAudio();
    const active = !portrait && (this.game.status === 'playing' || this.phase === 'ready');
    if (this.art) {
      audio.update(this.game, this.camera, this.viewportWidth, active);
    }

    // campaign completion
    if (this.match?.missionId && this.game.status === 'finished' && !this.missionDone) {
      this.missionDone = true;
      if (this.view.result === 0) {
        lobbyState.completeMission(this.match.missionId);
      }
    }
  }

  private syncFromView(): void {
    if (!this.game || !this.view) return;

    // rebuild hand widgets if uid list changed
    const hand = this.view.players[0].hand;
    const uids = hand.map((h) => h.uid);
    const changed = uids.length !== this.handUids.length
      || uids.some((u, i) => u !== this.handUids[i]);
    if (changed) {
      this.handUids = uids;
      this.rebuildHand();
    }

    // overlay visibility
    const portrait = this.screenW < this.screenH;
    const status = this.game.status;
    this.readyOverlay.visible = this.phase === 'ready';
    this.dialogueOverlay.visible = this.phase === 'dialogue';
    this.pauseOverlay.visible = this.phase === 'battle' && status === 'paused';
    this.finishedOverlay.visible = this.phase === 'battle' && status === 'finished';
    this.portraitGate.visible = portrait;
    const playing = !portrait && this.phase === 'battle' && status === 'playing';
    this.minimap.visible = !portrait && this.phase === 'battle' && status !== 'finished';
    this.pauseButton.visible = !portrait && this.phase === 'battle' && status !== 'finished';
    this.deckButton.visible = playing;
    for (const b of this.orderBtns) b.visible = playing;
    for (const w of this.handWidgets) w.visible = !portrait && this.phase === 'battle';

    // squad menu
    const squadVisible = this.selectedSquad !== null
      && !portrait
      && this.phase === 'battle'
      && status !== 'finished'
      && !this.hasDialog;
    if (squadVisible) {
      this.refreshSquadMenu();
    }
    this.squadMenu.visible = squadVisible && this.squadMenu.hasOrders;

    // sync audio settings when pause overlay shows
    if (this.pauseOverlay.visible) {
      this.pauseOverlay.syncAudio();
    }

    // clamp camera
    this.camera = clamp(this.camera, 0, Math.max(0, W - this.viewportWidth));
  }

  private rebuildHand(): void {
    const previous = new Map(this.handWidgets.map(w => [w.uid, w]));
    const hand = this.view?.players[0].hand ?? [];
    const next = hand.map(h => previous.get(h.uid) ?? new HandCardWidget(this, h.uid, h.id));
    for (const old of this.handWidgets) if (!next.includes(old)) { old.onTouchCancel(); this.removeChild(old); }
    this.children = this.children.filter(w => !this.handWidgets.includes(w as HandCardWidget));
    this.handWidgets = next;
    for (const w of next) w.parent = this;
    // Cards must stay below squad controls and pause/result/portrait overlays.
    this.children.splice(this.children.indexOf(this.squadMenu), 0, ...next);
    this.layoutHand();
  }

  private refreshSquadMenu(): void {
    if (!this.view || this.selectedSquad === null) return;
    const members = this.view.units.filter(
      (u) => u.side === 0 && u.squad === this.selectedSquad,
    );
    if (members.length === 0) {
      this.selectedSquad = null;
      return;
    }
    const cardDef = CARDS[members[0].id];
    const orders = ordersForUnit(members[0].id);
    const activeOrder = members[0].squadOrder
      ?? (members[0].escortTankUid !== undefined ? 'escort' as SquadOrder : undefined);
    const unitLabel = cardDef.members ? '人' : cardDef.air ? '架' : cardDef.emplacement ? '门' : '辆';
    const caption = `${cardDef.name} · ${members.length}${unitLabel}`;
    const trench = this.view.entrenchments.find((t) => t.squad === this.selectedSquad);
    const progress = trench ? (trench.built ? 1 : trench.progress) : null;
    const progressLabel = trench ? (trench.built ? '阵地就绪' : '修筑阵地') : '';
    this.squadMenu.refresh(orders, activeOrder, caption, progress, progressLabel);
    this.updateSquadMenuPosition(members);
  }

  private updateSquadMenuPosition(members: View['units']): void {
    const squadX = members.reduce((n, u) => n + u.x, 0) / members.length;
    const cardDef = CARDS[members[0].id];
    const squadY = cardDef.air
      ? Math.max(...members.map((u) => u.y)) + 140
      : Math.min(...members.map((u) => unitSelectionBounds(u).y)) - 18;
    const cx = (squadX - this.camera) * this.scale;
    const cy = this.bfY + squadY * this.scale - 8;
    const menuW = this.squadMenu.w;
    const menuH = this.squadMenu.h;
    this.squadMenu.x = clamp(cx - menuW / 2, 4, this.screenW - menuW - 4);
    this.squadMenu.y = clamp(cy - menuH, this.topH + 4, this.screenH - this.bottomH - menuH - 4);
  }

  // ── Drawing ──

  draw(ctx: CanvasRenderingContext2D): void {
    super.draw(ctx);
    // drag ghost on top
    if (this.dragGhost) {
      const data = this.view?.players[0].hand.find((h) => h.uid === this.dragGhost!.uid);
      if (data) {
        ctx.save();
        ctx.globalAlpha = 0.7;
        drawCardFace(ctx, data.id, this.dragGhost.x - this.handCardW / 2,
          this.dragGhost.y - this.handCardW * 0.75, this.handCardW);
        ctx.restore();
        drawTextCentered(ctx, '松手使用 · 拖回手牌区取消',
          this.dragGhost.x, this.dragGhost.y + this.handCardW * 0.85, 9, COLORS.gold);
      }
    }
    // toast on top
    if (this.toastText) {
      const tw = Math.min(300, this.screenW - 20);
      const tx = (this.screenW - tw) / 2;
      const ty = this.bfY + this.bfH / 2 - 14;
      drawPanel(ctx, tx, ty, tw, 28, 'rgba(20,28,20,0.92)', COLORS.border, 4);
      drawTextCentered(ctx, this.toastText, this.screenW / 2, ty + 14, 11, COLORS.text);
    }
  }

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    // background
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.screenW, this.screenH);

    if (!this.view) return;

    this.drawTopHud(ctx);
    this.drawBattlefieldOverlays(ctx);
    this.drawBottomBar(ctx);
  }

  drawBattlefield(ctx: CanvasRenderingContext2D): void {
    if (!this.game || !this.art) return;
    const selCardId = this.selectedCardUid !== null
      ? (this.view?.players[0].hand.find((h) => h.uid === this.selectedCardUid)?.id ?? null)
      : null;
    ctx.save();
    ctx.scale(this.scale, this.scale);
    render(ctx, this.game, this.art, selCardId, this.hoverX, false,
      this.camera, this.viewportWidth, this.selectedSquad);
    ctx.restore();
  }

  private drawTopHud(ctx: CanvasRenderingContext2D): void {
    const view = this.view!;
    const p0 = view.players[0];
    const p1 = view.players[1];
    // bg
    ctx.fillStyle = COLORS.bgPanel;
    ctx.fillRect(0, 0, this.screenW, this.topH);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, this.topH - 0.5);
    ctx.lineTo(this.screenW, this.topH - 0.5);
    ctx.stroke();

    // left: our HP + energy
    const barW = Math.min(120, this.screenW * 0.18);
    drawTextLeft(ctx, '蓝方', 6, 10, 8, COLORS.blue, 'bold');
    drawBar(ctx, 6, 16, barW, 8, p0.hp / MAX_HP, COLORS.hp, COLORS.hpBg);
    drawTextLeft(ctx, `${Math.ceil(p0.hp)}`, 6 + barW + 4, 20, 9, COLORS.text);
    // energy
    const energyX = 6 + barW + 40;
    drawTextLeft(ctx, `${Math.floor(p0.energy)}`, energyX, 10, 12, COLORS.energy, 'bold');
    drawTextLeft(ctx, `/${p0.energyCap}`, energyX + 14, 12, 8, COLORS.textDim);
    // energy pips
    const pipW = 4;
    const pipGap = 2;
    const pipsX = energyX;
    const pipsY = 20;
    const maxPips = Math.min(10, p0.energyCap);
    for (let i = 0; i < maxPips; i++) {
      ctx.fillStyle = i < Math.floor(p0.energy) ? COLORS.energy : COLORS.bgPanelLight;
      ctx.fillRect(pipsX + i * (pipW + pipGap), pipsY, pipW, 6);
    }

    // center: clock
    const remain = Math.max(0, DURATION - view.time);
    const clockText = view.status === 'finished' ? '--:--' : timeString(remain);
    drawTextCentered(ctx, clockText, this.screenW / 2, 12, 13, COLORS.text, 'bold');
    const statusText = view.status === 'playing' ? '作战中'
      : view.status === 'paused' ? '已暂停'
      : view.status === 'finished' ? '已结束' : '准备中';
    drawTextCentered(ctx, statusText, this.screenW / 2, 26, 8, COLORS.textDim);

    // right: enemy HP
    const rBarW = barW;
    const rBarX = this.screenW - 6 - rBarW;
    drawTextRight(ctx, '红方', this.screenW - 6, 10, 8, COLORS.red, 'bold');
    drawBar(ctx, rBarX, 16, rBarW, 8, p1.hp / MAX_HP, COLORS.red, COLORS.hpBg);
    drawTextRight(ctx, `${Math.ceil(p1.hp)}`, rBarX - 4, 20, 9, COLORS.text);
  }

  private drawBattlefieldOverlays(ctx: CanvasRenderingContext2D): void {
    const view = this.view!;
    const p0 = view.players[0];

    // map name + weather (top-left below minimap)
    const mapDef = this.match ? MAPS[this.match.mapId] : null;
    if (mapDef) {
      const label = `${mapDef.name} · ${WEATHER_LABEL[view.weather.kind] ?? view.weather.kind}${view.night ? ' · 夜' : ''}`;
      drawTextLeft(ctx, label, 8, this.bfY + 22, 8, 'rgba(220,230,220,0.7)');
    }

    // buff labels
    let buffY = this.bfY + 34;
    if (p0.morale > 0) {
      drawTextLeft(ctx, `士气鼓舞 · ${Math.ceil(p0.morale)}s`, 8, buffY, 8, COLORS.gold);
      buffY += 12;
    }
    if (p0.recon > 0) {
      drawTextLeft(ctx, `校射 +20% · ${Math.ceil(p0.recon)}s`, 8, buffY, 8, COLORS.gold);
      buffY += 12;
    }

    // enemy jam
    if (p0.jam > 0) {
      drawTextLeft(ctx, `通讯干扰 ${Math.ceil(p0.jam)}s`, 8, buffY, 8, COLORS.red);
      buffY += 12;
    }

    // casualty readout
    const wounded = view.units.filter((u) => u.side === 0 && u.wounded && u.hp > 0).length;
    if (wounded > 0) {
      drawTextLeft(ctx, `伤员 ${wounded} 人 · 军医可靠近救起 / 急救卡可治疗`,
        8, this.bfY + this.bfH - 8, 8, COLORS.red);
    }

    // ticker (battle communications)
    const notices = view.notices;
    if (notices.length > 0) {
      const last = notices[notices.length - 1];
      const age = view.time - last.time;
      if (age < 5) {
        const alpha = age > 4 ? (5 - age) : 1;
        ctx.save();
        ctx.globalAlpha = alpha;
        const tw = Math.min(360, this.screenW - 20);
        const tx = (this.screenW - tw) / 2;
        const ty = this.bfY + this.bfH - 24;
        drawPanel(ctx, tx, ty, tw, 18, 'rgba(20,28,20,0.7)', COLORS.border, 3);
        const color = last.kind === 'good' ? COLORS.green : last.kind === 'warn' ? COLORS.red : COLORS.text;
        drawTextCentered(ctx, last.text, this.screenW / 2, ty + 9, 9, color);
        ctx.restore();
      }
    }

    // drag hint
    if (this.phase === 'battle' && this.game!.status === 'playing' && !this.selectedCardUid) {
      drawTextCentered(ctx, '← 左右滑动战场 →', this.screenW / 2, this.bfY + this.bfH - 8, 8, 'rgba(220,230,220,0.4)');
    }
  }

  private drawBottomBar(ctx: CanvasRenderingContext2D): void {
    const view = this.view!;
    const p0 = view.players[0];
    const barY = this.screenH - this.bottomH;
    // bg
    ctx.fillStyle = COLORS.bgPanel;
    ctx.fillRect(0, barY, this.screenW, this.bottomH);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, barY + 0.5);
    ctx.lineTo(this.screenW, barY + 0.5);
    ctx.stroke();

    // command panel info (right side, above deck button)
    const infoX = this.screenW - 200;
    const infoW = 140;
    drawTextLeft(ctx, `指挥点 ${Math.floor(p0.energy)}/${p0.energyCap}`, infoX, barY + 28, 9, COLORS.energy, 'bold');
    const unitCount = view.units.filter((u) => u.side === 0 && !u.destroyed).length;
    drawTextLeft(ctx, `在场部队 ${unitCount}`, infoX, barY + 40, 8, COLORS.textDim);
    // selected card hint or default hint
    let hint = '拖出手牌并松手下令 · 长按查看详情';
    if (this.selectedCardUid !== null) {
      const card = view.players[0].hand.find((h) => h.uid === this.selectedCardUid);
      if (card) {
        const def = CARDS[card.id];
        if (def.targetGround) hint = '拖出手牌区，以松手位置为目标';
        else if (def.type === 'unit') hint = '拖出手牌区松手，从己方基地入场';
        else hint = '拖出手牌区松手使用';
      }
    }
    const hintLines = wrapText(ctx, hint, infoW, 8);
    let hy = barY + 54;
    for (const ln of hintLines) {
      drawTextLeft(ctx, ln, infoX, hy, 8, COLORS.textDim);
      hy += 11;
    }

    // hand section title
    drawTextLeft(ctx, `战术手牌 ${p0.hand.length}/${MAX_HAND}`, 8, barY + 28, 8, COLORS.textDim);
    if (p0.hand.length >= MAX_HAND) {
      drawTextLeft(ctx, '手牌已满 · 打出卡牌腾出空位', 8, barY + 40, 8, COLORS.red);
    }

    // order description (below order buttons)
    const orderDesc = ORDER_DESC[p0.order] ?? '';
    drawTextLeft(ctx, orderDesc, 8, barY + 40, 8, COLORS.textDim);

    // footer
    drawTextLeft(ctx, 'GREYLINE 林间前线 · v180', 8, this.screenH - 6, 7, COLORS.textMuted);
  }

  drawMinimap(ctx: CanvasRenderingContext2D): void {
    const view = this.view;
    if (!view) return;
    const w = this.minimap.w;
    const h = this.minimap.h;
    // bg
    ctx.fillStyle = 'rgba(10,16,10,0.7)';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = COLORS.border;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(0, 0, w, h);
    const scaleX = w / W;
    // walls
    ctx.fillStyle = 'rgba(150,160,150,0.5)';
    for (const wall of view.walls) {
      ctx.fillRect(wall.x * scaleX, 2, Math.max(1, wall.width * scaleX), h - 4);
    }
    // units
    for (const u of view.units) {
      if (u.destroyed) continue;
      ctx.fillStyle = u.side === 0 ? COLORS.blue : COLORS.red;
      ctx.fillRect(u.x * scaleX - 1, 3, 2, h - 6);
    }
    // camera window
    const camX = this.camera * scaleX;
    const camW = this.viewportWidth * scaleX;
    ctx.strokeStyle = COLORS.gold;
    ctx.lineWidth = 1;
    ctx.strokeRect(camX, 1, camW, h - 2);
  }

  drawHandCard(ctx: CanvasRenderingContext2D, w: HandCardWidget): void {
    const data = this.view?.players[0].hand.find((h) => h.uid === w.uid);
    if (!data) return;
    const unavailable = data.readyIn > 0 || data.cost > this.getEnergy();
    const selected = this.selectedCardUid === w.uid;
    ctx.save();
    if (unavailable) ctx.globalAlpha = 0.45;
    drawCardFace(ctx, w.cardId, 0, 0, w.w);
    if (selected) {
      ctx.strokeStyle = COLORS.gold;
      ctx.lineWidth = 2;
      ctx.strokeRect(-1, -1, w.w + 2, w.h + 2);
    }
    if (data.readyIn > 0) {
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(0, 0, w.w, w.h);
      drawTextCentered(ctx, `${Math.ceil(data.readyIn)}s`, w.w / 2, w.h / 2, 12, COLORS.text, 'bold');
    }
    ctx.restore();
  }

  // ── Interactions ──

  getEnergy(): number {
    return this.view?.players[0].energy ?? 0;
  }

  moveCamera(x: number): void {
    this.camera = clamp(x, 0, Math.max(0, W - this.viewportWidth));
  }

  selectSquad(squad: number | null): void {
    this.selectedSquad = squad;
    if (squad !== null && this.game) {
      const result = selectUnitGroup(this.game, 0, squad);
      if (!result.ok && result.message) this.toast(result.message);
    }
    this.syncFromView();
  }

  onSquadOrder(order: SquadOrder): void {
    if (!this.game || this.selectedSquad === null) return;
    const result = setSquadOrder(this.game, 0, this.selectedSquad, order);
    if (!result.ok && result.message) this.toast(result.message);
    this.refreshView();
  }

  onBattlefieldTap(lx: number, ly: number): void {
    if (!this.game || !this.view) return;
    this.unlockAudio();
    const worldX = this.camera + lx / this.scale;
    const worldY = (ly / this.battlefield.h) * H;

    // if a card is selected, play it
    if (this.selectedCardUid !== null) {
      const uid = this.selectedCardUid;
      this.selectedCardUid = null;
      this.hoverX = null;
      this.executeCard(uid, worldX);
      return;
    }

    // otherwise, try to select a squad
    if (this.game.status !== 'playing') return;
    const found = pickSquad(this.game, 0, worldX, worldY, true);
    if (found !== null) {
      if (found === this.selectedSquad) {
        this.selectSquad(null);
      } else {
        this.selectSquad(found);
      }
    } else {
      this.selectSquad(null);
    }
  }

  // ── Card gestures ──

  onCardGestureDown(w: HandCardWidget, lx: number, ly: number): void {
    this.unlockAudio();
    this.pressUid = w.uid;
    this.pressStart = Date.now();
    this.pressSX = w.absX + lx;
    this.pressSY = w.absY + ly;
    this.longPressFired = false;
    this.cardDragging = false;
  }

  onCardGestureMove(w: HandCardWidget, lx: number, ly: number): void {
    if (this.pressUid !== w.uid) return;
    const sx = w.absX + lx;
    const sy = w.absY + ly;
    if (!this.cardDragging) {
      const dx = sx - this.pressSX;
      const dy = sy - this.pressSY;
      if (Math.abs(dx) > 8 || Math.abs(dy) > 8) {
        this.cardDragging = true;
        this.selectedCardUid = w.uid;
        this.heldClickUid = null;
        const hand = this.view?.players[0].hand.find((h) => h.uid === w.uid);
        if (hand && needsTarget(hand.id)) {
          this.hoverX = this.camera + this.viewportWidth * 0.6;
        }
      }
    }
    if (this.cardDragging) {
      this.dragGhost = { uid: w.uid, x: sx, y: sy };
      // update hover if needs target
      const hand = this.view?.players[0].hand.find((h) => h.uid === w.uid);
      if (hand && needsTarget(hand.id)) {
        const worldX = this.camera + sx / this.scale;
        this.hoverX = clamp(worldX, 0, W);
      }
    }
  }

  onCardGestureUp(w: HandCardWidget, lx: number, ly: number): void {
    if (this.pressUid !== w.uid) return;
    this.pressUid = null;
    const sx = w.absX + lx;
    const sy = w.absY + ly;

    // suppress click after long press
    if (this.heldClickUid === w.uid) {
      this.heldClickUid = null;
      this.dragGhost = null;
      this.cardDragging = false;
      return;
    }

    if (this.longPressFired) {
      this.longPressFired = false;
      this.dragGhost = null;
      this.cardDragging = false;
      return;
    }

    if (this.cardDragging) {
      this.dragGhost = null;
      this.cardDragging = false;
      // check if released outside hand area
      if (this.battlefield.contains(sx, sy) && !this.hasDialog) {
        // played!
        const hand = this.view?.players[0].hand.find((h) => h.uid === w.uid);
        const worldX = hand && needsTarget(hand.id)
          ? clamp(this.camera + sx / this.scale, 0, W)
          : undefined;
        this.selectedCardUid = null;
        this.hoverX = null;
        this.executeCard(w.uid, worldX);
      } else {
        // cancelled — released inside hand area
        this.selectedCardUid = null;
        this.hoverX = null;
      }
    } else {
      // tap — toggle select
      if (this.selectedCardUid === w.uid) {
        this.selectedCardUid = null;
        this.hoverX = null;
      } else {
        this.selectedCardUid = w.uid;
        const hand = this.view?.players[0].hand.find((h) => h.uid === w.uid);
        if (hand && needsTarget(hand.id)) {
          this.hoverX = this.camera + this.viewportWidth * 0.6;
        } else {
          this.hoverX = null;
        }
      }
    }
  }

  onCardGestureCancel(w: HandCardWidget): void {
    if (this.pressUid === w.uid) {
      this.pressUid = null;
      this.dragGhost = null;
      this.cardDragging = false;
      this.selectedCardUid = null;
      this.hoverX = null;
      this.heldClickUid = null;
      this.longPressFired = false;
    }
  }

  private checkLongPress(): void {
    if (this.pressUid === null || this.longPressFired || this.cardDragging) return;
    if (Date.now() - this.pressStart > 450) {
      this.longPressFired = true;
      this.heldClickUid = this.pressUid;
      const uid = this.pressUid;
      const hand = this.view?.players[0].hand.find((h) => h.uid === uid);
      if (hand) {
        this.showDialog(new CardDetailDialog(hand.id, () => this.closeDialog()));
      }
    }
  }

  private executeCard(uid: number, x?: number): void {
    if (!this.game) return;
    const hand = this.game.players[0].hand.find((h) => h.uid === uid);
    const entryOrTarget = hand && needsTarget(hand.id) ? x : undefined;
    const result = playCard(this.game, 0, uid, entryOrTarget);
    if (result.ok) {
      this.selectedCardUid = null;
      this.hoverX = null;
    } else if (result.message) {
      this.toast(result.message);
    }
    this.refreshView();
  }

  onDrawCard(): void {
    if (!this.game) return;
    this.unlockAudio();
    const result = requestDraw(this.game, 0);
    if (result.message) this.toast(result.message);
    this.refreshView();
  }

  onSetOrder(order: Order): void {
    if (!this.game) return;
    setOrder(this.game, 0, order);
    this.refreshView();
  }

  onTogglePause(): void {
    if (!this.game) return;
    this.cancelTouches();
    this.selectedCardUid = null;
    this.hoverX = null;
    if (this.game.status === 'playing') {
      this.game.status = 'paused';
    } else if (this.game.status === 'paused') {
      this.game.status = 'playing';
    }
    this.syncFromView();
  }

  onResume(): void {
    if (!this.game) return;
    this.cancelTouches();
    this.game.status = 'playing';
    this.syncFromView();
  }

  onReset(): void {
    if (!this.match) return;
    if (this.match.missionId) {
      lobbyState.begin(undefined, this.match.missionId);
    } else {
      this.configure(this.match);
    }
  }

  onNextMission(): void {
    if (!this.match?.missionId) return;
    const idx = MISSIONS.findIndex((m) => m.id === this.match!.missionId);
    const next = MISSIONS[idx + 1];
    if (next) {
      lobbyState.begin(undefined, next.id);
    }
  }

  onStartBattle(): void {
    if (!this.artLoaded) return;
    const mission = this.match?.missionId ? missionById(this.match.missionId) : null;
    if (mission && mission.openingDialogue.length > 0) {
      this.phase = 'dialogue';
      this.dialogueIndex = 0;
      if (this.game) this.game.status = 'paused';
    } else {
      if (this.game) startGame(this.game);
      this.phase = 'battle';
    }
    this.syncFromView();
  }

  onAdvanceDialogue(): void {
    const mission = this.match?.missionId ? missionById(this.match.missionId) : null;
    if (!mission) return;
    if (this.dialogueIndex >= mission.openingDialogue.length - 1) {
      this.onCloseDialogue();
    } else {
      this.dialogueIndex++;
    }
  }

  onCloseDialogue(): void {
    this.phase = 'battle';
    if (this.game) {
      startGame(this.game);
      this.game.status = 'playing';
    }
    this.syncFromView();
  }

  onExitToLobby(): void {
    this.router.navigate('lobby');
  }

  onShowGuide(): void {
    this.showDialog(new GuideWidget(this));
  }

  onShowDeckList(): void {
    this.showDialog(new DeckListWidget(this));
  }

  private toast(text: string): void {
    this.toastText = text;
    this.toastUntil = Date.now() + 2800;
  }

  private refreshView(): void {
    if (!this.game) return;
    this.view = snapshot(this.game, 0);
    this.syncFromView();
  }

  private unlockAudio(): void {
    if (!this.audioUnlocked) {
      this.audioUnlocked = true;
      getBattleAudio().unlock();
    }
  }
}
