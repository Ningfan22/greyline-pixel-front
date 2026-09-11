/** Texture import for generated atlases; original image files remain untouched. */
function canvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}
export function transparentSheet(
  image: HTMLImageElement,
  connectedMatte = false,
) {
  const out = canvas(image.width, image.height),
    ctx = out.getContext('2d')!;
  ctx.drawImage(image, 0, 0);
  const pixels = ctx.getImageData(0, 0, out.width, out.height),
    data = pixels.data;
  let transparent = 0;
  for (let i = 3; i < data.length; i += 4) if (data[i] < 128) transparent++;
  if (transparent > out.width * out.height * 0.02) return out;
  // Architectural highlights share the matte's colors. Remove only neutral
  // pixels connected to the sheet boundary, preserving enclosed plaster walls.
  if (connectedMatte) {
    const width = out.width,
      height = out.height;
    const visited = new Uint8Array(width * height);
    const queue = new Int32Array(width * height);
    let head = 0,
      tail = 0;
    const enqueue = (index: number) => {
      if (visited[index]) return;
      visited[index] = 1;
      const at = index * 4;
      const low = Math.min(data[at], data[at + 1], data[at + 2]);
      const high = Math.max(data[at], data[at + 1], data[at + 2]);
      if (low >= 170 && high - low <= 24) queue[tail++] = index;
    };
    for (let x = 0; x < width; x++) {
      enqueue(x);
      enqueue((height - 1) * width + x);
    }
    for (let y = 0; y < height; y++) {
      enqueue(y * width);
      enqueue(y * width + width - 1);
    }
    while (head < tail) {
      const index = queue[head++],
        x = index % width;
      data[index * 4 + 3] = 0;
      if (x > 0) enqueue(index - 1);
      if (x < width - 1) enqueue(index + 1);
      if (index >= width) enqueue(index - width);
      if (index + width < width * height) enqueue(index + width);
    }
    ctx.putImageData(pixels, 0, 0);
    return out;
  }
  // Some generator exports bake their pale checker preview into RGB. Key that
  // neutral matte, including gaps between a rifle and arm, at texture import.
  for (let at = 0; at < data.length; at += 4) {
    const min = Math.min(data[at], data[at + 1], data[at + 2]);
    const max = Math.max(data[at], data[at + 1], data[at + 2]);
    if (min >= 140 && max - min <= 30) data[at + 3] = 0;
  }
  ctx.putImageData(pixels, 0, 0);
  return out;
}
type Bounds = {
  x: number;
  y: number;
  w: number;
  h: number;
  bottom: number;
  label?: number;
};
/** Use measured row boundaries and isolate people so prone rifles can overhang a cell. */
export function figureFrames(
  image: HTMLImageElement,
  columns: number,
  rows: number,
  width: number,
  height: number,
  person = false,
  groupRows = rows,
  rowCuts?: number[],
  sharedScale = false,
  groundedRows: number[] = [],
) {
  const source = transparentSheet(image),
    sw = source.width,
    sh = source.height;
  const data = source.getContext('2d')!.getImageData(0, 0, sw, sh).data;
  const labels = new Int32Array(sw * sh),
    queue = new Int32Array(sw * sh);
  let serial = 0;
  const bands = Array.from({ length: rows }, (_, row) => [
    rowCuts?.[row] ?? Math.round((row * sh) / rows),
    (rowCuts?.[row + 1] ?? Math.round(((row + 1) * sh) / rows)) - 1,
  ]);
  const bounds = bands.map(([top, bottom]) => {
    if (person) {
      const components: (Bounds & { count: number })[] = [];
      for (let y = top; y <= bottom; y++)
        for (let x = 0; x < sw; x++) {
          const start = y * sw + x;
          if (labels[start] || data[start * 4 + 3] < 120) continue;
          const label = ++serial;
          let head = 0,
            tail = 1,
            l = x,
            r = x,
            t = y,
            b = y;
          labels[start] = label;
          queue[0] = start;
          while (head < tail) {
            const at = queue[head++],
              px = at % sw,
              py = Math.floor(at / sw);
            l = Math.min(l, px);
            r = Math.max(r, px);
            t = Math.min(t, py);
            b = Math.max(b, py);
            for (let dy = -1; dy <= 1; dy++)
              for (let dx = -1; dx <= 1; dx++) {
                const nx = px + dx,
                  ny = py + dy;
                if (nx < 0 || nx >= sw || ny < top || ny > bottom) continue;
                const next = ny * sw + nx;
                if (!labels[next] && data[next * 4 + 3] >= 120) {
                  labels[next] = label;
                  queue[tail++] = next;
                }
              }
          }
          if (tail > 100)
            components.push({
              x: l,
              y: t,
              w: r - l + 1,
              h: b - t + 1,
              bottom: b,
              label,
              count: tail,
            });
        }
      if (components.length >= columns)
        return components
          .sort((a, b) => b.count - a.count)
          .slice(0, columns)
          .sort((a, b) => a.x - b.x);
    }
    return Array.from({ length: columns }, (_, col): Bounds => {
      const left = Math.round((col * sw) / columns),
        right = Math.round(((col + 1) * sw) / columns);
      let l = right,
        r = left,
        t = bottom,
        b = top;
      for (let y = top; y <= bottom; y++)
        for (let x = left; x < right; x++)
          if (data[(y * sw + x) * 4 + 3] > 120) {
            l = Math.min(l, x);
            r = Math.max(r, x);
            t = Math.min(t, y);
            b = Math.max(b, y);
          }
      return {
        x: l,
        y: t,
        w: Math.max(1, r - l + 1),
        h: Math.max(1, b - t + 1),
        bottom: b,
      };
    });
  });
  return bounds.map((row, r) => {
    const group = bounds.slice(
      Math.floor(r / groupRows) * groupRows,
      Math.floor(r / groupRows) * groupRows + groupRows,
    );
    const all = person || sharedScale ? group.flat() : row;
    const reference = group[0].map((b) => b.h).sort((a, b) => a - b)[
      Math.floor(columns / 2)
    ];
    const scale = Math.min(
      (width - 4) / Math.max(...all.map((b) => b.w)),
      (height - 3) / Math.max(...all.map((b) => b.h)),
      person ? 42 / reference : Infinity,
    );
    const baseline = Math.max(...row.map((b) => b.bottom));
    const left = Math.min(
      ...row.map((b, col) => b.x - Math.round((col * sw) / columns)),
    );
    const right = Math.max(
      ...row.map((b, col) => b.x - Math.round((col * sw) / columns) + b.w),
    );
    const grounded = person && groundedRows.includes(r);
    // Anchor the upper torso, excluding the long rifle and swinging boots.
    const anchors = row.map((b) => {
      let sum = 0,
        count = 0;
      for (
        let y = Math.floor(b.y + b.h * 0.38);
        y <= Math.floor(b.y + b.h * 0.58);
        y++
      )
        for (let x = b.x; x < b.x + b.w; x++) {
          const at = y * sw + x;
          if (b.label ? labels[at] === b.label : data[at * 4 + 3] >= 120) {
            sum += x;
            count++;
          }
        }
      return count ? sum / count : b.x + b.w / 2;
    });
    const anchorMin =
      1 + Math.max(...row.map((b, col) => anchors[col] - b.x)) * scale;
    const anchorMax =
      width -
      1 -
      Math.max(...row.map((b, col) => b.x + b.w - anchors[col])) * scale;
    const anchorAt = Math.max(
      anchorMin,
      Math.min(
        anchorMax,
        width / 2 + (anchors[0] - row[0].x - row[0].w / 2) * scale,
      ),
    );
    return row.map((b, col) => {
      const out = canvas(width, height),
        ctx = out.getContext('2d')!;
      ctx.imageSmoothingEnabled = false;
      let texture: HTMLCanvasElement = source,
        sx = b.x,
        sy = b.y;
      if (b.label) {
        texture = canvas(b.w, b.h);
        const tc = texture.getContext('2d')!,
          pixels = tc.createImageData(b.w, b.h);
        for (let y = 0; y < b.h; y++)
          for (let x = 0; x < b.w; x++) {
            const from = (b.y + y) * sw + b.x + x,
              to = (y * b.w + x) * 4;
            if (labels[from] !== b.label) continue;
            for (let c = 0; c < 4; c++)
              pixels.data[to + c] = data[from * 4 + c];
          }
        tc.putImageData(pixels, 0, 0);
        sx = 0;
        sy = 0;
      }
      const w = Math.max(1, Math.round(b.w * scale)),
        h = Math.max(1, Math.round(b.h * scale));
      ctx.drawImage(
        texture,
        sx,
        sy,
        b.w,
        b.h,
        grounded && anchorMin <= anchorMax
          ? Math.round(anchorAt - (anchors[col] - b.x) * scale)
          : person
            ? Math.round((width - w) / 2)
            : Math.round(
                (width - (right - left) * scale) / 2 +
                  (b.x - Math.round((col * sw) / columns) - left) * scale,
              ),
        height - h - (grounded ? 0 : Math.round((baseline - b.bottom) * scale)),
        w,
        h,
      );
      return out;
    });
  });
}
