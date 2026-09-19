# v150 — authored mechanic work and physical repair positions

## Cause and scope

After v148 removed the crawl cel, mechanics still displayed a static rifle pose during repair. The service branch also repaired from anywhere within 90 units of the vehicle centre, regardless of a moving vehicle or an unfinished posture transition. This update gives the actual task its own authored tool drill and reachable hull-end positions. It does not complete the overall battlefield goal.

## Implementation

- Dedicated full-body `repair34` bank: 12 standing, 12 fixed-knee and 10 prone cels. Hunker shares knee height. Medical, patrol, idle, digging and specialist layers cannot paint over the real repair action. Incapacitation, descent, locomotion and committed stance transitions keep their higher priority.
- Work clock advances only after the actor is stationary, grounded and done with posture/crouch-travel transitions. Existing ten-second stance locking stays intact. The tool cycle runs for 2.4 seconds independently of health pulses or rendering frequency.
- Mechanics approach the nearest available hull end using the existing vehicle half-width plus 24 units of reach; 3-unit arrival tolerance. Normal collision/terrain/contact movement rules remain in force. Map-edge vehicles expose the reachable end.
- Each vehicle has two exclusive repair positions, one at either end. Reservations persist during the approach. Other mechanics can service another damaged vehicle or remain available for combat/guard duties; three bodies no longer stack on one work point.
- A valid assignment survives changing relative health fractions. The target must be friendly, alive, damaged, ground-armored and not a support vehicle. Moving or departed vehicles, restored health, casualties and retreat orders stop work. Two linear scans replace per-frame filter/sort selection.
- Repairs begin after .35 seconds of settled work; unchanged per-mechanic pulse of 8 health every .5 seconds. **This changes repair availability and maximum simultaneous workers per vehicle**, not a claim of identical balance. The mechanic card's detailed explanation was updated; card IDs, cost, damage, flavor, collection and economy were preserved.

## Artwork / exact prompts

Built-in `imagegen`, exactly three parallel calls, no retries/variants. Original RGBA files remain unchanged, 1254×1254, 4×3 cels with genuine transparency:

- `public/art/repair-standing-v150.png` — SHA256 `de1a5672e4eba25178edd3c16c069784d616a0bea4d09ffff61060aecc8a22af`
- `public/art/repair-kneeling-v150.png` — SHA256 `4bc9b38abb468c220051d9ee912c86134b7120993092e9a86951a32bb5bff1ff`
- `public/art/repair-prone-v150.png` — SHA256 `71929c1f54da2f95162dbb333237bbfb3ea86f7f81e4bb65b57d2e9eec894d72`
- Exact submitted prompts and generation caveats: `public/art/repair-work-v150.prompts.json`.

`scripts/bake-v150-repair.mjs` packs selected original pixels with one fixed anatomical scale and body anchor per posture. Foot registration excludes the moving tool. Original prone cels 4 and 5 put the wrench below the ground and were excluded rather than clipping it or shifting the actor upwards. No anatomical painting, per-cel scale changes, or fabricated intermediate poses.

Runtime only loads `public/art/repair-work-frames-v150.png`, **121,629 bytes**, 1536×288, SHA256 `1b6ef8eeb2d585c37019d17795fdecb23103a8e30615bdad16c57664ea1c43c7`. It decodes 34 integer cells once; the last two grid slots are empty and never addressed. Ground contacts are y95 in every cel; standing silhouette 63–64px, knee 43px, prone 20px. Originals and prompts stay in source; no runtime original-sheet calibration.

## Verification

- **161 focused checks pass** across v135–v150, including eleven new mechanic checks: all 34 cels, action priority, stable assignment, both armies at knee/prone height for 27 seconds, stance-lock/settling, departure and moving armor, casualties/retreat, uncleared-contact boundary, spawn-edge repair points, separate whole-squad repair positions, and byte-identical prepared RGBA with fixed contacts.
- The existing v148 medical test's repair fixture now starts at an actual hull-end work point instead of inside the tank. Medical expectations and the rejection of unrelated crawl/tool actions remain enforced.
- **170 historical gameplay checks pass**, including full matches: seed 13 draw at 600s, seed 71 side 0 at 267.5s, seed 102 side 0 at 309.5s. These unchanged seeded results are not a comprehensive repair-balance assessment.
- Production renderer: **1,016 frames**, **868 body-selection assertions**; six posture/direction scenes, actual approach/service simulations, and two full mechanic squads. Contact sheets and real tank-adjacent frames visually inspected. Final QA directory: `greyline-v150-repair-zC5f9R` in the task temp directory.
- TypeScript and final Pages build pass: JS 813,754 bytes / about 276.74KB gzip; CSS unchanged. Existing large-chunk warning remains. Renderer QA is not browser/device testing or an FPS benchmark.

## Remaining limits

The painted wrench head still travels slightly through the torque/reset drill, most visibly standing; it is not a rigged contact-constrained fastener. The art does not include separate take-tool-out/stow-tool transitions or weapon-specific mechanic uniforms. Hull contact uses the existing collision half-width, not per-pixel sloped armor ports. Movement/reload animation, broader role/card differentiation and the remaining battlefield audit continue under the active goal.
