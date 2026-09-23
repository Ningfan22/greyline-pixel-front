/**
 * Lobby screen: sidebar navigation + home / campaign / settings / guide
 * subpages. Replaces app/home-menu.tsx + campaign-menu.tsx + settings.
 */

import {
  Screen,
  Button,
  Slider,
  Toggle,
  type Widget,
  type Router,
  type TouchEvent,
} from './framework';
import {
  COLORS,
  LAYOUT,
  clamp,
  drawPanel,
  drawTextCentered,
  drawTextLeft,
  drawTextRight,
  drawWrapped,
  font,
  measureText,
  roundRect,
} from './theme';
import { lobbyState } from '../lobby-state';
import { MISSIONS, type MissionId } from '@/game/campaign';
import { MAP_IDS, MAPS, type MapId } from '@/game/maps';
import type { Difficulty } from '@/game/economy';
import { assetUrl } from '@/game/asset-url';
import { getBattleAudio } from '@/game/audio';

const DIFFICULTY_LABEL: Record<Difficulty, string> = {
  standard: '标准',
  veteran: '老练',
  elite: '精锐',
};
const DIFFICULTY_BONUS: Record<Difficulty, string> = {
  standard: '双方同速回点',
  veteran: 'AI 回点速度 +15%',
  elite: 'AI 回点速度 +30%',
};

type LobbyPage = 'home' | 'campaign' | 'settings' | 'guide';

const SIDEBAR_W = 168;

export class LobbyScreen extends Screen {
  private router: Router;
  private subpage: LobbyPage = 'home';
  private selectedMission: MissionId;
  private homeBg: HTMLImageElement | null = null;
  private missionBg: HTMLImageElement | null = null;
  private missionBgUrl = '';
  private toastMsg = '';
  private toastTime = 0;
  private scrollY = 0;
  private scrollMax = 0;
  private scrollTouchId = -1;
  private scrollStartY = 0;
  private scrollStartScroll = 0;
  private audioUnlocked = false;

  // Sidebar widgets
  private navButtons: Button[] = [];
  private mapBtn!: Button;
  private nightBtn!: Button;
  private diffBtn!: Button;
  private startBtn!: Button;

  constructor(screenW: number, screenH: number, router: Router) {
    super(screenW, screenH);
    this.router = router;
    this.selectedMission =
      MISSIONS.find((m) => !lobbyState.completed.includes(m.id))?.id ??
      MISSIONS[0].id;
    this.buildSidebar();
    this.buildContent();
    this.loadHomeBg();
  }

  // ── Layout helpers ──────────────────────────────────────────────────────

  private contentX(): number {
    return SIDEBAR_W;
  }
  private contentW(): number {
    return this.screenW - SIDEBAR_W;
  }

  // ── Sidebar ─────────────────────────────────────────────────────────────

  private buildSidebar(): void {
    const nav: { page: LobbyPage | 'builder' | 'shop'; label: string }[] = [
      { page: 'home', label: '首页' },
      { page: 'campaign', label: '故事战役' },
      { page: 'builder', label: '卡组' },
      { page: 'shop', label: '商店' },
      { page: 'settings', label: '设置' },
      { page: 'guide', label: '作战手册' },
    ];
    let y = 64;
    for (const item of nav) {
      const btn = new Button(item.label, SIDEBAR_W - 16, 32, {
        fontSize: 13,
        bg: COLORS.bgPanel,
      });
      btn.x = 8;
      btn.y = y;
      btn.onTap = () => {
        if (item.page === 'builder') this.router.navigate('deck-builder');
        else if (item.page === 'shop') this.router.navigate('shop');
        else this.setSubpage(item.page as LobbyPage);
      };
      this.addChild(btn);
      this.navButtons.push(btn);
      y += 36;
    }

    y += 4;
    this.mapBtn = new Button('', SIDEBAR_W - 16, 44, { fontSize: 11 });
    this.mapBtn.x = 8;
    this.mapBtn.y = y;
    this.mapBtn.onTap = () => {
      const idx = MAP_IDS.indexOf(lobbyState.mapId);
      const next = MAP_IDS[(idx + 1) % MAP_IDS.length];
      lobbyState.setMap(next);
      this.refreshSidebarLabels();
    };
    this.addChild(this.mapBtn);
    y += 50;

    this.nightBtn = new Button('', SIDEBAR_W - 16, 40, { fontSize: 11 });
    this.nightBtn.x = 8;
    this.nightBtn.y = y;
    this.nightBtn.onTap = () => {
      lobbyState.setNight(!lobbyState.night);
      this.refreshSidebarLabels();
    };
    this.addChild(this.nightBtn);
    y += 46;

    this.diffBtn = new Button('', SIDEBAR_W - 16, 40, { fontSize: 11 });
    this.diffBtn.x = 8;
    this.diffBtn.y = y;
    this.diffBtn.onTap = () => this.setSubpage('settings');
    this.addChild(this.diffBtn);

    this.refreshSidebarLabels();
  }

