/**
 * Combined-arms synergy detection (v48).
 *
 * Three provider→receiver relationships make coordinated decks feel like a
 * real combined-arms battlefield:
 *
 *  - armor_assault: a friendly ground armored vehicle near infantry lets
 *    those infantry shed suppression 1.6x faster (armor overruns positions).
 *  - fire_base: a friendly MG team near other infantry cuts incoming
 *    suppression buildup by 0.65 (covering fire keeps heads down).
 *  - medevac_chain: a friendly medic near wounded infantry speeds their
 *    crawl back to cover by 1.35 (medics organise the drag).
 *  - smoke_screen: infantry standing in or right behind a friendly smoke
 *    screen shed suppression 1.5x faster. Enemy direct fire through smoke
 *    is unaimed or blocked outright, so troops under their own screen
 *    regain their nerve and keep manoeuvring — the classic smoke-assault
 *    rhythm of blind, push, close.
 *  - supply_run: a friendly supply team within 210px of a heavy weapon team
 *    (mortar, MG, AT gun, AA gun, rocket) speeds that team's reload 1.6x —
 *    the runners keep the guns fed.
 *
 * Results are cached per unit and refreshed on a staggered 0.4–0.6s cycle,
 * so the per-tick cost is a handful of spatial queries spread across frames
 * instead of an O(N²) scan every tick.
 */

import { CARDS, modelOf, type CardId } from './cards';
import { nearUnits } from './spatial';
import type { GameState, Unit } from './engine';

export type SynergyKind =
  | 'armor_assault'
  | 'fire_base'
  | 'medevac_chain'
  | 'smoke_screen'
  | 'supply_run';

export interface SynergyState {
  armor_assault: boolean;
  fire_base: boolean;
  medevac_chain: boolean;
  smoke_screen: boolean;
  supply_run: boolean;
}

const NONE: SynergyState = Object.freeze({
  armor_assault: false,
  fire_base: false,
  medevac_chain: false,
  smoke_screen: false,
  supply_run: false,
});

const ARMOR_ASSAULT_RANGE = 170;
const FIRE_BASE_RANGE = 240;
const MEDEVAC_RANGE = 220;
// Smoke clouds are 95px half-width; a soldier just outside the visible
// edge is still screened from long-range direct fire.
const SMOKE_SCREEN_RANGE = 130;
const SUPPLY_RUN_RANGE = 210;
const REFRESH = 0.4;

interface Entry {
  state: SynergyState;
  providers: Partial<Record<SynergyKind, number>>;
  at: number;
}

const cache = new WeakMap<GameState, Map<number, Entry>>();
const scratch: Unit[] = [];

function isArmorProvider(u: Unit): boolean {
  const c = CARDS[u.id];
  // The tank/ifv base cards carry `armored: true` but no `vehicle` flag
  // (only their variants set `vehicle`), so gate on armor alone. Indirect
  // fire carriers (mortar carriers) are support, not assault armor.
  return c.armored === true && !c.air && !c.indirect;
}

function isMgProvider(u: Unit): boolean {
  return modelOf(u.id) === 'machinegun';
}

function isMedicProvider(u: Unit): boolean {
  return modelOf(u.id) === 'medic';
}

/**
 * Heavy weapon teams that consume ammunition at a high rate and benefit
 * from a supply team running belts/rounds up to the position. Mortar
 * carriers are vehicles, snipers/javelins are light — neither qualifies.
 */
function isWeaponTeam(u: Unit): boolean {
  const m = modelOf(u.id);
  if (m === 'mortar' || m === 'machinegun' || m === 'rocket') return true;
  return u.id === 'aa_gun';
}

/** Card-id-only variant for AI deck scoring (no live Unit needed). */
export function isWeaponTeamId(id: CardId): boolean {
  const m = modelOf(id);
  if (m === 'mortar' || m === 'machinegun' || m === 'rocket') return true;
  return id === 'aa_gun';
}

function isInfantry(u: Unit): boolean {
  const c = CARDS[u.id];
  return (c.members ?? 0) > 0 && !c.indirect;
}

function providerAlive(u: Unit): boolean {
  return u.hp > 0 && !u.wounded && !u.surrendered;
}

