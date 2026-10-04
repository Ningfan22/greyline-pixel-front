import { loadBattleArt } from '../game/art';
import { drawArticulatedGun } from '../game/gun-art';
import { drawHelicopter } from '../game/weapon-art-v204';
import { gunMount } from '../game/gun-geometry';
import { setSquadOrder } from '../game/squad-orders';
import { render } from '../game/render';
import {
  createGame,
  startGame,
  spawnUnit,
  refreshVision,
  tick,
  CARDS,
  type CardId,
  type Unit,
} from '../game/engine';
const canvas = document.querySelector<HTMLCanvasElement>('#view')!,
  ctx = canvas.getContext('2d')!,
  status = document.querySelector('#status')!;
const began = performance.now(),
  art = await loadBattleArt('greyline'),
  loadMs = Math.round(performance.now() - began);
let mode = 'parts',
  paused = false,
  phase = 0,
  last = performance.now(),
  facing = 1,
  camera = 400;
let state = createGame(208),
  actors: Unit[] = [],
  initial = new Map<number, number>(),
  ports = new Set<number>(),
  starts = new Map<number, number>();
function watch(u: Unit) {
  Object.assign(u, {
    squadOrder: 'watch',
    squadOrderX: u.x,
    squadOrderUntil: Infinity,
    emplaced: true,
    emplacementSetupUntil: 0,
  });
}
function spawn(side: 0 | 1, id: CardId, x: number) {
  const n = state.units.length;
  spawnUnit(state, side, id, x);
  return state.units[n];
}
function scene(next: string) {
  mode = next;
  paused = false;
  state = createGame(208, undefined, undefined, undefined, { weather: false });
  startGame(state);
  Object.assign(state, {
    units: [],
    scenery: [],
    walls: [],
    wrecks: [],
    aiIn: 1e9,
    night: false,
  });
  state.terrain.fill(374);
  state.original.fill(374);
  state.terrainVersion++;
  state.weather.disabled = true;
  actors = [];
  ports = new Set();
  for (const p of state.players)
    Object.assign(p, { hand: [], deck: [], discard: [], energy: 0 });
  if (next === 'garrison') {
    const fort = spawn(0, 'fort_bunker', 200); fort.buildUntil = 0;
    const n = state.units.length; spawn(0, 'infantry', 200);
    actors = state.units.slice(n);
    setSquadOrder(state, 0, actors[0].squad, 'attack');
    for (let i = 0; i < 12; i++) tick(state, 1 / 60);
    paused = true; camera = 40;
  } else if (next === 'wreck') {
    const vehicle = spawn(1, 'tank', 1350); vehicle.hp = 1; vehicle.cooldown = 1e9;
    state.projectiles.push({uid: ++state.uid, x: 1350, y: 350, startX: 1350,
      startY: 350, tx: 1350, ty: 350, side: 0, targetUid: vehicle.uid, base: null,
      damage: 10, radius: 0, shell: false, ammunition: 'ap', life: .01, total: .01});
    for (let i = 0; i < 20; i++) tick(state, 1 / 60);
    for (const u of state.units.filter(u => u.bailoutUntil !== undefined)) {
      watch(u); Object.assign(u, {cooldown: 1e9, personalMorale: 100});
    }
    const tank = spawn(0, 'tank', 760); tank.pace = 1; tank.cooldown = 0;
    watch(spawn(0, 'scouts', 1450));
    actors = [tank]; camera = 600; paused = true;
  } else if (next === 'flame') {
    const n = state.units.length;
    spawn(0, 'flame_team', 850);
    actors = state.units.slice(n);
    for (const u of actors) watch(u);
    const target = spawn(1, 'infantry', 965);
    watch(target);
    for (const u of state.units.filter((u) => u.side === 1))
      Object.assign(u, {
        hp: 1e6,
        maxHp: 1e6,
        cooldown: 1e9,
        secondaryCooldown: 1e9,
      });
    camera = 760;
  } else if (next === 'salvo') {
    const battery = spawn(0, 'mlrs', 750),
      spotter = spawn(0, 'pathfinders', 1270),
      target = spawn(1, 'barrage', 1470);
    watch(battery);
    watch(spotter);
    watch(target);
    Object.assign(target, { hp: 1e6, maxHp: 1e6, cooldown: 1e9 });
    actors = [battery];
    camera = 450;
  } else if (next === 'heli') {
    const heli = spawn(0, 'helicopter', 850),
      rockets = spawn(0, 'rocket_heli', 1130);
    Object.assign(heli, { altitude: 160, orbitX: 850, orbitUntil: Infinity });
    Object.assign(rockets, {
      altitude: 180,
      orbitX: 1130,
      orbitUntil: Infinity,
    });
    actors = [heli, rockets];
    camera = 600;
    for (const x of [1030, 1280]) {
      const t = spawn(1, 'ifv', x);
      watch(t);
      Object.assign(t, {
        hp: 1e6,
        maxHp: 1e6,
        cooldown: 1e9,
        secondaryCooldown: 1e9,
      });
    }
    spawn(0, 'pathfinders', 1230);
    const n = state.units.length;
    spawn(1, 'infantry', 1010);
    for (const u of state.units.slice(n)) {
      watch(u);
      Object.assign(u, { hp: 1e6, maxHp: 1e6, cooldown: 1e9 });
    }
  } else {
    actors = [spawn(0, 'strike_jet', 900)];
    camera = 500;
    Object.assign(actors[0], { x: 900, y: 185, altitude: 189 });
  }
  starts = new Map(actors.map(u => [u.uid, u.x]));
  initial = new Map(actors.map((u) => [u.uid, u.shots]));
  refreshVision(state);
  state.knownTerrain[0] = [...state.terrain];
}
document.querySelector<HTMLButtonElement>('#step')!.onclick = () => {
  if (mode === 'parts' || mode === 'fog') return;
  for (let i = 0; i < 60; i++) {
    tick(state, 1 / 60);
    for (const p of state.projectiles)
      if (p.sourceCardId === 'mlrs' && p.launcherTube !== undefined)
        ports.add(p.launcherTube);
  }
  paused = true;
};
document.querySelector<HTMLButtonElement>('#step10')!.onclick = () => {
  if (mode === 'parts' || mode === 'fog') return;
  for (let i = 0; i < 600; i++) tick(state, 1 / 60);
  paused = true;
};
document.querySelector<HTMLButtonElement>('#depart')!.onclick = () => {
  if (mode !== 'garrison') return;
  for (const squad of new Set(actors.map(u => u.squad))) setSquadOrder(state, 0, squad, 'attack');
};
for (const id of ['flame', 'salvo', 'heli', 'fog', 'wreck', 'garrison'])
  document.querySelector<HTMLButtonElement>('#' + id)!.onclick = () =>
    scene(id);
