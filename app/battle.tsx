'use client';
/* eslint-disable jsx-a11y/prefer-tag-over-role -- Custom battlefield meters and the draggable mini-map have explicit accessible roles and keyboard support. */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowRight,
  BookOpen,
  ChevronRight,
  Crosshair,
  Binoculars,
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
  chooseAiDeck,
  needsTarget,
  createGame,
  DURATION,
  MAX_HP,
  playCard,
  requestDraw,
  DRAW_COST,
  DRAW_TIME,
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
import { CardFace } from '@/game/card-art';
import { CARD_COPY } from '@/game/card-copy';
import { render } from '@/game/render';
import { loadArt, type Art } from '@/game/art';
import {
  DEFAULT_AUDIO,
  getBattleAudio,
  type BattleAudio,
  type AudioSettings,
} from '@/game/audio';
import { assetUrl } from '@/game/asset-url';
import { DEFAULT_MAP, type MapId } from '@/game/maps';
import {
  pickSquad,
  setSquadOrder,
  selectUnitGroup,
  ordersForUnit,
} from '@/game/squad-orders';
import { unitSelectionBounds } from '@/game/selection-render';
import SquadMenu from './squad-menu';
import { DEFAULT_DIFFICULTY, type Difficulty } from '@/game/economy';
import { missionById, type MissionId } from '@/game/campaign';
import { createCampaignGame } from '@/game/campaign-game';
import CampaignDialogue from './campaign-dialogue';
import { DIFFICULTY_LABEL, DIFFICULTY_BONUS } from './difficulty-selector';

