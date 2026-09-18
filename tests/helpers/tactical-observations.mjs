// The same fixtures run against the saved pre-change engine and the current engine.
// No weapon, HP, morale or injury values are altered. Strategic AI is disabled so
// this experiment measures individual decisions, not deck draws.
export function tacticalObservation(
  engine,
  cards,
  seed,
  side,
  kind,
  seconds = 12,
) {
  const {
    createGame,
    startGame,
    spawnUnit,
    tick,
    refreshVision,
    isCombatant,
    W,
  } = engine;
  const s = createGame(seed, undefined, undefined, undefined, { weather: false });
  startGame(s);
  Object.assign(s, {
    units: [],
    scenery: [],
    walls: [],
    wrecks: [],
    aiIn: 1e9,
  });
  s.terrain.fill(374);
  s.original.fill(374);
  s.knownTerrain = [s.terrain.slice(), s.terrain.slice()];
  s.knownScenery = [{}, {}];
  s.knownWalls = [{}, {}];
  s.players[side].order = 'advance';
  s.players[1 - side].order = 'hold';
  const dir = side ? -1 : 1,
    x = (value) => (side ? W - value : value);
  const add = (team, id, point) => {
    const before = s.units.length;
    spawnUnit(s, team, id, x(point));
    return s.units.slice(before);
  };
  const own = [],
    foes = [],
    support = [];
  const crowded = kind === 'crowded' || kind === 'barrage';
  const groups = ['price', 'gone'].includes(kind) ? 1 : 3;
  for (let g = 0; g < groups; g++) {
    const group = add(
      side,
      kind === 'price' ? 'militia' : 'infantry',
      1200 - g * 70,
    );
    group.forEach((u, i) =>
      Object.assign(u, {
        x: x(crowded ? 1200 + ((i % 3) - 1) : 1200 - g * 70 - i * 22),
        y: 374,
      }),
    );
    own.push(...group);
  }
  const type =
    kind === 'price'
      ? 'sniper'
      : kind.startsWith('tank')
        ? 'tank'
        : kind.startsWith('heli')
          ? 'helicopter'
          : ['strong', 'gone'].includes(kind)
            ? 'machinegun'
            : 'infantry';
  const count =
    kind === 'none'
      ? 0
      : kind === 'price'
        ? 1
        : ['strong', 'gone'].includes(kind)
          ? 4
          : type === 'infantry'
            ? 3
            : 2;
  for (let g = 0; g < count; g++) {
    const group = add(1 - side, type, kind === 'price' ? 1430 : 1480 + g * 30);
    group.forEach((u, i) => {
      if (cards[u.id].members)
        Object.assign(u, {
          x: x((kind === 'price' ? 1430 : 1480) + g * 30 + i * 8),
          y: 374,
          squadOrder: 'watch',
          squadOrderX: u.x,
        });
    });
    foes.push(...group);
  }
  if (kind.endsWith('_support')) {
    const anti = kind.startsWith('tank') ? 'javelin' : 'manpads';
    for (const point of [1160, 1090]) support.push(...add(side, anti, point));
  }
  if (crowded) {
    // A useful natural depression reproduces the real clustered cover position.
    for (let offset = -50; offset <= 50; offset++)
      s.terrain[Math.round(x(1200 + offset))] =
        374 + 24 * Math.max(0, 1 - Math.abs(offset) / 50);
    for (const u of own) u.y = s.terrain[Math.round(u.x)];
  }
  if (kind === 'barrage') {
    for (let g = 0; g < 3; g++) {
      const gun = add(1 - side, 'barrage', 1850 + g * 55)[0];
      gun.cooldown = g * 2;
      foes.push(gun);
    }
    const scouts = add(1 - side, 'scouts', 1500);
    scouts.forEach((u) => {
      u.squadOrder = 'watch';
      u.squadOrderX = u.x;
    });
    foes.push(...scouts);
  }
  refreshVision(s);
  const starts = new Map(
    own.map((u) => [u.uid, { x: u.x, lane: u.lane, shots: u.shots }]),
  );
  const supportShots = support.reduce((n, u) => n + u.shots, 0);
  const previous = new Map(own.map((u) => [u.uid, u.x]));
  let backwards = 0,
    backAfterGone = 0,
    covered = 0,
    uncovered = 0,
    clusterTotal = 0,
    samples = 0,
    maxCluster = 0,
    low = 0,
    active = 0;
  const moved = new Set(),
    plans = new Map(),
    reactions = new Set();
  let allBackFrames = 0;
  const shells = new Set();
  for (let frame = 0; frame < seconds * 60; frame++) {
    if (kind === 'gone' && frame === 150) {
      s.units = own;
      s.projectiles = [];
      refreshVision(s);
    }
    tick(s, 1 / 60);
    const alive = own.filter(isCombatant);
    let backing = 0;
    for (const u of alive) {
      const delta = (u.x - previous.get(u.uid)) * dir;
      if (delta < -0.01) {
        backwards -= delta;
        backing++;
        moved.add(u.uid);
        if (kind === 'gone' && frame > 186) backAfterGone -= delta;
      }
      previous.set(u.uid, u.x);
      active++;
      if (['prone', 'crouch'].includes(u.pose)) low++;
      if (u.withdrawStartedAt !== undefined)
        plans.set(`${u.squad}:${u.withdrawStartedAt}`, true);
      if (u.evadeMarker) reactions.add(`${u.uid}:${u.evadeMarker}`);
    }
    if (backing) {
      if (
        alive.some(
          (u) => !u.moving && s.time - (u.lastCombatShotAt ?? -100) < 1.4,
        )
      )
        covered++;
      else uncovered++;
    }
    if (alive.length > 3 && backing === alive.length) allBackFrames++;
    if (frame % 15 === 0 && alive.length) {
      const cluster = Math.max(
        ...alive.map(
          (u) => alive.filter((v) => Math.abs(v.x - u.x) < 26).length,
        ),
      );
      clusterTotal += cluster;
      samples++;
      maxCluster = Math.max(maxCluster, cluster);
    }
    for (const p of s.projectiles) if (p.shell) shells.add(p.uid);
  }
  const alive = own.filter(isCombatant);
  return {
    seed,
    side,
    kind,
    backwards,
    backAfterGone,
    backers: moved.size,
    plans: plans.size,
    covered,
    uncovered,
    allBackFrames,
    averageCluster: clusterTotal / Math.max(1, samples),
    maxCluster,
    finalCluster: alive.length
      ? Math.max(
          ...alive.map(
            (u) => alive.filter((v) => Math.abs(v.x - u.x) < 26).length,
          ),
        )
      : 0,
    shots: own.reduce((n, u) => n + u.shots - starts.get(u.uid).shots, 0),
    supportShots: support.reduce((n, u) => n + u.shots, 0) - supportShots,
    hp: own.reduce((n, u) => n + Math.max(0, u.hp), 0),
    alive: alive.length,
    wounded: own.filter((u) => u.wounded).length,
    advance:
      own.reduce((n, u) => n + (u.x - starts.get(u.uid).x) * dir, 0) /
      own.length,
    low: low / Math.max(1, active),
    shells: shells.size,
    reactions: reactions.size,
    finalSpread: alive.length
      ? Math.max(...alive.map((u) => u.x)) - Math.min(...alive.map((u) => u.x))
      : 0,
  };
}
