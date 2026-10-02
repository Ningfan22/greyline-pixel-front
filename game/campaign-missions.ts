import type { Mission } from './campaign';

/** 断线之地：四幕二十关。每个场景保留独立的部署、无线电与战斗节奏。 */
export const CAMPAIGN_MISSIONS: Mission[] = [
  {
    id: 'salt-road',
    act: 1,
    actTitle: '救援通道',
    aiDeck: 0,
    playerDeck: 0,
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
    act: 1,
    actTitle: '救援通道',
    aiDeck: 2,
    playerDeck: 0,
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
    act: 1,
    actTitle: '救援通道',
    aiDeck: 4,
    playerDeck: 0,
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
    act: 1,
    actTitle: '救援通道',
    aiDeck: 1,
    playerDeck: 3,
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
    act: 1,
    actTitle: '救援通道',
    aiDeck: 3,
    playerDeck: 4,
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
    act: 2,
    actTitle: '旧令来源',
    aiDeck: 2,
    playerDeck: 0,
    title: '静默终站',
    chapter: '第六章',
    region: '北线终站 · 黎明',
    mapId: 'greyline',
    objective: 'assault',
    objectiveX: 3680,
    duration: 420,
    camera: 540,
    briefing:
      '盐路、电台、渡口和货站终于接成了一条线。北线终站仍在转发旧命令，阻止沿线撤离。摧毁它的指挥设施，救下站内通信员；我们需要知道这些命令究竟从哪里来。',
    goal: '420秒内摧毁敌方指挥部，同时保住己方指挥部。',
    preparation:
      '己方坦克、步兵、侦察与野战榴弹炮已经展开；敌方机枪、反甲组与单兵防空守在步战车和炮兵前方。敌军在90、210、300秒增援。',
    victory:
      '终站的发送机停了，开火命令却从西部另一个呼号传来。投降的通信员贺川交出一张纸条：旧令带着同一个过期编号，原始记录还保存在边界档案站。',
    defeat:
      '终站仍在发出旧命令。把观察、反甲与掩护送到同一条前线，让炮兵和装甲真正接上进攻。',
    openingDialogue: [
      {
        speaker: '联络官 · 许岚',
        text: '盐路、电台、渡口、货站，现在都能互相听见了。终站还在转发旧的开火命令，但它的呼号像是被人借用了。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '这次有坦克、步兵、侦察和榴弹炮支援。敌军的反甲与防空阵地都在，不要让任何一支部队单独冲进去。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '420秒内摧毁敌方指挥部，并守住自己的基地。站内有人请求投降；停下发送机，也要把他们带回来。',
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
  {
    id: 'border-archive',
    act: 2,
    actTitle: '旧令来源',
    aiDeck: 6,
    playerDeck: 1,
    title: '纸上的停火',
    chapter: '第七章',
    region: '西部边界 · 深夜',
    mapId: 'mountains',
    night: true,
    objective: 'capture',
    objectiveX: 2570,
    duration: 360,
    camera: 640,
    briefing:
      '贺川曾是终站的无线电兵。他记得停火那天，所有机器都收到过同一条确认，之后却只有旧的开火令被反复播放。山口档案站保存着纸质签收本。通信链路可以篡改，纸上的签名还在。',
    goal: '360秒内让可作战步兵控制档案站15秒，并保住己方指挥部。',
    preparation:
      '山地步兵、侦察组和工兵夜间接近档案站，步战车提供掩护。敌方哨兵、机枪和狙击手守着林口，80秒与200秒有两轮增援。',
    victory:
      '签收本上有双方的停火确认，日期与编号没有歧义。最后一页被撕掉了一半，只剩转运车的车牌。贺川认出它：那辆车今夜要经过旱原检查站。',
    defeat:
      '天亮前未能取出签收本。夜间推进更需要照明和观察；先压制近处哨兵，再让步兵接管档案站。',
    openingDialogue: [
      {
        speaker: '通信员 · 贺川',
        text: '我在终站收到过停火确认。后来机器只播旧令，没人肯相信一个没盖章的抄件。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '档案站有签收原本。今夜取出来，才有办法让两边的指挥官面对同一份证据。',
      },
      {
        speaker: '工兵班长 · 林澈',
        text: '路窄，灯也灭了。侦察先确认哨位，我带人进站；火力别打到存放记录的区域。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '360秒内控制档案站15秒。黑暗里不要追逐每一个枪口闪光，留人守住联络线。',
      },
    ],
    phaseHints: [
      {
        at: 40,
        text: '许岚：夜间视野受限。照明与侦察能帮助支援火力发现哨位。',
      },
      {
        at: 160,
        text: '贺川：档案在站房里。装甲只能掩护，必须由步兵留在标记区域。',
      },
      {
        at: 280,
        text: '林澈：还剩80秒。清理占领区附近的敌军，别让刚接上的电台再次失守。',
      },
    ],
    opening: [
      { side: 0, id: 'mountain', x: 1100 },
      { side: 0, id: 'scouts', x: 1230 },
      { side: 0, id: 'engineers', x: 900 },
      { side: 0, id: 'ifv', x: 750 },
      { side: 1, id: 'infantry', x: 2470, guard: true },
      { side: 1, id: 'machinegun', x: 2750, guard: true },
      { side: 1, id: 'sniper', x: 2930, guard: true },
    ],
    waves: [
      {
        at: 80,
        cards: ['scouts', 'assault'],
        message: '档案站外的巡逻队返回，灯光被发现了。',
      },
      {
        at: 200,
        cards: ['pickup', 'antiarmor', 'infantry'],
        message: '检查站派来轻装增援，准备守住档案站出口。',
      },
    ],
  },
  {
    id: 'white-flag-crossing',
    act: 2,
    actTitle: '旧令来源',
    aiDeck: 5,
    playerDeck: 4,
    title: '白旗检查站',
    chapter: '第八章',
    region: '旱原公路 · 上午',
    mapId: 'desert',
    objective: 'defend',
    objectiveX: 1480,
    duration: 240,
    camera: 760,
    briefing:
      '载着通信设备的转运车在检查站熄火。车上没有秘密武器，只有两名技术员和一箱发送记录。哨兵放下了枪，却有一支拒绝停火的机动队正在赶来。把车修好，让愿意停下的人活着离开。',
    goal: '守住己方指挥部240秒，等待转运车辆修复撤离。',
    preparation:
      '武警、反甲组和机枪守卫检查站，工兵与军医在后方。敌军在25、100、175秒投入轻装、装甲与旋翼机；友军山地步兵将在120秒抵达。',
    victory:
      '引擎终于重新响起。记录显示，北线封锁指挥官霍峥下令用采石场转发器覆盖停火确认，继续控制铁路补给线。周榆替双方伤员换完绷带，才发现他们说的是同一种家乡话。',
    defeat:
      '机动队突破检查站，转运车仍没能启动。反甲组需要前线观察与步兵掩护，不要让维修区成为唯一的防线。',
    openingDialogue: [
      {
        speaker: '工兵班长 · 林澈',
        text: '发动机能修，四分钟。我得有人挡住前面，才能把手伸进这堆烫铁里。',
      },
      {
        speaker: '军医 · 周榆',
        text: '白旗下面有我们的人，也有他们的人。先把伤员送到后方，别问袖章是哪一种。',
      },
      {
        speaker: '通信员 · 贺川',
        text: '来的是不认停火的机动队。车里有他们改写命令的记录，他们不会放它过去。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '守住240秒。山地驻军已答应增援，在他们到达前留够反甲和防空。',
      },
    ],
    phaseHints: [
      {
        at: 65,
        text: '林澈：传动轴接好了，还有油路。下一批敌军带装甲，反甲组准备。',
      },
      {
        at: 145,
        text: '周榆：伤员已转移。军医和守军都要保住，最后一轮可能有空中支援。',
      },
      { at: 210, text: '许岚：还要守30秒，车队正在掉头。不要离开检查站追击。' },
    ],
    opening: [
      { side: 0, id: 'armed_police', x: 1490, guard: true },
      { side: 0, id: 'machinegun', x: 1300, guard: true },
      { side: 0, id: 'antiarmor', x: 1160, guard: true },
      { side: 0, id: 'engineers', x: 860, guard: true },
      { side: 0, id: 'medic', x: 650, guard: true },
      { side: 1, id: 'militia', x: 2430 },
      { side: 1, id: 'pickup', x: 2630 },
    ],
    waves: [
      {
        at: 25,
        cards: ['assault', 'pickup'],
        message: '机动队先头沿公路抵达，检查站遭到试探攻击。',
      },
      {
        at: 100,
        cards: ['light_tank', 'infantry', 'mortar_carrier'],
        message: '敌军装甲与迫炮车接近维修区。',
      },
      {
        at: 175,
        cards: ['rocket_heli', 'antiarmor'],
        message: '旋翼机越过旱原，车队仍需要最后一分钟。',
      },
    ],
    reinforcements: [
      {
        at: 120,
        cards: ['mountain', 'manpads'],
        x: 650,
        message: '山地驻军加入检查站防御，防空组已到位。',
      },
    ],
  },
  {
    id: 'quarry-transmitter',
    act: 2,
    actTitle: '旧令来源',
    aiDeck: 2,
    playerDeck: 0,
    title: '采石场回声',
    chapter: '第九章',
    region: '废弃采石场 · 正午',
    mapId: 'mountains',
    objective: 'assault',
    objectiveX: 3680,
    duration: 360,
    camera: 630,
    briefing:
      '发送记录指向一座早已停工的采石场。霍峥不愿交出铁路补给线，用双方都认识的编号重播旧令，让每一处哨站相信只有自己在执行命令。必须切断山壁后的转发器，给真实的停火消息留出一条频率。',
    goal: '360秒内摧毁敌方指挥部，关闭采石场转发器。',
    preparation:
      '己方坦克、两班步兵、侦察组与野战炮展开；山口由敌方机枪、反甲炮和迫炮车防守。敌军在80、180、270秒增援；130秒友军送来工兵与补给组。',
    victory:
      '山壁不再重复那段开火令。短暂的安静里，两边的哨站第一次同时听到了停火确认。发送记录还留下另一条线路：边界的三个信号柜，仍在把新消息当作假电文拦截。',
    defeat:
      '转发器仍在工作。采石场的远程火力需要侦察定位，把步兵护卫与反甲力量一起送上山路。',
    openingDialogue: [
      {
        speaker: '通信员 · 贺川',
        text: '这段声音我听过上百遍。不是新命令，是同一卷录音，每次都换一个发送时间。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '他们让整条战线互相猜疑。关闭转发器，再公开纸质签收本；消息必须让两边同时听见。',
      },
      {
        speaker: '工兵班长 · 林澈',
        text: '山口有反甲炮，步兵护住坦克。我会带补给组跟上，别把支援丢在山脚。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '360秒内摧毁敌方指挥部。先让观察员看见山口，再集中火力打开通路。',
      },
    ],
    phaseHints: [
      {
        at: 45,
        text: '许岚：山口反甲炮仍能威胁装甲。观察和掩护要先于坦克接近。',
      },
      {
        at: 150,
        text: '林澈：补给组已跟上。别让低弹药部队单独承担下一轮进攻。',
      },
      {
        at: 285,
        text: '贺川：还剩75秒。转发器就在指挥部，突破山口后继续推进。',
      },
    ],
    opening: [
      { side: 0, id: 'tank', x: 1070 },
      { side: 0, id: 'infantry', x: 940 },
      { side: 0, id: 'infantry', x: 730 },
      { side: 0, id: 'scouts', x: 1210 },
      { side: 0, id: 'field_gun', x: 530 },
      { side: 1, id: 'machinegun', x: 2350, guard: true },
      { side: 1, id: 'anti_tank_gun', x: 2760 },
      { side: 1, id: 'mortar_carrier', x: 3110 },
    ],
    waves: [
      {
        at: 80,
        cards: ['infantry', 'grenadiers'],
        message: '采石场守军向山口补充步兵。',
      },
      {
        at: 180,
        cards: ['tow_ifv', 'antiarmor'],
        message: '敌方反甲车队赶到，山路上的装甲需要护卫。',
      },
      {
        at: 270,
        cards: ['heavy_mg', 'tank'],
        message: '转发器守卫投入最后一支装甲预备队。',
      },
    ],
    reinforcements: [
      {
        at: 130,
        cards: ['engineers', 'supply_team'],
        x: 620,
        message: '林澈与补给组抵达采石场入口，准备支援前线。',
      },
    ],
  },
  {
    id: 'three-key-network',
    act: 2,
    actTitle: '旧令来源',
    aiDeck: 6,
    playerDeck: 3,
    title: '三把钥匙',
    chapter: '第十章',
    region: '边界信号带 · 傍晚',
    mapId: 'greyline',
    objective: 'capture',
    objectiveX: 1810,
    duration: 420,
    camera: 700,
    capturePoints: [
      { x: 1810, label: '线路接入柜', seconds: 12 },
      { x: 2520, label: '签名校验柜', seconds: 15 },
      { x: 3160, label: '公共广播柜', seconds: 18 },
    ],
    briefing:
      '停火电文已经准备好，却被沿线校验柜逐层拒绝。贺川知道它们的工作顺序：接入、核验、广播。你需要让步兵逐个接管三处信号柜，取下被替换的密钥。完成之前，任何一段广播都可能被旧令截断。',
    goal: '420秒内依次控制接入柜12秒、校验柜15秒、广播柜18秒；三处全部接通即胜利。',
    preparation:
      '陆战队、侦察组、工兵与步战车从线路西端推进。三处节点各有守卫；敌军100、220、330秒增援。170秒友军步兵与军医跟进。',
    victory:
      '三盏指示灯依次亮起，纸上的签名与广播中的确认终于一致。部分敌方驻军开始停火、放人过境；拒绝命令的部队却转向了那条刚刚开放的救援通道。',
    defeat:
      '广播只接通了片刻，未完成的校验又把消息截断。每一处节点都需要步兵驻留，按顺序推进，把护卫留给接管中的人员。',
    openingDialogue: [
      {
        speaker: '通信员 · 贺川',
        text: '三个柜子不能跳过。先接线路，再认签名，最后才能让所有人听见。',
      },
      {
        speaker: '工兵班长 · 林澈',
        text: '我能换密钥，清出每一处柜子附近的守军就行。车替不了站在柜前的人。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '接入12秒、核验15秒、广播18秒，按地图上的顺序来。友军会跟上，别让推进队被切断。',
      },
      {
        speaker: '军医 · 周榆',
        text: '两边都有哨站等消息。让他们听完这一遍，就能少几辆救护车。',
      },
    ],
    phaseHints: [
      {
        at: 55,
        text: '贺川：按地图当前标记接管线路；每完成一处会开启下一处节点。',
      },
      {
        at: 190,
        text: '许岚：第二处周围有反甲守卫。步兵接管时，让观察与火力继续向前覆盖。',
      },
      {
        at: 335,
        text: '林澈：最后85秒。广播柜需要18秒，清出争夺区后保持驻留。',
      },
    ],
    opening: [
      { side: 0, id: 'marines', x: 1110 },
      { side: 0, id: 'scouts', x: 1270 },
      { side: 0, id: 'engineers', x: 920 },
      { side: 0, id: 'ifv', x: 750 },
      { side: 1, id: 'infantry', x: 1830, guard: true },
      { side: 1, id: 'machinegun', x: 2560, guard: true },
      { side: 1, id: 'antiarmor', x: 2740, guard: true },
      { side: 1, id: 'armed_police', x: 3190, guard: true },
    ],
    waves: [
      {
        at: 100,
        cards: ['assault', 'scout_car'],
        message: '守军机动队正向第二处信号柜靠拢。',
      },
      {
        at: 220,
        cards: ['antiarmor', 'infantry', 'helicopter'],
        message: '敌方增援抵达广播柜，空中支援进入线路上空。',
      },
      {
        at: 330,
        cards: ['ifv', 'heavy_mg'],
        message: '敌方预备队试图切断最后一个节点。',
      },
    ],
    reinforcements: [
      {
        at: 170,
        cards: ['infantry', 'medic'],
        x: 860,
        message: '友军接管后方道路，军医随队支援接线人员。',
      },
    ],
  },
  {
    id: 'open-corridor',
    act: 3,
    actTitle: '通道争夺',
    aiDeck: 5,
    playerDeck: 4,
    title: '已开放的路',
    chapter: '第十一章',
    region: '南部撤离道 · 下午',
    mapId: 'desert',
    objective: 'defend',
    objectiveX: 1550,
    duration: 300,
    camera: 820,
    briefing:
      '广播刚恢复，第一批跨线车队便驶上公路。对面指挥官承认签收本的效力，派出了护送队；拒绝停火的机动部队却试图在两支车队会合前重新封路。现在守住这条通道，比继续追击更重要。',
    goal: '守住己方指挥部300秒，掩护两支撤离车队会合。',
    preparation:
      '步兵、武警、反甲与防空组守住公路，后方有军医。敌军在20、105、205秒增援；145秒对面停火驻军以友军身份投入步兵和轻型装甲。',
    victory:
      '两支车队在公路中段会合，第一次没有人要求另一边倒退。贺川带来的护送兵留下来守路。前方水渠桥却被机动队占据，车辆只能停在缺水的旱原上。',
    defeat:
      '道路在会合前被截断。守住后方比向外追敌更要紧，装甲和空中威胁必须都有能接替的反制力量。',
    openingDialogue: [
      {
        speaker: '联络官 · 许岚',
        text: '他们的驻军承认签收本了，派护送队过来。先别开火，友军呼号已经录入。',
      },
      {
        speaker: '通信员 · 贺川',
        text: '拒绝停火的机动队还在追他们。我要让家乡那边的人知道，这条路真的能走。',
      },
      {
        speaker: '军医 · 周榆',
        text: '车队一旦进入狭路就没法掉头。给他们五分钟，也给愿意停火的人一点信任。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '守住300秒。反甲、防空与步兵彼此掩护，145秒友军将接入防线。',
      },
    ],
    phaseHints: [
      {
        at: 65,
        text: '许岚：第一批车已经进入通道。不要为了追击轻装先头拆散防线。',
      },
      {
        at: 155,
        text: '贺川：护送队到了。他们会沿公路支援，但基地后方仍需要守卫。',
      },
      {
        at: 255,
        text: '周榆：还有45秒。会合点快清空了，守住最后一段撤离时间。',
      },
    ],
    opening: [
      { side: 0, id: 'infantry', x: 1530, guard: true },
      { side: 0, id: 'armed_police', x: 1320, guard: true },
      { side: 0, id: 'antiarmor', x: 1170, guard: true },
      { side: 0, id: 'manpads', x: 1000, guard: true },
      { side: 0, id: 'medic', x: 770, guard: true },
      { side: 1, id: 'assault', x: 2420 },
    ],
    waves: [
      {
        at: 20,
        cards: ['pickup', 'assault', 'grenadiers'],
        message: '机动部队绕过停火哨站，正在抢占撤离道路。',
      },
      {
        at: 105,
        cards: ['tank', 'tow_ifv', 'infantry'],
        message: '敌军装甲突击队试图截断车队会合点。',
      },
      {
        at: 205,
        cards: ['rocket_heli', 'mortar_carrier', 'assault'],
        message: '空地火力进入通道，撤离还未完成。',
      },
    ],
    reinforcements: [
      {
        at: 145,
        cards: ['infantry', 'light_tank'],
        x: 680,
        message: '停火驻军护送队加入友军，协同守卫撤离道。',
      },
    ],
  },
  {
    id: 'canal-bridge',
    act: 3,
    actTitle: '通道争夺',
    aiDeck: 1,
    playerDeck: 0,
    title: '水渠两岸',
    chapter: '第十二章',
    region: '灌渠桥头 · 黄昏',
    mapId: 'greyline',
    objective: 'capture',
    objectiveX: 2150,
    duration: 420,
    camera: 720,
    capturePoints: [
      { x: 2150, label: '桥头闸门', seconds: 15 },
      { x: 2950, label: '东岸通行岗', seconds: 20 },
    ],
    briefing:
      '旱原车队缺水，唯一可通行的水渠桥被重新封锁。工兵需要先接管桥头闸门，再打开东岸通行岗，检查受损的桥面。对岸村落的人带来清水，却不敢再靠近枪声。',
    goal: '420秒内依次控制桥头闸门15秒、东岸通行岗20秒，打通水渠桥。',
    preparation:
      '坦克、步兵、工兵与侦察组沿桥西展开；机枪守桥头，反甲组与步战车守东岸。敌军在90、210、325秒增援；180秒友军带来补给和陆战队。',
    victory:
      '桥头的横杆升起来了，装水的车先过了桥。林澈在桥缝里找到一枚未拆的引信，说明封锁者准备连撤离道一并毁掉。他们的弹药来自北面的铁路货场。',
    defeat:
      '桥还在，通行岗却没能接管。占领需要步兵留在当前节点；让火力向下一段覆盖，别把所有人都赶过桥。',
    openingDialogue: [
      {
        speaker: '工兵班长 · 林澈',
        text: '桥面有裂口，但还能走。先拿桥头闸门，我确认承重后再去东岸。',
      },
      {
        speaker: '军医 · 周榆',
        text: '后面四辆车都没水了。村里人送来了水桶，枪声不停，他们过不来。',
      },
      {
        speaker: '通信员 · 贺川',
        text: '东岸守军不听新频率。我的人会带补给跟上，请给他们留一段能落脚的路。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '420秒内完成两次接管，桥头15秒、东岸20秒。车辆掩护，步兵确认通行。',
      },
    ],
    phaseHints: [
      {
        at: 55,
        text: '林澈：第一处目标是桥头闸门。反甲威胁在东岸，坦克先等步兵清出观察。',
      },
      {
        at: 205,
        text: '许岚：补给队已上路。东岸节点需要20秒，附近敌军会中断接管。',
      },
      {
        at: 345,
        text: '周榆：还剩75秒。两岸联络必须保持，留步兵完成最后接管。',
      },
    ],
    opening: [
      { side: 0, id: 'tank', x: 1060 },
      { side: 0, id: 'infantry', x: 1220 },
      { side: 0, id: 'engineers', x: 910 },
      { side: 0, id: 'scouts', x: 1380 },
      { side: 1, id: 'machinegun', x: 2220, guard: true },
      { side: 1, id: 'antiarmor', x: 2830, guard: true },
      { side: 1, id: 'infantry', x: 2990, guard: true },
      { side: 1, id: 'ifv', x: 3190 },
    ],
    waves: [
      {
        at: 90,
        cards: ['infantry', 'sniper_team'],
        message: '东岸守军向桥头增援，桥面观察受到压制。',
      },
      {
        at: 210,
        cards: ['antiarmor', 'mortar_carrier'],
        message: '迫炮车抵达东岸，接管人员需要掩护。',
      },
      {
        at: 325,
        cards: ['light_tank', 'assault'],
        message: '敌军企图在桥面恢复通行前夺回闸门。',
      },
    ],
    reinforcements: [
      {
        at: 180,
        cards: ['supply_team', 'marines'],
        x: 710,
        message: '友军补给队与陆战队抵达桥西，继续支援通道。',
      },
    ],
  },
  {
    id: 'railway-magazine',
    act: 3,
    actTitle: '通道争夺',
    aiDeck: 2,
    playerDeck: 2,
    title: '没有目的地的列车',
    chapter: '第十三章',
    region: '北部铁路货场 · 清晨',
    mapId: 'greyline',
    objective: 'assault',
    objectiveX: 3680,
    duration: 420,
    camera: 630,
    enemyBaseHp: 1200,
    briefing:
      '列车的目的地一栏是空的，弹药却一直卸给拒绝停火的部队。货场调度员愿意交出记录，武装守卫把他锁进了站房。切断货场指挥设施，才能阻止下一批炮弹沿着救援通道落下。',
    goal: '420秒内摧毁敌方指挥部，停止铁路货场的军用调度。',
    preparation:
      '己方坦克、步兵、反甲组、侦察与野战榴弹炮已集结。敌方重机枪、反甲炮和榴弹炮保护货场；指挥部更坚固，100、220、330秒有增援，160秒友军补充坦克与补给。',
    victory:
      '卸货机停了，调度员带着装运账册走出站房。最后一笔发送地址是山谷营地，那里正在接纳撤离居民。敌军已改用公路运送炮弹，雨夜将是他们最容易接近的时候。',
    defeat:
      '货场继续向封锁部队发货。远程火力需要观察与护卫，集中突破比不断补充孤立装甲更能打开防线。',
    openingDialogue: [
      {
        speaker: '联络官 · 许岚',
        text: '这些弹药没有民用去向，下一列车天亮后进站。关闭货场的调度链，车队才能少挨一轮炮击。',
      },
      {
        speaker: '通信员 · 贺川',
        text: '调度员把空白运单送出来了。他还在站房里，等我们把守卫的命令声停下来。',
      },
      {
        speaker: '工兵班长 · 林澈',
        text: '反甲炮守着站前，榴弹炮在后面。让观察员先找到它们，坦克跟步兵一起推进。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '敌指挥部有1200耐久，限时420秒。援军会补坦克和补给，但前线要自己接住。',
      },
    ],
    phaseHints: [
      {
        at: 55,
        text: '许岚：对面的炮兵有步兵保护。保住侦察组，让支援火力持续看见目标。',
      },
      {
        at: 175,
        text: '林澈：友军坦克已到站西。把护卫和补给送到同一条推进线上。',
      },
      {
        at: 340,
        text: '贺川：最后80秒。目标是指挥部，清掉站前火力后不要停在货场外。',
      },
    ],
    opening: [
      { side: 0, id: 'tank', x: 1080 },
      { side: 0, id: 'infantry', x: 950 },
      { side: 0, id: 'antiarmor', x: 780 },
      { side: 0, id: 'scouts', x: 1280 },
      { side: 0, id: 'artillery', x: 500 },
      { side: 1, id: 'heavy_mg', x: 2330, guard: true },
      { side: 1, id: 'anti_tank_gun', x: 2710 },
      { side: 1, id: 'infantry', x: 2910, guard: true },
      { side: 1, id: 'artillery', x: 3280 },
    ],
    waves: [
      {
        at: 100,
        cards: ['grenadiers', 'mortar_carrier'],
        message: '货场警卫投入迫炮车，装卸区仍在运转。',
      },
      {
        at: 220,
        cards: ['tank', 'javelin', 'infantry'],
        message: '铁路装甲护卫队接近前线。',
      },
      {
        at: 330,
        cards: ['helicopter', 'heavy_mg'],
        message: '守军呼叫最后一批空地增援，调度员仍困在站房。',
      },
    ],
    reinforcements: [
      {
        at: 160,
        cards: ['tank', 'supply_team'],
        x: 590,
        message: '友军坦克和补给组抵达货场西端。',
      },
    ],
  },
  {
    id: 'storm-refuge',
    act: 3,
    actTitle: '通道争夺',
    aiDeck: 3,
    playerDeck: 4,
    title: '雨夜的灯',
    chapter: '第十四章',
    region: '山谷临时营地 · 雨夜',
    mapId: 'jungle',
    night: true,
    objective: 'defend',
    objectiveX: 1530,
    duration: 360,
    camera: 810,
    startingEnergy: 3,
    briefing:
      '营地把仅有的发电机接到了救护帐篷上，山谷里只剩这一片亮光。雨声盖住了车轮，拒绝停火的部队正借黑夜接近。转移行动需要六分钟，灯不能熄，通向山口的路也不能断。',
    goal: '守住己方指挥部360秒，掩护临时营地全部撤离。',
    preparation:
      '陆战队、机枪、反甲与防空组守住林道，军医照看后方；开局有3指挥点。敌軍在35、130、245秒加入地面、装甲与空中力量；175秒友军支援防空和医疗。',
    victory:
      '周榆关掉最后一盏灯时，帐篷已经空了。山谷没有留下等待的伤员。撤离者带来消息：两座通道哨站愿意接纳他们，但守军之间的误会仍让道路一开一关。',
    defeat:
      '灯还亮着，后方联络却被切断。夜里优先建立观察与防空，把守军和伤员一起留在能互相支援的位置。',
    openingDialogue: [
      {
        speaker: '军医 · 周榆',
        text: '雨太大，不能让担架停在外面。每辆车都得装满，六分钟后我再关灯。',
      },
      {
        speaker: '通信员 · 贺川',
        text: '林道那边的哨站在撤，他们愿意把防空组送来。别把夜里的友军当成目标。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '开局多给一个指挥点，先稳住观察与反制。敌军会从地面和空中同时试探。',
      },
      {
        speaker: '工兵班长 · 林澈',
        text: '山谷路口已经标出。守住360秒，别追进看不见的树林。',
      },
    ],
    phaseHints: [
      {
        at: 75,
        text: '许岚：敌方装甲将在下一轮加入。让反甲组保持观察，留出补充防空的费用。',
      },
      {
        at: 195,
        text: '贺川：友军已接上防线。空中威胁还没结束，别让防空组离开步兵掩护。',
      },
      {
        at: 310,
        text: '周榆：还有50秒，最后几副担架正在上车。守住基地，等我关灯。',
      },
    ],
    opening: [
      { side: 0, id: 'marines', x: 1470, guard: true },
      { side: 0, id: 'machinegun', x: 1270, guard: true },
      { side: 0, id: 'antiarmor', x: 1100, guard: true },
      { side: 0, id: 'manpads', x: 900, guard: true },
      { side: 0, id: 'medic_team', x: 680, guard: true },
      { side: 1, id: 'scouts', x: 2440 },
    ],
    waves: [
      {
        at: 35,
        cards: ['commandos', 'assault', 'pickup'],
        message: '林道暗处出现突击队，营地防线接敌。',
      },
      {
        at: 130,
        cards: ['ifv', 'light_tank', 'infantry'],
        message: '敌军装甲借雨夜进入山谷。',
      },
      {
        at: 245,
        cards: ['rocket_heli', 'attack_drone', 'antiarmor'],
        message: '空中部队发现营地灯光，最后一轮攻势开始。',
      },
    ],
    reinforcements: [
      {
        at: 175,
        cards: ['manpads', 'medic', 'infantry'],
        x: 610,
        message: '邻近停火哨站派来防空、军医与步兵，支援营地撤离。',
      },
    ],
  },
  {
    id: 'two-sided-road',
    act: 3,
    actTitle: '通道争夺',
    aiDeck: 4,
    playerDeck: 3,
    title: '路的两端',
    chapter: '第十五章',
    region: '边界山路 · 雨后',
    mapId: 'mountains',
    objective: 'capture',
    objectiveX: 2200,
    duration: 420,
    camera: 650,
    capturePoints: [
      { x: 2200, label: '西侧接纳哨', seconds: 15 },
      { x: 3010, label: '东侧会合哨', seconds: 20 },
    ],
    briefing:
      '两处哨站都同意接纳撤离者，却仍把对方的接近当作进攻。贺川提出让同一支联络队走过两站，当面核对呼号。拒绝停火的残部混在山路上，想让这次会面以枪声结束。',
    goal: '420秒内依次控制西侧哨站15秒、东侧哨站20秒，建立连续通行区。',
    preparation:
      '山地步兵、工兵、侦察与步战车组成联络队。敌方机枪、反甲与山地步兵拦住两站；100、230、330秒有增援，200秒友军接入护送队。',
    victory:
      '两座哨站用同一个口令放行了车队。许岚把两份确认并排贴在电台上。对面驻军代表请求在旧山口会谈，愿意把最后一处封锁的坐标交出来。',
    defeat:
      '联络队没能走完山路，两个哨站仍各自等待。依次完成占领，为正在接管的步兵留下护卫，别只把火力送到远端。',
    openingDialogue: [
      {
        speaker: '通信员 · 贺川',
        text: '他们都说愿意放行，只是都怕先开门。让我走过去，两个哨长都认识我的声音。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '先西站，再东站。每完成一次接管，我们就把核对过的呼号公开给沿线。',
      },
      {
        speaker: '工兵班长 · 林澈',
        text: '山路上还有伏击队。清掉节点周围的武装，我会给车队检查路障。',
      },
      {
        speaker: '军医 · 周榆',
        text: '他们在雨里等了一夜。420秒，给这条路的两端同一个回答。',
      },
    ],
    phaseHints: [
      {
        at: 60,
        text: '贺川：先接管西侧哨站15秒。清掉附近敌军，确认后再向东站推进。',
      },
      {
        at: 230,
        text: '许岚：护送队已接入。东侧会合哨要驻留20秒，车辆不能替代步兵。',
      },
      {
        at: 350,
        text: '林澈：最后70秒。会合哨附近的反甲与步兵守卫要一起清理。',
      },
    ],
    opening: [
      { side: 0, id: 'mountain', x: 1080 },
      { side: 0, id: 'scouts', x: 1250 },
      { side: 0, id: 'engineers', x: 880 },
      { side: 0, id: 'ifv', x: 700 },
      { side: 1, id: 'machinegun', x: 2250, guard: true },
      { side: 1, id: 'antiarmor', x: 2800, guard: true },
      { side: 1, id: 'mountain', x: 3040, guard: true },
      { side: 1, id: 'sniper', x: 3240, guard: true },
    ],
    waves: [
      {
        at: 100,
        cards: ['ambush_squad', 'antiarmor'],
        message: '山路伏击队试图隔开联络队和后续车辆。',
      },
      {
        at: 230,
        cards: ['tow_ifv', 'infantry'],
        message: '敌方机动部队向东侧哨站靠拢。',
      },
      {
        at: 330,
        cards: ['helicopter', 'mountain'],
        message: '最后一支山地增援抵达会合哨后方。',
      },
    ],
    reinforcements: [
      {
        at: 200,
        cards: ['mountain', 'supply_team'],
        x: 760,
        message: '西侧驻军派出护送与补给队，协助接通东侧会合哨。',
      },
    ],
  },
  {
    id: 'ridge-parley',
    act: 4,
    actTitle: '停火之声',
    aiDeck: 6,
    playerDeck: 1,
    title: '山口会面',
    chapter: '第十六章',
    region: '旧山口联络站 · 深夜',
    mapId: 'mountains',
    night: true,
    objective: 'capture',
    objectiveX: 2670,
    duration: 360,
    camera: 660,
    briefing:
      '对面驻军代表愿意当面确认停火，双方选了废弃的山口联络站。代表的护送队却在途中遭到伏击，仍在站内等待。许岚决定亲自进入联络线，带回能让最后几处驻军放下枪的正式签名。',
    goal: '360秒内让可作战步兵控制联络站20秒，完成停火签名核验。',
    capturePoints: [{ x: 2670, label: '山口联络站', seconds: 20 }],
    preparation:
      '山地步兵、侦察、军医与步战车夜间展开；伏击队、机枪和反甲守卫围住联络站。敌军在80、190秒增援；150秒代表的护卫以友军身份赶来。',
    victory:
      '代表把姓名写在签收本的空白页上，许岚在旁边写下时间。最后封锁者的指挥所坐标终于明确。两边决定先保护临时救护点，再共同切断仍在发令的武装。',
    defeat:
      '山口会面在核验前被打断。夜间推进要让侦察和照明接住火力，联络站还需要步兵连续驻留20秒。',
    openingDialogue: [
      {
        speaker: '通信员 · 贺川',
        text: '代表还在站里。他说只要带着原本进门，就会当着大家的面签字。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '我带原本。我们已经听过太多隔着杂音的命令，这次每个人都要看见对方。',
      },
      {
        speaker: '军医 · 周榆',
        text: '护送队有人受伤。我跟在后面，进去时留一条能送担架出来的路。',
      },
      {
        speaker: '工兵班长 · 林澈',
        text: '360秒，接管联络站20秒。先清近处伏击，再守住签名核验区。',
      },
    ],
    phaseHints: [
      { at: 45, text: '许岚：联络站外有反甲组。先发现目标，再让步战车接近。' },
      {
        at: 165,
        text: '贺川：代表的护卫已到。把他们接进前线，别让援军单独撞上阵地。',
      },
      {
        at: 285,
        text: '林澈：还剩75秒，核验需20秒。清理争夺区后保持步兵驻留。',
      },
    ],
    opening: [
      { side: 0, id: 'mountain', x: 1110 },
      { side: 0, id: 'scouts', x: 1270 },
      { side: 0, id: 'medic', x: 880 },
      { side: 0, id: 'ifv', x: 710 },
      { side: 1, id: 'ambush_squad', x: 2440, guard: true },
      { side: 1, id: 'machinegun', x: 2730, guard: true },
      { side: 1, id: 'antiarmor', x: 2990, guard: true },
    ],
    waves: [
      {
        at: 80,
        cards: ['scouts', 'commandos'],
        message: '伏击部队发现山口接近队，开始收紧包围。',
      },
      {
        at: 190,
        cards: ['ifv', 'heavy_mg', 'infantry'],
        message: '拒绝停火的增援正在堵住联络站出口。',
      },
    ],
    reinforcements: [
      {
        at: 150,
        cards: ['armed_police', 'mountain'],
        x: 750,
        message: '停火代表护卫队加入友军，协助打通会面路线。',
      },
    ],
  },
  {
    id: 'shared-aid-station',
    act: 4,
    actTitle: '停火之声',
    aiDeck: 2,
    playerDeck: 4,
    title: '同一张担架',
    chapter: '第十七章',
    region: '河谷联合救护点 · 上午',
    mapId: 'greyline',
    objective: 'defend',
    objectiveX: 1540,
    duration: 360,
    camera: 830,
    playerBaseHp: 1100,
    briefing:
      '双方医护把救护点合在一处，床位终于够了，守卫却还不习惯肩并肩站岗。封锁部队准备在联合行动前摧毁这里，逼两边重新怀疑彼此。周榆请求六分钟，把所有不能步行的伤员先送走。',
    goal: '守住己方指挥部360秒，保障联合救护点完成转运。',
    preparation:
      '救护点有1100耐久，步兵、重机枪、反甲与防空组守卫，军医班位于后方。敌军在30、125、245秒增援；190秒双方集结的坦克与补给组抵达。',
    victory:
      '最后一副担架上，一名士兵握住另一名士兵的袖口，问的只是车往哪开。联合救护点没有倒下。两边的部队已在出发线上，准备一同关闭最终指挥所。',
    defeat:
      '救护点未能支撑到转运结束。把炮兵观察与反甲火力接起来，守住防空和医疗的后方位置，再补充前线。',
    openingDialogue: [
      {
        speaker: '军医 · 周榆',
        text: '现在病床按伤势分，不按哪边的人分。再给我六分钟，重伤员就能全部转走。',
      },
      {
        speaker: '通信员 · 贺川',
        text: '两边守卫都接到了同一个口令。援军也一起出发了，这次谁都不用独自撑着。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '敌方有远程火力，反甲和防空不能被压在后面。守住1100耐久的指挥部360秒。',
      },
      {
        speaker: '工兵班长 · 林澈',
        text: '前线先守，190秒会有坦克和补给。别在转运结束前向敌阵追击。',
      },
    ],
    phaseHints: [
      {
        at: 80,
        text: '许岚：敌方迫炮已加入。观察员发现目标后，再让反制火力出手。',
      },
      { at: 205, text: '贺川：联合坦克队到了，守军轮换仍需要步兵掩护。' },
      {
        at: 310,
        text: '周榆：还有50秒，最后一批重伤员正在转运。守住后方，别散开。',
      },
    ],
    opening: [
      { side: 0, id: 'infantry', x: 1500, guard: true },
      { side: 0, id: 'heavy_mg', x: 1310, guard: true },
      { side: 0, id: 'antiarmor', x: 1140, guard: true },
      { side: 0, id: 'manpads', x: 940, guard: true },
      { side: 0, id: 'medic_team', x: 730, guard: true },
      { side: 1, id: 'infantry', x: 2450 },
    ],
    waves: [
      {
        at: 30,
        cards: ['grenadiers', 'mortar_carrier', 'pickup'],
        message: '封锁部队向联合救护点展开炮火试探。',
      },
      {
        at: 125,
        cards: ['tank', 'javelin', 'infantry'],
        message: '敌军装甲纵队试图突破救护点外围。',
      },
      {
        at: 245,
        cards: ['helicopter', 'strike_jet', 'assault'],
        message: '最后一轮空地打击到达，转运行动仍在继续。',
      },
    ],
    reinforcements: [
      {
        at: 190,
        cards: ['tank', 'supply_team', 'infantry'],
        x: 620,
        message: '联合预备队抵达救护点，坦克、补给与步兵协同支援。',
      },
    ],
  },
  {
    id: 'last-command-post',
    act: 4,
    actTitle: '停火之声',
    aiDeck: 0,
    playerDeck: 0,
    title: '最后一道命令',
    chapter: '第十八章',
    region: '北部指挥岭 · 午后',
    mapId: 'mountains',
    objective: 'assault',
    objectiveX: 3680,
    duration: 480,
    camera: 620,
    startingEnergy: 4,
    enemyBaseHp: 1400,
    briefing:
      '霍峥的最后一处指挥所仍在命令沿线部队开火；即使停火原本公开，他也拒绝交出铁路和公路补给。联合部队从山脚出发，许岚重复广播撤离通路，让愿意放下武器的人先离开。必须摧毁它的军事指挥设施，结束仍在运转的封锁链。',
    goal: '480秒内摧毁1400耐久的敌方指挥部，并保住己方指挥部。',
    preparation:
      '联合部队有坦克、山地步兵、侦察、反甲与榴弹炮，开局4指挥点。敌方重机枪、反甲炮、步战车和火炮守岭；100、230、360秒有增援，190与320秒友军接力支援。',
    victory:
      '最后一台军事发送机被切断，仍愿意战斗的部队失去了共同的命令。山脚传来投降呼叫，贺川逐个确认安全通道。停火已经签了两次，现在还要让每一处失联哨站真正听见。',
    defeat:
      '指挥岭仍在发令。重装防线需要观察、反甲、步兵护卫与补给同时到位，不要让援军在山路上各自作战。',
    openingDialogue: [
      {
        speaker: '联络官 · 许岚',
        text: '双方签名都在这里。对面仍有人请求离开，我会持续广播安全通路，让他们先走。',
      },
      {
        speaker: '通信员 · 贺川',
        text: '我的驻军和你们并肩上山。他们来关掉命令，不是来找一个新的敌人。',
      },
      {
        speaker: '工兵班长 · 林澈',
        text: '反甲炮和重机枪挡着指挥岭。观察先到，火炮接上，步兵护住坦克。',
      },
      {
        speaker: '联络官 · 许岚',
        text: '480秒，敌指挥部1400耐久。援军有两批，开局4指挥点；把联合攻势送到同一条线上。',
      },
    ],
    phaseHints: [
      {
        at: 65,
        text: '林澈：山口反甲火力还在。压制守卫后，让装甲与步兵一起接近。',
      },
      {
        at: 210,
        text: '贺川：第一批联合援军已到。补给组要跟上已经接敌的部队。',
      },
      {
        at: 380,
        text: '许岚：最后100秒。持续广播投降通道，主攻目标仍是指挥部。',
      },
    ],
    opening: [
      { side: 0, id: 'tank', x: 1080 },
      { side: 0, id: 'mountain', x: 940 },
      { side: 0, id: 'infantry', x: 740 },
      { side: 0, id: 'antiarmor', x: 860 },
      { side: 0, id: 'scouts', x: 1290 },
      { side: 0, id: 'artillery', x: 490 },
      { side: 1, id: 'heavy_mg', x: 2290, guard: true },
      { side: 1, id: 'anti_tank_gun', x: 2660 },
      { side: 1, id: 'manpads', x: 2910, guard: true },
      { side: 1, id: 'ifv', x: 3100 },
      { side: 1, id: 'artillery', x: 3340 },
    ],
    waves: [
      {
        at: 100,
        cards: ['tank', 'infantry', 'antiarmor'],
        message: '指挥岭装甲护卫队投入防线。',
      },
      {
        at: 230,
        cards: ['heavy_tank', 'heavy_mg', 'javelin'],
        message: '敌方重装预备队赶到，观察与反甲需要继续跟进。',
      },
      {
        at: 360,
        cards: ['rocket_heli', 'mortar_carrier', 'assault'],
        message: '最终指挥所发出最后一轮增援令。',
      },
    ],
    reinforcements: [
      {
        at: 190,
        cards: ['tank', 'supply_team', 'mountain'],
        x: 610,
        message: '第一批联合援军进入山路，接续主攻。',
      },
      {
        at: 320,
        cards: ['antiarmor', 'manpads', 'infantry'],
        x: 720,
        message: '第二批联合援军抵达，补充反甲、防空与前线护卫。',
      },
    ],
  },
  {
    id: 'broadcast-before-dawn',
    act: 4,
    actTitle: '停火之声',
    aiDeck: 3,
    playerDeck: 6,
    title: '黎明前的广播',
    chapter: '第十九章',
    region: '边界公共电台 · 黎明前',
    mapId: 'desert',
    night: true,
    objective: 'defend',
    objectiveX: 1560,
    duration: 420,
    camera: 830,
    startingEnergy: 3,
    playerBaseHp: 1200,
    briefing:
      '指挥所关闭了，偏远哨站却仍不知道战争已经结束。公共电台要用七分钟循环播报所有签名、呼号与通行路线。失去指挥的残部试图毁掉发送机，直到最后一处失联哨站回话，许岚都不能离开。',
    goal: '守住1200耐久的己方指挥部420秒，完成全线停火广播。',
    preparation:
      '步兵、机枪、反甲、防空与侦察守卫电台，军医位于后方；开局3指挥点。敌军在25、140、275、350秒增援，180和300秒友军分别补充守军与防空补给。',
    victory:
      '最后一个陌生呼号终于回答：他们已停止射击，等待接线人员。许岚嗓子哑了，仍把确认抄在本上。黎明时，只剩边界两端与中央会合站要完成最终握手。',
    defeat:
      '发送机在最后确认前失守。七分钟防守需要轮换、补给与持续观察，把防空放在能受到步兵保护的区域。',
    openingDialogue: [
      {
        speaker: '联络官 · 许岚',
        text: '这份确认要一遍一遍念，直到每一个呼号都回答。七分钟，别让发送机停下。',
      },
      {
        speaker: '通信员 · 贺川',
        text: '山里的哨站没有新密钥，他们只能听公共频率。我们把每条撤离路线都念清楚。',
      },
      {
        speaker: '军医 · 周榆',
        text: '你先喝水，我在后面。伤员也在听这段广播，守军要轮换，别把所有人耗在最前面。',
      },
      {
        speaker: '工兵班长 · 林澈',
        text: '电台有1200耐久，守住420秒。空中和地面都会来，援军将分两次接替。',
      },
    ],
    phaseHints: [
      {
        at: 85,
        text: '许岚：南线已经回话，北线仍在监听。反甲与防空都要留人接替。',
      },
      {
        at: 220,
        text: '贺川：山地哨站收到广播了，还有几处盲区。守军需要补给，继续保持观察。',
      },
      {
        at: 365,
        text: '许岚：最后55秒，正在核对最后一个呼号。守住基地，不要离开电台追击。',
      },
    ],
    opening: [
      { side: 0, id: 'infantry', x: 1530, guard: true },
      { side: 0, id: 'machinegun', x: 1320, guard: true },
      { side: 0, id: 'antiarmor', x: 1150, guard: true },
      { side: 0, id: 'manpads', x: 970, guard: true },
      { side: 0, id: 'scouts', x: 1440, guard: true },
      { side: 0, id: 'medic', x: 720, guard: true },
      { side: 1, id: 'scout_car', x: 2490 },
    ],
    waves: [
      {
        at: 25,
        cards: ['assault', 'pickup', 'mortar_carrier'],
        message: '残部发现公共电台，地面攻击开始。',
      },
      {
        at: 140,
        cards: ['tank', 'infantry', 'attack_drone'],
        message: '敌方装甲与无人机试图压制广播阵地。',
      },
      {
        at: 275,
        cards: ['rocket_heli', 'strike_jet', 'antiarmor'],
        message: '空中袭击进入发送区，防空组准备接替。',
      },
      {
        at: 350,
        cards: ['ifv', 'heavy_mg', 'assault'],
        message: '最后一支残部冲向电台，停火确认仍在播报。',
      },
    ],
    reinforcements: [
      {
        at: 180,
        cards: ['infantry', 'antiarmor', 'medic'],
        x: 650,
        message: '联合驻军送来轮换守军与军医，支援电台。',
      },
      {
        at: 300,
        cards: ['manpads', 'supply_team', 'machinegun'],
        x: 710,
        message: '友军最后一批防空与补给抵达，广播进入收尾。',
      },
    ],
  },
  {
    id: 'land-reconnected',
    act: 4,
    actTitle: '停火之声',
    aiDeck: 4,
    playerDeck: 3,
    title: '断线之后',
    chapter: '第二十章 · 终章',
    region: '全线会合区 · 黎明',
    mapId: 'greyline',
    objective: 'capture',
    objectiveX: 1850,
    duration: 480,
    camera: 710,
    startingEnergy: 4,
    capturePoints: [
      { x: 1850, label: '西线确认站', seconds: 15 },
      { x: 2600, label: '东线确认站', seconds: 20 },
      { x: 3260, label: '中央会合站', seconds: 25 },
    ],
    briefing:
      '所有哨站都听见了停火，最后的确认必须由联络队当面完成。西线、东线、中央会合站依次核对签名和通行名册，联合车队随后通过。仍有残部不肯放下武器，这是通往真正停火的最后一段路。',
    goal: '480秒内依次控制西线15秒、东线20秒、中央会合站25秒，完成全线握手。',
    preparation:
      '联合部队有坦克、陆战队、步兵、侦察与工兵，配发空地快援编队，开局4指挥点。分兵护住己方指挥部。残部在三个节点布防，100、230、360秒增援；150、290秒友军带来护卫、补给与防空。',
    victory:
      '中央会合站报出了最后一个确认码。盐路的救护车、河岸的货车、雨林里走出来的人，在同一条路上向前驶去。贺川把电台交给下一班，林澈收起工具，周榆终于坐下。许岚合上写满呼号的本子：全线停火生效，撤离通道永久开放。《断线之地》完。',
    defeat:
      '最后一段握手未能完成。按顺序重建沿线确认，集中观察、反制与护卫，给中央会合站的步兵留出25秒。',
    openingDialogue: [
      {
        speaker: '联络官 · 许岚',
        text: '每一处哨站都回答了。现在把人带过去，签名、名册、通行码，逐个当面确认。',
      },
      {
        speaker: '通信员 · 贺川',
        text: '先西线，再东线，最后中央站。我带着两边的名单，谁都不会被落在路外。',
      },
      {
        speaker: '工兵班长 · 林澈',
        text: '三处接管分别15、20、25秒，按标记推进。车掩护人，人接通路，补给跟在后面。',
      },
      {
        speaker: '军医 · 周榆',
        text: '这次终点不用再搬担架。480秒，让最后一辆车能直接驶过去。',
      },
    ],
    phaseHints: [
      {
        at: 60,
        text: '许岚：按标记依次确认。伞降与机降可向前接应，但落地部队仍需要观察、补给和护卫。',
      },
      {
        at: 220,
        text: '贺川：两边的呼号都在同一张名册上。接管东线时，留下能持续驻留的步兵。',
      },
      {
        at: 355,
        text: '林澈：最后一批援军已到。中央站需要25秒，把补给和反制送到前线。',
      },
      {
        at: 430,
        text: '许岚：还剩50秒。中央站是最后一次确认，清出争夺区，让联络队把话说完。',
      },
    ],
    opening: [
      { side: 0, id: 'tank', x: 1000 },
      { side: 0, id: 'marines', x: 1170 },
      { side: 0, id: 'infantry', x: 810 },
      { side: 0, id: 'scouts', x: 1340 },
      { side: 0, id: 'engineers', x: 680 },
      { side: 1, id: 'infantry', x: 1910, guard: true },
      { side: 1, id: 'machinegun', x: 2480, guard: true },
      { side: 1, id: 'antiarmor', x: 2730, guard: true },
      { side: 1, id: 'heavy_mg', x: 3220, guard: true },
      { side: 1, id: 'manpads', x: 3380, guard: true },
    ],
    waves: [
      {
        at: 100,
        cards: ['assault', 'scout_car', 'antiarmor'],
        message: '残部向西线确认站发动反扑，护送队继续推进。',
      },
      {
        at: 230,
        cards: ['tank', 'javelin', 'infantry'],
        message: '敌方装甲试图在东线切断联合车队。',
      },
      {
        at: 360,
        cards: ['helicopter', 'ifv', 'heavy_mg'],
        message: '最后一轮封锁力量抵达中央站，全线确认近在眼前。',
      },
    ],
    reinforcements: [
      {
        at: 150,
        cards: ['mountain', 'supply_team'],
        x: 800,
        message: '西线驻军加入护送，补给组支援接管队。',
      },
      {
        at: 290,
        cards: ['marines', 'antiarmor', 'manpads'],
        x: 900,
        message: '东线联合护卫加入，陪联络队走完最后一段路。',
      },
    ],
  },
];
