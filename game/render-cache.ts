type Bitmap = CanvasImageSource & { width: number; height: number };
const filtered = new WeakMap<object, Map<string, HTMLCanvasElement>>();
/** Pixel-identical filtered sprites are baked once, not composited once per wreck per frame. */
export function filteredSprite(source: Bitmap, filter: string) {
  let variants = filtered.get(source);
  if (!variants) {
    variants = new Map();
    filtered.set(source, variants);
  }
  let output = variants.get(filter);
  if (output) return output;
  output = document.createElement('canvas');
  output.width = source.width;
  output.height = source.height;
  const ctx = output.getContext('2d')!;
  ctx.imageSmoothingEnabled = false;
  ctx.filter = filter;
  ctx.drawImage(source, 0, 0);
  variants.set(filter, output);
  return output;
}
