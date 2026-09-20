import { DECK_PRESETS, AI_DECKS } from './deck-presets';
import type { EconomyEffect } from './economy';
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
  | 'flare'
  | 'repair'
  | 'precision';
export type CardId =
  | BaseCardId
  | 'field_logistics'
  | 'command_expansion'
  | 'war_bonds'
  | 'toxic_cloud'
  | 'smoke_withdrawal'
  | 'reserve_mobilization'
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
  | 'fpv_drone'
  | 'air_assault'
  | 'interceptor'
  | 'javelin'
  | 'anti_tank_gun'
  | 'antitank_mine'
  | 'aa_gun'
  | 'sam_vehicle'
  | 'pickup'
  | 'tow_ifv'
  | 'mortar_carrier'
  | 'recovery_vehicle'
  | 'command_vehicle'
  | 'mine_clearer'
  | 'steadfast'
  | 'supply_team'
  | 'strike_jet'
  | 'bomber'
  | 'rally'
  | 'ammo'
  | 'emp'
  | 'barrage'
  | 'medevac'
  | 'fortify'
  | 'sabotage'
  | 'overdraft'
  | 'airborne_insertion'
  | 'signal_jam'
  | 'forced_march'
  | 'cyber_suppression'
  | 'war_production'
  | 'foraged_supplies'
  | 'blitz_doctrine'
  | 'forward_hq'
  | 'comm_blackout'
  | 'supply_interdiction'
  | 'spoof_attack'
  | 'radar_jam'
  | 'glider_assault'
  | 'pathfinders'
  | 'ambush_squad'
  | 'sniper_team'
  | 'naval_gunfire'
  | 'cluster_munitions'
  | 'thermobaric'
  | 'precision_rocket'
  | 'veteran_squad'
  | 'medic_team'
  | 'combat_engineers'
  | 'entrench'
  // ── v120 流派扩充 ─────────────────────────────────────────────
  | 'command_lockdown'
  | 'emergency_levy'
  | 'battlefield_salvage'
  | 'shock_action'
  | 'sensor_blind'
  | 'logistics_strike'
  | 'freq_hop'
  | 'ewarfare'
  | 'airborne_at'
  | 'rapid_insertion'
  | 'sapper_assault'
  | 'recon_jump'
  | 'creeping_barrage'
  | 'smoke_cover'
  | 'heavy_barrage'
  | 'illumination_round'
  | 'minefield'
  | 'field_hospital'
  | 'fallback'
  | 'fire_team'
  | 'assault_grenadiers'
  | 'lmg_team'
  | 'glider_transport';
export type Doctrine =
  | 'balanced'
  | 'assault'
  | 'defensive'
  | 'recon'
  | 'support'
  | 'irregular'
  | 'elite';
