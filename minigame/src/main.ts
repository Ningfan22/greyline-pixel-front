/**
 * Mini-game entry point: boots the adapter, sets up the main canvas,
 * routes touch events into the UI framework, and runs the main loop.
 */

import { initAdapter, loadPixelFont, getMainCanvas } from './adapter';
import { Router, type TouchEvent, type TouchPoint } from './ui/framework';
import { lobbyState } from './lobby-state';
import { LobbyScreen } from './ui/lobby';
import { DeckBuilderScreen } from './ui/deck-builder';
import { ShopScreen } from './ui/shop';
import { BattleScreen } from './ui/battle';
import { preloadAllCardArt } from './ui/card-render';

declare const tt: any;

/**
 * CDN base URL for art assets.
 *
 * 美术资源（约 26MB WebP）不上传主包，运行时从此 CDN 地址下载。
 * 上线前把 minigame-cdn/ 目录上传到你的 CDN，然后把下面的地址改成
 * 你的 CDN 地址（以 / 结尾）。
 *
 * 留空则从本地包内加载（仅开发调试用，需要把 art 目录也放进包）。
 */
const ART_CDN_BASE = 'https://cdn.example.com/pixel-frontline/';

/**
 * BGM 等大音频文件的 CDN 地址。与美术资源同一个 CDN 即可，
 * 把 minigame-cdn/audio/ 目录上传到 CDN 后自动生效。
 */
const AUDIO_CDN_BASE = ART_CDN_BASE;

function toPoints(list: any): TouchPoint[] {
  if (!list) return [];
  const out: TouchPoint[] = [];
  for (const t of list) {
    out.push({
      id: t.identifier ?? 0,
      x: t.clientX,
      y: t.clientY,
    });
  }
  return out;
}

export function boot(): void {
  initAdapter();

  // Route art loads to the CDN (WebP versions).
  if (ART_CDN_BASE) {
    (globalThis as { __ART_CDN_BASE__?: string }).__ART_CDN_BASE__ = ART_CDN_BASE;
  }
  if (AUDIO_CDN_BASE) {
    (globalThis as { __AUDIO_CDN_BASE__?: string }).__AUDIO_CDN_BASE__ = AUDIO_CDN_BASE;
  }

  const fontFamily = loadPixelFont();

  const canvas = getMainCanvas();
  const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
  const info = tt.getSystemInfoSync();
  const screenW = info.windowWidth;
  const screenH = info.windowHeight;
  const pixelRatio = info.pixelRatio || 1;
  ctx.scale(pixelRatio, pixelRatio);

  // ── Router + screens ──
  const router = new Router();
  const lobby = new LobbyScreen(screenW, screenH, router);
  const builder = new DeckBuilderScreen(screenW, screenH, router);
  const shop = new ShopScreen(screenW, screenH, router);
  const battle = new BattleScreen(screenW, screenH, router);

  router.register('lobby', lobby);
  router.register('deck-builder', builder);
  router.register('shop', shop);
  router.register('battle', battle);

  lobbyState.onBattle = () => {
    battle.configure(lobbyState.match!);
    router.navigate('battle');
  };

  router.navigate('lobby');

  // ── Touch routing ──
  const activeTouches = new Map<number, TouchPoint>();

  const dispatch = (type: TouchEvent['type'], raw: any) => {
    const changed = toPoints(raw.changedTouches ?? raw.touches);
    if (type === 'down') {
      for (const p of changed) activeTouches.set(p.id, p);
    }
    const points = [...activeTouches.values()];
    router.handleTouch({ type, points, changed });
    if (type === 'up') {
      for (const p of changed) activeTouches.delete(p.id);
    }
  };

  tt.onTouchStart((e: any) => dispatch('down', e));
  tt.onTouchMove((e: any) => dispatch('move', e));
  tt.onTouchEnd((e: any) => dispatch('up', e));
  tt.onTouchCancel((e: any) => dispatch('up', e));

  // ── Main loop ──
  let last = Date.now();
  const loop = () => {
    const now = Date.now();
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now;
    router.update(dt);
    ctx.clearRect(0, 0, screenW, screenH);
    router.draw(ctx);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);

  // ── Background preload of card art ──
  preloadAllCardArt();

  // ── Lifecycle: pause on hide ──
  if (typeof tt.onHide === 'function') {
    tt.onHide(() => {
      battle.onAppHide();
    });
  }
  if (typeof tt.onShow === 'function') {
    tt.onShow(() => {
      battle.onAppShow();
    });
  }
  if (typeof tt.onAudioInterruptionBegin === 'function') {
    tt.onAudioInterruptionBegin(() => {
      battle.onAudioInterrupt(true);
    });
  }
  if (typeof tt.onAudioInterruptionEnd === 'function') {
    tt.onAudioInterruptionEnd(() => {
      battle.onAudioInterrupt(false);
    });
  }

  // Keep a reference so the font family is not tree-shaken away.
  void fontFamily;
}

boot();
