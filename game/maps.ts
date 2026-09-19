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
/**
 * v113: the classic fixed terrain seed for greyline. Tests and replays pass
 * this as MatchOptions.mapSeed to reproduce the original battlefield instead
 * of the seed-driven procedural layout.
 */
export const GREYLINE_LAYOUT_SEED = 119;
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

/**
 * v113: deterministic PRNG for seeded map generation. The same seed always
 * produces the same battlefield, so replays and multiplayer lobbies can
 * share a layout by sharing a seed. mulberry32 is small, fast, and has
 * enough period for terrain + scenery jitter.
 */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Seeded terrain for non-greyline maps. Jitters each wave's amplitude,
 * wavelength and phase, and adds one extra small wave for surface texture.
 * The jitter ranges are conservative enough to preserve the walkability
 * guarantees the engine relies on: adjacent px step ≤ 1, 36 px span ≤ 9,
 * and every elevation inside [310, 430]. Mirror symmetry and edge
 * flattening are inherited from the same formula the default terrain uses.
 */
function seededTerrain(
  definition: MapDefinition,
  width: number,
  rand: () => number,
): number[] {
  // Jitter ranges are tight enough to preserve every walkability guarantee
  // the engine relies on, even for the steepest profile (mountains):
  // adjacent px step ≤ 1, 36 px span ≤ 9, elevation inside [310, 430].
  // Worst case (all peaks aligned): 36 px span ≈ 8.5, range ≈ ±54.
  const waves = definition.terrainProfile.map((w) => ({
    amplitude: w.amplitude * (0.88 + rand() * 0.24),
    wavelength: w.wavelength * (0.94 + rand() * 0.12),
    phase: w.phase + rand() * Math.PI * 2,
  }));
  // One extra low-amplitude wave breaks up the repeating rhythm so two
  // seeded maps don't feel like the same hills shifted sideways.
  waves.push({
    amplitude: 1.5 + rand() * 2,
    wavelength: 750 + rand() * 450,
    phase: rand() * Math.PI * 2,
  });
  return Array.from({ length: width }, (_, x) => {
    const edge = Math.min(x, width - 1 - x);
    // Seeded terrain uses a wider blend ramp (450 px vs the authored 300)
    // so a jittered wave peak landing on the flank never pushes the 36 px
    // walkability span past 9.
    const blend = smooth(Math.max(0, Math.min(1, (edge - 220) / 450)));
    const distance = ((x - (width - 1) / 2) * WIDTH) / width;
    const elevation = waves.reduce(
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

/**
 * Seeded terrain for the greyline village map. Jitters the two sine
 * frequencies, amplitudes and phases while keeping the 125 px flat
 * apron on both flanks. The village sits on open ground, so there is no
 * mirror-symmetry requirement here — the sin waves already read as
 * natural rolling terrain.
 */
function seededVillageTerrain(width: number, rand: () => number): number[] {
  const f1 = 0.004 * (0.85 + rand() * 0.3);
  const f2 = 0.013 * (0.85 + rand() * 0.3);
  const a1 = 13 * (0.8 + rand() * 0.4);
  const a2 = 5 * (0.8 + rand() * 0.4);
  const p1 = rand() * Math.PI * 2;
  const p2 = rand() * Math.PI * 2;
  return Array.from({ length: width }, (_, x) => {
    if (x < 125 || x > width - 125) return 374;
    return 374 + Math.round(Math.sin(x * f1 + p1) * a1 + Math.sin(x * f2 + p2) * a2);
  });
}

const VILLAGE_ANCHORS = [
  620, 820, 1040, 1250, 1450, 1680, 1910, 2140, 2370, 2570, 2790, 3000, 3220,
];
/** Default sites reproduce the existing village, including paired trees and visual seeds. */
export function villageScenerySites(
  width = WIDTH,
  rand?: () => number,
): MapScenerySite[] {
  return VILLAGE_ANCHORS.flatMap((x, i) => {
    const house = i % 3 === 0;
    // Seeded layouts nudge each anchor ±35 px. Anchors are ≥200 px apart, so
    // neighbours never collide; paired trees keep their 72 px gap because
    // both members of a pair share the same jitter.
    const jx = x + (rand ? Math.round((rand() * 2 - 1) * 35) : 0);
    const site: MapScenerySite = {
      id: i * 2,
      x: Math.round((jx * width) / WIDTH),
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
            x: Math.round(((jx + 72) * width) / WIDTH),
            seed: site.seed + 7,
          },
        ];
  });
}
const smooth = (t: number) => t * t * (3 - 2 * t);
export function mapTerrain(
  id: MapId = DEFAULT_MAP,
  width = WIDTH,
  seed?: number,
): number[] {
  const definition = mapDefinition(id);
  // A seed that differs from the layout seed switches to procedural
  // generation. Omitting the seed (or passing the layout seed) reproduces
  // the authored terrain pixel-for-pixel.
  if (seed !== undefined && seed !== definition.layoutSeed) {
    const rand = mulberry32(seed);
    return definition.id === 'greyline'
      ? seededVillageTerrain(width, rand)
      : seededTerrain(definition, width, rand);
  }
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
function mirroredSites(
  id: MapId,
  width: number,
  rand?: () => number,
): MapScenerySite[] {
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
  // Seeded layouts jitter each site ±30 px, then enforce a minimum gap so
  // the dense jungle tree line (some anchors only 65 px apart) never
  // overlaps. Clamping preserves anchor order, so seeds stay stable.
  const MIN_GAP = 55;
  let prev = -Infinity;
  const positioned = entries.map((site) => {
    const jx = rand ? site.x + Math.round((rand() * 2 - 1) * 30) : site.x;
    const clamped = Math.max(jx, prev + MIN_GAP);
    prev = clamped;
    return { ...site, x: clamped };
  });
  return positioned
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
  seed?: number,
): MapLayout {
  const definition = mapDefinition(id),
    mapId = definition.id;
  const actualSeed = seed ?? definition.layoutSeed;
  // Scenery jitter draws from an independent stream so terrain and scenery
  // randomness never correlate.
  const sceneryRand =
    actualSeed === definition.layoutSeed
      ? undefined
      : mulberry32(actualSeed ^ 0x9e3779b9);
  const terrain = mapTerrain(mapId, width, actualSeed);
  let scenerySites =
    mapId === 'greyline'
      ? villageScenerySites(width, sceneryRand)
      : mirroredSites(mapId, width, sceneryRand);
  // Keep seeded, visible clearings between buildings. These are physical
  // open ground for manoeuvre/landing, not collision exceptions for aircraft.
  // Classic layout seeds stay byte-for-byte compatible with old replays.
  if(actualSeed!==definition.layoutSeed) {
    const openGaps=()=>{
      const houses=scenerySites.filter(p=>p.kind==='house').map(p=>p.x).sort((a,b)=>a-b);
      const boundaries=[480,...houses,width-480];
      return boundaries.slice(1).map((right,i)=>({left:boundaries[i]+150,right:right-150}))
        .filter(g=>g.right-g.left>=660);
    };
    // Dense village blocks have no physically possible glider approach. Make
    // one central site a field, retaining the other houses and their pads.
    if(!openGaps().length){
      const houses=scenerySites.filter(p=>p.kind==='house').sort((a,b)=>Math.abs(a.x-width/2)-Math.abs(b.x-width/2));
      if(houses.length>2)scenerySites=scenerySites.filter(p=>p!==houses[0]);
    }
    const gaps=openGaps();
    const chosen=new Set<number>();
    for(const fraction of [.3,.7]) {
      const gap=gaps.filter((_,i)=>!chosen.has(i)).sort((a,b)=>
        Math.abs((a.left+a.right)/2-width*fraction)-Math.abs((b.left+b.right)/2-width*fraction))[0];
      if(!gap)continue;chosen.add(gaps.indexOf(gap));
      const cx=Math.round((gap.left+gap.right)/2),left=cx-330,right=cx+330,y=terrain[cx];
      scenerySites=scenerySites.filter(p=>p.kind!=='tree'||p.x<left-25||p.x>right+25);
      for(let x=left-24;x<=right+24;x++){
        const d=Math.max(left-x,x-right,0),t=smooth(Math.min(1,d/24));
        terrain[x]=Math.round(y*(1-t)+terrain[x]*t);
      }
    }
    if(mapId==='greyline')scenerySites.filter(p=>p.kind==='house')
      .sort((a,b)=>a.x-b.x).forEach((p,i)=>{p.building=i%3;});
  }
  // v130: houses are painted as a single rectangle whose base sits on one
  // ground sample, but the authored terrain rolls ±13 px across a house
  // footprint — the downhill corner floated in mid-air. Level a building
  // pad under every house (with a smooth earthen ramp at the edges) so the
  // masonry sits flat. Trees keep the raw grade.
  // Merge overlapping pads before levelling. Otherwise a later house's ramp
  // tilts the corner of a house we just flattened.
  const pads: { left: number; right: number; y: number }[] = [];
  const blend = 34;
  for (const site of scenerySites.filter(site => site.kind === 'house').sort((a, b) => a.x - b.x)) {
    const cx = Math.max(0, Math.min(width - 1, Math.round(site.x)));
    const previous = pads.at(-1);
    if (previous && cx - 112 - blend <= previous.right + blend)
      previous.right = cx + 112;
    else pads.push({ left: cx - 112, right: cx + 112, y: terrain[cx] });
  }
  for (const pad of pads) {
    const padY = pad.y;
    for (let x = pad.left - blend; x <= pad.right + blend; x++) {
      if (x < 0 || x >= width) continue;
      const d = Math.max(pad.left - x, x - pad.right, 0);
      if (d === 0) terrain[x] = padY;
      else {
        const t = d / blend;
        const s = t * t * (3 - 2 * t);
        terrain[x] = Math.round(terrain[x] * s + padY * (1 - s));
      }
    }
  }
  return {
    id: mapId,
    seed: actualSeed,
    terrain,
    scenerySites,
    // v99: low walls removed from all maps — the battlefield is now open
    // ground. The Wall type and vault/destruction mechanics remain in the
    // engine for scripted scenarios and future map designs.
    wallSites: [],
  };
}
