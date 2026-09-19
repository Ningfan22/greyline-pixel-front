import type { Blast } from './engine';

export function blastDuration(kind: Blast['kind']) {
  return kind === 'penetration' ? .24 : kind === 'grenade' ? 1.25 :
    kind === 'air' ? 1.6 : kind === 'crash' ? 3.2 : 5;
}
const EXPANSION_BEATS = [0,.012,.026,.044,.066,.095,.13,.175,.22,.29,.38,.48,.59,.71,.84,.94];
const PENETRATION_BEATS = [0,.025,.05,.08,.11,.145,.18,.215].map(t=>t/.24);
/** Same lifetime as simulation. Art may not cut off early/late because of a seed. */
export function blastFrameAt(b: Pick<Blast,'kind'|'age'>, count: number) {
  const duration = blastDuration(b.kind), phase = Math.max(0,b.age/duration);
  const beats = b.kind === 'penetration' ? PENETRATION_BEATS : EXPANSION_BEATS;
  let index = 0;
  while (index < count-1 && phase >= (beats[index+1] ?? 1)) index++;
  const next = beats[index+1] ?? 1;
  return {index, blend: index < count-1 ? Math.max(0,Math.min(1,(phase-beats[index])/(next-beats[index]))) : 0,
    alpha: Math.max(0,Math.min(1,(1-phase)/.16))};
}
