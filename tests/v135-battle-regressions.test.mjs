import assert from 'node:assert/strict';
import test from 'node:test';
import { createGame, startGame, spawnUnit, tick, draw, requestDraw, playCard, setOrder, pickMedicPatient, contactSafeX, CARDS } from '../game/engine.ts';
import { adultFrameChoice, idlePoseChoice } from '../game/adult-animation.ts';
import { MAP_IDS, createMapLayout } from '../game/maps.ts';

function arena() {
  const s = createGame(135);
  startGame(s);
  s.units = [];
  s.scenery = [];
  s.walls = [];
  s.terrain.fill(374);
  s.original.fill(374);
  s.aiIn = 1e9;
  return s;
}
function soldier(s, id = 'infantry', pose = 'idle') {
  spawnUnit(s, 0, id, 640, { member: 0 });
  const u = s.units.at(-1);
  Object.assign(u, { pose, moving: false, motion: 'ground', fire: 0, secondaryFire: 0,
    flash: 0, suppression: 0, aimUntil: 0, reloadingUntil: 0, fragThrow: 0 });
  return u;
}

test('every card has a usable definition and unit combat fields', () => {
  for (const c of Object.values(CARDS)) {
    assert(['unit', 'skill'].includes(c.type), `${c.id}: missing card type`);
    assert(Number.isFinite(c.atlas), `${c.id}: missing artwork reference`);
    if (c.type === 'unit') for (const field of ['hp', 'speed', 'damage', 'rate', 'range'])
      assert(Number.isFinite(c[field]), `${c.id}: missing ${field}`);
  }
});

test('field hospital sets up before healing at extended range and never follows the front', () => {
  const s = arena(), h = soldier(s, 'field_hospital');
  const p = soldier(s);
  p.x = h.x + 200;
  p.y = h.y;
  p.hp = p.maxHp / 2;
  setOrder(s, 0, 'hold');
  const initialHp = p.hp, initialX = h.x;
  for (let i = 0; i < 150; i++) tick(s, 1 / 60);
  assert.equal(p.hp, initialHp, 'no healing during the three-second setup');
  for (let i = 0; i < 65; i++) tick(s, 1 / 60);
  assert(p.hp > initialHp, 'hospital heals beyond mobile-medics range');
  assert.equal(h.x, initialX);
  assert.equal(h.shots, 0);
  setOrder(s, 0, 'rush');
  for (let i = 0; i < 60; i++) tick(s, 1 / 60);
  assert.equal(h.x, initialX, 'a fixed hospital must not rush forward');
});

test('mobile medics retrieve casualties whom fixed hospitals need brought closer', () => {
  const s = arena(), mobile = soldier(s, 'medic_team'), h = soldier(s, 'field_hospital');
  const p = soldier(s);
  Object.assign(p, { x: mobile.x + 120, wounded: true, hp: 20, bleedOut: 25 });
  assert.equal(pickMedicPatient(s, mobile), p);
  assert.equal(pickMedicPatient(s, h), undefined);
  p.x = h.x + 50;
  assert.equal(pickMedicPatient(s, h), p);
});

test('both players exhaust their finite pile without automatic recycling', () => {
  const s = arena();
  for (const side of [0, 1]) {
    const p = s.players[side];
    const original = [...p.hand, ...p.deck].map(h => h.uid).sort();
    while (p.hand.length || p.deck.length) {
      p.discard.push(...p.hand.splice(0));
      draw(s, side, 6);
    }
    assert.deepEqual(p.discard.map(h => h.uid).sort(), original);
    p.energy = 10;
    p.drawIn = 0;
    assert.equal(draw(s, side, 3), 0);
    assert.equal(requestDraw(s, side).ok, false);
    assert.equal(p.energy, 10);
    assert.equal(p.deck.length, 0);
  }
});

test('explicit salvage can recover one spent card after draw-pile exhaustion', () => {
  const s = arena(), p = s.players[0];
  const spent = { id: 'infantry', uid: ++s.uid };
  const recovery = { id: 'battlefield_salvage', uid: ++s.uid };
  p.deck = [];
  p.hand = [recovery];
  p.discard = [spent];
  p.energy = 10;
  assert.equal(playCard(s, 0, recovery.uid).ok, true);
  assert(p.hand.includes(spent));
  assert.equal(p.deck.length, 0);
  assert.equal(draw(s, 0, 6), 0);
});

test('wounded soldier never uses a rope frame even before the next engine tick', () => {
  const s = arena(), u = soldier(s);
  Object.assign(u, { wounded: true, woundedTime: 2, woundedFromPose: 'prone', rappelling: true });
  assert.deepEqual(adultFrameChoice(u, 10), { group: 'actions20', index: 14 });
  tick(s, 1 / 60);
  assert.equal(u.rappelling, false);
});

test('idle decoration never makes a standing rifleman or engineer kneel', () => {
  for (const id of ['infantry', 'engineers', 'scouts']) {
    const s = arena(), u = soldier(s, id);
    u.ammo = 20;
    for (const vacuum of [false, true]) {
      u.vacuum = vacuum;
      for (let t = 0; t < 60; t += 0.1) {
        u.boundRestUntil = t + 1;
        const frame = idlePoseChoice(u, t);
        if (frame) assert.deepEqual([frame.group, frame.index], ['actions20', 0], `${id} t=${t}`);
      }
    }
  }
});

