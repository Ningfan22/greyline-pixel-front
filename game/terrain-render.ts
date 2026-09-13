import type { GameState } from './engine';
import type { MapPalette } from './maps';
type Texture = CanvasImageSource & { width: number; height: number };
const CHUNK = 192,
  HEIGHT = 480;
interface Layer {
  canvas: HTMLCanvasElement;
  heights: Float64Array;
  edges: Float64Array;
  original: Float64Array;
  texture: Texture;
  palette: MapPalette;
}
const layers = new WeakMap<GameState, Layer>();

/** Repaint only changed remembered earth; camera motion simply copies already painted pixel textures. */
export function drawTerrainLayer(
  ctx: CanvasRenderingContext2D,
  s: GameState,
  texture: Texture,
  rear: Texture,
  palette: MapPalette,
  left: number,
  right: number,
) {
  const width = s.terrain.length;
  let layer = layers.get(s);
  if (!layer || layer.texture !== texture || layer.palette !== palette) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = HEIGHT;
    layer = {
      canvas,
      heights: new Float64Array(width).fill(NaN),
      edges: new Float64Array(Math.ceil(width / CHUNK)).fill(NaN),
      original: new Float64Array(width).fill(NaN),
      texture,
      palette,
    };
    layers.set(s, layer);
  }
  const target = layer.canvas.getContext('2d')!;
  target.imageSmoothingEnabled = false;
  const visible = (x: number) =>
    s.knownTerrain[0][Math.max(0, Math.min(width - 1, Math.floor(x)))];
  for (
    let start = Math.floor(left / CHUNK) * CHUNK;
    start < right;
    start += CHUNK
  ) {
    const end = Math.min(width, start + CHUNK);
    let dirty = false;
    for (let x = start; x <= end; x += 3) {
      const at = Math.min(width - 1, x),
        y = visible(x);
      if (
        (x === end ? layer.edges[start / CHUNK] : layer.heights[at]) !== y ||
        layer.original[at] !== s.original[at]
      )
        dirty = true;
      if (x === end) layer.edges[start / CHUNK] = y;
      else layer.heights[at] = y;
      layer.original[at] = s.original[at];
    }
    if (!dirty) continue;
    target.clearRect(start, 0, end - start, HEIGHT);
    target.save();
    target.beginPath();
    target.rect(start, 0, end - start, HEIGHT);
    target.clip();
    target.save();
    target.beginPath();
    for (let x = start; x < end; x += 3) {
      const top = Math.round(s.original[x]) - 2,
        bottom = Math.round(visible(x));
      if (bottom > top + 3) target.rect(x, top, 3, bottom - top + 2);
    }
    target.clip();
    for (let x = start; x < end; x += 3)
      if (visible(x) > s.original[x] + 1)
        target.drawImage(
          rear,
          ((x % 1023) / 1023) * texture.width,
          0,
          (texture.width * 3) / 1023,
          texture.height,
          x,
          s.original[x] - 5,
          3,
          170,
        );
    target.restore();
    target.save();
    target.beginPath();
    target.moveTo(start, HEIGHT + 3);
    for (let x = start; x <= end; x += 3)
      target.lineTo(x, Math.round(visible(x)));
    target.lineTo(end, HEIGHT + 3);
    target.closePath();
    target.clip();
    for (let x = start; x < end; x += 3)
      target.drawImage(
        texture,
        ((x % 1023) / 1023) * texture.width,
        0,
        (texture.width * 3) / 1023,
        texture.height,
        x,
        s.original[x] - 5,
        3,
        170,
      );
    target.restore();
    for (let x = start; x < end; x += 3) {
      const y = Math.round(visible(x)),
        broken = y > s.original[x] + 5;
      target.fillStyle = broken ? palette.disturbed : palette.surface;
      target.fillRect(x, y - 2, 3, 3);
      if (broken) {
        target.fillStyle = palette.darkSoil;
        target.fillRect(x, y, 3, 3);
        target.fillStyle = palette.exposedSoil;
        target.fillRect(x, y - 3, 3, 1);
      } else if (x % 12 === 0) {
        target.fillStyle = palette.grass;
        target.fillRect(x, y - 4, 2, 3);
      }
    }
    target.restore();
  }
  if (right > left)
    ctx.drawImage(
      layer.canvas,
      left,
      0,
      right - left,
      HEIGHT,
      left,
      0,
      right - left,
      HEIGHT,
    );
}
