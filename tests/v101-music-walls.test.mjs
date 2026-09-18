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
const homeMenuSrc = fs.readFileSync(
  path.join(here, '../app/home-menu.tsx'),
  'utf8',
);
const battleSrc = fs.readFileSync(
  path.join(here, '../app/battle.tsx'),
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

// --- menu screen keeps the music audible -------------------------------------
// The mixer starts with active=false, so music unlocked on the menu would be
// silent until the battle screen flips the gate. The home menu must activate
// the mixer on mount and unlock on the first visitor gesture.

check('home menu activates the mixer and unlocks on first gesture', () => {
  assert.ok(
    homeMenuSrc.includes('mixer.setActive(true)'),
    'home menu must call setActive(true) so unlocked music is audible',
  );
  assert.ok(
    homeMenuSrc.includes("void mixer.unlock()"),
    'home menu must unlock the audio context from a user gesture',
  );
  assert.ok(
    homeMenuSrc.includes("addEventListener('pointerdown'") &&
      homeMenuSrc.includes("addEventListener('keydown'"),
    'home menu must listen for pointer and keyboard gestures',
  );
  return { gestures: ['pointerdown', 'keydown'] };
});

// --- audio is prefetched so music starts instantly on first interaction ----
// The 1.4 MB music track takes a moment to download. Prefetching starts the
// fetch on page load (no gesture needed) so that unlock() finds the bytes
// already local and music begins immediately.

check('audio is prefetched on menu mount and consumed by unlock', () => {
  assert.ok(
    audioSrc.includes('prefetch()'),
    'audio.ts must define a prefetch() method',
  );
  assert.ok(
    audioSrc.includes('this.prefetched.get(file)'),
    'unlock() must consume prefetched audio data instead of re-downloading',
  );
  assert.ok(
    homeMenuSrc.includes('mixer.prefetch()'),
    'home menu must call prefetch() on mount',
  );
  assert.ok(
    battleSrc.includes('mixer.setActive(true)'),
    'battle screen must activate the mixer on mount',
  );
  return { prefetch: true };
});

// --- summary ------------------------------------------------------------------

console.log(
  `\nv101 music & walls: ${results.length} checks, ${failures.length} failures`,
);
if (failures.length) {
  for (const f of failures) console.error(f.name, f.error);
  process.exit(1);
}