  private refreshSidebarLabels(): void {
    const map = MAPS[lobbyState.mapId];
    this.mapBtn.label = `地图: ${map.name}`;
    this.nightBtn.label = lobbyState.night ? '时段: 夜间' : '时段: 昼间';
    this.diffBtn.label = `对手: ${DIFFICULTY_LABEL[lobbyState.difficulty]}`;
  }

  // ── Content pages ───────────────────────────────────────────────────────

  private setSubpage(page: LobbyPage): void {
    this.subpage = page;
    this.scrollY = 0;
    this.buildContent();
    // Map/night selectors hidden on campaign (mission defines its own map)
    this.mapBtn.visible = page !== 'campaign';
    this.nightBtn.visible = page !== 'campaign';
  }

  private clearContent(): void {
    const keep = new Set<Widget>([
      ...this.navButtons,
      this.mapBtn,
      this.nightBtn,
      this.diffBtn,
    ]);
    for (const c of [...this.children]) {
      if (!keep.has(c)) this.removeChild(c);
    }
  }

  private buildContent(): void {
    this.clearContent();
    if (this.subpage === 'home') this.buildHome();
    else if (this.subpage === 'settings') this.buildSettings();
    else if (this.subpage === 'campaign') this.buildCampaign();
    // guide is pure text, drawn in drawSelf
  }

  private buildHome(): void {
    this.startBtn = new Button('开始游戏', 220, 56, {
      fontSize: 20,
      bold: true,
      bg: COLORS.accent,
      bgPressed: COLORS.accentDark,
      textColor: '#1a1f1a',
      border: COLORS.accentDark,
      radius: 6,
    });
    this.startBtn.x = this.contentX() + (this.contentW() - 220) / 2;
    this.startBtn.y = this.screenH - 96;
    this.startBtn.onTap = () => {
      const err = lobbyState.begin();
      if (err) this.toast(err);
    };
    this.addChild(this.startBtn);
  }

  private buildSettings(): void {
    const x = this.contentX() + 24;
    let y = 24;

    // Difficulty buttons
    const diffs: Difficulty[] = ['standard', 'veteran', 'elite'];
    const bw = 150;
    for (const d of diffs) {
      const btn = new Button(
        `${DIFFICULTY_LABEL[d]}\n${DIFFICULTY_BONUS[d]}`,
        bw,
        52,
        {
          fontSize: 12,
          bg:
            lobbyState.difficulty === d ? COLORS.green : COLORS.bgPanelLight,
          border:
            lobbyState.difficulty === d ? COLORS.greenLight : COLORS.border,
        },
      );
      btn.x = x + diffs.indexOf(d) * (bw + 10);
      btn.y = y;
      const dd = d;
      btn.onTap = () => {
        lobbyState.setDifficulty(dd);
        this.buildContent();
        this.refreshSidebarLabels();
      };
      this.addChild(btn);
    }
    y += 66;

    // Sound toggle
    const audio = getBattleAudio().settings;
    const toggle = new Toggle(44, 22, audio.enabled);
    toggle.x = x;
    toggle.y = y;
    toggle.onChange = (v) => {
      getBattleAudio().configure({ enabled: v });
    };
    this.addChild(toggle);
    y += 36;

    // Music volume
    const musicSlider = new Slider(260, 24, audio.music);
    musicSlider.x = x;
    musicSlider.y = y;
    musicSlider.onChange = (v) => {
      getBattleAudio().configure({ music: v });
    };
    this.addChild(musicSlider);
    y += 36;

    // SFX volume
    const sfxSlider = new Slider(260, 24, audio.effects);
    sfxSlider.x = x;
    sfxSlider.y = y;
    sfxSlider.onChange = (v) => {
      getBattleAudio().configure({ effects: v });
    };
    this.addChild(sfxSlider);
  }

