'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  ChevronRight,
  Crosshair,
  Flag,
  Layers3,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Shield,
  Sparkles,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  CARDS,
  createGame,
  DURATION,
  MAX_HP,
  playCard,
  snapshot,
  startGame,
  setOrder,
  tick,
  W,
  VIEW_W,
  H,
  type Order,
  type CardId,
  type GameState,
  type HandCard,
} from '@/game/engine';
import { render } from '@/game/render';
import { loadArt, drawSprite, cardFrame, type Art } from '@/game/art';

function SpriteArt({
  index,
  className = '',
}: {
  index: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let live = true;
    void loadArt()
      .then((art) => {
        if (!live) return;
        const ctx = ref.current?.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, 240, 150);
          ctx.imageSmoothingEnabled = false;
          const frame = cardFrame(art, index);
          if (index < 3) {
            drawSprite(ctx, frame, 90, 145, 140, 105);
            drawSprite(ctx, frame, 146, 145, 140, 105);
            if (index > 0) {
              const weapon = art.vehicles[2][index === 1 ? 2 : 3];
              drawSprite(ctx, weapon, 98, 101, 50, 21);
              drawSprite(ctx, weapon, 154, 101, 50, 21);
            }
          } else drawSprite(ctx, frame, 120, 140, 192, 112);
        }
      })
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [index]);
  return index >= 6 ? (
    <div className={'skill-art-icon ' + className} aria-hidden="true">
      {index === 6 ? (
        <Sparkles />
      ) : index === 7 ? (
        <Crosshair />
      ) : index === 8 ? (
        <Layers3 />
      ) : (
        <Radio />
      )}
    </div>
  ) : (
    <canvas
      aria-hidden="true"
      className={className}
      width="240"
      height="150"
      ref={ref}
    />
  );
}
const timeString = (t: number) =>
  `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
export default function Home() {
  const game = useRef<GameState | null>(null);
  if (!game.current) game.current = createGame(260909);
  const [view, setView] = useState(() => snapshot(game.current!));
  const [selected, setSelected] = useState<number | null>(null);
  const selectedRef = useRef<number | null>(null);
  const [panel, setPanel] = useState<'guide' | 'deck' | null>(null);
  const panelPause = useRef(false);
  const [sound, setSound] = useState(false);
  const soundRef = useRef(false);
  const [assetsReady, setAssetsReady] = useState(false);
  const [assetError, setAssetError] = useState(false);
  const [message, setMessage] = useState('');
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewport = useRef(VIEW_W);
  const [viewportWidth, setViewportWidth] = useState(VIEW_W);
  const [touchMode, setTouchMode] = useState(false);
  const [aimTarget, setAimTarget] = useState<number | null>(null);
  const mapPointer = useRef<number | null>(null);
  const camera = useRef(0),
    [cameraView, setCameraView] = useState(0),
    dragView = useRef<{
      x: number;
      y: number;
      camera: number;
      id: number;
    } | null>(null),
    didDrag = useRef(false),
    keys = useRef(new Set<string>());
  const moveCamera = useCallback((x: number) => {
    camera.current = Math.max(0, Math.min(W - viewport.current, x));
    setCameraView(camera.current);
  }, []);
  const canvas = useRef<HTMLCanvasElement>(null),
    art = useRef<Art | null>(null),
    hover = useRef<number | null>(null),
    pointerScreen = useRef<number | null>(null),
    audio = useRef<AudioContext | null>(null);
  const refresh = useCallback(() => setView(snapshot(game.current!)), []);
  const toast = useCallback((text: string) => {
    setMessage(text);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(''), 2800);
  }, []);
  const choose = useCallback((uid: number | null) => {
    selectedRef.current = uid;
    setSelected(uid);
    setAimTarget(null);
    pointerScreen.current = null;
    if (uid !== null) {
      const h = game.current!.players[0].hand.find((h) => h.uid === uid);
      if (h) {
        if (CARDS[h.id].type === 'unit') {
          camera.current = 0;
          setCameraView(0);
          hover.current = 280;
        } else
          hover.current =
            h.id === 'artillery'
              ? camera.current + viewport.current * 0.6
              : null;
      }
    } else hover.current = null;
  }, []);
  const execute = useCallback(
    (uid: number, x?: number) => {
      const result = playCard(game.current!, 0, uid, x);
      if (result.ok) choose(null);
      else toast(result.message);
      refresh();
      return result;
    },
    [choose, refresh, toast],
  );
  const start = useCallback(() => {
    if (!art.current) {
      toast('美术资源正在加载，请稍候');
      return;
    }
    startGame(game.current!);
    refresh();
  }, [refresh, toast]);
  const reset = useCallback(() => {
    game.current = createGame(Date.now());
    choose(null);
    hover.current = null;
    camera.current = 0;
    setCameraView(0);
    setMessage('');
    refresh();
  }, [choose, refresh]);
  const pause = useCallback(() => {
    const s = game.current!;
    if (s.status === 'playing') s.status = 'paused';
    else if (s.status === 'paused') s.status = 'playing';
    refresh();
  }, [refresh]);
  const openPanel = (p: 'guide' | 'deck') => {
    panelPause.current = game.current!.status === 'playing';
    if (panelPause.current) game.current!.status = 'paused';
    setPanel(p);
    refresh();
  };
  const closePanel = () => {
    setPanel(null);
    if (panelPause.current && game.current!.status === 'paused')
      game.current!.status = 'playing';
    panelPause.current = false;
    refresh();
  };
  useEffect(() => {
    const el = canvas.current!;
    const resize = () => {
      const box = el.parentElement!.getBoundingClientRect();
      const next = Math.max(240, Math.round((H * box.width) / box.height));
      const old = viewport.current;
      viewport.current = next;
      setViewportWidth(next);
      camera.current = Math.max(
        0,
        Math.min(
          W - next,
          camera.current === 0 ? 0 : camera.current + (old - next) / 2,
        ),
      );
      setCameraView(camera.current);
      pointerScreen.current = null;
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el.parentElement!);
    resize();
    const query = window.matchMedia('(pointer: coarse)');
    const update = () => setTouchMode(query.matches);
    update();
    query.addEventListener('change', update);
    return () => {
      observer.disconnect();
      query.removeEventListener('change', update);
    };
  }, []);
  useEffect(() => {
    let stopped = false;
    void loadArt()
      .then((a) => {
        if (!stopped) {
          art.current = a;
          setAssetsReady(true);
        }
      })
      .catch(() => {
        if (!stopped) setAssetError(true);
      });
    const ctx = canvas.current!.getContext('2d')!;
    let raf = 0,
      last = performance.now(),
      lastView = 0,
      lastExplosion = 0,
      accumulator = 0;
    const reduced = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;
    const frame = (now: number) => {
      if (stopped) return;
      const s = game.current!;
      const dt = (now - last) / 1000;
      last = now;
      if (keys.current.has('a'))
        camera.current = Math.max(0, camera.current - dt * 650);
      if (keys.current.has('d'))
        camera.current = Math.min(
          W - viewport.current,
          camera.current + dt * 650,
        );
      if (!document.hidden && s.status === 'playing') {
        accumulator += Math.min(dt, 0.25);
        while (accumulator >= 1 / 60) {
          tick(s, 1 / 60);
          accumulator -= 1 / 60;
        }
      } else accumulator = 0;
      const card = s.players[0].hand.find((h) => h.uid === selectedRef.current);
      if (pointerScreen.current !== null && selectedRef.current !== null)
        hover.current = Math.max(
          0,
          Math.min(W, camera.current + pointerScreen.current),
        );
      if (art.current)
        render(
          ctx,
          s,
          art.current,
          card?.id ?? null,
          hover.current,
          reduced,
          camera.current,
          viewport.current,
        );
      if (s.explosions > lastExplosion && soundRef.current && audio.current) {
        const ac = audio.current;
        const oscillator = ac.createOscillator(),
          gain = ac.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(95, ac.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(
          28,
          ac.currentTime + 0.18,
        );
        gain.gain.setValueAtTime(0.14, ac.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.22);
        oscillator.connect(gain);
        gain.connect(ac.destination);
        oscillator.start();
        oscillator.stop(ac.currentTime + 0.24);
      }
      lastExplosion = s.explosions;
      if (now - lastView > 90) {
        setView(snapshot(s));
        setCameraView(camera.current);
        lastView = now;
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      camera.current = Math.max(
        0,
        Math.min(
          W - viewport.current,
          camera.current +
            (Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY) *
              1.6,
        ),
      );
    };
    const el = canvas.current!;
    el.addEventListener('wheel', wheel, { passive: false });
    const visibility = () => {
      last = performance.now();
      keys.current.clear();
      if (document.hidden && game.current!.status === 'playing') {
        game.current!.status = 'paused';
        refresh();
      }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      document.removeEventListener('visibilitychange', visibility);
      el.removeEventListener('wheel', wheel);
      if (messageTimer.current) clearTimeout(messageTimer.current);
    };
  }, [refresh]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (panel || e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (e.target as HTMLElement)?.closest('[role=\"radiogroup\"]')
      )
        return;
      if (e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'd') {
        keys.current.add(e.key.toLowerCase());
        return;
      }
      if (
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
        selectedRef.current === null
      ) {
        e.preventDefault();
        moveCamera(camera.current + (e.key === 'ArrowRight' ? 85 : -85));
        return;
      }
      if (e.key === 'Escape') {
        choose(null);
        hover.current = null;
        return;
      }
      if (e.code === 'Space' && tag !== 'BUTTON') {
        e.preventDefault();
        pause();
      }
      if (/^[1-6]$/.test(e.key)) {
        const h = game.current!.players[0].hand[Number(e.key) - 1];
        if (h) choose(h.uid);
      }
      if (
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
        selectedRef.current !== null
      ) {
        e.preventDefault();
        pointerScreen.current = null;
        hover.current = Math.max(
          0,
          Math.min(
            W,
            (hover.current ?? 280) + (e.key === 'ArrowRight' ? 25 : -25),
          ),
        );
        if (hover.current > camera.current + viewport.current - 40)
          moveCamera(hover.current - viewport.current + 40);
        if (hover.current < camera.current + 40) moveCamera(hover.current - 40);
      }
      if (
        e.key === 'Enter' &&
        selectedRef.current !== null &&
        tag !== 'BUTTON'
      ) {
        e.preventDefault();
        const hand = game.current!.players[0].hand.find(
          (h) => h.uid === selectedRef.current,
        );
        if (hand)
          execute(
            hand.uid,
            CARDS[hand.id].type === 'unit' || hand.id === 'artillery'
              ? (hover.current ?? 280)
              : undefined,
          );
      }
    };
    const onUp = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onUp);
      keys.current.clear();
    };
  }, [panel, choose, pause, execute, moveCamera]);
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: unknown,
          ) => Promise<void> | void;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const register = (tool: unknown) => {
      try {
        void Promise.resolve(
          context.registerTool(tool, { signal: lifecycle.signal }),
        ).catch(() => {});
      } catch {}
    };
    register({
      name: 'read_battle_state',
      description: '查看灰线当前战局、指挥点与手牌。',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () => snapshot(game.current!),
    });
    register({
      name: 'start_battle',
      description: '从整备状态开始一局灰线对战；不会重置进行中的战局。',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: () => {
        if (game.current!.status !== 'ready')
          return { ok: false, message: '当前不在整备状态' };
        start();
        return snapshot(game.current!);
      },
    });
    register({
      name: 'play_battle_card',
      description:
        '打出当前手牌。单位部署 x 为 110–440；火炮 x 为 0–3840；其他技能无需 x。',
      inputSchema: {
        type: 'object',
        properties: { uid: { type: 'integer' }, x: { type: 'number' } },
        required: ['uid'],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: (input: unknown) => {
        const v = input as { uid?: unknown; x?: unknown };
        if (
          !v ||
          !Number.isInteger(v.uid) ||
          (v.x !== undefined &&
            (typeof v.x !== 'number' || !Number.isFinite(v.x)))
        )
          return { ok: false, message: '无效的卡牌或坐标' };
        return execute(v.uid as number, v.x as number | undefined);
      },
    });
    return () => lifecycle.abort();
  }, [execute, start]);
  const p = view.players[0],
    enemy = view.players[1],
    chosen = p.hand.find((h) => h.uid === selected),
    card = chosen ? CARDS[chosen.id] : null;
  const active = view.status === 'playing';
  const units = view.units.filter((u) => u.side === 0 && u.hp > 0),
    squads = new Set(units.map((u) => u.squad)).size;
  const deckCards = Object.values(CARDS);
  const selectCard = (h: HandCard) => {
    didDrag.current = false;
    if (view.status === 'ready') {
      toast('点击「开始作战」后即可部署部队');
      return;
    }
    if (view.status === 'finished') return;
    choose(selected === h.uid ? null : h.uid);
    if (CARDS[h.id].type === 'unit') moveCamera(0);
    if (touchMode && (CARDS[h.id].type === 'unit' || h.id === 'artillery'))
      canvas.current?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    hover.current =
      CARDS[h.id].type === 'unit'
        ? 280
        : h.id === 'artillery'
          ? camera.current + viewport.current * 0.6
          : null;
  };
  const canvasX = (clientX: number) => {
    const rect = canvas.current!.getBoundingClientRect();
    return (
      ((clientX - rect.left) / rect.width) * viewport.current + camera.current
    );
  };
  const toggleSound = () => {
    const next = !sound;
    soundRef.current = next;
    setSound(next);
    if (next) {
      audio.current ??= new AudioContext();
      void audio.current.resume();
    }
  };
  return (
    <main className="game-shell">
      <header className="masthead">
        <div className="brand">
          <span className="brand-symbol">
            <span />
            <span />
            <span />
          </span>
          <div className="wordmark">
            灰线<span>GREYLINE</span>
          </div>
          <span className="brand-meta">
            战术卡牌
            <br />
            TACTICAL CARD WARFARE
          </span>
        </div>
        <div className="header-actions">
          <span className="live-label">
            <i /> 人机演习
          </span>
          <button
            className="text-button"
            aria-label="作战手册"
            onClick={() => openPanel('guide')}
          >
            <BookOpen size={16} />
            作战手册
          </button>
          <button
            className="icon-button"
            aria-label={sound ? '关闭音效' : '开启音效'}
            title={sound ? '关闭音效' : '开启音效'}
            onClick={toggleSound}
          >
            {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
          </button>
          <button
            className="icon-button"
            aria-label={view.status === 'paused' ? '继续作战' : '暂停作战'}
            disabled={view.status === 'ready' || view.status === 'finished'}
            onClick={pause}
          >
            {view.status === 'paused' ? (
              <Play size={18} />
            ) : (
              <Pause size={18} />
            )}
          </button>
        </div>
      </header>
      <section className="match-bar" aria-label="双方基地状态">
        <div className="team team-blue">
          <div className="team-insignia">
            <Shield size={23} />
          </div>
          <div className="team-data">
            <div className="team-heading">
              <strong>蓝方指挥部</strong>
              <span>YOU</span>
              <b>
                {Math.ceil(p.hp).toLocaleString()} <small>/ 1,000</small>
              </b>
            </div>
            <div
              className="hp-track"
              role="meter"
              aria-label="蓝方基地生命"
              aria-valuenow={p.hp}
              aria-valuemin={0}
              aria-valuemax={MAX_HP}
            >
              <i style={{ width: `${p.hp / 10}%` }} />
            </div>
          </div>
        </div>
        <div className="match-clock">
          <span>
            {view.status === 'ready'
              ? '等待指令'
              : view.status === 'paused'
                ? '战场暂停'
                : view.status === 'finished'
                  ? '作战结束'
                  : '作战进行中'}
          </span>
          <strong>{timeString(Math.ceil(DURATION - view.time))}</strong>
          <div className="clock-dots">
            <i />
            <i />
            <i />
          </div>
        </div>
        <div className="team team-red">
          <div className="team-data">
            <div className="team-heading">
              <b>
                {Math.ceil(enemy.hp).toLocaleString()} <small>/ 1,000</small>
              </b>
              <span>AI</span>
              <strong>红方指挥部</strong>
            </div>
            <div
              className="hp-track"
              role="meter"
              aria-label="红方基地生命"
              aria-valuenow={enemy.hp}
              aria-valuemin={0}
              aria-valuemax={MAX_HP}
            >
              <i style={{ width: `${enemy.hp / 10}%` }} />
            </div>
          </div>
          <div className="team-insignia">
            <Flag size={23} />
          </div>
        </div>
      </section>
      <section
        className={`battlefield ${card ? 'is-targeting' : ''}`}
        aria-label="像素战场"
      >
        <canvas
          ref={canvas}
          width={viewportWidth}
          height={H}
          tabIndex={0}
          aria-label="战场。先选卡牌，点击蓝方部署区；火炮可点击任意位置。键盘方向键移动落点，回车确认。"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            if (!e.isPrimary || dragView.current) {
              didDrag.current = true;
              return;
            }
            dragView.current = {
              x: e.clientX,
              y: e.clientY,
              camera: camera.current,
              id: e.pointerId,
            };
            didDrag.current = false;
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            const gesture = dragView.current;
            if (gesture) {
              if (gesture.id !== e.pointerId) return;
              const dx = e.clientX - gesture.x,
                dy = e.clientY - gesture.y;
              if (Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy))
                didDrag.current = true;
              if (didDrag.current) {
                const rect = e.currentTarget.getBoundingClientRect();
                moveCamera(
                  gesture.camera - (dx / rect.width) * viewport.current,
                );
                pointerScreen.current = null;
                return;
              }
            }
            if (e.pointerType === 'mouse') {
              hover.current = canvasX(e.clientX);
              pointerScreen.current = hover.current - camera.current;
            }
          }}
          onPointerUp={(e) => {
            const gesture = dragView.current;
            if (!gesture || gesture.id !== e.pointerId) return;
            dragView.current = null;
            const moved =
              didDrag.current ||
              Math.hypot(e.clientX - gesture.x, e.clientY - gesture.y) > 8;
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
            if (moved || !chosen) return;
            if (card?.type === 'unit' || card?.id === 'artillery') {
              const x = Math.max(0, Math.min(W, canvasX(e.clientX)));
              if (e.pointerType !== 'mouse') {
                setTouchMode(true);
                setAimTarget(x);
                hover.current = x;
                pointerScreen.current = null;
              } else execute(chosen.uid, x);
            } else toast('点击「立即下达」使用这张技能卡');
          }}
          onPointerCancel={(e) => {
            if (dragView.current?.id === e.pointerId) {
              dragView.current = null;
              didDrag.current = true;
            }
          }}
          onLostPointerCapture={(e) => {
            if (dragView.current?.id === e.pointerId) {
              dragView.current = null;
              didDrag.current = true;
            }
          }}
          onPointerLeave={() => {
            if (!touchMode) {
              hover.current = null;
              pointerScreen.current = null;
            }
          }}
          onDragOver={(e) => {
            e.preventDefault();
            hover.current = canvasX(e.clientX);
          }}
          onDrop={(e) => {
            e.preventDefault();
            const uid = Number(e.dataTransfer.getData('text/plain'));
            if (Number.isInteger(uid)) execute(uid, canvasX(e.clientX));
          }}
        />
        <div className="field-top">
          <div className="location">
            <Crosshair size={15} />
            <span>
              07 <b>无名村落</b>
            </span>
            <small>48° N · 23° E</small>
          </div>
          <span className="weather">
            林间前线 <span> / </span> 多云
          </span>
        </div>
        <div className="field-ruler">
          <span>
            {touchMode ? '← 左右滑动战场 →' : '← 拖动 / A、D 移动视野 →'}
          </span>
          <i />
          <span>
            {Math.round(cameraView)} — {Math.round(cameraView + viewportWidth)}{' '}
            / {W}
          </span>
        </div>
        {active && (
          <div className="field-status">
            <span className="live-dot" />{' '}
            {card
              ? card.type === 'unit'
                ? touchMode
                  ? '点选蓝色区域，再确认部署'
                  : '点击蓝色区域部署部队'
                : card.id === 'artillery'
                  ? touchMode
                    ? '滑动找目标，点选后确认炮击'
                    : '点击战场，指定火炮覆盖区域'
                  : '确认下达指令'
              : '选择手牌下令 · 拖动查看前线'}
            {card && (
              <button onClick={() => choose(null)} aria-label="取消选择">
                <X size={13} />
                取消
              </button>
            )}
          </div>
        )}
        {active &&
          touchMode &&
          chosen &&
          (card?.type === 'unit' || card?.id === 'artillery') && (
            <div className="touch-target-controls">
              <button onClick={() => choose(null)}>取消</button>
              <button
                className="confirm-target"
                disabled={
                  aimTarget === null ||
                  p.energy < card.cost ||
                  (card.type === 'unit' && (aimTarget < 110 || aimTarget > 440))
                }
                onClick={() =>
                  aimTarget !== null && execute(chosen.uid, aimTarget)
                }
              >
                <Crosshair size={16} />
                {aimTarget === null
                  ? '先点选落点'
                  : card.type === 'unit'
                    ? '确认部署'
                    : '确认炮击'}
              </button>
            </div>
          )}
        {p.morale > 0 && (
          <div className="buff-label">
            <Sparkles size={13} />
            士气鼓舞 · {Math.ceil(p.morale)}s
          </div>
        )}
        {view.status === 'ready' && (
          <div className="start-scrim">
            <div className="launch">
              <div className="operation">
                <i /> OPERATION: GREYLINE <i />
              </div>
              <h1>战线，由你推进。</h1>
              <p>部署部队，下达指令。夺下村落另一端的指挥部。</p>
              <button
                className="primary-button"
                onClick={() => {
                  if (assetError) window.location.reload();
                  else start();
                }}
                disabled={!assetsReady && !assetError}
              >
                {assetError
                  ? '重新加载素材'
                  : assetsReady
                    ? '开始作战'
                    : '正在整备…'}
                <ArrowRight size={19} />
              </button>
              <div className="launch-meta">
                <span>1 VS 1</span>
                <i />
                <span>4 分钟对局</span>
                <i />
                <span>可破坏地形</span>
              </div>
            </div>
          </div>
        )}
        {view.status === 'paused' && !panel && (
          <div className="pause-scrim">
            <div className="pause-card">
              <Pause size={25} />
              <h2>战场已暂停</h2>
              <p>准备好了，就继续推进。</p>
              <button className="primary-button" onClick={pause}>
                继续作战
                <Play size={16} />
              </button>
              <button className="text-button" onClick={reset}>
                <RotateCcw size={14} />
                重新整备
              </button>
            </div>
          </div>
        )}
        {view.status === 'finished' && (
          <div className="pause-scrim">
            <div className="result-card">
              <span className="operation">OPERATION COMPLETE</span>
              <h2>
                {view.result === 0
                  ? '作战胜利'
                  : view.result === 1
                    ? '防线失守'
                    : '双方平局'}
              </h2>
              <p>
                {view.result === 0
                  ? '前线已控制，指挥官。'
                  : view.result === 1
                    ? '调整部署，下一次夺回前线。'
                    : '双方坚守阵地，再来一局。'}
              </p>
              <div className="result-stats">
                <span>
                  <b>{p.kills}</b>击退单位
                </span>
                <span>
                  <b>{p.played}</b>下达指令
                </span>
                <span>
                  <b>{timeString(view.time)}</b>作战时长
                </span>
              </div>
              <button className="primary-button" onClick={reset}>
                再来一局
                <RotateCcw size={17} />
              </button>
            </div>
          </div>
        )}
        {message && (
          <div className="battle-toast" role="status">
            {message}
          </div>
        )}
      </section>
      <div className="battle-ticker">
        <div>
          <Radio size={14} />
          <span>战场通讯</span>
          <p>{view.notices[0]?.text ?? '部队整备完毕，等待指挥官下令。'}</p>
        </div>
        <span className="enemy-intel">
          敌方手牌 {enemy.hand.length}
          <i />
          {enemy.jam > 0
            ? `通讯干扰 ${Math.ceil(enemy.jam)}s`
            : `敌军 ${view.units.filter((u) => u.side === 1 && u.hp > 0).length} 个单位`}
        </span>
      </div>
      <div className="map-strip">
        <button onClick={() => moveCamera(0)}>← 蓝方基地</button>
        <div
          className="mini-map"
          role="slider"
          tabIndex={0}
          aria-label="战场小地图，点击或拖动移动视野"
          aria-valuemin={0}
          aria-valuemax={W - viewportWidth}
          aria-valuenow={Math.round(cameraView)}
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            const r = e.currentTarget.getBoundingClientRect();
            moveCamera(
              ((e.clientX - r.left) / r.width) * W - viewport.current / 2,
            );
          }}
          onPointerMove={(e) => {
            if (mapPointer.current === e.pointerId) {
              const r = e.currentTarget.getBoundingClientRect();
              moveCamera(
                ((e.clientX - r.left) / r.width) * W - viewport.current / 2,
              );
            }
          }}
          onPointerUp={(e) => {
            if (mapPointer.current === e.pointerId) mapPointer.current = null;
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={(e) => {
            if (mapPointer.current === e.pointerId) mapPointer.current = null;
          }}
          onLostPointerCapture={(e) => {
            if (mapPointer.current === e.pointerId) mapPointer.current = null;
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
              e.stopPropagation();
              e.preventDefault();
              moveCamera(cameraView + (e.key === 'ArrowRight' ? 150 : -150));
            }
          }}
        >
          <span className="map-land" />
          {view.walls
            .filter((w) => w.hp > 0)
            .map((w) => (
              <i
                className="map-wall"
                key={w.uid}
                style={{ left: `${(w.x / W) * 100}%` }}
              />
            ))}
          {view.units
            .filter((u) => u.hp > 0)
            .map((u) => (
              <i
                key={u.uid}
                className={`map-unit side-${u.side}`}
                style={{
                  left: `${(u.x / W) * 100}%`,
                  top: CARDS[u.id].air ? '5px' : '17px',
                }}
              />
            ))}
          <span
            className="map-window"
            style={{
              left: `${(cameraView / W) * 100}%`,
              width: `${(viewportWidth / W) * 100}%`,
            }}
          />
        </div>
        <button
          onClick={() => {
            const front = Math.max(
              175,
              ...view.units
                .filter((u) => u.side === 0 && u.hp > 0)
                .map((u) => u.x),
            );
            moveCamera(front - viewport.current * 0.4);
          }}
        >
          我方前线
        </button>
        <button onClick={() => moveCamera(W - viewport.current)}>
          红方基地 →
        </button>
      </div>
      <div className="orders-bar">
        <span>
          <Flag size={14} /> 步兵指令
        </span>
        <RadioGroup
          className="orders-group"
          aria-label="步兵行动指令"
          value={p.order}
          onValueChange={(value) => {
            setOrder(game.current!, 0, value as Order);
            refresh();
          }}
          disabled={view.status === 'finished'}
        >
          {(
            [
              ['hold', '驻守'],
              ['advance', '推进'],
              ['rush', '奔跑'],
              ['crouch', '蹲行'],
              ['prone', '卧倒'],
            ] as [Order, string][]
          ).map(([value, label]) => (
            <label
              className={
                p.order === value ? 'order-option active' : 'order-option'
              }
              key={value}
            >
              <RadioGroupItem value={value} className="order-radio" />
              <span>{label}</span>
            </label>
          ))}
        </RadioGroup>
        <small>
          {p.order === 'rush'
            ? '行军速度 ×1.7'
            : p.order === 'crouch'
              ? '速度 ×0.55 · 受伤 −15%'
              : p.order === 'prone'
                ? '匍匐速度 ×0.25 · 受伤 −30%'
                : p.order === 'hold'
                  ? '原地警戒，自动还击'
                  : '自动利用弹坑掩护 · 跳入 / 攀出'}
        </small>
      </div>
      <section className="command">
        <aside className="command-panel">
          <div className="resource-title">
            <span>
              <Zap size={14} />
              指挥点
            </span>
            <small>COMMAND</small>
          </div>
          <div className="energy-number">
            <strong>{Math.floor(p.energy)}</strong>
            <span>/ 10</span>
            <small>+1 / 2.8s</small>
          </div>
          <div
            className="energy-segments"
            aria-label={`指挥点 ${Math.floor(p.energy)}/10`}
          >
            {Array.from({ length: 10 }, (_, i) => (
              <i key={i}>
                <b
                  style={{
                    height: `${Math.min(1, Math.max(0, p.energy - i)) * 100}%`,
                  }}
                />
              </i>
            ))}
          </div>
          <div className="deployment-count">
            <span>
              <span className="unit-dot" />
              在场部队
            </span>
            <b>
              {squads} <small>支 / {units.length} 个单位</small>
            </b>
          </div>
          <div className="selection-detail">
            {card ? (
              <>
                <div>
                  <span
                    className={card.type === 'unit' ? 'blue-text' : 'gold-text'}
                  >
                    {card.tag}
                  </span>
                  <strong>{card.name}</strong>
                </div>
                <p>{card.detail}</p>
                {card.type === 'skill' && card.id !== 'artillery' ? (
                  <button
                    className="order-button"
                    disabled={!active || p.energy < card.cost}
                    onClick={() => execute(chosen!.uid)}
                  >
                    立即下达 <ArrowUpRight size={15} />
                  </button>
                ) : (
                  <span className="target-hint">
                    <Crosshair size={13} />
                    {card.type === 'unit'
                      ? '在蓝色区域选择部署点'
                      : '在战场选择炮击落点'}
                  </span>
                )}
              </>
            ) : (
              <>
                <span className="panel-eyebrow">指挥提示</span>
                <p>推进时自动寻找弹坑掩护；奔跑时不主动寻找掩护。</p>
              </>
            )}
          </div>
        </aside>
        <div className="hand-section">
          <div className="hand-heading">
            <div>
              <Layers3 size={16} />
              <strong>战术手牌</strong>
              <span>{p.hand.length} / 6</span>
            </div>
            <span>
              {p.jam > 0 ? (
                <>
                  <Radio size={13} />
                  通讯受扰 · {Math.ceil(p.jam)}s
                </>
              ) : p.hand.length === 6 ? (
                '手牌已满 · 打出卡牌腾出空位'
              ) : (
                `下一张补给 ${Math.ceil(p.drawIn)}s`
              )}
            </span>
          </div>
          <div className="hand-and-deck">
            <div className="hand-cards">
              {p.hand.map((h, i) => {
                const c = CARDS[h.id];
                return (
                  <button
                    key={h.uid}
                    className={`tactical-card ${c.type} ${selected === h.uid ? 'selected' : ''} ${p.energy < c.cost ? 'unaffordable' : ''}`}
                    onClick={() => selectCard(h)}
                    draggable={active && !touchMode}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', String(h.uid));
                      choose(h.uid);
                    }}
                    aria-label={`${i + 1}，${c.name}，${c.cost}指挥点，${c.description}`}
                    aria-pressed={selected === h.uid}
                  >
                    <div className="card-top">
                      <span className="card-cost">{c.cost}</span>
                      <span>{c.type === 'unit' ? '部队' : '指令'}</span>
                      <kbd>{i + 1}</kbd>
                    </div>
                    <div className="card-art">
                      <SpriteArt index={c.atlas} />
                      <div className="art-horizon" />
                    </div>
                    <div className="card-copy">
                      <small>{c.en}</small>
                      <strong>{c.name}</strong>
                      <p>{c.description}</p>
                    </div>
                    <div className="card-bottom">
                      <span>{c.tag}</span>
                      {c.type === 'unit' ? (
                        <Shield size={12} />
                      ) : (
                        <Zap size={12} />
                      )}
                    </div>
                  </button>
                );
              })}
              {p.hand.length === 0 && (
                <div className="empty-hand">
                  <Layers3 size={30} />
                  <p>等待战地补给</p>
                  <span>{Math.ceil(p.drawIn)} 秒后抽取下一张牌</span>
                </div>
              )}
            </div>
            <button
              className="deck-pile"
              onClick={() => openPanel('deck')}
              aria-label="查看全部九种卡牌及规则"
            >
              <span className="deck-card-back">
                <span className="deck-emblem">
                  G<span>///</span>
                </span>
                <small>GREYLINE</small>
              </span>
              <span className="deck-label">战术牌库</span>
              <strong>
                {p.deckCount}
                <small> 张</small>
              </strong>
              <span className="deck-sub">弃牌 {p.discardCount}</span>
              <div className="draw-progress">
                <i style={{ width: `${(1 - p.drawIn / 9) * 100}%` }} />
              </div>
            </button>
          </div>
        </div>
      </section>
      <footer>
        <span>
          GREYLINE <i /> 林间前线 · 演习版本 0.4
        </span>
        <span>
          <kbd>A / D</kbd> 移动视野 <kbd>1–6</kbd> 选牌 <kbd>← →</kbd> 落点{' '}
          <kbd>Enter</kbd> 确认 <kbd>Space</kbd> 暂停
        </span>
        <button aria-label="作战手册" onClick={() => openPanel('guide')}>
          如何作战 <ChevronRight size={13} />
        </button>
      </footer>
      <Dialog
        open={panel !== null}
        onOpenChange={(open) => {
          if (!open) closePanel();
        }}
      >
        <DialogContent
          className={`manual-dialog ${panel === 'deck' ? 'deck-dialog' : ''}`}
        >
          <DialogTitle className="manual-title">
            {panel === 'deck' ? '战术牌库' : '作战手册'}
          </DialogTitle>
          <DialogDescription>
            {panel === 'deck'
              ? '18 张循环牌库 · 9 种战术卡 · 用过的牌在牌库抽空后重新洗入。'
              : '灰线 / 林间前线 · 单线即时卡牌对战'}
          </DialogDescription>
          {panel === 'guide' ? (
            <>
              <div className="guide-grid">
                <div>
                  <span>01 / 目标</span>
                  <h3>夺下敌方指挥部</h3>
                  <p>
                    基地初始 1,000 生命。摧毁敌方基地立即获胜；4
                    分钟后，基地剩余生命更高的一方获胜，相同则平局。
                  </p>
                </div>
                <div>
                  <span>02 / 部署</span>
                  <h3>选牌，然后选择落点</h3>
                  <p>
                    战场横跨多个屏幕，左右拖动、滚轮或 A/D
                    移动视野，也可点击小地图。选卡后点击蓝色区域部署；手机上点选落点后再按确认。炮击可指定任意位置。每个班组由
                    5–6
                    名独立士兵组成，各自站立、行走、奔跑、攀墙、下蹲、趴下。使用「步兵指令」切换行动。士兵会跳入弹坑、落地缓冲，再撑地攀出。
                  </p>
                </div>
                <div>
                  <span>03 / 补给</span>
                  <h3>合理分配指挥点</h3>
                  <p>
                    开局 7 点，每 2.8 秒恢复 1 点，上限 10。每 9 秒抽 1
                    张牌，最多持有 6 张；满手牌时跳过当次抽牌。
                  </p>
                </div>
                <div>
                  <span>04 / 战术</span>
                  <h3>用好不同兵种</h3>
                  <p>
                    坦克承伤，重火力负责爆破；机枪和重火力能够对空。火炮可打击任意位置，友军免伤，对基地只造成
                    35%
                    伤害。交火时士兵会寻找附近弹坑，蹲伏躲避、探身开火；坑沿能遮挡直射，无法挡住落入坑内的炮击。
                  </p>
                </div>
              </div>
              <div className="guide-note">
                <Radio size={18} />
                <p>
                  AI
                  与你使用相同牌库和资源规则。离开页面会自动暂停；返回后点击继续作战。
                </p>
              </div>
              <button className="primary-button" onClick={closePanel}>
                明白，返回战场
                <ArrowRight size={16} />
              </button>
            </>
          ) : (
            <div className="catalog">
              {deckCards.map((c) => (
                <div className={`catalog-card ${c.type}`} key={c.id}>
                  <SpriteArt index={c.atlas} />
                  <div>
                    <h3>
                      {c.name}
                      <b>
                        {c.cost}
                        <Zap size={12} />
                      </b>
                    </h3>
                    <span>{c.tag}</span>
                    <p>{c.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </main>
  );
}
