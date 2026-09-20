import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const {createCanvas,Image}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
globalThis.Image=class extends Image{
  set src(v){super.src=v.startsWith('/')?fileURLToPath(new URL('../public'+v,import.meta.url)):v;}
  get src(){return super.src;}
};
const {loadArt}=await import('../game/art.ts');
const {render}=await import('../game/render.ts');
const {createGame,startGame,tick,refreshVision,visibleToSide,playCard,requestDraw,CARDS,H}=await import('../game/engine.ts');
const {MAP_IDS}=await import('../game/maps.ts');
const {contactSector}=await import('../tests/fixtures/contact-sector.mjs');
const art=await loadArt(),out=mkdtempSync(join(tmpdir(),'greyline-v168-contact-'));
const canvas=createCanvas(1280,H),ctx=canvas.getContext('2d');let rendered=0;
function draw(s,camera,name){const before=JSON.stringify([s.units,s.groundContacts]);
  render(ctx,s,art,null,null,true,camera,1280);rendered++;
  assert.equal(JSON.stringify([s.units,s.groundContacts]),before);
  if(name)writeFileSync(join(out,name+'.png'),canvas.toBuffer('image/png'));
}
const sectors=[];
for(const id of ['infantry','tank']){
  const {s,u,e,hideInCrater}=contactSector(0,id),seenX=e.x,gap=id==='infantry'?105:150;
  draw(s,650,`${id}-observed`);hideInCrater();draw(s,650,`${id}-lost`);
  for(let i=0;i<360;i++){tick(s,1/60);assert(seenX-u.x>=gap-1e-7);if(i%6===0)draw(s,650,i===354?`${id}-holding`:undefined);}
  const holdingX=u.x;assert(s.groundContacts[0].some(c=>c.uid===e.uid));
  // Unknown removal cannot by itself release the stop line. A real paid flare
  // must show the abandoned sector continuously before advance resumes.
  s.units.splice(s.units.indexOf(e),1);s.players[0].hand=[{id:'flare',uid:++s.uid}];s.players[0].energy=10;
  assert(playCard(s,0,s.players[0].hand[0].uid,seenX).ok);refreshVision(s);
  let clearedAt;
  for(let i=0;i<240;i++){tick(s,1/60);if(!s.groundContacts[0].length)clearedAt??=s.time;
    if(i%6===0)draw(s,650,i===234?`${id}-cleared`:undefined);}
  assert(clearedAt!==undefined);assert(u.x>holdingX+40);sectors.push({id,holdingX,gap,clearedAt,finalX:u.x});
}

// Four complete seeded games. The human-side driver uses only its actual
// hand/CP and visible or remembered coordinates; the opponent uses normal AI.
// This is a robustness/play-through run, not a balance or human-win-rate study.
const matches=[];
for(const map of MAP_IDS){
  const s=createGame(168,undefined,undefined,map,{mapSeed:168,difficulty:'standard'});startGame(s);
  const timing=[],seenFlareSeeds=new Set(),reportIds=[new Set(),new Set()];
  let peakUnits=0,peakReports=0,draws=0;
  for(let frame=0;frame<18001&&s.status==='playing';frame++){
    if(frame%15===0){
      const p=s.players[0],target=s.units.find(u=>u.side===1&&u.hp>0&&!u.wounded&&!u.surrendered&&visibleToSide(s,0,u));
      const aim=target?.x??s.groundContacts?.[0]?.[0]?.x;
      for(const card of [...p.hand]){if(CARDS[card.id].targetGround&&aim===undefined)continue;
        if(playCard(s,0,card.uid,CARDS[card.id].targetGround?aim:undefined).ok)break;}
      if(p.hand.length<5&&p.deck.length&&p.energy>=4&&requestDraw(s,0).ok)draws++;
    }
    const at=performance.now();tick(s,1/30);timing.push(performance.now()-at);
    for(const u of s.units)assert(Number.isFinite(u.x)&&Number.isFinite(u.y)&&Number.isFinite(u.hp));
    for(const side of [0,1])for(const c of s.groundContacts?.[side]??[])reportIds[side].add(c.uid);
    for(const f of s.flares)seenFlareSeeds.add(f.seed);
    peakUnits=Math.max(peakUnits,s.units.length);peakReports=Math.max(peakReports,...(s.groundContacts??[[],[]]).map(x=>x.length));
    if(frame%90===0){const front=s.units.filter(u=>u.side===0&&u.hp>0&&!CARDS[u.id].air).reduce((x,u)=>Math.max(x,u.x),650);
      draw(s,Math.max(0,Math.min(2560,front-400)),[900,3600,9000].includes(frame)?`${map}-${Math.round(s.time)}s`:undefined);}
  }
  assert.equal(s.status,'finished',`${map}: actual terminal state`);
  timing.sort((a,b)=>a-b);
  const result={map,seconds:s.time,result:s.result,hq:s.players.map(p=>p.hp),played:s.players.map(p=>p.played),kills:s.players.map(p=>p.kills),
    remainingCards:s.players.map(p=>p.hand.length+p.deck.length),paidPlayerDraws:draws,peakUnits,peakReports,
    observedIds:reportIds.map(x=>x.size),remainingReports:(s.groundContacts??[[],[]]).map(x=>x.length),flares:seenFlareSeeds.size,
    tickMs:{median:timing[timing.length>>1],p95:timing[Math.floor(timing.length*.95)],max:timing.at(-1)}};
  matches.push(result);console.log(JSON.stringify(result));
}
const report={out,rendered,sectors,matches};writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