  private buildCampaign(): void {
    const x = this.contentX() + 16;
    let y = 16;
    for (let i = 0; i < MISSIONS.length; i++) {
      const m = MISSIONS[i];
      const done = lobbyState.completed.includes(m.id);
      const unlocked = lobbyState.isMissionUnlocked(i);
      const btn = new Button(
        `${m.chapter} ${m.title}  ${done ? '✓' : unlocked ? '' : '🔒'}`,
        150,
        40,
        {
          fontSize: 11,
          bg:
            this.selectedMission === m.id
              ? COLORS.green
              : COLORS.bgPanel,
        },
      );
      btn.x = x;
      btn.y = y;
      btn.enabled = unlocked;
      btn.onTap = () => {
        this.selectedMission = m.id;
        this.buildContent();
      };
      this.addChild(btn);
      y += 46;
    }

    // Start button
    const idx = MISSIONS.findIndex((m) => m.id === this.selectedMission);
    const unlocked = lobbyState.isMissionUnlocked(idx);
    const startBtn = new Button(
      unlocked ? '进入战役 →' : '完成上一章后解锁',
      170,
      40,
      {
        fontSize: 13,
        bold: true,
        bg: unlocked ? COLORS.accent : COLORS.bgPanelLight,
        textColor: unlocked ? '#1a1f1a' : COLORS.textMuted,
      },
    );
    startBtn.x = x;
    startBtn.y = y + 8;
    startBtn.enabled = unlocked;
    startBtn.onTap = () => {
      const err = lobbyState.begin(undefined, this.selectedMission);
      if (err) this.toast(err);
    };
    this.addChild(startBtn);
  }

  // ── Images ──────────────────────────────────────────────────────────────

  private loadHomeBg(): void {
    const img = new Image();
    img.onload = () => {
      this.homeBg = img;
    };
    img.src = assetUrl('/art/home-camp-v14.png');
  }

  private loadMissionBg(url: string): void {
    if (this.missionBgUrl === url) return;
    this.missionBgUrl = url;
    this.missionBg = null;
    const img = new Image();
    img.onload = () => {
      if (this.missionBgUrl === url) this.missionBg = img;
    };
    img.src = assetUrl(url);
  }

  // ── Toast ───────────────────────────────────────────────────────────────

  private toast(msg: string): void {
    this.toastMsg = msg;
    this.toastTime = Date.now();
  }

  // ── Lifecycle ───────────────────────────────────────────────────────────

  onEnter(): void {
    this.refreshSidebarLabels();
    this.buildContent();
    const mixer = getBattleAudio();
    mixer.prefetch();
    mixer.setActive(true);
  }

  handleTouch(ev: TouchEvent): boolean {
    if (!this.audioUnlocked && ev.type === 'down') {
      this.audioUnlocked = true;
      void getBattleAudio().unlock();
      getBattleAudio().setActive(true);
    }
    if (super.handleTouch(ev)) return true;
    // Content scrolling for guide / campaign text
    if (this.subpage !== 'guide' && this.subpage !== 'campaign')
      return false;
    const p = ev.changed[0];
    if (!p || p.x < this.contentX()) return false;
    if (ev.type === 'down') {
      this.scrollTouchId = p.id;
      this.scrollStartY = p.y;
      this.scrollStartScroll = this.scrollY;
      return true;
    }
    if (ev.type === 'move' && this.scrollTouchId === p.id) {
      this.scrollY = clamp(
        this.scrollStartScroll - (p.y - this.scrollStartY),
        0,
        this.scrollMax,
      );
      return true;
    }
    if (ev.type === 'up' && this.scrollTouchId === p.id) {
      this.scrollTouchId = -1;
      return true;
    }
    return false;
  }

