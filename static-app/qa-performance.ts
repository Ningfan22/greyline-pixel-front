import {loadBattleArt} from '../game/art';
import {createGame,startGame,spawnUnit,refreshVision,W,type GameState} from '../game/engine';
import {render} from '../game/render';
import {advanceBattleFrame} from '../game/battle-clock';
import {BattleFrameBudget} from '../game/battle-frame-budget';
import type {CardId} from '../game/cards';
// Diagnostic sampling is confined to this QA page, never the game loop.
const sampled=new Map<string,{ms:number;calls:number}>();
const traced=new WeakSet<CanvasRenderingContext2D>();
const diagnostic=new URLSearchParams(location.search).has('sample');
// eslint-disable-next-line typescript/unbound-method -- diagnostic wrapper rebinds the canvas with Reflect.apply.
const originalContext=HTMLCanvasElement.prototype.getContext;
if(diagnostic)HTMLCanvasElement.prototype.getContext=function(this:HTMLCanvasElement,...args:unknown[]){
 const c=Reflect.apply(originalContext,this,args);
 if(c instanceof CanvasRenderingContext2D&&!traced.has(c)){
  traced.add(c);
  for(const key of ['drawImage','getImageData','putImageData','fill','fillRect','stroke'] as const){
   const original=c[key] as (...args:unknown[])=>unknown;
   (c as unknown as Record<string,unknown>)[key]=(...values:unknown[])=>{
    const at=performance.now(),result=original.apply(c,values),elapsed=performance.now()-at;
    const name=(this.id==='view'?'screen':this.width===128?'actor':'other')+':'+key+(c.filter==='none'?'':':filtered');
    const item=sampled.get(name)??{ms:0,calls:0};item.ms+=elapsed;item.calls++;sampled.set(name,item);return result;
   };
  }
 }
 return c;
} as typeof originalContext;
const canvas=document.querySelector<HTMLCanvasElement>('#view')!,ctx=canvas.getContext('2d')!;
const report=document.querySelector('#stats')!,art=await loadBattleArt('greyline');
let state:GameState,camera=1300,count=24,mobile=true,paused=false,remainder=0;
const budget=new BattleFrameBudget();
let began=performance.now(),reported=0,frames=0,sim:number[]=[],paint:number[]=[],total:number[]=[],intervals:number[]=[],lastPaint=began;
function reset(){
 state=createGame(198,undefined,undefined,undefined,{weather:false,difficulty:'standard',mapSeed:119});
 startGame(state);Object.assign(state,{units:[],wrecks:[],aiIn:1e9,night:false});
 for(const p of state.players)Object.assign(p,{order:'advance',hand:[],deck:[],discard:[],energy:0});
 const cards:CardId[]=['infantry','antiarmor','lmg_team','tank','light_mortar','javelin','marines','mlrs'];
 for(let i=0;i<count;i++)for(const side of [0,1] as const){const x=1450+(i%8)*25-Math.floor(i/8)*120;spawnUnit(state,side,cards[i%cards.length],side?W-x:x);}
 refreshVision(state);remainder=0;began=performance.now();reported=0;frames=0;
 sim=[];paint=[];total=[];intervals=[];sampled.clear();lastPaint=began;budget.reset(began);
}
for(const [id,n] of [['dense',24],['large',48]] as const)document.querySelector('#'+id)!.addEventListener('click',()=>{count=n;reset();});
document.querySelector('#mobile')!.addEventListener('click',()=>{mobile=true;reset();});
document.querySelector('#original')!.addEventListener('click',()=>{mobile=false;reset();});
document.querySelector('#reset')!.addEventListener('click',reset);
document.querySelector('#pause')!.addEventListener('click',()=>{paused=!paused;budget.reset(performance.now());});
let pointer:number|undefined,dragX=0;
canvas.addEventListener('pointerdown',e=>{pointer=e.pointerId;dragX=e.clientX;canvas.setPointerCapture(e.pointerId);});
canvas.addEventListener('pointermove',e=>{if(pointer!==e.pointerId)return;camera=Math.max(0,Math.min(W-1050,camera-(e.clientX-dragX)*1050/canvas.getBoundingClientRect().width));dragX=e.clientX;});
canvas.addEventListener('pointerup',()=>{pointer=undefined;});
function measure(values:number[]){const sorted=[...values].sort((a,b)=>a-b);return {avg:values.reduce((a,b)=>a+b,0)/Math.max(1,values.length),p95:sorted[Math.floor(sorted.length*.95)]??0};}
reset();
function frame(now:number){
 requestAnimationFrame(frame);
 if(document.hidden){budget.reset(now);return;}
 const dt=budget.take(now,mobile,mobile);if(dt===null)return;
 const start=performance.now();if(!paused)remainder=advanceBattleFrame(state,dt,remainder);
 const computed=performance.now();render(ctx,state,art,null,null,true,camera,1050,null,mobile);
 const finished=performance.now();budget.record(now,finished-start,mobile);
 if(!paused){frames++;sim.push(computed-start);paint.push(finished-computed);total.push(finished-start);intervals.push(now-lastPaint);}lastPaint=now;
 if(now-reported>500){reported=now;const a=measure(sim),b=measure(paint),c=measure(total),d=measure(intervals);
 report.textContent=JSON.stringify({mode:mobile?'手机节奏':'原60帧对照',paused,units:state.units.length,shots:state.units.reduce((sum,u)=>sum+u.shots+u.secondaryShots,0),battleSeconds:+state.time.toFixed(2),wallSeconds:+(Math.max(0,now-began)/1000).toFixed(2),frames,targetFps:budget.fps,displayFps:+(1000/Math.max(1,d.avg)).toFixed(1),computeAvgMs:+a.avg.toFixed(2),computeP95Ms:+a.p95.toFixed(2),paintAvgMs:+b.avg.toFixed(2),paintP95Ms:+b.p95.toFixed(2),totalP95Ms:+c.p95.toFixed(2),camera:Math.round(camera),drawSampling:[...sampled].sort((a,b)=>b[1].ms-a[1].ms).slice(0,8).map(([name,v])=>({name,msPerFrame:+(v.ms/Math.max(1,frames)).toFixed(2),callsPerFrame:+(v.calls/Math.max(1,frames)).toFixed(1)}))},null,2);
 }
}
requestAnimationFrame(frame);
