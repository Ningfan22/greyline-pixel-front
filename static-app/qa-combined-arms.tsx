import '../app/globals.css';
import {createRoot} from 'react-dom/client';
import {CardFace} from '../game/card-art';
import {loadBattleArt} from '../game/art';
import {createGame,startGame,spawnUnit,playCard,tick,refreshVision,visibleToSide,cardCost,toggleRadar,CARDS,type GameState,type CardId} from '../game/engine';
import {render} from '../game/render';
createRoot(document.querySelector('#cards')!).render(<><div><CardFace id="anti_radiation_shell" eager/></div><div><CardFace id="stealth_bomber" eager/></div></>);
const canvas=document.querySelector<HTMLCanvasElement>('#view')!,ctx=canvas.getContext('2d')!,stats=document.querySelector('#stats')!;
const art=await loadBattleArt('greyline');let s:GameState,mode='occupied',message='';
function actor(side:0|1,id:CardId,x:number){const n=s.units.length;spawnUnit(s,side,id,x);const u=s.units[n];s.units.splice(n+1);Object.assign(u,{cooldown:1e9,secondaryCooldown:1e9,fragCooldown:1e9,readyAt:-10,logisticsOrder:'hold'});return u;}
function use(side:0|1,id:CardId,x?:number){const token={id,uid:++s.uid};s.players[side].hand.push(token);const result=playCard(s,side,token.uid,x);message=result.message;return token;}
function reset(){s=createGame(233,undefined,undefined,undefined,{weather:false});startGame(s);Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;for(const p of s.players)Object.assign(p,{energy:20,order:'hold',hand:[],deck:[],discard:[]});
 if(mode==='occupied'||mode==='clear'){if(mode==='occupied')actor(1,'infantry',1500);use(0,'air_assault',1500);}
 else if(mode==='radar'){actor(0,'scouts',1150);actor(1,'sam_vehicle',1550);}
 else if(mode==='stealth'){actor(0,'scouts',1350);actor(1,'tank',1600);actor(1,'sam_vehicle',1750).cooldown=0;use(0,'stealth_bomber');}
 else {actor(0,'infantry',1250);actor(1,'infantry',1550);refreshVision(s);use(1,'jam');}
 refreshVision(s);paint();}
function paint(){const bomber=s.units.find(u=>u.id==='stealth_bomber'&&u.hp>0);const airContact=bomber?`\n敌方空情：${visibleToSide(s,1,bomber)?'近距目视发现，导弹仍无法锁定':'未发现隐身轰炸机'}`:'';render(ctx,s,art,null,null,true,600,1280,null,true);stats.textContent=`${s.time.toFixed(1)}秒 · ${message}\n`+s.units.map(u=>`${u.side?'敌':'我'} ${CARDS[u.id].name} · 生命${Math.ceil(u.hp)} · 位置${Math.round(u.x)}${u.airlift?` · ${u.airlift.phase} · 已投放${u.airlift.dropped}人 · ${u.airlift.aborted?'取消投放返航':'任务中'}`:''}${CARDS[u.id].airRadarRange?` · 雷达${u.radarOff?'关闭':'开启'}`:''} · 射击${u.shots-u.member}次`).join('\n')+airContact+`\n我方手牌：${s.players[0].hand.map(t=>`${CARDS[t.id].name} ${cardCost(t)}费`).join('、')||'无'}\n弃牌：${s.players[0].discard.map(t=>CARDS[t.id].name).join('、')||'无'}`;}
for(const id of ['occupied','clear','radar','stealth','jam'])document.getElementById(id)!.onclick=()=>{mode=id;reset();};
function advance(seconds:number){for(let i=0;i<seconds*60;i++)tick(s,1/60);paint();}
document.getElementById('quarter')!.onclick=()=>advance(.25);document.getElementById('step')!.onclick=()=>advance(1);document.getElementById('return')!.onclick=()=>advance(20);
document.getElementById('radar-toggle')!.onclick=()=>{const u=s.units.find(u=>u.id==='sam_vehicle'&&u.hp>0);if(u)toggleRadar(s,u.uid);paint();};
document.getElementById('strike')!.onclick=()=>{use(0,'anti_radiation_shell');paint();};reset();
