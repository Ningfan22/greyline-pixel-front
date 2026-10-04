import {drawProjectile} from '../game/ballistics';
import {wreckKind} from '../game/wreck-geometry';
import {unitFrame,unitSize} from '../game/art';
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
let mode = 'vehicles',
  capture = false,
  paused = false,
  phase = 0,
  last = performance.now(),
  facing = 1,
  camera = 400;
let state = createGame(210),
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
  state = createGame(210, undefined, undefined, undefined, { weather: false });
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
  if (['lethality','withdraw','shelter'].includes(next)) {
    camera=800;capture=false;
    const n=state.units.length;spawn(0,'infantry',1200);
    const own=state.units.slice(n);
    if(next!=='withdraw') state.units=state.units.filter(u=>!own.includes(u)||u===own[0]);
    actors=next==='withdraw'?own:[own[0]];
    for(const [i,u] of actors.entries()) Object.assign(u,{x:1200-i*18,y:374,lane:i%4*12,
      pose:'idle',stanceLockUntil:60,decisionIn:0,personalMorale:100,pace:1,fragCooldown:1e9,
      cooldown:next==='lethality'?1e9:0,readyAt:-10,rifleReady:1});
    if(next==='lethality')watch(actors[0]);
    if(next==='shelter'){
      for(let x=1170;x<=1210;x++)state.terrain[x]=374+Math.max(0,15-Math.abs(1190-x)*.75);
      state.terrainVersion++;actors[0].y=state.terrain[Math.floor(actors[0].x)];
    }
    for(let i=0;i<(next==='withdraw'?3:1);i++) {
      const x=next==='withdraw'?1550+i*30:1450;
      const before=state.units.length,mg=spawn(1,'machinegun',x);
      state.units.splice(before+1);watch(mg);
      Object.assign(mg,{x,y:374,lane:i*12,pose:'prone',
        stanceLockUntil:60,personalMorale:100,cooldown:next==='withdraw'?.9:0,
        emplaced:true,emplacementSetupUntil:0,readyAt:-10,rifleReady:1});
      actors.push(mg);
    }
    paused=true;
  } else if (['tow','sam','javelin'].includes(next)) {
    const id:CardId=next==='tow'?'tow_ifv':next==='sam'?'sam_vehicle':'javelin';
    const shooter=spawn(0,id,720);watch(shooter);shooter.cooldown=0;
    const n=state.units.length;spawn(0,'pathfinders',1130);
    for(const u of state.units.slice(n)){watch(u);u.cooldown=1e9;}
    const target=spawn(1,next==='sam'?'helicopter':'heavy_tank',1350);
    watch(target);Object.assign(target,{hp:1e6,maxHp:1e6,cooldown:1e9,secondaryCooldown:1e9,orbitX:1350});
    actors=[shooter];camera=480;capture=true;
  } else if (next === 'garrison') {
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
for (const id of ['flame', 'salvo', 'heli', 'fog', 'wreck', 'garrison', 'tow', 'sam', 'javelin','lethality','withdraw','shelter'])
  document.querySelector<HTMLButtonElement>('#' + id)!.onclick = () =>
    scene(id);
document.querySelector<HTMLButtonElement>('#vehiclewrecks')!.onclick = () => {mode='vehiclewrecks';paused=false;};
document.querySelector<HTMLButtonElement>('#vehicles')!.onclick = () => { mode='vehicles';paused=false; };
document.querySelector<HTMLButtonElement>('#capture')!.onclick = () => {capture=true;paused=false;};
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
  if(mode==='vehicles'||mode==='vehiclewrecks') {
    ctx.fillStyle='#717966';ctx.fillRect(0,0,1050,580);
    const ids:CardId[]=['ifv','tow_ifv','sam_vehicle','scout_car','mortar_carrier','recovery_vehicle','command_vehicle','mine_clearer','mlrs'];
    for(const [i,id] of ids.entries()) {
      const dead=mode==='vehiclewrecks',image=dead?art.wrecks[wreckKind(id)]:unitFrame(art,id),[width,height]=dead?[image.width,image.height]:unitSize(id),x=175+(i%3)*350,y=150+Math.floor(i/3)*150;
      ctx.imageSmoothingEnabled=false;ctx.save();ctx.translate(x,y);ctx.scale(facing,1);if(!dead&&art.gunParts?.[id])drawArticulatedGun(ctx,art.gunParts[id],{id,x:0,y:0,facing:1});else ctx.drawImage(image,-width/2,-height,width,height);ctx.restore();
      ctx.fillStyle='#eee8ce';ctx.font='14px system-ui';ctx.fillText(CARDS[id].name,x-80,y+25);
    }
    const families=['tow','antitank','antiair'] as const;
    for(const [i,family] of families.entries()) {
      const frame=art.weaponEffects!.missiles![family]!;ctx.drawImage(frame,120+i*340,510,frame.width*3,frame.height*3);
      ctx.fillText(['陶式导弹','便携反坦克导弹','防空导弹'][i],120+i*340,557);
    }
    status.textContent=`素材就绪 ${loadMs} 毫秒 · 9种载具独立战场素材 · 导弹弹身、尾翼、发动机尾焰`;
  } else if (mode === 'parts') {
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
    if(capture&&state.projectiles.some(p=>p.sourceUid===actors[0]?.uid&&p.ammunition==='rocket'&&Math.hypot(p.x-p.startX,p.y-p.startY)>110)){paused=true;capture=false;}

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
    if(['tow','sam','javelin'].includes(mode)) {
      const p=state.projectiles.find(p=>p.sourceUid===actors[0]?.uid&&p.ammunition==='rocket');
      if(p){ctx.fillStyle='#717966';ctx.fillRect(15,420,365,145);ctx.fillStyle='#eee8ce';ctx.font='14px system-ui';ctx.fillText('当前飞行弹体 ×4（实际精灵与飞行朝向）',25,441);
      const heading=p.heading??0, frame=art.weaponEffects!.missiles![mode==='tow'?'tow':mode==='sam'?'antiair':'antitank']!;
      ctx.save();ctx.translate(195,500);ctx.scale(4,4);drawProjectile(ctx,{...p,x:Math.cos(heading)*frame.width/2,y:Math.sin(heading)*frame.width/2,heading},art.weaponEffects);ctx.restore();}
    }
    status.textContent =
      `${state.time.toFixed(1)}秒 · ` +
      actors
        .map(
          (u) =>
            `${CARDS[u.id].name}：发射 ${u.shots - (initial.get(u.uid) ?? 0)}${(u.ammo ?? -1) >= 0 ? '，待发 ' + u.ammo + '，备弹 ' + (u.ammoReserve ?? 0) : ''}${(u.reloadingUntil ?? 0) > state.time ? '，装填 ' + Math.ceil(u.reloadingUntil! - state.time) + '秒' : ''}`,
        )
        .join(' ｜ ') +
      (['lethality','withdraw','shelter'].includes(mode)
        ? ' | '+actors.filter(u=>u.side===0).map(u=>`HP ${Math.max(0,u.hp).toFixed(1)}/${u.maxHp.toFixed(0)}, ${u.pose}, retreat ${Math.round((starts.get(u.uid)??u.x)-u.x)}px, ${u.wounded?'wounded':u.hp<=0?'down':'active'}`).join(' | ')
        : mode === 'wreck'
        ? ` · 已前进 ${Math.round(actors[0].x - (starts.get(actors[0].uid) ?? 0))}像素 · 敌方幸存兵 ${state.units.filter(u => u.side === 1 && u.hp > 0 && !u.wounded && !u.surrendered).length}`
        : mode === 'garrison'
          ? ` · 驻防 ${actors.filter(u => u.garrisonUid !== undefined).length}人 · 已离开工事 ${actors.filter(u => u.x > 260).length}人`
        : mode === 'salvo'
        ? ` · 已使用管口 ${ports.size}/16`
        : mode === 'fog'
          ? ' · 地面未观察区域为灰色，存活飞机保持原色'
          : ['tow','sam','javelin'].includes(mode) ? ` · 飞行中导弹 ${state.projectiles.filter(p=>p.ammunition==='rocket').length} · ${paused?'已暂停，可检查弹体与发射口':'交战中'}` : '');
  }
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
