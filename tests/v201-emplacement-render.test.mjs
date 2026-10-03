import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const { createCanvas, Image } = createRequire(import.meta.url)('@napi-rs/canvas');
globalThis.document = { createElement: () => createCanvas(1, 1) };
globalThis.Image = class extends Image {
  set src(value) {
    super.src = value.startsWith('/') ? fileURLToPath(new URL('../public' + value, import.meta.url)) : value;
  }
  get src() { return super.src; }
};
const { createGame, startGame, spawnUnit, refreshVision, H } = await import('../game/engine.ts');
const { loadBattleArt } = await import('../game/art.ts');
const { render } = await import('../game/render.ts');

// Exercise only two gun actors with the current atlas loader, keeping
// native canvas allocations bounded instead of loading a full actor matrix.
test('a towed gun keeps the full barrel through every travel phase and recoils only while stopped', async () => {
  const art = await loadBattleArt('greyline');
  const frames = art.emplacements.howitzer;
  assert.notEqual(frames[0], frames[1], 'the rest and recoil cells must be distinct');
  const ctx = createCanvas(960, H).getContext('2d');
  const drawn = [];
  const draw = ctx.drawImage.bind(ctx);
  ctx.drawImage = (...args) => { if (frames.includes(args[0])) drawn.push(args[0]); return draw(...args); };
  for (const side of [0, 1]) {
    const s = createGame(201901 + side); startGame(s);
    Object.assign(s, { units: [], scenery: [], walls: [], wrecks: [], aiIn: 1e9, night: false });
    s.terrain.fill(374); s.original.fill(374); s.weather.disabled = true;
    spawnUnit(s, side, 'field_gun', 420);
    const gun = s.units[0];
    Object.assign(gun, { x: 420, y: 374, hullAngle: 0, facing: side ? -1 : 1 });
    // A nearby observer keeps the red gun inside real player vision.
    s.players[0].recon = 100;
    spawnUnit(s, 0, 'scout_drone', 460);
    Object.assign(s.units.at(-1), { x: 460, y: 160, squadOrder: 'watch', squadOrderX: 460 });
    refreshVision(s);
    for (const [moving, fire, expected] of [[true, 0, 0], [true, .3, 0], [false, 0, 0], [false, .3, 1]]) {
      Object.assign(gun, { moving, fire });
      for (const time of [8, 8.13, 8.26, 8.39]) {
        s.time = time; drawn.length = 0;
        render(ctx, s, art, null, null, true, 0, 960);
        assert.equal(drawn.length, 1, `side ${side}, moving ${moving}, fire ${fire}, time ${time}`);
        assert.equal(drawn[0], frames[expected], 'production render must use the expected authored barrel cell');
      }
    }
  }
});
