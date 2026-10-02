import { CARDS, type CardId } from './cards';
import { setSquadOrder, trenchCutDepth } from './squad-orders';
import type { GameState, Side } from './engine';
import type { MapId } from './maps';
import { DECK_PRESETS } from './deck-presets';
import { CAMPAIGN_MISSIONS } from './campaign-missions';

export type MissionId =
  | 'salt-road'
  | 'ridge-relay'
  | 'river-counterattack'
  | 'canopy-signal'
  | 'last-convoy'
  | 'silent-terminal'
  | 'border-archive'
  | 'white-flag-crossing'
  | 'quarry-transmitter'
  | 'three-key-network'
  | 'open-corridor'
  | 'canal-bridge'
  | 'railway-magazine'
  | 'storm-refuge'
  | 'two-sided-road'
  | 'ridge-parley'
  | 'shared-aid-station'
  | 'last-command-post'
  | 'broadcast-before-dawn'
  | 'land-reconnected';
export interface CampaignState {
  id: MissionId;
  duration: number;
  objective: 'defend' | 'capture' | 'assault';
  objectiveX: number;
  captureProgress: number;
  waveIndex: number;
  hintIndex?: number;
  initialCamera: number;
  objectiveIndex?: number;
  captureRequired?: number;
  objectiveLabel?: string;
  reinforcementIndex?: number;
}
interface Deployment {
  side: Side;
  id: CardId;
  x: number;
  dugIn?: boolean;
  guard?: boolean;
}
interface Wave {
  at: number;
  cards: CardId[];
  message: string;
}
export interface RadioLine {
  speaker: string;
  text: string;
}
export interface Mission {
  id: MissionId;
  act: 1 | 2 | 3 | 4;
  actTitle: string;
  aiDeck: number;
  playerDeck: number;
  night?: boolean;
  startingEnergy?: number;
  playerBaseHp?: number;
  enemyBaseHp?: number;
  capturePoints?: { x: number; label: string; seconds: number }[];
  reinforcements?: {
    at: number;
    cards: CardId[];
    x: number;
    message: string;
  }[];
  title: string;
  chapter: string;
  region: string;
  mapId: MapId;
  objective: CampaignState['objective'];
  objectiveX: number;
  duration: number;
  camera: number;
  briefing: string;
  goal: string;
  preparation: string;
  victory: string;
  defeat: string;
  openingDialogue: RadioLine[];
  phaseHints: { at: number; text: string }[];
  opening: Deployment[];
  waves: Wave[];
}
export const MISSIONS: Mission[] = CAMPAIGN_MISSIONS;
export const missionById = (id: MissionId) =>
  MISSIONS.find((m) => m.id === id)!;
export const isMissionId = (id: unknown): id is MissionId =>
  MISSIONS.some((m) => m.id === id);
export function missionDeck(id: MissionId): CardId[] {
  return [...DECK_PRESETS[missionById(id).playerDeck].cards];
}
export function missionDeckName(id: MissionId): string {
  return DECK_PRESETS[missionById(id).playerDeck].name;
}
export function missionUnlocked(
  id: MissionId,
  completed: readonly MissionId[],
) {
  const index = MISSIONS.findIndex((m) => m.id === id);
  return (
    index >= 0 &&
    (completed.includes(id) ||
      index === 0 ||
      completed.includes(MISSIONS[index - 1].id))
  );
}
export function campaignProgress(completed: readonly MissionId[]) {
  const valid = new Set(completed.filter(isMissionId));
  const next =
    MISSIONS.find((m) => !valid.has(m.id) && missionUnlocked(m.id, [...valid]))
      ?.id ?? null;
  return {
    completed: valid.size,
    total: MISSIONS.length,
    next,
    finished: valid.size === MISSIONS.length,
  };
}
type Hooks = {
  spawn: (s: GameState, side: Side, id: CardId, x: number) => void;
  refresh: (s: GameState) => void;
};