function compute(s: GameState, u: Unit, now: number): Entry {
  const state: SynergyState = {
    armor_assault: false,
    fire_base: false,
    medevac_chain: false,
    smoke_screen: false,
    supply_run: false,
  };
  const providers: Partial<Record<SynergyKind, number>> = {};
  const side = u.side;

  // Armor assault: friendly ground armored vehicle within 170px.
  nearUnits(s, u.x, ARMOR_ASSAULT_RANGE, scratch);
  for (let i = 0; i < scratch.length; i++) {
    const v = scratch[i];
    if (
      v.side === side &&
      providerAlive(v) &&
      isArmorProvider(v) &&
      Math.abs(v.x - u.x) <= ARMOR_ASSAULT_RANGE
    ) {
      state.armor_assault = true;
      providers.armor_assault = v.uid;
      break;
    }
  }

  // Fire base: friendly MG team within 240px. MG teams themselves never
  // receive the bonus — otherwise the 5 members of one MG card would
  // provide fire_base to each other.
  if (!isMgProvider(u)) {
    nearUnits(s, u.x, FIRE_BASE_RANGE, scratch);
    for (let i = 0; i < scratch.length; i++) {
      const v = scratch[i];
      if (
        v.side === side &&
        providerAlive(v) &&
        isMgProvider(v) &&
        Math.abs(v.x - u.x) <= FIRE_BASE_RANGE
      ) {
        state.fire_base = true;
        providers.fire_base = v.uid;
        break;
      }
    }
  }

  // Medevac chain: friendly medic within 220px of a still-living wounded
  // infantryman. Dead or unwounded units never get the chain.
  if (u.wounded === true && u.hp > 0) {
    nearUnits(s, u.x, MEDEVAC_RANGE, scratch);
    for (let i = 0; i < scratch.length; i++) {
      const v = scratch[i];
      if (
        v.side === side &&
        providerAlive(v) &&
        isMedicProvider(v) &&
        Math.abs(v.x - u.x) <= MEDEVAC_RANGE
      ) {
        state.medevac_chain = true;
        providers.medevac_chain = v.uid;
        break;
      }
    }
  }

  // Smoke screen: a friendly smoke cloud at or just behind the unit. Smoke
  // is not a unit, so there is no provider uid to link to — the cloud
  // itself is the visual. Only the side that laid the screen gets the
  // nerve bonus; enemy smoke is an obstacle, not cover.
  for (let i = 0; i < s.smokes.length; i++) {
    const f = s.smokes[i];
    if (
      f.side === side &&
      f.life > 0 &&
      Math.abs(f.x - u.x) <= SMOKE_SCREEN_RANGE
    ) {
      state.smoke_screen = true;
      break;
    }
  }

  // Supply run: a friendly supply team within 210px keeps a heavy weapon
  // team fed, speeding its reload 1.6x. Only weapon teams receive it; the
  // supply team itself has no use for the bonus.
  if (isWeaponTeam(u)) {
    nearUnits(s, u.x, SUPPLY_RUN_RANGE, scratch);
    for (let i = 0; i < scratch.length; i++) {
      const v = scratch[i];
      if (
        v.side === side &&
        providerAlive(v) &&
        v.id === 'supply_team' &&
        Math.abs(v.x - u.x) <= SUPPLY_RUN_RANGE
      ) {
        state.supply_run = true;
        providers.supply_run = v.uid;
        break;
      }
    }
  }

  return { state, providers, at: now };
}

function entryFor(s: GameState, u: Unit, now: number): Entry {
  let map = cache.get(s);
  if (!map) {
    map = new Map<number, Entry>();
    cache.set(s, map);
  }
  // Stagger refreshes by uid so a 400-unit army doesn't recompute all
  // synergies on the same tick.
  const stagger = REFRESH + (u.uid % 5) * 0.05;
  let entry = map.get(u.uid);
  if (!entry) {
    entry = compute(s, u, now);
    map.set(u.uid, entry);
  } else if (now - entry.at >= stagger) {
    // Keep the table from growing without bound on a long battlefield with
    // lots of churn: drop uids that no longer exist before recomputing.
    if (map.size > s.units.length * 2 + 32) {
      const alive = new Set<number>();
      for (const v of s.units) alive.add(v.uid);
      for (const key of map.keys()) {
        if (!alive.has(key)) map.delete(key);
      }
    }
    entry = compute(s, u, now);
    map.set(u.uid, entry);
  }
  return entry;
}

/**
 * Synergy state for a unit. Units that are neither infantry nor heavy weapon
 * teams always return the frozen NONE object; everyone else is cached on a
 * staggered refresh cycle.
 */
export function unitSynergy(s: GameState, u: Unit, now: number): SynergyState {
  if (!isInfantry(u) && !isWeaponTeam(u)) return NONE;
  return entryFor(s, u, now).state;
}

/**
 * Uid of the provider currently powering `kind` for `u`, if any. Used by the
 * renderer to draw the link line between receiver and provider.
 */
export function synergyProviderUid(
  s: GameState,
  u: Unit,
  kind: SynergyKind,
  now: number,
): number | undefined {
  if (!isInfantry(u) && !isWeaponTeam(u)) return undefined;
  return entryFor(s, u, now).providers[kind];
}
