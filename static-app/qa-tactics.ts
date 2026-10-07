import {loadBattleArt} from '../game/art';
import {createGame,startGame,spawnUnit,refreshVision,type GameState} from '../game/engine';
import {render} from '../game/render';
import {soldierPose} from '../game/soldier-pose';
import {advanceBattleFrame} from '../game/battle-clock';
import {BattleFrameBudget} from '../game/battle-frame-budget';
const canvas=document.querySelector<HTMLCanvasElement>('#view')!,ctx=canvas.getContext('2d')!,stats=document.querySelector('#stats')!;
const art=await loadBattleArt('greyline'),budget=new BattleFrameBudget();
let scene='probe',paused=false,s:GameState,remainder=0,reported=0;
function reset(){
 s=createGame(226,undefined,undefined,undefined,{weather:false});startGame(s);
 Object.assign(s,{units:[],scenery:[],walls:[],wrecks:[],aiIn:1e9,night:false});s.terrain.fill(374);s.original.fill(374);s.terrainVersion++;
 for(const p of s.players)Object.assign(p,{order:'advance',hand:[],deck:[],discard:[],energy:0});
 spawnUnit(s,0,'infantry',1350);
 if(scene==='fight')spawnUnit(s,1,'infantry',1660);
 else {
  s.groundContacts??=[[],[]];s.groundContacts[0]=[{uid:999,side:1,x:1760,y:374,seenAt:0,id:'infantry',kind:'infantry',range:380}];
  s.smokes.push({x:1760,life:30,side:0});
 }
 refreshVision(s);remainder=0;budget.reset(performance.now());reported=0;
}
for(const id of ['probe','fight'])document.querySelector('#'+id)!.addEventListener('click',()=>{scene=id;reset();});
document.querySelector('#step')!.addEventListener('click',()=>{paused=true;for(let i=0;i<20;i++)remainder=advanceBattleFrame(s,.05,remainder);reported=0;budget.reset(performance.now());});
document.querySelector('#reset')!.addEventListener('click',reset);
document.querySelector('#pause')!.addEventListener('click',()=>{paused=!paused;budget.reset(performance.now());});
reset();
function frame(now:number){
 requestAnimationFrame(frame);if(document.hidden){budget.reset(now);return;}
 const dt=budget.take(now,true);if(dt===null)return;
 const at=performance.now();if(!paused)remainder=advanceBattleFrame(s,dt,remainder);
 render(ctx,s,art,null,null,true,1000,1024,null,true);
 for(const u of s.units){if(u.side||u.hp<=0||u.wounded)continue;ctx.fillStyle='#d5d1ad';ctx.font='11px monospace';ctx.fillText(u.teamRole==='probe'?'探查':u.teamRole==='bound'?'跃进':u.teamRole==='overwatch'?'掩护':'',u.x-1000-14,u.y-74);}
 if(now-reported>400){reported=now;stats.textContent=`${scene==='probe'?'探查与掩护':'真实步兵交火'} · ${paused?'暂停':'进行中'} · ${s.time.toFixed(1)}秒\n`+s.units.filter(u=>u.side===0).map(u=>`队员${u.member+1}：${u.wounded?'倒地':u.hp<=0?'阵亡':`${u.teamRole??'前进'} / ${u.pose} / ${soldierPose(u,s.time).action}`} · ${u.facing>0?'朝前':'朝后'} · 射击${u.shots-(u.member??0)}次`).join('\n');}
 budget.record(now,performance.now()-at);
}
requestAnimationFrame(frame);
