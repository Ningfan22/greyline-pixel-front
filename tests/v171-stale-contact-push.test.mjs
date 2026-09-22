import assert from 'node:assert/strict';
import test from 'node:test';
import {
  tick,
  refreshVision,
  visibleToSide,
  contactSafeX,
  setOrder,
} from '../game/engine.ts';
import { CONTACT_STALE_S } from '../game/world.ts';
import { contactSector } from './fixtures/contact-sector.mjs';

test('a contact older than CONTACT_STALE_S releases the movement block while a fresh snapshot still holds the line', () => {
  for (const side of [0, 1]) {
    const { s, u, e, dir, hideInCrater } = contactSector(side);
    const gap = 105; // infantry gap
    hideInCrater();
    // Fresh contact: the hidden enemy's last observed position is a hard barrier.
    assert.equal(contactSafeX(s, u, u.x + dir * 500), e.x - dir * gap);
    // Withdrawal is never blocked by a contact.
    assert.equal(contactSafeX(s, u, u.x - dir * 40), u.x - dir * 40);
    // Age the snapshot past the stale threshold without reacquiring.
    s.time += CONTACT_STALE_S + 1;
    refreshVision(s);
    assert(!visibleToSide(s, side, e), 'enemy stays hidden after ageing');
    // Stale contact: the unit may probe forward past the old line.
    assert.equal(contactSafeX(s, u, u.x + dir * 500), u.x + dir * 500);
  }
});

test('AI switches to rush when the front is quiet — no visible foe and no fresh contact', () => {
  const { s } = contactSector(1, 'scouts');
  // Remove the enemy and every remembered contact.
  s.units = s.units.filter((v) => v.side === 1);
  s.groundContacts = [[], []];
  s.players[1].hand = [];
  s.players[1].deck = [];
  s.players[1].energy = 0;
  // Override the fixture's rush order so we can see updateAI change it.
  setOrder(s, 1, 'hold');
  s.aiIn = 0;
  tick(s, 0.05);
  assert.equal(s.players[1].order, 'rush');
});

test('AI keeps holding while a fresh remembered contact is uncleared, even with no visible enemy', () => {
  const { s, hideInCrater } = contactSector(1, 'scouts');
  // The enemy hides, leaving a fresh contact, then is removed.
  hideInCrater();
  s.units = s.units.filter((v) => v.side === 1);
  s.players[1].hand = [];
  s.players[1].deck = [];
  s.players[1].energy = 0;
  // Fixture set order to 'rush'; updateAI should downgrade to 'hold' because
  // the fresh contact is a remembered threat.
  s.aiIn = 0;
  tick(s, 0.05);
  assert.equal(s.players[1].order, 'hold');
});

test('AI rushes once the only remembered contact goes stale, even if the enemy was never confirmed cleared', () => {
  const { s, hideInCrater } = contactSector(1, 'scouts');
  hideInCrater();
  s.units = s.units.filter((v) => v.side === 1);
  s.players[1].hand = [];
  s.players[1].deck = [];
  s.players[1].energy = 0;
  s.time += CONTACT_STALE_S + 1;
  refreshVision(s);
  setOrder(s, 1, 'hold');
  s.aiIn = 0;
  tick(s, 0.05);
  assert.equal(s.players[1].order, 'rush');
});
