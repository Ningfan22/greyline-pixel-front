import {loadBattleArt, unitFrame, drawSprite, unitSize} from '../game/art';
import {drawArticulatedGun} from '../game/gun-art';
import {gunMount} from '../game/gun-geometry';
import {render} from '../game/render';
import {createGame,startGame,spawnUnit,refreshVision,tick,CARDS,type CardId,type Unit} from '../game/engine';
const view=document.querySelector<HTMLCanvasElement>('#view')!,ctx=view.getContext('2d')!;
const status=document.querySelector<HTMLParagraphElement>('#status')!;
const art=await loadBattleArt('greyline');
let mode='parts',paused=false,phase=0,last=performance.now(),facing=1,fire=0,camera=550;
let state=createGame(202),actors:Unit[]=[],shots=new Map<number,number>();
function watch(u:Unit){Object.assign(u,{squadOrder:'watch',squadOrderX:u.x,squadOrderUntil:Infinity,emplaced:true,emplacementSetupUntil:0});}
function spawn(side:0|1,id:CardId,x:number){const n=state.units.length;spawnUnit(state,side,id,x);return state.units[n];}
function scene(next:string){
  mode=next;paused=false;state=createGame(202,undefined,undefined,undefined,{weather:false});startGame(state);
  Object.assign(state,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});
  state.terrain.fill(374);state.original.fill(374);state.terrainVersion++;state.weather.disabled=true;
  shots=new Map();
  for(const p of state.players)Object.assign(p,{hand:[],deck:[],discard:[],energy:0});
  if(next==='duel'){
    const tank=spawn(0,'tank',750),gun=spawn(1,'artillery',1130);watch(tank);watch(gun);actors=[tank,gun];camera=500;
    state.scenery=[{id:900,kind:'house',x:1130,y:374,seed:0,parts:[{id:0,x:1112,y:339,w:36,h:35,hp:70,maxHp:70,kind:'wall',brokenAt:0}]}];
  }else{
    const battery=spawn(0,'mlrs',1050),scout=spawn(0,'pathfinders',1580),gun=spawn(1,'barrage',1810);watch(scout);watch(gun);actors=[battery,gun];camera=960;
    state.scenery=[{id:901,kind:'house',x:1420,y:374,seed:0,parts:[{id:0,x:1398,y:255,w:44,h:119,hp:250,maxHp:250,kind:'wall',brokenAt:-1}]}];
  }
  refreshVision(state);
}
document.querySelector<HTMLButtonElement>('#parts')!.onclick=()=>{mode='parts';paused=false;};
document.querySelector<HTMLButtonElement>('#flip')!.onclick=()=>{facing=-facing;};
document.querySelector<HTMLButtonElement>('#shot')!.onclick=()=>{fire=.25;};
document.querySelector<HTMLButtonElement>('#duel')!.onclick=()=>scene('duel');
document.querySelector<HTMLButtonElement>('#rockets')!.onclick=()=>scene('rockets');
document.querySelector<HTMLButtonElement>('#pause')!.onclick=()=>{paused=!paused;};
function loop(now:number){
  const dt=Math.min(.05,(now-last)/1000);last=now;
  if(!paused){phase+=dt;fire=Math.max(0,fire-dt);}
  ctx.clearRect(0,0,960,540);
  if(mode==='parts'){
    ctx.fillStyle='#68715f';ctx.fillRect(0,0,960,540);
    const list:CardId[]=['light_tank','tank','heavy_tank','artillery','anti_tank_gun','mlrs'];
    for(const [i,id]of list.entries()){
      const x=[150,460,730][i%3],y=i<3?220:450,mount=gunMount(id);
      const part=art.gunParts?.[id]??art.gunParts?.[CARDS[id].emplacement??''];
      if(part&&mount){const elevation=mount.minElevation+(mount.maxElevation-mount.minElevation)*(.5+.5*Math.sin(phase*.7));
        drawArticulatedGun(ctx,part,{id,x,y,hullAngle:i<3?Math.sin(phase*.4)*.08:0,facing,gunFacing:facing,gunElevation:elevation,fire});
      }else{const [w,h]=unitSize(id);drawSprite(ctx,unitFrame(art,id),x,y,w,h,facing<0);}
      ctx.fillStyle='#f4efd7';ctx.font='15px system-ui';ctx.fillText(CARDS[id].name,x-70,y+35);
    }
    status.textContent='独立炮管连续俯仰 · 车体保持固定尺寸 · 火箭炮已缩小 20%';
  }else{
    if(!paused&&state.time<25){tick(state,dt);for(const u of actors)shots.set(u.uid,Math.max(shots.get(u.uid)??0,u.shots));}
    render(ctx,state,art,null,null,true,camera,960);
    status.textContent=`${state.time.toFixed(1)} 秒 · `+actors.map(u=>`${CARDS[u.id].name}：已发射 ${shots.get(u.uid)??0}，生命 ${Math.max(0,Math.round(u.hp))}，位置 ${Math.round(u.x)}`).join(' ｜ ');
  }
  requestAnimationFrame(loop);
}requestAnimationFrame(loop);
