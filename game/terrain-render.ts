import type { GameState } from './engine';
import type { MapPalette } from './maps';
type Texture = CanvasImageSource & { width: number; height: number };
const CHUNK = 192,
  HEIGHT = 480;
export const TERRAIN_TEXTURE_WIDTH = 1023,
  TERRAIN_TEXTURE_HEIGHT = 170;
const REPEAT = TERRAIN_TEXTURE_WIDTH,
  SOIL_HEIGHT = TERRAIN_TEXTURE_HEIGHT;
const scaledSoil = new WeakMap<object, HTMLCanvasElement>();
/** Sample the large painted texture once at its actual world-pixel scale.
 * Repeated narrow source crops otherwise reprocess a multi-megapixel tinted
 * canvas hundreds of times whenever a crater dirties the layer. */
function worldSoil(texture: Texture) {
  if (texture.width === REPEAT && texture.height === SOIL_HEIGHT)
    return texture;
  let out = scaledSoil.get(texture);
  if (!out) {
    out = document.createElement('canvas');
    out.width = REPEAT;
    out.height = SOIL_HEIGHT;
    const c = out.getContext('2d')!;
    c.imageSmoothingEnabled = false;
    c.drawImage(
      texture,
      0,
      0,
      texture.width,
      texture.height,
      0,
      0,
      REPEAT,
      SOIL_HEIGHT,
    );
    scaledSoil.set(texture, out);
  }
  return out;
}
interface Layer {
  chunks: Map<number, HTMLCanvasElement>;
  heights: Float64Array;
  edges: Float64Array;
  original: Float64Array;
  texture: Texture;
  rear: Texture;
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
  if (
    !layer ||
    layer.texture !== texture ||
    layer.rear !== rear ||
    layer.palette !== palette ||
    layer.heights.length !== width
  ) {
    layer = {
      chunks: new Map(),
      heights: new Float64Array(width).fill(NaN),
      edges: new Float64Array(Math.ceil(width / CHUNK)).fill(NaN),
      original: new Float64Array(width).fill(NaN),
      texture,
      rear,
      palette,
    };
    layers.set(s, layer);
  }
  const soil = worldSoil(texture),
    rearSoil = worldSoil(rear);
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
    let canvas = layer.chunks.get(start);
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.width = end - start;
      canvas.height = HEIGHT;
      layer.chunks.set(start, canvas);
      dirty = true;
    }
    if (dirty) {
      const target = canvas.getContext('2d')!;
      target.imageSmoothingEnabled = false;
      target.setTransform(1, 0, 0, 1, -start, 0);
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
            rearSoil,
            x % REPEAT,
            0,
            3,
            SOIL_HEIGHT,
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
          soil,
          x % REPEAT,
          0,
          3,
          SOIL_HEIGHT,
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
    // A changed crater uploads only its small tile. Do not snapshot/copy the
    // entire world-sized canvas just to display one camera window.
    const from = Math.max(left, start),
      to = Math.min(right, end);
    if (to > from)
      ctx.drawImage(
        canvas,
        from - start,
        0,
        to - from,
        HEIGHT,
        from,
        0,
        to - from,
        HEIGHT,
      );
  }
}
