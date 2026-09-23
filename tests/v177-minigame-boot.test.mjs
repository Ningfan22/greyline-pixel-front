import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas');
test('built mini-game boots without browser globals, installs the adapter before render imports and draws its main canvas',()=>{
  const canvases=[],frames=[],handlers={},storage=new Map();let reads=0;
  const sandbox={console, setTimeout, clearTimeout, setInterval, clearInterval,
    requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},cancelAnimationFrame(){},
    tt:{createCanvas(){const c=createCanvas(1,1);canvases.push(c);return c;},
      getSystemInfoSync:()=>({windowWidth:960,windowHeight:540,pixelRatio:2}),
      createImage:()=>({width:0,height:0}),loadFont:()=>null,
      getStorageSync(k){reads++;return storage.get(k)??'';},setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k),
      onTouchStart:fn=>handlers.down=fn,onTouchMove:fn=>handlers.move=fn,
      onTouchEnd:fn=>handlers.up=fn,onTouchCancel:fn=>handlers.cancel=fn,
      onHide:fn=>handlers.hide=fn,onShow:fn=>handlers.show=fn,onWindowResize(){},
    }};
  const context=vm.createContext(sandbox);
  vm.runInContext(readFileSync(new URL('../minigame/game.js',import.meta.url),'utf8'),context,{timeout:5000});
  assert.equal(canvases[0].width,1920);assert.equal(canvases[0].height,1080);
  assert(reads>0);assert.equal(frames.length,1);assert(handlers.down&&handlers.cancel&&handlers.hide);
  frames.shift()();assert.equal(frames.length,1,'main render loop remains scheduled');
  const pixels=canvases[0].getContext('2d').getImageData(0,0,1920,1080).data;
  assert(pixels.some((n,i)=>i%4===3&&n>0),'the first native canvas must be the visible UI canvas');
});
