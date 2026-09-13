import { CARDS, type CardId } from './cards';
import { setSquadOrder, trenchCutDepth } from './squad-orders';
import type { GameState, Side } from './engine';
import type { MapId } from './maps';

export type MissionId =
  | 'salt-road'
  | 'ridge-relay'
  | 'river-counterattack'
  | 'canopy-signal'
  | 'last-convoy'
  | 'silent-terminal';
export interface CampaignState {
  id: MissionId;
  duration: number;
  objective: 'defend' | 'capture' | 'assault';
  objectiveX: number;
  captureProgress: number;
  waveIndex: number;
  hintIndex?: number;
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
export interface RadioLine {
  speaker: string;
  text: string;
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
  openingDialogue: RadioLine[];
  phaseHints: { at: number; text: string }[];
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
    openingDialogue: [
      {
        speaker: '联络官 · 许岚',
        text: '这里是许岚。停火已经九天，盐路的运输队却没有回来。有人还在交火，各处哨站听不见彼此。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '伤员还在往后方转运。两班步兵和机枪组已经入壕，但他们没有足够的反甲和防空。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '守住己方指挥部180秒。我们知道敌军会有三轮增援，别把指挥点全部花在眼前。',
      },
    ],
    phaseHints: [
      { at: 40, text: '许岚：撤离尚未完成。保留前线守军，准备反甲支援。' },
      { at: 135, text: '许岚：还要守45秒，别为了追敌放弃基地防线。' },
    ],
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
    openingDialogue: [
      {
        speaker: '联络官 · 许岚',
        text: '盐路的伤员撤出来了。我们接到几个零碎呼号，河岸驻军还活着，但山口电台挡住了联络。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '坦克和两班步兵已经集结。敌军守着电台和山口，还有反甲组；让步兵伴随掩护，别单独送车上去。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '300秒内，让可作战步兵控制电台15秒。附近敌军会阻止占领，坦克不能代替步兵完成任务。',
      },
    ],
    phaseHints: [
      {
        at: 55,
        text: '许岚：电台需要步兵接管。清掉近处守军，再让人留在标记内。',
      },
      {
        at: 225,
        text: '许岚：还剩75秒；电台被争夺或无人驻留时，占领进度会回落。',
      },
    ],
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
      '渡口重新开放，车辆陆续过桥。许岚却收到一份旧转运单：东部雨林里还有一支失联的救护队，那里从未收到停火通知。',
    defeat: '反击没能赶在封桥前完成。发育可以换来后劲，但前线也需要及时增援。',
    openingDialogue: [
      {
        speaker: '联络官 · 许岚',
        text: '岭口电台恢复了。河岸驻军把最后的燃料留给我们的坦克，他们已经守了太久。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '渡口对面的机枪、反甲阵地和步战车还在封锁道路。己方两班步兵已入壕，可以掩护后续部队展开。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '360秒内摧毁敌方指挥部，并保住我们的基地。敌军有两轮增援，夺回渡口后才能继续找失联的人。',
      },
    ],
    phaseHints: [
      { at: 55, text: '许岚：观察员要跟上。炮兵与反甲组只能打已发现的目标。' },
      {
        at: 270,
        text: '许岚：还剩90秒，任务是敌方指挥部；别让兵力停在已经清空的阵地。',
      },
    ],
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
  {
    id: 'canopy-signal',
    title: '雨林盲区',
    chapter: '第四章',
    region: '东部雨林 · 雨后',
    mapId: 'jungle',
    objective: 'capture',
    objectiveX: 2460,
    duration: 300,
    camera: 640,
    briefing:
      '渡口的旧转运单把你带进东部雨林。救护队最后一次报到来自林中中继站，此后只剩杂音。要找到他们，先让这座电台重新工作。',
    goal: '300秒内，让可作战步兵控制林中电台15秒。附近敌军会阻止占领。',
    preparation:
      '己方陆战队、侦察组、工兵与步战车沿林道展开；敌方步兵、机枪和武警守住电台。敌军在70秒、160秒增援，第二轮有旋翼机。',
    victory:
      '电台里传来久违的回话：救护队已到山间货站，等待最后一批撤离车辆。许岚把他们的呼号写在了地图边上。',
    defeat:
      '林中的呼叫再次被杂音盖住。侦察能找出目标，最后仍需要有人走进电台，把那里守住。',
    openingDialogue: [
      {
        speaker: '联络官 · 许岚',
        text: '转运单没有错。救护队进了这片雨林，他们一直没有收到停火消息，也没有收到我们的回话。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '林木会缩短观察距离。侦察组、工兵和陆战队已经到位，步战车沿林道提供支援。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '300秒内控制林中电台15秒。第二轮敌方增援有旋翼机，推进时别忘了防空。',
      },
    ],
    phaseHints: [
      { at: 40, text: '许岚：林间视野有限。让侦察先建立观察，再调火力接敌。' },
      {
        at: 125,
        text: '许岚：预报中的旋翼机将在35秒后进入增援航线，提前准备防空。',
      },
      { at: 240, text: '许岚：还剩60秒。电台必须有人驻留，车辆只能提供掩护。' },
    ],
    opening: [
      { side: 0, id: 'marines', x: 1130 },
      { side: 0, id: 'scouts', x: 1290 },
      { side: 0, id: 'engineers', x: 940 },
      { side: 0, id: 'ifv', x: 820 },
      { side: 1, id: 'infantry', x: 2420, guard: true },
      { side: 1, id: 'machinegun', x: 2700, guard: true },
      { side: 1, id: 'armed_police', x: 2480, guard: true },
    ],
    waves: [
      {
        at: 70,
        cards: ['assault', 'antiarmor'],
        message: '林道东侧出现突击组与反甲步兵。',
      },
      {
        at: 160,
        cards: ['helicopter', 'infantry'],
        message: '旋翼机进入雨林上空，后续步兵正沿林道赶来。',
      },
    ],
  },
  {
    id: 'last-convoy',
    title: '末班车队',
    chapter: '第五章',
    region: '山间货站 · 入夜前',
    mapId: 'mountains',
    objective: 'defend',
    objectiveX: 1440,
    duration: 240,
    camera: 800,
    briefing:
      '接通雨林电台后，救护队的位置终于明确。山间货站挤满了等待转运的人，敌军却正在向通道靠近。你要为末班车队争取四分钟。',
    goal: '守住己方指挥部240秒，为转运争取时间。',
    preparation:
      '己方武警、步兵与机枪已入壕，后方有军医和单兵防空组；敌军轻装先头已在前方。敌军在25、95、170秒增援，依次加入迫炮车、装甲与空中支援。',
    victory:
      '最后一批人离开了货站。救护队带回一份记录：北线终站仍在转发旧的开火命令，那是沿线最后一处封锁。',
    defeat:
      '转运尚未完成，货站的联络就中断了。现有防空只能支撑一部分压力，守军还需要反甲和持续增援。',
    openingDialogue: [
      {
        speaker: '联络官 · 许岚',
        text: '找到他们了。救护队就在这座货站，和他们一起的还有沿路撤来的居民。转运还需要四分钟。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '武警、步兵和机枪已经入壕，军医在后面，防空组也到了。敌方先头离得很近，这次没有太多展开时间。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '守住基地240秒。敌军会分三轮增加迫炮、装甲和空中支援，别让现有守军独自扛到最后。',
      },
    ],
    phaseHints: [
      {
        at: 60,
        text: '许岚：预置部队不是后续增援。留出反甲费用，守住通往基地的后方。',
      },
      {
        at: 140,
        text: '许岚：第三轮增援将在30秒后抵达，确认防空组仍有观察和掩护。',
      },
      {
        at: 205,
        text: '许岚：还要守35秒。不要追击，保住指挥部和仍能还击的成员。',
      },
    ],
    opening: [
      { side: 0, id: 'armed_police', x: 1600, dugIn: true },
      { side: 0, id: 'infantry', x: 1360, dugIn: true },
      { side: 0, id: 'machinegun', x: 1110, dugIn: true },
      { side: 0, id: 'medic', x: 860, guard: true },
      { side: 0, id: 'manpads', x: 1030, guard: true },
      { side: 1, id: 'infantry', x: 2420 },
      { side: 1, id: 'pickup', x: 2670 },
    ],
    waves: [
      {
        at: 25,
        cards: ['infantry', 'mortar_carrier'],
        message: '货站前方出现迫击炮车，步兵正在掩护它展开。',
      },
      {
        at: 95,
        cards: ['tank', 'antiarmor', 'infantry'],
        message: '敌方装甲纵队进入山路，反甲阵地准备接敌。',
      },
      {
        at: 170,
        cards: ['helicopter', 'strike_jet', 'infantry'],
        message: '敌军最后一轮空地增援到达，守住撤离通道。',
      },
    ],
  },
  {
    id: 'silent-terminal',
    title: '静默终站',
    chapter: '第六章',
    region: '北线终站 · 黎明',
    mapId: 'greyline',
    objective: 'assault',
    objectiveX: 3680,
    duration: 420,
    camera: 540,
    briefing:
      '盐路、电台、渡口和货站终于接成了一条线。北线终站仍在转发旧命令，阻止沿线撤离。摧毁它的指挥部，才能让这条通道真正安静下来。',
    goal: '420秒内摧毁敌方指挥部，同时保住己方指挥部。',
    preparation:
      '己方坦克、步兵、侦察与野战榴弹炮已经展开；敌方机枪、反甲组与单兵防空守在步战车和炮兵前方。敌军在90、210、300秒增援。',
    victory:
      '终站停止了转发。许岚依次呼叫盐路、岭口、渡口和货站，每一处都有人回答。路还很长，但这一次，车队不必在炮声里等消息了。',
    defeat:
      '终站仍在发出旧命令。把观察、反甲与掩护送到同一条前线，让炮兵和装甲真正接上进攻。',
    openingDialogue: [
      {
        speaker: '联络官 · 许岚',
        text: '盐路、电台、渡口、货站，现在都能互相听见了。只有终站还在转发旧的开火命令，拦住最后一段路。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '这次有坦克、步兵、侦察和榴弹炮支援。敌军的反甲与防空阵地都在，不要让任何一支部队单独冲进去。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '420秒内摧毁敌方指挥部，并守住自己的基地。让观察和护卫跟上，我们一起把这条线接完。',
      },
    ],
    phaseHints: [
      {
        at: 50,
        text: '许岚：炮兵需要前线观察。护卫到位后，再让重装接上火力。',
      },
      {
        at: 165,
        text: '许岚：敌军第二轮增援将在45秒后到达，别把所有反制留在基地后方。',
      },
      {
        at: 330,
        text: '许岚：最后90秒。整理还能推进的部队，目标是终站指挥部。',
      },
    ],
    opening: [
      { side: 0, id: 'tank', x: 1100 },
      { side: 0, id: 'infantry', x: 960 },
      { side: 0, id: 'infantry', x: 750 },
      { side: 0, id: 'scouts', x: 1250 },
      { side: 0, id: 'artillery', x: 570 },
      { side: 1, id: 'machinegun', x: 2410, dugIn: true },
      { side: 1, id: 'antiarmor', x: 2680, dugIn: true },
      { side: 1, id: 'manpads', x: 2920, guard: true },
      { side: 1, id: 'ifv', x: 3130 },
      { side: 1, id: 'artillery', x: 3340 },
    ],
    waves: [
      {
        at: 90,
        cards: ['infantry', 'pickup'],
        message: '终站轻装预备队进入前线。',
      },
      {
        at: 210,
        cards: ['javelin', 'tank', 'infantry'],
        message: '终站装甲预备队出动，反甲组正在同行。',
      },
      {
        at: 300,
        cards: ['helicopter', 'antiarmor'],
        message: '终站发出了最后一批增援命令。',
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
  s.entrenchments ??= [];
  s.campaign = {
    id,
    duration: m.duration,
    objective: m.objective,
    objectiveX: m.objectiveX,
    captureProgress: 0,
    waveIndex: 0,
    hintIndex: 0,
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
