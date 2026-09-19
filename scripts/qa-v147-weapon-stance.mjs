import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const { createCanvas, Image } = createRequire(import.meta.url)(
  '@napi-rs/canvas',
);
globalThis.document = { createElement: () => createCanvas(1, 1) };
globalThis.Image = class extends Image {
  set src(v) {
    super.src = v.startsWith('/')
      ? fileURLToPath(new URL('../public' + v, import.meta.url))
      : v;
  }
  get src() {
    return super.src;
  }
};
const { loadArt, uniformFrame } = await import('../game/art.ts');
const { render } = await import('../game/render.ts');
const { specialistSprite } = await import('../game/adult-specialists.ts');
const { adultFrameChoice, adultIdentity } =
  await import('../game/adult-animation.ts');
const { stanceTransitionDuration } =
  await import('../game/infantry-action-timing.ts');
const { createGame, startGame, spawnUnit, CARDS, H } =
  await import('../game/engine.ts');
const art = await loadArt(),
  out = mkdtempSync(join(tmpdir(), 'greyline-v147-weapon-stance-'));
const bounds = (im) => {
  const d = im.getContext('2d').getImageData(0, 0, im.width, im.height).data;
  let left = im.width,
    right = -1,
    top = im.height,
    bottom = -1;
  for (let p = 0; p < d.length; p += 4)
    if (d[p + 3] >= 128) {
      const x = (p / 4) % im.width,
        y = Math.floor(p / 4 / im.width);
      left = Math.min(left, x);
      right = Math.max(right, x);
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
    }
  return { left, right, top, bottom, height: bottom - top + 1 };
};
const anatomy = {};
for (const role of ['machinegun', 'rocket', 'sniper']) {
  const set = art.weaponStances[role];
  assert.equal(set.stance16.length, 16);
  assert.equal(set.standing, set.stance16[0]);
  assert.equal(set.crouch, set.stance16[7]);
  assert.equal(set.prone, set.stance16[15]);
  assert.equal(set.stance16[8], set.stance16[7]);
  const plate = createCanvas(1280, 1000),
    ctx = plate.getContext('2d');
  ctx.fillStyle = '#718178';
  ctx.fillRect(0, 0, plate.width, plate.height);
  ctx.imageSmoothingEnabled = false;
  anatomy[role] = [];
  for (const [i, f] of set.stance16.entries()) {
    const b = bounds(f.image);
    anatomy[role].push(b);
    assert(
      b.bottom >= 94 && b.bottom <= 95,
      `${role}/${i} baseline ${b.bottom}`,
    );
    assert(b.left > 1 && b.right < 126, `${role}/${i} clipped weapon`);
    if (i)
      assert(
        Math.abs(b.height - anatomy[role][i - 1].height) <= 7,
        `${role}/${i} abrupt body-height cut`,
      );
    ctx.drawImage(f.image, (i % 4) * 320, Math.floor(i / 4) * 250, 320, 240);
    ctx.fillStyle = '#f3e8c2';
    ctx.font = '14px monospace';
    ctx.fillText(
      `${i}: h${b.height}`,
      (i % 4) * 320 + 5,
      Math.floor(i / 4) * 250 + 246,
    );
  }
  writeFileSync(join(out, `${role}-cels.png`), plate.toBuffer('image/png'));
}
const canvas = createCanvas(1280, H),
  ctx = canvas.getContext('2d'),
  draw = ctx.drawImage.bind(ctx);
let drawn = [];
ctx.drawImage = (...args) => {
  drawn.push(args[0]);
  return draw(...args);
};
let rendered = 0,
  verified = 0;
const pose = { stand: 'idle', crouch: 'crouch', prone: 'prone' };
for (const side of [0, 1]) {
  const s = createGame(147);
  startGame(s);
  s.units = [];
  s.scenery = [];
  s.walls = [];
  s.terrain.fill(374);
  s.original.fill(374);
  s.knownTerrain[0].fill(374);
  s.knownScenery[0] = {};
  s.knownWalls[0] = {};
  s.weather.disabled = true;
  s.night = false;
  s.sight[0].fill(true);
  for (const [i, id] of [
    'lmg_team',
    'rocket',
    'sniper',
    'sniper_team',
  ].entries()) {
    const n = s.units.length;
    spawnUnit(s, side, id, 500 + i * 270);
    if (id === 'sniper_team') s.units.splice(n, 1);
    else s.units.splice(n + 1);
    const u = s.units[n];
    Object.assign(u, {
      x: 500 + i * 270,
      y: 374,
      lane: 0,
      pose: 'idle',
      moving: false,
      motion: 'ground',
      climbing: 0,
      fire: 0,
      secondaryFire: 0,
      flash: 0,
      fragThrow: 0,
      aimUntil: 0,
      readyAt: -100,
      cover: 0,
      rappelling: false,
      parachuting: false,
    });
  }
  s.visible[0] = s.units.map((u) => u.uid);
  for (const [from, to] of [
    ['stand', 'crouch'],
    ['crouch', 'prone'],
    ['prone', 'stand'],
  ]) {
    for (const u of s.units)
      Object.assign(u, {
        pose: pose[to],
        poseAnimFrom: from,
        poseAnimSeen: to,
        poseAnimAt: 10,
        crouchTravel: 0,
      });
    const duration = stanceTransitionDuration(s.units[0]),
      count = Math.ceil(duration * 60) + 1;
    for (let i = 0; i <= count; i++) {
      s.time = 10 + i / 60;
      drawn = [];
      render(ctx, s, art, null, null, true, 300, 1280);
      rendered++;
      for (const u of s.units) {
        const f = adultFrameChoice(u, s.time),
          base = art.adults[adultIdentity(u.id)][f.group][f.index];
        const specialist = specialistSprite(
          base,
          f,
          u,
          art.adultSpecialists,
          art.weaponStances,
        );
        if (u.id === 'sniper_team') {
          assert.equal(specialist, null);
          continue;
        }
        assert(
          specialist,
          'specialist must retain weapon through the endpoint',
        );
        assert(
          drawn.includes(uniformFrame(specialist.image, CARDS[u.id].uniform)),
          'production renderer hid the authored body',
        );
        verified++;
      }
      if ([0, Math.floor(count * 0.45), count].includes(i))
        writeFileSync(
          join(out, `${side}-${from}-${to}-${i}.png`),
          canvas.toBuffer('image/png'),
        );
    }
  }
}
const report = { output: out, rendered, verified, anatomy };
writeFileSync(join(out, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
