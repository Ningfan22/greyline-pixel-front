// Render the production pipeline with the shipped art, without browser globals.
// Run with --import ./ts-loader.mjs and @napi-rs/canvas on NODE_PATH.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { createCanvas, Image } = createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document = { createElement: () => createCanvas(1, 1) };
globalThis.Image = class extends Image {
  set src(value) {
    super.src = value.startsWith('/') ? fileURLToPath(new URL('../public' + value, import.meta.url)) : value;
  }
  get src() { return super.src; }
};
const { loadArt } = await import('../game/art.ts');
const { render } = await import('../game/render.ts');
const { createGame, startGame, spawnUnit, tick, explode, ground, H } = await import('../game/engine.ts');
const { adultFrameChoice } = await import('../game/adult-animation.ts');
const art = await loadArt();
const s = createGame(135, undefined, undefined, undefined, { mapSeed: 135 });
startGame(s);
s.aiIn = 1e9;
s.units = [];
for (const side of [0, 1]) {
  for (const [i, id] of ['infantry', 'medic_team', 'scouts', 'tank', 'militia', 'heavy_mg'].entries())
    spawnUnit(s, side, id, 1050 + side * 550 + (side ? 1 : -1) * i * 35);
}
const canvas = createCanvas(1280, H), ctx = canvas.getContext('2d');
const output = mkdtempSync(join(tmpdir(), 'greyline-v135-battle-'));
const costs = [];
let inspected = 0;
for (let i = 0; i < 720; i++) {
  if (i === 90 || i === 280) {
    explode(s, 1340, ground(s, 1340), 60, 150, 0);
    s.blasts.at(-1).kind = 'artillery';
  }
  const before = performance.now();
  tick(s, 1 / 60);
  costs.push(performance.now() - before);
  for (const u of s.units) {
    const frame = adultFrameChoice(u, s.time);
    if (frame.group === 'actions20' && [8, 9].includes(frame.index))
      assert(u.rappelling && !u.wounded && !u.surrendered, `unexpected climb ${u.id}/${u.uid}`);
    inspected++;
  }
  // Sample motion at 20fps as well as the recorded battle snapshots.
  if (i % 3 === 0) render(ctx, s, art, null, null, true, 740, 1280);
  if ([120, 300, 600].includes(i))
    writeFileSync(join(output, `battle-${i}.png`), canvas.toBuffer('image/png'));
}
costs.sort((a, b) => a - b);
console.log(JSON.stringify({ output, frames: 240, unitFramesInspected: inspected,
  tickMedianMs: costs[Math.floor(costs.length / 2)], tickP95Ms: costs[Math.floor(costs.length * 0.95)] }));