document.querySelector<HTMLButtonElement>('#parts')!.onclick = () => {
  mode = 'parts';
  paused = false;
};
document.querySelector<HTMLButtonElement>('#flip')!.onclick = () => {
  facing = -facing;
};
document.querySelector<HTMLButtonElement>('#pause')!.onclick = () => {
  paused = !paused;
};
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!paused) phase += dt;
  ctx.clearRect(0, 0, 1050, 580);
  if (mode === 'parts') {
    ctx.fillStyle = '#717966';
    ctx.fillRect(0, 0, 1050, 580);
    const ids: CardId[] = [
      'field_gun',
      'artillery',
      'siege_gun',
      'mlrs',
      'helicopter',
      'rocket_heli',
    ];
    for (const [i, id] of ids.entries()) {
      const x = [150, 445, 770][i % 3],
        y = i < 3 ? 245 : 485,
        mount = gunMount(id)!;
      const u = {
        id,
        x,
        y,
        facing,
        gunFacing: facing,
        gunElevation:
          mount.minElevation +
          (mount.maxElevation - mount.minElevation) *
            (0.5 + 0.5 * Math.sin(phase * 0.8)),
      };
      if (id === 'helicopter' || id === 'rocket_heli')
        drawHelicopter(ctx, art.helicopterParts!, u, phase);
      else
        drawArticulatedGun(
          ctx,
          art.gunParts![id] ?? art.gunParts![CARDS[id].emplacement!],
          u,
        );
      ctx.fillStyle = '#f7f1da';
      ctx.font = '15px system-ui';
      ctx.fillText(CARDS[id].name, x - 65, y + 35);
    }
    status.textContent = `素材就绪 ${loadMs} 毫秒 · 轻型105毫米 / 中型榴弹炮 / 重型203毫米 · 发射架和机载武器独立俯仰`;
  } else {
    if (!paused && mode !== 'fog' && state.time < 50) tick(state, dt);
    if (mode === 'fog') state.sight[0].fill(false);
    for (const p of state.projectiles)
      if (p.sourceCardId === 'mlrs' && p.launcherTube !== undefined)
        ports.add(p.launcherTube);
    ctx.save();
    if (mode === 'flame') {
      // Show the actual battlefield at the player's close inspection scale.
      ctx.translate(0, -250);
      ctx.scale(2, 2);
    }
    render(ctx, state, art, null, null, true, camera, mode === 'flame' ? 525 : 1050);
    ctx.restore();
    status.textContent =
      `${state.time.toFixed(1)}秒 · ` +
      actors
        .map(
          (u) =>
            `${CARDS[u.id].name}：发射 ${u.shots - (initial.get(u.uid) ?? 0)}${(u.ammo ?? -1) >= 0 ? '，待发 ' + u.ammo + '，备弹 ' + (u.ammoReserve ?? 0) : ''}${(u.reloadingUntil ?? 0) > state.time ? '，装填 ' + Math.ceil(u.reloadingUntil! - state.time) + '秒' : ''}`,
        )
        .join(' ｜ ') +
      (mode === 'wreck'
        ? ` · 已前进 ${Math.round(actors[0].x - (starts.get(actors[0].uid) ?? 0))}像素 · 敌方幸存兵 ${state.units.filter(u => u.side === 1 && u.hp > 0 && !u.wounded && !u.surrendered).length}`
        : mode === 'garrison'
          ? ` · 驻防 ${actors.filter(u => u.garrisonUid !== undefined).length}人 · 已离开工事 ${actors.filter(u => u.x > 260).length}人`
        : mode === 'salvo'
        ? ` · 已使用管口 ${ports.size}/16`
        : mode === 'fog'
          ? ' · 地面未观察区域为灰色，存活飞机保持原色'
          : '');
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
