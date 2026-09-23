import {loadArt} from '../game/art';
import {soldierFrame} from '../game/soldier-art';
import {render} from '../game/render';
import {CARDS,createGame,startGame,spawnUnit,refreshVision,tick,ground,type CardId} from '../game/engine';
const select=<T extends HTMLElement>(id:string)=>document.getElementById(id) as T;
const card=select<HTMLSelectElement>('card'),member=select<HTMLSelectElement>('member'),action=select<HTMLSelectElement>('action');
const view=select<HTMLCanvasElement>('view'),ctx=view.getContext('2d')!,detail=select<HTMLCanvasElement>('detail'),dc=detail.getContext('2d')!;
for(const [id,c] of Object.entries(CARDS))if(c.members){const o=document.createElement('option');o.value=id;o.textContent=`${c.name} (${id})`;card.append(o);}
card.value='marines';
let s=createGame(178),phase=0,paused=false,combat=false,facing=1,last=performance.now();
function reset(){
  s=createGame(178);startGame(s);s.units=[];s.aiIn=1e9;s.weather.disabled=true;
  spawnUnit(s,0,card.value as CardId,950);phase=0;
  if(combat){spawnUnit(s,1,'infantry',1270);spawnUnit(s,1,'tank',1530);spawnUnit(s,1,'helicopter',1580);}
  else {s.scenery=[];s.walls=[];s.terrain.fill(374);s.original.fill(374);s.units=s.units.filter(u=>u.member===Number(member.value));}
  for(const u of s.units)u.y=ground(s,u.x);refreshVision(s);
}
function members(){member.replaceChildren();for(let i=0;i<(CARDS[card.value as CardId].members??1);i++){
  const o=document.createElement('option');o.value=String(i);o.textContent=`成员 ${i+1}`;member.append(o);
}reset();}
card.onchange=members;member.onchange=reset;action.onchange=()=>{combat=false;reset();};members();
select<HTMLButtonElement>('flip').onclick=()=>{facing=-facing;};
select<HTMLButtonElement>('pause').onclick=e=>{paused=!paused;(e.currentTarget as HTMLButtonElement).textContent=paused?'继续':'暂停';};
select<HTMLButtonElement>('step').onclick=()=>{paused=true;phase+=1/30;if(combat)tick(s,1/30);};
select<HTMLButtonElement>('combat').onclick=()=>{combat=!combat;reset();};
const art=await loadArt();
function loop(now:number){const dt=Math.min(.05,(now-last)/1000);last=now;
  if(!paused){phase+=dt;if(combat)tick(s,dt);}
  const u=s.units.find(v=>v.side===0&&v.member===Number(member.value));
  if(!combat&&u){
    Object.assign(u,{hp:100,y:374,lane:0,pose:'idle',motion:'ground',moving:false,walk:phase*6,
      x:950,facing,aimUntil:1e9,readyAt:0,poseAnimAt:undefined,poseAnimProgress:undefined,
      crouchTravel:0,proneTravel:0,fire:0,flash:0,tending:false,digging:false,rappelling:false,parachuting:false,
      fragThrow:0,wounded:false,surrendered:false,ammo:30,reloadingUntil:0,gaitPhase:undefined,gaitWeight:undefined,rifleReady:1});
    s.time=20+phase;
    const mode=action.value,beat=phase%2.4;
    if(['walk','run','crouch','prone','reload'].includes(mode)){
      u.moving=true;u.pose=mode==='reload'?'walk':mode as typeof u.pose;u.crouchTravel=mode==='crouch'?1:0;u.proneTravel=mode==='prone'?1:0;
      u.x=1400+(phase%20)*48*facing;
    }
    if(mode==='reload')Object.assign(u,{ammo:0,reloadingStartAt:s.time-beat,reloadingUntil:s.time-beat+2.4});
    if(mode==='stance'){const down=Math.floor(phase/2.4)%2===0;
      Object.assign(u,{pose:down?'prone':'idle',poseAnimFrom:down?'stand':'prone',poseAnimSeen:down?'prone':'stand',poseAnimAt:s.time-beat});}
    if(mode==='throw')Object.assign(u,{fragThrow:1.1-phase%1.1,fragThrowStartedAt:s.time-phase%1.1});
    if(mode==='medical'||mode==='repair')Object.assign(u,{pose:'crouch',tending:true,tendingKind:mode,tendingTime:phase});
    if(mode==='dig')Object.assign(u,{pose:'crouch',digging:true,digElapsed:phase});
    if(mode==='rappel')Object.assign(u,{rappelling:true,y:290});
    if(mode==='surrender')Object.assign(u,{surrendered:true,surrenderTime:Math.min(phase,2)});
    if(mode==='wounded')Object.assign(u,{wounded:true,woundedTime:phase%2});
  }
  refreshVision(s);const camera=combat?650:(u?.x??950)-350;
  render(ctx,s,art,null,null,true,camera,1024);
  dc.fillStyle='#adb6ad';dc.fillRect(0,0,1024,300);dc.imageSmoothingEnabled=false;
  if(u&&art.soldiers){const f=soldierFrame(art.soldiers,u,s.time);dc.save();dc.translate(512,290);dc.scale(facing<0?-3:3,3);dc.drawImage(f.image,-64,-96);dc.restore();
    select('status').textContent=`${CARDS[u.id].name} · 成员 ${u.member+1} · ${f.pose.weapon} / ${f.pose.action} · 姿势 ${u.pose} · 步态 ${(u.gaitPhase??u.walk).toFixed(2)} · 开火 ${u.shots} 次 · ${combat?'真实模拟':'动作检查'}`;
  }else select('status').textContent='该成员已退出战斗；重新选择兵种可重开。';
  requestAnimationFrame(loop);
}requestAnimationFrame(loop);
