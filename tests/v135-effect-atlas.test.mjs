import assert from 'node:assert/strict';
import test from 'node:test';
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { explosionAtlasV13, smokeAtlasV13, drawSmokePuff } from '../game/effect-atlas.ts';
import { standingReloadFrames } from '../game/adult-atlas.ts';
const { createCanvas, loadImage } = createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document = { createElement: () => createCanvas(1, 1) };
const source = createCanvas(1448, 1086);
source.getContext('2d').drawImage(await loadImage(new URL('../public/art/explosions-v13.png', import.meta.url).pathname), 0, 0);
const frames = explosionAtlasV13(source);
const smoke = smokeAtlasV13(source);
test('all 48 painted explosion frames survive extraction and share a ground anchor', () => {
  for (const [row, band] of frames.entries()) for (const [col, frame] of band.entries()) {
    const data = frame.getContext('2d').getImageData(0, 0, frame.width, frame.height).data;
    let opaque = 0, lastY = -1;
    for (let y = 0; y < frame.height; y++) {
      let rowCoverage = 0;
      for (let x = 0; x < frame.width; x++) if (data[(y * frame.width + x) * 4 + 3] > 80) {
        opaque++; rowCoverage++; lastY = y;
      }
      if (y < 15) assert(rowCoverage < 65, `leaked fire band row ${row} col ${col}`);
    }
    assert(opaque > 50, `empty or destroyed frame ${row}/${col}`);
    // The air-burst/smoke families float around a common centre; only fuel
    // and artillery families have a painted ground-contact baseline.
    assert(lastY >= (row < 4 ? 130 : 110) && lastY <= 143, `ground shifted ${row}/${col}: ${lastY}`);
  }
});
test('smoke uses the painted contour rather than rectangular particles', () => {
  const out = createCanvas(160, 160), c = out.getContext('2d');
  drawSmokePuff(c, smoke, 0.2, 80, 80, 120, '#44423c', 0.8);
  const data = c.getImageData(0, 0, 160, 160).data;
  let alpha = 0;
  for (let at = 3; at < data.length; at += 4) alpha += data[at] > 0;
  assert(alpha > 1000 && alpha < 120 * 120);
  assert.equal(c.globalAlpha, 1);
});
// Contact sheet for inspecting exactly the decoded frames used by the game.
const contact = createCanvas(8 * 144, 7 * 180), ctx = contact.getContext('2d');
ctx.fillStyle = '#8e9b98'; ctx.fillRect(0, 0, contact.width, contact.height);
frames.forEach((band, r) => band.forEach((frame, col) => {
  ctx.drawImage(frame, col * 144 + 24, r * 180 + 20);
  ctx.fillStyle = '#26312f'; ctx.font = '14px sans-serif';
  ctx.fillText(`${r}:${col}`, col * 144 + 12, r * 180 + 16);
}));
smoke.forEach((_, col) => drawSmokePuff(ctx, smoke, col / 8, col * 144 + 72, 6 * 180 + 80, 130, '#44423c', 0.85));
const output = join(mkdtempSync(join(tmpdir(), 'greyline-v135-')), 'effects.png');
writeFileSync(output, contact.toBuffer('image/png'));
console.log(`Effect contact sheet: ${output}`);

test('eight generated reload cels retain adult scale and a fixed boot baseline', async () => {
  const image = await loadImage(new URL('../public/art/standing-reload-v135.png', import.meta.url).pathname);
  const reload = standingReloadFrames(image);
  const out = createCanvas(8 * 120, 128), c = out.getContext('2d');
  c.fillStyle = '#84918a'; c.fillRect(0, 0, out.width, out.height);
  for (const [i, frame] of reload.entries()) {
    const d = frame.getContext('2d').getImageData(0, 0, 96, 96).data;
    let top = 96, bottom = 0;
    for (let y = 0; y < 96; y++) for (let x = 0; x < 96; x++)
      if (d[(y * 96 + x) * 4 + 3] > 80) { top = Math.min(top, y); bottom = Math.max(bottom, y); }
    assert(top >= 30 && top <= 34, `${i}: inconsistent head height ${top}`);
    assert(bottom >= 93 && bottom <= 95, `${i}: boot baseline ${bottom}`);
    c.drawImage(frame, i * 120 + 12, 15);
  }
  const file = join(mkdtempSync(join(tmpdir(), 'greyline-reload-')), 'reload.png');
  writeFileSync(file, out.toBuffer('image/png'));
  console.log(`Reload contact sheet: ${file}`);
});
