import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MAPS, createMapLayout } from '../game/maps.ts';
import { W } from '../game/engine.ts';

const here = path.dirname(fileURLToPath(import.meta.url));
const audioSrc = fs.readFileSync(
  path.join(here, '../game/audio.ts'),
  'utf8',
);

const results = [],
  failures = [];
function check(name, fn) {
  if (
    process.env.TEST_FILTER &&
    !new RegExp(process.env.TEST_FILTER).test(name)
  )
    return;
  try {
    const details = fn();
    results.push({ name, ...details });
    console.log('PASS', name, JSON.stringify(details ?? {}));
  } catch (e) {
    failures.push({ name, error: e.stack });
    console.error('FAIL', name, e.stack);
  }
}

// --- low walls stay gone from every map -------------------------------------

check('no map layout spawns low walls', () => {
  const mapIds = /** @type {const} */ (Object.keys(MAPS));
  assert.ok(mapIds.length >= 4, 'expected at least four maps');
  for (const id of mapIds) {
    const layout = createMapLayout(id, W);
    assert.equal(
      layout.wallSites.length,
      0,
      `map ${id} still defines ${layout.wallSites.length} wall sites`,
    );
  }
  return { maps: mapIds.length };
});

// --- music starts inside the entry gesture -----------------------------------
// Web Audio cannot run under Node, so this is a source-level guard: unlock()
// must kick the music loop immediately after the first buffer lands and again
// once loading settles, bypassing the `active` gate that only flips when the
// battle screen appears.

check('audio.unlock starts music immediately via startMusic(true)', () => {
  assert.ok(
    audioSrc.includes('private startMusic(ignoreActive = false)'),
    'startMusic must accept an ignoreActive bypass',
  );
  assert.ok(
    audioSrc.includes('(!this.active && !ignoreActive)'),
    'startMusic guard must honor the ignoreActive bypass',
  );
  const eagerCalls = audioSrc.match(/this\.startMusic\(true\)/g)?.length ?? 0;
  assert.ok(
    eagerCalls >= 2,
    `unlock() must call startMusic(true) on buffer load and on settle, found ${eagerCalls}`,
  );
  return { eagerCalls };
});

// --- summary ------------------------------------------------------------------

console.log(
  `\nv101 music & walls: ${results.length} checks, ${failures.length} failures`,
);
if (failures.length) {
  for (const f of failures) console.error(f.name, f.error);
  process.exit(1);
}
