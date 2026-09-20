import { mapDefinition, type MapId } from './maps';
import { gliderArtIndex } from './glider';
import { isPrecisionObserver } from './precision-team';
import { infantryGeometry } from './infantry-geometry';
import { crouchTravelAmount } from './crouch-locomotion';
import { proneTravelAmount } from './prone-locomotion';
import { pathfinderReady, ambushConcealed } from './infantry-specialties';
import { filteredSprite } from './render-cache';
import {
  drawTerrainLayer,
  TERRAIN_TEXTURE_WIDTH,
  TERRAIN_TEXTURE_HEIGHT,
} from './terrain-render';
import {
  drawUnitSelection,
  selectionOccluded,
  unitSelectionBounds,
} from './selection-render';
import { treeBoxesV17 } from './tree-state-v17';
import { blastVisible } from './impact-fx';
import { specialistSprite } from './adult-specialists';
import { heavyMGSprite } from './heavy-mg-art';
import { grenadeLauncherSprite } from './grenade-launcher-art';
import { patrolFrameV17 } from './patrol-art-v17';
import { digFrameV18 } from './dig-art-v18';
import { digWorkSettled } from './support-work';
import { drawMineV18 } from './mine-art-v18';
import { drawToxicCloudV18 } from './comeback-art-v18';
import {
  projectileForRender,
  foregroundObject,
  infantryDepth,
} from './render-depth';
import {
  adultIdentity,
  adultFrameChoice,
  ownsAdultBody,
  idlePoseChoice,
  adultWreckChoice,
  ragdollChoice,
} from './adult-animation';
import { tankGeometry } from './vehicle-geometry';
import { wreckKind, wreckGeometry, wreckObstacles } from './wreck-geometry';
import { drawScenery } from './scenery-art';
import { drawBirds, drawDistantFlashes, drawWreckSmoke, drawWreckFire, drawScorches, drawTreads, drawDragMarks, drawVeterancyPips } from './ambience';
import { drawWeather } from './weather';
import { WhipStreakLayer } from './whip-streak';
import { drawRicochets } from './ricochet';
import { pointVisible, visibleToSide } from './world';
import {
  ammunition,
  drawMuzzle,
  drawMuzzleLight,
  drawProjectile,
  drawParticle,
  drawBlast,
} from './ballistics';
import {
  CARDS,
  ground,
  H,
  W,
  VIEW_W,
  type Projectile,
  type GameState,
  type CardId,
  type Unit,
} from './engine';
import { unitByUid } from './spatial';
import { unitSynergy, synergyProviderUid, type SynergyKind } from './synergy';
import {
  drawSprite,
  drawTankSprite,
  unitFrame,
  unitSize,
  uniformFrame,
  type Art,
} from './art';
import {
  coverProp,
  transportCrewCount,
  transportCrewSlot,
} from './cover-animation';
const projectileOffsets = new WeakMap<Projectile, { x: number; y: number }>();
// Supersonic rounds that whip past the camera leave a brief white streak.
// Render-layer only: the simulation never knows these exist.
const whipStreaks = new WhipStreakLayer();
let whipStatus = '';
const wreckBounds = new WeakMap<
  object,
  {
    x: number;
    y: number;
    angle: number;
    boxes: ReturnType<typeof wreckObstacles>;
  }
>();

const rearSoilTextures = new WeakMap<object, HTMLCanvasElement>();
function rearSoilTexture(
  terrain: CanvasImageSource & { width: number; height: number },
) {
  const cached = rearSoilTextures.get(terrain);
  if (cached) return cached;
  const canvas = document.createElement('canvas');
  canvas.width = TERRAIN_TEXTURE_WIDTH;
  canvas.height = TERRAIN_TEXTURE_HEIGHT;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.filter = 'brightness(0.62) saturate(0.72)';
  ctx.drawImage(terrain, 0, 0, canvas.width, canvas.height);
  rearSoilTextures.set(terrain, canvas);
  return canvas;
}

const mapTerrainTextures = new WeakMap<
  HTMLImageElement,
  Map<MapId, HTMLCanvasElement>
>();
function terrainTexture(
  art: Art,
  id: MapId,
): CanvasImageSource & { width: number; height: number } {
  const palette = mapDefinition(id).palette;
  if (id === 'greyline') return art.terrain;
  let textures = mapTerrainTextures.get(art.terrain);
  if (!textures) {
    textures = new Map();
    mapTerrainTextures.set(art.terrain, textures);
  }
  const existing = textures.get(id);
  if (existing) return existing;
  const canvas = document.createElement('canvas');
  canvas.width = TERRAIN_TEXTURE_WIDTH;
  canvas.height = TERRAIN_TEXTURE_HEIGHT;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.filter = palette.terrainFilter;
  ctx.drawImage(art.terrain, 0, 0, canvas.width, canvas.height);
  ctx.filter = 'none';
  ctx.globalCompositeOperation = 'color';
  ctx.globalAlpha = palette.tintStrength;
  ctx.fillStyle = palette.terrainTint;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  textures.set(id, canvas);
  return canvas;
}
function drawMapBackground(
  ctx: CanvasRenderingContext2D,
  art: Art,
  id: MapId,
  camera: number,
  viewportWidth: number,
) {
  // Optional for saved QA fixtures and while the separately generated map art is loading.
  const mapArt = art as Art & {
    mapBackgrounds?: Partial<Record<MapId, CanvasImageSource>>;
  };
  const background = mapArt.mapBackgrounds?.[id] ?? art.background;
  const offset = camera * 0.3,
    firstTile = Math.floor(offset / VIEW_W);
  ctx.fillStyle = mapDefinition(id).palette.sky;
  ctx.fillRect(0, 0, viewportWidth, H);
  for (let tile = firstTile; tile * VIEW_W - offset < viewportWidth; tile++) {
    const x = tile * VIEW_W - offset;
    // Neighboring generated tiles share the identical edge; camera motion never changes a tile's orientation.
    const mirrored = id !== 'greyline' && Math.abs(tile % 2) === 1;
    ctx.save();
    ctx.translate(x + (mirrored ? VIEW_W : 0), -24);
    if (mirrored) ctx.scale(-1, 1);
    ctx.drawImage(background, 0, 0, VIEW_W, H);
    ctx.restore();
  }
}

