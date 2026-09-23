/** Execute the built native bundle, loading the real packaged WebP files.
 * This is a local platform simulation, NOT a Douyin device/CDN deployment. */
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync,mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const {createCanvas,Image}=createRequire(import.meta.url)('@napi-rs/canvas');
const {CARDS}=await import('../game/cards.ts');
// VM failures can otherwise dump the entire one-line production bundle.
process.on('uncaughtException', error => {
  console.error(String(error).slice(0,1800));
  console.error(String(error.stack ?? '').split('\n').slice(1).filter(line => line.length < 500).join('\n'));
  process.exitCode=1;
});
const nativeSource=Object.getOwnPropertyDescriptor(Image.prototype,'src');
const frames=[],handlers={},storage=new Map(),loads=[],requested=[],errors=[];
let main,now=1800000000000,texts=[],bodyBlits=0;
function canvas(){
  const c=createCanvas(1,1),ctx=c.getContext('2d');main??=c;
  const text=ctx.fillText.bind(ctx),draw=ctx.drawImage.bind(ctx);
  ctx.fillText=(value,x,y,...rest)=>{
    if(c===main){const m=ctx.getTransform();texts.push({value:String(value),x:(m.a*x+m.c*y+m.e)/2,y:(m.b*x+m.d*y+m.f)/2});}
    return text(value,x,y,...rest);
  };
  ctx.drawImage=(image,...args)=>{if(image?.width===128&&image.height===96)bodyBlits++;return draw(image,...args);};
  return c;
}
function image(){
  const img=new Image();let url='';
  Object.defineProperty(img,'src',{get:()=>url,set(value){
    url=String(value);requested.push(url);
    const relative=url.startsWith('https://cdn.example.com/pixel-frontline/')?
      'minigame-cdn/'+url.slice('https://cdn.example.com/pixel-frontline/'.length):'minigame/'+url.replace(/^\//,'');
    const oldLoad=img.onload,oldError=img.onerror;
    loads.push(new Promise((done,fail)=>{
      img.onload=()=>{oldLoad?.();done();};img.onerror=e=>{oldError?.(e);fail(e);};
      try{nativeSource.set.call(img,readFileSync(resolve(relative)));}catch(e){fail(e);}
    }));
  }});return img;
}
const sandbox={console:{...console,error:(...a)=>errors.push(a.map(String).join(' '))},
  Date:class extends Date{static now(){return now;}},setTimeout,clearTimeout,setInterval,clearInterval,
  requestAnimationFrame:fn=>{frames.push(fn);return frames.length;},cancelAnimationFrame(){},
  fetch:async()=>({ok:false,status:404,arrayBuffer:async()=>new ArrayBuffer(0)}),
  tt:{createCanvas:canvas,createImage:image,getSystemInfoSync:()=>({windowWidth:960,windowHeight:540,pixelRatio:2}),
    loadFont:()=>null,getStorageSync:k=>storage.get(k)??'',setStorageSync:(k,v)=>storage.set(k,v),removeStorageSync:k=>storage.delete(k),
    onTouchStart:fn=>handlers.down=fn,onTouchMove:fn=>handlers.move=fn,onTouchEnd:fn=>handlers.up=fn,
    onTouchCancel:fn=>handlers.cancel=fn,onHide:fn=>handlers.hide=fn,onShow:fn=>handlers.show=fn,onWindowResize(){}}};
vm.runInContext(readFileSync('minigame/game.js','utf8'),vm.createContext(sandbox),{timeout:10000});
async function imagesReady(){let count=-1;while(count!==loads.length){count=loads.length;await Promise.all(loads);await new Promise(setImmediate);}}
function frame(dt=1000/30){now+=dt;texts=[];assert.equal(frames.length,1);frames.shift()();}
function touch(type,x,y){const p={identifier:1,clientX:x,clientY:y};handlers[type]({changedTouches:[p],touches:type==='up'?[]:[p]});}
function tapText(label){const item=texts.find(t=>t.value===label);assert(item,`missing ${label}; visible ${texts.map(t=>t.value).join('|')}`);
  touch('down',item.x,item.y);touch('up',item.x,item.y);}
await imagesReady();frame();tapText('开始游戏');await imagesReady();frame();tapText('开始作战');frame();
assert(!texts.some(t=>t.value==='资源加载中…'||t.value==='开始作战'));
const out=mkdtempSync(join(tmpdir(),'greyline-native-battle-'));
for(let i=0;i<600;i++)frame();
const soldierNames=new Set(Object.values(CARDS).filter(c=>c.members&&c.cost<=5&&!c.deployDraw).map(c=>c.name));
const card=texts.filter(t=>soldierNames.has(t.value)&&t.y>360).sort((a,b)=>b.x-a.x)[0];
assert(card,'initial native hand must expose an affordable soldier');
touch('down',card.x,card.y);touch('move',card.x,250);touch('up',card.x,250);frame();
assert(texts.some(t=>t.value==='战术手牌 5/6'),'successful deployment must consume a hand card');
assert(texts.some(t=>/^在场部队 [1-9]\d*$/.test(t.value)),'successful deployment must put soldiers on the field');
for(let i=0;i<240;i++)frame();
writeFileSync(join(out,'battle.png'),main.toBuffer('image/png'));
assert(bodyBlits>100,'loaded battle never drew the unified soldier body');
assert(requested.some(p=>p.endsWith('/soldier-parts-v178.webp')));
assert(requested.some(p=>p.endsWith('/soldier-equipment-v178.webp')));
handlers.hide();for(let i=0;i<4;i++)frame();
assert(texts.some(t=>t.value.includes('暂停')),'app background did not pause within the 90ms UI snapshot interval');
assert.equal(errors.length,0,errors.join('\n'));
const report={out,images:requested.length,bodyBlits,deployed:card.value,localAssetSubstitution:true,
  realDouyinDevice:false,realCdn:false,errors};
writeFileSync(join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
