import {
  ammunition,
  drawMuzzle,
  drawProjectile,
  drawParticle,
  drawBlast,
} from './ballistics';
import { modelOf } from './cards';
import {
  CARDS,
  ground,
  H,
  W,
  VIEW_W,
  muzzleHeight,
  formationPositions,
  vehicleContact,
  AIR_ALTITUDE,
  type GameState,
  type CardId,
} from './engine';
import {
  drawSprite,
  cardFrame,
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
  // Draw the soil material through the destructible heightfield; craters expose inner strata.
  const left = Math.max(0, Math.floor(camera / 3) * 3),
    right = Math.min(W, Math.ceil((camera + viewportWidth) / 3) * 3);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(left, H + 3);
  for (let x = left; x <= right; x += 3)
    ctx.lineTo(x, Math.round(ground(s, Math.min(W - 1, x))));
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
    const y = Math.round(ground(s, x)),
      broken = y > s.original[x] + 5;
    ctx.fillStyle = broken ? '#746959' : '#6b7050';
    ctx.fillRect(x, y - 2, 3, 3);
    if (!broken && x % 12 === 0) {
      ctx.fillStyle = '#929078';
      ctx.fillRect(x, y - 4, 2, 3);
    }
  }
  for (const wall of s.walls) {
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
  const c = selected ? CARDS[selected] : null;
  if (c?.type === 'unit' && s.status === 'playing') {
    ctx.fillStyle = '#b2d5cd30';
    ctx.fillRect(110, 275, 330, 105);
    ctx.strokeStyle = '#daeee3';
    ctx.lineWidth = 1;
    ctx.setLineDash([8, 8]);
    ctx.strokeRect(110, 276, 330, 104);
    ctx.setLineDash([]);
    ctx.font = 'bold 13px monospace';
    ctx.fillStyle = '#edf4db';
    ctx.textAlign = 'center';
    ctx.fillText('↓  友方部署区  ↓', 275, 297);
  }
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
  for (const u of sorted) {
    if (u.x < camera - 180 || u.x > camera + viewportWidth + 180) continue;
    const c = CARDS[u.id],
      isTank = modelOf(u.id) === 'tank',
      isIFV = modelOf(u.id) === 'ifv',
      isAir = !!c.air,
      isDead = u.hp <= 0;
    const w = isTank ? 205 : isIFV ? 165 : isAir ? 235 : 96,
      h = isTank ? 108 : isIFV ? 105 : isAir ? 118 : 72;
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
      } else if (u.fire > 0) {
        row = 6;
        frame = Math.floor((0.25 - u.fire) * 16) % 4;
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
    let img = c.members
      ? art.soldiers[row][frame]
      : isIFV
        ? art.reinforcements[0][frame]
        : art.vehicles[isTank ? 0 : 1][frame];
    if (c.members && !isDead && !u.wounded) {
      if (u.motion === 'jump') {
        const frame =
          u.motionTime < 0.07 ? 1 : u.vy < 0 ? 2 : u.vy < 65 ? 3 : 4;
        img = art.locomotion[1][frame];
      } else if (u.motion === 'land')
        img = art.locomotion[1][u.motionTime < 0.12 ? 6 : 7];
      else if (u.motion === 'bank')
        img =
          art.locomotion[2][
            [5, 6, 6, 5, 4, 4, 7, 7][
              Math.min(7, Math.floor((u.motionTime / u.motionDuration) * 8))
            ]
          ];
      else if (u.climbing > 0)
        img =
          art.locomotion[2][
            Math.min(7, Math.floor((1 - u.climbing / u.climbDuration) * 8))
          ];
      else if (u.pose === 'walk' && u.moving)
        img = art.locomotion[0][Math.floor(u.walk) % 8];
    }
    if (
      c.members &&
      u.tactic === 'retreat' &&
      u.motion === 'ground' &&
      !u.climbing &&
      u.moving
    )
      img = art.locomotion[0][Math.floor(u.walk) % 8];
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
    if (c.members) img = uniformFrame(img, c.uniform);
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
      h,
      c.members ? u.facing < 0 : u.side === 1,
      alpha,
      c.armored ? u.hullAngle : 0,
    );
    if (!c.members && isDead) ctx.restore();
    if (
      c.members &&
      !isDead &&
      !u.surrendered &&
      !u.wounded &&
      modelOf(u.id) !== 'infantry' &&
      u.pose !== 'climb' &&
      u.motion === 'ground'
    ) {
      const weapon = soldierEquipment(art, u.id);
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
    if (u.secondaryFire > 0)
      drawMuzzle(
        ctx,
        u.secondaryMuzzleX,
        u.secondaryMuzzleY,
        u.secondaryAngle,
        'machinegun',
        0.09 - u.secondaryFire,
      );
    if (u.tactic === 'retreat') {
      ctx.fillStyle = '#e3b975';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('撤退', u.x, u.y - 78);
    }
    if (u.fire > 0 && u.motion === 'ground' && !u.climbing)
      drawMuzzle(
        ctx,
        u.muzzleX,
        u.muzzleY,
        u.shotAngle,
        ammunition(u.id),
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
  for (const f of s.smokes) {
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
  for (const p of s.projectiles) drawProjectile(ctx, p);
  for (const m of s.markers) {
    const y = ground(s, m.x);
    ctx.strokeStyle = m.side === 0 ? '#e09c46' : '#d9644d';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.ellipse(
      m.x,
      y,
      m.kind === 'precision' ? 34 : m.kind === 'barrage' ? 185 : 140,
      20,
      0,
      0,
      Math.PI * 2,
    );
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(m.x, y - 55);
    ctx.lineTo(m.x, y + 14);
    ctx.moveTo(m.x - 22, y - 16);
    ctx.lineTo(m.x + 22, y - 16);
    ctx.stroke();
    ctx.fillStyle = '#f4ca7c';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${m.kind === 'precision' ? '精确打击' : '炮击预警'} ${Math.max(0, m.timer).toFixed(1)}s`,
      m.x,
      y - 65,
    );
  }
  for (const b of s.blasts) drawBlast(ctx, b);
  for (const p of s.particles) drawParticle(ctx, p);
  ctx.globalAlpha = 1;
  if (c && hover !== null && s.status === 'playing') {
    const y = ground(s, hover);
    if (c.type === 'unit') {
      const valid = hover >= 110 && hover <= 440;
      const positions = formationPositions(0, c.id, hover);
      for (const [i, x] of positions.entries()) {
        const contact = c.armored
          ? vehicleContact(s, x, c.id)
          : { y: ground(s, x), angle: 0 };
        drawSprite(
          ctx,
          cardFrame(art, c.atlas),
          x,
          c.air ? AIR_ALTITUDE + 3 : contact.y + 3,
          modelOf(c.id) === 'tank'
            ? 205
            : modelOf(c.id) === 'ifv'
              ? 165
              : c.air
                ? 235
                : 96,
          modelOf(c.id) === 'tank'
            ? 108
            : modelOf(c.id) === 'ifv'
              ? 105
              : c.air
                ? 118
                : 72,
          false,
          valid ? (i ? 0.4 : 0.65) : 0.2,
          contact.angle,
        );
      }
      ctx.strokeStyle = valid ? '#e9eac9' : '#c85b48';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hover - 15, y + 7);
      ctx.lineTo(hover + 15, y + 7);
      ctx.stroke();
    } else if (c.targetGround) {
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
