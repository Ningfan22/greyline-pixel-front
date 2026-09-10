export type BaseCardId =
  | 'infantry'
  | 'machinegun'
  | 'rocket'
  | 'tank'
  | 'helicopter'
  | 'morale'
  | 'artillery'
  | 'supply'
  | 'jam'
  | 'sniper'
  | 'medic'
  | 'mortar'
  | 'ifv'
  | 'smoke'
  | 'recon'
  | 'repair'
  | 'precision';
export type CardId =
  | BaseCardId
  | 'marines'
  | 'armed_police'
  | 'paratroopers'
  | 'rangers'
  | 'militia'
  | 'assault'
  | 'engineers'
  | 'mountain'
  | 'scouts'
  | 'commandos'
  | 'grenadiers'
  | 'antiarmor'
  | 'manpads'
  | 'heavy_mg'
  | 'light_tank'
  | 'heavy_tank'
  | 'rocket_heli'
  | 'scout_drone'
  | 'attack_drone'
  | 'loiter_drone'
  | 'interceptor'
  | 'rally'
  | 'ammo'
  | 'emp'
  | 'barrage'
  | 'medevac'
  | 'fortify'
  | 'sabotage';
export type Doctrine =
  | 'balanced'
  | 'assault'
  | 'defensive'
  | 'recon'
  | 'support'
  | 'irregular'
  | 'elite';
