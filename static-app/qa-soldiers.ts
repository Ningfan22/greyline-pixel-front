import {loadArt} from '../game/art';
import {soldierFrame} from '../game/soldier-art';
import {soldierPose,updateSoldierGait} from '../game/soldier-pose';
import {render} from '../game/render';
import {CARDS,createGame,startGame,spawnUnit,refreshVision,tick,ground,type CardId} from '../game/engine';
const select=<T=HTMLElement>(id:string)=>document.getElementById(id) as unknown as T;
const card=select<HTMLSelectElement>('card'),member=select<HTMLSelectElement>('member'),action=select<HTMLSelectElement>('action');
const view=select<HTMLCanvasElement>('view'),ctx=view.getContext('2d')!,detail=select<HTMLCanvasElement>('detail'),dc=detail.getContext('2d')!;
for(const [id,c] of Object.entries(CARDS))if(c.members){const o=document.createElement('option');o.value=id;o.textContent=`${c.name} (${id})`;card.appendChild(o);}
card.value='marines';
let s=createGame(178),phase=0,poseTime=0,paused=false,combat=false,facing=1,last=performance.now();
let fallStart:ReturnType<typeof soldierPose>|undefined;
let rappelLanding:ReturnType<typeof soldierPose>|undefined;
function reset(){
  s=createGame(178);startGame(s);s.units=[];s.aiIn=1e9;s.weather.disabled=true;
  spawnUnit(s,0,card.value as CardId,950);phase=0;poseTime=0;fallStart=undefined;rappelLanding=undefined;
  if(combat){spawnUnit(s,1,'infantry',1270);spawnUnit(s,1,'tank',1530);spawnUnit(s,1,'helicopter',1580);}
  else {s.scenery=[];s.walls=[];s.terrain.fill(374);s.original.fill(374);s.units=s.units.filter(u=>u.member===Number(member.value));}
  for(const u of s.units)u.y=ground(s,u.x);
  if(!combat&&action.value==='rappel'&&s.units[0]){
    const soldier=s.units[0];spawnUnit(s,0,'air_assault',soldier.x);
    const carrier=s.units[s.units.length-1];carrier.y=ground(s,soldier.x)-130;
    carrier.airlift={x:soldier.x,phase:'unload',dropped:1,nextAt:1e9,squad:soldier.squad};
  }
  refreshVision(s);
}
function members(){member.replaceChildren();for(let i=0;i<(CARDS[card.value as CardId].members??1);i++){
  const o=document.createElement('option');o.value=String(i);o.textContent=`成员 ${i+1}`;member.appendChild(o);
}reset();}
card.onchange=members;member.onchange=reset;action.onchange=()=>{combat=false;select('combat').textContent='开始真实战斗';reset();};members();
select<HTMLButtonElement>('flip').onclick=()=>{facing=-facing;};
select<HTMLButtonElement>('pause').onclick=e=>{paused=!paused;(e.currentTarget as HTMLButtonElement).textContent=paused?'继续':'暂停';};
select<HTMLButtonElement>('step').onclick=()=>{paused=true;select('pause').textContent='继续';phase+=1/30;if(combat)tick(s,1/30);};
select<HTMLButtonElement>('combat').onclick=e=>{combat=!combat;(e.currentTarget as HTMLButtonElement).textContent=combat?'返回动作检查':'开始真实战斗';reset();};
const art=await loadArt();
function loop(now:number){const dt=Math.min(.05,(now-last)/1000);last=now;
  if(!paused){phase+=dt;if(combat)tick(s,dt);}
  const u=s.units.find(v=>v.side===0&&v.member===Number(member.value));
  if(!combat&&u){
    const previous={x:u.x,lane:u.lane},step=phase-poseTime;poseTime=phase;
    Object.assign(u,{hp:100,y:374,lane:0,pose:'idle',motion:'ground',moving:false,
      facing,aimUntil:0,readyAt:0,poseAnimAt:undefined,poseAnimProgress:undefined,
      motionTime:0,motionDuration:0,soldierLanding:undefined,
      crouchTravel:0,proneTravel:0,fire:0,secondaryFire:0,flash:0,tending:false,digging:false,rappelling:false,parachuting:false,
      fragThrow:0,wounded:false,surrendered:false,ammo:30,reloadingUntil:0,rifleReady:0,observingUntil:0});
    Object.assign(u,{fallVariant:undefined,soldierFall:undefined});
    s.time=20+phase;
    const mode=action.value,beat=phase%2.4;
    if(['march','walk','backward','run','crouch','prone','reload'].includes(mode)){
      u.moving=true;u.pose=['march','reload','backward'].includes(mode)?'walk':mode as typeof u.pose;u.crouchTravel=mode==='crouch'?1:0;u.proneTravel=mode==='prone'?1:0;
      const speed=mode==='run'?54:mode==='crouch'?22:mode==='prone'?10:36;
      u.x+=step*speed*facing*(mode==='backward'?-1:1);
    }
    // A ready weapon is not necessarily being aimed. Only these explicit
    // firing postures raise the stock to the cheek and align the eye to sights.
    if(['aim','kneel','prone-aim'].includes(mode))Object.assign(u,{rifleReady:1,aimUntil:s.time+1});
    if(['walk','backward','ready','crouch'].includes(mode))u.rifleReady=.35;
    if(mode==='kneel')u.pose='crouch';
    if(mode==='prone-aim')u.pose='prone';
    if(mode==='observe')u.observingUntil=s.time+1;
    if(mode==='reload')Object.assign(u,{ammo:0,reloadingStartAt:s.time-beat,reloadingUntil:s.time-beat+2.4});
    if(mode==='stance'){const down=Math.floor(phase/2.4)%2===0;
      Object.assign(u,{pose:down?'prone':'idle',poseAnimFrom:down?'stand':'prone',poseAnimSeen:down?'prone':'stand',poseAnimAt:s.time-beat});}
    if(mode==='throw')Object.assign(u,{fragThrow:1.1-phase%1.1,fragThrowStartedAt:s.time-phase%1.1});
    if(mode==='medical'||mode==='repair')Object.assign(u,{pose:'crouch',tending:true,tendingKind:mode,tendingTime:phase});
    if(mode==='dig')Object.assign(u,{pose:'crouch',digging:true,digElapsed:phase});
    if(mode==='rappel'){
      // Use the live insertion's 58px door offset, 65px/s descent and 0.3s
      // landing. The actual renderer finds this matching carrier for its rope.
      const carrier=s.units.find(v=>v.airlift?.squad===u.squad)!;
      carrier.x=u.x;carrier.facing=facing;carrier.y=ground(s,u.x)-130;
      const startY=carrier.y+58,duration=(ground(s,u.x)-startY)/65;
      const elapsed=phase%(duration+.9),started=s.time-elapsed;
      Object.assign(u,{rappellingStartAt:started,pose:'climb',moving:true});
      if(elapsed<duration){
        Object.assign(u,{rappelling:true,y:startY+elapsed*65});rappelLanding=undefined;
      }else{
        rappelLanding??=soldierPose({...u,rappelling:true},started+duration);
        const landing=elapsed-duration;
        Object.assign(u,{y:ground(s,u.x),moving:false,pose:landing<.3?'land':'idle',
          motion:landing<.3?'land':'ground',motionTime:landing,motionDuration:.3,
          soldierLanding:landing<.3?{at:started+duration,duration:.3,pose:rappelLanding}:undefined});
      }
    }
    if(mode==='surrender')Object.assign(u,{surrendered:true,surrenderTime:Math.min(phase,2)});
    if(mode==='wounded'||mode.startsWith('fall-')){
      const variant=mode==='wounded'?Math.floor(phase/2.4)%4:Number(mode.slice(5));
      // The production fall solver starts from one captured body pose. Keep
      // that snapshot throughout each fall instead of rebuilding it per frame.
      fallStart??=soldierPose({...u,pose:'walk',moving:true,gaitWeight:1,gaitPhase:2},s.time);
      Object.assign(u,{wounded:true,woundedTime:phase%2.4,fallVariant:variant,soldierFall:fallStart,gaitWeight:0});
    }
    if(step>0)updateSoldierGait(u,previous,step,s.time);
    u.walk=u.gaitPhase??0;
  }
  refreshVision(s);const camera=combat?650:(u?.x??950)-350;
  render(ctx,s,art,null,null,true,camera,1024);
  dc.fillStyle='#adb6ad';dc.fillRect(0,0,1024,300);dc.imageSmoothingEnabled=false;
  if(u&&art.soldiers){const f=soldierFrame(art.soldiers,u,s.time);dc.save();dc.translate(512,290);dc.scale(facing<0?-3:3,3);dc.drawImage(f.image,-64,-96);dc.restore();
    select('status').textContent=`${CARDS[u.id].name} · 成员 ${u.member+1} · ${combat?'真实战斗':action.selectedOptions[0].textContent} · ${f.pose.weapon} / ${f.pose.action} · 步态 ${(u.gaitPhase??u.walk).toFixed(2)} · 开火 ${u.shots} 次`;
  }else select('status').textContent='该成员已退出战斗；重新选择兵种可重开。';
  requestAnimationFrame(loop);
}requestAnimationFrame(loop);
