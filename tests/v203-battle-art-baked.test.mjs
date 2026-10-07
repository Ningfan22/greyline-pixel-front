import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {statSync} from 'node:fs';
const {createCanvas, Image} = createRequire(import.meta.url)('@napi-rs/canvas');
const requests = [], failures = new Set();
const firstContexts=new WeakMap();
globalThis.document = {createElement: () => {const canvas=createCanvas(1,1),original=canvas.getContext.bind(canvas);canvas.getContext=(type,options)=>{if(!firstContexts.has(canvas))firstContexts.set(canvas,options);return original(type,options);};return canvas;}};
globalThis.Image = class extends Image {
  set src(path) {
    requests.push(path);
    if (failures.delete(path)) {queueMicrotask(() => this.onerror?.(new Error('temporary atlas failure'))); return;}
    super.src = fileURLToPath(new URL('../public' + path, import.meta.url));
  }
  get src() {return super.src;}
};
const {BAKED_BATTLE_ART} = await import('../game/battle-art-baked-data.ts');
const {loadBakedBattleArt, watchBattleArtProgress} = await import('../game/battle-art-baked.ts');
const {compileSharedBattleArt, unitSize} = await import('../game/art.ts');
const {TERRAIN_TEXTURE_WIDTH, TERRAIN_TEXTURE_HEIGHT} = await import('../game/terrain-render.ts');
function worldFrame(image, width, height, source) {
  const out = createCanvas(width, height), ctx = out.getContext('2d'); ctx.imageSmoothingEnabled = false;
  if (source) ctx.drawImage(image, ...source, 0, 0, width, height);
  else ctx.drawImage(image, 0, 0, width, height);
  return out;
}
function pixels(frame) {return Buffer.from(frame.getContext('2d').getImageData(0, 0, frame.width, frame.height).data);}

test('baked load retries only a failed atlas and preserves every final source pixel', async t => {
  const stages = [], stop = watchBattleArtProgress(p => stages.push({...p}));
  const failedPath = BAKED_BATTLE_ART.atlases[1].path;
  failures.add(failedPath);
  await assert.rejects(loadBakedBattleArt(), /无法加载/);
  const start = performance.now();
  const baked = await loadBakedBattleArt();
  const restoreMs = performance.now() - start;
  for(const parts of Object.values(baked.soldiers.bodies))for(const frame of Object.values(parts))assert.equal(firstContexts.get(frame)?.willReadFrequently,true,'baked body pieces must match original CPU compositor sources');
  for(const frame of Object.values(baked.soldiers.equipment))assert.equal(firstContexts.get(frame)?.willReadFrequently,true);
  assert(!firstContexts.get(baked.vehicles[0][0])?.willReadFrequently,'vehicle imagery keeps its GPU drawing path');
  stop();
  assert.equal(requests.filter(path => path === BAKED_BATTLE_ART.atlases[0].path).length, 1);
  assert.equal(requests.filter(path => path === failedPath).length, 2);
  assert(stages.some(p => p.stage === 'download'));
  assert(stages.some(p => p.stage === 'prepare'));
  assert.equal(stages.at(-1).stage, 'ready');
  assert(stages.at(-1).completed === stages.at(-1).total);
  const bakedBytes = [...new Set(requests)].reduce((sum, path) => sum + statSync(fileURLToPath(new URL('../public' + path, import.meta.url))).size, 0);
  requests.length = 0;
  const compileStart = performance.now();
  const compiled = await compileSharedBattleArt(true);
  const compileMs = performance.now() - compileStart;
  const sourceBytes = [...new Set(requests)].reduce((sum, path) => sum + statSync(fileURLToPath(new URL('../public' + path, import.meta.url))).size, 0);
  compiled.generatedSprites = Object.fromEntries(Object.entries(compiled.generatedSprites).map(([id, image]) => [id, worldFrame(image, ...unitSize(id))]));
  compiled.terrain = worldFrame(compiled.terrain, TERRAIN_TEXTURE_WIDTH, TERRAIN_TEXTURE_HEIGHT);
  compiled.ammoCrateFrame = worldFrame(compiled.ammoCrate, 56, 25, [80, 230, 1385, 610]);
  delete compiled.ammoCrate;
  let checked = 0;
  function compare(a, b, path) {
    if (a?.getContext) {
      assert(b?.getContext, path); assert.deepEqual([b.width, b.height], [a.width, a.height], path);
      const before = pixels(a), after = pixels(b);
      if (!before.equals(after)) {
        const differences = []; let count = 0, max = 0;
        for (let i = 0; i < before.length; i++) if (before[i] !== after[i]) {count++; max = Math.max(max, Math.abs(before[i] - after[i])); if (differences.length < 10) differences.push([i, before[i], after[i], before[Math.floor(i / 4) * 4 + 3]]);}
        assert.fail(`Changed final pixels: ${path} ${JSON.stringify({count, max, differences})}`);
      }
      checked++; return;
    }
    if (a instanceof Map) {assert(b instanceof Map, path); assert.equal(b.size, 0); return;}
    if (a !== null && typeof a === 'object') {
      assert.deepEqual(Object.keys(b), Object.keys(a), path);
      for (const key of Object.keys(a)) compare(a[key], b[key], path + '.' + key);
    } else assert.equal(b, a, path);
  }
  compare(compiled, baked, 'art');
  assert(checked > 400);
  assert(bakedBytes < sourceBytes * .15, `source ${sourceBytes}, baked ${bakedBytes}`);
  t.diagnostic(JSON.stringify({checked, sourceBytes, bakedBytes, sourceImages: requests.length, bakedImages: BAKED_BATTLE_ART.atlases.length, compileMs, restoreMs}));
});
