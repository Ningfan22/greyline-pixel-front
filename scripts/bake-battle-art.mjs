/** Precompute existing sprite extraction at release time. No artwork is generated.
 * Run with the project's TS loader and the bundled @napi-rs/canvas + sharp. */
import {createRequire} from 'node:module';
import {readFileSync, writeFileSync, mkdirSync, statSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {BATTLE_ART_COMPILER_INPUTS} from './battle-art-bake-inputs.mjs';

const require = createRequire(import.meta.url);
const {createCanvas, Image} = require('@napi-rs/canvas');
const sharp = require('sharp');
const root = fileURLToPath(new URL('..', import.meta.url));
const output = resolve(root, 'public/art/v204-battle');
mkdirSync(output, {recursive: true});
const requests = new Set();
let canvasesCreated = 0;
globalThis.document = {createElement: () => {canvasesCreated++; return createCanvas(1, 1);}};
globalThis.Image = class extends Image {
  set src(path) {this.logicalSource = path; requests.add(path); super.src = resolve(root, 'public' + path);}
  get src() {return this.logicalSource;}
};
const {compileSharedBattleArt, unitSize} = await import('../game/art.ts');
const {TERRAIN_TEXTURE_WIDTH, TERRAIN_TEXTURE_HEIGHT} = await import('../game/terrain-render.ts');
const {loadMapBackground} = await import('../game/art-v16.ts');
const {MAPS} = await import('../game/maps.ts');
const start = performance.now();
const shared = await compileSharedBattleArt(true);
const compileMs = performance.now() - start;
// These full-size images previously went through the same nearest-neighbour
// draw on every frame. Bake their actual world pixels once, not the source art.
function worldFrame(image, width, height, source) {
  const out = createCanvas(width, height), ctx = out.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  if (source) ctx.drawImage(image, ...source, 0, 0, width, height);
  else ctx.drawImage(image, 0, 0, width, height);
  return out;
}
shared.generatedSprites = Object.fromEntries(Object.entries(shared.generatedSprites).map(([id, image]) => [id, worldFrame(image, ...unitSize(id))]));
shared.terrain = worldFrame(shared.terrain, TERRAIN_TEXTURE_WIDTH, TERRAIN_TEXTURE_HEIGHT);
shared.ammoCrateFrame = worldFrame(shared.ammoCrate, 56, 25, [80, 230, 1385, 610]);
delete shared.ammoCrate;
const canvases = [], external = new Map(), seen = new Map();
function encode(value) {
  if (value === null || typeof value !== 'object') return value;
  if (seen.has(value)) return seen.get(value);
  if (value.getContext) {
    const index = canvases.length, encoded = {$frame: index};
    canvases.push(value); seen.set(value, encoded); return encoded;
  }
  if (value instanceof Image) {
    external.set(value.src, value);
    return {$image: value.src};
  }
  if (value instanceof Map) {
    if (value.size) throw new Error('Runtime cache was populated while baking');
    return {$map: true};
  }
  if (Array.isArray(value)) return value.map(encode);
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, encode(entry)]));
}
const graph = encode(shared);
const frameRects = new Array(canvases.length);
const atlases = [];
// Shelves cap decoded image memory to 16 MB per atlas. Each cel is copied at
// its exact compiled size, with no filtering, resizing or palette conversion.
const sorted = canvases.map((canvas, index) => ({canvas, index})).sort((a, b) => b.canvas.height - a.canvas.height);
let page, x = 0, y = 0, shelfHeight = 0;
for (const {canvas, index} of sorted) {
  if (canvas.width > 2048 || canvas.height > 2048) throw new Error('Unexpected huge runtime cel');
  if (!page || y + canvas.height > 2048) {
    page = {items: [], height: 0}; atlases.push(page); x = 0; y = 0; shelfHeight = 0;
  }
  if (x + canvas.width > 2048) {y += shelfHeight; x = 0; shelfHeight = 0;}
  if (y + canvas.height > 2048) {
    page = {items: [], height: 0}; atlases.push(page); x = 0; y = 0; shelfHeight = 0;
  }
  frameRects[index] = [atlases.length - 1, x, y, canvas.width, canvas.height];
  page.items.push({canvas, x, y});
  shelfHeight = Math.max(shelfHeight, canvas.height); page.height = Math.max(page.height, y + canvas.height);
  x += canvas.width;
}
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const files = [];
for (const [index, atlas] of atlases.entries()) {
  const raw = Buffer.alloc(2048 * atlas.height * 4);
  for (const {canvas, x, y} of atlas.items) {
    const pixels = Buffer.from(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data);
    for (let row = 0; row < canvas.height; row++) pixels.copy(raw, ((y + row) * 2048 + x) * 4, row * canvas.width * 4, (row + 1) * canvas.width * 4);
  }
  // WebP decoders premultiply semi-transparent colours with a downward bias.
  // PNG keeps the existing canvas pixels stable across this second decode.
  const encoded = await sharp(raw, {raw: {width: 2048, height: atlas.height, channels: 4}}).png({compressionLevel: 9}).toBuffer();
  const decoded = await sharp(encoded).ensureAlpha().raw().toBuffer();
  if (!decoded.equals(raw)) throw new Error('Lossless atlas pixel mismatch');
  const name = `frames-${index}-${digest(encoded).slice(0, 12)}.png`;
  writeFileSync(resolve(output, name), encoded);
  files.push({path: '/art/v204-battle/' + name, bytes: encoded.length, width: 2048, height: atlas.height, sha256: digest(encoded), rgbaSha256: digest(raw)});
}
const backgrounds = {};
for (const id of Object.keys(MAPS)) {
  const canvas = await loadMapBackground(id, false);
  const raw = Buffer.from(canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data);
  const encoded = await sharp(raw, {raw: {width: canvas.width, height: canvas.height, channels: 4}}).webp({lossless: true, exact: true, effort: 6}).toBuffer();
  const name = `map-${id}-${digest(encoded).slice(0, 12)}.webp`;
  writeFileSync(resolve(output, name), encoded);
  backgrounds[id] = {path: '/art/v204-battle/' + name, bytes: encoded.length, width: canvas.width, height: canvas.height, sha256: digest(encoded), rgbaSha256: digest(raw)};
}
const manifest = {version: 204, atlases: files, frames: frameRects, external: [...external.keys()], graph, backgrounds};
writeFileSync(resolve(root, 'game/battle-art-baked-data.ts'), '// Generated by scripts/bake-battle-art.mjs; exact compiled artwork, no source art changes.\nexport const BAKED_BATTLE_ART = ' + JSON.stringify(manifest) + ';\n');
const sourceFiles = [...requests].map(path => ({path, bytes: statSync(resolve(root, 'public' + path)).size, sha256: digest(readFileSync(resolve(root, 'public' + path)))}));
const compactProvenance = JSON.parse(readFileSync(resolve(root, 'public/art/v201-lossless/provenance.json'), 'utf8'));
const originalSources = compactProvenance.entries.filter(entry => requests.has(entry.compact)).map(entry => {
  const actual = digest(readFileSync(resolve(root, 'public' + entry.source)));
  if (actual !== entry.sourceSha256) throw new Error('源图片的无损副本已过期，请先运行 scripts/prepare-v201-lossless-art.mjs: ' + entry.source);
  return {path: entry.source, sha256: actual};
});
const compilerSources = BATTLE_ART_COMPILER_INPUTS.map(path => ({path, sha256: digest(readFileSync(resolve(root, path)))}));
const dataFile = {path: 'game/battle-art-baked-data.ts', sha256: digest(readFileSync(resolve(root, 'game/battle-art-baked-data.ts')))};
const provenance = {version: 204, compiler: 'Existing battle sprite extraction + @napi-rs/canvas ' + require('@napi-rs/canvas/package.json').version,
  encoder: 'sharp ' + sharp.versions.sharp, format: 'Lossless PNG sprite atlases and opaque WebP backdrops, exact final canvas RGBA, no resampling', compileMs, canvasesCreated,
  frames: canvases.length, compilerSources, sourceFiles, originalSources, dataFile, atlasFiles: files, external: [...external.keys()], backgrounds,
  sharedBytes: files.reduce((sum, f) => sum + f.bytes, 0) + [...external.keys()].reduce((sum, path) => sum + statSync(resolve(root, 'public' + path)).size, 0)};
writeFileSync(resolve(output, 'provenance.json'), JSON.stringify(provenance, null, 2) + '\n');
console.log(JSON.stringify({compileMs, canvasesCreated, frames: canvases.length, atlases: files, external: [...external.keys()], sharedBytes: provenance.sharedBytes, backgrounds}, null, 2));
