import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {CARDS} from '../game/cards.ts';import {cardPicturePath} from '../game/card-picture-path.ts';import {CARD_IMAGE_VARIANTS} from '../game/card-image-data.ts';
import {expansionGunLayout,expansionGunMount} from '../game/expansion-art-v227.ts';import {armorHalf,tankGeometry} from '../game/vehicle-geometry.ts';
const read=p=>readFileSync(new URL('../public'+p,import.meta.url));const hash=b=>createHash('sha256').update(b).digest('hex');
test('every catalog card has small display derivatives and retains its original illustration',()=>{
 const manifest=JSON.parse(read('/art/v204-cards/provenance.json'));const byPath=new Map(manifest.entries.map(e=>[e.path,e]));
 for(const [id,c] of Object.entries(CARDS)){if(c.internal)continue;const source=cardPicturePath(id),list=CARD_IMAGE_VARIANTS[source];assert(list?.length===3,id);assert.equal(list[0].width,192);assert.equal(list[1].width,320);
 for(const v of list){const e=byPath.get(v.path);assert(e);assert.equal(hash(read(e.path)),e.sha256);assert.equal(hash(read(source)),e.sourceSha256);}
 assert(byPath.get(list[0].path).bytes<25000,id+' thumbnail size');
 }
});
test('menu artwork is under 120KB and over 90 percent smaller than its authored PNG',()=>{const bytes=read('/art/v229-menu/home-camp-1280.webp').length;assert(bytes<120000);assert(bytes<read('/art/home-camp-v14.png').length*.1);});
for(const id of ['sp_howitzer_122','sp_howitzer_155'])test(id+' uses a compact hull and matching physical gun anchor',()=>{
 const a=expansionGunLayout(id),m=expansionGunMount(id);assert(a.bodyWidth<tankGeometry('tank').size[0]);assert(armorHalf(id)<armorHalf('tank'));assert.equal(a.pivotX,m.pivotX);assert.equal(a.pivotHeight,m.pivotHeight);assert.equal(a.barrelLength,m.barrelLength);assert(a.pivotHeight>a.bodyHeight*.6,'barrel meets upper front mantlet');
});
