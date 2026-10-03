import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const { createCanvas, Image } = createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document = { createElement: () => createCanvas(1, 1) };
globalThis.Image = class extends Image {
  set src(value) {
    super.src = value.startsWith('/')
      ? fileURLToPath(new URL('../public' + value, import.meta.url))
      : value;
  }
  get src() { return super.src; }
};

const { CARDS, createGame, startGame, spawnUnit, tick, refreshVision, H } =
  await import('../game/engine.ts');
const { loadBattleArt, unitFrame } = await import('../game/art.ts');
const { render } = await import('../game/render.ts');
const { loadCollection, COLLECTION_STORAGE, starterState } = await import('../game/collection.ts');
const { loadDeckStore, DECKS_STORAGE } = await import('../game/decks-store.ts');
const { DECK } = await import('../game/cards.ts');

function arena(seed = 192) {
  const s = createGame(seed);
  startGame(s);
  s.aiIn = 1e9;
  s.units = [];
  s.scenery = [];
  s.walls = [];
  s.terrain.fill(374);
  s.original.fill(374);
  s.weather.disabled = true;
  return s;
}

test('new guns retain the original gun pixels and render two separate existing soldier rigs', async () => {
  const art = await loadBattleArt('greyline');
  for (const id of ['field_gun', 'siege_gun']) {
    assert.equal(art.generatedSprites[id], undefined);
    assert.equal(unitFrame(art, id, 0), art.emplacements.howitzer[0]);
  }
  const s = arena();
  spawnUnit(s, 0, 'field_gun', 320);
  s.time = 10;
  refreshVision(s);
  const ctx = createCanvas(960, H).getContext('2d');
  const drawn = [];
  const draw = ctx.drawImage.bind(ctx);
  ctx.drawImage = (...args) => { drawn.push(args[0]); return draw(...args); };
  render(ctx, s, art, null, null, true, 0, 960);
  assert(drawn.includes(art.emplacements.howitzer[0]));
  // The current rig paints into one persistent canvas per actor; these are
  // intentionally outside the immutable frame cache. This otherwise empty
  // single-gun scene has exactly two 128px actor canvases: its two operators.
  const crew = drawn.filter(image => image.width === 128 && image.height === 128);
  assert.equal(crew.length, 2);
  assert.notEqual(crew[0], crew[1], 'operators have independent hand-work phases');
  drawn.length = 0;
  render(ctx, s, art, null, null, true, 0, 960);
  const repeatedCrew = drawn.filter(image => image.width === 128 && image.height === 128);
  assert.equal(repeatedCrew.length, 2);
  for (let i = 0; i < crew.length; i++)
    assert.equal(repeatedCrew[i], crew[i], 'a redraw reuses both existing actor canvases');
});

test('only the existing strike jet remains and it advances every flight tick', () => {
  assert.equal(CARDS.ground_attack_jet, undefined);
  assert(CARDS.strike_jet.sortie);
  const s = arena();
  spawnUnit(s, 0, 'strike_jet', 650);
  const jet = s.units[0], before = jet.x;
  tick(s, 0.05);
  assert(jet.x > before + 20);
  assert(jet.moving);
});

test('saved collections and decks convert the removed duplicate into the original jet', () => {
  const previousStorage = globalThis.localStorage;
  const data = new Map();
  globalThis.localStorage = {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
  };
  try {
    const old = starterState();
    old.owned.ground_attack_jet = 1;
    old.testGoldGranted = true;
    data.set(COLLECTION_STORAGE, JSON.stringify(old));
    data.set(DECKS_STORAGE, JSON.stringify({activeId:'existing',decks:[{
      id:'existing',name:'空袭',cards:[...DECK.slice(0,19),'ground_attack_jet'],
    }]}));
    const collection = loadCollection();
    assert.equal(collection.owned.ground_attack_jet, undefined);
    assert((collection.owned.strike_jet ?? 0) >= 1);
    const deck = loadDeckStore(collection).decks[0];
    assert.equal(deck.cards.length, 20);
    assert(deck.cards.includes('strike_jet'));
    assert(!deck.cards.includes('ground_attack_jet'));
  } finally {
    globalThis.localStorage = previousStorage;
  }
});

test('a fireteam does not reverse twice in a blink when dodging and searching for a firing lane', () => {
  const s = arena();
  for (const x of [500, 550, 600]) spawnUnit(s, 0, 'infantry', x);
  for (const x of [950, 1000, 1050]) spawnUnit(s, 1, 'infantry', x);
  const last = new Map(s.units.map(u => [u.uid, { facing: u.facing, at: -100 }]));
  let rapidReversals = 0;
  for (let frame = 0; frame < 400; frame++) {
    tick(s, 0.05);
    for (const u of s.units) {
      const state = last.get(u.uid);
      if (!state || u.facing === state.facing) continue;
      if (s.time - state.at < 0.2) rapidReversals++;
      state.at = s.time;
      state.facing = u.facing;
    }
  }
  assert(rapidReversals <= 3, `too many one-frame reversals: ${rapidReversals}`);
});
