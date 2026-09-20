# v161 — independent powder-smoke cels and persistent muzzle discharge

## Delivered

- New 16-cel painted gray powder-smoke evolution replaces the eight smoke crops borrowed from the legacy explosion sheet. Early puffs grow into turbulent lobes, then separate and fade into wisps. Used by particles and wreck smoke; tactical smoke-screen gameplay/its separate art is unchanged.
- Removed the two smooth gray circles attached to firing guns. Those circles were additionally drawn over the existing particles and cut off with the .25-second flash flag despite claiming a .42-second animation. Muzzle smoke now comes only from the simulation-emitted particles, which drift and expire independently (.42-second core; .5–1-second rolling puffs).
- AP and HE both receive the heavy barrel discharge. AP previously incorrectly used the small-rifle smoke branch. Emission follows the actual main/coax firing angle, not the army's home-side direction. Authored heavy-gun puffs get an explicit starting opacity; recycled particles clear that override. No damage, range, rate, targeting, physics collision or visibility changes.
- Runtime loads a 132,690-byte packed atlas, not the large generation original. Existing premultiplied-alpha quarter-step interpolation/tint caching is reused; these intermediate composites are not claimed as additional painted drawings.

## Art provenance and limitations

One built-in imagegen request by asset-only agent, no retries. Exact prompt: `public/art/powder-smoke-v161.prompt.json`; original unchanged: `public/art/powder-smoke-v161.png`; runtime: `public/art/powder-smoke-frames-v161.png`. Reproducible packer: `scripts/bake-v161-smoke.mjs`.

The original is 1254-square RGBA, not a precise equal-cell production grid. It has faint gutter contamination/low-alpha color fringes, nonuniform registration and insufficient margins (the twelfth cel approaches a nominal grid boundary). It must not be consumed as an equal 4×4 crop. Measured whole-cloud bounds with six source-pixel padding, shared .29 scale and row/column registration fit each into an isolated 96-square frame. Original partial alpha, curls and separated wisps remain; no per-cel inflation, procedural repaint or connected-component erasure. The main owner inspected the original, packed atlas and actual tinted rendering on light/dark backgrounds. All packed outer three-pixel borders are clear. Runtime tint/opacity makes the very faint fringe colors imperceptible in the inspected scenes; this is not a claim of flawless source generation.

## Verification

- 18 focused checks pass: v145 effects/footings, v160 tank doctrine and four new v161 checks. Includes both AP/HE and both factions, reverse-direction firing, independent smoke lifetime after flash, pause freeze, recycled opacity, all 16 unique transparent-border cels, declining late alpha mass, 121 interpolated phases and context restoration.
- 170 historical gameplay checks passed after the main emission change. Full outcomes remain seed13 red600s810:1000; seed71 blue335.2s1000:0; seed102 blue291.3s1000:0. Subsequent opacity-only changes covered by focused tests.
- 2,688 production-render frames: four mirrored tank firing cycles and ten seconds of repeated heavy explosions on each of four maps. Actual vision/known terrain retained, no visibility override. Renderer does not mutate particles/blasts. Main owner inspected muzzle-cycle plate, before/after smoke plate and full battle frames.
- Final QA directory: `/var/folders/mt/w9779b795sddhd14ddd3ty9r0000gn/T/greyline-v161-smoke-11vBEM`. Prior directories NrQwuZ/HwRZrf are intermediate iterations, not final.
- Napi CPU render median1.10ms/p952.41ms/max121.08ms. Same warm puff draw workload measured previous12.69µs/current3.17µs; timings varied across runs, first-use spikes remain, and this is not browser/device FPS or a general speedup claim. Sprite decode/cache creation remains once-per-asset rather than per-frame.
- TypeScript and Pages build pass. Active JS825.29kB/gzip280.83kB; existing >500kB bundle advisory remains. No browser handoff in this background continuation.

Art SHA-256: original `05412b5f0f09b9c9a736c8cc40e818f42dbf6ea95a6a446499a68564c92df4c5`; packed `ac33ea3b94596d0b0d977d3de303df7269982df5db3e035fb7ae4108c71649a4`.

## Still open

This is a smoke/muzzle improvement, not completion of all visuals. Large painted fuel/earth blast borders remain covered by v145 regression tests. Legacy HE/air art, heavy overlapping dust density, uniformly black-looking wreck silhouettes, map-layer seams, moving rifle reload, specialist actions and the remaining roster role audit still need work. Existing v56 sound-report test failure remains outside this patch. No claim that every historical suite or user requirement is complete.
