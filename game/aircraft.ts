import type { Card } from './cards';
type Airframe = NonNullable<Card['airframe']>;
// Scan-converted polygons keep every aircraft edge on the native pixel grid.
function polygon(
  ctx: CanvasRenderingContext2D,
  points: number[][],
  color: string,
) {
  ctx.fillStyle = color;
  for (
    let y = Math.floor(Math.min(...points.map((p) => p[1])));
    y <= Math.max(...points.map((p) => p[1]));
    y++
  ) {
    const xs: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i],
        b = points[(i + 1) % points.length];
      if (
        (a[1] <= y + 0.5 && b[1] > y + 0.5) ||
        (b[1] <= y + 0.5 && a[1] > y + 0.5)
      )
        xs.push(a[0] + ((y + 0.5 - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
    }
    xs.sort((a, b) => a - b);
    for (let i = 0; i + 1 < xs.length; i += 2)
      ctx.fillRect(
        Math.round(xs[i]),
        y,
        Math.max(1, Math.round(xs[i + 1] - xs[i])),
        1,
      );
  }
}
export function buildAircraft(
  helicopters: HTMLCanvasElement[][][number],
): Record<Airframe, HTMLCanvasElement[]> {
  return Object.fromEntries(
    (
      [
        'rocket_heli',
        'scout_drone',
        'attack_drone',
        'loiter_drone',
        'interceptor',
      ] as Airframe[]
    ).map((kind) => [
      kind,
      Array.from({ length: 4 }, (_, frame) => {
        const canvas = document.createElement('canvas');
        canvas.width = 96;
        canvas.height = 48;
        const c = canvas.getContext('2d')!;
        c.imageSmoothingEnabled = false;
        const rect = (
          x: number,
          y: number,
          w: number,
          h: number,
          color: string,
        ) => {
          c.fillStyle = color;
          c.fillRect(x, y, w, h);
        };
        const poly = (p: number[][], color: string) => polygon(c, p, color);
        if (kind === 'rocket_heli') {
          c.drawImage(helicopters[frame], 0, 0, 96, 48);
          rect(41, 32, 26, 3, '#343e35');
          rect(42, 34, 12, 6, '#5f6553');
          rect(60, 34, 12, 6, '#5f6553');
          for (const x of [44, 48, 52, 62, 66, 70])
            rect(x, 35, 1, 3, '#252f29');
          rect(45, 32, 8, 1, '#a0a087');
          rect(63, 32, 8, 1, '#a0a087');
        } else if (kind === 'scout_drone') {
          poly(
            [
              [23, 15],
              [45, 20],
              [69, 15],
              [70, 18],
              [51, 25],
              [46, 25],
              [23, 18],
            ],
            '#37433d',
          );
          poly(
            [
              [28, 24],
              [44, 20],
              [50, 20],
              [66, 24],
              [67, 27],
              [50, 25],
              [44, 25],
              [27, 27],
            ],
            '#59665c',
          );
          for (const [x, y] of [
            [23, 14],
            [69, 14],
            [28, 24],
            [66, 24],
          ]) {
            rect(x - 2, y, 4, 4, '#303c36');
            rect(
              x - (frame % 2 ? 8 : 12),
              y - 1,
              frame % 2 ? 16 : 24,
              1,
              '#bac1ae',
            );
            rect(x - 5, y - 2, 10, 1, '#536058');
          }
          poly(
            [
              [41, 19],
              [51, 19],
              [56, 24],
              [51, 28],
              [42, 28],
              [38, 24],
            ],
            '#707c6b',
          );
          rect(42, 20, 9, 2, '#a5ad97');
          rect(43, 27, 7, 4, '#354239');
          rect(47, 29, 2, 2, '#96b0ad');
          rect(39, 23, 3, 3, '#89947e');
          rect(52, 23, 2, 3, '#2d3b33');
        } else if (kind === 'attack_drone') {
          poly(
            [
              [14, 26],
              [28, 21],
              [78, 21],
              [87, 25],
              [78, 29],
              [25, 29],
            ],
            '#3a463e',
          );
          poly(
            [
              [26, 21],
              [35, 19],
              [76, 21],
              [82, 24],
              [26, 24],
            ],
            '#8a9380',
          );
          poly(
            [
              [42, 24],
              [25, 38],
              [35, 39],
              [63, 25],
            ],
            '#515e52',
          );
          poly(
            [
              [45, 23],
              [35, 12],
              [41, 11],
              [62, 24],
            ],
            '#6a796b',
          );
          poly(
            [
              [17, 23],
              [10, 13],
              [16, 13],
              [27, 25],
            ],
            '#556557',
          );
          rect(30, 25, 39, 2, '#65725e');
          rect(49, 30, 11, 3, '#313c32');
          rect(52, 30, 8, 1, '#a1a591');
          rect(76, 24, 5, 2, '#202f2a');
          rect(81, 25, 3, 3, '#829690');
          rect(12, 19 - (frame % 2) * 3, 1, 13 + (frame % 2) * 6, '#a4ac98');
          rect(10, 24, 5, 2, '#2f3b32');
          for (const x of [33, 39, 67]) rect(x, 22, 2, 1, '#b0b69e');
        } else if (kind === 'loiter_drone') {
          poly(
            [
              [25, 22],
              [63, 22],
              [73, 25],
              [63, 28],
              [25, 27],
              [20, 25],
            ],
            '#626f61',
          );
          poly(
            [
              [38, 24],
              [27, 35],
              [34, 35],
              [55, 25],
            ],
            '#414f44',
          );
          poly(
            [
              [38, 24],
              [31, 15],
              [37, 15],
              [54, 24],
            ],
            '#8c9681',
          );
          rect(29, 22, 32, 1, '#a7af96');
          rect(64, 24, 5, 2, '#2d3a32');
          rect(24, 18 - (frame % 2), 1, 13 + (frame % 2) * 2, '#9aa58d');
        } else {
          poly(
            [
              [7, 27],
              [18, 22],
              [73, 22],
              [90, 27],
              [72, 31],
              [19, 31],
            ],
            '#35443e',
          );
          poly(
            [
              [20, 23],
              [54, 20],
              [72, 22],
              [80, 25],
              [19, 26],
            ],
            '#869284',
          );
          poly(
            [
              [35, 26],
              [22, 41],
              [39, 39],
              [60, 28],
            ],
            '#516558',
          );
          poly(
            [
              [39, 23],
              [31, 13],
              [41, 15],
              [59, 25],
            ],
            '#708071',
          );
          poly(
            [
              [16, 23],
              [11, 11],
              [18, 12],
              [28, 24],
            ],
            '#667c6b',
          );
          poly(
            [
              [56, 21],
              [61, 17],
              [70, 18],
              [75, 22],
            ],
            '#243d3b',
          );
          rect(61, 18, 7, 1, '#b5c5b8');
          rect(25, 27, 45, 1, '#a2ac92');
          rect(25, 29, 35, 2, '#4d5d4f');
          rect(8, 25, 9, 5, '#27362f');
          rect(5 - (frame % 2), 26, 4 + (frame % 2), 2, '#b28c63');
          rect(2 - (frame % 2), 26, 3, 1, '#647069');
          rect(45, 29, 10, 3, '#2e3e34');
          rect(47, 30, 6, 1, '#87917c');
          for (const x of [29, 35, 40, 53, 76]) rect(x, 24, 1, 1, '#c0c4aa');
        }
        if (kind !== 'rocket_heli') {
          const pixels = c.getImageData(0, 0, 96, 48);
          for (let y = 12; y < 42; y++)
            for (let x = 6; x < 91; x++) {
              const at = (y * 96 + x) * 4,
                hash = ((x * 73856093) ^ (y * 19349663)) >>> 0;
              if (pixels.data[at + 3] === 255 && hash % 5 === 0) {
                const shade = hash % 2 ? 9 : -10;
                for (let k = 0; k < 3; k++)
                  pixels.data[at + k] = Math.max(
                    0,
                    Math.min(255, pixels.data[at + k] + shade),
                  );
              }
            }
          c.putImageData(pixels, 0, 0);
        }
        return canvas;
      }),
    ]),
  ) as Record<Airframe, HTMLCanvasElement[]>;
}
