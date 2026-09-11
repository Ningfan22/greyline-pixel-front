import { drawScenery } from './scenery-art';
import { pointVisible, visibleToSide } from './world';
import {
  ammunition,
  drawMuzzle,
  drawProjectile,
  drawParticle,
  drawBlast,
} from './ballistics';
import { modelOf, weaponModel } from './cards';
import {
  CARDS,
  ground,
  H,
  W,
  VIEW_W,
  muzzleHeight,
  type GameState,
  type CardId,
} from './engine';
import {
  drawSprite,
  unitFrame,
  unitSize,
  soldierEquipment,
  uniformFrame,
  type Art,
} from './art';
export function render(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  art: Art,
  selected: CardId | null,
  hover: number | null,
  reduced = false,
  camera = 0,
  viewportWidth = VIEW_W,
) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, viewportWidth, H);
  ctx.save();
  if (s.shake > 0 && !reduced)
    ctx.translate(
      Math.sin(s.time * 134) * s.shake,
      Math.cos(s.time * 123) * s.shake * 0.4,
    );
  const parallax = (camera * 0.3) % VIEW_W;
  for (let x = -parallax; x < viewportWidth; x += VIEW_W)
    ctx.drawImage(art.background, x, -24, VIEW_W, H);
  ctx.translate(-Math.round(camera), 0);
  const visibleGround = (x: number) =>
    s.knownTerrain[0][Math.max(0, Math.min(W - 1, Math.floor(x)))];
  // Draw the soil material through the destructible heightfield; craters expose inner strata.
  const left = Math.max(0, Math.floor(camera / 3) * 3),
    right = Math.min(W, Math.ceil((camera + viewportWidth) / 3) * 3);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(left, H + 3);
  for (let x = left; x <= right; x += 3)
    ctx.lineTo(x, Math.round(visibleGround(x)));
  ctx.lineTo(right, H + 3);
  ctx.closePath();
  ctx.clip();
  const tw = art.terrain.width,
    th = art.terrain.height;
  for (let x = left; x < right; x += 3) {
    const sourceX = ((x % 1023) / 1023) * tw;
    ctx.drawImage(
      art.terrain,
      sourceX,
      0,
      (tw * 3) / 1023,
      th,
      x,
      s.original[Math.min(W - 1, x)] - 5,
      3,
      170,
    );
  }
  ctx.restore();
  for (let x = left; x < right; x += 3) {
    const y = Math.round(visibleGround(x)),
      broken = y > s.original[x] + 5;
    ctx.fillStyle = broken ? '#746959' : '#6b7050';
    ctx.fillRect(x, y - 2, 3, 3);
    if (broken) {
      ctx.fillStyle = '#423e35';
      ctx.fillRect(x, y, 3, 3);
      ctx.fillStyle = '#b09a70';
      ctx.fillRect(x, y - 3, 3, 1);
    }
    if (!broken && x % 12 === 0) {
      ctx.fillStyle = '#929078';
      ctx.fillRect(x, y - 4, 2, 3);
    }
  }
  const drawCoverProps = () => {
    for (const wall of Object.values(s.knownWalls[0])) {
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
      if (prop.x > camera - 160 && prop.x < camera + viewportWidth + 160)
        drawScenery(ctx, prop, s.time, art.scenery);
    for (const w of s.wrecks) {
      if (
        w.x < camera - 200 ||
        w.x > camera + viewportWidth + 200 ||
        !(w.side === 0 || pointVisible(s, 0, w.x, w.y - 12))
      )
        continue;
      const c = CARDS[w.cardId],
        [width, height] = unitSize(w.cardId);
      ctx.save();
      ctx.filter = 'saturate(.2) brightness(.48)';
      drawSprite(
        ctx,
        c.members
          ? art.soldiers[7][Math.min(3, Math.floor(w.age * 8))]
          : unitFrame(art, w.cardId, 0),
        w.x,
        w.y + 3,
        c.members ? 96 : width * (w.falling ? 1 : 0.88),
        c.members ? 72 : height * (w.falling ? 1 : 0.48),
        w.side === 1,
        1,
        w.angle,
      );
      ctx.restore();
      if (!c.members && !w.falling) {
        ctx.fillStyle = '#252d26';
        ctx.fillRect(w.x - 40, w.y - 4, 80, 5);
        for (let i = 0; i < 8; i++) {
          ctx.fillStyle = i % 2 ? '#535a4b' : '#30392e';
          ctx.fillRect(
            w.x - 62 + ((i * 19) % 121),
            w.y - 6 - (i % 3) * 3,
            7,
            3,
          );
        }
      }
    }
  };
  for (const m of s.mines)
    if (m.side === 0) {
      ctx.fillStyle = s.time < m.armAt ? '#b2a16a' : '#748c6c';
      ctx.fillRect(m.x - 5, visibleGround(m.x) - 5, 10, 4);
      ctx.fillStyle = '#d3cba0';
      ctx.fillRect(m.x - 1, visibleGround(m.x) - 7, 2, 2);
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
  const sorted = [...s.units].sort(
    (a, b) =>
      Number(!!CARDS[a.id].air) - Number(!!CARDS[b.id].air) || a.lane - b.lane,
  );
  let coverDrawn = false;
  for (const u of sorted) {
    if (CARDS[u.id].air && !coverDrawn) {
      drawCoverProps();
      coverDrawn = true;
    }
    if (!visibleToSide(s, 0, u)) continue;
    if (u.x < camera - 180 || u.x > camera + viewportWidth + 180) continue;
    const c = CARDS[u.id],
      isTank = modelOf(u.id) === 'tank',
      isAir = !!c.air,
      isDead = u.hp <= 0;
    const [w, h] = unitSize(u.id);
    let row = 0,
      frame = 0;
    if (c.members) {
      if (u.wounded) {
        row = 7;
        frame = Math.min(3, Math.floor(u.woundedTime * 7));
      } else if (isDead) {
        row = 7;
        frame = Math.min(3, Math.floor((1.5 - u.deadFor) * 4));
      } else if (
        u.flash > 0 &&
        !u.moving &&
        u.tactic !== 'retreat' &&
        !u.cover &&
        u.motion === 'ground' &&
        !u.climbing
      ) {
        row = 7;
        frame = 0;
      } else if (u.pose === 'climb') {
        row = 3;
        frame = Math.min(3, Math.floor((1 - u.climbing / u.climbDuration) * 4));
      } else if (u.pose === 'crouch') {
        row = 4;
        frame = u.moving ? Math.floor(u.walk) % 4 : 0;
      } else if (u.pose === 'prone') {
        row = 5;
        frame = u.moving ? Math.floor(u.walk) % 4 : 0;
      } else if ((u.aimUntil ?? 0) > s.time && !u.moving) {
        row = 6;
        frame = u.fire > 0 ? 1 : 0;
      } else if (u.pose === 'run') {
        row = 2;
        frame = Math.floor(u.walk) % 4;
      } else if (u.moving) {
        row = 1;
        frame = Math.floor(u.walk) % 4;
      } else {
        row = 0;
        frame = Math.floor(s.time * 2 + u.uid) % 4;
      }
    } else frame = Math.floor(s.time * (isAir ? 18 : u.moving ? 8 : 0)) % 4;
    if (c.emplacement && u.fire > 0.1) frame = 1;
    let img = c.members
      ? art.soldiers[row][frame]
      : unitFrame(art, u.id, frame);
    if (c.members && !u.surrendered) {
      const identity =
        u.id === 'militia'
          ? 3
          : c.uniform === 'police'
            ? 2
            : ['marines', 'paratroopers', 'rangers'].includes(u.id)
              ? 1
              : 0;
      const cycle = Math.floor(u.walk) % 8;
      if (identity > 0) {
        const poses = art.identities[identity * 2 + 1];
        img =
          isDead || u.wounded
            ? poses[7]
            : u.motion === 'jump'
              ? poses[6]
              : u.motion === 'land'
                ? poses[1]
                : u.climbing || u.motion === 'bank'
                  ? poses[4 + (Math.floor(u.motionTime * 8) % 2)]
                  : u.pose === 'prone'
                    ? poses[u.moving ? 2 + (cycle % 2) : 2]
                    : u.pose === 'crouch' && !u.moving
                      ? poses[1]
                      : u.moving
                        ? art.identities[identity * 2][cycle]
                        : poses[0];
      } else if (!isDead && !u.wounded) {
        const progress = Math.min(
          7,
          Math.floor((u.motionTime / Math.max(0.1, u.motionDuration)) * 8),
        );
        img =
          u.motion === 'jump'
            ? art.motions[6][Math.min(7, Math.floor(u.motionTime * 12))]
            : u.motion === 'land'
              ? art.motions[7][Math.min(7, Math.floor(u.motionTime * 22))]
              : u.motion === 'bank'
                ? art.motions[3][progress]
                : u.climbing
                  ? art.motions[3][
                      Math.min(
                        7,
                        Math.floor((1 - u.climbing / u.climbDuration) * 8),
                      )
                    ]
                  : u.pose === 'prone'
                    ? art.identities[1][u.moving ? 2 + (cycle % 2) : 2]
                    : u.pose === 'crouch'
                      ? art.motions[4][u.moving ? cycle : 0]
                      : u.moving
                        ? art.motions[
                            u.pose === 'run' || u.tactic === 'retreat' ? 2 : 1
                          ][cycle]
                        : art.motions[0][Math.floor(s.time * 4 + u.uid) % 8];
      }
      if (!identity) img = uniformFrame(img, c.uniform);
    }
    if (u.surrendered)
      img =
        art.reactions[0][
          u.surrenderTime < 0.35
            ? 0
            : u.surrenderTime < 0.75
              ? 1
              : u.surrenderTime < 2.5
                ? 2
                : 3
        ];

    ctx.fillStyle = isAir ? '#25372b14' : '#25372b33';
    ctx.fillRect(u.x - w * 0.23, ground(s, u.x) + u.lane, w * 0.46, 3);
    const alpha = isDead
      ? Math.min(1, u.deadFor)
      : u.surrendered
        ? Math.min(1, 6 - u.surrenderTime)
        : 1;
    if (!c.members && isDead) {
      ctx.save();
      ctx.filter = 'grayscale(1) brightness(.5)';
    }
    drawSprite(
      ctx,
      img,
      u.x + (isTank && u.fire > 0 ? (u.side === 0 ? -2 : 2) : 0),
      u.y + u.lane + 3,
      w,
      c.members ? img.height * 1.5 : h,
      c.members || c.air ? u.facing < 0 : u.side === 1,
      alpha,
      c.armored ? u.hullAngle : 0,
    );
    if (!c.members && isDead) ctx.restore();
    if (
      c.members &&
      !isDead &&
      !u.surrendered &&
      !u.wounded &&
      weaponModel(u) !== 'infantry' &&
      u.pose !== 'climb' &&
      u.motion === 'ground'
    ) {
      const weapon = soldierEquipment(art, u.id, u.member);
      const wy = u.y - muzzleHeight(u);
      drawSprite(
        ctx,
        weapon,
        u.x +
          u.facing *
            (modelOf(u.id) === 'medic'
              ? -8
              : modelOf(u.id) === 'mortar'
                ? u.moving
                  ? -8
                  : 17
                : 6),
        modelOf(u.id) === 'mortar'
          ? u.y - (u.moving ? 12 : 0)
          : modelOf(u.id) === 'medic'
            ? u.y - 25
            : wy + 7,
        modelOf(u.id) === 'medic'
          ? 14
          : modelOf(u.id) === 'mortar'
            ? 27
            : modelOf(u.id) === 'sniper'
              ? 43
              : 36,
        modelOf(u.id) === 'medic' ? 17 : modelOf(u.id) === 'mortar' ? 30 : 15,
        u.facing < 0,
      );
    }
    if (isDead) continue;
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
    if (u.secondaryFire > 0)
      drawMuzzle(
        ctx,
        u.secondaryMuzzleX,
        u.secondaryMuzzleY,
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
        u.muzzleX,
        u.muzzleY,
        u.shotAngle,
        u.lastAmmo ?? ammunition(u.id, u.member),
        0.25 - u.fire,
      );
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
        (u.pose === 'prone' ? 22 : u.pose === 'crouch' ? 47 : h) +
        u.lane -
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
  if (!coverDrawn) drawCoverProps();
  for (const f of s.smokes) {
    if (f.side !== 0 && !pointVisible(s, 0, f.x, ground(s, f.x) - 30)) continue;
    if (f.x < camera - 140 || f.x > camera + viewportWidth + 140) continue;
    ctx.globalAlpha = Math.min(0.6, f.life / 2);
    for (let i = 0; i < 22; i++) {
      const x = f.x - 110 + ((i * 41) % 220),
        y = ground(s, f.x) - 20 - ((i * 17) % 58) - Math.sin(s.time + i) * 4;
      ctx.fillStyle = i % 2 ? '#8e958a' : '#adb1a2';
      ctx.fillRect(
        Math.round(x / 3) * 3,
        Math.round(y / 3) * 3,
        28 + (i % 4) * 5,
        19 + (i % 3) * 6,
      );
    }
    ctx.globalAlpha = 1;
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#e7e9d1';
    ctx.fillText('烟幕 ' + Math.ceil(f.life) + 's', f.x, ground(s, f.x) - 90);
  }
  for (const p of s.projectiles)
    if (pointVisible(s, 0, p.x, p.y)) drawProjectile(ctx, p);
  for (const b of s.blasts)
    if (pointVisible(s, 0, b.x, b.y))
      drawBlast(ctx, b, art.explosions, art.combatExplosions);
  for (const p of s.particles)
    if (pointVisible(s, 0, p.x, p.y)) drawParticle(ctx, p, art.impacts);
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
  ctx.restore();
}
