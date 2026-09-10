import {
  CARDS,
  ground,
  H,
  W,
  VIEW_W,
  type GameState,
  type CardId,
} from './engine';
import { drawSprite, cardFrame, type Art } from './art';
export function render(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  art: Art,
  selected: CardId | null,
  hover: number | null,
  reduced = false,
  camera = 0,
) {
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, VIEW_W, H);
  ctx.save();
  if (s.shake > 0 && !reduced)
    ctx.translate(
      Math.sin(s.time * 134) * s.shake,
      Math.cos(s.time * 123) * s.shake * 0.4,
    );
  const parallax = (camera * 0.3) % VIEW_W;
  ctx.drawImage(art.background, -parallax, -24, VIEW_W, H);
  ctx.drawImage(art.background, VIEW_W - parallax, -24, VIEW_W, H);
  ctx.translate(-Math.round(camera), 0);
  // Draw the soil material through the destructible heightfield; craters expose inner strata.
  const left = Math.max(0, Math.floor(camera / 3) * 3),
    right = Math.min(W, Math.ceil((camera + VIEW_W) / 3) * 3);
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
    const c = CARDS[u.id],
      isTank = u.id === 'tank',
      isAir = !!c.air,
      isDead = u.hp <= 0;
    const w = isTank ? 205 : isAir ? 235 : 96,
      h = isTank ? 108 : isAir ? 118 : 72;
    let row = 0,
      frame = 0;
    if (c.members) {
      if (isDead) {
        row = 7;
        frame = Math.min(3, Math.floor((1.5 - u.deadFor) * 4));
      } else if (u.flash > 0) {
        row = 7;
        frame = 0;
      } else if (u.pose === 'climb') {
        row = 3;
        frame = Math.min(3, Math.floor((1 - u.climbing / 1.2) * 4));
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
    const img = c.members
      ? art.soldiers[row][frame]
      : art.vehicles[isTank ? 0 : 1][frame];
    ctx.fillStyle = isAir ? '#25372b14' : '#25372b33';
    ctx.fillRect(u.x - w * 0.23, ground(s, u.x) + u.lane, w * 0.46, 3);
    const alpha = isDead ? Math.min(1, u.deadFor) : 1;
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
      u.side === 1,
      alpha,
    );
    if (!c.members && isDead) ctx.restore();
    if (c.members && !isDead && u.id !== 'infantry' && u.pose !== 'climb') {
      const weapon = art.vehicles[2][u.id === 'machinegun' ? 2 : 3];
      const wy = u.y - (u.pose === 'prone' ? 9 : u.pose === 'crouch' ? 28 : 47);
      drawSprite(
        ctx,
        weapon,
        u.x + (u.side === 0 ? 6 : -6),
        wy + 7,
        u.id === 'rocket' ? 39 : 33,
        15,
        u.side === 1,
      );
    }
    if (isDead) continue;
    if (u.fire > 0.16) {
      const mx = u.x + (u.side === 0 ? 1 : -1) * (c.members ? 23 : w * 0.45),
        my =
          u.y -
          (isTank
            ? 54
            : isAir
              ? 24
              : u.pose === 'prone'
                ? 9
                : u.pose === 'crouch'
                  ? 28
                  : 47);
      ctx.fillStyle = '#eebc6955';
      ctx.fillRect(mx - 3, my - 2, 8, 5);
      ctx.fillStyle = '#ffe8ad';
      ctx.fillRect(mx, my - 1, 4, 2);
      ctx.fillRect(mx + 1, my - 3, 2, 6);
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
  for (const p of s.projectiles) {
    const angle = Math.atan2(p.ty - p.startY, p.tx - p.startX),
      dir = p.tx > p.startX ? 1 : -1;
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y));
    ctx.rotate(angle);
    if (p.radius) {
      ctx.fillStyle = '#b6b09b';
      ctx.fillRect(-4, -2, 7, 4);
      ctx.fillStyle = '#343930';
      ctx.fillRect(2, -1, 3, 2);
      ctx.fillStyle = '#d7ac6466';
      ctx.fillRect(-10, -1, 6, 2);
      ctx.fillStyle = '#7e807955';
      ctx.fillRect(-16, -2, 6, 3);
    } else {
      ctx.fillStyle = '#d2ac6240';
      ctx.fillRect(-17, 0, 8, 1);
      ctx.fillStyle = '#edd59b99';
      ctx.fillRect(-9, 0, 7, 1);
      ctx.fillStyle = '#fff4c9';
      ctx.fillRect(-2, 0, 3, 1);
    }
    ctx.restore();
  }
  for (const m of s.markers) {
    const y = ground(s, m.x);
    ctx.strokeStyle = m.side === 0 ? '#e09c46' : '#d9644d';
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 5]);
    ctx.beginPath();
    ctx.ellipse(m.x, y, 91, 20, 0, 0, Math.PI * 2);
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
    ctx.fillText('炮击预警', m.x, y - 65);
  }
  for (const p of s.particles) {
    ctx.globalAlpha = Math.min(1, (p.life / p.maxLife) * 2);
    ctx.fillStyle = p.color;
    ctx.fillRect(Math.round(p.x), Math.round(p.y), p.size, p.size);
  }
  ctx.globalAlpha = 1;
  if (c && hover !== null && s.status === 'playing') {
    const y = ground(s, hover);
    if (c.type === 'unit') {
      const valid = hover >= 110 && hover <= 440;
      drawSprite(
        ctx,
        cardFrame(art, c.atlas),
        hover,
        c.air ? 239 : y + 3,
        c.id === 'tank' ? 205 : c.air ? 235 : 96,
        c.id === 'tank' ? 108 : c.air ? 118 : 72,
        false,
        valid ? 0.65 : 0.3,
      );
      if (c.members) {
        for (let i = 1; i < c.members; i++)
          drawSprite(
            ctx,
            art.soldiers[1][0],
            Math.max(112, hover - i * 22),
            ground(s, Math.max(112, hover - i * 22)) + 3,
            96,
            72,
            false,
            valid ? 0.35 : 0.15,
          );
      }
      ctx.strokeStyle = valid ? '#e9eac9' : '#c85b48';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(hover - 15, y + 7);
      ctx.lineTo(hover + 15, y + 7);
      ctx.stroke();
    } else if (c.id === 'artillery') {
      ctx.strokeStyle = '#f9e0a2';
      ctx.lineWidth = 2;
      ctx.setLineDash([7, 6]);
      ctx.beginPath();
      ctx.ellipse(hover, y, 105, 22, 0, 0, Math.PI * 2);
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
