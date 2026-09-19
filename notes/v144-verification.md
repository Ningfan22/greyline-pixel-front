# v144 — committed crouch steps and grounded stops

## Changes

- Low movement now owns a simulation-time knee-to-travel phase. A planted soldier takes .9 seconds to rise through the existing authored stance cels before moving either forward or laterally. A short stop retains the same gait frame and specialist weapon body; after 1.25 seconds without movement or recent fire, the soldier lowers over .9 seconds. Interrupted lowering reverses continuously. Rendering never advances this clock.
- Hit geometry follows the same phase. Cross-height transitions start from the actual crouch body height instead of first snapping down to a kneel. Explicit crouch marching can enter its travelling endpoint directly. The existing ten-second stand/crouch/prone class lock is unchanged.
- Safe cover moves commit through their initial rise and first step so the shoot/move decision cannot cancel and restart them on successive ticks. Frontline clearance and new close contacts still constrain every step. No permission to cross uncleared enemies was added.
- Short bounds count actual ready-to-move time, not time spent rising. Upright bounds retain their duration cap. Covered light-MG bounds include their startup time once. Alternating withdrawal phases are 1.8 seconds rather than .85 seconds, which previously expired before the .9-second rise could complete. Moving or transitioning soldiers do not count as settled covering fire.
- Stationary magazine replacement lowers first, then plays the full existing magazine drill. Intermediate rising/lowering cannot fire or launch a grenade. Blast flinches retain the prior foot-cycle phase instead of restarting it.
- No card statistics, economy, collection IDs, ownership, copy limits, rarity, flavor text or map/explosion assets were changed.

## Verification

- 109 focused tests pass, including twelve new locomotion cases: both-side planted startup; 600 rapid start/stop changes; reversible lowering; complete delayed reload cels and ammo transfer; shooting readiness; travel-to-standing geometry; explicit crouch marching; casualty/descent resets; draw independence; newly revealed enemy-front safety; covering-fire readiness; and capped upright bounds.
- 170 historical gameplay checks pass. Three full seeded matches finish: seed 13 at 266.8s, seed 71 at 262.9s, seed 102 at 334.0s. Movement timing changes outcomes without editing card strength.
- Older time-based fixtures now allow the physical startup before requiring actual distance travelled. Covered-fire, front-safety, movement-distance caps, target legality and eventual firing assertions remain in place. The earlier run exposed real cancelled-start and too-short-withdrawal-phase defects, which were fixed in production logic before rerunning.
- Production renderer harness draws 960 frames across both sides and six infantry roles, with 1,914 body/continuity assertions. Inspected the authored bridge contact sheet and in-scene startup, travel, hold and settled captures. Strong-alpha foot baselines remain y94–95; adjacent bridge heights differ by at most 6px. Held travel uses the exact same cached specialist body on both sides of an instantaneous moving-flag change.
- Type check and Pages build pass. The existing bundle-size warning remains (805.86kB raw / 273.91kB gzip JS). This is deterministic local renderer/gameplay QA, not browser/device performance testing.

## Still open

- Intermediate posture cels still share rifle-body anatomy across several specialist roles. The stable moving/held weapon-body switch is fixed, but specialist equipment can still change during the full-body bridge; it needs authored weapon-specific transitions. Heavy-MG setup and other final pose handoffs also need further visual refinement.
- Moving reloads retain locomotion without a visible independent hand drill. Low grenade/treatment and more individual weapon handling remain incomplete.
- This addresses one real start/stop jitter path, not every possible AI/terrain or animation defect. It does not claim the repeated-looking unit problem is finished. Earlier explosion, map foundation, pack and card-role fixes were left unchanged in this release.
