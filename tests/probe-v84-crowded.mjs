import * as engine from '../game/engine.ts';
import { CARDS } from '../game/cards.ts';
import { tacticalObservation } from './helpers/tactical-observations.mjs';

const { visibleToSide, isCombatant } = engine;

function instrument(side) {
  const events = [];
  const aidSeen = new Set();
  const prevDisp = new Map();
  let frame = 0;
  const observed = {
    ...engine,
    tick(s, dt) {
      engine.tick(s, dt);
      const now = s.time;
      for (const u of s.units) {
        if (u.side !== side) continue;
        if (u.firstAidUntil !== undefined && !aidSeen.has(u.uid)) {
          aidSeen.add(u.uid);
          const foes = s.units
            .filter((v) => v.side !== side && isCombatant(v))
            .sort((a, b) => Math.abs(a.x - u.x) - Math.abs(b.x - u.x));
          const near = foes[0];
          events.push({
            kind: 'aid-start',
            t: +now.toFixed(2),
            uid: u.uid,
            x: Math.round(u.x),
            foeX: near ? Math.round(near.x) : null,
            foeDx: near ? Math.round(Math.abs(near.x - u.x)) : null,
            foeVisible: near ? visibleToSide(s, side, near) : null,
          });
        }
        const hadDisp = prevDisp.get(u.uid) === true;
        const hasDisp = u.dispersionGoal !== undefined;
        if (hasDisp && !hadDisp) {
          events.push({
            kind: 'dispersion',
            t: +now.toFixed(2),
            uid: u.uid,
            from: Math.round(u.x),
            goal: Math.round(u.dispersionGoal),
          });
        }
        prevDisp.set(u.uid, hasDisp);
      }
      frame++;
    },
  };
  return { observed, events };
}

for (const side of [1, 0]) {
  const { observed, events } = instrument(side);
  const r = tacticalObservation(observed, CARDS, 7, side, 'crowded', 12);
  console.log(
    `side=${side} avgCluster=${r.averageCluster.toFixed(2)} finalCluster=${r.finalCluster} shots=${r.shots} covered=${r.covered} alive=${r.alive} wounded=${r.wounded}`,
  );
  const aids = events.filter((e) => e.kind === 'aid-start');
  const disps = events.filter((e) => e.kind === 'dispersion');
  console.log(`  aid-starts=${aids.length} dispersions=${disps.length}`);
  for (const e of aids.slice(0, 12)) console.log(`  AID`, JSON.stringify(e));
}
