import assert from 'node:assert/strict';
import test from 'node:test';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {createGame,spawnUnit} from '../game/engine.ts';
import {adultFrameChoice} from '../game/adult-animation.ts';
import {adultAtlas} from '../game/adult-atlas.ts';
import {loadArt} from '../game/art.ts';
import {specialistSprite} from '../game/adult-specialists.ts';
import {specialistBodyOffset} from '../game/weapon-pose-data.ts';
const {createCanvas,Image,loadImage}=createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document={createElement:()=>createCanvas(1,1)};
globalThis.Image=class extends Image{
  set src(v){super.src=v.startsWith('/')?fileURLToPath(new URL('../public'+v,import.meta.url)):v;}
  get src(){return super.src;}
};
const art=await loadArt();
const pixels=f=>f.getContext('2d').getImageData(0,0,f.width,f.height).data;
const hash=f=>createHash('sha256').update(pixels(f)).digest('hex');
function bounds(f){const d=pixels(f);let top=f.height,bottom=-1;
  for(let y=0;y<f.height;y++)for(let x=0;x<f.width;x++)if(d[(y*f.width+x)*4+3]>=160){top=Math.min(top,y);bottom=Math.max(bottom,y);}
  return {top,bottom,height:bottom-top+1};}
function soldier(extra={}){const s=createGame(167);spawnUnit(s,0,'infantry',1000,{member:0});
  return Object.assign(s.units[0],{pose:'prone',poseAnimSeen:'prone',motion:'ground',moving:true,walk:0,
    fire:0,flash:0,secondaryFire:0,fragThrow:0,aimUntil:0,...extra});}

test('the production loader preserves two original matching crawl drawings through settled-pose replacement',async()=>{
  for(const id of ['infantry','marines','police','militia']){
    const raw=adultAtlas(await loadImage(fileURLToPath(new URL(`../public/art/adult-${id}-v13.png`,import.meta.url)))),adult=art.adults[id];
    assert.equal(adult.crawl2.length,2);assert.equal(hash(adult.crawl2[0]),hash(raw.actions20[2]));
    assert.equal(hash(adult.crawl2[1]),hash(raw.actions20[12]));assert.notEqual(hash(adult.crawl2[0]),hash(adult.crawl2[1]),'do not freeze the gait');
    assert.equal(adult.actions20[2],adult.stance16[15],'settled posture must keep its new endpoint');
    assert.notEqual(adult.crawl2[0],adult.actions20[2]);
    const h=adult.crawl2.map(bounds);assert(h.every(b=>b.bottom===95));
    assert(Math.abs(h[0].height-h[1].height)<=1,`${id}: no 6–8px whole-body height pulse`);
    assert(bounds(adult.actions20[2]).height<h[0].height-4,'fixture really exercises incompatible settled/crawl bodies');
  }
});

test('healthy travel, bank traversal and crawling casualties use the dedicated pair, never the settled body',()=>{
  for(const extra of [{},{motion:'bank'},{wounded:true,crawling:true}]){
    const u=soldier(extra),indices=new Set();
    for(let i=0;i<96;i++){u.walk=i/8;const before=JSON.stringify(u),f=adultFrameChoice(u,10+i/60);
      assert.equal(f.group,'crawl2');assert([0,1].includes(f.index));indices.add(f.index);
      assert.equal(JSON.stringify(u),before,'drawing must not change clocks or stance');}
    assert.equal(indices.size,2);
  }
});

test('crawl phase remains distance-driven, while ordinary resting, work and transitions retain their own cels',()=>{
  const u=soldier({walk:2.4});for(let t=0;t<120;t++)assert.deepEqual(adultFrameChoice(u,t),{group:'crawl2',index:1});
  for(const [patch,group]of [[{moving:false},'actions20'],[{moving:false,ammo:0,reloadingStartAt:0,reloadingUntil:20},'lowReload16'],
    [{poseAnimFrom:'stand',poseAnimAt:9,poseAnimSeen:'prone'},'stance16'],[{rappelling:true},'actions20'],
    [{surrendered:true,surrenderTime:3},'reactions8'],[{wounded:true,woundedTime:3,crawling:false},'actions20']]){
    const f=adultFrameChoice(soldier(patch),10);assert.equal(f.group,group,JSON.stringify(patch));
  }
});

test('specialist crawling retains its weapon, cached composition and existing ballistic landmarks',()=>{
  for(const [id,role]of [['rocket','rocket'],['sniper','sniper'],['lmg_team','machinegun'],['medic_team','medic']]){
    const s=createGame(167);spawnUnit(s,0,id,1000,{member:0});const u=Object.assign(s.units[0],{pose:'prone',moving:true});
    const set=art.weaponStances?.[role]??art.adultSpecialists[role];
    for(let i=0;i<2;i++){
      const choice={group:'crawl2',index:i},base=art.adults.infantry.crawl2[i],sprite=specialistSprite(base,choice,u,art.adultSpecialists,art.weaponStances);
      assert(sprite?.muzzle,`${id}/${i}: retain specialist barrel`);
      assert.equal(specialistSprite(base,choice,u,art.adultSpecialists,art.weaponStances),sprite,'no per-frame composition');
      assert.deepEqual(specialistBodyOffset('crawl2',i,set.prone),specialistBodyOffset('actions20',i?12:2,set.prone));
    }
  }
});
