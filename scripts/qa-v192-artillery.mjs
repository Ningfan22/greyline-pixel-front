import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { writeFileSync } from 'node:fs';
const { createCanvas, Image } = createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document = { createElement: () => createCanvas(1, 1) };
globalThis.Image = class extends Image {
  set src(value) {
    super.src = value.startsWith('/')
      ? fileURLToPath(new URL('../public' + value, import.meta.url))
      : value;
  }
  get src() { return super.src; }
};
const { loadArt } = await import('../game/art.ts');
const { render } = await import('../game/render.ts');
const { createGame, startGame, spawnUnit, refreshVision, H } = await import('../game/engine.ts');
const art = await loadArt();
const canvas = createCanvas(1280, H);
const s = createGame(192);
startGame(s);
s.units = [];
s.scenery = [];
s.walls = [];
s.weather.disabled = true;
s.terrain.fill(374);
s.original.fill(374);
for (const [id, x] of [['field_gun', 310], ['siege_gun', 490], ['artillery', 670]])
  spawnUnit(s, 0, id, x);
s.time = 10;
refreshVision(s);
render(canvas.getContext('2d'), s, art, null, null, true, 0, 1280);
const path = '/tmp/greyline-v192-artillery.png';
writeFileSync(path, canvas.toBuffer('image/png'));
console.log(path);
