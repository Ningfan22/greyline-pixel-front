# v154 — 换弹被打断后保留剩余工作

## Released change

The absolute reload deadline kept elapsing behind casualty and posture-transition animation. A soldier could be wounded before completing the magazine drill and receive a full magazine on the first healthy tick. A stand-to-prone transition could consume the whole reload while the hands were visibly occupied supporting the body.

- Simulation now shifts both magazine-clock endpoints by the interrupted interval, preserving the work stage and remaining duration. It runs before early-return casualty and airborne branches.
- Interruptions: incapacitation/surrender, descent, jump/land/climb, full posture transition, partial knee lift/settle, hand grenade, treatment, dragging and first aid.
- Walking and grounded bank traversal are not interruptions. Retreat remains mobile and completes its refill normally. Decorative digging does not pause a real reload indefinitely.
- The existing pre-booked knee-settling delay is not charged twice. No ammo is consumed by pausing. Dry refills and tactical top-ups still consume reserve once at completion.
- Stationary rendering reads the same shared phase, without changing unit state. Existing whole-body stand/knee/prone art is unchanged; this release does **not** introduce moving-reload artwork.
- Damage, speed, posture lock, card roles, economy, collection, approved flavor and atlas size are unchanged.

## Verification

- Both new reproduction tests failed before the interruption fix (casualty work advanced from stage 2 to 7; posture work advanced from stage 1 to 2). They pass with the fix.
- Five new tests cover both armies, dry and tactical reloads, pause/recovery, stand-to-prone, occupied-hand/airborne gates, unchanged retreat, no doubled settling delay, reserve conservation and read-only rendering.
- 183 focused tests (v135–v154), all passed. 170 historical gameplay checks, all passed. Full matches settle: seed13 red at600s (810:1000), seed71 blue at335.2s, seed102 blue at291.3s. These are regression outcomes, not balance guarantees.
- Existing production renderer reload diagnostic passed 900 frames / 5,400 selected-body checks across both sides and three postures. Inspected the knee/prone contact sheet; the same artwork remains grounded at pixel95. Output: `/var/folders/mt/w9779b795sddhd14ddd3ty9r0000gn/T/greyline-v143-reload-VmJ8C8`.
- TypeScript check and Pages production build passed; the existing large-bundle advisory remains. No browser interaction testing or FPS claim. Background continuation does not open or replace the user's game tab.

## Moving-reload art attempt — rejected, not deployed

One asset-only subagent made one built-in imagegen request, no retries or CLI fallback. Main agent inspected the unchanged original. This was a compact 4 gait columns × 8 hand-work rows brief, distinct from the earlier 8×8 matrix.

- Saved unchanged original: `notes/art-review-v154/walking-reload-original.png`, 887×1774 RGBA.
- Exact submitted prompt: `notes/art-review-v154/submitted-prompt.json`.
- Correct nominal grid count is not quality evidence. Bottom-row boots are clipped, neighboring cells lack safe gutters, gait columns do not depict distinct passing phases, and several magazine-hand stages are ambiguous.
- No extraction, code-drawn substitute, fake extra cels, or runtime reference to this image. The experimental moving selector/tests were removed rather than shipping an unsupported animation branch.

Moving reload still requires valid authored locomotion/hand work; prone launcher loading and broader unit/visual work remain incomplete. The goal is not complete. Do not retry this failed dense matrix as though it were an unfinished live image job.
