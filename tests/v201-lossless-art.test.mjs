import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {BATTLE_LOSSLESS_ART} from '../game/battle-art-assets.ts';
import {loadArtImage} from '../game/battle-art-loader.ts';

const sharp = createRequire(import.meta.url)('sharp');
const root = new URL('..', import.meta.url);
const readAsset = path => readFileSync(new URL(`public${path}`, root));
const hash = data => createHash('sha256').update(data).digest('hex');
const provenance = JSON.parse(readAsset('/art/v201-lossless/provenance.json'));

test('every served compact image preserves dimensions and all original RGBA bytes, including transparent RGB', async () => {
  assert.equal(provenance.options.lossless, true);
  assert.equal(provenance.options.exact, true);
  assert.equal(Object.keys(BATTLE_LOSSLESS_ART).length, provenance.entries.length);
  let saving = 0;
  for (const entry of provenance.entries) {
    const png = readAsset(entry.source), webp = readAsset(entry.compact);
    const before = await sharp(png).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    const after = await sharp(webp).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    assert.deepEqual(after.info, before.info, `${entry.source}: no dimension/channel changes`);
    assert(after.data.equals(before.data), `${entry.source}: exact decoded RGBA`);
    assert.equal(hash(png), entry.sourceSha256);
    assert.equal(hash(webp), entry.compactSha256);
    assert.equal(hash(before.data), entry.rgbaSha256);
    assert.equal(BATTLE_LOSSLESS_ART[entry.source], entry.compact);
    assert(webp.length < png.length * .9, `${entry.source}: only material savings are shipped`);
    if (!entry.source.includes('/v16-maps/')) saving += png.length-webp.length;
  }
  assert(saving > 13_000_000);
});

test('only opted-in web battles use compact images, with one original-PNG fallback on failure', async () => {
  const source = '/art/support-vehicles-v14.png', compact = BATTLE_LOSSLESS_ART[source];
  const requests = [], failures = new Set();
  globalThis.Image = class {
    set src(path) {
      requests.push(path);
      queueMicrotask(() => failures.has(path) ? this.onerror?.() : this.onload?.());
    }
  };
  await loadArtImage(source);
  assert.deepEqual(requests.splice(0), [source], 'legacy callers keep their PNG');
  await loadArtImage(source, true);
  assert.deepEqual(requests.splice(0), [compact]);
  failures.add(compact);
  await loadArtImage(source, true);
  assert.deepEqual(requests.splice(0), [compact, source]);
  failures.add(source);
  await assert.rejects(loadArtImage(source, true), /support-vehicles/);
  assert.deepEqual(requests.splice(0), [compact, source], 'do not loop or try alternate asset families');
  failures.clear();
  globalThis.__ART_CDN_BASE__ = 'https://example.invalid/game/';
  try {
    await loadArtImage(source, true);
    assert.deepEqual(requests.splice(0), ['https://example.invalid/game/art/support-vehicles-v14.webp']);
  } finally { delete globalThis.__ART_CDN_BASE__; }
});

test('a cold legacy/minigame load never requests the new web-only compact directory', () => {
  const script = `
    const paths=[];
    globalThis.Image=class {set src(path) {paths.push(path);queueMicrotask(()=>this.onerror?.());}};
    const {loadArt}=await import(${JSON.stringify(new URL('../game/art.ts', import.meta.url).href)});
    await loadArt().catch(()=>{});
    console.log(JSON.stringify(paths));
  `;
  const result = spawnSync(process.execPath, ['--experimental-strip-types', '--loader',
    fileURLToPath(new URL('../scripts/ts-loader.mjs', import.meta.url)), '--input-type=module', '-e', script],
    {encoding:'utf8'});
  assert.equal(result.status, 0, result.stderr);
  const paths = JSON.parse(result.stdout.trim());
  assert(paths.includes('/art/support-vehicles-v14.png'));
  assert(paths.includes('/art/battlefield-v3.png'));
  assert(!paths.some(path => path.includes('/v201-lossless/')));
});
