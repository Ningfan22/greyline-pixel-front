import { CARDS, type Card } from './cards';
import type { GameState, Side, Unit } from './engine';
import { setSquadOrder } from './squad-orders';

export interface ComebackState {
  gas?: { side: Side; start: number; end: number; nextTick: number };
  reserves: { side: Side; at: number; remaining: number }[];
  withdrawing: { uid: number; x: number; until: number }[];
}
interface Hooks {
  damage: (
    s: GameState,
    u: Unit,
    damage: number,
    side: Side,
    cover: number,
    source: 'gas',
  ) => void;
  spawn: (s: GameState, side: Side, id: 'militia', x: number) => void;
  draw: (s: GameState, side: Side, count: number) => void;
}
const active = (u: Unit) =>
  u.hp > 0 &&
  !u.wounded &&
  !u.surrendered &&
  !u.rappelling &&
  !!CARDS[u.id].members;
const state = (s: GameState) =>
  (s.comeback ??= { reserves: [], withdrawing: [] });

export function comebackBlock(
  s: GameState,
  side: Side,
  effect: Card['comeback'],
) {
  if (effect === 'gas' && s.comeback?.gas && s.comeback.gas.end > s.time)
    return '毒气封锁尚未结束';
  if (effect === 'reserve' && s.comeback?.reserves.some((r) => r.side === side))
    return '预备队正在赶来';
  if (
    effect === 'withdrawal' &&
    !s.units.some((u) => u.side === side && active(u))
  )
    return '没有能撤收的步兵';
  return null;
}

export function applyComeback(
  s: GameState,
  side: Side,
  effect: Card['comeback'],
) {
  const c = state(s);
  if (effect === 'gas')
    c.gas = { side, start: s.time + 3, end: s.time + 11, nextTick: s.time + 4 };
  if (effect === 'reserve')
    c.reserves.push({ side, at: s.time + 6, remaining: 2 });
  if (effect === 'withdrawal') {
    const own = s.units.filter((u) => u.side === side && active(u));
    for (const squad of new Set(own.map((u) => u.squad))) {
      const members = own.filter((u) => u.squad === squad);
      const x = members.reduce((n, u) => n + u.x, 0) / members.length;
      s.smokes.push({ x, life: 8, side });
      setSquadOrder(s, side, squad, 'retreat');
      for (const u of members) {
        c.withdrawing = c.withdrawing.filter((v) => v.uid !== u.uid);
        c.withdrawing.push({
          uid: u.uid,
          x: u.squadOrderX!,
          until: s.time + 20,
        });
      }
    }
  }
}

export function updateComeback(s: GameState, hooks: Hooks) {
  const c = s.comeback;
  if (!c) return;
  if (c.gas) {
    while (
      c.gas.nextTick <= s.time + 1e-6 &&
      c.gas.nextTick <= c.gas.end + 1e-6
    ) {
      for (const u of s.units)
        if (
          u.hp > 0 &&
          !u.surrendered &&
          !u.rappelling &&
          CARDS[u.id].members &&
          u.x > 120 &&
          u.x < s.terrain.length - 120
        ) {
          hooks.damage(s, u, 2.6, c.gas.side, 0, 'gas');
        }
      c.gas.nextTick += 1;
    }
    if (s.time >= c.gas.end) c.gas = undefined;
  }
  for (const reserve of c.reserves)
    if (s.time >= reserve.at) {
      hooks.spawn(
        s,
        reserve.side,
        'militia',
        reserve.side === 0 ? 125 : s.terrain.length - 125,
      );
      reserve.at += 2;
      if (--reserve.remaining === 0) hooks.draw(s, reserve.side, 1);
    }
  c.reserves = c.reserves.filter((r) => r.remaining > 0);
  c.withdrawing = c.withdrawing.filter((v) => {
    const u = s.units.find((u) => u.uid === v.uid);
    if (
      !u ||
      !active(u) ||
      s.time > v.until ||
      (u.squadOrder !== 'retreat' && u.squadOrder !== 'watch')
    )
      return false;
    if (Math.abs(u.x - v.x) > 12) return true;
    u.hp = Math.min(u.maxHp, u.hp + 8);
    u.personalMorale = Math.min(100, u.personalMorale + 20);
    u.healing = 0.7;
    return false;
  });
}

/** Uses only the AI's already observed enemies. */
export function comebackScore(
  s: GameState,
  side: Side,
  effect: Card['comeback'],
  own: Unit[],
  foes: Unit[],
) {
  if (comebackBlock(s, side, effect)) return -100;
  const foot = own.filter(active);
  if (effect === 'gas') {
    // Wounded allies still breathe gas. Read all own casualties, but only supplied
    // observed enemies; protected HQ occupants offer neither cost nor value.
    const exposed = (u: Unit) =>
      u.hp > 0 &&
      !u.surrendered &&
      !u.rappelling &&
      !!CARDS[u.id].members &&
      u.x > 120 &&
      u.x < s.terrain.length - 120;
    const friends = s.units.filter((u) => u.side === side && exposed(u));
    const targets = foes.filter(exposed);
    const losses = (units: Unit[]) =>
      units.filter((u) => u.hp <= 8 * 2.6).length;
    if (losses(friends) > losses(targets)) return -100;
    return targets.length >= friends.length + 6 &&
      targets.length > friends.length * 1.5
      ? 34
      : -100;
  }
  if (effect === 'withdrawal')
    return foot.filter((u) => u.suppression > 30 || u.hp < u.maxHp * 0.5)
      .length >= 3
      ? 30
      : -100;
  if (effect === 'reserve') return foot.length < 10 ? 24 : -100;
  return -100;
}
