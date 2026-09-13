import { CARDS, type CardId } from './cards';
import { setSquadOrder, trenchCutDepth } from './squad-orders';
import type { GameState, Side } from './engine';
import type { MapId } from './maps';

export type MissionId = 'salt-road' | 'ridge-relay' | 'river-counterattack';
export interface CampaignState {
  id: MissionId;
  duration: number;
  objective: 'defend' | 'capture' | 'assault';
  objectiveX: number;
  captureProgress: number;
  waveIndex: number;
  initialCamera: number;
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
export interface Mission {
  id: MissionId;
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
  opening: Deployment[];
  waves: Wave[];
}
export const MISSIONS: Mission[] = [
  {
    id: 'salt-road',
    title: '盐路哨站',
    chapter: '第一章',
    region: '南部旱原 · 拂晓',
    mapId: 'desert',
    objective: 'defend',
    objectiveX: 1440,
    duration: 180,
    camera: 760,
    briefing:
      '停火后的第九天，盐路上的运输队失去联络。你的小队守着仅剩的无线电中继站。后方正在撤走伤员，三分钟内，这条路不能断。',
    goal: '坚持3分钟，己方指挥部不能被摧毁。',
    preparation:
      '两班步兵与一班机枪已进入共用战壕，壕前有防步兵雷。敌军另有三轮预定增援，双方仍可正常出牌。',
    victory:
      '最后一辆救护车驶离盐路。电台里终于传来回话：山口的旧中继站还在敌军手里。',
    defeat:
      '电台在撤离完成前中断。重新安排反甲和防空，别让守军独自承受重装火力。',
    opening: [
      { side: 0, id: 'infantry', x: 1400, dugIn: true },
      { side: 0, id: 'infantry', x: 1190, dugIn: true },
      { side: 0, id: 'machinegun', x: 1610, dugIn: true },
    ],
    waves: [
      {
        at: 8,
        cards: ['infantry', 'militia', 'pickup'],
        message: '盐路北侧出现一支轻装纵队。',
      },
      {
        at: 60,
        cards: ['tank', 'infantry', 'antiarmor'],
        message: '履带声正在接近。检查反甲支援。',
      },
      {
        at: 118,
        cards: ['helicopter', 'infantry'],
        message: '最后一批撤离车辆上路，敌方旋翼机也已抵达。',
      },
    ],
  },
  {
    id: 'ridge-relay',
    title: '岭口电台',
    chapter: '第二章',
    region: '中部山地 · 黄昏',
    mapId: 'mountains',
    objective: 'capture',
    objectiveX: 2650,
    duration: 300,
    camera: 440,
    briefing:
      '盐路守住了，沿线驻军却仍听不见彼此。岭口的电台能接通整片山谷。装甲车队已经集结，你需要让步兵伴随坦克接近，而不是先一步冲进山口。',
    goal: '5分钟内让可作战步兵控制电台区域15秒。敌方近处守军会阻止占领。',
    preparation:
      '己方有一辆坦克和两班步兵。敌方战壕、雷区与反甲组守住山口，电台有武警驻守；90秒和180秒另有增援。',
    victory:
      '电台恢复供电。失联的河岸驻军传来坐标，他们还守着渡口，等你从侧后方赶到。',
    defeat: '电台仍在敌军手里。让掩护火力先到位，再把步兵送进占领区。',
    opening: [
      { side: 0, id: 'tank', x: 950 },
      { side: 0, id: 'infantry', x: 830 },
      { side: 0, id: 'infantry', x: 660 },
      { side: 1, id: 'infantry', x: 2590, dugIn: true },
      { side: 1, id: 'machinegun', x: 2820, dugIn: true },
      { side: 1, id: 'antiarmor', x: 2970, dugIn: true },
      { side: 1, id: 'armed_police', x: 2590, guard: true },
    ],
    waves: [
      {
        at: 90,
        cards: ['militia', 'pickup'],
        message: '山口后方的守军正在增援电台。',
      },
      {
        at: 180,
        cards: ['antiarmor', 'infantry'],
        message: '第二支增援纵队抵达山路。',
      },
    ],
  },
  {
    id: 'river-counterattack',
    title: '渡口余烬',
    chapter: '第三章',
    region: '北部河谷 · 阴天',
    mapId: 'greyline',
    objective: 'assault',
    objectiveX: 3680,
    duration: 360,
    camera: 650,
    briefing:
      '接通电台后，你终于拼出了整条战线。河岸驻军没有撤走，他们将最后的燃料留给了你的坦克。六分钟后桥面会被封锁，这是夺回渡口的最后一次机会。',
    goal: '6分钟内摧毁敌方指挥部，同时保住己方指挥部。',
    preparation:
      '己方阵地有两班已入壕步兵和一辆坦克；敌方有机枪、反甲阵地与步战车，另有两轮增援。',
    victory:
      '渡口重新开放。没有庆典，只有一队接一队的车辆驶过桥面。战役结束，沿线哨站重新接通。',
    defeat: '反击没能赶在封桥前完成。发育可以换来后劲，但前线也需要及时增援。',
    opening: [
      { side: 0, id: 'infantry', x: 1320, dugIn: true },
      { side: 0, id: 'infantry', x: 1120, dugIn: true },
      { side: 0, id: 'tank', x: 980 },
      { side: 1, id: 'machinegun', x: 2560, dugIn: true },
      { side: 1, id: 'antiarmor', x: 2780, dugIn: true },
      { side: 1, id: 'ifv', x: 3000 },
    ],
    waves: [
      {
        at: 85,
        cards: ['infantry', 'mortar_carrier'],
        message: '敌军迫击炮车正在向渡口转移。',
      },
      {
        at: 175,
        cards: ['tank', 'helicopter'],
        message: '敌方装甲预备队抵达。渡口不会等到天黑。',
      },
    ],
  },
];
export const missionById = (id: MissionId) =>
  MISSIONS.find((m) => m.id === id)!;
export const isMissionId = (id: unknown): id is MissionId =>
  MISSIONS.some((m) => m.id === id);
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
  s.campaign = {
    id,
    duration: m.duration,
    objective: m.objective,
    objectiveX: m.objectiveX,
    captureProgress: 0,
    waveIndex: 0,
    initialCamera: m.camera,
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
  if (!c) return;
  const m = missionById(c.id);
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
        15,
        c.captureProgress + (occupying && !contested ? dt : -dt * 2),
      ),
    );
  }
}
export function campaignResult(s: GameState): Side | null {
  const c = s.campaign;
  if (!c) return null;
  if (s.players[0].hp <= 0) return 1;
  if (s.players[1].hp <= 0) return 0;
  if (c.objective === 'capture' && c.captureProgress >= 15) return 0;
  if (s.time >= c.duration) return c.objective === 'defend' ? 0 : 1;
  return null;
}
