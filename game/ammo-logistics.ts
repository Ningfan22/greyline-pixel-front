import { CARDS, modelOf } from './cards';
import { ammunition, magazine, type MagazineSpec } from './ballistics';
import { isPrecisionObserver } from './precision-team';
import { isImmobilized } from './vehicle-damage';
import type { GameState, Side, Unit } from './engine';

export interface AmmoCrate {
  uid: number;
  side: Side;
  x: number;
  stock: number;
  maxStock: number;
  landAt: number;
  expiresAt: number;
}
export const AMMO_CRATE_STOCK = 1800;
export const AMMO_CRATE_RADIUS = 120;
export const AMMO_CRATE_LIFE = 180;
export const AMMO_LOW_RATIO = 0.3;
export const SUPPLY_CARRY = 400;
const profiles = new Map<string, { primary: MagazineSpec | null; secondary: MagazineSpec | null }>();

/** Each soldier owns his load. Main gun and sidearm/coax never share a pool. */
export function ammoProfile(u: Pick<Unit, 'id' | 'member'>) {
  const key = `${u.id}:${u.member ?? 0}`;
  if (profiles.has(key)) return profiles.get(key)!;
  const c = CARDS[u.id], kind = ammunition(u.id, u.member);
  let primary = magazine(u.id, u.member);
  if (c.air || c.internal || isPrecisionObserver(u) || !(c.damage! > 0)) primary = null;
  else if (!primary) {
    const count = kind === 'cannon' || kind === 'ap' ? 36
      : kind === 'mortar' ? 30 : kind === 'rocket' ? (c.members ? 6 : 12)
      : kind === 'grenade' ? 24 : kind === 'autocannon' ? 240
      : kind === 'flame' ? 48 : kind === 'machinegun' ? 600 : 180;
    primary = { mag: count, reserve: 0, reload: 0 };
  }
  const secondary = !c.air && u.id !== 'airborne_at' &&
    (modelOf(u.id) === 'tank' || u.id === 'tow_ifv' || c.armorOnly) && primary
    ? c.armorOnly ? { mag: 30, reserve: 90, reload: 2.5 } : { mag: 250, reserve: 750, reload: 4 }
    : null;
  const profile = { primary, secondary };
  profiles.set(key, profile);
  return profile;
}
export function ammoSummary(u: Pick<Unit, 'id' | 'member' | 'ammo' | 'ammoReserve' | 'secondaryAmmo' | 'secondaryAmmoReserve'>) {
  const profile = ammoProfile(u), kind = ammunition(u.id, u.member);
  const names = { cannon: '主炮炮弹', ap: '穿甲弹', mortar: '炮弹', rocket: '火箭弹', grenade: '榴弹', flame: '燃料', autocannon: '机炮弹', machinegun: '机枪弹', rifle: '枪弹', drone: '弹药' };
  return ([['primary', profile.primary, u.ammo, u.ammoReserve], ['secondary', profile.secondary, u.secondaryAmmo, u.secondaryAmmoReserve]] as const)
    .filter((row) => row[1])
    .map(([channel, spec, ready, spare]) => {
      const loaded = ready === undefined ? spec!.mag : Math.max(0, ready);
      const reserve = spare === undefined ? spec!.reserve : Math.max(0, spare);
      const maxTotal = spec!.mag + spec!.reserve;
      return { label: channel === 'secondary' ? CARDS[u.id].armorOnly ? '自卫枪弹' : '同轴机枪弹' : names[kind], channel, loaded, reserve, capacity: spec!.mag, total: loaded + reserve, maxTotal, ratio: (loaded + reserve) / maxTotal };
    });
}
export function ammoRatio(u: Unit) {
  const rows = ammoSummary(u);
  return rows.length ? Math.min(...rows.map((row) => row.ratio)) : 1;
}
export function initializeAmmo(u: Unit) {
  const { primary, secondary } = ammoProfile(u);
  if (u.ammo === undefined) { u.ammo = primary?.mag ?? -1; u.ammoReserve = primary?.reserve ?? 0; }
  if (secondary && u.secondaryAmmo === undefined) { u.secondaryAmmo = secondary.mag; u.secondaryAmmoReserve = secondary.reserve; }
  if (u.id === 'supply_team' && u.supplyStock === undefined) u.supplyStock = SUPPLY_CARRY;
}
export function advanceSecondaryReload(u: Unit, time: number) {
  const spec = ammoProfile(u).secondary;
  if (!spec) return;
  if ((u.secondaryAmmo ?? 0) <= 0 && (u.secondaryAmmoReserve ?? 0) > 0) {
    u.secondaryReloadUntil ??= time + spec.reload;
    if (time >= u.secondaryReloadUntil) {
      const take = Math.min(spec.mag, u.secondaryAmmoReserve!);
      u.secondaryAmmo = take; u.secondaryAmmoReserve! -= take; u.secondaryReloadUntil = undefined;
    }
  }
}
type Source = { x: number; radius: number; stock?: number; unit?: Unit; crate?: AmmoCrate; base?: boolean };
const living = (u: Unit) => u.hp > 0 && !u.wounded && !u.surrendered && !u.parachuting && !u.rappelling;
function sources(s: GameState, u: Unit): Source[] {
  const neededCosts = ammoSummary(u).filter(row => row.total < row.maxTotal)
    .map(row => roundCost(u, row.channel === 'secondary'));
  const minimumCost = neededCosts.length ? Math.min(...neededCosts) : 1;
  const base = { x: u.side === 0 ? 110 : s.terrain.length - 110, radius: 140, base: true };
  return [base,
    ...(s.ammoCrates ?? []).filter((c) => c.side === u.side && c.landAt <= s.time && c.expiresAt > s.time && c.stock >= minimumCost).map((crate) => ({ x: crate.x, radius: AMMO_CRATE_RADIUS, stock: crate.stock, crate })),
    ...s.units.filter((v) => v !== u && v.side === u.side && v.id === 'supply_team' && living(v) && (v.supplyStock ?? SUPPLY_CARRY) >= minimumCost && !v.resupplyState).map((unit) => ({ x: unit.x, radius: 120, stock: unit.supplyStock ?? SUPPLY_CARRY, unit }))];
}
function roundCost(u: Unit, secondary: boolean) {
  if (secondary) return 1;
  const kind = ammunition(u.id, u.member);
  return kind === 'rocket' ? 12 : kind === 'cannon' || kind === 'ap' || kind === 'mortar' ? 6 : kind === 'grenade' ? 3 : 1;
}
function refill(u: Unit, source: Source, dt: number) {
  for (const row of ammoSummary(u)) {
    if (row.total >= row.maxTotal) continue;
    const secondary = row.channel === 'secondary', cost = roundCost(u, secondary);
    const progressKey = secondary ? 'secondarySupplyProgress' : 'ammoSupplyProgress';
    u[progressKey] = (u[progressKey] ?? 0) + dt * (cost > 1 ? 2 : 30);
    const stock = source.base ? Infinity : source.unit ? source.unit.supplyStock ?? SUPPLY_CARRY : source.crate!.stock;
    const give = Math.min(row.maxTotal - row.total, Math.floor(u[progressKey]!), Math.floor(stock / cost));
    if (give <= 0) continue;
    u[progressKey]! -= give;
    const readyKey = secondary ? 'secondaryAmmo' : 'ammo';
    const spareKey = secondary ? 'secondaryAmmoReserve' : 'ammoReserve';
    const loaded = Math.min(give, row.capacity - row.loaded);
    u[readyKey] = row.loaded + loaded; u[spareKey] = row.reserve + give - loaded;
    if (source.unit) source.unit.supplyStock = Math.max(0, stock - give * cost);
    if (source.crate) source.crate.stock = Math.max(0, stock - give * cost);
    if (u.ammo! > 0 && row.channel === 'primary') { u.reloadingUntil = 0; u.tacticalReload = false; }
    if (secondary && u.secondaryAmmo! > 0) u.secondaryReloadUntil = undefined;
  }
}

