# v166 — support the actual damaged building footprint

## Reproduced problem

v145 foundations used `HOUSE_PROFILES[row].width` for every damage state. The painted partial-destruction frames of the plaster house and brick shop extend beyond that intact-building width. With a crater at the corner, their painted masonry/rubble therefore overhung empty sky. A production `drawScenery` fixture reproduced326 and135 unsupported sampled pixels respectively. The old solid-rectangle footing test passed because it measured only the same nominal width, never the actual facade drawing.

## Change

Read the lower14 source-pixel band of the currently painted structural frame once, accept a two-pixel vertical opaque run (not roof overhangs or isolated export specks), and cache that frame's floor span in a WeakMap. Match the exact rounded draw origin and2× scale used by the facade. Extend the existing painted stone/brick/concrete footing under that span down to the known terrain silhouette. Keep one source-pixel edge allowance for softened masonry borders.

The texture stays anchored to the same world origin and physical tile size across damage changes: wider ruins no longer stretch or slide the brick pattern. No image download, replacement bitmap, artificial flat-color filler or per-frame pixel scan was added. Completely collapsed buildings keep their existing rubble/settling path. This is visual support only; collision, terrain generation, combat, cards, collection, economy and infantry rules are unchanged.

## Verification

-19 focused checks pass: four new building-footprint cases plus v145 effects, v146 terrain/cache and v157 production-art/signal-retirement regressions.
-Actual painted edge checks cover three buildings × three structural stages × two slope directions × three fractional origins (54 combinations), inspecting both output pixels of each painted source column. More than10,000 exposed support pixels checked. Existing caller state restored, scenery remains read-only, no platform added under completely collapsed rubble.
-Texture pixel samples are identical across all three structural states at a shared location. A synthetic roof-overhang/export-speck fixture proves the floor scan excludes both;300 repeated requests reuse one pixel read.
-Before native-render plate: `/var/folders/mt/w9779b795sddhd14ddd3ty9r0000gn/T/greyline-v166-foundations-before-CFptgM`; partial plaster/brick gaps326/135. After plate: zero sampled unsupported pixels in all nine structural views.
-Final diagnostic output: `/var/folders/mt/w9779b795sddhd14ddd3ty9r0000gn/T/greyline-v166-foundations-final-VNwbPr`. Includes24 normal-visibility production-render scenes: four seeded maps, three structural states and craters at either corner. Main owner inspected the before/after plates and individual scenes on all four maps. Renderer does not mutate unit/scenery/terrain state. This is scene-level art/geometry QA, not a simulated full match or browser/mobile FPS test.
-The first full-scene QA selected only houses farther than500 from either map edge; the seeded jungle houses lie just outside that arbitrary filter. Corrected the fixture to select a real generated house anywhere on the map, retaining normal camera bounds and vision; no map-generation change or invented test house.
-TypeScript and Pages build pass. Existing large-bundle advisory remains. Visible version bumped to166; no new runtime PNGs. Publication and deployed-byte verification follow the existing GitHub Pages flow.

## Art attempt and unfinished requirements

The initial twelve-frame low-crawl generation was rejected after inspection. The trial selector/loader was removed; no rejected image or draft animation reached production. Main owner confirmed `game/adult-animation.ts`, `game/adult-atlas.ts`, `game/art.ts` and the existing v163 test are unchanged from v165. See [crawl art review](v166-crawl-art-review.md) for original path, built-in mode, complete prompt/arguments and failure evidence.

Moving crawl/reload, broader unit-role differentiation, other map seams and browser/device performance remain open. This release fixes the reproduced damaged-footprint gap, not every possible floating-corner screenshot, every infantry twitch, or the entire active goal. The original user's exact screenshot map/seed was not available, so no claim of exact screenshot reproduction. Existing unrelated untracked files remain untouched. Background continuation did not open a browser.
