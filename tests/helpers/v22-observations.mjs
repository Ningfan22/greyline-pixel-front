export function arena(api, side, seed = 733) {
  const s = api.createGame(seed, undefined, undefined, undefined, { weather: false });
  api.startGame(s);
  Object.assign(s, {
    units: [],
    scenery: [],
    walls: [],
    wrecks: [],
    aiIn: 1e9,
  });
  s.terrain.fill(374);
  s.original.fill(374);
  s.players[side].order = 'advance';
  s.players[1 - side].order = 'hold';
  return s;
}
export const at = (api, side, x) => (side ? api.W - x : x);
export function add(api, s, side, id, x) {
  const n = s.units.length;
  api.spawnUnit(s, side, id, at(api, side, x));
  return s.units.slice(n);
}
export function overlaps(units) {
  let pairs = 0;
  for (let i = 0; i < units.length; i++)
    for (let j = i + 1; j < units.length; j++)
      if (
        Math.abs(units[i].x - units[j].x) < 12 &&
        Math.abs(units[i].lane - units[j].lane) < 7
      )
        pairs++;
  return pairs;
}
export function withdrawal30(api, side, kind = 'tank') {
  const s = arena(api, side),
    own = [],
    dir = side ? -1 : 1;
  for (let g = 0; g < 4; g++)
    own.push(...add(api, s, side, 'infantry', 1200 - g * 65));
  own.forEach((u, i) => {
    u.x = at(api, side, 1200 - Math.floor(i / 6) * 65 - (i % 6) * 18);
    u.y = 374;
  });
  const foe = add(api, s, 1 - side, kind, api.W - 1510)[0];
  foe.cooldown = foe.secondaryCooldown = 3;
  api.refreshVision(s);
  let idleThreat = 0,
    exposedFrames = 0,
    forward = 0,
    back = 0,
    backShots = 0,
    peakOverlap = 0,
    nearAtEnd = 0;
  const uidSet = new Set(own.map((u) => u.uid)),
    shells = new Set();
  const initial = new Map(own.map((u) => [u.uid, u.x]));
  for (let i = 0; i < 1800; i++) {
    const previous = new Map(own.map((u) => [u.uid, u.x]));
    api.tick(s, 1 / 60);
    const live = own.filter(api.isCombatant);
    peakOverlap = Math.max(peakOverlap, overlaps(live));
    for (const u of live) {
      const delta = (u.x - previous.get(u.uid)) * dir;
      if (u.backpedaling) back += Math.max(0, -delta);
      if (i > 360 && u.personalMorale >= 35) forward += Math.max(0, delta);
      if (
        i > 360 &&
        u.personalMorale >= 35 &&
        Math.abs(foe.x - u.x) < api.unitRange(s, foe) + 30
      ) {
        exposedFrames++;
        if (!u.moving) idleThreat++;
      }
    }
    for (const p of s.projectiles) {
      if (!uidSet.has(p.sourceUid) || shells.has(p.uid)) continue;
      shells.add(p.uid);
      if (own.some((u) => u.backpedaling)) backShots++;
    }
  }
  const live = own.filter(api.isCombatant);
  nearAtEnd = live.filter(
    (u) => Math.abs(foe.x - u.x) < api.unitRange(s, foe) + 60,
  ).length;
  return {
    s,
    own,
    foe,
    metrics: {
      side,
      kind,
      exposedFrames,
      idleThreat,
      forward,
      back,
      backShots,
      peakOverlap,
      nearAtEnd,
      alive: live.length,
      hp: own.reduce((n, u) => n + Math.max(0, u.hp), 0),
      shots: own.reduce((n, u) => n + u.shots - u.member, 0),
      meanRetreat:
        own.reduce((n, u) => n + (initial.get(u.uid) - u.x) * dir, 0) /
        own.length,
    },
  };
}
export function reverseEscort30(api, side) {
  const s = arena(api, side, 411),
    dir = side ? -1 : 1,
    tank = add(api, s, side, 'tank', 2100)[0],
    own = [
      ...add(api, s, side, 'infantry', 1990),
      ...add(api, s, side, 'infantry', 1880),
      ...add(api, s, side, 'infantry', 1800),
    ];
  own.forEach((u, i) => {
    u.x = at(
      api,
      side,
      2100 - (105 + Math.floor(i / 6) * 78 + Math.floor((i % 6) / 2) * 26),
    );
    u.y = 374;
    u.lane = i % 2 ? 18 : -18;
  });
  tank.cooldown = tank.secondaryCooldown = 1e9;
  const foes = [];
  for (let i = 0; i < 3; i++)
    foes.push(...add(api, s, 1 - side, 'infantry', api.W - (2310 + i * 36)));
  foes.forEach((u) => {
    u.squadOrder = 'watch';
    u.squadOrderX = u.x;
    u.cooldown = 1e9;
  });
  api.refreshVision(s);
  let peakOverlap = 0,
    overlapFrames = 0,
    bodyOverlapFrames = 0,
    shots = 0,
    firstBody = null;
  const seen = new Set();
  for (let f = 0; f < 1800; f++) {
    // A known friendly leader follows a commanded reverse path; followers use real tick.
    tank.x = at(api, side, 2100 - Math.min(600, (f / 60) * 40));
    tank.y = 374;
    tank.facing = -dir;
    tank.moving = f < 900;
    api.tick(s, 1 / 60);
    const live = own.filter(api.isCombatant),
      pairs = overlaps(live);
    peakOverlap = Math.max(peakOverlap, pairs);
    overlapFrames += pairs;
    bodyOverlapFrames += live.filter((u) => Math.abs(u.x - tank.x) < 70).length;
    if (!firstBody && live.some((u) => Math.abs(u.x - tank.x) < 70))
      firstBody = {
        time: s.time,
        tankX: tank.x,
        units: live
          .filter((u) => Math.abs(u.x - tank.x) < 70)
          .map((u) => ({
            x: u.x,
            goal: u.escortGoal,
            pose: u.pose,
            moving: u.moving,
            pace: u.pace,
            facing: u.facing,
            lane: u.lane,
            fire: u.fire,
            trafficWait: u.trafficWait,
            passingLane: u.passingLane,
          })),
      };
    for (const p of s.projectiles)
      if (own.some((u) => u.uid === p.sourceUid) && !seen.has(p.uid)) {
        seen.add(p.uid);
        shots++;
      }
  }
  return {
    s,
    own,
    tank,
    metrics: {
      side,
      firstBody,
      peakOverlap,
      overlapFrames,
      bodyOverlapFrames,
      shots,
      finalPairs: overlaps(own),
      meanGap: own.reduce((n, u) => n + (tank.x - u.x) * dir, 0) / own.length,
    },
  };
}