const timeString = (t: number) =>
  `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
type CardGesture = {
  uid: number;
  pointer: number;
  startX: number;
  startY: number;
  centerX: number;
  centerY: number;
  width: number;
  dragging: boolean;
  bounds: { left: number; right: number; top: number; bottom: number };
};
function dragPosition(gesture: CardGesture, clientX: number, clientY: number) {
  const x = gesture.centerX + clientX - gesture.startX;
  const y = gesture.centerY + clientY - gesture.startY;
  const { left, right, top, bottom } = gesture.bounds;
  return {
    uid: gesture.uid,
    x,
    y,
    width: gesture.width,
    outside: x < left || x > right || y < top || y > bottom,
  };
}
export default function Battle({
  playerDeck,
  aiDeck,
  seed,
  mapId = DEFAULT_MAP,
  difficulty = DEFAULT_DIFFICULTY,
  night = false,
  missionId,
  onMissionComplete,
  onNextMission,
  onExit,
}: {
  playerDeck: CardId[];
  aiDeck: CardId[];
  seed: number;
  mapId?: MapId;
  difficulty?: Difficulty;
  night?: boolean;
  missionId?: MissionId;
  onMissionComplete?: (id: MissionId) => void;
  onNextMission?: () => void;
  onExit: () => void;
}) {
  const [initialGame] = useState(() =>
    missionId
      ? createCampaignGame(seed, playerDeck, missionId, difficulty)
      : createGame(seed, playerDeck, aiDeck, mapId, { difficulty, night }),
  );
  const game = useRef<GameState>(initialGame);
  const [view, setView] = useState(() => snapshot(initialGame));
  const completionRecorded = useRef(false);
  const mission = missionId ? missionById(missionId) : null;
  const [dialogueOpen, setDialogueOpen] = useState(!!missionId);
  const dialogueOpenRef = useRef(!!missionId),
    dialogueResume = useRef(true);
  const timeLimit = view.campaign?.duration ?? DURATION;
  useEffect(() => {
    if (
      missionId &&
      view.status === 'finished' &&
      view.result === 0 &&
      !completionRecorded.current
    ) {
      completionRecorded.current = true;
      onMissionComplete?.(missionId);
    }
  }, [missionId, view.status, view.result, onMissionComplete]);
  const [selected, setSelected] = useState<number | null>(null);
  const [selectedSquad, setSelectedSquad] = useState<number | null>(null);
  const selectedSquadRef = useRef<number | null>(null);
  const selectSquad = useCallback((id: number | null) => {
    selectedSquadRef.current = id;
    setSelectedSquad(id);
  }, []);
  const selectedRef = useRef<number | null>(null);
  const [panel, setPanel] = useState<'guide' | 'deck' | 'card' | null>(null);
  const [inspectUid, setInspectUid] = useState<number | null>(null);
  const cardHold = useRef<{
    uid: number;
    pointer: number;
    x: number;
    y: number;
    timer: ReturnType<typeof setTimeout>;
  } | null>(null);
  const heldClick = useRef<number | null>(null);
  const handArea = useRef<HTMLDivElement>(null);
  const cardGesture = useRef<CardGesture | null>(null);
  const [draggedCard, setDraggedCard] = useState<{
    uid: number;
    x: number;
    y: number;
    width: number;
    outside: boolean;
  } | null>(null);
  const portraitGate = useRef(false);
  const panelPause = useRef(false);
  const [audioSettings, setAudioSettings] = useState({ ...DEFAULT_AUDIO });
  const sound = audioSettings.enabled;
  const [assetsReady, setAssetsReady] = useState(false);
  const [assetError, setAssetError] = useState(false);
  const [message, setMessage] = useState('');
  const messageTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const viewport = useRef(VIEW_W);
  const [viewportWidth, setViewportWidth] = useState(VIEW_W);
  const [touchMode, setTouchMode] = useState(false);
  const mapPointer = useRef<number | null>(null);
  const camera = useRef(initialGame.campaign?.initialCamera ?? 0),
    [cameraView, setCameraView] = useState(
      initialGame.campaign?.initialCamera ?? 0,
    ),
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
    audio = useRef<BattleAudio | null>(null);
  useEffect(() => {
    const mixer = getBattleAudio();
    audio.current = mixer;
    // 进入战斗立即激活音乐（菜单已解锁时无缝延续，未解锁时在首次手势后播放）。
    mixer.setActive(true);
    void mixer.unlock();
    // 轻量双保险：进战斗即推音乐，300ms 后再试一次覆盖异步解锁的空窗。
    mixer.kick();
    const kickTimer = setTimeout(() => mixer.kick(), 300);
    let mounted = true;
    queueMicrotask(() => {
      if (mounted) setAudioSettings({ ...mixer.settings });
    });
    const unlock = () => {
      void mixer.unlock();
    };
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      mounted = false;
      clearTimeout(kickTimer);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
      mixer.setActive(false);
    };
  }, []);
  const refresh = useCallback(() => setView(snapshot(game.current!)), []);
  const toast = useCallback((text: string) => {
    setMessage(text);
    if (messageTimer.current) clearTimeout(messageTimer.current);
    messageTimer.current = setTimeout(() => setMessage(''), 2800);
  }, []);
  const choose = useCallback(
    (uid: number | null) => {
      if (uid !== null) selectSquad(null);
      selectedRef.current = uid;
      setSelected(uid);
      pointerScreen.current = null;
      const h = game.current.players[0].hand.find((h) => h.uid === uid);
      hover.current =
        h && needsTarget(h.id) ? camera.current + viewport.current * 0.6 : null;
    },
    [selectSquad],
  );
  const execute = useCallback(
    (uid: number, x?: number) => {
      const h = game.current.players[0].hand.find((h) => h.uid === uid);
      const entryOrTarget = h && needsTarget(h.id) ? x : undefined;
      const result = playCard(game.current!, 0, uid, entryOrTarget);
      if (result.ok) choose(null);
      else toast(result.message);
      refresh();
      return result;
    },
    [choose, refresh, toast],
  );
  const drawCard = useCallback(() => {
    const result = requestDraw(game.current!, 0);
    toast(result.message);
    refresh();
    return result;
  }, [refresh, toast]);
  const cancelCardHold = useCallback(() => {
    if (cardHold.current) clearTimeout(cardHold.current.timer);
    cardHold.current = null;
  }, []);
  const interruptCardHold = useCallback(() => {
    const uid = cardGesture.current?.uid ?? cardHold.current?.uid;
    if (uid !== undefined) heldClick.current = uid;
    cardGesture.current = null;
    setDraggedCard(null);
    cancelCardHold();
  }, [cancelCardHold]);
  const start = useCallback(() => {
    if (!art.current) {
      toast('美术资源正在加载，请稍候');
      return;
    }
    startGame(game.current!);
    if (dialogueOpenRef.current) game.current.status = 'paused';
    refresh();
  }, [refresh, toast]);
  const reset = useCallback(() => {
    interruptCardHold();
    const nextSeed = Date.now();
    selectSquad(null);
    completionRecorded.current = false;
    game.current = missionId
      ? createCampaignGame(nextSeed, playerDeck, missionId, difficulty)
      : createGame(nextSeed, playerDeck, chooseAiDeck(nextSeed), mapId, {
          difficulty,
          night,
        });
    startGame(game.current);
    if (missionId) {
      dialogueResume.current = true;
      dialogueOpenRef.current = true;
      setDialogueOpen(true);
      game.current.status = 'paused';
    }
    choose(null);
    hover.current = null;
    camera.current = game.current.campaign?.initialCamera ?? 0;
    setCameraView(camera.current);
    setMessage('');
    refresh();
  }, [
    choose,
    refresh,
    playerDeck,
    mapId,
    difficulty,
    night,
    missionId,
    interruptCardHold,
    selectSquad,
  ]);
  const pause = useCallback(() => {
    if (dialogueOpenRef.current) return;
    interruptCardHold();
    const s = game.current!;
    if (s.status === 'playing') s.status = 'paused';
    else if (s.status === 'paused') s.status = 'playing';
    refresh();
  }, [refresh, interruptCardHold]);
  const openDialogue = () => {
    if (!missionId || dialogueOpenRef.current) return;
    interruptCardHold();
    keys.current.clear();
    dialogueResume.current =
      game.current.status === 'playing' || game.current.status === 'ready';
    if (game.current.status === 'playing') game.current.status = 'paused';
    dialogueOpenRef.current = true;
    setDialogueOpen(true);
    refresh();
  };
  const closeDialogue = () => {
    dialogueOpenRef.current = false;
    setDialogueOpen(false);
    if (dialogueResume.current && art.current) {
      if (game.current.status === 'ready') startGame(game.current);
      else if (game.current.status === 'paused')
        game.current.status = 'playing';
    }
    refresh();
  };
  const openPanel = (p: 'guide' | 'deck' | 'card') => {
    interruptCardHold();
    panelPause.current = game.current!.status === 'playing';
    if (panelPause.current) game.current!.status = 'paused';
    setPanel(p);
    refresh();
  };
  const closePanel = () => {
    setPanel(null);
    setInspectUid(null);
    if (panelPause.current && game.current!.status === 'paused')
      game.current!.status = 'playing';
    panelPause.current = false;
    refresh();
  };
  const inspectHandCard = (uid: number) => {
    setInspectUid(uid);
    openPanel('card');
  };
  useEffect(() => {
    const cancel = () => interruptCardHold();
    window.addEventListener('blur', cancel);
    document.addEventListener('visibilitychange', cancel);
    return () => {
      cancelCardHold();
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', cancel);
    };
  }, [cancelCardHold, interruptCardHold]);
  useEffect(() => {
    const el = canvas.current!;
    const resize = () => {
      const box = el.parentElement!.getBoundingClientRect();
      if (box.width <= 0 || box.height <= 0) return;
      const next = Math.min(
        W,
        Math.max(240, Math.round((H * box.width) / box.height)),
      );
      const old = viewport.current;
      viewport.current = next;
      setViewportWidth(next);
      camera.current = Math.max(
        0,
        Math.min(
          W - next,
          camera.current === 0
            ? 0
            : game.current.campaign
              ? camera.current
              : camera.current + (old - next) / 2,
        ),
      );
      setCameraView(camera.current);
      pointerScreen.current = null;
      portraitGate.current =
        window.matchMedia('(pointer: coarse)').matches &&
        window.innerHeight > window.innerWidth;
      dragView.current = null;
      didDrag.current = false;
      hover.current = null;
      interruptCardHold();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(el.parentElement!);
    resize();
    const query = window.matchMedia('(pointer: coarse)');
    const shortLandscape = window.matchMedia(
      '(max-height: 540px) and (orientation: landscape)',
    );
    const update = () => setTouchMode(query.matches || shortLandscape.matches);
    update();
    query.addEventListener('change', update);
    shortLandscape.addEventListener('change', update);
    return () => {
      observer.disconnect();
      query.removeEventListener('change', update);
      shortLandscape.removeEventListener('change', update);
    };
  }, [interruptCardHold]);
  useEffect(() => {
    let stopped = false;
    void loadArt()
      .then((a) => {
        if (!stopped) {
          art.current = a;
          setAssetsReady(true);
          startGame(game.current!);
          if (dialogueOpenRef.current) game.current.status = 'paused';
          refresh();
        }
      })
      .catch(() => {
        if (!stopped) setAssetError(true);
      });
    const ctx = canvas.current!.getContext('2d')!;
    let raf = 0,
      last = performance.now(),
      lastView = 0,
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
      if (
        !document.hidden &&
        !portraitGate.current &&
        !dialogueOpenRef.current &&
        s.status === 'playing'
      ) {
        // A slow paint must not demand fifteen expensive combat ticks on its next frame.
        accumulator = Math.min(accumulator + Math.max(0, dt), 3 / 60);
        let steps = 0;
        while (accumulator >= 1 / 60 && steps++ < 3) {
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
          selectedSquadRef.current,
        );
      audio.current?.update(
        s,
        camera.current,
        viewport.current,
        // v99: music starts the moment the battle screen appears (status
        // 'ready'), not only after the first card is deployed.
        !document.hidden &&
          !portraitGate.current &&
          (s.status === 'playing' || s.status === 'ready'),
      );
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
      if (document.hidden) audio.current?.setActive(false);
      if (document.hidden && game.current!.status === 'playing') {
        game.current!.status = 'paused';
        refresh();
      }
    };
    document.addEventListener('visibilitychange', visibility);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      audio.current?.setActive(false);
      document.removeEventListener('visibilitychange', visibility);
      el.removeEventListener('wheel', wheel);
      if (messageTimer.current) clearTimeout(messageTimer.current);
    };
  }, [refresh]);
  useEffect(() => {
    const pressedKeys = keys.current;
    const onKey = (e: KeyboardEvent) => {
      if (dialogueOpenRef.current) return;
      if (panel || e.altKey || e.ctrlKey || e.metaKey) return;
      const tag = (e.target as HTMLElement)?.tagName;
      if (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        (e.target as HTMLElement)?.closest('[role="radiogroup"]')
      )
        return;
      const targetCard = game.current.players[0].hand.find(
        (h) => h.uid === selectedRef.current,
      );
      const targeting = targetCard ? needsTarget(targetCard.id) : false;
      if (e.key.toLowerCase() === 'a' || e.key.toLowerCase() === 'd') {
        keys.current.add(e.key.toLowerCase());
        return;
      }
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !targeting) {
        e.preventDefault();
        moveCamera(camera.current + (e.key === 'ArrowRight' ? 85 : -85));
        return;
      }
      if (e.key === 'Escape') {
        selectSquad(null);
        interruptCardHold();
        choose(null);
        hover.current = null;
        return;
      }
      if (e.code === 'Space' && tag !== 'BUTTON') {
        e.preventDefault();
        pause();
      }
      if (e.key.toLowerCase() === 'r') {
        e.preventDefault();
        drawCard();
        return;
      }
      if (/^[1-6]$/.test(e.key)) {
        const h = game.current!.players[0].hand[Number(e.key) - 1];
        if (h) choose(h.uid);
      }
      if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && targeting) {
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
            needsTarget(hand.id) ? (hover.current ?? 280) : undefined,
          );
      }
    };
    const onUp = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onUp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onUp);
      pressedKeys.clear();
    };
  }, [
    panel,
    choose,
    pause,
    execute,
    moveCamera,
    drawCard,
    interruptCardHold,
    selectSquad,
  ]);
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
      name: 'draw_battle_card',
      description:
        '消耗 2 点指挥点抽取 1 张卡，抽牌后冷却 9 秒。手牌已满、受干扰或资源不足时不消耗资源。',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute: drawCard,
    });
    register({
      name: 'play_battle_card',
      description:
        '打出当前手牌。单位固定从己方基地入场，无需 x；烟幕和地雷以 x 指定 0–3840 内的目标；其他技能无需 x。',
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
  }, [execute, start, drawCard]);
  const p = view.players[0],
    enemy = view.players[1],
    chosen = p.hand.find((h) => h.uid === selected),
    card = chosen ?? null;
  const inspectionCard = p.hand.find((h) => h.uid === inspectUid) ?? card;
  const active = view.status === 'playing';
  const units = view.units.filter(
      (u) => u.side === 0 && u.hp > 0 && !u.surrendered && !u.wounded,
    ),
    squads = new Set(units.map((u) => u.squad)).size;
  const deckCards = playerDeck.map((id) => CARDS[id]);
  const selectedMembers = units.filter(
    (u) => u.squad === selectedSquad && !u.rappelling,
  );
  const squadX =
    selectedMembers.reduce((n, u) => n + u.x, 0) /
    Math.max(1, selectedMembers.length);
  const squadY = selectedMembers.length
    ? CARDS[selectedMembers[0].id].air
      ? Math.max(...selectedMembers.map((u) => u.y)) + 140
      : Math.min(...selectedMembers.map((u) => unitSelectionBounds(u).y)) - 18
    : 0;
  const squadTrench = view.entrenchments.find((t) => t.squad === selectedSquad);
  const selectCard = (h: HandCard) => {
    didDrag.current = false;
    if (view.status === 'ready') {
      toast('点击「开始作战」后即可部署部队');
      return;
    }
    if (view.status === 'finished') return;
    choose(selected === h.uid ? null : h.uid);
  };
  const canvasX = (clientX: number) => {
    const rect = canvas.current!.getBoundingClientRect();
    return (
      ((clientX - rect.left) / rect.width) * viewport.current + camera.current
    );
  };
  const handBounds = () => {
    if (!handArea.current) return null;
    const rect = handArea.current.getBoundingClientRect();
    const boxes = Array.from(
      handArea.current.querySelectorAll('.tactical-card'),
      (el) => el.getBoundingClientRect(),
    );
    if (!boxes.length) return null;
    return {
      left: Math.min(...boxes.map((b) => b.left)),
      right: Math.max(...boxes.map((b) => b.right)),
      top: rect.top,
      bottom: Math.max(rect.bottom, ...boxes.map((b) => b.bottom)),
    };
  };
  const changeAudio = (patch: Partial<AudioSettings>) => {
    const mixer = audio.current ?? getBattleAudio();
    mixer.configure(patch);
    setAudioSettings({ ...mixer.settings });
    if (mixer.settings.enabled) void mixer.unlock();
  };
  const toggleSound = () => changeAudio({ enabled: !sound });
  return (
    <main
      className={`game-shell ${touchMode ? 'touch-battle' : ''} ${view.status !== 'playing' || panel ? 'is-interrupted' : ''}`}
    >
      {missionId && (
        <CampaignDialogue
          missionId={missionId}
          open={dialogueOpen}
          onClose={closeDialogue}
        />
      )}
      <div className="mobile-battle-hud">
        <div className="mobile-base mobile-base-own">
          <div>
            <span>我方指挥部</span>
            <strong>{Math.ceil(p.hp)}</strong>
          </div>
          <div
            className="mobile-hp"
            role="meter"
            aria-label="我方基地生命"
            aria-valuenow={p.hp}
            aria-valuemin={0}
            aria-valuemax={MAX_HP}
          >
            <i style={{ width: `${p.hp / 10}%` }} />
          </div>
          <div className="mobile-command-points">
            <Zap size={14} />
            <strong>{Math.floor(p.energy)}</strong>
            <span>/ {p.energyCap} 指挥点</span>
          </div>
          <small className="mobile-economy-readout">
            +1 / {p.energyInterval.toFixed(1)}秒
            {p.bondDueAt !== null
              ? ` · 公债 ${Math.max(0, Math.ceil(p.bondDueAt - view.time))}秒`
              : ''}
            {p.overdraftUntil !== null && p.overdraftUntil > view.time
              ? ` · 透支中 ${Math.max(0, Math.ceil(p.overdraftUntil - view.time))}秒`
              : ''}
            {p.suppressedUntil !== null && p.suppressedUntil > view.time
              ? ` · 遭压制 ${Math.max(0, Math.ceil(p.suppressedUntil - view.time))}秒`
              : ''}
          </small>
        </div>
        <button
          className="mobile-pause-control"
          aria-label="暂停作战"
          onClick={pause}
          disabled={!active}
        >
          <Pause size={17} />
          <span>{timeString(Math.ceil(timeLimit - view.time))}</span>
        </button>
        <div className="mobile-base mobile-base-enemy">
          <div>
            <span>敌方指挥部</span>
            <strong>{Math.ceil(enemy.hp)}</strong>
          </div>
          <div
            className="mobile-hp"
            role="meter"
            aria-label="敌方基地生命"
            aria-valuenow={enemy.hp}
            aria-valuemin={0}
            aria-valuemax={MAX_HP}
          >
            <i style={{ width: `${enemy.hp / 10}%` }} />
          </div>
          <small className="mobile-economy-readout">
            {DIFFICULTY_LABEL[difficulty]} · {DIFFICULTY_BONUS[difficulty]}
          </small>
        </div>
      </div>
      <div className="rotate-battle-hint">
        <RotateCcw size={34} />
        <strong>请横屏作战</strong>
        <span>转动手机，展开战场</span>
        <button onClick={onExit}>返回整备</button>
      </div>
      {mission &&
        view.campaign &&
        active &&
        !panel &&
        selectedMembers.length === 0 && (
          <button
            type="button"
            onClick={openDialogue}
            className="mission-status"
            aria-label={`查看任务简报：${mission.goal}`}
          >
            <strong>{mission.title}</strong>
            <span>
              {mission.objective === 'capture'
                ? `控制电台 ${view.campaign.captureProgress.toFixed(0)} / 15秒`
                : mission.objective === 'defend'
                  ? '守住己方指挥部'
                  : '摧毁敌方指挥部'}
            </span>
          </button>
        )}
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
          <button className="text-button return-home" onClick={onExit}>
            返回整备
          </button>
          <span className="live-label">
            <i /> {DIFFICULTY_LABEL[difficulty]} ·{' '}
            {DIFFICULTY_BONUS[difficulty]}
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
            aria-label={sound ? '关闭声音' : '开启声音'}
            title={sound ? '关闭声音' : '开启声音'}
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
                  : (mission?.title ?? '作战进行中')}
          </span>
          <strong>{timeString(Math.ceil(timeLimit - view.time))}</strong>
          {mission && view.campaign ? (
            <button
              type="button"
              className="mission-clock-goal"
              onClick={openDialogue}
              aria-label="查看任务简报"
            >
              {mission.objective === 'capture'
                ? `电台 ${view.campaign.captureProgress.toFixed(0)} / 15秒`
                : mission.objective === 'defend'
                  ? '守住己方指挥部'
                  : '摧毁敌方指挥部'}
            </button>
          ) : (
            <div className="clock-dots">
              <i />
              <i />
              <i />
            </div>
          )}
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
        className={`battlefield ${card?.targetGround ? 'is-targeting' : ''}`}
        aria-label="像素战场"
      >
        <canvas
          ref={canvas}
          width={viewportWidth}
          height={H}
          tabIndex={0}
          aria-label="左右拖动战场移动视野。拖出底部手牌区并松手出牌，单位从己方基地入场。数字键选牌，回车出牌；目标技能可用方向键调整位置。"
          onPointerDown={(e) => {
            if (e.button !== 0 || cardGesture.current) return;
            if (e.pointerType !== 'mouse') setTouchMode(true);
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
            if (
              !didDrag.current &&
              selectedRef.current === null &&
              game.current.status === 'playing'
            ) {
              const rect = e.currentTarget.getBoundingClientRect();
              const found = pickSquad(
                game.current,
                0,
                canvasX(e.clientX),
                ((e.clientY - rect.top) / rect.height) * H,
                e.pointerType !== 'mouse',
              );
              if (found !== null) {
                const result = selectUnitGroup(game.current, 0, found);
                if (!result.ok) toast(result.message);
                refresh();
              }
              selectSquad(found === selectedSquadRef.current ? null : found);
            }
            if (e.currentTarget.hasPointerCapture(e.pointerId))
              e.currentTarget.releasePointerCapture(e.pointerId);
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
        />
        {active &&
          !panel &&
          selectedMembers.length > 0 &&
          squadX >= cameraView &&
          squadX <= cameraView + viewportWidth && (
            <SquadMenu
              x={((squadX - cameraView) / viewportWidth) * 100}
              y={(squadY / H) * 100}
              name={CARDS[selectedMembers[0].id].name}
              count={selectedMembers.length}
              unitLabel={
                CARDS[selectedMembers[0].id].members
                  ? '人'
                  : CARDS[selectedMembers[0].id].air
                    ? '架'
                    : CARDS[selectedMembers[0].id].emplacement
                      ? '门'
                      : '辆'
              }
              orders={ordersForUnit(selectedMembers[0].id)}
              order={
                selectedMembers[0].squadOrder ??
                (selectedMembers[0].escortTankUid !== undefined
                  ? 'escort'
                  : undefined)
              }
              progress={squadTrench?.progress}
              onOrder={(order) => {
                const result = setSquadOrder(
                  game.current,
                  0,
                  selectedSquad!,
                  order,
                );
                if (!result.ok) toast(result.message);
                refresh();
              }}
              onClose={() => selectSquad(null)}
            />
          )}
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
            {draggedCard
              ? draggedCard.outside
                ? '松手使用 · 拖回手牌区取消'
                : '拖出底部手牌区使用'
              : '拖出手牌并松手下令 · 长按查看详情'}
            {card && (
              <button onClick={() => choose(null)} aria-label="取消选择">
                <X size={13} />
                取消
              </button>
            )}
          </div>
        )}
        {p.morale > 0 && (
          <div className="buff-label">
            <Sparkles size={13} />
            士气鼓舞 · {Math.ceil(p.morale)}s
          </div>
        )}
        {p.recon > 0 && (
          <div className="recon-label">
            <Binoculars size={14} /> 校射 +20% · {Math.ceil(p.recon)}s
          </div>
        )}
        {view.status === 'ready' && !dialogueOpen && (
          <div className="start-scrim">
            <div className="launch">
              <div className="operation">
                <i /> OPERATION: GREYLINE <i />
              </div>
              <h1>战线，由你推进。</h1>
              <p>
                {mission
                  ? mission.goal
                  : '部署部队，下达指令。夺下村落另一端的指挥部。'}
              </p>
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
                <span>
                  {Math.round(timeLimit / 60)} 分钟{mission ? '任务' : '对局'}
                </span>
                <i />
                <span>可破坏地形</span>
              </div>
            </div>
          </div>
        )}
        {view.status === 'paused' && !panel && !dialogueOpen && (
          <div className="pause-scrim">
            <div className="pause-card">
              <Pause size={25} />
              <h2>战场已暂停</h2>
              <p>准备好了，就继续推进。</p>
              <p className="match-rules-note">
                {DIFFICULTY_LABEL[difficulty]} · {DIFFICULTY_BONUS[difficulty]}{' '}
                · 双方开局2点
              </p>
              {mission && <p>{mission.goal}</p>}
              {mission && (
                <button className="text-button" onClick={openDialogue}>
                  重听任务简报
                </button>
              )}
              <button className="primary-button" onClick={pause}>
                继续作战
                <Play size={16} />
              </button>
              <button className="text-button" onClick={reset}>
                <RotateCcw size={14} />
                重新整备
              </button>
              <div className="audio-settings">
                <div className="audio-settings-heading">
                  <span>战场声音</span>
                  <button onClick={toggleSound} aria-pressed={sound}>
                    {sound ? <Volume2 size={15} /> : <VolumeX size={15} />}
                    {sound ? '已开启' : '已静音'}
                  </button>
                </div>
                <label>
                  <span>音效</span>
                  <input
                    aria-label="音效音量"
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(audioSettings.effects * 100)}
                    onChange={(e) =>
                      changeAudio({ effects: Number(e.target.value) / 100 })
                    }
                  />
                  <output>{Math.round(audioSettings.effects * 100)}%</output>
                </label>
                <label>
                  <span>音乐</span>
                  <input
                    aria-label="音乐音量"
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(audioSettings.music * 100)}
                    onChange={(e) =>
                      changeAudio({ music: Number(e.target.value) / 100 })
                    }
                  />
                  <output>{Math.round(audioSettings.music * 100)}%</output>
                </label>
                <a
                  href={assetUrl('/audio/credits.html')}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  音乐与音效来源
                </a>
              </div>
              <div className="mobile-pause-options">
                <button onClick={() => openPanel('deck')}>检阅牌库</button>
                <button onClick={onExit}>返回整备</button>
              </div>
              <div className="mobile-pause-orders">
                <span>步兵指令</span>
                {(
                  [
                    ['hold', '驻守'],
                    ['advance', '推进'],
                    ['rush', '奔跑'],
                    ['crouch', '蹲行'],
                    ['prone', '卧倒'],
                  ] as [Order, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={p.order === value}
                    onClick={() => {
                      setOrder(game.current!, 0, value);
                      refresh();
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
        {view.status === 'finished' && (
          <div className="pause-scrim">
            <div className="result-card">
              <span className="operation">
                {mission
                  ? `${mission.chapter} · ${mission.title}`
                  : 'OPERATION COMPLETE'}
              </span>
              <h2>
                {view.result === 0
                  ? '作战胜利'
                  : view.result === 1
                    ? '防线失守'
                    : '双方平局'}
              </h2>
              <p>
                {mission
                  ? view.result === 0
                    ? mission.victory
                    : mission.defeat
                  : view.result === 0
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
              {mission && view.result === 0 && onNextMission && (
                <button className="primary-button" onClick={onNextMission}>
                  进入下一章
                  <ArrowRight size={17} />
                </button>
              )}
              <button className="primary-button" onClick={reset}>
                {mission ? '重打本章' : '再来一局'}
                <RotateCcw size={17} />
              </button>
              <button className="text-button mobile-exit" onClick={onExit}>
                {mission ? '返回战役' : '返回整备'}
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
          已发现敌军{' '}
          {
            view.units.filter((u) => u.side === 1 && u.hp > 0 && !u.surrendered)
              .length
          }
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
            mapPointer.current = e.pointerId;
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
          {view.batteryReports?.map((r) => (
            <i
              key={r.uid}
              className="map-battery"
              style={{
                left: `${(r.x / W) * 100}%`,
                opacity: Math.min(1, r.life / (r.maxLife * 0.5)),
              }}
              title={`敌方炮位 ${Math.ceil(r.life)}s`}
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
                .filter((u) => u.side === 0 && u.hp > 0 && !u.surrendered)
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
                  ? '原地警戒，队员自主蹲伏还击'
                  : '队员自主判断 · 交替掩护推进'}
        </small>
      </div>
      <div className="casualty-readout">
        伤员{' '}
        {view.units.filter((u) => u.side === 0 && u.wounded && u.hp > 0).length}{' '}
        人 · 军医可靠近救起 / 急救卡可治疗
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
            <span>/ {p.energyCap}</span>
            <small>+1 / {p.energyInterval.toFixed(1)}s</small>
          </div>
          <div
            className="energy-segments"
            aria-label={`指挥点 ${Math.floor(p.energy)}/${p.energyCap}`}
          >
            {Array.from({ length: p.energyCap }, (_, i) => (
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
            <span className="economy-match-note">
              {DIFFICULTY_LABEL[difficulty]} · {DIFFICULTY_BONUS[difficulty]}
              {p.bondDueAt !== null
                ? ` · 公债 ${Math.max(0, Math.ceil(p.bondDueAt - view.time))}秒后结算`
                : ''}
              {p.overdraftUntil !== null && p.overdraftUntil > view.time
                ? ` · 透支中 ${Math.max(0, Math.ceil(p.overdraftUntil - view.time))}秒`
                : ''}
              {p.suppressedUntil !== null && p.suppressedUntil > view.time
                ? ` · 遭压制 ${Math.max(0, Math.ceil(p.suppressedUntil - view.time))}秒`
                : ''}
            </span>
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
                  <button
                    className="inspect-card-button"
                    onClick={() => openPanel('card')}
                  >
                    查看卡面
                  </button>
                </div>
                <p>{card.detail}</p>
                {card.readyIn > 0 && (
                  <p>整备中 · {Math.ceil(card.readyIn)} 秒后可再次派遣</p>
                )}
                <span className="target-hint">
                  <Crosshair size={13} />
                  {card.type === 'unit'
                    ? '拖出手牌区松手，从己方基地入场'
                    : card.targetGround
                      ? '拖出手牌区，以松手位置为目标'
                      : '拖出手牌区松手使用'}
                </span>
              </>
            ) : (
              <>
                <span className="panel-eyebrow">指挥提示</span>
                <p>
                  狙击与迫击炮留在后方，医疗组跟进救治；烟幕可掩护前排推进。
                </p>
              </>
            )}
          </div>
        </aside>
        <div className="hand-section">
          <div className="hand-heading">
            <div>
              <Layers3 size={16} />
              <strong>战术手牌</strong>
              <button
                className="inspect-deck"
                onClick={() => openPanel('deck')}
              >
                查看卡组
              </button>
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
              ) : p.drawIn > 0 ? (
                `抽牌冷却 ${Math.ceil(p.drawIn)}s`
              ) : (
                '点击角落牌堆 · 2 点抽一张'
              )}
            </span>
          </div>
          <div className="hand-and-deck">
            <div className="hand-cards" ref={handArea}>
              {p.hand.map((h, i) => {
                const c = h;
                return (
                  <button
                    key={h.uid}
                    style={
                      {
                        '--fan-index': i - (p.hand.length - 1) / 2,
                        '--fan-angle': `${(i - (p.hand.length - 1) / 2) * 5}deg`,
                        '--fan-y': `${Math.pow(i - (p.hand.length - 1) / 2, 2) * 5}px`,
                        zIndex: selected === h.uid ? 30 : i + 1,
                      } as CSSProperties
                    }
                    className={`tactical-card ${c.type} ${selected === h.uid ? 'selected' : ''} ${p.energy < c.cost || c.readyIn > 0 ? 'unaffordable' : ''} ${draggedCard?.uid === h.uid ? 'is-dragging' : ''}`}
                    onClick={() => {
                      if (heldClick.current === h.uid) {
                        heldClick.current = null;
                        return;
                      }
                      selectCard(h);
                    }}
                    onPointerDown={(e) => {
                      if (e.button !== 0 || !active) return;
                      if (!e.isPrimary || cardGesture.current) {
                        interruptCardHold();
                        return;
                      }
                      if (e.pointerType !== 'mouse') setTouchMode(true);
                      cancelCardHold();
                      heldClick.current = null;
                      const rect = e.currentTarget.getBoundingClientRect();
                      const handRect =
                        handArea.current!.getBoundingClientRect();
                      const boxes = Array.from(
                        handArea.current!.querySelectorAll('.tactical-card'),
                        (el) => el.getBoundingClientRect(),
                      );
                      cardGesture.current = {
                        uid: h.uid,
                        pointer: e.pointerId,
                        startX: e.clientX,
                        startY: e.clientY,
                        centerX: rect.left + rect.width / 2,
                        centerY: rect.top + rect.height / 2,
                        width: e.currentTarget.offsetWidth,
                        dragging: false,
                        bounds: {
                          left: Math.min(...boxes.map((b) => b.left)),
                          right: Math.max(...boxes.map((b) => b.right)),
                          top: handRect.top,
                          bottom: Math.max(
                            handRect.bottom,
                            ...boxes.map((b) => b.bottom),
                          ),
                        },
                      };
                      e.currentTarget.setPointerCapture(e.pointerId);
                      cardHold.current = {
                        uid: h.uid,
                        pointer: e.pointerId,
                        x: e.clientX,
                        y: e.clientY,
                        timer: setTimeout(() => {
                          heldClick.current = h.uid;
                          cardHold.current = null;
                          inspectHandCard(h.uid);
                        }, 450),
                      };
                    }}
                    onPointerMove={(e) => {
                      const gesture = cardGesture.current;
                      if (!gesture || gesture.pointer !== e.pointerId) return;
                      if (
                        !gesture.dragging &&
                        Math.hypot(
                          e.clientX - gesture.startX,
                          e.clientY - gesture.startY,
                        ) <= 8
                      )
                        return;
                      if (!gesture.dragging) {
                        gesture.dragging = true;
                        cancelCardHold();
                        heldClick.current = h.uid;
                        choose(h.uid);
                      }
                      gesture.bounds = handBounds() ?? gesture.bounds;
                      setDraggedCard(
                        dragPosition(gesture, e.clientX, e.clientY),
                      );
                      if (needsTarget(h.id)) {
                        hover.current = Math.max(
                          0,
                          Math.min(W, canvasX(e.clientX)),
                        );
                        pointerScreen.current = hover.current - camera.current;
                      }
                    }}
                    onPointerUp={(e) => {
                      const gesture = cardGesture.current;
                      if (!gesture || gesture.pointer !== e.pointerId) return;
                      gesture.bounds = handBounds() ?? gesture.bounds;
                      const release = dragPosition(
                        gesture,
                        e.clientX,
                        e.clientY,
                      );
                      cardGesture.current = null;
                      cancelCardHold();
                      setDraggedCard(null);
                      if (e.currentTarget.hasPointerCapture(e.pointerId))
                        e.currentTarget.releasePointerCapture(e.pointerId);
                      if (!gesture.dragging) return;
                      heldClick.current = h.uid;
                      choose(null);
                      if (
                        release.outside &&
                        !portraitGate.current &&
                        !document.hidden
                      ) {
                        execute(
                          h.uid,
                          needsTarget(h.id)
                            ? Math.max(0, Math.min(W, canvasX(e.clientX)))
                            : undefined,
                        );
                      }
                    }}
                    onPointerCancel={interruptCardHold}
                    onLostPointerCapture={interruptCardHold}
                    onContextMenu={(e) => e.preventDefault()}
                    draggable={false}
                    aria-label={`${i + 1}，${c.name}，${c.cost}指挥点，${c.description}。拖出手牌区松手使用，长按查看详情。`}
                    aria-pressed={selected === h.uid}
                  >
                    <CardFace id={c.id} cost={c.cost} eager />
                    <kbd className="hand-card-key">{i + 1}</kbd>
                    {(c.readyIn > 0 || c.returnedOnce) && (
                      <span className="hand-card-status">
                        {c.readyIn > 0
                          ? `整备 ${Math.ceil(c.readyIn)}s`
                          : '返航 · 补给费用'}
                      </span>
                    )}
                  </button>
                );
              })}
              {p.hand.length === 0 && (
                <div className="empty-hand">
                  <Layers3 size={30} />
                  <p>手牌已用尽</p>
                  <span>{p.deckCount ? '点击牌堆，消耗 2 点抽牌' : '牌库已耗尽，继续指挥场上部队'}</span>
                </div>
              )}
            </div>
          </div>
        </div>
        <button
          className="deck-pile"
          onClick={drawCard}
          disabled={
            !active ||
            p.energy < DRAW_COST ||
            p.hand.length >= 6 ||
            p.jam > 0 ||
            p.drawIn > 0 ||
            p.deckCount === 0
          }
          aria-label="消耗 2 点指挥点抽一张牌"
        >
          <img
            className="deck-card-back"
            src={assetUrl('/art/card-back-v1.webp')}
            alt="牌堆"
            draggable={false}
          />
          <span className="deck-label">{p.deckCount ? '抽牌 · 2 点' : '牌库已耗尽'}</span>
          <strong>
            {p.deckCount}
            <small> 张</small>
          </strong>
          <span className="deck-sub">
            {p.deckCount === 0
              ? '用过的牌不会自动洗回'
              : p.jam > 0
              ? `受扰 ${Math.ceil(p.jam)}s`
              : p.drawIn > 0
                ? `${Math.ceil(p.drawIn)}s 冷却`
                : p.hand.length >= 6
                  ? '手牌已满'
                  : '点击抽牌 / R'}
          </span>
          <div className="draw-progress">
            <i style={{ width: `${(1 - p.drawIn / DRAW_TIME) * 100}%` }} />
          </div>
        </button>
      </section>
      {active &&
        draggedCard &&
        (() => {
          const h = p.hand.find((h) => h.uid === draggedCard.uid);
          if (!h) return null;
          const blocked = h.readyIn > 0 || p.energy < h.cost;
          return createPortal(
            <div
              className={`dragged-card ${draggedCard.outside ? 'can-release' : ''} ${blocked ? 'drag-blocked' : ''}`}
              style={{
                left: draggedCard.x,
                top: draggedCard.y,
                width: draggedCard.width,
              }}
              aria-hidden="true"
            >
              <CardFace id={h.id} cost={h.cost} eager />
              <span className="drag-release-label">
                {h.readyIn > 0
                  ? `整备 ${Math.ceil(h.readyIn)}s`
                  : p.energy < h.cost
                    ? '指挥点不足'
                    : draggedCard.outside
                      ? '松手使用'
                      : '拖出手牌区使用'}
              </span>
            </div>,
            document.body,
          );
        })()}
      <footer>
        <span>
          GREYLINE <i /> 林间前线 · v135
        </span>
        <span>
          <kbd>A / D</kbd> 移动视野 <kbd>1–6</kbd> 选牌 <kbd>← →</kbd> 落点{' '}
          <kbd>Enter</kbd> 出牌 <kbd>Space</kbd> 暂停
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
          className={`manual-dialog ${panel === 'deck' ? 'deck-dialog' : panel === 'card' ? 'card-detail-dialog' : ''} ${panel === 'card' && touchMode ? 'mobile-card-dialog' : ''}`}
        >
          <DialogTitle className="manual-title">
            {panel === 'deck'
              ? '战术牌库'
              : panel === 'card'
                ? inspectionCard?.name
                : '作战手册'}
          </DialogTitle>
          <DialogDescription>
            {panel === 'card'
              ? inspectionCard?.tag
              : panel === 'deck'
                ? `${playerDeck.length} 张自选牌库 · 双方独立抽牌 · 牌库耗尽后不再自动补充。`
                : '灰线 / 林间前线 · 单线即时卡牌对战'}
          </DialogDescription>
          {panel === 'card' && inspectionCard ? (
            <div className="card-inspection-body">
              <CardFace
                id={inspectionCard.id}
                cost={inspectionCard.cost}
                className="detail-card-face"
                eager
              />
              <div className="card-inspection-copy">
                <p>{inspectionCard.detail}</p>
                <blockquote className="card-flavor-quote">
                  {CARD_COPY[inspectionCard.id].flavor}
                </blockquote>
                {inspectionCard.readyIn > 0 && (
                  <p>
                    整备中 · {Math.ceil(inspectionCard.readyIn)} 秒后可再次派遣
                  </p>
                )}
                <button className="text-button" onClick={closePanel}>
                  返回战场
                </button>
              </div>
            </div>
          ) : panel === 'guide' ? (
            <>
              <div className="guide-grid">
                <div>
                  <span>01 / 目标</span>
                  <h3>夺下敌方指挥部</h3>
                  <p>
                    基地初始 1,000 生命。摧毁敌方基地立即获胜；10
                    分钟后，基地剩余生命更高的一方获胜，相同则平局。
                  </p>
                </div>
                <div>
                  <span>02 / 部署</span>
                  <h3>拖出手牌，松手下令</h3>
                  <p>
                    战场横跨多个屏幕，左右拖动、滚轮或 A/D
                    移动视野，也可点击小地图。拖出底部扇形手牌区后松手即使用，拖回区域内松手取消；长按查看卡牌。单位从己方基地入场。炮兵随前线护卫牵引，到达有效射程后架设固定。烟幕和地雷以松手位置为目标。每个班组由
                    2–7
                    名独立士兵组成。点击己方小队，可选择据守、撤退、进攻、警戒或伴随。未收到明确指令的步兵会自动跟随附近友军坦克，进攻指令可解除伴随。据守约六秒挖好全队共用的战壕并布置两枚地雷，每队一次；撤退会交替掩护，到位后警戒。房屋与废墟可以绕行穿过，仍提供掩护；只有真实墙体和明显陡坎需要攀越。
                  </p>
                </div>
                <div>
                  <span>03 / 补给</span>
                  <h3>合理分配指挥点</h3>
                  <p>
                    开局随机 6 张手牌、2 指挥点，基础每 3.6 秒恢复 1 点，上限
                    10。战地后勤可加快恢复，指挥扩编可提升上限，战时公债可在18秒后回款。主动点击牌堆，消耗
                    2 点抽 1 张，冷却 9
                    秒；不再自动抽牌。补给技能按卡面费用结算，无需额外支付抽牌费用。
                  </p>
                </div>
                <div>
                  <span>04 / 战术</span>
                  <h3>用好不同兵种</h3>
                  <p>
                    坦克用穿甲弹攻击装甲、高爆弹和同轴机枪攻击步兵；标枪、反坦克炮和地雷克制重装。防空导弹追踪空军。固定炮兵周期发射，落点有散布，士兵只在炮弹临近时分散卧倒。
                    树木和房屋有约一半概率拦下普通子弹，同一物体对每发子弹只判一次。弹坑、倒树、废墙和载具残骸仍可掩护步兵。房屋、树木缩短观察距离；视野内正常彩色，视野外黑白，未发现的敌人不显示。榴弹烟尘短小，火炮保留大范围爆炸。飞机快速通场，存活返航后回手并整备，再次派遣费用降低；满手回弃牌，被击落恢复原价。撤退队员经过友军射线会遭受误伤。
                  </p>
                </div>
              </div>
              <div className="guide-note">
                <Radio size={18} />
                <p>
                  AI 从独立组建的 20 张牌库抽牌。当前难度：
                  {DIFFICULTY_LABEL[difficulty]}，{DIFFICULTY_BONUS[difficulty]}
                  。双方开局均为2点，卡牌费用和抽牌规则相同。离开页面会自动暂停；返回后点击继续作战。
                </p>
              </div>
              <button className="primary-button" onClick={closePanel}>
                明白，返回战场
                <ArrowRight size={16} />
              </button>
            </>
          ) : (
            <div className="catalog">
              {deckCards.map((c, index) => (
                <div
                  className={`catalog-card ${c.type}`}
                  key={`${c.id}-${index}`}
                >
                  <CardFace id={c.id} />
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
                    <blockquote className="card-flavor-quote">
                      {CARD_COPY[c.id].flavor}
                    </blockquote>
                    {c.range && (
                      <span className="range-readout">
                        有效射程 {c.minRange ? c.minRange + '–' : ''}
                        {c.range}
                      </span>
                    )}
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