// Night battles are draped in a translucent dark layer with radial holes
// punched around every light source: flares, muzzle flashes, explosions,
// bases and the soft glow around each friendly squad.
const nightCanvas = document.createElement('canvas');
const nightCtx = nightCanvas.getContext('2d')!;
function drawNightOverlay(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  camera: number,
  viewportWidth: number,
) {
  if (nightCanvas.width !== viewportWidth || nightCanvas.height !== H) {
    nightCanvas.width = viewportWidth;
    nightCanvas.height = H;
  }
  nightCtx.clearRect(0, 0, viewportWidth, H);
  nightCtx.fillStyle = 'rgba(7, 9, 18, 0.86)';
  nightCtx.fillRect(0, 0, viewportWidth, H);
  nightCtx.globalCompositeOperation = 'destination-out';
  const punch = (x: number, y: number, r: number, strength: number) => {
    const sx = x - camera;
    if (sx < -r || sx > viewportWidth + r) return;
    const g = nightCtx.createRadialGradient(sx, y, 0, sx, y, r);
    g.addColorStop(0, `rgba(0,0,0,${strength})`);
    g.addColorStop(0.55, `rgba(0,0,0,${strength * 0.55})`);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    nightCtx.fillStyle = g;
    nightCtx.beginPath();
    nightCtx.arc(sx, y, r, 0, Math.PI * 2);
    nightCtx.fill();
  };
  // Bases glow.
  punch(70, ground(s, 70) - 40, 130, 0.9);
  punch(W - 70, ground(s, W - 70) - 40, 130, 0.9);
  // Flares are the primary night illuminators.
  for (const f of s.flares) {
    if (f.life <= 0) continue;
    punch(f.x, f.y, (f.radius ?? 260) + 40, 0.95);
  }
  // Friendly squads carry a soft local light.
  for (const u of s.units) {
    if (u.side !== 0 || u.hp <= 0) continue;
    punch(u.x, u.y - 24, 120, 0.55);
  }
  // Muzzle flashes briefly betray the shooter.
  for (const u of s.units) {
    if (u.hp <= 0 || (u.flashUntil ?? 0) <= s.time) continue;
    if (u.side !== 0 && !visibleToSide(s, 0, u)) continue;
    punch(u.muzzleX ?? u.x, (u.muzzleY ?? u.y) - 10, 80, 0.95);
  }
  // Explosions flash across the dark.
  for (const b of s.blasts) {
    if (b.age > 0.45) continue;
    punch(b.x, b.y, 140, 0.9);
  }
  // Burning wrecks gutter with orange light.
  for (const w of s.wrecks) {
    const c = CARDS[w.cardId];
    if (!c.armored && !c.vehicle) continue;
    if (w.age > 40) continue;
    punch(w.x, w.y - 14, 100, 0.8 * (1 - w.age / 40));
  }
  nightCtx.globalCompositeOperation = 'source-over';
  ctx.drawImage(nightCanvas, Math.round(camera), 0);
}

const SYNERGY_KINDS: SynergyKind[] = [
  'armor_assault',
  'fire_base',
  'medevac_chain',
  'supply_run',
  'overwatch',
  'recon_spot',
];

/**
 * Draw faint dashed links between infantry and the provider powering their
 * active synergy (v48). Links render under the units themselves so soldiers
 * and vehicles stay readable; the pulse keeps the effect alive without
 * turning the battlefield into a wiring diagram.
 */
function drawSynergyLinks(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  sorted: Unit[],
  camera: number,
  viewportWidth: number,
) {
  const now = s.time;
  let drawn = 0;
  const MAX_LINKS = 40;
  for (const u of sorted) {
    if (drawn >= MAX_LINKS) break;
    const syn = unitSynergy(s, u, now);
    for (const kind of SYNERGY_KINDS) {
      if (drawn >= MAX_LINKS) break;
      if (!syn[kind]) continue;
      const providerUid = synergyProviderUid(s, u, kind, now);
      if (providerUid === undefined) continue;
      const p = unitByUid(s, providerUid);
      if (!p) continue;
      if (p.x < camera - 180 || p.x > camera + viewportWidth + 180) continue;
      const pulse = 0.55 + 0.45 * Math.sin(now * 2.6 + u.uid * 1.7);
      const alpha = (kind === 'medevac_chain' ? 0.09 : 0.07) * pulse;
      ctx.strokeStyle =
        u.side === 0
          ? `rgba(126,178,255,${alpha})`
          : `rgba(255,138,120,${alpha})`;
      ctx.lineWidth = 1;
      ctx.setLineDash(kind === 'medevac_chain' ? [2, 5] : [5, 7]);
      ctx.beginPath();
      ctx.moveTo(u.x - camera, u.y - 12);
      ctx.lineTo(p.x - camera, p.y - 12);
      ctx.stroke();
      ctx.setLineDash([]);
      drawn++;
    }
  }
}

