import type {Card,CardId} from './cards';
export const FORT_IDS_V227=['fort_radar','fort_watchtower','fort_at_bunker','fort_mortar_pit','fort_supply_depot','fort_medical_post','fort_command_post','fort_flak_tower','fort_trench','fort_repair_post'] as const;
export const GUN_IDS_V227=['mortar_60','mortar_81','mortar_120','howitzer_105','howitzer_120','howitzer_122','howitzer_152','howitzer_155','howitzer_203','field_gun_85','sp_howitzer_122','sp_howitzer_155'] as const;
export const EXPANSION_IDS_V227=[...FORT_IDS_V227,...GUN_IDS_V227];
const fort=(id:CardId,name:string,cost:number,hp:number,buildTime:number,crew:number,detail:string,extra:Partial<Card>={}):Card=>({id,name,en:'FIELD INSTALLATION',cost,hp,buildTime,garrisonCapacity:crew,type:'fortification',tag:'工事 · 固定班组',description:detail,detail:`可见地面建设${buildTime}秒，建成自带${crew}名固定人员，不招走附近小队。${detail}`,atlas:6,static:true,targetGround:true,fortification:'bunker',damage:0,range:0,rate:1,speed:0,sight:330,...extra});
const gun=(id:CardId,name:string,cost:number,hp:number,damage:number,rate:number,range:number,minRange:number,radius:number,ammo:number,extra:Partial<Card>={}):Card=>({id,name,en:name.includes('迫击')?'MORTAR BATTERY':'TOWED ARTILLERY',cost,hp,damage,rate,range,minRange,radius,ammoCapacity:ammo,type:'unit',model:name.includes('迫击')?'mortar':'artillery',tag:'炮兵 · 口径分级',description:`${name}，${rate}秒装填，${range}射程。`,detail:`${cost}费，${hp}生命，独立炮车与两名分肢炮手。射程${minRange}–${range}，每${rate}秒${damage}伤害、爆炸半径${radius}，携行${ammo}发。依赖前线观察，留在战线后方；可命令前进、后退和自动跟随。`,atlas:6,emplacement:'howitzer',static:true,indirect:true,speed:0,targetGround:false,sight:300,...extra});
export const EXPANSION_CARDS_V227={
 sp_howitzer_122:gun('sp_howitzer_122','122毫米自行榴弹炮',6,340,64,9.5,1400,280,40,20,{vehicle:true,armored:true,armorTier:1,selfPropelled:true,static:false,emplacement:undefined,speed:28,en:'SELF-PROPELLED HOWITZER',description:'履带底盘轻型自行榴弹炮，随战线机动。',detail:'装甲履带底盘，122毫米炮，20发弹药。留在前线后方曲射支援，补弹补油后自动跟随。',tag:'炮兵 · 履带自行'}),
 sp_howitzer_155:gun('sp_howitzer_155','155毫米自行榴弹炮',7,400,94,12.5,1700,340,52,16,{vehicle:true,armored:true,armorTier:1,selfPropelled:true,static:false,emplacement:undefined,speed:25,en:'HEAVY SELF-PROPELLED HOWITZER',description:'重型装甲自行榴弹炮，远程压制集群和工事。',detail:'装甲履带底盘，155毫米炮，16发弹药。1700射程、52爆炸半径；保持后方距离，需要弹药与燃油补给。',tag:'炮兵 · 重型自行'}),
 fort_radar:fort('fort_radar','远程预警雷达',4,220,9,2,'2600范围空情预警，仅有160地面视野，不代替地面侦察。',{sight:160,airRadarRange:2600}),
 fort_watchtower:fort('fort_watchtower','前沿哨塔',3,180,6,2,'1050观察距离，为后方炮兵报告地面接触。',{sight:1050,observer:true}),
 fort_at_bunker:fort('fort_at_bunker','反坦克炮堡',5,460,10,2,'700射程穿甲炮，专门阻击装甲。',{damage:100,range:700,rate:5.8,armorOnly:true,canAttackBase:true,penetrationTier:3,armorMultiplier:2,model:'rocket'}),
 fort_mortar_pit:fort('fort_mortar_pit','81毫米迫击炮阵地',4,280,8,2,'曲射越障，射程140–900，30伤害，6.5秒装填。',{damage:30,range:900,minRange:140,rate:6.5,radius:25,indirect:true,model:'mortar',ammoCapacity:24}),
 fort_supply_depot:fort('fort_supply_depot','前沿弹药库',4,260,9,2,'携行3000物资，补弹补油，库存耗尽停止供应。',{supplyCapacity:3000}),
 fort_medical_post:fort('fort_medical_post','野战救护站',4,240,8,2,'固定医疗人员救治140内伤兵，不离开阵地追逐病员。',{heal:10,healRange:140}),
 fort_command_post:fort('fort_command_post','战术通讯站',4,260,8,2,'鼓舞220内友军并减轻压制，保持小队协同。',{vehicleSupport:'command'}),
 fort_flak_tower:fort('fort_flak_tower','双联37毫米高射炮台',5,380,10,2,'1200防空射程，双联速射炮封锁低空。',{damage:36,range:1200,rate:.6,antiAir:true,airOnly:true,fortification:'aa',model:'machinegun'}),
 fort_trench:fort('fort_trench','步兵射击壕',3,260,6,4,'四名固定步兵坚守壕沟，掩护前线；不抽离推进小队。'),
 fort_repair_post:fort('fort_repair_post','履带维修站',4,300,9,2,'维修180内装甲和受损履带，给附近车辆提供固定维修点。',{vehicleSupport:'repair'}),
 mortar_60:gun('mortar_60','60毫米轻迫击炮',2,85,24,6,620,100,21,28,{emplacement:'mortar'}),
 mortar_81:gun('mortar_81','81毫米迫击炮',3,105,34,6.8,850,130,27,24,{emplacement:'mortar'}),
 mortar_120:gun('mortar_120','120毫米重迫击炮',4,150,55,9,1080,210,37,20,{emplacement:'mortar'}),
 howitzer_105:gun('howitzer_105','105毫米轻榴弹炮',3,140,46,7.5,1080,170,31,24),
 howitzer_120:gun('howitzer_120','120毫米榴弹炮',4,170,57,8.5,1200,210,36,22),
 howitzer_122:gun('howitzer_122','122毫米三脚榴弹炮',4,185,62,9,1320,220,39,22),
 howitzer_152:gun('howitzer_152','152毫米重榴弹炮',5,225,84,11.5,1510,300,47,18),
 howitzer_155:gun('howitzer_155','155毫米远程榴弹炮',6,235,91,12,1680,320,50,18),
 howitzer_203:gun('howitzer_203','203毫米攻坚榴弹炮',8,320,145,19,1900,450,65,12,{baseMultiplier:1.5}),
 field_gun_85:gun('field_gun_85','85毫米反坦克野战炮',4,155,88,5.2,900,0,9,26,{emplacement:'at_gun',indirect:false,armorOnly:true,canAttackBase:true,penetrationTier:3,armorMultiplier:2.2}),
} satisfies Record<typeof EXPANSION_IDS_V227[number],Card>;
export const FORT_SIZES_V227:Record<string,readonly[number,number]>={fort_radar:[128,110],fort_watchtower:[94,160],fort_at_bunker:[132,64],fort_mortar_pit:[128,68],fort_supply_depot:[142,72],fort_medical_post:[142,92],fort_command_post:[132,75],fort_flak_tower:[130,104],fort_trench:[155,54],fort_repair_post:[155,112]};
export const GUN_SIZES_V227:Record<string,readonly[number,number]>={mortar_60:[64,49],mortar_81:[82,62],mortar_120:[112,80],howitzer_105:[155,80],howitzer_120:[180,90],howitzer_122:[186,90],howitzer_152:[218,105],howitzer_155:[234,108],howitzer_203:[270,125],field_gun_85:[200,90],sp_howitzer_122:[190,84],sp_howitzer_155:[225,104]};
