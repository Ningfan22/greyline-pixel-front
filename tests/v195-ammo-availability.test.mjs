import test from 'node:test';
import assert from 'node:assert/strict';
import { DECK_PRESETS, AI_DECKS } from '../game/deck-presets.ts';
import { validDeck } from '../game/cards.ts';
import {
  COLLECTION_STORAGE,
  loadCollection,
  starterState,
  validDeckWithCollection,
} from '../game/collection.ts';

test('a new player can use the recommended resupply deck immediately', () => {
  const starter = starterState();
  assert.equal(starter.owned.ammo, 1);
  assert.equal(starter.ammoReleaseGranted, true);
  assert(validDeckWithCollection(DECK_PRESETS[0].cards, starter));
  for (const deck of [
    ...DECK_PRESETS.map((preset) => preset.cards),
    ...AI_DECKS,
  ]) {
    assert(validDeck(deck));
    assert.equal(deck.filter((id) => id === 'ammo').length, 1);
  }
});

test('old accounts receive ammunition support once without changing their gold or saved decks', () => {
  const originalStorage = globalThis.localStorage;
  try {
    for (const previousCopies of [0, 1, 2]) {
      const old = {
        ...starterState(),
        gold: 4321,
        owned: { infantry: 4, tank: 1, ammo: previousCopies },
        packsOpened: 42,
        adsWatched: 3,
        testGoldGranted: true,
        fortificationReleaseGranted: true,
      };
      delete old.ammoReleaseGranted;
      const savedDeck = JSON.stringify({
        active: 'custom',
        decks: [['tank', 'infantry']],
      });
      const data = new Map([
        [COLLECTION_STORAGE, JSON.stringify(old)],
        ['greyline-player-custom-deck', savedDeck],
      ]);
      globalThis.localStorage = {
        getItem: (key) => data.get(key) ?? null,
        setItem: (key, value) => data.set(key, value),
      };
      const granted = loadCollection();
      assert.deepEqual(granted, {
        ...old,
        owned: { ...old.owned, ammo: Math.max(1, previousCopies) },
        ammoReleaseGranted: true,
      });
      assert.deepEqual(loadCollection(), granted);
      assert.equal(data.get('greyline-player-custom-deck'), savedDeck);
    }
  } finally {
    globalThis.localStorage = originalStorage;
  }
});