export function render(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  art: Art,
  selected: CardId | null,
  hover: number | null,
  reduced = false,
  camera = 0,
  viewportWidth = VIEW_W,
  selectedSquad: number | null = null,
) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, viewportWidth, H);
  ctx.save();
  if (s.status !== whipStatus) {
    whipStatus = s.status;
    whipStreaks.reset();
  }
  if (s.shake > 0 && !reduced)
    ctx.translate(
      Math.sin(s.time * 134) * s.shake,
      Math.cos(s.time * 123) * s.shake * 0.4,
    );
  const map = mapDefinition((s as GameState & { mapId?: MapId }).mapId),
    palette = map.palette,
    terrainArt = terrainTexture(art, map.id);
  drawMapBackground(ctx, art, map.id, camera, viewportWidth);
  ctx.translate(-Math.round(camera), 0);
  // Sky ambience: birds and distant battle flashes sit behind the terrain.
  drawBirds(ctx, s, camera, viewportWidth);
  drawDistantFlashes(ctx, s, camera, viewportWidth);
  const visibleGround = (x: number) =>
    s.knownTerrain[0][Math.max(0, Math.min(W - 1, Math.floor(x)))];
  const left = Math.max(0, Math.floor(camera / 3) * 3),
    right = Math.min(W, Math.ceil((camera + viewportWidth) / 3) * 3);
  drawTerrainLayer(
    ctx,
    s,
    terrainArt,
    rearSoilTexture(terrainArt),
    palette,
    left,
    right,
  );
  drawScorches(ctx, s, camera, viewportWidth);
  drawTreads(ctx, s, camera, viewportWidth);
  drawDragMarks(ctx, s, camera, viewportWidth);
  const foregroundBounds: { x: number; y: number; w: number; h: number }[] = [];
  const drawCoverProps = (front: boolean) => {
    for (const wall of Object.values(s.knownWalls[0])) {
      if (foregroundObject(wall.uid + 0x91ab) !== front) continue;
      if (front && wall.hp > 0)
        foregroundBounds.push({
          x: wall.x - 29,
          y: visibleGround(wall.x) - wall.height,
          w: 58,
          h: wall.height,
        });
      if (wall.hp > 0)
        drawSprite(
          ctx,
          art.vehicles[2][1],
          wall.x,
          ground(s, wall.x) + 3,
          58,
          wall.height + 12,
        );
      else {
        ctx.fillStyle = '#656452';
        ctx.fillRect(wall.x - 21, ground(s, wall.x) - 2, 42, 5);
      }
    }
    for (const prop of Object.values(s.knownScenery[0]))
      if (
        (prop.kind !== 'house' && foregroundObject(prop.seed + prop.id)) ===
          front &&
        prop.x > camera - 180 &&
        prop.x < camera + viewportWidth + 180
      ) {
        if (front && prop.kind === 'tree')
          foregroundBounds.push(
            ...treeBoxesV17(prop, s.time, visibleGround(prop.x)),
          );
        drawScenery(
          ctx,
          prop,
          s.time,
          art.scenery,
          art.buildings,
          art.trees,
          visibleGround,
        );
      }
    for (const w of s.wrecks) {
      if (foregroundObject(w.id) !== front) continue;
      if (
        w.x < camera - 200 ||
        w.x > camera + viewportWidth + 200 ||
        !(w.side === 0 || pointVisible(s, 0, w.x, w.y - 12))
      )
        continue;
      const c = CARDS[w.cardId];
      if (!c.members) {
        if (front) {
          let cached = wreckBounds.get(w);
          if (
            !cached ||
            cached.x !== w.x ||
            cached.y !== w.y ||
            cached.angle !== w.angle
          ) {
            cached = {
              x: w.x,
              y: w.y,
              angle: w.angle,
              boxes: wreckObstacles(w),
            };
            wreckBounds.set(w, cached);
          }
          foregroundBounds.push(...cached.boxes);
        }
        if(w.cardId==='glider_transport') {
          const frame=w.abandoned?art.glider[3]:art.glider[w.cause==='blast'||w.cause==='burn'?7:6];
          const inset=8;
          drawSprite(ctx,frame,w.x-Math.sin(w.angle)*inset,w.y+Math.cos(w.angle)*inset,
            256,100,(w.facing??(w.side===0?1:-1))<0,1,w.angle);
          continue;
        }
        ctx.save();
        const wsd = w.id >>> 0;
        // Damage is painted into whole alternative wrecks. Random black
        // patches and strong darkening hid the metal detail and filled sky.
        const cause = w.cause ?? 'bullet';
        const family = art.wreckVariants[wreckKind(w.cardId)][cause];
        const frame = family[wsd % family.length];
        const shape = wreckGeometry(w.cardId,w.cause);
        const scorch = Math.max(
          18,
          Math.round((shape.support[1]-shape.support[0])*shape.width * (0.65 + (wsd % 4) * 0.1)),
        );
        ctx.fillStyle = `rgba(12,10,8,${0.22 + (wsd % 3) * 0.07})`;
        ctx.beginPath();
        ctx.ellipse(
          Math.round(w.x),
          Math.round(w.y + 2),
          scorch,
          Math.max(4, Math.round(scorch * 0.16)),
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
        const inset = (1 - shape.support[2]) * frame.height;
        const offset =
          shape.spriteOffset * (w.facing ?? (w.side === 0 ? 1 : -1));
        drawSprite(
          ctx,
          frame,
          w.x + Math.cos(w.angle) * offset - Math.sin(w.angle) * inset,
          w.y + Math.sin(w.angle) * offset + Math.cos(w.angle) * inset,
          frame.width,
          frame.height,
          (w.facing ?? (w.side === 0 ? 1 : -1)) < 0,
          1,
          w.angle,
        );
        ctx.restore();
        continue;
      }
      const adultWreck = c.members ? art.adults[adultIdentity(w.cardId)] : null;
      const wreckChoice = adultWreck
        ? w.falling
          ? ragdollChoice(w.age, w.id)
          : adultWreckChoice(w.age, w.pose, w.id)
        : null;
      const wreckImage =
        adultWreck && wreckChoice
          ? uniformFrame(adultWreck[wreckChoice.group][wreckChoice.index], c.uniform)
          : unitFrame(art, w.cardId, 0);
      ctx.save();
      const bsd = w.id >>> 0;
      // v106: a fresh casualty keeps its colour and desaturates into the
      // grayscale corpse over the first seconds, so a man just cut down
      // doesn't pop in as a pre-aged statue.
      const decay = Math.min(1, w.age / 10);
      const shade = 0.55 + (bsd % 3) * 0.07;
      drawSprite(
        ctx,
        filteredSprite(
          wreckImage,
          `grayscale(${decay.toFixed(2)}) brightness(${(
            shade +
            (1 - decay) * (1 - shade)
          ).toFixed(2)})`,
        ),
        w.x + ((bsd >>> 4) % 3 - 1),
        w.y + infantryDepth(w.lane) + 3,
        wreckImage.width * (0.96 + (bsd % 4) * 0.03),
        wreckImage.height * (0.96 + (bsd % 4) * 0.03),
        (w.facing ?? (w.side === 0 ? 1 : -1)) < 0,
        1,
        w.falling ? w.angle : w.angle + ((bsd >>> 2) % 5 - 2) * 0.03,
      );
      ctx.restore();
    }
  };
  for (const m of s.mines)
    if (m.side === 0) {
      drawMineV18(
        ctx,
        art.mines,
        m.kind ?? 'antitank',
        m.x,
        visibleGround(m.x) + 1,
        s.time >= m.armAt,
        s.time >= m.armAt + 2,
        m.uid % 2 === 0,
      );
    }
  const c = selected ? CARDS[selected] : null;
  for (const side of [0, 1] as const) {
    const x = side === 0 ? 70 : W - 70,
      y = ground(s, x);
    drawSprite(ctx, art.vehicles[2][0], x, y + 6, 144, 84, side === 1);
    ctx.fillStyle = side === 0 ? '#acd1d8' : '#dd997f';
    ctx.fillRect(x - 26, y - 84, 52, 4);
    ctx.fillStyle = '#263b31';
    ctx.fillRect(x - 28, y - 86, 56, 2);
    ctx.fillStyle = '#263b31cc';
    ctx.fillRect(x - 37, y + 11, 74, 19);
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ebeed8';
    ctx.fillText(side === 0 ? 'BLUE / HQ' : 'RED / HQ', x, y + 24);
  }
  if (s.campaign?.objective === 'capture') {
    const x = s.campaign.objectiveX,
      y = ground(s, x);
    ctx.save();
    ctx.fillStyle = '#ddc787';
    ctx.fillRect(x - 1, y - 87, 2, 64);
    ctx.fillRect(x + 1, y - 87, 26, 16);
    ctx.fillStyle = '#263b31ee';
    ctx.fillRect(x - 47, y - 112, 98, 21);
    ctx.fillStyle = '#efe3b9';
    ctx.textAlign = 'center';
    ctx.font = '11px monospace';
    ctx.fillText(
      `电台 ${Math.floor(s.campaign.captureProgress)}/15秒`,
      x,
      y - 98,
    );
    ctx.restore();
  }
  const sourceOffsets = new Map<number, { x: number; y: number }>();
  drawCoverProps(false);
  const layer = (u: GameState['units'][number]) =>
    CARDS[u.id].air
      ? 3
      : CARDS[u.id].members
        ? 1
        : foregroundObject(u.uid)
          ? 2
          : 0;
  const sorted = s.units
    .filter(
      (u) =>
        visibleToSide(s, 0, u) &&
        u.x >= camera - 180 &&
        u.x <= camera + viewportWidth + 180,
    )
    .sort((a, b) => layer(a) - layer(b) || a.lane - b.lane);
  let coverDrawn = false;
  drawSynergyLinks(ctx, s, sorted, camera, viewportWidth);
  for (const u of sorted) {
    if (CARDS[u.id].air && !coverDrawn) {
      drawCoverProps(true);
      coverDrawn = true;
    }
    if (!visibleToSide(s, 0, u)) continue;
    if (u.x < camera - 180 || u.x > camera + viewportWidth + 180) continue;
    const c = CARDS[u.id],
      geometry = tankGeometry(u.id),
      isTank = !!geometry,
      isAir = !!c.air,
      isDead = u.hp <= 0;
    const [w, h] = unitSize(u.id);
    if (!c.members && !c.air && layer(u) === 2 && u.hp > 0)
      foregroundBounds.push(unitSelectionBounds(u));
    const tankOffset = (geometry?.spriteOffset ?? 0) * (u.side === 0 ? 1 : -1);
    const groundInset = geometry?.spriteGroundInset ?? 0;
    let frame =
      Math.floor(s.time * (isAir ? 18 : u.moving ? 8 : 0)) %
      (art.mobileVehicles?.[u.id]?.length ?? 4);
    if (c.emplacement && u.fire > 0.1) frame = 1;
    const adult = c.members ? art.adults[adultIdentity(u.id)] : null;
    const choice = c.members ? adultFrameChoice(u, s.time) : null;
    const authoredBody = ownsAdultBody(choice);
    const body = adult && choice ? adult[choice.group][choice.index] : null;
    const specialist =
      body && choice && (!authoredBody || choice.group === 'stance16')
        ? (!authoredBody ? grenadeLauncherSprite(u, s.time, art.grenadeLauncher) ?? heavyMGSprite(u, s.time, art.heavyMG) : null) ??
          specialistSprite(body, choice, u, art.adultSpecialists, art.weaponStances)
        : null;
    // v117: the patrol overlay only covers "plain" frames — the walk cycle
    // and the standing-alert frame. Every authored action frame (leader
    // gestures, hit flinches, contact callouts, secondary-weapon shots) now
    // shows through instead of being silently swallowed by the static patrol
    // idle, which used to hide whole animation branches on upright soldiers.
    const patrolPlain =
      choice !== null &&
      (choice.group === 'walk8' ||
        (choice.group === 'actions20' && choice.index === 0));
    const patrol =
      body &&
      !specialist &&
      patrolPlain &&
      c.members &&
      !isDead &&
      !u.wounded &&
      !u.surrendered &&
      !u.rappelling &&
      !u.backpedaling &&
      u.motion === 'ground' &&
      !u.climbing &&
      ['idle', 'walk'].includes(u.pose) &&
      (u.reloadingUntil ?? 0) <= s.time &&
      // Yield only while firing on the move; a stationary burst keeps the
      // patrol layer active so its dedicated aimed-rifle pose (raise3[2])
      // holds the weapon on target for the whole burst.
      (u.fire <= 0 || !u.moving)
        ? patrolFrameV17(
            art.patrol,
            adultIdentity(u.id),
            u.fire > 0 && !u.moving
              ? 'fire'
              : (u.aimUntil ?? 0) > s.time
                ? 'raise'
                : u.moving
                  ? 'walk'
                  : 'idle',
            u.walk,
            s.time - (u.readyAt ?? -100),
          )
        : null;
    const digging =
      u.digging && !authoredBody && digWorkSettled(u,s.time)
        ? digFrameV18(
            art.digging,
            adultIdentity(u.id),
            u.digElapsed ?? 0,
            (u.uid % 8) * 0.2,
          )
        : null;
    // Idle micro-motion: when patrol would hold the static idle frame,
    // occasionally cut to an alert or crouch-glance pose so held positions
    // stay alive. Only applies when the soldier is truly idle (not walking,
    // firing, aiming, reloading, digging, or dragging).
    let microDir: 1 | -1 | undefined;
    // Dug-in defenders hold a crouch or prone pose (no patrol frame), but they
    // still track distant blasts — the same glance layer, kept low to the
    // ground. Specialist sprites, climbers, rappellers and casualties keep
    // their own animation path.
    const heldPose =
      c.members && !authoredBody && crouchTravelAmount(u) === 0 && proneTravelAmount(u) === 0 &&
      !isDead &&
      !u.wounded &&
      !u.surrendered &&
      !u.rappelling &&
      !u.backpedaling &&
      u.motion === 'ground' &&
      !u.climbing &&
      !specialist &&
      (u.reloadingUntil ?? 0) <= s.time &&
      ['crouch', 'prone'].includes(u.pose);
    const idleMicro =
      (patrol || heldPose) &&
      !u.moving &&
      u.fire <= 0 &&
      (u.aimUntil ?? 0) <= s.time &&
      adult
        ? (() => {
            const micro = idlePoseChoice(u, s.time);
            microDir = micro?.dir;
            return micro ? adult[micro.group][micro.index] : null;
          })()
        : null;
    const img = body
      ? uniformFrame(digging ?? idleMicro ?? patrol ?? specialist?.image ?? body, c.uniform)
      : unitFrame(art, u.id, u.glider?gliderArtIndex(u,s.time):frame);
    const visualMuzzle = specialist?.muzzle
      ? {
          x: u.x + u.facing * specialist.muzzle.x,
          y: u.y + 3 - specialist.muzzle.height,
        }
      : null;
    if (visualMuzzle && u.fire > 0)
      sourceOffsets.set(u.uid, {
        x: visualMuzzle.x - u.muzzleX,
        y: visualMuzzle.y - u.muzzleY,
      });

    ctx.fillStyle = isAir ? '#25372b14' : '#25372b33';
    ctx.fillRect(
      u.x - w * 0.23,
      ground(s, u.x) + infantryDepth(u.lane),
      w * 0.46,
      3,
    );
    const alpha = isDead
      ? Math.min(1, u.deadFor)
      : u.surrendered
        ? Math.min(1, 6 - u.surrenderTime)
        : 1;
    if (!c.members && isDead) {
      ctx.save();
      ctx.filter = 'grayscale(1) brightness(.5)';
    }
    // Breathing must be painted torso motion, never translating planted
    // boots (and separating the visible barrel from its ballistic origin).
    // Authored posture cels already contain their vertical motion. Do not
    // translate the whole body a second time or fade it when walking stops.
    const showProp = !!c.members && !isDead && u.cover > 0.2 && !u.moving;
    if (u.rappelling) {
      const carrier = s.units.find(
        (v) =>
          v.airlift?.squad === u.squad &&
          v.hp > 0 &&
          v.airlift.phase === 'unload',
      );
      if (carrier) {
        ctx.strokeStyle = '#b8b29a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(Math.round(carrier.x), Math.round(carrier.y - 3));
        ctx.lineTo(Math.round(u.x), Math.round(u.y - 51));
        ctx.stroke();
      }
    }
    if (u.parachuting && art.parachute.length) {
      const sway = Math.sin(s.time * 1.7 + u.uid * 1.3) * 3;
      const chute =
        art.parachute[
          Math.floor(s.time * 7 + u.uid * 1.3) % art.parachute.length
        ];
      const chuteX = u.x + sway;
      const chuteY = u.y + infantryDepth(u.lane) - 46;
      drawSprite(ctx, chute, chuteX, chuteY, 82, 82, (microDir ?? u.facing) < 0);
      ctx.strokeStyle = 'rgba(184,178,154,0.9)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(Math.round(chuteX - 22), Math.round(chuteY - 30));
      ctx.lineTo(Math.round(u.x - 5), Math.round(u.y + infantryDepth(u.lane) - 20));
      ctx.moveTo(Math.round(chuteX + 22), Math.round(chuteY - 30));
      ctx.lineTo(Math.round(u.x + 5), Math.round(u.y + infantryDepth(u.lane) - 20));
      ctx.stroke();
    }
    // Body motion comes from the authored intermediate frames. Keep one
    // fully opaque soldier, including during escort idle/walk changes.
    // Armored vehicles and gun emplacements react when they fire. Real tanks
    // soak recoil through the breech: the barrel slides back into the
    // mantlet while the hull stays planted, so tanks with a measured barrel
    // band recoil the muzzle only. Lighter vehicles and emplacements still
    // rock the whole hull against the suspension.
    let recoilX = 0;
    let recoilY = 0;
    let barrelRecoil = 0;
    const barrelBand = geometry?.barrelBand;
    if ((c.armored || c.emplacement) && u.fire > 0 && u.motion === 'ground') {
      const k = u.fire / 0.25;
      if (barrelBand) {
        // v112: the old 0.8×band-width slid the barrel almost fully into
        // the hull. Recoil scales with barrel length, capped, so the muzzle
        // kicks back visibly without swallowing a short heavy-tank barrel.
        const barrelLen = barrelBand[2] - barrelBand[0];
        barrelRecoil = Math.min(15, barrelLen * 0.3) * k * k;
      } else {
        const recoil = 3 * k * k;
        recoilX = -u.facing * recoil;
        recoilY = recoil * 0.35;
      }
    }
    const drawX =
      u.x +
      recoilX +
      tankOffset * Math.cos(u.hullAngle) -
      groundInset * Math.sin(u.hullAngle);
    const drawY =
      u.y +
      infantryDepth(u.lane) +
      (u.glider ? 8 : isTank ? 0 : 3) +
      recoilY +
      tankOffset * Math.sin(u.hullAngle) +
      groundInset * Math.cos(u.hullAngle);
    if (barrelBand) {
      drawTankSprite(
        ctx,
        img,
        drawX,
        drawY,
        w,
        h,
        u.side === 1,
        alpha,
        u.hullAngle,
        barrelBand,
        barrelRecoil,
      );
    } else {
      drawSprite(
        ctx,
        img,
        drawX,
        drawY,
        c.members ? img.width : w,
        c.members ? img.height : h,
        c.members || c.air
          ? (microDir ?? choice?.dir ?? u.facing) < 0
          : u.side === 1,
        alpha,
        c.armored || geometry || u.glider || c.oneWay ? u.hullAngle : 0,
      );
    }
    if (!c.members && isDead) ctx.restore();
    if (isDead) continue;
    // Stationary infantry in cover get a per-unit prop (sandbags for deep
    // cover, rubble for light) drawn over their lower body, anchoring them
    // to the ground they are hiding behind.
    if (showProp) {
      const anchorY = u.y + infantryDepth(u.lane) + 3;
      for (const b of coverProp(u.uid, u.cover)) {
        ctx.fillStyle = b.color;
        ctx.fillRect(
          Math.round(u.x + b.dx - b.w / 2),
          Math.round(anchorY - b.dy - b.h),
          b.w,
          b.h,
        );
      }
    }
    // Transport helicopters show the helmets of troops still aboard through
    // the open side door until they rappel out.
    if (
      c.airlift &&
      u.hp > 0 &&
      (u.airlift?.phase === 'approach' || u.airlift?.phase === 'unload')
    ) {
      const cargoSize = CARDS[c.airlift].members ?? 5;
      const count = transportCrewCount(cargoSize, u.airlift.dropped);
      const anchorY = u.y + infantryDepth(u.lane) + 3;
      for (let i = 0; i < count; i++) {
        const slot = transportCrewSlot(i, count, s.time, u.uid);
        const hx = Math.round(u.x + (u.facing < 0 ? -slot.dx : slot.dx));
        const hy = Math.round(anchorY + slot.dy);
        ctx.fillStyle = '#4a4d3a';
        ctx.fillRect(hx - 2, hy - 4, 5, 4);
        ctx.fillStyle = '#6a6d52';
        ctx.fillRect(hx - 2, hy - 4, 5, 1);
      }
    }
    // Spotters broadcast while observing: faint signal arcs pulse above the
    // kneeling radio pose, hinting at the shared-vision network.
    if (c.members && (u.id === 'scouts' || isPrecisionObserver(u)) && (u.observingUntil ?? 0) > s.time) {
      const radioT = (s.time + u.uid * 1.37) % 4.4;
      if (radioT < 1.2) {
        const ax = u.x,
          ay = u.y + infantryDepth(u.lane) - infantryGeometry(u).bodyHeight - 8;
        ctx.strokeStyle = 'rgba(226,214,170,0.7)';
        ctx.lineWidth = 1;
        for (let i = 0; i < 2; i++) {
          ctx.beginPath();
          ctx.arc(
            ax,
            ay,
            4 + i * 4 + (radioT % 0.4) * 6,
            -Math.PI * 0.75,
            -Math.PI * 0.25,
          );
          ctx.stroke();
        }
      }
    }
    if (u.side === 0 && (pathfinderReady(s, u) || ambushConcealed(u, s.time))) {
      ctx.fillStyle = '#b1c9b7';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(u.id === 'pathfinders' ? '引导就绪' : '隐蔽', u.x,
        u.y + infantryDepth(u.lane) - infantryGeometry(u).bodyHeight - 16);
    }
    if (u.wounded) {
      const by = u.y - 25;
      ctx.fillStyle = '#e5d8b0';
      ctx.fillRect(u.x - 1, by - 11, 2, 8);
      ctx.fillRect(u.x - 4, by - 8, 8, 2);
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`待救 ${Math.ceil(u.bleedOut)}s`, u.x, by - 15);
      continue;
    }
    if (u.surrendered) {
      ctx.fillStyle = '#eee8c9';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('投降', u.x, u.y - 78);
      continue;
    }
    if (u.evadeUntil > s.time) {
      ctx.fillStyle = '#e3b975';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(u.moving ? '分散' : '避炮', u.x, u.y - 78);
    }
    if ((u.calloutUntil ?? 0) > s.time) {
      ctx.fillStyle = '#f0d060';
      ctx.font = 'bold 10px sans-serif';
      ctx.textAlign = 'center';
      const arrow = (u.calloutDir ?? 1) > 0 ? '▶' : '◀';
      ctx.fillText(`${arrow}接触!`, u.x, u.y - 78);
    }
    // v92: veterancy pips — gold chevrons over the squad, one per tier.
    drawVeterancyPips(ctx, u);
    if (u.secondaryFire > 0)
      drawMuzzle(
        ctx,
        u.secondaryMuzzleX,
        u.secondaryMuzzleY + (c.members ? infantryDepth(u.lane) : 0),
        u.secondaryAngle,
        'machinegun',
        0.09 - u.secondaryFire,
      );
    if (u.tactic === 'retreat' && u.evadeUntil <= s.time) {
      ctx.fillStyle = '#e3b975';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(
        (u.regroupProgress ?? 0) > 0
          ? '重整'
          : (u.conflictUntil ?? 0) > s.time
            ? '冲突'
            : '撤退',
        u.x,
        u.y - 78,
      );
    }
    if (u.fire > 0 && u.motion === 'ground' && !u.climbing)
      drawMuzzle(
        ctx,
        visualMuzzle?.x ?? u.muzzleX,
        (visualMuzzle?.y ?? u.muzzleY) +
          (c.members ? infantryDepth(u.lane) : 0),
        u.shotAngle,
        u.lastAmmo ?? ammunition(u.id, u.member),
        0.25 - u.fire,
      );
    // Muzzle smoke is emitted once by the shot, then drifts on its own particle
    // clock. Do not add circles attached to the gun or cut smoke at fire === 0.
    if (u.healing > 0 || u.repairTime > 0) {
      ctx.fillStyle = '#e9e6b6';
      ctx.fillRect(u.x - 1, u.y - h - 15, 2, 8);
      ctx.fillRect(u.x - 4, u.y - h - 12, 8, 2);
    }
    if (s.players[u.side].morale > 0) {
      ctx.fillStyle = '#f4cf79';
      ctx.fillRect(u.x - 3, u.y - h - 8, 6, 2);
      ctx.fillRect(u.x - 1, u.y - h - 10, 2, 2);
    }
    const by =
        u.y -
        (u.pose === 'prone'
          ? 22
          : u.pose === 'hunker'
            ? 34
            : u.pose === 'crouch'
              ? 47
              : h) +
        infantryDepth(u.lane) -
        3,
      bw = c.members ? 18 : 42;
    if (u.cover > 0.2 && !u.moving) {
      ctx.strokeStyle = '#c2d6c2';
      ctx.lineWidth = 1;
      ctx.strokeRect(u.x - 5, by - 11, 10, 6);
      ctx.fillStyle = '#879f88';
      ctx.fillRect(u.x - 3, by - 9, Math.round(u.cover * 6), 2);
    }
    ctx.fillStyle = '#23362dbb';
    ctx.fillRect(u.x - bw / 2, by, bw, 3);
    ctx.fillStyle = u.side === 0 ? '#abd5cf' : '#e59a7c';
    ctx.fillRect(
      u.x - bw / 2,
      by,
      Math.round(bw * Math.max(0, u.hp / u.maxHp)),
      3,
    );
  }
  if (!coverDrawn) drawCoverProps(true);
  for (const u of sorted)
    drawUnitSelection(ctx, u, {
      selected: u.side === 0 && u.squad === selectedSquad,
      visible: true,
      occluded: !!CARDS[u.id].members && selectionOccluded(u, foregroundBounds),
    });
  // Muzzle-flash illumination: each active shooter casts a brief warm glow
  // onto the terrain around him. Additive blending makes concurrent fire
  // stack into the flickering ambience of a real firefight.
  for (const u of sorted) {
    if (u.fire <= 0 || u.hp <= 0 || u.wounded) continue;
    if (!visibleToSide(s, 0, u)) continue;
    if (u.x < camera - 120 || u.x > camera + viewportWidth + 120) continue;
    const c = CARDS[u.id];
    const mx = u.muzzleX;
    const my = u.muzzleY + (c.members ? infantryDepth(u.lane) : 0);
    drawMuzzleLight(
      ctx,
      mx,
      my,
      u.lastAmmo ?? ammunition(u.id, u.member),
      Math.min(1, u.fire / 0.12),
    );
  }
  // Illumination flares: a drifting candle under a small parachute, washing
  // the ground in cold daylight that fades and flickers as it descends.
  for (const f of s.flares) {
    if (f.x < camera - 350 || f.x > camera + viewportWidth + 350) continue;
    const sway = Math.sin(f.life * 2.2 + f.seed) * 6;
    const burn = Math.min(1, f.life / 2.5);
    const flicker =
      0.82 + 0.18 * Math.sin(f.life * 17 + f.seed) * Math.sin(f.life * 7.3);
    const strength = burn * flicker;
    const gx = f.x + sway;
    const gy = f.y + 14;
    const lightRadius = (f.radius ?? 260) + 40;
    const pool = ctx.createRadialGradient(gx, gy, 0, gx, gy, lightRadius);
    pool.addColorStop(0, `rgba(255,246,214,${0.4 * strength})`);
    pool.addColorStop(0.4, `rgba(255,238,190,${0.2 * strength})`);
    pool.addColorStop(1, 'rgba(255,230,170,0)');
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = pool;
    ctx.beginPath();
    ctx.arc(gx, gy, lightRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // Parachute canopy and the candle itself.
    ctx.save();
    ctx.globalAlpha = 0.85 * burn;
    ctx.strokeStyle = 'rgba(235,238,245,0.9)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(gx, f.y - 9, 7, Math.PI, 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(gx - 7, f.y - 9);
    ctx.lineTo(gx, f.y - 1);
    ctx.moveTo(gx + 7, f.y - 9);
    ctx.lineTo(gx, f.y - 1);
    ctx.stroke();
    const candle = ctx.createRadialGradient(gx, f.y, 0, gx, f.y, 9);
    candle.addColorStop(0, `rgba(255,255,235,${0.95 * flicker})`);
    candle.addColorStop(0.4, `rgba(255,236,170,${0.7 * flicker})`);
    candle.addColorStop(1, 'rgba(255,220,130,0)');
    ctx.fillStyle = candle;
    ctx.beginPath();
    ctx.arc(gx, f.y, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  // Sound-ranging fixes on enemy batteries: a dashed uncertainty circle
  // with an expanding sonar ripple, fading as the report goes stale.
  for (const r of s.batteryReports) {
    if (r.side !== 0) continue;
    if (r.x < camera - 220 || r.x > camera + viewportWidth + 220) continue;
    const gy = ground(s, r.x) - 6;
    const fresh = Math.min(1, r.life / (r.maxLife * 0.5));
    const phase = (s.time * 0.9 + r.uid * 0.37) % 1;
    ctx.save();
    ctx.globalAlpha = 0.55 * fresh;
    ctx.strokeStyle = '#ffb347';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.arc(r.x, gy, r.scatter, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    // Expanding sonar ring.
    ctx.globalAlpha = 0.4 * fresh * (1 - phase);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(r.x, gy, r.scatter * (0.35 + phase * 0.9), 0, Math.PI * 2);
    ctx.stroke();
    // Crosshair tick at the estimated muzzle.
    ctx.globalAlpha = 0.8 * fresh;
    ctx.strokeStyle = '#ffd28a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(r.x - 9, gy);
    ctx.lineTo(r.x - 3, gy);
    ctx.moveTo(r.x + 3, gy);
    ctx.lineTo(r.x + 9, gy);
    ctx.moveTo(r.x, gy - 9);
    ctx.lineTo(r.x, gy - 3);
    ctx.moveTo(r.x, gy + 3);
    ctx.lineTo(r.x, gy + 9);
    ctx.stroke();
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd28a';
    ctx.fillText(
      `敌方炮位 ${Math.ceil(r.life)}s`,
      r.x,
      gy - r.scatter - 10,
    );
    ctx.restore();
  }
  drawWreckSmoke(ctx, s, camera, viewportWidth, art.smoke);
  drawWreckFire(ctx, s, camera, viewportWidth);
  for (const f of s.smokes) {
    if (f.side !== 0 && !pointVisible(s, 0, f.x, ground(s, f.x) - 30)) continue;
    if (f.x < camera - 140 || f.x > camera + viewportWidth + 140) continue;
    ctx.save();
    ctx.filter = 'grayscale(1)';
    drawToxicCloudV18(
      ctx,
      art.comeback,
      s.time + f.x,
      f.x,
      visibleGround(f.x) + 6,
      270,
      Math.min(0.75, f.life / 2),
    );
    ctx.restore();
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e7e9d1';
    ctx.fillText('烟幕 ' + Math.ceil(f.life) + 's', f.x, ground(s, f.x) - 90);
  }
  const gas = s.comeback?.gas;
  if (gas && s.time >= gas.start) {
    for (
      let x = Math.max(240, Math.floor(left / 180) * 180);
      x < Math.min(W - 120, right + 128);
      x += 180
    ) {
      drawToxicCloudV18(
        ctx,
        art.comeback,
        s.time - gas.start + x / 137,
        x,
        visibleGround(x) + 5,
        270,
        Math.min(0.58, (s.time - gas.start) * 0.6, (gas.end - s.time) * 0.5),
        x % 360 === 0,
      );
    }
  }
  for (const p of s.projectiles) {
    if (!pointVisible(s, 0, p.x, p.y)) continue;
    let offset = projectileOffsets.get(p);
    if (!offset) {
      offset =
        p.sourceUid === undefined
          ? { x: 0, y: 0 }
          : (sourceOffsets.get(p.sourceUid) ?? { x: 0, y: 0 });
      projectileOffsets.set(p, offset);
    }
    drawProjectile(ctx, projectileForRender(s, p, offset));
    if (!reduced)
      whipStreaks.consider(
        p,
        camera + viewportWidth / 2,
        H / 2,
        viewportWidth,
        s.time,
      );
  }
  for (const b of s.blasts)
    if (blastVisible(s, 0, b))
      drawBlast(ctx, b, art.explosions, art.combatExplosions, art.combatExplosionsV13, art.paintedBlasts);
  for (const p of s.particles)
    if (pointVisible(s, 0, p.x, p.y)) drawParticle(ctx, p, art.impacts, art.smoke);
  ctx.save();
  // Saturation blending removes color while preserving the scene's luminance.
  ctx.globalCompositeOperation = 'saturation';
  ctx.fillStyle = '#808080';
  for (let x = Math.floor(left / 64) * 64; x < right; x += 64)
    if (!s.sight[0][Math.floor(x / 64)]) {
      ctx.fillRect(x, -H, 64, H * 3);
    }
  ctx.restore();
  ctx.globalAlpha = 1;
  if (gas) {
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = s.time < gas.start ? '#f2ca82' : '#d6dfa2';
    ctx.fillText(
      s.time < gas.start
        ? `毒气封锁 · ${Math.ceil(gas.start - s.time)}秒后生效`
        : `毒气封锁 · 双方步兵受伤 · ${Math.ceil(gas.end - s.time)}秒`,
      camera + viewportWidth / 2,
      58,
    );
  }
  const reserve = s.comeback?.reserves.find((r) => r.side === 0);
  if (reserve) {
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#d6dfa2';
    ctx.fillText(
      `预备队 · ${Math.max(0, Math.ceil(reserve.at - s.time))}秒后抵达`,
      camera + viewportWidth / 2,
      gas ? 75 : 58,
    );
  }
  if (c && hover !== null && s.status === 'playing') {
    const y = visibleGround(hover);
    if (c.targetGround) {
      ctx.strokeStyle = '#f9e0a2';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.ellipse(
        hover,
        y,
        c.id === 'precision' ? 36 : c.id === 'smoke' ? 110 : 105,
        22,
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(hover, y - 45);
      ctx.lineTo(hover, y + 15);
      ctx.moveTo(hover - 15, y - 15);
      ctx.lineTo(hover + 15, y - 15);
      ctx.stroke();
    }
  }
  if (s.night) drawNightOverlay(ctx, s, camera, viewportWidth);
  drawWeather(ctx, s, camera, viewportWidth, H);
  if (!reduced) whipStreaks.draw(ctx, s.time);
  if (!reduced) drawRicochets(ctx, s.ricochets);
  ctx.restore();
}
