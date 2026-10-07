import test from 'node:test';import assert from 'node:assert/strict';import {createRequire} from 'node:module';
const {createCanvas}=createRequire(import.meta.url)('@napi-rs/canvas');let allocations=0,rectangles=0;
globalThis.document={createElement(){allocations++;const c=createCanvas(1,1),context=c.getContext.bind(c);c.getContext=(...args)=>{const ctx=context(...args);if(!ctx.instrumented){ctx.instrumented=true;const fill=ctx.fillRect.bind(ctx);ctx.fillRect=(...values)=>{rectangles++;return fill(...values);};}return ctx;};return c;}};
const {drawScorches,drawTreads}=await import('../game/ambience.ts');const {createGame,startGame}=await import('../game/engine.ts');
test('dense persistent ground marks reuse pixels across frames and follow crater ground changes',()=>{
 const s=createGame(227,undefined,undefined,undefined,{weather:false});startGame(s);s.terrain.fill(374);s.scorches=Array.from({length:64},(_,i)=>({x:500+i*8,radius:22,seed:i+1}));s.treads=Array.from({length:90},(_,i)=>({x:500+i*6,y:374,half:55,seed:i+5,born:0}));s.time=0;
 const screen=createCanvas(1200,480),ctx=screen.getContext('2d');const paint=()=>{ctx.clearRect(0,0,1200,480);drawScorches(ctx,s,0,1200);drawTreads(ctx,s,0,1200);};paint();const initial=Buffer.from(ctx.getImageData(0,0,1200,480).data),a=allocations,r=rectangles;
 for(let i=0;i<30;i++)paint();assert.equal(allocations,a);assert.equal(rectangles,r,'no per-frame speckle repaint');assert(Buffer.from(ctx.getImageData(0,0,1200,480).data).equals(initial));
 s.time=39;paint();assert(!Buffer.from(ctx.getImageData(0,0,1200,480).data).equals(initial),'treads continue to fade');s.time=40;s.terrain.fill(390);paint();assert.equal(allocations,a,'new crater height moves scorch stamps without rebuilding pixels');assert(ctx.getImageData(600,390,1,1).data[3]>0,'scorch follows actual soil height');
});
