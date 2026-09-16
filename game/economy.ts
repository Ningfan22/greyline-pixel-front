export type Difficulty = 'standard' | 'veteran' | 'elite';
export interface MatchOptions {
  difficulty?: Difficulty;
  night?: boolean;
  /** Weather cycles (v62). Defaults to on; pass false to keep a clear sky. */
  weather?: boolean;
}
export type EconomyEffect =
  | 'logistics'
  | 'capacity'
  | 'bonds'
  | 'overdraft';
export const DEFAULT_DIFFICULTY: Difficulty = 'veteran';
export const DIFFICULTY_RATE: Record<Difficulty, number> = {
  standard: 1,
  veteran: 1.15,
  elite: 1.3,
};
export const ECONOMY_RULES = {
  initial: 2,
  baseCap: 10,
  maxCap: 14,
  baseInterval: 3.6,
  logisticsStep: 0.3,
  maxLogistics: 2,
  minimumBaseInterval: 3,
  bondDelay: 18,
  bondPayout: 3,
  maxBonds: 2,
  overdraftDuration: 25,
  overdraftPenalty: 1.5,
  overdraftPayout: 5,
  suppressPenalty: 2,
} as const;
export interface EconomyPlayer {
  energy: number;
  difficulty: Difficulty;
  economyRate: number;
  energyCap: number;
  logisticsLevel: number;
  bondUses: number;
  bondDueAt: number | null;
  overdraftUntil: number | null;
  /** Enemy electronic suppression: recharge interval multiplied while active. */
  suppressedUntil: number | null;
}
type EconomyMatch = { time: number; players: EconomyPlayer[] };
export function initialEconomy(
  side: 0 | 1,
  options: MatchOptions = {},
): EconomyPlayer {
  const difficulty =
    options.difficulty === 'standard' || options.difficulty === 'elite'
      ? options.difficulty
      : DEFAULT_DIFFICULTY;
  return {
    energy: ECONOMY_RULES.initial,
    difficulty,
    economyRate: side === 1 ? DIFFICULTY_RATE[difficulty] : 1,
    energyCap: ECONOMY_RULES.baseCap,
    logisticsLevel: 0,
    bondUses: 0,
    bondDueAt: null,
    overdraftUntil: null,
    suppressedUntil: null,
  };
}
export function energyLimit(p: Pick<EconomyPlayer, 'energyCap'>): number {
  return Math.max(
    ECONOMY_RULES.baseCap,
    Math.min(ECONOMY_RULES.maxCap, p.energyCap ?? ECONOMY_RULES.baseCap),
  );
}
export function energyInterval(s: EconomyMatch, side: 0 | 1): number {
  const p = s.players[side];
  const level = Math.max(
    0,
    Math.min(ECONOMY_RULES.maxLogistics, p.logisticsLevel ?? 0),
  );
  const base = Math.max(
    ECONOMY_RULES.minimumBaseInterval,
    ECONOMY_RULES.baseInterval - level * ECONOMY_RULES.logisticsStep,
  );
  let interval = base / Math.max(1, Math.min(1.3, p.economyRate ?? 1));
  if (p.overdraftUntil != null && p.overdraftUntil > s.time)
    interval *= ECONOMY_RULES.overdraftPenalty;
  if (p.suppressedUntil != null && p.suppressedUntil > s.time)
    interval *= ECONOMY_RULES.suppressPenalty;
  return interval;
}
export function economyBlock(
  p: EconomyPlayer,
  effect: EconomyEffect,
  time: number,
): string | null {
  if (
    effect === 'logistics' &&
    (p.logisticsLevel ?? 0) >= ECONOMY_RULES.maxLogistics
  )
    return '战地后勤已达到两级上限';
  if (effect === 'capacity' && energyLimit(p) >= ECONOMY_RULES.maxCap)
    return '指挥上限已达到14点';
  if (effect === 'bonds') {
    if (p.bondDueAt != null) return '已有一笔公债等待结算';
    if ((p.bondUses ?? 0) >= ECONOMY_RULES.maxBonds)
      return '本局公债已使用两次';
  }
  if (
    effect === 'overdraft' &&
    p.overdraftUntil != null &&
    p.overdraftUntil > time
  )
    return '透支补给尚未结清';
  return null;
}
/** Called only after playCard validates and pays its normal card cost. */
export function applyEconomy(
  p: EconomyPlayer,
  effect: EconomyEffect,
  time: number,
): void {
  if (effect === 'logistics') p.logisticsLevel = (p.logisticsLevel ?? 0) + 1;
  else if (effect === 'capacity')
    p.energyCap = Math.min(ECONOMY_RULES.maxCap, energyLimit(p) + 2);
  else if (effect === 'bonds') {
    p.bondUses = (p.bondUses ?? 0) + 1;
    p.bondDueAt = time + ECONOMY_RULES.bondDelay;
  } else {
    p.overdraftUntil = time + ECONOMY_RULES.overdraftDuration;
    p.energy = p.energy + ECONOMY_RULES.overdraftPayout;
  }
}
export function updateEconomy(s: EconomyMatch, side: 0 | 1, dt: number): void {
  const p = s.players[side];
  p.energy = Math.min(energyLimit(p), p.energy + dt / energyInterval(s, side));
  if (p.bondDueAt != null && s.time + 1e-8 >= p.bondDueAt) {
    p.energy = Math.min(energyLimit(p), p.energy + ECONOMY_RULES.bondPayout);
    p.bondDueAt = null;
  }
}
