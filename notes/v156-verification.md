# v156 — Supported bank motion and real kneeling construction

## Reproduced causes

- A real steep-bank traversal forcibly requested crouch, immediately rendered a low gait while a hidden stance clock ran, and then resumed the partially completed lowering drill after reaching the top. It reset crouch travel height, advanced no footstep phase and added a four-pixel whole-body sine lift.
- The same traversal checked enemies only before it began. A contact revealed during the step did not stop forward motion at the existing safety line.
- Construction marked a member as digging while his standing/prone stance was still locked, while lowering, or during a magazine drill. Rendering could substitute the kneeling shovel body and simulation advanced earthwork before the hands/knees were free. Generic stance selection could first stand up a prone worker, then lock him out of his requested work height.

## Changes

- Banks retain the current standing, crouch-travel or prone gait; no hidden cross-height drill. Their physical position follows the ground without the extra body lift, and gait phase advances by actual distance. A new stance request waits until normal supported movement resumes and then uses the existing slow authored transition and ten-second commitment.
- The crouch-travel state survives bank traversal and its exit. Each bank step rechecks observed contacts through the normal safety rule; rearward movement remains possible and unseen enemies do not affect it.
- Construction chooses the required knee height before the generic posture request. A shared readiness check gates both real excavation and the shovel artwork: grounded, knee planted, no stance transition, no actual magazine change/treatment/grenade/drag/first aid or hit/fire animation. Work time and progress start only when the body can do the work.
- Reuses existing authored art. No generated image, card/stat/collection/economy/flavor changes. Ordinary explosion crater dimensions, genuine airborne drops/landings and the legacy wall fixture are unchanged. This is not a new steep-ledge climbing animation.

## Verification

- Five bank reproductions and all three construction reproductions failed on their original paths before the relevant fixes. Nine new tests now pass, covering both sides and all three stance heights, bank exits/gait/contact safety, queued slow posture changes, grounded work timing, reload exclusion and long construction past the ten-second boundary.
- Focused v135–v156 suite: 202 passed. Historical engine suite: 170 passed, including completed seeds13/71/102 at600s (red810:1000),335.2s (blue1000:0),291.3s (blue1000:0). These are regression results, not balance proof.
- Nine trench-work integration checks pass: six-person and two-person earthworks, finite terrain/mines, combat interruption/resumption, actual defenders firing and departure without bank/climb loops. The old five-second all-defenders-firing assertion also failed against unmodified HEAD b70125b. Its window is now12 seconds to include the user's ten-second posture commitment and the authored rise; no production bypass was added. Stationary-position, actual-shot and no-climb assertions remain.
- Production renderer ground-work diagnostic: 1,180 frames,288 bank draw/body checks,470 real shovel-frame observations. Inspected the two-sided, three-height contact sheet and prone-to-knee construction capture. Output: `/var/folders/mt/w9779b795sddhd14ddd3ty9r0000gn/T/greyline-v156-ground-work-dgylNh`.
- Effect/footing regression:1,440 production frames across four maps plus blast lifecycles and three building types/damage stages. Inspected the full Greyline blast scene, wreck lifecycle and supported-building plate; no disconnected top fire strip or unsupported corner in those samples. Existing v145 art/atlas code is unchanged. Output: `/var/folders/mt/w9779b795sddhd14ddd3ty9r0000gn/T/greyline-v145-effects-sMwMo2`. Local draw median1.729ms/p952.855ms/max46.249ms; these Napi measurements are not browser FPS or a controlled performance improvement.
- TypeScript and Pages build passed. Active JS:`index-Da4j3BbZ.js`; stylesheet unchanged:`index-DOysgTK1.css`. Existing greater-than-500kB bundle advisory remains.

## Remaining scope

This removes diagnosed action-conflict paths, not every possible visual defect. No new moving-reload, prone-launcher loading, casualty or per-unit identity art. The wider card balance audit and browser/device performance measurement remain open. Background continuation does not open/replace the user's browser; no browser interaction or FPS claim. Goal remains active.