test('treatment and low-posture reloads use grounded frames, never the run or climb cycles', () => {
  for (const pose of ['idle', 'crouch', 'prone', 'hunker']) {
    const s = arena(), u = soldier(s, 'medic_team', pose);
    const allowed = pose === 'prone' ? [2, 3, 12] : pose === 'idle' ? [0] : [1, 13];
    for (const treatment of [false, true]) {
      u.tending = treatment;
      u.ammo = 0;
      u.reloadingStartAt = 0;
      u.reloadingUntil = 3;
      for (let t = 0; t < 3; t += 0.05) {
        u.tendingTime = t;
        const f = adultFrameChoice(u, t);
        if (!treatment) {
          assert.equal(f.group, pose === 'idle' ? 'reload8' : 'lowReload16');
          assert.equal(f.index, (pose === 'prone' ? 8 : 0) + Math.min(7, Math.floor(t / 3 * 8)));
          continue;
        }
        assert.equal(f.group, 'actions20');
        assert(allowed.includes(f.index), `${pose}: ${f.index}`);
      }
    }
  }
});

test('prone scouts and grenade throwers stay low throughout their action', () => {
  const s = arena(), u = soldier(s, 'scouts', 'prone');
  for (let t = 0; t < 10; t += 0.03) {
    u.fragThrow = t % 0.45;
    const f = adultFrameChoice(u, t);
    if (u.fragThrow > 0) {
      assert.equal(f.group, 'lowGrenade32');
      assert(f.index >= 16 && f.index < 32);
    } else {
      assert.equal(f.group, 'actions20');
      assert([2, 3, 12].includes(f.index));
    }
  }
});

test('nonfatal hits and weapon discharge never use falling or signalling frames', () => {
  const s = arena(), u = soldier(s);
  u.flash = 0.15;
  assert.deepEqual(adultFrameChoice(u, 1), { group: 'reactions8', index: 4 });
  u.flash = 0;
  u.secondaryFire = 0.08;
  assert.deepEqual(adultFrameChoice(u, 2), { group: 'actions20', index: 0 });
});

test('rapid conflicting stance orders cannot change height more than once per ten seconds', () => {
  const s = arena(), u = soldier(s);
  u.squadOrder = undefined;
  let previous = 'stand', changedAt = -100;
  for (let i = 0; i < 24 * 60; i++) {
    setOrder(s, 0, Math.floor(i / 30) % 2 ? 'prone' : 'crouch');
    tick(s, 1 / 60);
    const next = u.pose === 'prone' ? 'prone' : ['crouch', 'hunker'].includes(u.pose) ? 'crouch' : 'stand';
    if (next !== previous) {
      assert(s.time - changedAt >= 10 - 1e-6, `${previous}->${next} at ${s.time}`);
      changedAt = s.time;
      previous = next;
    }
  }
});

test('work and empty-ammunition notices cannot signal or change the standing silhouette', () => {
  for (const flag of ['overheatedUntil', 'ammoSignalUntil', 'scavengeUntil', 'emplacementSetupUntil']) {
    const s = arena(), u = soldier(s);
    u[flag] = 30;
    for (let t = 0; t < 10; t += 0.05)
      assert.deepEqual(adultFrameChoice(u, t), { group: 'actions20', index: 0 }, flag);
  }
});

test('all map seeds keep the whole building pad level, including overlapping neighbors', () => {
  for (const id of MAP_IDS) for (let seed = 1; seed <= 24; seed++) {
    const map = createMapLayout(id, 3840, seed);
    for (const site of map.scenerySites.filter(p => p.kind === 'house')) {
      const x = Math.round(site.x), y = map.terrain[x];
      for (let dx = -110; dx <= 110; dx++)
        if (x + dx >= 0 && x + dx < map.terrain.length)
          assert.equal(map.terrain[x + dx], y, `${id}/${seed}/${x}/${dx}`);
    }
  }
});

test('both sides keep infantry and armor outside an uncleared enemy line; retreat remains possible', () => {
  for (const side of [0, 1]) for (const id of ['infantry', 'tank']) {
    const s = arena(), dir = side === 0 ? 1 : -1;
    const u = soldier(s, id); u.side = side; u.x = 1500;
    const e = soldier(s); e.side = 1 - side; e.x = u.x + dir * 80;
    s.visible[side] = [e.uid];
    assert.equal(contactSafeX(s, u, u.x + dir * 30), u.x);
    assert.equal(contactSafeX(s, u, u.x - dir * 30), u.x - dir * 30);
    e.hp = 0;
    assert.equal(contactSafeX(s, u, u.x + dir * 30), u.x + dir * 30);
  }
});

test('supply and forage trade card advantage for a free one-card cycle', () => {
  for (const [id, cost, cards] of [['supply', 1, 2], ['foraged_supplies', 0, 1]]) {
    const s = arena(), p = s.players[0];
    const h = { id, uid: ++s.uid }; p.hand = [h]; p.energy = 5;
    assert(playCard(s, 0, h.uid).ok);
    assert.equal(p.hand.length, cards);
    assert.equal(p.energy, 5 - cost);
  }
});

test('local illumination trades coverage for a longer cheaper observation window', () => {
  for (const [id, radius, life] of [['flare', 260, 10], ['illumination_round', 160, 14]]) {
    const s = arena(), p = s.players[0], h = { id, uid: ++s.uid };
    p.hand = [h]; p.energy = 10;
    assert(playCard(s, 0, h.uid, 1500).ok);
    assert.equal(s.flares.at(-1).radius, radius);
    assert.equal(s.flares.at(-1).life, life);
  }
});
