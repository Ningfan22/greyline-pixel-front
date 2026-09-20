# v170 — supported prone starts and stops

This slice fixes a reproduced height discontinuity, not every animation or AI
complaint. The ordinary settled prone drawing is 17px tall while its crawl pair
is 23–24px tall. Both already report `pose: prone`, so a ten-second stance lock
alone cannot stop the 6–7px instantaneous start/stop change.

## Delivered

- Ordinary rifle bodies and precision observers use the five existing authored
  low-tail cels (stance 15→11) over 0.65s before moving feet or formation lane.
  A stop shorter than 1.25s retains the supported elbow body and its gait phase;
  a sustained halt lowers over the reverse five cels. Reversing a partial drill
  starts from its current height, never resets to the opposite endpoint.
- An explicit prone march enters the supported crawl height directly. Rising
  from crawl starts at its actual torso height. These remain simulation clocks,
  independent of rendering, with the existing ten-second cross-stance lock.
- Firing/cover credit pauses during the fractional body drill. Magazine work,
  grenade wind-up, repair and treatment wait for their correct settled body;
  occupied hands cannot silently use another animation. Reload retains all
  eight authored beats and exact ammunition transfer. Body-hit geometry follows
  the low torso; existing muzzle coordinates were not recalibrated here.
- Specialist launcher, sniper, MG and medic weapon bodies retain their separate
  existing compositions (their observed stop/crawl silhouette difference is
  only 0–3px). Rifle escorts still receive the bridge. No new image downloads.
- A nearby *future* drop no longer launches a soldier while the feet are still
  on a distant flat lip. Deep ledges require the two-pixel foot probe to reach
  a >3px drop, near the original surface; after entering the slope it cannot
  repeatedly restart the descent. Normal shallow weapon craters remain walks.
- Contact-safe movement is still checked before preparing/advancing. Known
  hostile fronts stop movement even during commitment; rearward travel remains
  legal. No new command gesture or ground use of rope cels was introduced.

## Verification

- 107 focused checks passed: v135 gameplay/art, v144, v148, v150, v151, v154,
  v156 bank/work, v167, v168, v169 and ten new v170 cases. New cases cover both
  sides, all five cels, short stops, reversal, direct prone march, real deep-bank
  crossing, magazines, contact safety, specialist exclusion and draw/pause purity.
- All 170 foundational gameplay checks passed. The deep-ravine test retains its
  original 14s deadline and required jump/land/bank/ground sequence. An added
  settled-prone fixture checks actual edge support, at most two descents, and
  completed crossings on both sides within 14s.
- Two timing tests explicitly account for the new physical work: blocked-lane
  travel/fire gets 12 + 2×0.65s rather than 12s, retaining all three-shot/range/lane
  assertions. Superiority withdrawal must still be recognized by 1.5s, with an
  extra 0.65s to complete elbow preparation before its >5px retreat assertion.
  Repair tests now require zero healing/work clock during this real settling
  phase; all previous long-duration tool-frame/work assertions remain intact.
- Final native production-render QA: 3,840 renders, 2,344 actual selected image
  checks; 8 side/identity fixtures traverse every start/stop cel. Largest
  strong-alpha silhouette height step is 3px, down from 6–7px at this boundary.
  This is not a claim of a newly authored high-frame-count crawl cycle.
- Four normal-visibility, normal-health/ammo 60s mixed battles exercised 15,081
  fractional bridge unit-ticks and 1,855 actual rope unit-ticks; zero rope frames
  were selected for a grounded/non-rappelling or incapacitated soldier.
  Surviving unit shot totals: greyline1605, jungle1375, mountains1600, desert634.
  Art fixtures disable enemy fire/high-HP the subject only to isolate animation;
  mixed battles do not. The first red-side fixture incorrectly placed an observer
  inside rifle range; moving it to600 preserves genuine sight without contact
  cancelling the intended unopposed march. No visibility flag is forced.
- Final QA folder:
  `/var/folders/mt/w9779b795sddhd14ddd3ty9r0000gn/T/greyline-v170-prone-motion-qh9NFu`.
  Owner inspected start-to-crawl, infantry-0-265 and mountains-59s, plus the
  prior identical short-stop/side1/greyline captures. No browser was opened.
- TypeScript and Pages production build passed. JS826.58kB/gzip280.56kB;
  existing >500kB advisory remains. No FPS/device-performance claim is made.
  No PNG, CSS, collection, pricing, card-copy or save-format changes.

## Known limits / next work

Three full seeded matches finished legally: seeds13 and71 draw at600s with both
bases1000; seed102 blue victory at348.25s. These are NOT balance improvements:
v169's same seeds all produced a winner. End-state diagnostics show no unit
stuck in a prone bridge or magazine drill. Seed13's surviving blue armor stops
at the remembered contact line after the enemy disappears; seed71 leaves a red
scout holding with ammunition. Stale-contact clearing and broader idle advance
need follow-up rather than treating a legal draw as successful battlefield AI.
Optional `MATCH_DIAGNOSTICS=1` retains compact end-state evidence in core tests.

The earlier raised-arm screenshots were not newly reproduced with current ground
units. This release addresses the observed low-body start/stop and ledge issues;
it does not claim all animation paths, explosions, unit duplication, late-game
AI, performance or the complete ongoing goal are finished.
