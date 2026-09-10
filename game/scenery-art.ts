import type { Scenery } from './world';
export function drawScenery(
  ctx: CanvasRenderingContext2D,
  p: Scenery,
  time: number,
  art: HTMLCanvasElement[],
) {
  ctx.save();
  ctx.imageSmoothingEnabled = false;
  if (p.kind === 'tree') {
    const trunk = p.parts.find((a) => a.kind === 'trunk')!,
      crown = p.parts.find((a) => a.kind === 'crown')!;
    const fallen = trunk.hp <= 0,
      t = fallen ? Math.min(1, (time - trunk.brokenAt) / 0.85) : 0;
    const pine = p.seed % 2 === 0,
      img = art[pine ? 2 : 1],
      w = pine ? 86 : 112,
      h = 140;
    ctx.translate(p.x, p.y - t * 5);
    ctx.scale(1, 1 - t * 0.7);
    ctx.rotate((t * Math.PI) / 2);
    if (fallen) ctx.filter = 'saturate(.55) brightness(.8)';
    if (crown.hp <= 0 && !fallen) {
      ctx.beginPath();
      ctx.rect(-10, -70, 20, 70);
      ctx.clip();
    }
    ctx.drawImage(img, -w / 2, -h, w, h);
  } else {
    for (const part of p.parts) {
      if (part.hp > 0) {
        ctx.save();
        ctx.beginPath();
        ctx.rect(part.x, part.y, part.w, part.h);
        ctx.clip();
        ctx.drawImage(art[0], p.x - 61, p.y - 153, 122, 153);
        if (part.hp < part.maxHp * 0.75) {
          ctx.fillStyle = '#34382c';
          for (let i = 0; i < 9; i++)
            ctx.fillRect(
              part.x + part.w - 10 + Math.round(Math.sin(i) * 3),
              part.y + 9 + i * 7,
              2,
              9,
            );
        }
        if (part.hp < part.maxHp * 0.35) {
          ctx.fillStyle = '#252f27';
          ctx.fillRect(part.x + 3, part.y + part.h * 0.48, 13, 18);
          ctx.fillRect(part.x + 6, part.y + part.h * 0.48 - 5, 7, 30);
        }
        ctx.restore();
      } else {
        const t = Math.min(1, (time - part.brokenAt) / 0.75);
        if (part.kind !== 'roof')
          ctx.drawImage(art[3], part.x - 7, p.y - 26, part.w + 14, 28);
        if (t < 1) {
          ctx.save();
          ctx.translate(part.x + part.w / 2, part.y + part.h / 2 + t * t * 60);
          ctx.rotate(t * 0.3 * (part.id % 2 ? 1 : -1));
          ctx.globalAlpha = 1 - t;
          const sx = ((part.x - (p.x - 61)) / 122) * art[0].width,
            sy = ((part.y - (p.y - 153)) / 153) * art[0].height;
          ctx.drawImage(
            art[0],
            sx,
            sy,
            (part.w / 122) * art[0].width,
            (part.h / 153) * art[0].height,
            -part.w / 2,
            -part.h / 2,
            part.w,
            part.h,
          );
          ctx.restore();
          ctx.fillStyle = '#aaa087';
          ctx.globalAlpha = (1 - t) * 0.65;
          for (let i = 0; i < 9; i++)
            ctx.fillRect(
              part.x + i * 5 - 12 * t,
              p.y - 12 - t * (i % 3) * 13,
              8,
              6,
            );
          ctx.globalAlpha = 1;
        }
      }
    }
  }
  ctx.restore();
}