/** Persistent retreat: a partial magazine or depleted crate cannot turn a unit around. */
export function planAmmoResupply(s: GameState, u: Unit, dt: number): number | null {
  if (!living(u) || CARDS[u.id].air || CARDS[u.id].internal) return null;
  initializeAmmo(u);
  const baseX = u.side === 0 ? 110 : s.terrain.length - 110;
  const needsStock = u.id === 'supply_team' && u.supplyStock! <= SUPPLY_CARRY * AMMO_LOW_RATIO;
  if (u.id === 'supply_team' && Math.abs(u.x - baseX) <= 140)
    u.supplyStock = Math.min(SUPPLY_CARRY, u.supplyStock! + dt * 80);
  if (!u.resupplyState && (ammoRatio(u) <= AMMO_LOW_RATIO || needsStock)) {
    u.resupplyState = 'withdrawing'; u.resupplyReturnX = u.x;
    u.squadOrder = 'attack'; u.squadOrderX = undefined;
    u.squadOrderUntil = Infinity;
    u.escortTankUid = undefined; u.escortGoal = undefined;
    u.coverGoal = null; u.firingGoal = null; u.withdrawGoal = undefined;
    u.garrisonUid = undefined;
  }
  let available = sources(s, u);
  const nearby = available.filter((p) => Math.abs(p.x - u.x) <= p.radius).sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x))[0];
  if (nearby) refill(u, nearby, dt);
  if (!u.resupplyState) return null;
  // A later watch/escort click cannot strand a low-ammo man halfway home.
  u.squadOrder = 'attack'; u.squadOrderX = undefined; u.squadOrderUntil = Infinity;
  u.garrisonUid = undefined;
  if (ammoRatio(u) >= 0.999 && (!needsStock && (u.id !== 'supply_team' || u.supplyStock! >= SUPPLY_CARRY - 0.1))) {
    u.resupplyState = undefined; u.resupplyGoal = undefined;
    u.tactic = 'advance'; u.squadOrder = 'attack'; u.decisionIn = 0;
    u.ammoSupplyProgress = 0; u.secondarySupplyProgress = 0;
    return null;
  }
  available = sources(s, u);
  const direction = u.side === 0 ? 1 : -1;
  const behind = available.filter(p => (p.x - u.x) * direction <= p.radius);
  const source = (needsStock || u.id === 'supply_team' && u.supplyStock! < SUPPLY_CARRY - 0.1)
    ? available[0] : (behind.length ? behind : available).sort((a, b) => Math.max(0, Math.abs(a.x - u.x) - a.radius) - Math.max(0, Math.abs(b.x - u.x) - b.radius))[0];
  u.resupplyGoal = source.x;
  const cannotMove = !!CARDS[u.id].static || isImmobilized(u);
  u.resupplyState = Math.abs(u.x - source.x) <= source.radius ? 'supplying' : cannotMove ? 'waiting' : 'withdrawing';
  if (u.resupplyState === 'waiting') return null;
  return u.resupplyState === 'supplying' ? u.x : source.x;
}