export interface Card {
  /** Runtime transport prototype, not a collectible/playable card. */
  internal?: boolean;
  insertion?: 'glider';
  economy?: EconomyEffect;
  comeback?: 'gas' | 'withdrawal' | 'reserve';
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
    | 'fpv_drone'
    | 'transport_heli'
    | 'glider'
    | 'interceptor';
  sortie?: boolean;
  patrolTime?: number;
  flightTime?: number;
  burstSize?: number;
  burstPause?: number;
  armorOnly?: boolean;
  attackRun?: 'strafe' | 'bomb';
  sortieAmmo?: number;
  returnCost?: number;
  sortieCooldown?: number;
  sight?: number;
  guided?: boolean;
  static?: boolean;
  emplacement?: 'howitzer' | 'at_gun' | 'aa_gun';
  penetration?: number;
  infantryMultiplier?: number;
  baseMultiplier?: number;
  neverSurrender?: boolean;
  deployDraw?: number;
  altitude?: number;
  patrol?: boolean;
  observer?: boolean;
  oneWay?: boolean;
  airlift?: CardId;
  /** Parachute insertion: spawns at the selected ground point and descends under canopy. */
  airdrop?: boolean;
  antiAir?: boolean;
  radius?: number;
  members?: number;
  /** Hand grenades carried by each infantry member; thrown at clustered enemies. */
  frags?: number;
  minRange?: number;
  indirect?: boolean;
  heal?: number;
  /** Treatment radius, separate from the medic's weapon range. */
  healRange?: number;
  /** Seconds needed to open a fixed medical post after deployment. */
  medicalSetup?: number;
  armored?: boolean;
  /** A ground vehicle body; armor damage resistance still requires armored. */
  vehicle?: boolean;
  vehicleSupport?: 'repair' | 'command' | 'mine_clear';
  /** Crew members who bail out on foot when the vehicle is destroyed. */
  crew?: number;
  targetGround?: boolean;
  /** Selects a non-default artillery profile (naval/cluster/thermobaric/rocket) for strike cards. */
  artilleryKind?: string;
  model?: BaseCardId;
  doctrine?: Doctrine;
  discipline?: number;
  infantryAbility?:
    | 'cohesion'
    | 'guard'
    | 'smoke_assault'
    | 'ambush'
    | 'rapid'
    | 'mountain_fire'
    | 'buddy_rally'
    | 'fire_discipline'
    | 'elite';
  trait?:
    | 'close_assault'
    | 'armor_vest'
    | 'engineer'
    | 'mechanic'
    | 'mountain'
    | 'scout';
  armorMultiplier?: number;
  /** Incoming blast damage multiplier; does not protect against bullets or gas. */
  blastProtection?: number;
  airOnly?: boolean;
  uniform?:
    | 'marine'
    | 'police'
    | 'recon'
    | 'assault'
    | 'elite'
    | 'militia'
    | 'crew'
    | 'medic'
    | 'engineer'
    | 'heavy';
  effect?:
    | 'rally'
    | 'ammo'
    | 'emp'
    | 'barrage'
    | 'medevac'
    | 'fortify'
    | 'sabotage'
    | 'signal_jam'
    | 'forced_march'
    | 'cyber_suppression'
    | 'forage'
    | 'blitz'
    | 'blackout'
    | 'interdict'
    | 'spoof'
    | 'radar_jam'
    | 'entrench'
    // ── v120 流派扩充 ─────────────────────────────────────────
    | 'lockout'
    | 'salvage'
    | 'shock'
    | 'sensor_blind'
    | 'logistics_strike'
    | 'freq_hop'
    | 'ewarfare'
    | 'smoke_screen'
    | 'illumination'
    | 'minefield'
    | 'fallback'
    // ── v132 差异化 ─────────────────────────────────────────
    | 'ceasefire';
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
      '1名机枪手与4名步枪护卫，全班225生命。机枪每0.22秒5伤害、射程500，可对空，100发弹带、装填4秒；不需重机枪的展开，也不做轻机枪的短点射跃进。四名护卫各4伤害/秒、射程380，仅对地，适合独立接敌与机步协同。',
    atlas: 1,
    hp: 225,
    damage: 5,
    range: 500,
    speed: 54,
    rate: 0.22,
    antiAir: true,
    members: 5,
    uniform: 'crew',
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
    uniform: 'heavy',
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
    crew: 3,
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
      '2 名狙击手 · 100 生命，每 2.4 秒共 42 伤害。射程 780，优先攻击步兵；对装甲伤害减半。静止架设时为 500px 内己方步兵提供 overwatch 掩护：压制衰减 +35%，且在炮火下多承受 14 点压制才会被钉住，掩护步兵持续跃进。',
    atlas: 10,
    members: 2,
    hp: 100,
    damage: 42,
    rate: 2.4,
    range: 780,
    speed: 52,
    uniform: 'elite',
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
    uniform: 'medic',
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
      '3 名炮手 · 150 生命，每 4.4 秒共 66 范围伤害。射程 180–820，无法对空；敌军贴近时会后撤。被敌方声测定位两轮后自动转移阵地，规避反炮兵火力。',
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
    uniform: 'crew',
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
    crew: 2,
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
    detail: '立即从剩余牌库抽 2 张牌，最多持有 6 张。牌库抽空后不再补牌，弃牌不会自动洗回。',
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
  flare: {
    id: 'flare',
    targetGround: true,
    name: '照明弹',
    en: 'ILLUMINATION FLARE',
    cost: 2,
    type: 'skill',
    tag: '侦察 · 照明',
    description: '照亮落点，显形双方部队 10 秒',
    detail:
      '照明弹在目标上空缓缓降落，持续 10 秒照亮半径 260 的区域：烟幕后的敌军现形，双方都能看见被照亮的部队。烟幕仍阻挡直射火力，但曲射与炮兵可以趁光打击。重复使用叠加照明。',
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
  field_logistics: variant(
    'supply',
    'field_logistics',
    '战地后勤',
    3,
    '回点提速，最多两级',
    {
      en: 'FIELD LOGISTICS',
      economy: 'logistics',
      tag: '发展 · 持续回点',
      detail:
        '支付3点，基准回点间隔永久缩短0.3秒，最多两级、基准最低3秒。AI公开难度倍率仍作用于该间隔。达到两级后不可继续使用。',
    },
  ),
  command_expansion: variant(
    'supply',
    'command_expansion',
    '指挥扩编',
    2,
    '指挥上限增加两点',
    {
      en: 'COMMAND EXPANSION',
      economy: 'capacity',
      tag: '发展 · 储备扩容',
      detail:
        '支付2点，指挥点上限永久增加2，最多从10扩至14。不立即补充指挥点；达到14后不可继续使用。',
    },
  ),
  war_bonds: variant('supply', 'war_bonds', '战时公债', 1, '十八秒后到账三点', {
    en: 'WAR BONDS',
    economy: 'bonds',
    tag: '发展 · 延迟回报',
    detail:
      '支付1点，18秒后获得3点。每方同时最多一笔待结算公债，每局最多使用两次；到账超过指挥上限的部分不会储存。',
  }),
  overdraft: variant('supply', 'overdraft', '透支指挥', 1, '立即获得5点指挥点，25秒内回点放缓', {
    en: 'OVERDRAFT',
    economy: 'overdraft',
    tag: '发展 · 透支爆发',
    detail:
      '立即获得5点指挥点（可超过上限），代价是25秒内指挥点回复间隔延长50%。透支未结清前不能再次使用。快攻流派的起手爆发牌。',
  }),
  signal_jam: variant('jam', 'signal_jam', '电磁干扰', 1, '封锁敌方出牌4秒', {
    en: 'SIGNAL JAM',
    effect: 'signal_jam',
    tag: '干扰 · 短时封锁',
    detail:
      '释放电磁干扰，敌方4秒内无法打出任何卡牌。低费快攻封锁牌，适合打断对手的关键部署或连招。',
  }),
  airborne_insertion: variant(
    'infantry',
    'airborne_insertion',
    '敌后空降',
    4,
    '伞兵空降到选定位置，落地后快速推进',
    {
      members: 5,
      hp: 220,
      damage: 30,
      range: 420,
      speed: 82,
      doctrine: 'assault',
      discipline: 90,
      uniform: 'marine',
      airdrop: true,
      targetGround: true,
      tag: '空降 · 纵深插入',
      detail:
        '5人伞兵班搭乘运输机空降到战场任意选定位置，伞降约2.5秒落地，落地后8秒内快速突进。可直接插入敌方纵深、绕开正面防线。',
    },
  ),
  forced_march: variant('supply', 'forced_march', '强行军', 2, '己方全体步兵移速提升35%，12秒', {
    en: 'FORCED MARCH',
    effect: 'forced_march',
    tag: '机动 · 全军加速',
    detail:
      '12秒内己方所有步兵移动速度提升35%。配合透支指挥的快攻铺场，能在对手反应过来之前把战线推到脸上。',
  }),
  cyber_suppression: variant(
    'jam',
    'cyber_suppression',
    '点穴打击',
    3,
    '敌方立即损失3点指挥点，己方获得2点，6秒内敌方回点减半',
    {
      en: 'CYBER SUPPRESSION',
      effect: 'cyber_suppression',
      tag: '干扰 · 经济压制',
      detail:
        '网络攻击直取敌方指挥节点：敌方立即损失3点指挥点，其中2点被己方截获，且6秒内敌方指挥点回复速度减半。快攻流的节奏发动机——用对手的资源打对手的时间差。',
    },
  ),
  ...BASE_CARDS,
  toxic_cloud: {
    id: 'toxic_cloud',
    name: '毒气封锁',
    en: 'TOXIC LOCKDOWN',
    cost: 3,
    type: 'skill',
    tag: '双向 · 持续清场',
    atlas: 5,
    comeback: 'gas',
    description: '预警后毒气伤害双方步兵',
    detail:
      '3秒公开预警后，战场上双方步兵每秒损失2.6生命，持续8秒；基地120范围、载具与飞机不受影响。卧倒和战壕无法隔绝毒气，医疗仍有效。不能叠加，双方都可用烟幕撤收或治疗降低损失；每副卡组限1张。',
  },
  smoke_withdrawal: {
    id: 'smoke_withdrawal',
    name: '烟幕撤收',
    en: 'BREAK CONTACT',
    cost: 1,
    type: 'skill',
    tag: '撤离 · 重整',
    atlas: 5,
    comeback: 'withdrawal',
    description: '烟幕掩护后撤，到达后重整',
    detail:
      '全体可行动步兵交替掩护后撤240，原阵地释放8秒烟幕。20秒内抵达后转警戒、恢复8生命与20士气。不会瞬移或复活，炮击仍能穿烟；每名士兵每次指令只重整一次。',
  },
  reserve_mobilization: {
    id: 'reserve_mobilization',
    name: '预备队动员',
    en: 'CALL THE RESERVES',
    cost: 3,
    type: 'skill',
    tag: '延迟 · 重建防线',
    atlas: 0,
    comeback: 'reserve',
    description: '六秒后两队民兵到场并抽牌',
    detail:
      '6秒后从己方基地分批派出两队民兵，间隔2秒，并抽1张牌。需要守住增援到来前的空窗；援兵为现有民兵，没有额外生命加成。每副卡组限2张。',
  },
  fpv_drone: variant(
    'helicopter',
    'fpv_drone',
    'FPV突击无人机',
    2,
    '低空接近，优先俯冲装甲；一次性撞击。',
    {
      en: 'FPV STRIKE DRONE',
      hp: 24,
      damage: 90,
      rate: 1,
      range: 500,
      speed: 170,
      sight: 560,
      radius: 14,
      armorMultiplier: 2.4,
      infantryMultiplier: 0.45,
      baseMultiplier: 0,
      oneWay: true,
      antiAir: false,
      airframe: 'fpv_drone',
      altitude: 244,
      tag: '无人机 · 廉价反甲',
      detail:
        '2费24生命。低空搜索已发现的地面目标，优先装甲，进入500范围后俯冲；撞击90伤害、对甲×2.4、对步兵×0.45，半径14。不会攻击基地，可被防空击落或被墙屋拦截；失去视野后只撞向最后发现的位置。',
    },
  ),
  air_assault: variant(
    'helicopter',
    'air_assault',
    '机降突击队',
    5,
    '直升机飞往指定落点，索降五人后撤离。',
    {
      en: 'AIR ASSAULT TEAM',
      hp: 300,
      damage: 0,
      rate: 1,
      range: 0,
      speed: 220,
      sight: 430,
      antiAir: false,
      airframe: 'transport_heli',
      altitude: 154,
      targetGround: true,
      airlift: 'paratroopers',
      tag: '机降 · 纵深突袭',
      detail:
        '5费派遣无武装运输直升机（300生命）。拖牌松手位置决定落点，避开两端基地480距离；飞抵后逐一索降5名空降兵，共220生命，随后撤回己方。运输机被击落时尚未下机的士兵一同损失，已下机者继续作战。',
    },
  ),
  pickup: variant('ifv', 'pickup', '机枪皮卡', 2, '廉价机动机枪车，压制步兵', {
    en: 'MACHINE GUN TECHNICAL',
    vehicle: true,
    crew: 1,
    armored: false,
    antiAir: false,
    hp: 150,
    damage: 4.5,
    rate: 0.14,
    range: 480,
    speed: 94,
    armorMultiplier: 0.15,
    baseMultiplier: 0.2,
    sight: 540,
    tag: '轻车 · 机枪压制',
    detail:
      '150 生命，无装甲。每 0.14 秒机枪射击，单发 4.5 伤害，射程 480；优先步兵，对装甲伤害为 15%，无法对空。速度快，但廉价反甲火力也能迅速击毁它。',
  }),
  tow_ifv: variant(
    'ifv',
    'tow_ifv',
    '陶式反坦克战车',
    5,
    '导弹猎甲，机枪独立压制',
    {
      en: 'TOW MISSILE CARRIER',
      vehicle: true,
      antiAir: false,
      hp: 330,
      damage: 96,
      rate: 3.8,
      range: 900,
      minRange: 100,
      speed: 42,
      radius: 8,
      guided: true,
      armorMultiplier: 2.6,
      infantryMultiplier: 0.2,
      baseMultiplier: 0.15,
      sight: 550,
      tag: '制导 · 装甲猎手',
      detail:
        '330 生命。每 3.8 秒发射陶式制导导弹，96 伤害、射程 100–900，对装甲 ×2.6、步兵 ×0.2。另有独立机枪：射程 420，每 0.18 秒对步兵造成 3 伤害；导弹装填时仍可掩护近身。',
    },
  ),
  mortar_carrier: variant(
    'ifv',
    'mortar_carrier',
    '自行迫击炮车',
    4,
    '曲射支援，近敌后撤转移',
    {
      en: 'MORTAR CARRIER',
      vehicle: true,
      antiAir: false,
      hp: 270,
      damage: 42,
      rate: 5.2,
      range: 780,
      minRange: 170,
      speed: 48,
      radius: 26,
      indirect: true,
      baseMultiplier: 0.15,
      sight: 430,
      tag: '炮兵 · 机动曲射',
      detail:
        '270 生命。每 5.2 秒发射迫击炮弹，42 范围伤害，射程 170–780。曲射上升段越过树屋，下降段仍会被拦截；近敌进入死角时后撤，随后继续支援。被敌方声测定位两轮后自动转移阵地，规避反炮兵火力。',
    },
  ),
  recovery_vehicle: variant(
    'ifv',
    'recovery_vehicle',
    '装甲抢修车',
    4,
    '停车抢修受损装甲',
    {
      en: 'ARMORED RECOVERY VEHICLE',
      vehicle: true,
      antiAir: false,
      hp: 350,
      damage: 0,
      rate: 1,
      range: 0,
      speed: 38,
      vehicleSupport: 'repair',
      sight: 480,
      tag: '后勤 · 装甲抢修',
      detail:
        '350 生命，无武器。停车抢修 180 距离内一辆受损己方装甲，每 0.5 秒恢复 9 生命。同一目标维修不叠加，不修自己、其他抢修车、无甲皮卡、飞机或已毁车辆。',
    },
  ),
  command_vehicle: variant(
    'ifv',
    'command_vehicle',
    '前线指挥车',
    5,
    '部署抽牌，支援附近步兵',
    {
      en: 'FORWARD COMMAND VEHICLE',
      vehicle: true,
      antiAir: false,
      hp: 360,
      damage: 4,
      rate: 0.4,
      range: 360,
      speed: 40,
      armorMultiplier: 0.15,
      baseMultiplier: 0.15,
      vehicleSupport: 'command',
      deployDraw: 1,
      sight: 720,
      tag: '指挥 · 无线电协同',
      detail:
        '360 生命，部署后从自己的卡堆抽 1 张牌。每秒为 220 距离内己方步兵恢复 2 士气（最多恢复至 85）、减少 3 压制与 0.12 秒装填；多车协同不叠加。自卫机枪射程 360，单发 4 伤害。',
    },
  ),
  mine_clearer: variant(
    'ifv',
    'mine_clearer',
    '装甲扫雷车',
    4,
    '装甲保护下停车排雷，范围大于徒步工兵',
    {
      en: 'ARMORED MINE CLEARER',
      vehicle: true,
      antiAir: false,
      hp: 430,
      damage: 4,
      rate: 0.5,
      range: 300,
      speed: 32,
      armorMultiplier: 0.15,
      baseMultiplier: 0.15,
      vehicleSupport: 'mine_clear',
      sight: 440,
      tag: '工程 · 排雷开路',
      detail:
        '430 生命。自动探测附近 110 距离的敌方地雷，停车每 0.6 秒排除一枚，优先保障履带前方安全；不展示远处隐藏地雷。比徒步工兵探雷范围更大，但费用更高、移动更慢，且不能修车。',
    },
  ),
  javelin: variant(
    'rocket',
    'javelin',
    '标枪反坦克组',
    4,
    '双人制导反甲组，远距猎杀重装。',
    {
      members: 2,
      hp: 140,
      damage: 104,
      rate: 3.2,
      range: 760,
      minRange: 100,
      radius: 8,
      guided: true,
      antiAir: false,
      uniform: 'crew',
      armorMultiplier: 2.4,
      infantryMultiplier: 0.3,
      baseMultiplier: 0.2,
      sight: 480,
      tag: '制导 · 反坦克',
      detail:
        '2 人，140 生命。每 3.2 秒全组 104 伤害，高抛升空后制导俯冲，越过近处树屋，下降仍会被掩体拦截；射程 100–760，对装甲 ×2.4、对步兵 ×0.3。依赖前线观察员提供目标。',
    },
  ),
  anti_tank_gun: variant(
    'mortar',
    'anti_tank_gun',
    '牵引反坦克炮',
    4,
    '远射程穿甲炮，压制装甲推进。',
    {
      members: undefined,
      hp: 240,
      damage: 75,
      rate: 2.8,
      range: 840,
      minRange: 100,
      radius: 0,
      indirect: false,
      static: true,
      speed: 0,
      emplacement: 'at_gun',
      armorMultiplier: 2.6,
      infantryMultiplier: 0.25,
      baseMultiplier: 0.2,
      sight: 470,
      tag: '阵地 · 反装甲',
      detail:
        '240 生命，部署后固定。射程 100–840，每 2.8 秒 75 伤害；装甲目标伤害 ×2.6，步兵目标 ×0.25。远处目标需要友军侦察。',
    },
  ),
  antitank_mine: variant(
    'smoke',
    'antitank_mine',
    '反坦克地雷',
    2,
    '预埋行进路线，仅敌方装甲触发。',
    {
      tag: '工事 · 装甲伏击',
      detail:
        '布置 2 秒后启用，保留到触发。敌方装甲进入 24 距离时承受 260 伤害并减速 3 秒。不伤步兵；不能贴着敌方装甲布置，需保持 80 距离。',
    },
  ),
  aa_gun: variant(
    'ifv',
    'aa_gun',
    '双联防空炮',
    3,
    '低费防空阵地，持续追打飞行目标。',
    {
      hp: 170,
      damage: 10,
      rate: 0.25,
      range: 850,
      speed: 0,
      static: true,
      armored: false,
      antiAir: true,
      airOnly: true,
      emplacement: 'aa_gun',
      sight: 760,
      tag: '防空 · 持续压制',
      detail:
        '170 生命，固定阵地。每 0.25 秒 10 伤害、射程 850，只攻击空中目标。射速快，能在飞机掠过时持续射击。',
    },
  ),
  sam_vehicle: variant(
    'ifv',
    'sam_vehicle',
    '雷达防空车',
    5,
    '长程制导导弹，拦截高速飞机。',
    {
      hp: 280,
      damage: 90,
      rate: 2.4,
      range: 1100,
      speed: 36,
      radius: 12,
      guided: true,
      antiAir: true,
      airOnly: true,
      sight: 1000,
      tag: '防空 · 雷达制导',
      detail:
        '280 生命。每 2.4 秒一发 90 伤害追踪导弹，射程 1100，只攻击空中目标。雷达视野较远，可给友军共享空情。',
    },
  ),
  steadfast: variant(
    'infantry',
    'steadfast',
    '坚定守备队',
    4,
    '永不投降，适合坚守重要阵地。',
    {
      members: 4,
      hp: 240,
      damage: 24,
      speed: 60,
      neverSurrender: true,
      discipline: 100,
      uniform: 'elite',
      doctrine: 'defensive',
      tag: '精锐 · 永不投降',
      detail: '4 人，240 生命。永远不会投降；仍会受伤、被压制或战术撤退。',
    },
  ),
  supply_team: variant(
    'infantry',
    'supply_team',
    '补给联络组',
    4,
    '部署成功后立即抽取一张卡。',
    {
      members: 3,
      hp: 150,
      damage: 15,
      range: 320,
      speed: 54,
      deployDraw: 1,
      sight: 620,
      tag: '指挥 · 部署抽牌',
      detail:
        '3 人，150 生命。每次成功部署整支班组后，立即从自己的牌库抽 1 张，手牌上限仍为 6。拥有较远观察范围。附近 210px 内的己方重型武器组（迫击炮、机枪、反坦克炮、防空炮、重火力支援）装填速度 +60%。',
    },
  ),
  strike_jet: variant(
    'helicopter',
    'strike_jet',
    '对地攻击机',
    6,
    '快速通场连续扫射，每架次最多 24 发，返航后低费再次派遣。',
    {
      hp: 170,
      damage: 38,
      rate: 0.08,
      range: 630,
      speed: 560,
      altitude: 158,
      airframe: 'interceptor',
      sortie: true,
      attackRun: 'strafe',
      sortieAmmo: 24,
      returnCost: 2,
      sortieCooldown: 18,
      sight: 730,
      infantryMultiplier: 12,
      armorMultiplier: 0.35,
      baseMultiplier: 0.15,
      radius: 30,
      tag: '航空 · 通场扫射',
      detail:
        '170 生命，优先扫射步兵；每 0.08 秒发射 38 伤机炮弹，对步兵 ×12，一发即可撕碎一整个步兵班，弹着点掀起爆炸级烟尘。每架次最多 24 发。成功离场返回手牌，满手则弃牌；返航冷却 18 秒，此后该张卡只需 2 费。被击落需重新全价派遣。',
    },
  ),
  bomber: variant(
    'helicopter',
    'bomber',
    '战术轰炸机',
    7,
    '沿航线连续投下 6 枚高爆弹，返航后补充弹药。',
    {
      hp: 230,
      damage: 78,
      rate: 0.16,
      range: 390,
      speed: 430,
      radius: 46,
      altitude: 136,
      airframe: 'attack_drone',
      sortie: true,
      attackRun: 'bomb',
      sortieAmmo: 6,
      returnCost: 2,
      sortieCooldown: 24,
      sight: 760,
      indirect: true,
      baseMultiplier: 0.15,
      tag: '航空 · 通场轰炸',
      detail:
        '230 生命，发现前方目标后沿航线连续投下 6 枚高爆弹；每枚 78 伤害、半径 46，约每 0.16 秒释放一枚。成功离场回手，满手则弃牌；冷却 24 秒，后续该张卡花费 2。被击落会失去返航优惠。',
    },
  ),
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
      discipline: 60,
      uniform: 'militia',
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
    '破障工兵',
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
      uniform: 'engineer',
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
    '4 人榴弹组，低弧线越过矮掩体压制地面。仍需确认目标，高墙和山体会拦截；无法对空。',
    {
      members: 4,
      hp: 220,
      damage: 64,
      radius: 48,
      rate: 2.4,
      range: 420,
      antiAir: false,
      uniform: 'heavy',
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
      uniform: 'crew',
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
      uniform: 'crew',
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
    '1 名重机枪手与 2 名护卫，展开后长点射封锁射界',
    {
      members: 3,
      hp: 225,
      damage: 7,
      rate: 0.16,
      range: 620,
      speed: 34,
      uniform: 'crew',
      doctrine: 'defensive',
      discipline: 84,
      tag: '重机枪 · 火力封锁',
      detail: '1名重机枪手、2名步枪护卫。机枪必须停稳2.4秒并完成低姿态展开后开火，移动后重新展开；射程620、每发7伤害，每8发停顿0.8秒。实际掠过敌人的子弹造成额外75%压制，不是全屏光环。150发弹带、装填5秒，可对空；护卫各4伤害/秒、射程380，只对地。适合守住射界，不适合一路冲锋。',
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
  // ── v108 快攻经济流派 ─────────────────────────────────────────────
  war_production: variant(
    'supply',
    'war_production',
    '战争生产',
    2,
    '立即获得 2 点指挥点，15 秒内回点速度提升 40%',
    {
      en: 'WAR PRODUCTION',
      economy: 'production',
      tag: '发展 · 爆发回点',
      detail:
        '支付2点，立即获得2点指挥点（可超过上限），并在15秒内指挥点回复间隔缩短40%。快攻流派的中期爆发牌：用它把一波铺场的费用提前打出来。',
    },
  ),
  foraged_supplies: variant(
    'supply',
    'foraged_supplies',
    '就地补给',
    0,
    '零费抽 1 张牌，不增加手牌总数',
    {
      en: 'FORAGED SUPPLIES',
      effect: 'forage',
      tag: '调度 · 零费换牌',
      detail:
        '不消耗指挥点，打出后从剩余牌库抽1张牌。只替换自身，不增加手牌数量；适合找关键组件，牌库耗尽时无效。战地补给则支付1点抽2张，提供手牌数量优势。',
    },
  ),
  blitz_doctrine: variant(
    'supply',
    'blitz_doctrine',
    '闪电战',
    3,
    '己方全体步兵移速提升 45%，10 秒',
    {
      en: 'BLITZ DOCTRINE',
      effect: 'blitz',
      tag: '机动 · 全军突进',
      detail:
        '10秒内己方所有步兵移动速度提升45%。比强行军更贵但提速更猛，配合空降和透支指挥能在对手站稳脚跟前把战线推到脸上。',
    },
  ),
  forward_hq: variant(
    'supply',
    'forward_hq',
    '前沿指挥部',
    3,
    '永久缩短回点间隔 0.5 秒，指挥上限 -2',
    {
      en: 'FORWARD HQ',
      economy: 'forward_hq',
      tag: '发展 · 以量换速',
      detail:
        '支付3点，指挥点回复间隔永久缩短0.5秒，但指挥点上限永久降低2。牺牲后期储备换取全程回点速度，快攻和压制流派的核心经济牌。',
    },
  ),
  // ── v108 干扰封锁流派 ─────────────────────────────────────────────
  comm_blackout: variant(
    'jam',
    'comm_blackout',
    '通讯中断',
    3,
    '敌方 8 秒内无法获得指挥点',
    {
      en: 'COMM BLACKOUT',
      effect: 'blackout',
      tag: '干扰 · 经济封锁',
      detail:
        '释放强电磁干扰，敌方8秒内指挥点完全停止回复。在对手攒费准备大招时打出，能直接掐断对方的连招节奏。',
    },
  ),
  supply_interdiction: variant(
    'jam',
    'supply_interdiction',
    '补给拦截',
    2,
    '敌方下 3 张牌费用 +2',
    {
      en: 'SUPPLY INTERDICTION',
      effect: 'interdict',
      tag: '干扰 · 加价封锁',
      detail:
        '拦截敌方补给线，敌方接下来打出的3张牌每张费用额外+2。持续施压型封锁，让对手每一张关键牌都来得更慢。',
    },
  ),
  spoof_attack: variant(
    'jam',
    'spoof_attack',
    '佯攻',
    1,
    '敌方步兵转向 3 秒',
    {
      en: 'SPOOF ATTACK',
      effect: 'spoof',
      tag: '干扰 · 阵型扰乱',
      detail:
        '制造假情报，敌方所有步兵朝向翻转3秒。期间他们会朝错误方向移动和开火，为己方突进或撤退争取窗口。',
    },
  ),
  radar_jam: variant(
    'jam',
    'radar_jam',
    '雷达干扰',
    2,
    '敌方空军与导弹精度下降，8 秒',
    {
      en: 'RADAR JAM',
      effect: 'radar_jam',
      tag: '干扰 · 反空反导',
      detail:
        '干扰敌方雷达制导，8秒内敌方攻击机、直升机和导弹的散布大幅增加。在对手呼叫空中支援前打出，能让大半炸弹偏离目标。',
    },
  ),
  // ── v108 空降与特种步兵 ───────────────────────────────────────────
  glider_assault: variant(
    'infantry',
    'glider_assault',
    '滑翔机突击',
    4,
    '滑翔机运送4名精英，着陆后逐一离舱',
    {
      members: 4,
      hp: 240,
      damage: 34,
      range: 420,
      speed: 84,
      doctrine: 'assault',
      discipline: 95,
      uniform: 'assault',
      infantryAbility: 'elite',
      airdrop: true,
      insertion: 'glider',
      targetGround: true,
      tag: '空降 · 精英纵深',
      detail:
        '无武装滑翔机（180生命）从己方边缘进场，寻找指定位置附近的平缓空地，滑跑停稳后逐一卸下4名精英，共240生命。飞行途中可被防空拦截，击毁时尚未离舱者损失；不能在房屋和树干上着陆，不接受伞降引导加速。机体停留作掩体，不返航。步兵停稳1秒后首枪对步兵伤害乘1.5；没有隐身或不可见落点加成。',
    },
  ),
  glider_transport: variant('helicopter', 'glider_transport', '滑翔运输机', 0,
    '运输机体，不可单独入组或抽取', {
      internal: true, en: 'ASSAULT GLIDER', airframe: 'glider',
      hp: 180, damage: 0, rate: 1, range: 0, speed: 360, sight: 360,
      altitude: 70, antiAir: false, vehicle: true, crew: 0,
      tag: '运输 · 无武装', detail: '滑翔机突击的运输机体。',
    }),
  pathfinders: variant(
    'infantry',
    'pathfinders',
    '先导小组',
    3,
    '2 人空降先导，落地警戒并引导附近后续伞降',
    {
      members: 2,
      hp: 120,
      damage: 26,
      range: 460,
      speed: 88,
      doctrine: 'recon',
      discipline: 90,
      uniform: 'recon',
      trait: 'scout',
      airdrop: true,
      targetGround: true,
      sight: 760,
      tag: '空降 · 侦察引导',
      detail:
        '2人先导组，观察760。落地自动警戒，停稳2秒后引导220内后续伞兵：下降速度提升35%，落地降低30压制、恢复12士气并完成武器准备。引导员移动、受重压、伤亡、撤退或通讯受干扰时失效；可选中小组下令进攻或撤退。不再获得伏击首枪加成。',
    },
  ),
  ambush_squad: variant(
    'infantry',
    'ambush_squad',
    '伏击小组',
    3,
    '3 人低姿态隐蔽伏击，放近敌人后打出强化首枪',
    {
      members: 3,
      hp: 165,
      damage: 30,
      range: 440,
      speed: 70,
      doctrine: 'defensive',
      discipline: 88,
      infantryAbility: 'ambush',
      uniform: 'elite',
      tag: '守备 · 以静制动',
      detail:
        '3人伏击组。低姿态静止3秒后隐蔽，普通敌军需靠近180才能发现；侦察单位在520内可识破，照明和侦察指令也能反制，均须满足实际视野。隐蔽时默认放敌人到300内再开火；射击、受伤或被发现后暴露8秒，随后重新准备。静止蓄势2秒的下一发对步兵增伤80%，移动或射击重置；不隐身穿墙，不攻击未发现目标。',
    },
  ),
  sniper_team: variant(
    'sniper',
    'sniper_team',
    '精确射手组',
    4,
    '1 射手＋1 观察员；就位校射后射程从 650 提升至 880',
    {
      members: 2,
      hp: 110,
      damage: 52,
      rate: 2.6,
      range: 650,
      speed: 50,
      uniform: 'elite',
      tag: '搭档 · 校射点杀',
      detail:
        '1名射手与1名不射击的观察员。射手基础单发52伤害，5发弹匣；观察员在120内停稳0.65秒且未被压制时，将射程650提升至880。观察员跟随射手，为炮兵校射，并标记700内可见敌人，使狙击伤害增加25%。阵亡、负伤、撤退或离队后搭档射程失效。射手优先打击可见的重武器操作手，其次敌方狙击手。',
    },
  ),
  veteran_squad: variant(
    'infantry',
    'veteran_squad',
    '老兵班组',
    4,
    '6 名老兵，双人实射掩护，低弹成员逐个换弹',
    {
      members: 6,
      hp: 260,
      damage: 28,
      range: 400,
      speed: 70,
      doctrine: 'assault',
      discipline: 96,
      infantryAbility: 'fire_discipline',
      uniform: 'elite',
      tag: '前线 · 轮换装填',
      detail:
        '4费6人260生命，96纪律。弹匣不超过12发时，若120内有两名同班队友实际开火掩护，则停稳成员逐个提前换弹；每班最多一人主动装填，耗时2.5秒、只消耗缺少的备用弹。不加快射速、不获得伏击首枪加成；个人受击压制和士气损失仍降低35%。散队、近敌100内或强行推进时不启动轮换，撤退不受阻。',
    },
  ),
  medic_team: variant(
    'medic',
    'medic_team',
    '医疗小组',
    3,
    '3 名随队军医，主动接近伤员，治疗与近距抢救',
    {
      members: 3,
      hp: 150,
      damage: 8,
      rate: 1.2,
      range: 260,
      speed: 66,
      heal: 6,
      healRange: 140,
      uniform: 'medic',
      tag: '机动 · 前线抢救',
      detail:
        '3名随队军医，各自在140范围内寻找伤员；会接近倒地战友，进入64距离后施救。每0.8秒治疗一人6点生命。可以随部队推进，负责把前线伤员从失血边缘救回来。',
    },
  ),
  combat_engineers: variant(
    'infantry',
    'combat_engineers',
    '维修工兵',
    2,
    '3 名机械工兵，随车抢修装甲、清除地雷',
    {
      members: 3,
      hp: 200,
      damage: 26,
      range: 360,
      speed: 66,
      doctrine: 'assault',
      discipline: 85,
      trait: 'mechanic',
      uniform: 'engineer',
      tag: '支援 · 修车排雷',
      detail:
        '3人机械工兵班，靠近停稳的己方装甲抢修。每辆车前后各一个维修位置；动手后每名工兵每0.5秒恢复8点生命，其余队员可警戒或支援别车。也会清除行进路线上的敌方地雷。',
    },
  ),
  // ── v108 炮火支援流派 ─────────────────────────────────────────────
  naval_gunfire: variant(
    'artillery',
    'naval_gunfire',
    '舰炮支援',
    5,
    '3.4 秒后一发 120 伤害舰炮，大范围重创',
    {
      artilleryKind: 'naval',
      tag: '支援 · 重型舰炮',
      detail:
        '呼叫近海舰艇主炮支援，3.4秒后一发120伤害、半径72的重型炮弹砸向目标区域。单发伤害最高的炮火，适合清除密集步兵群或重创基地。',
    },
  ),
  cluster_munitions: variant(
    'artillery',
    'cluster_munitions',
    '集束弹药',
    4,
    '3 秒后 8 发子弹药连续覆盖一片区域',
    {
      artilleryKind: 'cluster',
      tag: '支援 · 区域覆盖',
      detail:
        '发射集束弹药，3秒后8发子弹药以0.32秒间隔连续砸向目标区域，每发14伤害、半径30。对散布在开阔地的步兵群有毁灭性的覆盖效果。',
    },
  ),
  thermobaric: variant(
    'artillery',
    'thermobaric',
    '温压弹',
    4,
    '2.8 秒后一发 55 伤害温压弹，大范围灼烧',
    {
      artilleryKind: 'thermobaric',
      tag: '支援 · 温压灼烧',
      detail:
        '投掷温压弹，2.8秒后一发55伤害、半径58的燃料空气爆炸。冲击波和高温在大范围内造成稳定伤害，对付掩体后的步兵尤其有效。',
    },
  ),
  precision_rocket: variant(
    'artillery',
    'precision_rocket',
    '精确火箭',
    3,
    '2.2 秒后一发 90 伤害精确火箭，小范围点杀',
    {
      artilleryKind: 'rocket',
      tag: '支援 · 精确打击',
      detail:
        '发射精确制导火箭，2.2秒后一发90伤害、半径22的火箭精准命中目标。落点散布极小，适合点杀高价值目标或清除掩体后的班组武器。',
    },
  ),
  // ── v108 防御增益 ─────────────────────────────────────────────────
  entrench: variant(
    'morale',
    'entrench',
    '掘壕固守',
    2,
    '己方全体步兵卧倒并减伤 30%，8 秒',
    {
      effect: 'entrench',
      tag: '守备 · 卧倒减伤',
      detail:
        '命令全体己方步兵立即卧倒并挖掘简易掩体，8秒内受到的伤害降低30%。在敌方炮火或空袭来临前打出，能让整条战线硬吃一轮打击。',
    },
  ),
  // ── v120 快攻经济流派 ─────────────────────────────────────────────
  command_lockdown: variant(
    'jam',
    'command_lockdown',
    '全面静默',
    1,
    '双方 3 秒内都无法打出任何卡牌',
    {
      en: 'COMMAND LOCKDOWN',
      effect: 'ceasefire',
      tag: '双向 · 出牌封锁',
      detail:
        '全频段电磁静默覆盖整个战场，3秒内双方都无法打出任何卡牌。与只锁敌方的电磁干扰不同，这是一张双刃剑——在己方铺场完毕、对手正要反扑时打出，能让对手的反制牌烂在手里。适合打时间差的控制流。',
    },
  ),
  emergency_levy: variant(
    'supply',
    'emergency_levy',
    '紧急征发',
    1,
    '立即获得 3 点指挥点，12 秒内回点放缓',
    {
      en: 'EMERGENCY LEVY',
      economy: 'levy',
      tag: '快攻 · 即时爆发',
      detail:
        '立即获得3点指挥点（可超过上限），代价是12秒内指挥点回复间隔延长35%。比透支指挥更轻量的爆发牌，适合中期抢节奏。',
    },
  ),
  battlefield_salvage: variant(
    'supply',
    'battlefield_salvage',
    '战场回收',
    1,
    '从弃牌堆抽回 1 张费用不超过 3 的单位牌',
    {
      en: 'BATTLEFIELD SALVAGE',
      effect: 'salvage',
      tag: '快攻 · 资源循环',
      detail:
        '回收战场上被击毁装备的可用部件，从弃牌堆中随机抽回1张费用不超过3的单位牌到手牌。快攻卡组的续航引擎，让便宜班组源源不断地填线。',
    },
  ),
  shock_action: variant(
    'jam',
    'shock_action',
    '震慑行动',
    2,
    '敌方全体步兵压制 +35，1.8 秒内无法移动',
    {
      en: 'SHOCK ACTION',
      effect: 'shock',
      tag: '快攻 · 步兵压制',
      detail:
        '集中电子干扰与火力示威，敌方全体步兵压制值+35且1.8秒内无法移动。在冲锋前打出，让敌方步兵钉在原地挨打。',
    },
  ),
  // ── v120 干扰封锁流派 ─────────────────────────────────────────────
  sensor_blind: variant(
    'jam',
    'sensor_blind',
    '传感器致盲',
    1,
    '敌方视野 -55%，6 秒',
    {
      en: 'SENSOR BLIND',
      effect: 'sensor_blind',
      tag: '干扰 · 视野压制',
      detail:
        '干扰敌方观瞄系统，6秒内敌方所有单位视野降低55%。敌方狙击手和侦察单位在致盲期间几乎无法开火，是掩护机动的廉价手段。',
    },
  ),
  logistics_strike: variant(
    'jam',
    'logistics_strike',
    '后勤斩首',
    2,
    '敌方立即失去 3 点指挥点',
    {
      en: 'LOGISTICS STRIKE',
      effect: 'logistics_strike',
      tag: '干扰 · 资源打击',
      detail:
        '打击敌方后勤节点，敌方立即失去3点指挥点。在对手攒费准备打出关键牌时使用，直接打断其节奏。',
    },
  ),
  freq_hop: variant(
    'jam',
    'freq_hop',
    '跳频通讯',
    2,
    '己方 8 秒内免疫所有干扰效果',
    {
      en: 'FREQUENCY HOPPING',
      effect: 'freq_hop',
      tag: '干扰 · 反制',
      detail:
        '全军切换跳频通讯模式，8秒内免疫所有敌方干扰效果（电磁干扰、传感器致盲、电子压制等）。面对干扰流派时的硬 counter。',
    },
  ),
  ewarfare: variant(
    'jam',
    'ewarfare',
    '电子压制',
    3,
    '敌方 5 秒内回点间隔 ×1.6',
    {
      en: 'EW SUPPRESSION',
      effect: 'ewarfare',
      tag: '干扰 · 回点压制',
      detail:
        '全面电子压制敌方指挥网络，5秒内敌方指挥点回复间隔延长60%。比后勤斩首更持久的经济打击，适合封锁流磨死对手。',
    },
  ),
  // ── v120 空降特种流派 ─────────────────────────────────────────────
  airborne_at: variant(
    'rocket',
    'airborne_at',
    '空降反甲组',
    5,
    '双火箭手加双护卫，伞降侧后猎甲',
    {
      members: 4,
      hp: 220,
      damage: 128,
      range: 460,
      rate: 6.5,
      radius: 12,
      speed: 66,
      armorMultiplier: 2.2,
      armorOnly: true,
      infantryMultiplier: 0.35,
      airdrop: true,
      targetGround: true,
      doctrine: 'assault',
      discipline: 92,
      uniform: 'marine',
      tag: '空降 · 装甲猎杀',
      detail:
        '5费4人220生命，直接伞降目标区域。两名火箭手各每6.5秒发射60伤火箭，射程460、对装甲乘2.2，主武器只打载具；两名步枪护卫各每1.1秒4伤、射程340。射程短于地面反坦克组，依靠落点形成侧后交叉火力。',
    },
  ),
  rapid_insertion: variant(
    'infantry',
    'rapid_insertion',
    '快速穿插',
    3,
    '3 人高速空降班，落地后极速穿插',
    {
      members: 3,
      hp: 150,
      damage: 24,
      range: 380,
      speed: 92,
      airdrop: true,
      targetGround: true,
      infantryAbility: 'rapid',
      doctrine: 'recon',
      discipline: 90,
      uniform: 'recon',
      tag: '空降 · 高速穿插',
      detail:
        '3人轻装空降班，落地后以92移速高速穿插敌方防线。适合抢占要点、绕后骚扰或快速增援危急地段。',
    },
  ),
  sapper_assault: variant(
    'infantry',
    'sapper_assault',
    '突击工兵',
    3,
    '4 人防爆工兵，爆炸伤害减半，近身排雷',
    {
      members: 4,
      hp: 200,
      damage: 28,
      range: 380,
      speed: 64,
      trait: 'engineer',
      blastProtection: 0.5,
      uniform: 'engineer',
      doctrine: 'assault',
      discipline: 88,
      tag: '步兵 · 破障突击',
      detail:
        '3费4人200生命。防爆装备使受到的爆炸伤害降低50%，不减免子弹或毒气；36内每1.2秒清除一枚敌雷。负责顶住炮火排雷推进，不维修载具，不额外增加对装甲伤害。',
    },
  ),
  recon_jump: variant(
    'sniper',
    'recon_jump',
    '侦察跳降',
    2,
    '2 人空降侦察组，超远视野，快速部署',
    {
      members: 2,
      hp: 100,
      damage: 24,
      range: 700,
      rate: 1.6,
      sight: 850,
      speed: 88,
      airdrop: true,
      targetGround: true,
      trait: 'scout',
      doctrine: 'recon',
      discipline: 90,
      uniform: 'recon',
      tag: '空降 · 前沿侦察',
      detail:
        '2人轻装侦察组直接跳降前沿，观察850、射程700。低费快速建立视野和点射敌方侦察，也为炮兵提供观察；不建立空降引导区，不享有先导组的后续投送能力。',
    },
  ),
  // ── v120 炮火支援流派 ─────────────────────────────────────────────
  creeping_barrage: variant(
    'artillery',
    'creeping_barrage',
    '徐进弹幕',
    4,
    '6 发炮弹沿轴线递进覆盖，逐步延伸',
    {
      en: 'CREEPING BARRAGE',
      artilleryKind: 'creeping',
      tag: '支援 · 徐进弹幕',
      detail:
        '6发炮弹以0.5秒间隔沿x轴递进覆盖，每发22伤害、半径38。弹幕从目标点向敌方方向逐步延伸，逼迫敌方步兵后撤或被弹幕吞噬。',
    },
  ),
  smoke_cover: variant(
    'smoke',
    'smoke_cover',
    '烟幕急袭',
    2,
    '在目标区域释放 3 道烟幕，宽幅遮蔽',
    {
      en: 'SMOKE COVER',
      effect: 'smoke_screen',
      tag: '支援 · 宽幅烟幕',
      detail:
        '在目标区域及两侧各100距离释放3道烟幕，持续10秒。比基础烟幕宽三倍的遮蔽带，适合掩护大部队通过开阔地。',
    },
  ),
  heavy_barrage: variant(
    'artillery',
    'heavy_barrage',
    '重型弹幕',
    5,
    '4 发重型炮弹，大范围高伤害',
    {
      en: 'HEAVY BARRAGE',
      artilleryKind: 'heavy',
      tag: '支援 · 重型打击',
      detail:
        '4发重型炮弹以0.9秒间隔落下，每发60伤害、半径50。适合打击密集步兵群或坚固工事，一发就能让一个班组失去战斗力。',
    },
  ),
  illumination_round: variant(
    'flare',
    'illumination_round',
    '前沿照明弹',
    1,
    '小范围持续照明，160 半径、14 秒',
    {
      en: 'ILLUMINATION ROUND',
      effect: 'illumination',
      tag: '支援 · 持久照明',
      detail:
        '低空照亮160半径的小范围区域14秒，供一个班组持续观察。普通照明弹花费2点，覆盖260半径、持续10秒，适合照出更宽的战线。两者均会暴露范围内双方部队。',
    },
  ),
  // ── v120 防御守备流派 ─────────────────────────────────────────────
  minefield: variant(
    'smoke',
    'minefield',
    '混合雷场',
    3,
    '一次布置 3 颗反坦克雷，覆盖 120 距离',
    {
      en: 'MINEFIELD',
      effect: 'minefield',
      tag: '守备 · 区域封锁',
      detail:
        '在目标区域及两侧各60距离布置3颗反坦克地雷，2秒后启用。比单颗布雷宽三倍的封锁带，适合扼守通道或保护侧翼。',
    },
  ),
  field_hospital: variant(
    'medic',
    'field_hospital',
    '野战医院',
    4,
    '固定救护站，展开 3 秒；远距治疗、近距快速抢救',
    {
      members: 3,
      hp: 160,
      damage: 0,
      rate: 1.2,
      range: 0,
      speed: 0,
      static: true,
      heal: 9,
      healRange: 220,
      medicalSetup: 3,
      uniform: 'medic',
      tag: '固定 · 后方救护',
      detail:
        '3名军医原地展开救护站，3秒后开始工作，不移动、不射击。每人每0.8秒为220范围内一名伤员恢复9生命；倒地者需被送到64距离内，抢救速度比医疗小组快50%。部署在掩护后方，配合随队军医和战友拖救接收伤员。',
    },
  ),
  fallback: variant(
    'morale',
    'fallback',
    '战术后撤',
    2,
    '己方全体步兵后撤 280 距离，2 秒内移速 +60%',
    {
      en: 'TACTICAL FALLBACK',
      effect: 'fallback',
      tag: '守备 · 战术撤退',
      detail:
        '命令全体己方步兵立即后撤280距离，2秒内移速+60%。在敌方炮火或冲锋来临前拉出距离，保存有生力量。',
    },
  ),
  // ── v120 步兵协同流派 ─────────────────────────────────────────────
  fire_team: variant(
    'infantry',
    'fire_team',
    '火力小组',
    1,
    '2 人轻装班，便宜填线',
    {
      members: 2,
      hp: 90,
      damage: 18,
      range: 360,
      speed: 72,
      discipline: 82,
      tag: '步兵 · 廉价填线',
      detail:
        '2人轻装火力小组，最便宜的步兵单位。适合快速填线、吸引火力或配合战场回收形成源源不断的兵海。',
    },
  ),
  assault_grenadiers: variant(
    'infantry',
    'assault_grenadiers',
    '突击掷弹兵',
    3,
    '4 人掷弹班，每人 3 颗手雷，近战专精',
    {
      members: 4,
      hp: 200,
      damage: 26,
      range: 380,
      speed: 70,
      frags: 3,
      trait: 'close_assault',
      uniform: 'heavy',
      doctrine: 'assault',
      discipline: 88,
      tag: '步兵 · 手雷突击',
      detail:
        '4人突击掷弹班，每人携带3颗手雷，近距离作战专精。手雷对集群步兵和掩体后目标效果极佳，是攻坚的尖刀。',
    },
  ),
  lmg_team: variant(
    'machinegun',
    'lmg_team',
    '轻机枪组',
    3,
    '2 人轻机枪组，短点射间隙借友军掩护换位',
    {
      members: 2,
      hp: 140,
      damage: 4,
      rate: 0.16,
      range: 460,
      speed: 60,
      antiAir: true,
      uniform: 'crew',
      tag: '步兵 · 机动压制',
      detail:
        '1名轻机枪手与1名步枪护卫。机枪每4发短点射后停顿0.8秒，60发弹带、装填2.8秒，可对空。推进命令下，附近180内有友军持续开火掩护、敌人仍在220外时，可利用点射间隙向前换位最多24；无掩护、受压或驻守时留在原位。不需要重机枪的展开，适合跟随突击步兵，而不是单独顶住战线。',
    },
  ),
};
export function modelOf(id: CardId): BaseCardId {
  return CARDS[id].model ?? (id as BaseCardId);
}
export function weaponCard(u: { id: CardId; member: number }): Card {
  const c = CARDS[u.id];
  if (u.id === 'sniper_team')
    return { ...c, members: 1, damage: u.member === 0 ? 52 : 0,
      range: u.member === 0 ? 650 : 0 };
  if (u.id === 'airborne_at')
    return u.member < 2
      ? { ...c, members: 1, damage: 60 }
      : { ...c, members: 1, model: 'infantry', damage: 4, rate: 1.1,
          range: 340, radius: 0, armorOnly: false, armorMultiplier: 0.15, infantryMultiplier: 1 };
  if (u.id === 'antiarmor')
    return u.member === 0
      ? {
          ...c,
          members: 1,
          damage: 48,
          rate: 5.5,
          range: 580,
          radius: 14,
          armorMultiplier: 1.8,
          infantryMultiplier: 0.45,
        }
      : {
          ...c,
          members: 1,
          model: 'infantry',
          damage: 3,
          rate: 1.1,
          range: 340,
          radius: 0,
          armorMultiplier: 0.15,
          infantryMultiplier: 1,
        };
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
  if (u.id === 'airborne_at') return u.member < 2 ? 'rocket' : 'infantry';
  return (modelOf(u.id) === 'machinegun' || u.id === 'antiarmor') &&
    u.member > 0
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
  return !!CARDS[id].targetGround;
}
// Infantry roles use shared real-time rules; card cost never adds an action fee.
Object.assign(CARDS.infantry, {
  infantryAbility: 'cohesion',
  tag: '班组 · 协同抗压',
  description: '六人基础班，相邻同班队员共同抗压。',
  detail:
    '2费6人210生命。身边90内有两名同班战友时，受击压制和士气损失降低35%；生命伤害不减免。',
});
Object.assign(CARDS.armed_police, {
  cost: 2,
  hp: 200,
  damage: 16,
  range: 300,
  infantryAbility: 'guard',
  tag: '守备 · 护卫',
  description: '停步后护卫90内友军步兵，吸引可见枪手火力。',
  detail:
    '2费5人200生命。停步0.65秒后护卫90内友军步兵。敌方普通枪手只在能看见并能命中守备者时转移目标；炮击和火箭不受影响。',
});
Object.assign(CARDS.marines, {
  infantryAbility: 'buddy_rally',
  tag: '陆战 · 战友整队',
  description: '同班战友重伤时，一次性鼓舞附近幸存队员。',
  detail:
    '3费6人270生命。96内同班战友重伤时，每班仅一次：附近幸存者恢复10士气并降低15压制，不超过自身纪律上限；不治疗伤员。保留近距增伤。',
});
Object.assign(CARDS.assault, {
  infantryAbility: 'smoke_assault',
  frags: 2,
  tag: '突击 · 接敌烟幕',
  description: '140内发现敌军时，每班释放一次短烟并集中射击。',
  detail:
    '3费5人260生命。140内可见地面敌军触发每班一次4秒烟幕，附近同班成员4秒内对140内目标装填缩短35%；不穿烟观察远敌。每人另携2枚手榴弹，220内遇敌群聚集时投掷。',
});
Object.assign(CARDS.rangers, {
  hp: 180,
  damage: 28,
  range: 500,
  sight: 720,
  infantryAbility: 'ambush',
  frags: 2,
  tag: '侦察 · 伏击首枪',
  description: '停步蓄势，下一发对步兵增强；移动或射击重置。',
  detail:
    '4费4人180生命，观察720、射程500。连续停步且未射击2秒后，下一发对步兵伤害乘1.8；移动打断，不能攻击未发现目标。每人另携2枚手榴弹，220内遇敌群聚集时投掷。',
});
Object.assign(CARDS.paratroopers, {
  infantryAbility: 'rapid',
  tag: '快援 · 入场冲刺',
  description: '入场8秒内加速增援，首发射击后恢复常速。',
  detail:
    '3费5人220生命。部署后8秒内正常推进移速乘1.8；首次射击立即结束加速，后撤不享受加速。仍从己方基地入场。',
});
Object.assign(CARDS.mountain, {
  infantryAbility: 'mountain_fire',
  tag: '山地 · 掩体远射',
  description: '稳定掩体中扩大射程，离开后恢复常规射程。',
  detail:
    '3费4人200生命。稳定停步0.65秒且身处有效掩体时射程增加25%；移动或离开掩体后失效。保留快速越障。',
});
Object.assign(CARDS.commandos, {
  cost: 5,
  members: 3,
  hp: 300,
  damage: 36,
  range: 400,
  infantryAbility: 'elite',
  neverSurrender: true,
  frags: 2,
  tag: '精锐 · 快速伏击',
  description: '少人精锐，快速准备伏击，个人抗压且不投降。',
  detail:
    '5费3人300生命。停步未开火1秒后，下一发对步兵伤害乘1.5；个人受击压制和士气损失降低35%。不投降，低士气仍会撤退。射程短于游骑兵。每人另携2枚手榴弹，220内遇敌群聚集时投掷。',
});
Object.assign(CARDS.scouts, {
  cost: 1,
  members: 2,
  hp: 46,
  damage: 4,
  rate: 1.5,
  range: 260,
  sight: 760,
  speed: 74,
  tag: '侦察 · 低费观察',
  description: '远处接敌时停步观察，双人自卫火力微弱。',
  detail:
    '1费2人46生命，观察760、射程260，每1.5秒全组4伤害。600内发现地面敌军时停步观察，不主动进入步枪射程；强行推进命令可覆盖。为全军共享正常视野，烟幕和地形规则不变。',
});
Object.assign(CARDS.medic, {
  cost: 1,
  members: 2,
  hp: 60,
  damage: 4,
  heal: 3,
  tag: '医疗 · 低费救援',
  detail:
    '1费2人60生命。每0.8秒每人治疗3生命，优先抢救伤员；全组自卫伤害4，不能救活死者或修理载具。',
});
Object.assign(CARDS.engineers, {
  cost: 1,
  members: 2,
  hp: 70,
  damage: 6,
  range: 260,
  tag: '工程 · 低费排雷',
  description: '双人工具组，近身排雷，自卫火力有限。',
  detail:
    '1费2人70生命。36内每1.2秒排除一枚敌方地雷；不能发现远处地雷。全组6伤害，不能修理装甲，也没有突击工兵的爆炸减伤。',
});
Object.assign(CARDS.antiarmor, {
  cost: 2,
  members: 4,
  hp: 160,
  damage: 57,
  range: 580,
  rate: 3,
  radius: 14,
  armorMultiplier: 1.8,
  doctrine: 'support',
  tag: '反甲 · RPG混编',
  description: '一名RPG手与三名步枪护卫，压制轻甲。',
  detail:
    '2费4人160生命。1名RPG手每3秒48伤害、射程580、对甲乘1.8；3名护卫各每1.1秒3伤害、射程340。火箭直飞不制导，无法替代标枪。',
});

export const DECK_SIZE = 20;
export const DECK: CardId[] = [...DECK_PRESETS[0].cards];

export function validDeck(value: unknown): value is CardId[] {
  return (
    Array.isArray(value) &&
    value.length === DECK_SIZE &&
    value.every(
      (id) =>
        typeof id === 'string' &&
        Object.hasOwn(CARDS, id) &&
        value.filter((v) => v === id).length <= copyLimit(id as CardId),
    )
  );
}

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

export function copyLimit(id: CardId) {
  if (CARDS[id]?.internal) return 0;
  if (id === 'toxic_cloud') return 1;
  if (id === 'militia') return 6;
  if (id === 'infantry' || id === 'pickup') return 4;
  if (
    [
      'heavy_tank',
      'rocket_heli',
      'barrage',
      'bomber',
      'forward_hq',
      'naval_gunfire',
    ].includes(id)
  )
    return 1;
  if (
    [
      'machinegun',
      'rocket',
      'medic',
      'morale',
      'supply',
      'smoke',
      'recon',
      'marines',
      'armed_police',
      'paratroopers',
      'assault',
      'engineers',
      'mountain',
      'scouts',
      'grenadiers',
      'antiarmor',
      'manpads',
      'rally',
      'scout_drone',
      'loiter_drone',
      'fpv_drone',
      'antitank_mine',
      'foraged_supplies',
      'spoof_attack',
      'ambush_squad',
      'medic_team',
      'combat_engineers',
      'entrench',
      'precision_rocket',
    ].includes(id)
  )
    return 3;
  return 2;
}
Object.assign(CARDS.artillery, {
  name: '野战榴弹炮',
  en: 'FIELD HOWITZER',
  type: 'unit',
  hp: 190,
  damage: 44,
  rate: 9,
  range: 1250,
  minRange: 280,
  speed: 0,
  static: true,
  indirect: true,
  radius: 36,
  emplacement: 'howitzer',
  targetGround: false,
  sight: 390,
  baseMultiplier: 0.15,
  tag: '炮兵 · 周期火力',
  description: '固定炮兵单位，自动向已发现的敌军开火。',
  detail:
    '190 生命。每 9 秒向友军已发现的敌人发射一发榴弹，射程 280–1250，中心 44 伤害。落点有散布，临近落弹才可能被察觉。',
});
Object.assign(CARDS.barrage, {
  name: '重型榴弹炮',
  type: 'unit',
  hp: 240,
  damage: 68,
  rate: 13,
  range: 1450,
  minRange: 350,
  speed: 0,
  static: true,
  indirect: true,
  radius: 44,
  emplacement: 'howitzer',
  targetGround: false,
  effect: undefined,
  sight: 390,
  baseMultiplier: 0.15,
  description: '大口径周期炮击，需要前线观察员。',
  detail:
    '240 生命，每 13 秒 68 伤害、半径 44。射程 350–1450，部署后固定；只向已被友军观察到的敌军开火。',
});
Object.assign(CARDS.precision, {
  name: '校射榴弹炮',
  type: 'unit',
  hp: 170,
  damage: 75,
  rate: 12,
  range: 1350,
  minRange: 300,
  speed: 0,
  static: true,
  indirect: true,
  guided: false,
  radius: 22,
  emplacement: 'howitzer',
  targetGround: false,
  sight: 390,
  baseMultiplier: 0.2,
  description: '低频校射炮击，打击已发现的重装目标。',
  detail:
    '170 生命，每 12 秒发射 75 伤害校射榴弹，射程 300–1350。固定阵地，需要友军持续观察。',
});
CARDS.manpads.guided = true;
CARDS.manpads.sight = 860;
for (const [id, damage] of [
  ['tank', 390],
  ['light_tank', 300],
  ['heavy_tank', 510],
] as const) {
  CARDS[id].penetration = damage;
  CARDS[id].detail +=
    ` 对装甲使用 ${damage} 伤害穿甲弹，命中仅产生穿甲火星，击毁后才爆炸；对步兵使用高爆弹。`;
}
Object.assign(CARDS.interceptor, {
  sortie: true,
  patrol: false,
  returnCost: 1,
  sortieCooldown: 18,
  speed: 620,
  sight: 1050,
  description: '快速通场争夺制空权，返航后仅需 1 费。',
  detail:
    '150 生命，单次高速穿过战场，只攻击空中目标。存活离场回手，满手则弃牌；返航冷却 18 秒，后续该张卡 1 费。被击落重置为全价。',
});
Object.assign(CARDS.attack_drone, {
  sortie: true,
  returnCost: 1,
  sortieCooldown: 16,
  speed: 450,
  sight: 740,
  guided: true,
  description: '单次通场制导攻击，返航后仅需 1 费。',
  detail:
    '90 生命，单次通场发射反甲导弹。成功离场返回手牌，满手则弃牌；冷却 16 秒，此后该张卡花费 1。被击落会失去优惠。',
});
CARDS.rocket_heli.guided = true;

for (const card of Object.values(CARDS)) {
  if (card.emplacement)
    card.detail += ' 从己方基地入场，随前线护卫牵引至射程内，架设后固定。';
}

// Tactical orders are situational alternatives to buying another squad.
Object.assign(CARDS.rally, {
  cost: 1,
  description: '一费稳住溃退班组',
  detail:
    '存活且未投降的己方步兵恢复40士气，清除80%压制并立即重新判断战术。不会复活、解除投降或强制仍然恐慌的士兵返战。',
});
Object.assign(CARDS.jam, {
  cost: 1,
  description: '封锁敌方主动抽牌9秒',
  detail:
    '封锁敌方主动抽牌9秒；不影响补给卡和部署抽牌。重复使用刷新时间，不累加。',
});
Object.assign(CARDS.smoke, {
  cost: 1,
  description: '十秒烟幕，掩护接近与抢救',
  detail:
    '在指定位置释放半径110的烟幕，持续10秒。遮蔽双方远距直射；近距交火、曲射火炮与穿烟侦察仍然有效。',
});
Object.assign(CARDS.recon, {
  cost: 1,
  description: '十二秒共享校射与穿烟观察',
  detail:
    '全军射程提升20%，扩大观察并穿透烟幕，持续12秒。需要己方观察范围内的目标，不能读取全地图敌人。重复使用刷新时间。',
});
Object.assign(CARDS.fortify, {
  cost: 1,
  description: '静止步兵十秒减伤三成',
  detail:
    '在场己方步兵恢复10士气；10秒内静止步兵受到的伤害减少30%，移动即失去该减伤。不会替玩家下达驻守命令，重复使用不叠加倍率。',
});
Object.assign(CARDS.sabotage, {
  cost: 2,
  description: '压住已发现敌军三秒火力',
  detail:
    '令已发现敌军的主武器和同轴机枪至少再装填3秒。不可见敌人不受影响，已发射弹药不消失；重复使用只刷新停火窗口。',
});
Object.assign(CARDS.emp, {
  cost: 3,
  description: '干扰已见空中与制导武器',
  detail:
    '封锁主动抽牌14秒并取消敌方校射；已发现的飞机、无人机与制导武器至少停火4秒。不会伤害单位或停止飞行，不影响隐藏目标。',
});
Object.assign(CARDS.repair, {
  cost: 2,
  description: '立即抢修一辆重伤装甲',
  detail:
    '优先选择缺血最多的一辆存活地面装甲，立即恢复30生命，随后6秒每秒修复20。不能修复无甲车辆、飞机或残骸；重复使用只刷新维修时间。',
});
Object.assign(CARDS.morale, {
  cost: 2,
  description: '鼓舞全军，八秒协同进攻',
  detail:
    '在场步兵恢复15士气并清除40%压制；全军8秒伤害增加35%、移速增加20%。适合在双方接敌时使用，重复使用不叠加倍率。',
});
Object.assign(CARDS.medevac, {
  cost: 2,
  description: '优先抢救伤员与附近步兵',
  detail:
    '优先选择一名伤员或受伤最重的步兵，为其220范围内的友军步兵恢复18生命和8士气。伤员得到救护进度，达到恢复门槛后起身；死亡和投降者不复活。',
});

// v17: preserve each heavy hit while leaving real reload windows for infantry.
Object.assign(CARDS.tank, {
  rate: 4.8,
  detail: '650生命。主炮装填4.8秒，高爆80伤，穿甲390伤；同轴机枪短点射后停顿。',
});
Object.assign(CARDS.light_tank, {
  rate: 3.8,
  detail: '420生命。主炮装填3.8秒，高爆58伤，穿甲300伤；同轴机枪短点射。',
});
Object.assign(CARDS.heavy_tank, {
  rate: 6.4,
  detail: '950生命。主炮装填6.4秒，高爆110伤，穿甲510伤；同轴机枪短点射。',
});
Object.assign(CARDS.rocket, {
  rate: 4.8,
  detail: '5人200生命。全组每4.8秒发射100范围伤害，射程650；齐射后需要装填。',
});
Object.assign(CARDS.antiarmor, {
  rate: 5.5,
  detail:
    '2费4人160生命。RPG手每5.5秒48伤，射程580，对甲乘1.8；三名护卫各每1.1秒3伤，射程340。',
});
Object.assign(CARDS.mortar, {
  rate: 7,
  detail: '3人150生命。每7秒全组66伤害，射程180–820；曲射后需要装填。',
});
Object.assign(CARDS.mortar_carrier, {
  rate: 8,
  detail: '270生命。每8秒42伤，射程170–780；保留近敌后撤与曲射。',
});
Object.assign(CARDS.artillery, {
  rate: 12,
  detail: '190生命，每12秒44伤害，半径36，射程280–1250。依靠友军观察。',
});
Object.assign(CARDS.barrage, {
  rate: 17,
  detail: '240生命，每17秒68伤害，半径44，射程350–1450。依靠友军观察。',
});
Object.assign(CARDS.precision, {
  rate: 15,
  detail: '170生命，每15秒75伤害，半径22，射程300–1350。依靠友军观察。',
});
Object.assign(CARDS.javelin, {
  rate: 6,
  armorOnly: true,
  description: '重弹留给载具，步枪近卫',
  detail:
    '4费2人140生命。主弹仅射载具，每6秒全组104伤，制导对甲乘2.4；240内用弱步枪自卫，不以重弹打步兵或基地。',
});
Object.assign(CARDS.anti_tank_gun, {
  rate: 5,
  armorOnly: true,
  description: '专注反甲，近敌弱自卫',
  detail:
    '240生命。每5秒75穿甲伤，射程100–840，对甲乘2.6；主炮仅打载具，240内小枪弱自卫。',
});
Object.assign(CARDS.helicopter, {
  damage: 7,
  rate: 0.12,
  burstSize: 6,
  burstPause: 0.6,
  description: '六发连续扫射，短停换弹',
  detail: '260生命，射程540。每0.12秒7伤，连续六发后停0.6秒，不增加生命。',
});
Object.assign(CARDS.rocket_heli, {
  rate: 4.2,
  detail: '220生命，射程650。每4.2秒60伤害制导弹，对甲乘1.4；不对空。',
});
Object.assign(CARDS.fpv_drone, {
  cost: 1,
  flightTime: 24,
  description: '一费猎甲，二十四秒航时',
  detail:
    '1费24生命。24秒内接近可见目标，500内优先俯冲载具；撞击216对甲伤、半径14，目标丢失后只飞向最后锁点。不伤基地，超时坠落消耗。',
});
Object.assign(CARDS.interceptor, {
  patrol: true,
  patrolTime: 24,
  speed: 480,
  damage: 52,
  rate: 0.75,
  guided: true,
  radius: 0,
  range: 900,
  sight: 1050,
  description: '前沿巡逻待命，自动截敌',
  detail:
    '5费150生命，己方前沿巡逻24秒。每0.75秒52伤制导对空，只锁定可见飞机；持续飞行，随后返己方。成功回手18秒后1费再出动，击落重置全价。',
});
