/** Code that determines the final baked pixels, sizes, mounts or art selection.
 * Add a new compiler dependency here when extending the battle artwork. */
export const BATTLE_ART_COMPILER_INPUTS = [
  'scripts/bake-battle-art.mjs', 'scripts/battle-art-bake-inputs.mjs',
  'game/art.ts', 'game/art-v16.ts', 'game/battle-art-loader.ts', 'game/battle-art-assets.ts',
  'game/sprite-atlas.ts', 'game/soldier-art.ts', 'game/soldier-pose.ts',
  'game/vehicle-art-v223.ts', 'game/ifv-art-v220.ts', 'game/tank-art-v202.ts', 'game/tank-layout-v202.ts', 'game/gun-art.ts', 'game/gun-geometry.ts',
  'game/vehicle-gun-art.ts', 'game/vehicle-gun-layout.ts', 'game/vehicle-missile-art-v209.ts', 'game/weapon-art-v204.ts', 'game/weapon-layout-v204.ts',
  'game/emplacement-art-v202.ts', 'game/emplacement-layout.ts',
  'game/vehicle-art-v197.ts', 'game/vehicle-geometry.ts', 'game/mobile-vehicle-art.ts',
  'game/cards.ts', 'game/maps.ts', 'game/terrain-render.ts',
  'game/building-art.ts', 'game/world.ts', 'game/battlefield-effects-art.ts',
  'game/wreck-art.ts', 'game/wreck-geometry.ts', 'game/wreck-variants.ts', 'game/tank-wreck-art.ts',
  'game/effect-atlas.ts', 'game/smoke-art.ts', 'game/glider-art.ts',
  'game/tree-art-v17.ts', 'game/mine-art-v18.ts', 'game/comeback-art-v18.ts',
];
