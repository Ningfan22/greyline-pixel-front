import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { createCanvas, Image } = createRequire(import.meta.url)(
  '@napi-rs/canvas',
);
globalThis.document = { createElement: () => createCanvas(1, 1) };
globalThis.Image = class extends Image {
  set src(v) {
    super.src = v.startsWith('/')
      ? fileURLToPath(new URL('../public' + v, import.meta.url))
      : v;
  }
  get src() {
    return super.src;
  }
};
let active = null;
const expensive = [];
const proto = Object.getPrototypeOf(createCanvas(1, 1).getContext('2d'));
for (const method of [
  'drawImage',
  'fillRect',
  'fill',
  'stroke',
  'getImageData',
  'putImageData',
]) {
  const original = proto[method];
  proto[method] = function (...args) {
    if (!active) return original.apply(this, args);
    const start = performance.now(),
      result = original.apply(this, args),
      ms = performance.now() - start;
    if (ms > 4)
      expensive.push({
        ...active,
        method,
        ms,
        filter: this.filter,
        canvas: [this.canvas?.width, this.canvas?.height],
        source:
          method === 'drawImage'
            ? [args[0]?.width, args[0]?.height]
            : undefined,
        stack: new Error().stack.split('\n').slice(2, 6),
      });
    return result;
  };
}
const { loadArt } = await import('../game/art.ts');
const { render } = await import('../game/render.ts');
const { createGame, startGame, spawnUnit, tick, explode, ground, H, W } =
  await import('../game/engine.ts');
const { MAP_IDS } = await import('../game/maps.ts');
const art = await loadArt(),
  out = mkdtempSync(join(tmpdir(), 'greyline-v146-profile-'));
const canvas = createCanvas(1280, H),
  ctx = canvas.getContext('2d'),
  frames = [];
for (const map of MAP_IDS) {
  const s = createGame(145, undefined, undefined, map, { mapSeed: 145 });
  startGame(s);
  s.aiIn = 1e9;
  s.weather.disabled = true;
  const house = s.scenery.find(
      (p) => p.kind === 'house' && p.x > 600 && p.x < W - 600,
    ),
    x = house?.x ?? 1800;
  const camera = Math.max(0, Math.min(W - 1280, x - 500));
  for (let i = 0; i < 3; i++) {
    spawnUnit(s, 0, 'infantry', x - 320 - i * 50);
    spawnUnit(s, 1, 'infantry', x + 320 + i * 50);
  }
  spawnUnit(s, 0, 'tank', x - 140);
  spawnUnit(s, 1, 'tank', x + 140);
  for (let i = 0; i < 120; i++) {
    if (i === 0 || i === 80) {
      const hit = x + (i ? 140 : -140);
      explode(s, hit, ground(s, hit), 70, 1000, 0);
      s.blasts.at(-1).kind = i ? 'wreck' : 'artillery';
    }
    tick(s, 1 / 60);
    s.sight[0].fill(true);
    s.visible[0] = s.units.map((u) => u.uid);
    s.knownTerrain[0] = s.terrain.slice();
    s.knownScenery[0] = Object.fromEntries(
      s.scenery.map((p) => [p.id, structuredClone(p)]),
    );
    active = { map, frame: i };
    const at = performance.now();
    render(ctx, s, art, null, null, true, camera, 1280);
    frames.push({ ...active, ms: performance.now() - at });
    active = null;
    if ([0, 18, 80, 98, 119].includes(i))
      writeFileSync(join(out, `${map}-${i}.png`), canvas.toBuffer('image/png'));
  }
}
const sorted = frames.map((f) => f.ms).sort((a, b) => a - b);
const summary = {
  output: out,
  median: sorted[sorted.length >> 1],
  p95: sorted[Math.floor(sorted.length * 0.95)],
  p99: sorted[Math.floor(sorted.length * 0.99)],
  max: sorted.at(-1),
  frames,
  slowFrames: frames.filter((f) => f.ms > 16),
  expensive: expensive.sort((a, b) => b.ms - a.ms),
};
writeFileSync(join(out, 'profile.json'), JSON.stringify(summary, null, 2));
console.log(
  JSON.stringify({
    ...summary,
    frames: frames.filter((f) => f.frame === 0 || f.frame === 80),
  }),
);
