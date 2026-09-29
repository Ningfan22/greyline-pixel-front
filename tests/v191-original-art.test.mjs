import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = fileURLToPath(new URL('../public/art/v190/', import.meta.url));
const deployedRoot = fileURLToPath(new URL('../docs/art/v190/', import.meta.url));
const cardIds = [
  'rapid_reinforcements', 'escort_gunship', 'field_gun',
  'siege_gun', 'fort_bunker', 'fort_machinegun', 'fort_aa', 'fort_spawn', 'fort_wire',
];
const spriteIds = [
  'escort_gunship', 'fort_bunker', 'fort_machinegun', 'fort_aa',
  'fort_spawn', 'fort_wire',
];

test('every new card and battlefield object ships distinct authored image data', () => {
  for (const [folder, ids] of [['cards', cardIds], ['sprites', spriteIds]]) {
    assert.deepEqual(readdirSync(root + folder).sort(), ids.map(id => `${id}.webp`).sort());
    const hashes = ids.map((id) => {
      const path = `${root}${folder}/${id}.webp`;
      assert(statSync(path).size > 50_000, `${id} contains substantial image data`);
      const bytes = readFileSync(path);
      assert.deepEqual(readFileSync(`${deployedRoot}${folder}/${id}.webp`), bytes,
        `${id} must be in the Pages release`);
      return createHash('sha256').update(bytes).digest('hex');
    });
    assert.equal(new Set(hashes).size, ids.length, `${folder} must not reuse a file`);
  }
});
