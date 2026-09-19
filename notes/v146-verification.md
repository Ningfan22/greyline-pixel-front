# v146 — bounded terrain-cache work after impacts

## Diagnosis and changes

- Instrumenting the shipped v145 renderer identified the largest stalls in terrain rebuilding, not the new painted explosion frames. Each dirty 192-pixel region repeatedly cropped a 2172×724 filtered canvas into three-pixel strips. The completed viewport was then copied from one 3840×480 world canvas.
- Front/rear soil is now sampled once at the actual 1023×170 world-texture scale. Map tinting and rear-earth shading also prepare this smaller surface directly. Original art files, the three-pixel surface detail, crater geometry and palette definitions are unchanged.
- Terrain owns lazily allocated 192×480 tiles rather than one eagerly allocated whole-world canvas. Only newly visible or changed remembered tiles repaint; a crater on a tile boundary invalidates both adjoining tiles. Returning to a previously viewed tile reuses its pixels.
- Cache identity now includes the rear-earth texture and map width as well as the front texture and palette. Render caches remain weakly owned by the state/texture lifetime. This does not change simulation, fog rules, AI, cards, ownership, economy or animation timing.

## Controlled local renderer comparison

`scripts/profile-v146-render.mjs` uses actual art and the production renderer with seed/mapSeed 145, 36 infantry plus two tanks, four map types, 120 frames per map, impacts at frames 0 and 80. Both measured runs were sequential, without a concurrent build or test runner. Canvas-call timing instrumentation is enabled in both. This is Napi CPU draw time, **not browser FPS, GPU time, load/network time or a device guarantee**.

| Drawing measure | Shipped v145 | v146 |
| --- | ---: | ---: |
| Median | 1.759 ms | 1.633 ms |
| p95 | 5.878 ms | 2.877 ms |
| Maximum | 981.030 ms | 101.580 ms |
| Greyline first / second impact | 61.174 / 31.497 ms | 101.580 / 23.926 ms |
| Jungle first / second impact | 981.030 / 295.271 ms | 46.090 / 12.843 ms |
| Mountains first / second impact | 245.059 / 128.484 ms | 17.066 / 10.473 ms |
| Desert first / second impact | 232.515 / 157.212 ms | 20.623 / 13.713 ms |

The very first Greyline draw remains slower in this run; first-use work is not solved. Do not represent the comparison as every frame becoming faster. Final-run p99 was 17.066 ms. No instrumented individual Canvas call exceeded 4 ms in that run; calls are only part of total frame time.

Local evidence directories: baseline `greyline-v146-profile-wVdmdx`, final `greyline-v146-profile-dYkyfA` under the session temporary directory. The final report includes all 480 frame timings. These temporary files are not runtime dependencies.

## Verification

- 122 focused checks pass (v135–v146), including six new terrain regressions. The pixel oracle loads the exact shipped v145 implementation from Git, rather than a manually rewritten reference.
- 170 historical gameplay checks pass, including all three full matches. Seed 13 ends at 266.8 s, seed 71 at 262.9 s and seed 102 at 334.0 s, matching v145.
- Tests cover original versus pre-scaled map palettes, partial viewports crossing tile/texture boundaries, all four maps, craters before/after redraw, hidden versus remembered damage, lazy panning, front/rear/palette invalidation, read-only simulation data and bounded source/copy sizes on warm crater redraws.
- Ground alpha/geometry matches the old renderer exactly in the focused fixtures. Mean RGB-channel difference is below 1 on the 0–255 scale. Nearest-neighbor resampling produces a few different texels, so this is **not byte-identical imagery**.
- Twenty full production-renderer captures match the old scene apart from 181–363 ground pixels per 1280×480 image. Full-scene mean channel delta is 0.000719–0.005218; alpha is unchanged. Sparse individual channel differences can be as high as 153. Inspected jungle and mountains captures with visible craters, both tanks, footings, infantry and new blasts; no new seams or missing terrain observed.
- Typecheck and Pages build pass. Existing bundle-size warning remains: 807.99 kB raw / 274.76 kB gzip JS. No new bitmap downloads were added.

## Still open

- Browser/device profiling, the first-draw spike and longer/more populated battle workloads need separate measurement. Terrain caching is not proof that all rendering stalls are gone.
- Weapon-specific posture transitions, moving reload hands, additional casualty/equipment animation and repeated-looking troop identities remain unfinished. Card-role differentiation is not complete across the roster.
