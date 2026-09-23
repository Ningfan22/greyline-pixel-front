import assert from 'node:assert/strict';
import test from 'node:test';
import { Screen, Button, Container, Toggle, ScrollList, Router } from '../minigame/src/ui/framework.ts';
import { TouchRouting } from '../minigame/src/ui/touch-routing.ts';
import { LobbyState } from '../minigame/src/lobby-state.ts';
import { initAdapter } from '../minigame/src/adapter.ts';
import { starterState, COLLECTION_STORAGE } from '../game/collection.ts';
import { loadDeckStore, DECKS_STORAGE, deleteDeck, withActiveDeck } from '../game/decks-store.ts';
import { DECK } from '../game/cards.ts';

class TestScreen extends Screen { drawSelf() {} }
const touch = (screen, type, x = 20, y = 20, id = 1) => screen.handleTouch({ type, points: [], changed: [{ x, y, id }] });
function fixture() {
  const screen = new TestScreen(800, 400), button = screen.addChild(new Button('test', 80, 40));
  let taps = 0; button.onTap = () => taps++;
  return { screen, button, taps: () => taps };
}
test('cancel, release outside, and drag off/back never activate a button', () => {
  for (const actions of [[['cancel',20,20]], [['up',90,20]], [['move',90,20],['move',20,20],['up',20,20]]]) {
    const f = fixture(); touch(f.screen,'down');
    for (const [type,x,y] of actions) touch(f.screen,type,x,y);
    assert.equal(f.taps(),0); assert.equal(f.button.pressed,false);
  }
});
test('a second finger cannot duplicate a tap or reset the first pointer', () => {
  const f=fixture(); touch(f.screen,'down');touch(f.screen,'down',20,20,2);
  touch(f.screen,'up',20,20,2);assert.equal(f.taps(),0);
  touch(f.screen,'up');assert.equal(f.taps(),1);
});
test('one native event can capture two different controls', () => {
  const f=fixture(),b=f.screen.addChild(new Button('other',80,40));b.x=100;
  let n=0;b.onTap=()=>n++;
  const changed=[{id:1,x:20,y:20},{id:2,x:120,y:20}];
  f.screen.handleTouch({type:'down',points:changed,changed});
  f.screen.handleTouch({type:'up',points:[],changed});assert.equal(n,1);assert.equal(f.taps(),1);
});
test('navigation, opening a dialog and closing a dialog cancel outstanding presses', () => {
  const f=fixture(),router=new Router();router.register('a',f.screen);router.register('b',new TestScreen(800,400));
  router.navigate('a');touch(f.screen,'down');router.navigate('b');router.navigate('a');touch(f.screen,'up');
  assert.equal(f.taps(),0);
  touch(f.screen,'down');const panel=new Container();panel.w=100;panel.h=100;f.screen.showDialog(panel);
  touch(f.screen,'up');assert.equal(f.taps(),0);assert.equal(f.button.pressed,false);
  touch(f.screen,'down',10,10);assert.equal(f.screen.hasDialog,false,'outside tap closes modal');
  touch(f.screen,'up',10,10);assert.equal(f.taps(),0,'closing tap cannot leak to page');
});
test('toggles commit only a completed touch, not the down event', () => {
  const s=new TestScreen(800,400),t=s.addChild(new Toggle());
  touch(s,'down',10,10);assert.equal(t.on,false);touch(s,'cancel',10,10);assert.equal(t.on,false);
  touch(s,'down',10,10);touch(s,'up',10,10);assert.equal(t.on,true);
});
test('removing a control or hiding its parent cancels the captured action',()=>{
  const f=fixture();touch(f.screen,'down');f.screen.removeChild(f.button);touch(f.screen,'up');assert.equal(f.taps(),0);
  const parent=f.screen.addChild(new Container());parent.w=100;parent.h=100;parent.addChild(f.button);
  touch(f.screen,'down');parent.visible=false;touch(f.screen,'up');assert.equal(f.taps(),0);
});
test('cancelled lists do not tap items, and captured drags can end outside', () => {
  const s=new TestScreen(800,400),list=s.addChild(new ScrollList(100,100,40));
  list.setItems(Array.from({length:10},()=>new Container()));let n=0;list.onItemTap=()=>n++;
  touch(s,'down');touch(s,'cancel');assert.equal(n,0);
  touch(s,'down',20,80);touch(s,'move',20,-50);touch(s,'up',20,-50);
  assert(list.scrollY>0);assert.equal(n,0);
});
test('touch routing updates coordinates and background cancellation is not a release', () => {
  const events=[],r=new TouchRouting(e=>events.push(e));
  const raw=(x,y)=>({changedTouches:[{identifier:7,clientX:x,clientY:y}]});
  r.dispatch('down',raw(10,10));r.dispatch('move',raw(60,70));
  assert.deepEqual(events.at(-1).points,[{id:7,x:60,y:70}]);r.cancelAll();
  assert.equal(events.at(-1).type,'cancel');assert.deepEqual(events.at(-1).changed,[{id:7,x:60,y:70}]);
  r.dispatch('down',raw(80,90));r.dispatch('cancel',raw(80,90));r.cancelAll();assert.deepEqual(events.at(-1).changed,[]);
});
function storage(values={}) { const data=new Map(Object.entries(values));return { getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k) }; }
test('lobby loads persisted collection/decks only after adapter initialization', () => {
  const previous=globalThis.localStorage;let reads=0;
  globalThis.localStorage={getItem(){reads++;throw Error('not ready');},setItem(){throw Error('not ready');}};
  const lobby=new LobbyState();assert.equal(reads,0);
  const saved={...starterState(),gold:4567,testGoldGranted:true};
  globalThis.localStorage=storage({[COLLECTION_STORAGE]:JSON.stringify(saved),[DECKS_STORAGE]:JSON.stringify({activeId:'mine',decks:[{id:'mine',name:'保存的编队',cards:DECK}]})});
  lobby.initialize();assert.equal(lobby.collection.gold,4567);assert.equal(lobby.deckStore.activeId,'mine');assert.deepEqual(lobby.deck,DECK);
  globalThis.localStorage=previous;
});
test('duplicate imported slot IDs are repaired; deleting or editing one leaves the other untouched', () => {
  const previous=globalThis.localStorage;
  globalThis.localStorage=storage({[DECKS_STORAGE]:JSON.stringify({activeId:'dup',decks:[
    {id:'dup',name:'甲',cards:[...DECK,'nonexistent-card']},{id:'dup',name:'乙',cards:DECK},
  ]})});
  const s=loadDeckStore(starterState());assert.notEqual(s.decks[0].id,s.decks[1].id);
  assert.equal(s.decks[0].cards.length,20);assert.deepEqual(s.decks[0].cards,DECK);
  const changed=withActiveDeck(s,[]);assert.equal(changed.decks[1].cards.length,20);
  assert.equal(deleteDeck(changed,s.activeId).decks.length,1);globalThis.localStorage=previous;
});
test('platform adapter returns native canvas images and a constructible audio context', () => {
  const keys=['tt','document','Image','localStorage','window','AudioContext','webkitAudioContext'];
  const saved=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));const nativeImage={native:true},audio={resume(){}};
  globalThis.tt={createCanvas:()=>({}),getSystemInfoSync:()=>({windowWidth:800,windowHeight:400,pixelRatio:2}),
    createImage:()=>nativeImage,createWebAudioContext:()=>audio,onTouchStart(){},onTouchMove(){}};
  try { initAdapter();assert.equal(new Image(),nativeImage);assert.equal(new window.AudioContext(),audio);assert.equal(new AudioContext(),audio); }
  finally { for(const k of keys) { if(saved[k]===undefined)delete globalThis[k];else globalThis[k]=saved[k]; } }
});
