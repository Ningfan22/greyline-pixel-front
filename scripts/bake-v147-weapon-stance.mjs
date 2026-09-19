// Deterministic asset packing, not new artwork: same calibrated RGBA cels
// consumed by the runtime, packed without further resizing or repainting.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import {
  weaponStanceAtlas,
  LOWER_WEAPON_CELS,
} from '../game/weapon-stance-art.ts';
const { createCanvas, loadImage } = createRequire(import.meta.url)(
  '@napi-rs/canvas',
);
globalThis.document = { createElement: () => createCanvas(1, 1) };
const lower = await loadImage(
  new URL('../public/art/weapon-lowering-v147.png', import.meta.url).pathname,
);
const atlas = createCanvas(16 * 128, 3 * 96),
  ctx = atlas.getContext('2d');
ctx.imageSmoothingEnabled = false;
for (const [row, role] of ['machinegun', 'rocket', 'sniper'].entries()) {
  const source = await loadImage(
    new URL(`../public/art/${role}-stance-v147.png`, import.meta.url).pathname,
  );
  const frames = weaponStanceAtlas(
    source,
    lower,
    role,
    LOWER_WEAPON_CELS[role],
  );
  frames.stance16.forEach((frame, col) =>
    ctx.drawImage(frame.image, col * 128, row * 96),
  );
}
const output = new URL(
  '../public/art/weapon-stance-frames-v147.png',
  import.meta.url,
);
const data = atlas.toBuffer('image/png');
writeFileSync(output, data);
console.log(
  JSON.stringify({
    output: output.pathname,
    bytes: data.length,
    width: atlas.width,
    height: atlas.height,
  }),
);
