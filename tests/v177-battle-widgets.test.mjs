import assert from 'node:assert/strict';
import test from 'node:test';
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { Router } from '../minigame/src/ui/framework.ts';
import { createGame, startGame, snapshot } from '../game/engine.ts';
import { CARDS } from '../game/cards.ts';
import { cardPictureUrl } from '../minigame/src/ui/card-render.ts';
import { assetUrl } from '../game/asset-url.ts';

const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(960,540)};
const { BattleScreen }=await import('../minigame/src/ui/battle.ts');

const touch = (s,type,x,y,id=1) => s.handleTouch({type,points:[],changed:[{x,y,id}]});
function fixture() {
  const s=new BattleScreen(960,540,new Router()),g=createGame(177);startGame(g);
  s.game=g;s.phase='battle';s.view=snapshot(g,0);s.syncFromView();s.unlockAudio=()=>{};
  return s;
}
test('live hand refresh retains held cards and keeps every card below pause/result overlays',()=>{
  const s=fixture(),card=s.handWidgets[0];
  touch(s,'down',card.absX+5,card.absY+5);assert.equal(s.pressUid,card.uid);
  s.view.players[0].hand.push({...s.view.players[0].hand[0],uid:99999});s.syncFromView();
  assert.equal(s.handWidgets[0],card);assert.equal(s.pressUid,card.uid);
  for(const w of s.handWidgets)for(const overlay of [s.squadMenu,s.pauseOverlay,s.finishedOverlay,s.portraitGate])
    assert(s.children.indexOf(w)<s.children.indexOf(overlay));
  touch(s,'cancel',card.absX+5,card.absY+5);assert.equal(s.pressUid,null);
});
test('a squad order remains clickable across repeated live refreshes',()=>{
  const s=fixture(),menu=s.squadMenu,orders=[{id:'advance',label:'推进'}];
  menu.visible=true;menu.x=20;menu.y=50;let calls=0;s.onSquadOrder=()=>calls++;
  menu.refresh(orders,undefined,'test',null,'');const button=menu.orderBtns[0];
  touch(s,'down',button.absX+10,button.absY+10);
  for(let i=0;i<8;i++)menu.refresh(orders,undefined,'test',null,'');
  assert.equal(menu.orderBtns[0],button);touch(s,'up',button.absX+10,button.absY+10);assert.equal(calls,1);
});
test('cancelled card drags, top HUD drops and pausing a held card never deploy',()=>{
  for(const action of ['cancel','header','pause']){
    const s=fixture(),card=s.handWidgets[0];let plays=0;s.executeCard=()=>plays++;
    touch(s,'down',card.absX+5,card.absY+5);touch(s,'move',100,150);
    assert.equal(s.cardDragging,true);
    if(action==='pause')s.onTogglePause();
    touch(s,action==='cancel'?'cancel':'up',100,action==='header'?5:150);
    assert.equal(plays,0,action);assert.equal(s.selectedCardUid,null);assert.equal(s.dragGhost,null);
  }
  const s=fixture(),card=s.handWidgets[0];let plays=0;s.executeCard=()=>plays++;
  touch(s,'down',card.absX+5,card.absY+5);touch(s,'move',100,150);touch(s,'up',100,150);assert.equal(plays,1);
});
test('all collectible card illustrations exist in web and CDN bundles, including the five specialist units',()=>{
  for(const [id,c] of Object.entries(CARDS)) {
    if(c.internal)continue;
    const url=cardPictureUrl(id),web=new URL('../public'+url,import.meta.url),cdn=new URL('../minigame-cdn'+url,import.meta.url);
    assert(existsSync(web),`missing web card art: ${id}: ${url}`);assert(existsSync(cdn),`missing CDN card art: ${id}: ${url}`);
    assert.deepEqual(readFileSync(web),readFileSync(cdn));
  }
  const previous=globalThis.__ART_CDN_BASE__;globalThis.__ART_CDN_BASE__='https://assets.invalid/game/';
  try { assert.equal(assetUrl('art/card-back-v1.webp'),assetUrl('/art/card-back-v1.webp'));
    assert.equal(assetUrl('art/card-back-v1.webp'),'https://assets.invalid/game/art/card-back-v1.webp');
  } finally { globalThis.__ART_CDN_BASE__=previous; }
});