export interface Card {
  id: CardId;
  name: string;
  en: string;
  cost: number;
  type: 'unit' | 'skill';
  tag: string;
  description: string;
  detail: string;
  atlas: number;
  hp?: number;
  damage?: number;
  range?: number;
  speed?: number;
  rate?: number;
  air?: boolean;
  airframe?:
    | 'rocket_heli'
    | 'scout_drone'
    | 'attack_drone'
    | 'loiter_drone'
    | 'interceptor';
  altitude?: number;
  patrol?: boolean;
  observer?: boolean;
  oneWay?: boolean;
  antiAir?: boolean;
  radius?: number;
  members?: number;
  minRange?: number;
  indirect?: boolean;
  heal?: number;
  armored?: boolean;
  targetGround?: boolean;
  model?: BaseCardId;
  doctrine?: Doctrine;
  discipline?: number;
  trait?: 'close_assault' | 'armor_vest' | 'engineer' | 'mountain' | 'scout';
  armorMultiplier?: number;
  airOnly?: boolean;
  uniform?: 'marine' | 'police' | 'recon' | 'assault';
  effect?:
    | 'rally'
    | 'ammo'
    | 'emp'
    | 'barrage'
    | 'medevac'
    | 'fortify'
    | 'sabotage';
}
const BASE_CARDS: Record<BaseCardId, Card> = {
  infantry: {
    id: 'infantry',
    name: '步兵班组',
    en: 'RIFLE SQUAD',
    cost: 2,
    type: 'unit',
    tag: '前线 · 地面',
    description: '快速推进，低费主力',
    detail:
      '6 名独立士兵 · 全班 210 生命、24 伤害 / 秒。快速推进的基础班组，适合掩护后排。',
    atlas: 0,
    hp: 210,
    damage: 24,
    range: 380,
    speed: 68,
    rate: 1,
    members: 6,
  },
  machinegun: {
    id: 'machinegun',
    name: '机枪班组',
    en: 'MACHINE GUN',
    cost: 3,
    type: 'unit',
    tag: '压制 · 对空',
    description: '1 名机枪手，4 名步枪护卫',
    detail:
      '1 名机枪手与 4 名步枪护卫 · 全班 225 生命。机枪每 0.22 秒 5 伤害、射程 500，可对空；护卫各 4 伤害 / 秒、射程 380，仅对地。',
    atlas: 1,
    hp: 225,
    damage: 5,
    range: 500,
    speed: 54,
    rate: 0.22,
    antiAir: true,
    members: 5,
  },
  rocket: {
    id: 'rocket',
    name: '重火力支援',
    en: 'FIRE SUPPORT',
    cost: 4,
    type: 'unit',
    tag: '爆破 · 对空',
    description: '远距爆破，破坏地形',
    detail:
      '5 名独立火箭兵 · 全班 200 生命，每 2.6 秒共 100 范围伤害。射程远，可对空，地面爆炸会留下弹坑。',
    atlas: 2,
    hp: 200,
    damage: 100,
    range: 650,
    speed: 48,
    rate: 2.6,
    radius: 34,
    antiAir: true,
    members: 5,
  },
  tank: {
    id: 'tank',
    name: '主战坦克',
    en: 'MAIN BATTLE TANK',
    cost: 6,
    type: 'unit',
    tag: '装甲 · 爆破',
    description: '重装推进，范围炮击',
    detail: '650 生命 · 每 1.9 秒 80 范围伤害。高生命地面前排，无法对空。',
    atlas: 3,
    hp: 650,
    damage: 80,
    range: 600,
    speed: 40,
    rate: 1.9,
    radius: 44,
    armored: true,
  },
  helicopter: {
    id: 'helicopter',
    name: '武装直升机',
    en: 'ATTACK HELICOPTER',
    cost: 6,
    type: 'unit',
    tag: '空中 · 突袭',
    description: '越过弹坑，从空中支援',
    detail: '260 生命 · 30 伤害 / 秒。无视地形，从空中攻击地面单位。',
    atlas: 4,
    hp: 260,
    damage: 30,
    range: 540,
    speed: 94,
    rate: 1,
    air: true,
  },
  sniper: {
    id: 'sniper',
    name: '狙击小组',
    en: 'MARKSMEN',
    cost: 3,
    type: 'unit',
    tag: '远距 · 点射',
    description: '超远射程，优先狙击步兵',
    detail:
      '2 名狙击手 · 100 生命，每 2.4 秒共 42 伤害。射程 780，优先攻击步兵；对装甲伤害减半。',
    atlas: 10,
    members: 2,
    hp: 100,
    damage: 42,
    rate: 2.4,
    range: 780,
    speed: 52,
  },
  medic: {
    id: 'medic',
    name: '战地医疗组',
    en: 'COMBAT MEDICS',
    cost: 3,
    type: 'unit',
    tag: '救治 · 步兵',
    description: '就地救治附近受伤步兵',
    detail:
      '3 名军医 · 135 生命。每人每 0.8 秒治疗附近步兵 4 生命，优先靠近救助倒地伤员；死亡和投降者不能救起，不修理载具。',
    atlas: 11,
    members: 3,
    hp: 135,
    damage: 9,
    rate: 1.2,
    range: 260,
    speed: 64,
    heal: 4,
  },
  mortar: {
    id: 'mortar',
    name: '迫击炮组',
    en: 'MORTAR TEAM',
    cost: 4,
    type: 'unit',
    tag: '曲射 · 区域压制',
    description: '越过地形和烟幕曲射',
    detail:
      '3 名炮手 · 150 生命，每 4.4 秒共 66 范围伤害。射程 180–820，无法对空；敌军贴近时会后撤。',
    atlas: 12,
    members: 3,
    hp: 150,
    damage: 66,
    rate: 4.4,
    range: 820,
    minRange: 180,
    speed: 42,
    radius: 30,
    indirect: true,
  },
  ifv: {
    id: 'ifv',
    name: '步兵战车',
    en: 'INFANTRY FIGHTING VEHICLE',
    cost: 5,
    type: 'unit',
    tag: '机炮 · 对空',
    description: '快速机炮，压制步兵与空中',
    detail:
      '420 生命 · 每 0.4 秒 13 伤害。射程 500，机炮可对空；比坦克轻快，适合持续火力支援。',
    atlas: 13,
    hp: 420,
    damage: 13,
    rate: 0.4,
    range: 500,
    speed: 58,
    antiAir: true,
    armored: true,
  },
  morale: {
    id: 'morale',
    name: '士气鼓舞',
    en: 'RALLY THE TROOPS',
    cost: 2,
    type: 'skill',
    tag: '增益 · 全军',
    description: '伤害 +35%，移速 +20%',
    detail: '全体己方部队获得 8 秒鼓舞，包含期间新部署单位。重复使用刷新时长。',
    atlas: 6,
  },
  artillery: {
    id: 'artillery',
    targetGround: true,
    name: '火炮覆盖',
    en: 'ARTILLERY BARRAGE',
    cost: 4,
    type: 'skill',
    tag: '支援 · 范围',
    description: '延迟三轮炮击，随机散布',
    detail:
      '2.8 秒后落弹，3 发间隔 0.85 秒，每发 26 伤害、半径 42。落点间隔 70，随机偏移 ±28；边缘伤害衰减，对基地造成 15% 伤害。',
    atlas: 7,
  },
  supply: {
    id: 'supply',
    name: '战地补给',
    en: 'FIELD RESUPPLY',
    cost: 1,
    type: 'skill',
    tag: '调度 · 抽牌',
    description: '立即补充 2 张手牌',
    detail: '立即抽 2 张牌，最多持有 6 张。用过的牌会在牌库抽空后洗回。',
    atlas: 8,
  },
  jam: {
    id: 'jam',
    name: '通讯干扰',
    en: 'SIGNAL JAMMING',
    cost: 2,
    type: 'skill',
    tag: '干扰 · 抽牌',
    description: '封锁敌方主动抽牌 9 秒',
    detail: '封锁敌方主动抽牌 9 秒；不影响补给卡。重复使用刷新时长。',
    atlas: 9,
  },
  smoke: {
    id: 'smoke',
    name: '烟幕掩护',
    en: 'SMOKE SCREEN',
    cost: 2,
    type: 'skill',
    tag: '掩护 · 遮蔽',
    description: '遮挡双方远距直射 8 秒',
    detail:
      '选择位置释放半径 110 的烟幕，持续 8 秒。阻止双方超过 110 距离的穿烟直射；无法阻止迫击炮与火炮。侦察校射可看穿烟幕。',
    atlas: 14,
    targetGround: true,
  },
  recon: {
    id: 'recon',
    name: '侦察校射',
    en: 'FORWARD OBSERVER',
    cost: 2,
    type: 'skill',
    tag: '观测 · 射程',
    description: '射程 +20%，看穿烟幕',
    detail:
      '全体己方部队射程提升 20%，并能看穿烟幕，持续 10 秒。适合配合狙击手和后方火力。重复使用刷新时长。',
    atlas: 15,
  },
  repair: {
    id: 'repair',
    name: '装甲抢修',
    en: 'FIELD REPAIRS',
    cost: 3,
    type: 'skill',
    tag: '后勤 · 载具',
    description: '8 秒内修复己方装甲',
    detail:
      '在场己方坦克与步兵战车每秒恢复 20 生命，持续 8 秒。只修复使用时已经在场且存活的装甲，生命不超过上限。',
    atlas: 16,
  },
  precision: {
    id: 'precision',
    name: '精确打击',
    en: 'PRECISION STRIKE',
    cost: 5,
    type: 'skill',
    tag: '支援 · 定点爆破',
    description: '小范围重击，克制装甲',
    detail:
      '指定位置，2.6 秒后单次打击，150 伤害、半径 26、随机偏移 ±8。边缘衰减，对基地造成 20% 伤害。瞄准停火中的重装单位更有效。',
    atlas: 17,
    targetGround: true,
  },
};

