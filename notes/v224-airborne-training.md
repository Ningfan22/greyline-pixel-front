# v224：空降投送与兵员训练

防空导弹车自动保持在己方战线后约 320 距离，受到可见地面威胁时进一步退后。明确的本地停驻、前进和补给指令继续生效；雷达范围及防空弹威力保留。

步兵接敌后，换位和后撤采用独立跑步动作，普通入场仍步行。明确卧倒、蹲伏及高压制保留；移动停止后才瞄准射击。

普通、训练有素、精锐的基础瞄准概率为 33%、58%、82%，实际命中仍受姿态、距离、压制、遮挡影响。狙击手清晰射界基础命中为 98%。精锐的卧倒、起身和换弹动作耗时为普通的 62%，训练部队为 80%；双方规则一致，血量不变。

机降突击队保留 4 费、直升机 300 生命、5 人总共 220 生命，机速提升到 340，索降间隔缩短到 0.58 秒，兵员改为精锐。狙击手观察距离 1450，双人狙击组观察手展开后 1650；烟雾、房屋、盲视继续限制观察。

全部常规伞降卡改由基地起飞的固定翼运输机投送。巡航速度 940，投送区域内持续飞行速度 420，连续逐人跳伞；开伞前有短暂离机下落。飞机被击落会损失未离机的载员。运输机不提供地面观察，不能作为独立牌抽取。滑翔机扩大邻近落点搜索，允许缓坡，避开完整房屋、树干、陡坎和深坑；废墟和残骸不阻挡航线及落地。

## 独立素材

使用内置 imagegen 生成，未使用程序化车辆绘制、步战车素材或合成人员。现有分肢士兵独立离机、索降、展开。素材离线编入战场图集，战场进入时不下载原始大图。

- `public/art/v224-airborne/parachute-transport.png`
- `public/art/v224-airborne/parachute-transport-wreck.png`

运输机提示词：

Use case: stylized-concept. Asset type: transparent side-view pixel-art game sprite. Primary request: one realistic military twin-engine turboprop tactical transport airplane for delivering paratroopers in a gritty 2D side-scrolling modern battlefield. Strict pure SIDE elevation facing RIGHT, horizontal flight, landing gear retracted, long olive drab cargo fuselage with rear cargo door, high wing, TWO turboprop engines with small spinning propeller disks, tall vertical tail, cockpit windows. Silhouette instantly reads as a fast fixed-wing transport plane, not a helicopter or bomber. Medium-density crisp pixel clusters at native about 320x110 pixels, dark outlines, muted worn olive and charcoal, subdued small highlights; match detailed military pixel game sprites, no cartoon proportions, no smooth illustration gradients. Centered airplane, all nose, tail, wings and propellers fully inside canvas with generous transparent margin. No people, no parachutes, no weapons, no markings, no text, no shadows or ground or background. Output a single airplane only on genuinely transparent background.

残骸提示词（以上运输机为编辑目标）：

Use case: precise-object-edit. Asset type: transparent pixel-art game wreck sprite. Edit target: attached tactical transport plane. Change the aircraft into a destroyed crashed transport fuselage lying on flat ground, exact same muted olive military style and right-facing side view. Broken high wing and bent tail, collapsed fuselage, blackened engine housings, missing propellers, crumpled belly; unmistakably this fixed-wing transport, not a helicopter or armoured vehicle. Whole wreck visible with generous transparent margin. Crisp medium-grain pixel clusters at about 320x110 game pixels, subdued worn materials, no cartoon. No soldiers, no flames, no smoke, no scenery or ground, no text, genuinely transparent background. Output one wreck only.
