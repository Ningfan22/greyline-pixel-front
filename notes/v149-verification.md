# v149 — authored kneeling and prone grenade throws

## Scope and cause

After v148 removed the mistaken crawling cel, crouched throws still held one static knee pose; prone throws still cycled legacy work/crawl frames. The physical launch points were hardcoded independently from the pictures. This slice replaces both low throws with dedicated art and connects their release to the real projectile clock. It does not mark the overall battlefield goal complete.

## Implementation

- Sixteen cels each for fixed-knee and fully-prone throws, including hunker as knee height. Full-body ownership prevents patrol, idle and specialist overlays from hiding the authored action.
- The existing 1.1-second throw duration and 5/8 release timing are preserved. The eight-cel standing drill and sixteen-cel low drills now read the same start timestamp with the same floating-point tolerance. Low cel 10 (zero-based) is the first empty-hand release cel.
- The actual grenade leaves measured low-stance fingertips. Prepared 128×96 landmarks: knee `(87,60)`, prone `(93,83)`; physical offsets account for the renderer's three-pixel ground inset and mirror across facing. Standing origin remains unchanged.
- Projectile `startLane` is captured on release, so later changes in the thrower's lane cannot pull an airborne grenade sideways in the projected image.
- No changes to grenade damage, blast radius, stock, cooldown, target selection, friendly-fire avoidance or card balance. Revised low launch coordinates can change individual arcs/collision outcomes, so this is not claimed to be a mathematically identical simulation.
- No card IDs, collection data, economy, shop behavior or flavor text changed.

## Artwork and provenance

**Built-in imagegen**, exactly two parallel generation calls, no retries/variants. Originals are unchanged 1254×1254 RGBA with real transparency and 16 cels each:

- `public/art/grenade-kneeling-v149.png`, SHA256 `0d9430be7205cd3cd1c55e35fe53944eb112a89fc76f29641fb6aeed44a35072`
- `public/art/grenade-prone-v149.png`, SHA256 `8506183248d4c6c8e1cf612b9a48bfa5d138d5237822872115db115c5a5672a8`
- Exact submitted prompts: `public/art/low-grenade-v149.prompts.json`

The originals have narrower gutters than requested and prone row-to-row registration drift. `scripts/bake-v149-low-grenade.mjs` uses shared integer cell cuts, one fixed anatomical scale/anchor per posture and measured contact baselines. It does not repaint anatomy or fit each cel to moving arm bounds. All 32 prepared cels share strong-alpha y=95 contact; silhouette heights are 41–43px kneeling and 18–21px prone, the small change coming from arm/torso effort, not a stance switch.

The browser loads only `public/art/low-grenade-frames-v149.png`: **91,671 bytes**, 2048×192, SHA256 `272c1cfe09698731f8412361ebdb9671d30034274fc56672b91019d5ff2c49ae`. Original-sheet calibration is offline; runtime uses cached prepared cels. Originals and prompts are retained in source.

## Verification

- **150 focused checks** pass (v135–v149). Eight new checks cover every low cel, time boundaries at five match timestamps, actual both-side throws/stock/foot anchoring, casualty priority, render purity, frozen launch depth, RGBA-identical packing and fingertip contact, and cancellation before release.
- Older low-throw checks were updated to require the new authored group at the correct stance, instead of accepting the removed crawl/static sequence. Their stance invariants remain enforced.
- **170 historical gameplay checks** pass, including three complete matches: seed 13 timed draw at 600.0s (1000:1000 bases), seed 71 side 0 at 267.5s, seed 102 side 0 at 309.5s. Same outcomes as v148 for those three fixtures; not a broad balance claim.
- Production renderer: **676 frames**, including **1,584 body-selection assertions** across both sides, crouch/hunker/prone and four infantry appearances; four actual simulated launches verify first-empty cel and exact projected fingertip origin. Contact sheets and actual release scenes inspected.
- Final local QA directory: `greyline-v149-grenade-R2llm8` in the task temp directory. This is production-renderer QA, not browser/device testing or a frame-rate benchmark.
- TypeScript check and production Pages build pass. Existing large-chunk warning remains; JS about 811.65KB raw / 275.93KB gzip, CSS unchanged.

## Remaining limits

The generated open-hand release has a minor glove/skin appearance inconsistency; some recovery cels have very similar silhouettes. At small in-game scale the grenade blends with the closed glove in some preparation cels; there is no painted airborne grenade. These are retained source-art limitations, not claimed fixed by a semantic pixel test.

Moving reload and dedicated repair/tool drills still need work. Specialist weapon-specific throwing art is not provided by this slice. Broader unit differentiation, battlefield effects and gameplay verification remain under the active goal.
