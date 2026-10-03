import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { statSync } from 'node:fs';

const { createCanvas, Image } = createRequire(import.meta.url)('@napi-rs/canvas');
const requests = [];
const failOnce = new Set();
let canvasCreates = 0;
globalThis.document = { createElement: () => {
  canvasCreates++;
  return createCanvas(1, 1);
} };
globalThis.Image = class extends Image {
  set src(path) {
    requests.push(path);
    if (failOnce.delete(path)) {
      queueMicrotask(() => this.onerror?.(new Error('simulated map failure')));
      return;
    }
    super.src = fileURLToPath(new URL(`../public${path}`, import.meta.url));
  }
  get src() { return super.src; }
};

const { loadBattleArt, loadArt, unitFrame, cardFrame } = await import('../game/art.ts');
const { loadV16Art, loadMapBackground } = await import('../game/art-v16.ts');
const { battleArtPath } = await import('../game/battle-art-loader.ts');
const { BATTLE_LOSSLESS_ART } = await import('../game/battle-art-assets.ts');
const { BAKED_BATTLE_ART } = await import('../game/battle-art-baked-data.ts');
const { CARDS } = await import('../game/cards.ts');
const { MAPS } = await import('../game/maps.ts');
const bytes = paths => [...new Set(paths)].reduce((sum, path) =>
  sum + statSync(fileURLToPath(new URL(`../public${path}`, import.meta.url))).size, 0);
const originalPaths = paths => paths.map(path =>
  Object.entries(BATTLE_LOSSLESS_ART).find(([, compact]) => path === compact)?.[0] ?? path);

// One native atlas load, no simulated match or large pose history. This tests
// actual asset selection, compilation, and cache ownership at the load boundary.
test('battle loading skips legacy bodies and unrelated maps, shares art, and recovers a failed backdrop', async t => {
  let battle;
  let initialRequests;
  let initialCanvases;
  await t.test('cold battle loads only the selected backdrop and current soldier system', async () => {
    const pending = loadBattleArt('greyline');
    assert.equal(loadBattleArt('greyline'), pending, 'concurrent mounts must share work');
    battle = await pending;
    initialRequests = [...requests];
    initialCanvases = canvasCreates;
    assert(battle.soldiers);
    for (const field of ['adults', 'patrol', 'digging', 'adultSpecialists', 'weaponStances', 'heavyMG', 'grenadeLauncher'])
      assert.equal(battle[field], undefined, `${field} has been replaced by the soldier rig`);
    assert.deepEqual(Object.keys(battle.mapBackgrounds), ['greyline']);
    assert.equal(battle.background, battle.mapBackgrounds.greyline);
    assert.deepEqual([battle.background.width, battle.background.height], [640, 214]);
    assert.equal(new Set(initialRequests).size, initialRequests.length);
    assert.equal(initialRequests.length, 3, 'two final sprite atlases plus the selected map');
    assert(bytes(initialRequests) < 6_000_000, 'entry must not download high-resolution source atlases');
    assert(!initialRequests.some(path => /adult-|v17-patrol|v18-dig|standing-reload|standing-grenade|heavy-mg|infantry-reload|weapon-stance|medical-work|low-grenade|repair-work|grenade-launcher|prone-watch|v16-maps/.test(path)));
    assert.equal(await loadBattleArt('greyline'), battle);
    assert.equal(requests.length, initialRequests.length);
    assert.equal(canvasCreates, initialCanvases);
  });

  await t.test('map changes add one backdrop and preserve all shared frame identities', async () => {
    const before = requests.length, canvases = canvasCreates;
    const jungle = await loadBattleArt('jungle');
    assert.deepEqual(requests.slice(before), [BAKED_BATTLE_ART.backgrounds.jungle.path]);
    assert.equal(canvasCreates, canvases + 1);
    assert.deepEqual([jungle.background.width, jungle.background.height], [720, 240]);
    assert.deepEqual(Object.keys(jungle.mapBackgrounds), ['jungle']);
    for (const field of ['soldiers', 'vehicles', 'mobileVehicles', 'aircraft', 'wrecks', 'buildings', 'paintedBlasts', 'trees', 'mines'])
      assert.equal(jungle[field], battle[field], `${field} should not be cut again for each map`);
    assert.equal(await loadMapBackground('jungle'), jungle.background);
  });

  await t.test('a failed map retries without rebuilding successful common artwork', async () => {
    failOnce.add(BAKED_BATTLE_ART.backgrounds.desert.path);
    const before = requests.length, canvases = canvasCreates;
    const failed = loadBattleArt('desert');
    assert.equal(loadBattleArt('desert'), failed);
    await assert.rejects(failed, /desert/);
    const retried = loadBattleArt('desert');
    assert.notEqual(retried, failed);
    const desert = await retried;
    assert.deepEqual(requests.slice(before), [BAKED_BATTLE_ART.backgrounds.desert.path,
      BAKED_BATTLE_ART.backgrounds.desert.path]);
    assert.equal(canvasCreates, canvases + 1);
    assert.equal(desert.soldiers, battle.soldiers);
  });

  await t.test('legacy loader still supplies all old selectors using the same current art', async () => {
    const before = canvasCreates;
    const legacy = await loadArt();
    const legacyExtraCanvases = canvasCreates - before;
    assert.equal(await loadArt(), legacy);
    assert.equal(legacy.soldiers, battle.soldiers);
    assert.equal(legacy.background, battle.background);
    for (const id of ['infantry', 'marines', 'police', 'militia']) {
      assert.equal(legacy.adults[id].actions20.length, 20);
      assert.equal(legacy.patrol[id].raise3[2], legacy.adults[id].actions20[0]);
      assert.equal(legacy.digging[id].dig8.length, 8);
    }
    assert.deepEqual(Object.keys(legacy.mapBackgrounds).sort(), ['desert', 'jungle', 'mountains']);
    const v16 = await loadV16Art();
    assert.equal(v16.mapBackgrounds.jungle, legacy.mapBackgrounds.jungle);
    assert.deepEqual(v16.fpvFrames.map(f => [f.width, f.height]), battle.aircraft.fpv_drone.map(f => [f.width, f.height]));
    // The legacy cold path builds all three extra map canvases. Jungle/desert
    // were already cached above, so include them in the original-path total.
    const legacyColdCanvases = initialCanvases + legacyExtraCanvases + 2;
    t.diagnostic(JSON.stringify({
      battle: { files: initialRequests.length, bytes: bytes(initialRequests), canvases: initialCanvases },
      legacy: { files: new Set(originalPaths(requests)).size, bytes: bytes(originalPaths(requests)), canvases: legacyColdCanvases },
    }));
  });

  await t.test('unit/card fallback selectors remain usable without legacy infantry atlases', () => {
    for (const [id, card] of Object.entries(CARDS)) {
      if (!card.members) continue;
      const frame = unitFrame(battle, id);
      assert(frame?.width > 0 && frame.height > 0, id);
      assert.equal(unitFrame(battle, id), frame, `${id} preview should be cached`);
    }
    for (const index of [0, 1, 2, 3, 4, 10, 11, 12, 13])
      assert(cardFrame(battle, index)?.width > 0, `card atlas ${index}`);
  });
});
