/** Map layout is independent of combat/card randomness. Terrain remains destructible. */
export type MapId = 'greyline' | 'jungle' | 'mountains' | 'desert';
export interface MapScenerySite {
  id?: number;
  x: number;
  kind: 'house' | 'tree';
  seed: number;
  building?: number;
}
export interface MapWallSite {
  x: number;
  width: number;
  height: number;
  hp: number;
}
export interface MapPalette {
  sky: string;
  surface: string;
  disturbed: string;
  darkSoil: string;
  exposedSoil: string;
  grass: string;
  terrainFilter: string;
  terrainTint: string;
  tintStrength: number;
}
export interface MapDefinition {
  id: MapId;
  name: string;
  en: string;
  description: string;
  terrainLabel: string;
  coverLabel: string;
  layoutSeed: number;
  backgroundAsset: string;
  /** Amplitude and wavelength in world pixels; broad waves do not create climb steps. */
  terrainProfile: ReadonlyArray<{
    amplitude: number;
    wavelength: number;
    phase: number;
  }>;
  vegetationDensity: 'sparse' | 'moderate' | 'dense';
  housingDensity: 'sparse' | 'moderate';
  palette: MapPalette;
}
export const MAP_IDS: readonly MapId[] = [
  'greyline',
  'jungle',
  'mountains',
  'desert',
];
export const DEFAULT_MAP: MapId = 'greyline';
export const MAPS: Record<MapId, MapDefinition> = {
  greyline: {
    id: 'greyline',
    name: '灰线村镇',
    en: 'GREYLINE VILLAGE',
    description: '村屋与林带交错，适合机步协同。',
    terrainLabel: '缓丘公路',
    coverLabel: '树屋交错',
    layoutSeed: 119,
    backgroundAsset: '/art/battlefield-v3.png',
    terrainProfile: [
      { amplitude: 13, wavelength: Math.PI * 500, phase: 0 },
      { amplitude: 5, wavelength: (Math.PI * 2000) / 13, phase: 0 },
    ],
    vegetationDensity: 'moderate',
    housingDensity: 'moderate',
    palette: {
      sky: '#8b948b',
      surface: '#6b7050',
      disturbed: '#746959',
      darkSoil: '#423e35',
      exposedSoil: '#b09a70',
      grass: '#929078',
      terrainFilter: 'none',
      terrainTint: '#746959',
      tintStrength: 0,
    },
  },
  jungle: {
    id: 'jungle',
    name: '雨林公路',
    en: 'JUNGLE ROAD',
    description: '林带密集，利用空隙观察与压制。',
    terrainLabel: '平缓湿地',
    coverLabel: '密林掩护',
    layoutSeed: 0x4a554e47,
    backgroundAsset: '/art/v16-maps/jungle.png',
    terrainProfile: [
      { amplitude: 9, wavelength: 1700, phase: 0.2 },
      { amplitude: 4, wavelength: 650, phase: 1.1 },
    ],
    vegetationDensity: 'dense',
    housingDensity: 'sparse',
    palette: {
      sky: '#6b8275',
      surface: '#425b3b',
      disturbed: '#625c42',
      darkSoil: '#303f2b',
      exposedSoil: '#8c9462',
      grass: '#78915b',
      terrainFilter: 'saturate(.7) brightness(.82)',
      terrainTint: '#5c7445',
      tintStrength: 0.35,
    },
  },
  mountains: {
    id: 'mountains',
    name: '山地隘口',
    en: 'HIGHLAND PASS',
    description: '宽缓山脊，争夺高处观察与射界。',
    terrainLabel: '宽缓山脊',
    coverLabel: '稀疏林屋',
    layoutSeed: 0x52494447,
    backgroundAsset: '/art/v16-maps/mountains.png',
    terrainProfile: [
      { amplitude: 36, wavelength: 2100, phase: -0.9 },
      { amplitude: 9, wavelength: 850, phase: 0.3 },
    ],
    vegetationDensity: 'sparse',
    housingDensity: 'sparse',
    palette: {
      sky: '#8d9fa5',
      surface: '#6b756d',
      disturbed: '#777b77',
      darkSoil: '#424b4b',
      exposedSoil: '#b0b6ad',
      grass: '#a2ab96',
      terrainFilter: 'saturate(.25) brightness(.96)',
      terrainTint: '#829298',
      tintStrength: 0.27,
    },
  },
  desert: {
    id: 'desert',
    name: '沙漠边境',
    en: 'DESERT FRONTIER',
    description: '开阔沙原，少量村屋提供落脚点。',
    terrainLabel: '开阔沙丘',
    coverLabel: '稀少掩体',
    layoutSeed: 0x44554e45,
    backgroundAsset: '/art/v16-maps/desert.png',
    terrainProfile: [
      { amplitude: 14, wavelength: 2200, phase: 0.6 },
      { amplitude: 4, wavelength: 1050, phase: -0.4 },
    ],
    vegetationDensity: 'sparse',
    housingDensity: 'sparse',
    palette: {
      sky: '#c5b79a',
      surface: '#b79a64',
      disturbed: '#aa8c5c',
      darkSoil: '#786247',
      exposedSoil: '#e0c48e',
      grass: '#ccbd8b',
      terrainFilter: 'sepia(.8) saturate(.8) brightness(1.25)',
      terrainTint: '#d7b36f',
      tintStrength: 0.4,
    },
  },
};
export function isMapId(value: unknown): value is MapId {
  return typeof value === 'string' && Object.hasOwn(MAPS, value);
}
export function mapDefinition(value: unknown): MapDefinition {
  return MAPS[isMapId(value) ? value : DEFAULT_MAP];
}
const WIDTH = 3840;
const VILLAGE_ANCHORS = [
  620, 820, 1040, 1250, 1450, 1680, 1910, 2140, 2370, 2570, 2790, 3000, 3220,
];
/** Default sites reproduce the existing village, including paired trees and visual seeds. */
export function villageScenerySites(width = WIDTH): MapScenerySite[] {
  return VILLAGE_ANCHORS.flatMap((x, i) => {
    const house = i % 3 === 0;
    const site: MapScenerySite = {
      id: i * 2,
      x: Math.round((x * width) / WIDTH),
      kind: house ? 'house' : 'tree',
      seed: 119 + i * 47,
      building: house ? Math.floor(i / 3) % 3 : undefined,
    };
    return house
      ? [site]
      : [
          site,
          {
            ...site,
            id: i * 2 + 1,
            x: Math.round(((x + 72) * width) / WIDTH),
            seed: site.seed + 7,
          },
        ];
  });
}
const smooth = (t: number) => t * t * (3 - 2 * t);
export function mapTerrain(id: MapId = DEFAULT_MAP, width = WIDTH): number[] {
  const definition = mapDefinition(id);
  return Array.from({ length: width }, (_, x) => {
    if (definition.id === 'greyline')
      return x < 125 || x > width - 125
        ? 374
        : 374 + Math.round(Math.sin(x * 0.004) * 13 + Math.sin(x * 0.013) * 5);
    // Mirror the long landforms and flatten both entries, with a smooth base transition.
    const edge = Math.min(x, width - 1 - x);
    const blend = smooth(Math.max(0, Math.min(1, (edge - 220) / 300)));
    const distance = ((x - (width - 1) / 2) * WIDTH) / width;
    const elevation = definition.terrainProfile.reduce(
      (height, wave) =>
        height +
        wave.amplitude *
          Math.cos(
            (Math.abs(distance) * Math.PI * 2) / wave.wavelength + wave.phase,
          ),
      0,
    );
    return 374 + Math.round(elevation * blend);
  });
}
function mirroredSites(id: MapId, width: number): MapScenerySite[] {
  const definition = MAPS[id];
  const trees =
    id === 'jungle'
      ? [
          690, 755, 830, 960, 1050, 1130, 1260, 1340, 1430, 1540, 1630, 1760,
          1840,
        ]
      : id === 'mountains'
        ? [600, 950, 1400, 1690]
        : [740];
  const houses =
    id === 'jungle' ? [500] : id === 'mountains' ? [1120] : [1100, 1640];
  const entries = [
    ...trees.map((x) => ({ x, kind: 'tree' as const })),
    ...houses.map((x, i) => ({
      x,
      kind: 'house' as const,
      building: (i + (id === 'desert' ? 2 : 0)) % 3,
    })),
  ].sort((a, b) => a.x - b.x);
  return entries
    .flatMap((site, i) => {
      const x = Math.round((site.x * width) / WIDTH),
        seed = (definition.layoutSeed + i * 47) >>> 0;
      return [
        { ...site, x, seed },
        { ...site, x: width - 1 - x, seed },
      ];
    })
    .sort((a, b) => a.x - b.x);
}
export interface MapLayout {
  id: MapId;
  seed: number;
  terrain: number[];
  scenerySites: MapScenerySite[];
  wallSites: MapWallSite[];
}
export function createMapLayout(
  id: MapId = DEFAULT_MAP,
  width = WIDTH,
): MapLayout {
  const definition = mapDefinition(id),
    mapId = definition.id;
  return {
    id: mapId,
    seed: definition.layoutSeed,
    terrain: mapTerrain(mapId, width),
    scenerySites:
      mapId === 'greyline'
        ? villageScenerySites(width)
        : mirroredSites(mapId, width),
    // v99: low walls removed from all maps — the battlefield is now open
    // ground. The Wall type and vault/destruction mechanics remain in the
    // engine for scripted scenarios and future map designs.
    wallSites: [],
  };
}
