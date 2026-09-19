# v145 — independent painted blasts and supported building corners

## Changes

- Replaced the large fuel/vehicle/crash and artillery-earth families with 16 new authored cels each. The former sheet contained touching adjacent plumes, including visible side fragments. New cels have independent measured bounds, a common .4 scale and registered (72,154) ground origin inside 144×160 frames. No per-frame inflation, equal-grid assumption, source repaint or discarded debris components.
- Remaining legacy HE, grenade and air sequences now play chronologically. Their previous row interleaving brought fire/large plumes back after the decay row. Blast duration now has one simulation/render definition; random seeds no longer shorten or extend its visual lifetime or recolor the art. Small size differences and mirroring remain.
- Cached premultiplied-alpha quarter-step composites replace two source-over blast draws. Opaque overlaps no longer dip to 75% opacity halfway between cels. Painted smoke also uses cached intermediate contours. These are interpolated transitions, not additional independently painted drawings.
- Wreck smoke starts from the wreck's own age, not absolute match time. A just-destroyed vehicle no longer fabricates four seconds of smoke history above it.
- Generated stone, brick and concrete footing textures replace flat stripe fillers. Full-width, terrain-clipped masonry now reaches both standing-building corners (previously only .86 of the footprint was supported). Fully collapsed buildings retain their existing rubble behavior. This is visual foundation support; no new collision or combat-stat rules were introduced.

## Art provenance and limits

Built-in imagegen via an asset-only agent, three calls in parallel, no retries. Originals copied unchanged to `public/art/fuel-blast-v145.png`, `public/art/earth-blast-v145.png` and `public/art/building-footings-v145.png`. Exact submitted prompts are `public/art/effects-v145.prompts.txt`.

Actual dimensions are 1254×1254, not the requested 2048/1024. True alpha is preserved. Animation origins drifted in the originals and faint gutter specks existed: integer measured per-cel crops include four-pixel soft-edge padding and calibrated baselines. Footing interior alpha is 248–254, so the interior crop is drawn twice at import to make solid masonry opaque; original pixels/files remain unchanged. This improves the existing game style but is not a claim of perfectly identical generated plume anatomy or physically simulated smoke volume.

SHA-256:
- fuel: `fbb8a6729b6a0232e418f77ad814ab52c34466e891672c3d3969de0d92b280ab`
- earth: `f9802a76b22af1adbe0caee3013f8b3602ebfc9a8a65d99fd711aea2b05bea9d`
- footings: `810baf81d08200b5d66cc6b4c971c04efda6a0f17986f465f4815366b1de2f65`

## Verification

- 116 focused checks pass, including seven new cases covering exact simulation/render duration, monotonic frame progression, alpha-preserving cached interpolation, smoke context restoration, newborn wreck smoke, both building corners above excavated slopes, all 32 new frame borders/baselines and opaque/distinct footing materials.
- 170 historical gameplay checks pass, including three complete matches (13:266.8s, 71:262.9s, 102:334.0s). Those outcomes match v144. No card ownership, flavor, economy, IDs, unit strength or AI behavior changed.
- Production renderer draws 1,440 frames across all four map types with actual infantry, tanks, impacts, excavated ground, wreck smoke and scenery. Inspected full-scene captures, the fuel/earth lifecycles, all atlas cels and the three-building/three-damage footing plate. No disconnected top fire strip in those samples. Vision is deliberately omniscient only in this art fixture; game vision rules remain unchanged.
- Local renderer run: simulation median .71ms / p95 1.21ms; drawing median 1.45ms / p95 2.35ms. One draw took 766ms; this cold/rare spike still needs investigation. These Napi CPU measurements are not browser/device FPS or a before/after performance comparison.
- An instrumented follow-up (concurrent with build/typecheck, so not a clean benchmark) localized large stalls to first map frames and impact frame 80: jungle frame 0 ~1032ms, frame 80 ~357ms; mountains 224/169ms; desert 219/111ms. Other isolated spikes also occurred. Do not describe this as only a startup problem; profile terrain/cache invalidation and first-use work next.
- Typecheck and Pages build pass. Existing bundle warning remains: 807.60kB raw / 274.63kB gzip JS.

## Still open

- Investigate renderer startup/rare-frame stalls and measure browser/device performance before claiming a broad speed improvement. New original art adds about 3.7MB before transport compression.
- Weapon-specific posture transitions, moving reload hands, additional casualty/equipment animation and repeated-looking troop identities remain unfinished. Card-role differentiation work is not complete across the entire roster.
- This fixes the diagnosed large-effect atlas/time paths and standing-house corner support, not proof that every possible camera, terrain, replay or effect combination is defect-free.
