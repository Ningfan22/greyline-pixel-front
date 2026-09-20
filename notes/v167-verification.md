# v167 — do not mix settled prone anatomy into the crawl cycle

## Reproduction and scope

The v142 loader correctly replaced `actions20[2]` with the new settled prone endpoint, but all three moving-crawl selectors still alternated that slot with the legacy `actions20[12]`. The loaded rifle bodies therefore pulsed between17 and23–25 pixels high every other movement cel. This was independent of the simulation's ten-second posture lock: their logical pose remained prone. It also changed the entire body/uniform drawing on alternate cels. The original atlas contains an intact matching pair whose height difference is0–1px.

The initial suspicion that normal crater descent caused the recurring twitch was not supported. Normal blast slopes are capped/smoothed; a four-map,60-second mixed-combat diagnostic produced no jump states or invalid ground rope frames. Its first-pose change log includes normal initial stance acquisition, so it is not evidence of a cooldown violation. No speculative terrain/AI fix was made. The user's exact screenshot session/seed remains unavailable; this is a reproduced remaining animation defect, not proof that it explains every raised-arm screenshot.

## Change

Keep the original authored pair in a separate `crawl2` array before settled-pose replacement. Grounded crawling, prone bank traversal and crawling casualties all select that pair with their existing movement clocks. Stationary prone, idle observation, posture transitions, medical work, reloading, surrender and real rope descent retain their existing separate cels. New settled posture endpoints are not reverted.

Specialists retain their own weapon torso and cached leg composition; map the new pair to the same existing waist/muzzle landmarks. No simulation, stance timing, movement speed, weapon statistics, collection, economy, cards, approved copy or building/explosion assets changed. The two frames reference canvases already decoded by the adult atlas: no additional PNG download, repainting, image generation or per-frame allocation. The rejected v166 twelve-cel image remains outside production.

## Verification

-63 focused tests pass: four new pair/loader/selector/weapon tests, v163 idle5, v156 bank6, v153 weapon origins5, v147 authored weapon stances8, plus35 battle/crouch/reload/retired-art regressions. The v153 checks include1,760 muzzle-to-weapon comparisons. Existing v163 moving-crawl assertion now requires both new pair indices, still forbidding a frozen substitute.
-Production loader tests compare the exact RGBA hashes of both chosen drawings with the original atlas. Both drawings must differ, retain baseline y95 and vary in strong-alpha height by at most1px across all four identities. Settled prone still references `stance16[15]` and is measured separately.
-Before native-render QA: `/var/folders/mt/w9779b795sddhd14ddd3ty9r0000gn/T/greyline-v167-crawl-before-5xOobY`. Rifle identity height ranges6/8/7/6px.
-After QA: `/var/folders/mt/w9779b795sddhd14ddd3ty9r0000gn/T/greyline-v167-crawl-after-NQEsYb`. Ranges0/1/0/1px; four specialist variants retain0px range. Both-facing decoded frame plates inspected by the owner.
-Each QA run renders420 actual engine frames with normal friendly visibility, checking3,360 moving soldier draws across eight unit types. Both cels reach the production canvas, while drawing leaves all unit state unchanged. Owner inspected before/after plates and individual gameplay captures. This is native-canvas QA, not browser/mobile FPS measurement.
-TypeScript validation and Pages production build pass. Active JS822.32kB/gzip279.33kB; the existing >500kB bundle advisory remains. Exact publication checks follow the established GitHub-only route. No new runtime art files; original unrelated untracked files retained.

## Still open

This is a two-drawing legacy crawl, not newly painted high-frame-count locomotion. It removes the repeated6–8px height pulse but does not complete crawl start/stop transitions, richer crawl anatomy, moving reload, all unit-role differentiation or every remaining terrain/effect visual. Generic rifle muzzle/hit geometry is unchanged; no claim of newly calibrated ordinary-rifle origins. The broader goal remains active. Background continuation does not open a browser or republish to legacy Sites hosting.