/** Scenario fortifications use the same smooth chamber and cover rules as player construction. */
function preparePosition(s: GameState, side: Side, squad: number) {
  const members = s.units.filter((u) => u.squad === squad && u.side === side);
  const starts = members.map((u) => u.x);
  let trench: NonNullable<GameState['entrenchments']>[number] | undefined;
  // Authored troops may shift within their deployment sector to leave trees,
  // houses and other prepared chambers intact; each squad keeps its own chamber.
  const offsets = [
    0,
    ...Array.from({ length: 8 }, (_, i) => [
      -80 * (i + 1),
      80 * (i + 1),
    ]).flat(),
  ];
  for (const offset of offsets) {
    s.entrenchments = (s.entrenchments ?? []).filter(
      (t) => t.squad !== squad || t.side !== side,
    );
    members.forEach((u, i) => {
      u.x = Math.max(350, Math.min(s.terrain.length - 350, starts[i] + offset));
      u.y = s.terrain[Math.floor(u.x)];
      u.squadOrder = undefined;
    });
    const ordered = setSquadOrder(s, side, squad, 'hold');
    const candidate = s.entrenchments.find(
      (t) => t.squad === squad && t.side === side,
    );
    if (
      ordered.ok &&
      candidate &&
      !s.entrenchments.some(
        (t) =>
          t !== candidate &&
          Math.abs(t.x - candidate.x) < t.radius + candidate.radius + 28,
      )
    ) {
      trench = candidate;
      break;
    }
  }
  if (!trench) throw new Error('预设阵地没有可施工空地');
  trench.progress = 1;
  trench.built = true;
  trench.minesLaid = true;
  for (
    let x = Math.max(126, Math.ceil(trench.x - trench.radius));
    x <= Math.min(s.terrain.length - 127, trench.x + trench.radius);
    x++
  )
    s.terrain[x] = Math.max(
      s.terrain[x],
      s.original[x] + trenchCutDepth(s, trench, x),
    );
  s.terrainVersion++;
  for (const u of s.units.filter((u) => u.squad === squad && u.side === side)) {
    u.x = u.squadOrderX!;
    u.y = s.terrain[Math.floor(u.x)];
    u.lane = u.holdLane ?? 0;
    u.pose = 'crouch';
  }
  const dir = side === 0 ? 1 : -1;
  for (const offset of [45, 95])
    s.mines.push({
      uid: ++s.uid,
      side,
      x: trench.x + dir * (trench.radius + offset),
      armAt: 0,
      kind: 'antipersonnel',
    });
}
export function setupCampaign(s: GameState, id: MissionId, hooks: Hooks) {
  const m = missionById(id);
  const firstPoint = m.capturePoints?.[0];
  s.entrenchments ??= [];
  s.players[0].energy = m.startingEnergy ?? 2;
  s.players[0].hp = m.playerBaseHp ?? s.players[0].hp;
  s.players[1].hp = m.enemyBaseHp ?? s.players[1].hp;
  s.night = m.night ?? false;
  s.campaign = {
    id,
    duration: m.duration,
    objective: m.objective,
    objectiveX: firstPoint?.x ?? m.objectiveX,
    captureProgress: 0,
    waveIndex: 0,
    hintIndex: 0,
    initialCamera: m.camera,
    objectiveIndex: 0,
    captureRequired: firstPoint?.seconds ?? 15,
    objectiveLabel: firstPoint?.label ?? '电台',
    reinforcementIndex: 0,
  };
  const status = s.status;
  s.status = 'playing';
  for (const d of m.opening) {
    const first = s.units.length;
    hooks.spawn(s, d.side, d.id, d.x);
    if (d.dugIn) preparePosition(s, d.side, s.units[first].squad);
    else if (d.guard) setSquadOrder(s, d.side, s.units[first].squad, 'watch');
  }
  s.status = status;
  s.knownTerrain = [s.terrain.slice(), s.terrain.slice()];
  s.notices = [];
  hooks.refresh(s);
}
export function advanceCampaign(
  s: GameState,
  dt: number,
  spawn: Hooks['spawn'],
) {
  const c = s.campaign;
  if (!c || s.status !== 'playing') return;
  const m = missionById(c.id);
  let hintIndex = c.hintIndex ?? 0;
  while (
    hintIndex < m.phaseHints.length &&
    s.time >= m.phaseHints[hintIndex].at
  ) {
    s.notices.unshift({
      text: m.phaseHints[hintIndex++].text,
      time: s.time,
      kind: 'info',
      audience: [0],
    });
    s.notices = s.notices.slice(0, 5);
  }
  c.hintIndex = hintIndex;
  let reinforcementIndex = c.reinforcementIndex ?? 0;
  const reinforcements = m.reinforcements ?? [];
  while (
    reinforcementIndex < reinforcements.length &&
    s.time >= reinforcements[reinforcementIndex].at
  ) {
    const wave = reinforcements[reinforcementIndex++];
    wave.cards.forEach((id, i) =>
      spawn(
        s,
        0,
        id,
        Math.max(120, Math.min(s.terrain.length - 120, wave.x - i * 110)),
      ),
    );
    s.notices.unshift({
      text: wave.message,
      time: s.time,
      kind: 'good',
      audience: [0],
    });
    s.notices = s.notices.slice(0, 5);
  }
  c.reinforcementIndex = reinforcementIndex;
  while (c.waveIndex < m.waves.length && s.time >= m.waves[c.waveIndex].at) {
    const wave = m.waves[c.waveIndex++];
    wave.cards.forEach((id, i) =>
      spawn(s, 1, id, s.terrain.length - 120 - i * 95),
    );
    s.notices.unshift({
      text: wave.message,
      time: s.time,
      kind: 'warn',
      audience: [0],
    });
    s.notices = s.notices.slice(0, 5);
  }
  if (c.objective === 'capture') {
    const alive = s.units.filter(
      (u) =>
        u.hp > 0 &&
        !u.wounded &&
        !u.surrendered &&
        !u.rappelling &&
        !u.parachuting &&
        !CARDS[u.id].air,
    );
    const occupying = alive.some(
      (u) =>
        u.side === 0 &&
        CARDS[u.id].members &&
        Math.abs(u.x - c.objectiveX) <= 130,
    );
    const contested = alive.some(
      (u) => u.side === 1 && Math.abs(u.x - c.objectiveX) <= 210,
    );
    c.captureProgress = Math.max(
      0,
      Math.min(
        c.captureRequired ??
          m.capturePoints?.[c.objectiveIndex ?? 0]?.seconds ??
          15,
        c.captureProgress + (occupying && !contested ? dt : -dt * 2),
      ),
    );
    const nextPoint = m.capturePoints?.[(c.objectiveIndex ?? 0) + 1];
    if (
      nextPoint &&
      c.captureProgress >=
        (c.captureRequired ??
          m.capturePoints?.[c.objectiveIndex ?? 0]?.seconds ??
          15)
    ) {
      c.objectiveIndex = (c.objectiveIndex ?? 0) + 1;
      c.objectiveX = nextPoint.x;
      c.objectiveLabel = nextPoint.label;
      c.captureRequired = nextPoint.seconds;
      c.captureProgress = 0;
      s.notices.unshift({
        text: `阵地已接管，下一目标：${nextPoint.label}`,
        time: s.time,
        kind: 'good',
        audience: [0],
      });
      s.notices = s.notices.slice(0, 5);
    }
  }
}
export function campaignResult(s: GameState): Side | null {
  const c = s.campaign;
  if (!c) return null;
  if (s.players[0].hp <= 0) return 1;
  if (s.players[1].hp <= 0) return 0;
  const m = missionById(c.id);
  if (
    c.objective === 'capture' &&
    (c.objectiveIndex ?? 0) >= (m.capturePoints?.length ?? 1) - 1 &&
    c.captureProgress >=
      (c.captureRequired ??
        m.capturePoints?.[c.objectiveIndex ?? 0]?.seconds ??
        15)
  )
    return 0;
  if (s.time >= c.duration) return c.objective === 'defend' ? 0 : 1;
  return null;
}
