/** Confirmed small-arms wounds. Posture/cover avoid rays in the world;
 * they do not turn an actual body hit into a harmless scratch. */
export function smallArmsHitMultiplier(ammo: string | undefined, infantry: boolean, precision = false): number {
  if (!infantry || precision) return 1;
  return ammo === 'machinegun' ? 3 : ammo === 'rifle' ? 4 : 1;
}
