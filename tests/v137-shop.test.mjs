import assert from 'node:assert/strict';
import test from 'node:test';
import { CARDS, copyLimit } from '../game/cards.ts';
import { openPack, openTenPacks, rarityOf, RARITY_COMPENSATION, grantAdReward,
  STARTER_COLLECTION, deckLimit } from '../game/collection.ts';
import { createRevealTimers } from '../app/reveal-timers.ts';

const account = (owned = {}, gold = 10000) => ({ gold, owned, packsOpened: 0, adsWatched: 0 });
function alternating(rarityRoll) {
  let calls = 0;
  return () => (++calls % 2 ? rarityRoll : 0.5);
}

test('ten all-rare cards packs still receive exactly one guaranteed ace', () => {
  const r = openTenPacks(account(), alternating(0.2));
  assert.equal(r.drawn.length, 50);
  assert.equal(r.drawn.filter(d => d.rarity === 'epic').length, 1);
  assert.equal(r.drawn.filter(d => d.rarity === 'rare').length, 49);
  assert.equal(r.pity, true);
  assert.equal(r.state.packsOpened, 10);
});

test('all-common ten-pack gets a guaranteed ace; natural high rarity is left alone', () => {
  assert(openTenPacks(account(), alternating(0.9)).pity);
  for (const roll of [0.05, 0.01]) {
    const r = openTenPacks(account(), alternating(roll));
    assert.equal(r.pity, false);
    assert(r.drawn.every(d => ['epic', 'legendary'].includes(d.rarity)));
  }
});

test('pity selects a genuinely available ace even if every other ace is full', () => {
  const aces = Object.keys(CARDS).filter(id => rarityOf(id) === 'epic');
  const missing = aces.at(-1);
  const owned = Object.fromEntries(aces.filter(id => id !== missing).map(id => [id, copyLimit(id)]));
  const r = openTenPacks(account(owned), () => 0.9);
  const guaranteed = r.drawn.find(d => d.rarity === 'epic');
  assert.equal(guaranteed.id, missing);
  assert.equal(guaranteed.converted, false);
});

test('full collections refund each rarity, including an overflowed guaranteed ace', () => {
  const owned = Object.fromEntries(Object.keys(CARDS).map(id => [id, copyLimit(id)]));
  for (const roll of [0.9, 0.2, 0.05, 0.01]) {
    const before = account(owned);
    const r = openPack(before, alternating(roll));
    assert.equal(r.drawn.length, 5);
    assert(r.drawn.every(d => d.converted && d.gold === RARITY_COMPENSATION[d.rarity]));
    assert.equal(r.state.gold, before.gold - 100 + r.goldGained);
    assert.deepEqual(r.state.owned, owned);
  }
  const r = openTenPacks(account(owned), () => 0.9);
  assert.equal(r.drawn.find(d => d.rarity === 'epic').gold, 20);
});

test('one draw unlocks one copy; repeated draws stop at the carrying cap', () => {
  const r = openPack(account(), () => 0.9);
  const id = r.drawn[0].id;
  assert.equal(r.state.owned[id], Math.min(5, copyLimit(id)));
  assert.equal(r.drawn.filter(d => d.converted).length, 5 - copyLimit(id));
  assert.equal(deckLimit(account({ [id]: 1 }), id), 1);
});

test('insufficient or invalid funds never draw, save, or mutate the collection', () => {
  for (const [fn, cost] of [[openPack, 100], [openTenPacks, 1000]]) {
    for (const gold of [cost - 1, -100, NaN, Infinity]) {
      const s = account({}, gold), before = structuredClone(s);
      let calls = 0;
      assert.throws(() => fn(s, () => { calls++; return 0.5; }), RangeError);
      assert.equal(calls, 0);
      assert.deepEqual(s, before);
    }
  }
});

test('100 mock ad coins and 30 starter species remain unchanged', () => {
  const s = account({}, 0);
  const next = grantAdReward(s);
  assert.equal(next.gold, 100);
  assert.equal(next.adsWatched, 1);
  assert.equal(Object.keys(STARTER_COLLECTION).length, 30);
  assert.equal(s.gold, 0);
});

test('100 seeded ten-packs obey ledger, cap and guarantee invariants', () => {
  for (let seed = 1; seed <= 100; seed++) {
    let v = seed;
    const rng = () => { v = (Math.imul(v, 1664525) + 1013904223) >>> 0; return v / 2 ** 32; };
    const s = account({ ...STARTER_COLLECTION }), before = structuredClone(s);
    const r = openTenPacks(s, rng);
    assert.deepEqual(s, before);
    assert(r.drawn.some(d => ['epic', 'legendary'].includes(d.rarity)));
    assert.equal(r.state.gold, s.gold - 1000 + r.drawn.reduce((n, d) => n + d.gold, 0));
    for (const [id, n] of Object.entries(r.state.owned)) assert(n <= copyLimit(id), id);
    const gained = Object.entries(r.state.owned).reduce((n, [id, count]) => n + count - (s.owned[id] ?? 0), 0);
    assert.equal(gained, r.drawn.filter(d => !d.converted).length);
  }
});

function timerHarness() {
  const jobs = [], cleared = [];
  const queue = createRevealTimers({ set: (fn, ms) => { jobs.push({ fn, ms }); return jobs.length; }, clear: id => cleared.push(id) });
  return { jobs, cleared, queue };
}
test('starting a new pack invalidates every old reveal, including already-queued callbacks', () => {
  const { jobs, queue, cleared } = timerHarness(), flipped = [];
  queue.reveal([0, 1, 2, 3, 4], 120, i => flipped.push(i));
  assert.deepEqual(jobs.map(j => j.ms), [0, 120, 240, 360, 480]);
  jobs[0].fn(); queue.cancel();
  jobs.slice(1).forEach(j => j.fn());
  assert.deepEqual(flipped, [0]); assert.equal(cleared.length, 5);
  queue.reveal([2, 4], 28, i => flipped.push(i + 10));
  jobs.slice(5).forEach(j => j.fn());
  assert.deepEqual(flipped, [0, 12, 14]);
});
test('repeated table clicks do not duplicate callbacks; exit cancels pending flips', () => {
  const { jobs, queue } = timerHarness(), flipped = [];
  queue.reveal([0, 1, 2], 120, i => flipped.push(i));
  queue.reveal([0, 1, 2], 120, i => flipped.push(i));
  jobs.forEach(j => j.fn());
  assert.deepEqual(flipped, [0, 1, 2]);
  queue.reveal([3, 4], 120, i => flipped.push(i));
  queue.cancel(); jobs.slice(6).forEach(j => j.fn());
  assert.deepEqual(flipped, [0, 1, 2]);
});
