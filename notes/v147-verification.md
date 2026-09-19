# v147 — preserve specialist weapons while changing posture

## What changed

- Portable machine-gunners, rocket troops and snipers now use their own painted whole-body stand/knee/prone progression. Previously the renderer deliberately skipped specialist art for `stance16`, making every specialist turn into the generic assault-rifle body during each transition.
- Stationary endpoints reuse the exact first/knee/prone cel, including the prone body rather than replacing it with old crawling legs. The same prepared upper body feeds the existing moving/briefly-held specialist gait, preserving the v144 stop/start cache contract.
- The heavy tripod gun retains its existing dedicated setup/belt animation; a portable LMG sheet cannot replace it. Rifle escorts in mixed squads remain riflemen. A sniper-team observer now keeps ordinary kit/radio poses instead of inheriting a second precision rifle.
- No simulation clocks, posture cooldowns, AI decisions, weapons' damage/range, card IDs, ownership, economy or flavor text changed. Work, grenade and casualty animation ownership is preserved.

## Authored imagery and fidelity limits

Four built-in imagegen calls, through one asset-only agent: three weapon edits of the existing upper-posture reference, then one separate knees-to-prone choreography sheet. Originals were copied unchanged into the project. No original PNG was repainted, keyed, overwritten or replaced with code-drawn anatomy.

The three upper originals came back at 1254×1254, with cropped fourth-column weapons and crowded prone rows. Production selects only six complete upper cels from each. A separate 1024×1536 lowering atlas has 24 independent figures; their measured bounds cross nominal cells, so equal-grid cutting would still be wrong. The sniper's intact planted-hand frame from its upper original fills a too-large height gap in the lower chain.

Each role has **13 distinct selected drawings in 16 timed slots**, not sixteen unique drawings. Repeated knee slots preserve the existing clock. Source families use fixed .21/.32 scale to match anatomy; no per-frame bounding-box fitting. Painted gear detail changes slightly between the upper and separately authored lower sheets, including bipod deployment. Do not claim exact weapon-model/cloth continuity or a wholly rebuilt movement animation library.

The importer isolates the connected figure only where a crop includes neighboring fragments, retaining original soft alpha alongside it. Its threshold is 16 rather than 128 so narrow barrels are not severed. Sources themselves retain all original pixels.

## Loading and reproducibility

`scripts/bake-v147-weapon-stance.mjs` packs exactly the calibrated RGBA cels without further scaling or painting. The browser downloads just the **162,167-byte 2048×288 prepared PNG**, not the 4,957,657 bytes of originals. A regression compares all 48 decoded frame buffers byte-for-byte with the original calibration pipeline. Browser startup no longer runs the new component extraction.

Workspace assets:

- [Machine-gunner original](../public/art/machinegun-stance-v147.png) — SHA256 `1446d018849cdf5c8878c4f59968004db3ff06abfab06a0a65a73752ad156b51`
- [Rocket original](../public/art/rocket-stance-v147.png) — SHA256 `814cb17be0efb37eb3427e1dc750b2794e59acf43c03c40865a5e75d47238f06`
- [Sniper original](../public/art/sniper-stance-v147.png) — SHA256 `62c385332ba2ade7a70ee14126ed7c7893d7b785ee1d7a9b5df780cff8e0078e`
- [Lowering original](../public/art/weapon-lowering-v147.png) — SHA256 `4732b584b7e67cabcdd6a202cb2c96d4a3b17d6ec805f65e6eeb26e256102d5a`
- [Prepared runtime frames](../public/art/weapon-stance-frames-v147.png) — SHA256 `e2b4dcd5cd897723180ed83284f34887e1c2ce4370a036a6736d4b2564bc01b0`
- [Exact four submitted prompts](../public/art/weapon-stance-v147.prompts.json)

## Verification

- 130 focused cases pass (v135–v147), including eight new selection, role-ownership, endpoint, reverse-clock, moving/held-body, original-art geometry and lossless packing checks.
- 169 historical gameplay checks pass. This visual-only patch did not repeat the three full-match test; the v146 complete matches remain the last full-match evidence, not a new v147 run.
- Production renderer: 588 specialist-transition frames with 1,764 actual-body assertions, on both sides, followed by the v144 960-frame start/stop exercise with 1,914 assertions. Updated that harness to check the new actual specialist body instead of assuming every transition must be a rifleman.
- All prepared strong-alpha feet end at y95; successive posture heights change by no more than 7 pixels. Measured muzzle landmarks intersect the actual painted weapons. Reviewed all three contact sheets and full-scene movement, settled and prone captures. No rectangular neighboring-cel fragments appeared in those samples.
- Packed-runtime repeat: `/tmp` session directory `greyline-v147-weapon-stance-ZssGhk`; previous original-calibration run `greyline-v147-weapon-stance-ZEbQIH`; locomotion run `greyline-v144-locomotion-2J63OL`. These are local production-renderer fixtures, not browser/device QA or a benchmark.
- Typecheck and Pages build pass; existing JS-size warning remains (809.85 kB raw / 275.49 kB gzip).

## Remaining work

- Moving reloads still have no separate hand drill. Sniper magazine replacement still uses generic rifle reload art; LMG/launcher handling also needs its own authored work cels.
- Some non-idle work branches (`tending`, first aid, ammunition handoff and `groundedWork`) still select legacy action 13, which is a low crawl/work silhouette rather than a stable medical knee. Those need proper work animation rather than borrowing unrelated body poses.
- Heavy tripod carrying/setup transitions, mortar/medical posture art, separate guided-launcher identities and wider troop/card-role differentiation remain incomplete. This is not a claim that all unit repetition or all animation jitter is solved.
