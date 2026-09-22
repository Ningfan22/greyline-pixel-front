import {loadArt} from '../game/art';
import {render} from '../game/render';
import {createGame,startGame,spawnUnit,refreshVision,CARDS} from '../game/engine';
import {adultFrameChoice} from '../game/adult-animation';
import {patrolModeForUnit} from '../game/patrol-art-v17';
import {Router} from '../minigame/src/ui/framework';
import {LobbyScreen} from '../minigame/src/ui/lobby';
import {DeckBuilderScreen} from '../minigame/src/ui/deck-builder';
import {ShopScreen} from '../minigame/src/ui/shop';
import {BattleScreen} from '../minigame/src/ui/battle';
import {lobbyState} from '../minigame/src/lobby-state';

// Keep all QA economy/deck changes isolated from the real game origin data.
const saved=new Map<string,string>();
Object.defineProperty(globalThis,'localStorage',{value:{getItem:(k:string)=>saved.get(k)??null,setItem:(k:string,v:string)=>saved.set(k,v),removeItem:(k:string)=>saved.delete(k)}});
lobbyState.initialize();
const canvas=document.querySelector<HTMLCanvasElement>('#view')!,ctx=canvas.getContext('2d')!;
const status=document.querySelector<HTMLParagraphElement>('#status')!;
const router=new Router();
router.register('lobby',new LobbyScreen(960,540,router));
router.register('deck-builder',new DeckBuilderScreen(960,540,router));
router.register('shop',new ShopScreen(960,540,router));
const battle=new BattleScreen(960,540,router);router.register('battle',battle);
lobbyState.onBattle=()=>{battle.configure(lobbyState.match!);router.navigate('battle');};
router.navigate('lobby');
let mode='motion',paused=false,phase=0,last=performance.now();
const s=createGame(177);startGame(s);s.aiIn=1e9;s.scenery=[];s.walls=[];s.units=[];
s.terrain.fill(374);s.original.fill(374);s.weather.disabled=true;
for(const [i,id] of (['infantry','marines','armed_police','militia'] as const).entries()){
  const n=s.units.length;spawnUnit(s,0,id,700+i*190);s.units.splice(n+1);
  Object.assign(s.units[n],{x:700+i*190,y:374,lane:0,motion:'ground',pose:'walk',moving:true,
    hp:100,aimUntil:1e9,readyAt:0,poseAnimAt:undefined,walk:0,fire:0,flash:0,fragThrow:0});
}
document.querySelector<HTMLButtonElement>('#motion')!.onclick=()=>{mode='motion';router.active?.cancelTouches();};
document.querySelector<HTMLButtonElement>('#canvas-ui')!.onclick=()=>{mode='ui';};
document.querySelector<HTMLButtonElement>('#pause')!.onclick=(ev)=>{paused=!paused;(ev.currentTarget as HTMLButtonElement).textContent=paused?'继续':'暂停';};
document.querySelector<HTMLButtonElement>('#step')!.onclick=()=>{paused=true;phase=Math.floor(phase)+1;document.querySelector<HTMLButtonElement>('#pause')!.textContent='继续';};
canvas.style.touchAction='none';
for(const [name,type] of [['pointerdown','down'],['pointermove','move'],['pointerup','up'],['pointercancel','cancel']] as const)
  canvas.addEventListener(name,(event)=>{if(mode!=='ui')return;const e=event as PointerEvent,r=canvas.getBoundingClientRect();
    if(type==='down')canvas.setPointerCapture(e.pointerId);
    const point={id:e.pointerId,x:(e.clientX-r.left)*canvas.width/r.width,y:(e.clientY-r.top)*canvas.height/r.height};
    router.handleTouch({type,points:[point],changed:[point]});});
const art=await loadArt();
function loop(now:number){const dt=Math.min(.05,(now-last)/1000);last=now;
  ctx.clearRect(0,0,960,540);
  if(mode==='ui'){router.update(dt);router.draw(ctx);status.textContent=`Canvas 页面：${router.activeName} · 独立测试存档`;}else{
    if(!paused)phase+=dt*6;s.time=10+phase/6;
    const pose=(document.querySelector('#pose') as unknown as HTMLSelectElement).value;
    for(const [i,u] of s.units.entries()){u.pose=pose as typeof u.pose;u.walk=phase;u.x=700+i*190+(phase*8)%70;u.crouchTravel=pose==='crouch'?1:0;u.proneTravel=pose==='prone'?1:0;}
    refreshVision(s);
    render(ctx,s,art,null,null,true,500,960);
    ctx.fillStyle='#fff';ctx.font='14px sans-serif';
    for(const u of s.units)ctx.fillText(CARDS[u.id].name,u.x-530,410);
    const f=adultFrameChoice(s.units[1],s.time);
    status.textContent=`实际举枪移动：${f.group} / ${f.index}；静态全身覆盖：${patrolModeForUnit(s.units[1],f,s.time)??'无'}。枪保持举起，步态随位移推进。`;
  }requestAnimationFrame(loop);
}requestAnimationFrame(loop);
