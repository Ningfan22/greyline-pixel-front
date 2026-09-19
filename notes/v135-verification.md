# v135 — screenshot regression pass

## Verified changes

- Finite decks for both sides: no implicit discard recycle, no paid draw when empty; explicit salvage still works.
- Healthy posture changes share the ten-second lock, including work/peek/observation/bank entry. Drawn posture transitions last 1.2 seconds; routine work no longer calls rope/run/death frames. True rope descent remains available during helicopter deployment.
- Removed opacity cross-fades and duplicate whole-body peek offsets, which caused escort flicker and vertical jumps.
- Generated eight standing rifle-reload cels with built-in imagegen. Original transparent image: `public/art/standing-reload-v135.png`; exact prompt: adjacent `.prompt.txt`. Four columns/two rows, 1254px square; measured common scale and row-specific boot baselines. No pixel-editing of the saved original.
- Corrected all 48 explosion atlas rectangles using measured non-uniform rows/columns. Painted smoke contours replace square smoke particles.
- Merged overlapping building pads before grading; standing walls retain visible footings over excavated ground.
- Ground advance is clamped before a visible uncleared enemy, including rush. Retreat and airborne transit remain allowed.
- Tear-animation canvas includes room above and beside the pack. Browser tested one-card reveal and table-triggered all-card reveal.
- Hospital is a fixed, unarmed 3s-setup support post (220 treatment / 64 rescue range); mobile medics still approach casualties. Forage is free one-card cycling, supply costs one to draw two. Local illumination is cheaper/narrower/longer than the wide flare. Existing flavor text is preserved.
- Repaired missing base definitions for recon jump, minefield, fallback.

## Checks

- Production TypeScript check (`tsconfig.pages.json`): passed. The broad historical tsconfig includes stale output snapshots and is not used to claim production validation.
- `v135-battle-regressions` + `v135-effect-atlas`: 19 checks passed, including 96 generated map layouts and decoded image geometry.
- Production renderer simulation: 240 rendered frames, 31,680 inspected unit states, no unexpected rope poses; all art loaded. Local 44-unit staged case: median tick 1.19ms, p95 2.68ms. This is not a browser-FPS or universal performance claim.
- Historical engine suite excluding the long full-match check: 164 passed, 5 failed. These five also failed against the untouched v134 baseline: prone sniper firing-height expectations, post-retreat regroup advance distance, short reposition-to-fire deadline, peek/reload pose expectation, and withdrawal crouch expectation. Some conflict with the new posture commitment, but they have not all been resolved. Do not describe the entire old suite as green.
- Final-code full-match checks: seeds 13, 71 and 102 all settled normally at 391.4s, 284.0s and 302.0s respectively, with valid resources and terrain throughout.

## Follow-up work (not completed by this release)

- Audit remaining repeated unit roles across the full roster, beyond the three differentiated pairs above.
- Dedicated standing grenade and additional low-posture action cels. The first mixed-action generated atlas failed QA and was not shipped; standing grenade currently retains a grounded standing frame rather than reusing a climb.
- Replace the existing code-painted pack with a QA-approved generated animation, if continuing the earlier art request; v135 fixes its clipping only.
- Reconcile the five inherited AI/stance suite failures with the new ten-second contract, retaining firing and movement coverage.