function variant(
  base: BaseCardId,
  id: CardId,
  name: string,
  cost: number,
  description: string,
  changes: Partial<Card>,
): Card {
  return {
    ...BASE_CARDS[base],
    id,
    name,
    en: 'FIELD FORMATION',
    cost,
    model: base,
    description,
    detail: description,
    ...changes,
  };
}
export const CARDS: Record<CardId, Card> = {
  ...BASE_CARDS,
  marines: variant(
    'infantry',
    'marines',
    '海军陆战队',
    3,
    '6 人突击班，交替推进，近距火力增强。',
    {
      hp: 270,
      damage: 32,
      range: 400,
      speed: 70,
      doctrine: 'assault',
      discipline: 92,
      trait: 'close_assault',
      uniform: 'marine',
      tag: '陆战 · 交替突击',
    },
  ),
  armed_police: variant(
    'infantry',
    'armed_police',
    '武装警察',
    3,
    '5 人守备组，重视蹲伏掩护，防护背心减伤 12%。',
    {
      members: 5,
      hp: 275,
      damage: 22,
      range: 340,
      doctrine: 'defensive',
      discipline: 88,
      trait: 'armor_vest',
      uniform: 'police',
      tag: '守备 · 防护',
    },
  ),
  paratroopers: variant(
    'infantry',
    'paratroopers',
    '空降步兵',
    3,
    '5 人轻装班，地面快速推进，突击成员交替前出。',
    {
      members: 5,
      hp: 220,
      damage: 30,
      range: 420,
      speed: 82,
      doctrine: 'assault',
      discipline: 90,
      uniform: 'marine',
      tag: '轻装 · 快速推进',
    },
  ),
  rangers: variant(
    'infantry',
    'rangers',
    '游骑兵',
    4,
    '4 人侦察班，优先低姿态，能寻找更远的掩体。',
    {
      members: 4,
      hp: 220,
      damage: 28,
      range: 470,
      speed: 80,
      doctrine: 'recon',
      discipline: 92,
      trait: 'scout',
      uniform: 'recon',
      tag: '侦察 · 掩体机动',
    },
  ),
  militia: variant(
    'infantry',
    'militia',
    '民兵班',
    1,
    '7 人低费班，兵力多但士气较低，受压后容易后撤或投降。',
    {
      members: 7,
      hp: 175,
      damage: 21,
      range: 300,
      doctrine: 'irregular',
      discipline: 48,
      tag: '低费 · 士气脆弱',
    },
  ),
  assault: variant(
    'infantry',
    'assault',
    '突击步兵',
    3,
    '5 人近距班，短射程高火力，200 内伤害增加 20%。',
    {
      members: 5,
      hp: 260,
      damage: 40,
      range: 280,
      rate: 0.85,
      doctrine: 'assault',
      discipline: 84,
      trait: 'close_assault',
      uniform: 'assault',
      tag: '突击 · 近战火力',
    },
  ),
  engineers: variant(
    'infantry',
    'engineers',
    '战斗工兵',
    3,
    '4 人工兵组，接近完整矮墙时使用爆破工具拆除障碍。',
    {
      members: 4,
      hp: 200,
      damage: 20,
      range: 350,
      doctrine: 'support',
      discipline: 86,
      trait: 'engineer',
      tag: '工程 · 拆除障碍',
    },
  ),
  mountain: variant(
    'infantry',
    'mountain',
    '山地步兵',
    3,
    '4 人山地组，攀墙与攀出深坑更快，常用低姿态掩护。',
    {
      members: 4,
      hp: 200,
      damage: 24,
      range: 420,
      speed: 70,
      doctrine: 'recon',
      discipline: 86,
      trait: 'mountain',
      uniform: 'recon',
      tag: '山地 · 越障',
    },
  ),
  scouts: variant(
    'sniper',
    'scouts',
    '侦察射手',
    3,
    '3 人侦察组，机动快、点射快，优先攻击步兵，对装甲伤害减半。',
    {
      members: 3,
      hp: 135,
      damage: 27,
      range: 650,
      rate: 1.5,
      speed: 84,
      doctrine: 'recon',
      discipline: 90,
      trait: 'scout',
      uniform: 'recon',
      tag: '侦察 · 快速点射',
    },
  ),
  commandos: variant(
    'infantry',
    'commandos',
    '特战小组',
    4,
    '4 人精锐组，承受压制时士气更稳定，交替突击。',
    {
      members: 4,
      hp: 260,
      damage: 40,
      range: 420,
      speed: 76,
      doctrine: 'elite',
      discipline: 98,
      uniform: 'assault',
      tag: '精锐 · 高士气',
    },
  ),
  grenadiers: variant(
    'rocket',
    'grenadiers',
    '榴弹支援组',
    4,
    '4 人榴弹组，中距离范围压制，不具备对空能力。',
    {
      members: 4,
      hp: 220,
      damage: 64,
      radius: 48,
      rate: 2.4,
      range: 420,
      antiAir: false,
      doctrine: 'support',
      discipline: 78,
      tag: '榴弹 · 区域压制',
    },
  ),
  antiarmor: variant(
    'rocket',
    'antiarmor',
    '反坦克小组',
    4,
    '3 人反装甲组，远距伏击，对装甲伤害增加 60%，无法对空。',
    {
      members: 3,
      hp: 180,
      damage: 110,
      radius: 26,
      range: 740,
      rate: 3,
      antiAir: false,
      armorMultiplier: 1.6,
      doctrine: 'recon',
      discipline: 88,
      tag: '反甲 · 伏击',
    },
  ),
  manpads: variant(
    'rocket',
    'manpads',
    '便携防空组',
    4,
    '3 人防空组，专门拦截直升机、战机与无人机，不攻击地面目标。',
    {
      members: 3,
      hp: 165,
      damage: 100,
      radius: 20,
      range: 760,
      rate: 2.6,
      antiAir: true,
      airOnly: true,
      doctrine: 'support',
      discipline: 86,
      tag: '防空 · 专职拦截',
    },
  ),
  heavy_mg: variant(
    'machinegun',
    'heavy_mg',
    '重机枪组',
    4,
    '1 名重机枪手与 2 名步枪护卫。重机枪每 0.2 秒 7 伤害、射程 620，可对空；护卫各 4 伤害 / 秒、射程 380，仅对地。',
    {
      members: 3,
      hp: 225,
      damage: 7,
      rate: 0.2,
      range: 620,
      speed: 34,
      doctrine: 'defensive',
      discipline: 84,
      tag: '重机枪 · 火力封锁',
    },
  ),
  light_tank: variant(
    'tank',
    'light_tank',
    '轻型坦克',
    5,
    '高机动轻装甲，主炮与同轴机枪独立射击。',
    {
      hp: 420,
      damage: 58,
      rate: 1.6,
      range: 550,
      speed: 60,
      tag: '轻装甲 · 机动',
    },
  ),
  heavy_tank: variant(
    'tank',
    'heavy_tank',
    '突击重坦',
    8,
    '厚重装甲与高伤害主炮，速度慢，同轴机枪压制步兵。',
    {
      hp: 950,
      damage: 110,
      rate: 2.6,
      range: 560,
      speed: 28,
      tag: '重装甲 · 突破',
    },
  ),
  rocket_heli: variant(
    'helicopter',
    'rocket_heli',
    '反装甲直升机',
    7,
    '远距导弹猎杀装甲，机体较脆弱。',
    {
      en: 'ANTI-ARMOR HELICOPTER',
      hp: 220,
      damage: 60,
      rate: 2.8,
      range: 650,
      speed: 76,
      radius: 26,
      armorMultiplier: 1.4,
      airframe: 'rocket_heli',
      altitude: 224,
      tag: '航空 · 反装甲',
      detail:
        '220 生命 · 射程 650，每 2.8 秒发射 60 伤害导弹，半径 26，对装甲伤害 ×1.4。无法对空，容易被防空组拦截。',
    },
  ),
  scout_drone: variant(
    'helicopter',
    'scout_drone',
    '侦察四旋翼',
    2,
    '跟随前线，为附近友军提供视野。',
    {
      en: 'RECON QUADCOPTER',
      hp: 55,
      damage: 0,
      rate: 1,
      range: 0,
      speed: 86,
      observer: true,
      airframe: 'scout_drone',
      altitude: 190,
      tag: '无人机 · 侦察',
      detail:
        '55 生命，无武器。跟随己方前线，650 距离内友军射程 +10%、能穿烟瞄准。通讯干扰期间侦察失效，可被对空火力击落。',
    },
  ),
  attack_drone: variant(
    'helicopter',
    'attack_drone',
    '察打一体无人机',
    4,
    '长航时空中支援，发射小型反甲导弹。',
    {
      en: 'ARMED UAV',
      hp: 90,
      damage: 32,
      rate: 3.6,
      range: 620,
      speed: 80,
      radius: 20,
      armorMultiplier: 1.35,
      airframe: 'attack_drone',
      altitude: 172,
      tag: '无人机 · 精确火力',
      detail:
        '90 生命 · 射程 620，每 3.6 秒 32 伤害，半径 20，对装甲 ×1.35。无法对空，靠射程和友军防空保护自身。',
    },
  ),
  loiter_drone: variant(
    'helicopter',
    'loiter_drone',
    '巡飞弹无人机',
    3,
    '锁定目标后俯冲，自毁造成局部爆炸。',
    {
      en: 'LOITERING MUNITION',
      hp: 40,
      damage: 85,
      rate: 1,
      range: 420,
      speed: 116,
      radius: 24,
      armorMultiplier: 1.25,
      oneWay: true,
      airframe: 'loiter_drone',
      altitude: 198,
      tag: '无人机 · 一次性突击',
      detail:
        '40 生命 · 420 距离内优先锁定装甲，俯冲后自身消耗，命中造成 85 伤害、半径 24，对装甲 ×1.25。出击前可被对空火力击落。',
    },
  ),
  interceptor: variant(
    'helicopter',
    'interceptor',
    '低空截击机',
    5,
    '持续巡航，专门争夺制空权。',
    {
      en: 'AIR INTERCEPTOR',
      hp: 150,
      damage: 36,
      rate: 1.4,
      range: 700,
      speed: 230,
      antiAir: true,
      airOnly: true,
      patrol: true,
      airframe: 'interceptor',
      altitude: 140,
      tag: '航空 · 专职制空',
      detail:
        '150 生命 · 射程 700，每 1.4 秒 36 伤害。持续往返巡航，只攻击前方空中目标，不停在原地悬浮，也不攻击地面或基地。',
    },
  ),
  rally: variant(
    'morale',
    'rally',
    '紧急动员',
    2,
    '存活且未投降的己方步兵恢复 40 士气，并清除 80% 压制。',
    { effect: 'rally', tag: '动员 · 稳定士气' },
  ),
  ammo: variant(
    'supply',
    'ammo',
    '弹药空投',
    2,
    '立即抽 3 张自己的牌库，手牌上限仍为 6。',
    { effect: 'ammo', tag: '补给 · 抽三张' },
  ),
  emp: variant(
    'jam',
    'emp',
    '电磁封锁',
    4,
    '封锁敌方主动抽牌 14 秒，并取消敌方侦察校射。',
    { effect: 'emp', tag: '电子战 · 封锁' },
  ),
  barrage: variant(
    'artillery',
    'barrage',
    '密集炮幕',
    6,
    '3.6 秒后五轮炮击，间隔 0.75 秒；每发 20 伤害、半径 40，中心间隔 60、随机偏移 ±25。边缘衰减，对基地造成 15% 伤害。',
    { effect: 'barrage', tag: '炮兵 · 宽幅覆盖' },
  ),
  medevac: variant(
    'morale',
    'medevac',
    '战地急救',
    2,
    '己方存活步兵恢复 10 生命与 8 士气；倒地伤员得到急救，生命恢复至 40% 后可起身。死亡或投降者不复活。',
    { effect: 'medevac', tag: '医疗 · 急救' },
  ),
  fortify: variant(
    'morale',
    'fortify',
    '固守阵地',
    3,
    '10 秒内，停止移动的己方步兵额外减伤 20%，施放时恢复 10 士气。',
    { effect: 'fortify', tag: '守备 · 阵地防御' },
  ),
  sabotage: variant(
    'jam',
    'sabotage',
    '火力干扰',
    3,
    '打乱敌方射击节奏，主武器和同轴机枪当前剩余装填延后 1.8 秒。',
    { effect: 'sabotage', tag: '调度 · 压制火力' },
  ),
};
export function modelOf(id: CardId): BaseCardId {
  return CARDS[id].model ?? (id as BaseCardId);
}
export function weaponCard(u: { id: CardId; member: number }): Card {
  const c = CARDS[u.id];
  if (modelOf(u.id) !== 'machinegun') return c;
  return u.member === 0
    ? { ...c, members: 1 }
    : {
        ...c,
        members: 1,
        model: 'infantry',
        damage: 4,
        rate: 1,
        range: 380,
        antiAir: false,
      };
}
export function weaponModel(u: { id: CardId; member: number }): BaseCardId {
  return modelOf(u.id) === 'machinegun' && u.member > 0
    ? 'infantry'
    : modelOf(u.id);
}
export function doctrineOf(id: CardId): Doctrine {
  return (
    CARDS[id].doctrine ??
    (['sniper'].includes(modelOf(id))
      ? 'recon'
      : ['machinegun', 'medic', 'mortar', 'rocket'].includes(modelOf(id))
        ? 'support'
        : 'balanced')
  );
}
export function needsTarget(id: CardId) {
  return CARDS[id].type === 'unit' || !!CARDS[id].targetGround;
}
export const DECK_SIZE = 20;
export const DECK: CardId[] = [
  'infantry',
  'marines',
  'armed_police',
  'scout_drone',
  'assault',
  'attack_drone',
  'machinegun',
  'rocket',
  'sniper',
  'medic',
  'mortar',
  'tank',
  'ifv',
  'helicopter',
  'morale',
  'smoke',
  'artillery',
  'supply',
  'recon',
  'rally',
];
export function validDeck(value: unknown): value is CardId[] {
  return (
    Array.isArray(value) &&
    value.length === DECK_SIZE &&
    new Set(value).size === DECK_SIZE &&
    value.every((id) => typeof id === 'string' && Object.hasOwn(CARDS, id))
  );
}
const AI_DECKS: CardId[][] = [
  [
    'infantry',
    'marines',
    'paratroopers',
    'militia',
    'heavy_mg',
    'antiarmor',
    'sniper',
    'medic',
    'mortar',
    'light_tank',
    'tank',
    'ifv',
    'helicopter',
    'smoke',
    'artillery',
    'supply',
    'ammo',
    'recon',
    'rally',
    'repair',
  ],
  [
    'armed_police',
    'infantry',
    'mountain',
    'engineers',
    'commandos',
    'machinegun',
    'manpads',
    'antiarmor',
    'scouts',
    'medic',
    'mortar',
    'heavy_tank',
    'ifv',
    'fortify',
    'smoke',
    'barrage',
    'precision',
    'supply',
    'medevac',
    'emp',
  ],
  [
    'marines',
    'assault',
    'scout_drone',
    'interceptor',
    'loiter_drone',
    'grenadiers',
    'rocket',
    'manpads',
    'medic',
    'attack_drone',
    'rocket_heli',
    'ifv',
    'helicopter',
    'morale',
    'sabotage',
    'artillery',
    'smoke',
    'supply',
    'ammo',
    'rally',
  ],
];
export function chooseAiDeck(seed: number): CardId[] {
  return [
    ...AI_DECKS[
      ((Math.imul(seed, 1103515245) + 12345) >>> 0) % AI_DECKS.length
    ],
  ];
}

for (const id of ['tank', 'light_tank', 'heavy_tank'] as const)
  CARDS[id].detail +=
    ' 同轴机枪独立装填：射程 420，每 0.18 秒对步兵射击，单发 3 伤害。';
