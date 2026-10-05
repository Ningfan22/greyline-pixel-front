import {createElement} from 'react';
import {createRoot} from 'react-dom/client';
import ContactMapMarks from '../app/contact-map-marks';
import {vehicleFuelRatio} from '../game/vehicle-logistics';
import {snapshot} from '../game/engine';
import UnitLogisticsFan from '../app/unit-logistics-fan';
import SquadMenu from '../app/squad-menu';
import {ordersForUnit,selectUnitGroup} from '../game/squad-orders';
import {issueLogisticsOrder,logisticsAlert} from '../game/logistics-orders';
import {createScenery,visibleToSide} from '../game/world';
import {drawProjectile} from '../game/ballistics';
import {wreckKind,wreckContact} from '../game/wreck-geometry';
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
  playCard,
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
const commandRoot = createRoot(document.querySelector('#commands')!);
let mode = 'vehicles',
  capture = false,
  paused = false,
  phase = 0,
  last = performance.now(),
  facing = 1,
  camera = 400, contactPaintAt=-1;
let state = createGame(217),
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
  commandRoot.render(null);
  paused = false;
  state = createGame(217, undefined, undefined, undefined, { weather: false });
  startGame(state);
  Object.assign(state, {
    units: [],
    scenery: [],
    walls: [],
    wrecks: [],
    knownScenery: [{}, {}],
    knownWalls: [{}, {}],
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
  if(next==='gunfollow') {
    camera=650;paused=true;capture=false;
    const gun=spawn(0,'artillery',900);gun.cooldown=1e9;
    const front=spawn(0,'infantry',1500);
    for(const u of state.units.filter(u=>u.side===0&&u!==gun)){watch(u);u.cooldown=1e9;u.fragCooldown=1e9;}
    actors=[gun,front];
  }else if(['fuelstall','tankaim','rpgheavy','contactmemory'].includes(next)) {
    camera=650;paused=true;capture=false;contactPaintAt=-1;
    if(next==='contactmemory') {
      const observer=spawn(0,'scouts',1000);watch(observer);observer.cooldown=1e9;
      const n=state.units.length,foot=spawn(1,'infantry',1310);state.units.splice(n+1);watch(foot);foot.cooldown=1e9;foot.fragCooldown=1e9;
      const tank=spawn(1,'tank',1540);watch(tank);Object.assign(tank,{cooldown:1e9,secondaryCooldown:1e9});actors=[observer,foot,tank];
    }else {
      const own=spawn(0,next==='rpgheavy'?'antiarmor':'tank',1000);watch(own);Object.assign(own,{cooldown:0,secondaryCooldown:1e9,fuel:next==='fuelstall'?0:100,logisticsOrder:next==='fuelstall'?'resupply':undefined});
      const target=spawn(1,'heavy_tank',1510);watch(target);Object.assign(target,{cooldown:1e9,secondaryCooldown:1e9,hp:10000,maxHp:10000,logisticsOrder:'hold'});
      const observer=spawn(0,'scouts',1050);watch(observer);observer.cooldown=1e9;
      for(const u of state.units.filter(u=>u.side===0&&u!==own)){watch(u);u.cooldown=1e9;u.fragCooldown=1e9;}
      actors=[own,target];
      if(next==='fuelstall'){
        const close=()=>commandRoot.render(null);
        commandRoot.render(createElement(UnitLogisticsFan,{unit:own,reason:logisticsAlert(own)!.reason,x:48,y:63,onClose:close,
          onOrder:order=>{issueLogisticsOrder(state,own.uid,order);close();}}));
      }
    }
  }else if(['towhouse','javelinhouse'].includes(next)) {
    camera=500;paused=true;capture=false;
    state.scenery=createScenery(state.terrain,[{kind:'house',x:1060,seed:215}]);
    const shooter=spawn(0,next==='towhouse'?'tow_ifv':'javelin',720);watch(shooter);shooter.cooldown=0;
    const observer=spawn(0,'scouts',1430);watch(observer);observer.cooldown=1e9;
    const target=spawn(1,'heavy_tank',1420);watch(target);Object.assign(target,{cooldown:1e9,secondaryCooldown:1e9,hp:10000,maxHp:10000});
    actors=[...state.units.filter(u=>u.side===0&&u.id===shooter.id),target];
  } else if(['tankescape','ifvburst','scoutgun','commandgun'].includes(next)) {
    camera=760;paused=true;capture=false;
    if(next==='tankescape') {
      const n=state.units.length;spawn(0,'infantry',1200);
      const own=state.units.slice(n);
      own.forEach((u,i)=>Object.assign(u,{x:1200-i*18,y:374,lane:0,pose:'crouch',stanceLockUntil:60,decisionIn:0,pace:1,personalMorale:100,cooldown:1e9,fragCooldown:1e9}));
      const tank=spawn(1,'tank',1500);watch(tank);Object.assign(tank,{cooldown:1e9,secondaryCooldown:1e9});actors=own;
    }else {
      camera=980;
      const id:CardId=next==='ifvburst'?'ifv':next==='scoutgun'?'scout_car':'command_vehicle';
      const vehicle=spawn(0,id,1100);watch(vehicle);Object.assign(vehicle,{cooldown:0,ammo:100,ammoReserve:100});
      const n=state.units.length;const enemy=spawn(1,'infantry',1420);state.units.splice(n+1);watch(enemy);Object.assign(enemy,{cooldown:1e9,fragCooldown:1e9,maxHp:10000,hp:10000});actors=[vehicle];
    }
  } else if(next==='breach') {
    camera=740;paused=true;capture=false;
    const wreck={id:++state.uid,cardId:'sam_vehicle' as const,side:1 as const,x:1150,y:374,angle:0,age:5,falling:false,vx:0,vy:0};
    Object.assign(wreck,wreckContact(()=>374,wreck));state.wrecks.push(wreck);
    state.scenery=createScenery(state.terrain,[{kind:'house',x:1300,seed:213}]);
    const tank=spawn(0,'tank',1100);Object.assign(tank,{x:1100,y:374,pace:1,cooldown:0,secondaryCooldown:1e9,personalMorale:100});
    const n=state.units.length,enemy=spawn(1,'infantry',1450);state.units.splice(n+1);watch(enemy);
    Object.assign(enemy,{x:1450,y:374,cooldown:1e9,fragCooldown:1e9,personalMorale:100});
    const start=state.units.length,observer=spawn(0,'scouts',1500);state.units.splice(start+1);watch(observer);observer.cooldown=1e9;
    actors=[tank,enemy];
  } else if(['striketank','samlong','armorcluster','armorswarm','armormines'].includes(next)) {
    camera=850;paused=true;capture=false;
    if(next==='striketank') {
      const jet=spawn(1,'strike_jet',1950);Object.assign(jet,{x:1950,y:180,cooldown:0});
      const tank=spawn(0,'tank',1400);watch(tank);Object.assign(tank,{cooldown:1e9,secondaryCooldown:1e9});
      watch(spawn(1,'scouts',1550));actors=[jet,tank];
    } else if(next==='samlong') {
      const sam=spawn(0,'sam_vehicle',700);watch(sam);sam.cooldown=0;
      const jet=spawn(1,'strike_jet',2900);Object.assign(jet,{x:2900,y:180,cooldown:1e9});actors=[sam,jet];camera=350;
    } else {
      const own=spawn(0,'scouts',next==='armormines'?1150:1250);watch(own);own.cooldown=1e9;
      if(next!=='armormines')for(const x of [1450,1590,1730]){const tank=spawn(1,'tank',x);watch(tank);Object.assign(tank,{cooldown:1e9,secondaryCooldown:1e9});actors.push(tank);}
      refreshVision(state);
      const id:CardId=next==='armorcluster'?'antitank_cluster':next==='armorswarm'?'hunter_swarm':'antitank_barrier';
      state.players[0].energy=10;const uid=++state.uid;state.players[0].hand=[{uid,id}];
      const result=playCard(state,0,uid,next==='armormines'?1300:1590);if(!result.ok)throw Error(result.message);
      if(next==='armormines'){const tank=spawn(1,'tank',1300);watch(tank);Object.assign(tank,{cooldown:1e9,secondaryCooldown:1e9});actors=[tank];}
      else actors.push(...state.units.filter(u=>u.id==='fpv_drone'));
    }
  } else if (['vision','reconvision','friendly','duel','coax','gunorders','shortage','blocked'].includes(next)) {
    camera=800;capture=false;paused=true;
    if(next==='vision'||next==='reconvision') {
      const plane=spawn(0,next==='vision'?'strike_jet':'scout_drone',1300);
      Object.assign(plane,{x:1300,y:180,altitude:180});watch(plane);
      const n=state.units.length,enemy=spawn(1,'infantry',1420);state.units.splice(n+1);watch(enemy);
      Object.assign(enemy,{x:1420,y:374,cooldown:1e9});
      state.scenery=createScenery(state.terrain,[{kind:'tree',x:1420,seed:211},{kind:'house',x:1700,seed:212}]);
      state.knownScenery=[{},{}];actors=[plane,enemy];
    } else if(next==='blocked') {
      const n=state.units.length,u=spawn(0,'infantry',1000);state.units.splice(n+1);watch(u);
      Object.assign(u,{x:1000,y:374,pose:'prone',stanceLockUntil:100,cooldown:0,readyAt:-10,rifleReady:1,fragCooldown:1e9});
      const before=state.units.length,enemy=spawn(1,'infantry',1320);state.units.splice(before+1);watch(enemy);
      Object.assign(enemy,{x:1320,y:374,cooldown:1e9});watch(spawn(0,'scouts',1280));
      for(let x=1050;x<=1150;x++)state.terrain[x]=374-Math.max(0,20-Math.abs(x-1100)*.4);state.terrainVersion++;
      actors=[u,enemy];
    } else if(next==='duel') {
      for(const side of [0,1] as const){const n=state.units.length;spawn(side,'infantry',side?1500:1200);
        for(const [i,u] of state.units.slice(n).entries())Object.assign(u,{x:(side?1500:1200)+(side?1:-1)*i*18,
          y:374,lane:i%4*12-18,cooldown:0,fragCooldown:1e9,personalMorale:100,pace:1});}
      actors=[...state.units];
    } else if(next==='friendly') {
      for(const side of [0,1] as const){const n=state.units.length,u=spawn(side,'infantry',side?1410:1390);state.units.splice(n+1);
        Object.assign(u,{x:side?1410:1390,y:374,cooldown:1e9});watch(u);actors.push(u);}
      state.projectiles.push({sourceUid:99999,sourceCardId:'mlrs',ammunition:'rocket',x:1400,y:320,
        startX:1400,startY:320,tx:1400,ty:354,side:0,targetUid:null,base:null,damage:20,radius:55,
        life:.2,total:.2,arc:0,effect:'artillery'});
    } else if(next==='coax') {
      const tank=spawn(0,'tank',1100);watch(tank);Object.assign(tank,{x:1100,y:374,cooldown:1e9,secondaryCooldown:0});
      const n=state.units.length,foe=spawn(1,'infantry',1420);state.units.splice(n+1);watch(foe);
      Object.assign(foe,{x:1420,y:374,cooldown:1e9,fragCooldown:1e9,personalMorale:100});actors=[tank,foe];
    } else {
      const gun=spawn(0,'artillery',1250);watch(gun);Object.assign(gun,{x:1250,y:374,cooldown:1e9});actors=[gun];
      if(next==='shortage'){gun.ammo=2;gun.ammoReserve=0;}
      const close=()=>commandRoot.render(null);
      if(next==='shortage')commandRoot.render(createElement(UnitLogisticsFan,{unit:gun,reason:logisticsAlert(gun)!.reason,x:48,y:63,onClose:close,
        onOrder:order=>{issueLogisticsOrder(state,gun.uid,order);close();}}));
      else commandRoot.render(createElement(SquadMenu,{x:48,y:63,name:CARDS[gun.id].name,count:1,unitLabel:'门',orders:ordersForUnit(gun.id),onClose:close,
        onOrder:order=>{setSquadOrder(state,0,gun.squad,order);close();}}));
    }
  } else if (['lethality','withdraw','shelter'].includes(next)) {
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
document.querySelector<HTMLButtonElement>('#halfstep')!.onclick = () => {
  if (mode === 'parts' || mode === 'fog') return;
  for (let i = 0; i < 30; i++) tick(state, 1 / 60);
  paused = true;
};
document.querySelector<HTMLButtonElement>('#step10')!.onclick = () => {
  if (mode === 'parts' || mode === 'fog') return;
  for (let i = 0; i < 600; i++) {
    tick(state, 1 / 60);
    for (const p of state.projectiles)
      if (p.sourceCardId === 'mlrs' && p.launcherTube !== undefined) ports.add(p.launcherTube);
  }
  paused = true;
};
document.querySelector<HTMLButtonElement>('#depart')!.onclick = () => {
  if (mode !== 'garrison') return;
  for (const squad of new Set(actors.map(u => u.squad))) setSquadOrder(state, 0, squad, 'attack');
};
for (const id of ['flame', 'salvo', 'heli', 'fog', 'wreck', 'garrison', 'tow', 'sam', 'javelin','lethality','withdraw','shelter','vision','reconvision','friendly','duel','coax','gunorders','shortage','blocked','breach','striketank','samlong','armorcluster','armorswarm','armormines','tankescape','ifvburst','scoutgun','commandgun','towhouse','javelinhouse','fuelstall','tankaim','rpgheavy','contactmemory','gunfollow'])
  document.querySelector<HTMLButtonElement>('#' + id)!.onclick = () =>
    scene(id);
document.querySelector<HTMLButtonElement>('#selectgun')!.onclick=()=>{
  if(mode!=='gunfollow')return;
  const gun=actors[0];selectUnitGroup(state,0,gun.squad);
  const close=()=>commandRoot.render(null);
  commandRoot.render(createElement(SquadMenu,{x:48,y:63,name:CARDS[gun.id].name,count:1,unitLabel:'门',orders:ordersForUnit(gun.id),order:gun.squadOrder??'escort',onClose:close,
    onOrder:order=>{setSquadOrder(state,0,gun.squad,order);close();}}));
};
document.querySelector<HTMLButtonElement>('#frontadvance')!.onclick=()=>{
  if(mode!=='gunfollow')return;
  actors[1].x+=500;actors[1].squadOrderX=actors[1].x;refreshVision(state);
};
document.querySelector<HTMLButtonElement>('#losecontact')!.onclick=()=>{
  if(mode!=='contactmemory')return;
  for(const u of state.units.filter(u=>u.side===0)){u.x=200;u.squadOrderX=200;}
  for(const u of actors.slice(1)){u.x+=300;u.squadOrderX=u.x;}
  state.time+=.01;refreshVision(state);
};
document.querySelector<HTMLButtonElement>('#reobserve')!.onclick=()=>{
  if(mode!=='contactmemory')return;
  for(const u of state.units.filter(u=>u.side===0)){u.x=1550;u.squadOrderX=1550;}state.time+=.01;refreshVision(state);
};
document.querySelector<HTMLButtonElement>('#deliverfuel')!.onclick=()=>{
  if(mode!=='fuelstall')return;
  const u=actors[0];state.ammoCrates=[{uid:++state.uid,side:0,x:u.x,stock:1800,maxStock:1800,landAt:state.time,expiresAt:state.time+180}];
};
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
    if(capture&&state.projectiles.some(p=>p.sourceUid===actors[0]?.uid&&(p.ammunition==='rocket'||['ifvburst','scoutgun','commandgun'].includes(mode))&&Math.hypot(p.x-p.startX,p.y-p.startY)>(['ifvburst','scoutgun','commandgun'].includes(mode)?12:110))){paused=true;capture=false;}

    if(mode==='contactmemory'&&(contactPaintAt<0||state.time-contactPaintAt>=.2||(paused&&contactPaintAt!==state.time))){
      contactPaintAt=state.time;
      commandRoot.render(createElement('div',{style:{position:'absolute',left:25,right:25,bottom:40}},createElement('p',{style:{color:'#ebc69a',margin:0,fontSize:12}},'敌军最后观测位置（失去视野后保留）'),createElement('div',{style:{position:'relative',height:32,background:'#344132',border:'1px solid #526049'}},createElement(ContactMapMarks,{contacts:snapshot(state).contacts,time:state.time}))));
    }
    if (mode === 'fog') state.sight[0].fill(false);
    for (const p of state.projectiles)
      if (p.sourceCardId === 'mlrs' && p.launcherTube !== undefined)
        ports.add(p.launcherTube);
    ctx.save();
    if (['flame','ifvburst','scoutgun','commandgun'].includes(mode)) {
      // Show the actual battlefield at the player's close inspection scale.
      ctx.translate(0, -250);
      ctx.scale(2, 2);
    }
    render(ctx, state, art, null, null, true, camera, ['flame','ifvburst','scoutgun','commandgun'].includes(mode) ? 525 : 1050);
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
            `${CARDS[u.id].name}${['fuelstall','tankaim'].includes(mode)?'（燃油'+Math.round(vehicleFuelRatio(u)*100)+'%）':''}：发射 ${u.shots - (initial.get(u.uid) ?? 0)}${(u.ammo ?? -1) >= 0 ? '，待发 ' + u.ammo + '，备弹 ' + (u.ammoReserve ?? 0) : ''}${(u.reloadingUntil ?? 0) > state.time ? '，装填 ' + Math.ceil(u.reloadingUntil! - state.time) + '秒' : ''}`,
        )
        .join(' ｜ ') +
      (mode==='contactmemory' ? ` | 最后观测记录：${snapshot(state).contacts.map(c=>`${CARDS[c.id!]?.name??'步兵'} @ ${Math.round(c.x)}px`).join('，')} | 当前可见敌军 ${state.units.filter(u=>u.side===1&&visibleToSide(state,0,u)).length}` : ['vision','reconvision'].includes(mode) ? ` | 敌步兵${visibleToSide(state,0,actors[1])?'可见':'未被发现'} · 该飞机${mode==='vision'?'不能揭示树林地面':'提供大范围地面侦察'}`
        : ['friendly','duel','coax','gunorders','shortage','blocked','breach','striketank','samlong','armorcluster','armorswarm','armormines','towhouse','javelinhouse','fuelstall','tankaim','rpgheavy','gunfollow'].includes(mode) ? ' | '+actors.map(u=>`${u.side===0?'我方':'敌方'} HP ${Math.max(0,u.hp).toFixed(1)}，机枪发射${u.secondaryShots}，移动${Math.round(u.x-(starts.get(u.uid)??u.x))}px，${u.logisticsOrder??u.squadOrder??(mode==='gunfollow'?'自动跟随':'自主战斗')}`).join(' | ')
        : ['lethality','withdraw','shelter','tankescape'].includes(mode)
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