  // ── Drawing ─────────────────────────────────────────────────────────────

  protected drawSelf(ctx: CanvasRenderingContext2D): void {
    // Background
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, this.screenW, this.screenH);

    this.drawSidebar(ctx);

    const cx = this.contentX();
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx, 0, this.contentW(), this.screenH);
    ctx.clip();
    ctx.translate(0, -this.scrollY);

    if (this.subpage === 'home') this.drawHome(ctx);
    else if (this.subpage === 'guide') this.drawGuide(ctx);
    else if (this.subpage === 'campaign') this.drawCampaignBrief(ctx);
    // settings widgets draw themselves; draw labels here
    if (this.subpage === 'settings') this.drawSettingsLabels(ctx);

    ctx.restore();

    // Toast
    if (this.toastMsg && Date.now() - this.toastTime < 3000) {
      const alpha = Math.min(1, (3000 - (Date.now() - this.toastTime)) / 500);
      ctx.globalAlpha = alpha;
      const w = measureText(ctx, this.toastMsg, 13) + 32;
      const x = this.screenW / 2 - w / 2;
      const y = this.screenH - 60;
      drawPanel(ctx, x, y, w, 32, COLORS.overlay, COLORS.accent);
      drawTextCentered(ctx, this.toastMsg, this.screenW / 2, y + 16, 13);
      ctx.globalAlpha = 1;
    }
  }

  private drawSidebar(ctx: CanvasRenderingContext2D): void {
    drawPanel(ctx, 0, 0, SIDEBAR_W, this.screenH, COLORS.bgPanel, COLORS.border);
    // Brand
    drawTextLeft(ctx, '灰线', 12, 20, 20, COLORS.accent, 'bold');
    drawTextLeft(ctx, 'GREYLINE · v181', 12, 40, 9, COLORS.textDim);
    // Gold + deck status at bottom
    const gold = lobbyState.collection.gold;
    drawTextLeft(ctx, `金币 ${gold}`, 12, this.screenH - 44, 12, COLORS.gold);
    drawTextLeft(
      ctx,
      `当前编队 ${lobbyState.deck.length}/20`,
      12,
      this.screenH - 24,
      12,
      lobbyState.deck.length === 20 ? COLORS.greenLight : COLORS.redLight,
    );
  }

  private drawHome(ctx: CanvasRenderingContext2D): void {
    const cx = this.contentX();
    const cw = this.contentW();
    if (this.homeBg) {
      // Cover fit
      const imgRatio = this.homeBg.width / this.homeBg.height;
      const boxRatio = cw / this.screenH;
      let dw = cw;
      let dh = this.screenH;
      let dx = cx;
      let dy = 0;
      if (imgRatio > boxRatio) {
        dw = this.screenH * imgRatio;
        dx = cx - (dw - cw) / 2;
      } else {
        dh = cw / imgRatio;
        dy = -(dh - this.screenH) / 2;
      }
      ctx.drawImage(this.homeBg, dx, dy, dw, dh);
    }
    // Title
    drawTextCentered(
      ctx,
      '灰线 · 现代战争像素对战',
      cx + cw / 2,
      48,
      22,
      COLORS.text,
      'bold',
    );
  }

  private drawGuide(ctx: CanvasRenderingContext2D): void {
    const cx = this.contentX() + 20;
    const cw = this.contentW() - 40;
    let y = 20;
    drawTextLeft(ctx, '作战手册', cx, y, 20, COLORS.accent, 'bold');
    y += 36;
    const sections: [string, string][] = [
      [
        '胜利条件',
        '摧毁敌方指挥部。十分钟后仍未分出胜负，则比较双方基地剩余生命。',
      ],
      [
        '出牌与抽牌',
        '把卡牌拖出底部扇形区域后松手，即可使用；拖回则取消。长按查看详情。单位从己方基地出发，烟幕、地雷和机降落点使用松手位置。机降直升机会飞抵落点后放下步兵，途中可被防空击落。\n点击牌堆，消耗 2 点指挥点抽牌，冷却 9 秒。手牌最多 6 张。\n双方开局 2 点，每 3.6 秒恢复 1 点。后勤可加快回点，扩编可增加上限；难度设置会注明 AI 的额外回点速度。',
      ],
      [
        '查看战场',
        '左右拖动画面移动视野。手机横屏游玩。',
      ],
      [
        '机步协同',
        '步兵会自动伴随附近友军坦克，保持后方距离。点击小队可选择伴随、据守、撤退、进攻或警戒；手动进攻会解除伴随。缺少有效反甲或防空保护时，步兵会持续撤离重装火力范围。',
      ],
      [
        '组建编队',
        '在卡组中选择 20 张牌，每种卡各有数量上限。带上反坦克与防空兵种；AI 使用自己的卡组，双方各抽各的。',
      ],
    ];
    for (const [title, body] of sections) {
      drawTextLeft(ctx, title, cx, y, 14, COLORS.greenLight, 'bold');
      y += 22;
      y = drawWrapped(ctx, body, cx, y, cw, 12, COLORS.text, 'normal', 19) + 12;
    }
    this.scrollMax = Math.max(0, y - this.screenH);
  }

  private drawCampaignBrief(ctx: CanvasRenderingContext2D): void {
    const idx = MISSIONS.findIndex((m) => m.id === this.selectedMission);
    const m = MISSIONS[idx];
    const cx = this.contentX() + 180;
    const cw = this.contentW() - 200;
    let y = 16;

    drawTextLeft(
      ctx,
      '故事战役 · 六章 — 断线之地',
      cx,
      y,
      16,
      COLORS.accent,
      'bold',
    );
    y += 28;

    // Landscape image
    this.loadMissionBg(MAPS[m.mapId].backgroundAsset);
    const imgH = Math.min(110, this.screenH * 0.3);
    if (this.missionBg) {
      ctx.drawImage(this.missionBg, cx, y, cw, imgH);
    } else {
      drawPanel(ctx, cx, y, cw, imgH, COLORS.bgPanelLight, COLORS.border);
    }
    drawTextLeft(ctx, m.region, cx + 8, y + 14, 11, COLORS.text, 'bold');
    drawTextLeft(ctx, m.title, cx + 8, y + 30, 15, COLORS.text, 'bold');
    y += imgH + 12;

    y = drawWrapped(ctx, m.briefing, cx, y, cw, 12, COLORS.text) + 10;
    drawTextLeft(ctx, `任务: ${m.goal}`, cx, y, 12, COLORS.greenLight, 'bold');
    y += 20;
    y =
      drawWrapped(ctx, `已知部署: ${m.preparation}`, cx, y, cw, 11, COLORS.textDim) +
      10;
    drawTextLeft(
      ctx,
      `${DIFFICULTY_LABEL[lobbyState.difficulty]} · ${DIFFICULTY_BONUS[lobbyState.difficulty]}`,
      cx,
      y,
      11,
      COLORS.textDim,
    );
    y += 18;
    drawTextLeft(
      ctx,
      '使用当前20张编队 · 战役进度保存在本机 · 进场先听无线电简报',
      cx,
      y,
      10,
      COLORS.textMuted,
    );
    y += 16;
    this.scrollMax = Math.max(0, y - this.screenH);
  }

  private drawSettingsLabels(ctx: CanvasRenderingContext2D): void {
    const x = this.contentX() + 24;
    drawTextLeft(ctx, '对手难度', x, 14, 14, COLORS.accent, 'bold');
    drawTextLeft(
      ctx,
      '双方开局均为 2 点指挥点。资源优势只影响 AI 回点速度。',
      x,
      100,
      11,
      COLORS.textDim,
    );
    drawTextLeft(ctx, '游戏声音', x, 128, 13, COLORS.text);
    const audio = getBattleAudio().settings;
    drawTextLeft(
      ctx,
      `音乐音量 ${Math.round(audio.music * 100)}%`,
      x + 320,
      152,
      12,
      COLORS.text,
    );
    drawTextLeft(
      ctx,
      `音效音量 ${Math.round(audio.effects * 100)}%`,
      x + 320,
      188,
      12,
      COLORS.text,
    );
    drawTextLeft(
      ctx,
      '自动保存，进入战场后同样生效。',
      x,
      224,
      11,
      COLORS.textDim,
    );
  }
}
