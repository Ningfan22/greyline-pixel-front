import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { CARD_IMAGE_VARIANTS } from '../game/card-image-data.ts';
import { cardPicturePath } from '../game/card-picture-path.ts';
import { DECK } from '../game/engine.ts';
const read = (path) =>
    readFileSync(fileURLToPath(new URL('../public' + path, import.meta.url))),
  sha = (b) => createHash('sha256').update(b).digest('hex');
const provenance = JSON.parse(read('/art/v204-cards/provenance.json'));
test('display-sized card derivatives match the current illustrations and selected starting deck', () => {
  let original = 0,
    compact = 0;
  for (const entry of provenance.entries) {
    assert.equal(sha(read(entry.source)), entry.sourceSha256);
    assert.equal(sha(read(entry.path)), entry.sha256);
    assert(
      CARD_IMAGE_VARIANTS[entry.source].some(
        (v) => v.path === entry.path && v.width === entry.width,
      ),
    );
    if (entry.width === 384) {
      original += entry.sourceBytes;
      compact += entry.bytes;
    }
  }
  for (const id of DECK) {
    const entries = CARD_IMAGE_VARIANTS[cardPicturePath(id)];
    assert(entries?.length === 2, `responsive card ${id}`);
    assert.equal(entries[0].width, 384);
    assert(
      entries[1].width >= 384 && entries[1].width <= 640,
      'never enlarge a smaller original',
    );
  }
  assert(compact < original * 0.3, `${compact}/${original}`);
  assert.equal(cardPicturePath('mlrs'), '/art/v204-weapons/mlrs-card.webp');
});
