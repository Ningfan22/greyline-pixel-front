export function targetExchange(engine, side, weapon, options = {}) {
  const {
    createGame,
    startGame,
    spawnUnit,
    tick,
    refreshVision,
    W,
    CARDS,
    pointVisible,
  } = engine;
  const s = createGame(733);
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
  s.players.forEach((p) => (p.order = 'hold'));
  const x = (value) => (side ? W - value : value);
  function add(team, id, at, member = 0) {
    spawnUnit(s, team, id, x(at), CARDS[id].members ? { member } : undefined);
    const u = s.units.at(-1);
    if (CARDS[id].members) {
      u.squadOrder = 'watch';
      u.squadOrderX = u.x;
    }
    return u;
  }
  const shooter = add(side, weapon, 1300, options.member ?? 0);
  shooter.cooldown = 0;
  const specialist = options.specialist;
  const armor = add(
    1 - side,
    specialist === 'air' ? 'helicopter' : 'tank',
    specialist ? 1640 : 1480,
  );
  const soft = add(
    1 - side,
    options.softId ?? 'infantry',
    specialist ? 1510 : 1050,
  );
  // Hold receiving units' weapons to isolate target choice, without changing either side's health or damage.
  for (const u of [armor, soft]) u.cooldown = u.secondaryCooldown = 1e6;
  if (options.obstruction === 'terrain') {
    for (let at = 1160; at <= 1190; at++)
      s.terrain[Math.round(x(at))] = s.original[Math.round(x(at))] = 300;
    // A nearby friendly observer sees this target, while the tested gun has a blocked ray.
    const observer = add(side, 'scouts', 1010);
    observer.cooldown = observer.secondaryCooldown = 1e6;
  }
  if (options.obstruction === 'smoke')
    s.smokes.push({ x: x(1175), life: 20, side: 1 - side });
  refreshVision(s);
  const initialSoft = soft.hp,
    initialArmor = armor.hp;
  const softVisible = pointVisible(s, side, soft.x, soft.y - 25);
  const shots = [],
    seen = new Set();
  for (let frame = 0; frame < 8 * 120; frame++) {
    tick(s, 1 / 120);
    for (const p of s.projectiles) {
      if (p.sourceUid !== shooter.uid || p.weapon === 'coax' || seen.has(p.uid))
        continue;
      seen.add(p.uid);
      shots.push({
        target:
          p.targetUid === soft.uid
            ? 'soft'
            : p.targetUid === armor.uid
              ? 'armor'
              : 'other',
        ammo: p.ammunition,
        softAlive: engine.isCombatant(soft),
        at: s.time,
      });
    }
  }
  return {
    side,
    weapon,
    ...options,
    softVisible,
    shots,
    softDamage: initialSoft - Math.max(0, soft.hp),
    armorDamage: initialArmor - Math.max(0, armor.hp),
    shooterDamage: shooter.maxHp - Math.max(0, shooter.hp),
  };
}
