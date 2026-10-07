/** Responsive derivatives of existing image-generated card art, never new artwork. */
import { createRequire } from 'node:module';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import { CARDS } from '../game/cards.ts';
import { cardPicturePath } from '../game/card-picture-path.ts';
import { VEHICLE_CROPS_V223 } from '../game/vehicle-art-v223.ts';
const sharp = createRequire(import.meta.url)('sharp'),
  root = fileURLToPath(new URL('..', import.meta.url));
const folder = resolve(root, 'public/art/v204-cards');
mkdirSync(folder, { recursive: true });
const hash = (b) => createHash('sha256').update(b).digest('hex');
const paths = [
  ...new Set([
    ...Object.keys(CARDS)
      .filter((id) => !CARDS[id].internal)
      .map(cardPicturePath),
    ...['frame', 'frame-rare', 'frame-epic', 'frame-legendary'].map(
      (id) => `/art/cards-v10/${id}.webp`,
    ),
  ]),
];
const variants = {},
  entries = [];
for (const path of paths) {
  const original = readFileSync(resolve(root, 'public' + path)),
    stem = path.split('/').at(-1).replace(/\.(webp|png)$/, '');
  variants[path] = [];
  const vehicleId = path.startsWith('/art/v223-vehicles/') ? stem : null,
    crop = vehicleId ? VEHICLE_CROPS_V223[vehicleId] : null;
  for (const width of [384, 640]) {
    let picture = sharp(original);
    if (crop) picture = picture.extract({ left: crop[0], top: crop[1], width: crop[2], height: crop[3] });
    const encoded = await picture
      .resize({ width, withoutEnlargement: true, kernel: 'nearest' })
      .webp({ quality: 85, alphaQuality: 100, effort: 6 })
      .toBuffer();
    const file = `${stem}-${width}-${hash(encoded).slice(0, 12)}.webp`;
    writeFileSync(resolve(folder, file), encoded);
    const actual = await sharp(encoded).metadata();
    variants[path].push({
      path: '/art/v204-cards/' + file,
      width: actual.width,
    });
    entries.push({
      source: path,
      sourceSha256: hash(original),
      sourceBytes: original.length,
      ...(crop ? { sourceCrop: crop } : {}),
      path: '/art/v204-cards/' + file,
      width: actual.width,
      height: actual.height,
      bytes: encoded.length,
      sha256: hash(encoded),
    });
  }
}
writeFileSync(
  resolve(root, 'game/card-image-data.ts'),
  '// Existing card artwork resized offline for display sizes.\nexport const CARD_IMAGE_VARIANTS=' +
    JSON.stringify(variants) +
    ';\n',
);
writeFileSync(
  resolve(folder, 'provenance.json'),
  JSON.stringify(
    {
      version: 204,
      encoder: 'sharp ' + sharp.versions.sharp,
      mode: 'nearest-neighbour resizing + WebP encoding of existing image-generated artwork',
      entries,
    },
    null,
    2,
  ) + '\n',
);
console.log(
  JSON.stringify({
    sources: paths.length,
    originalBytes: entries
      .filter((e) => e.width === 384)
      .reduce((s, e) => s + e.sourceBytes, 0),
    smallBytes: entries
      .filter((e) => e.width === 384)
      .reduce((s, e) => s + e.bytes, 0),
    largeBytes: entries
      .filter((e) => e.width === 640)
      .reduce((s, e) => s + e.bytes, 0),
  }),
);
