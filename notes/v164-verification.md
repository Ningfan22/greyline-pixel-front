# v164 — loitering munition versus immediate FPV

## Reproduced overlap and implementation

`loiter_drone` previously reached the ordinary weapon loop, emitted a `drone` projectile and immediately removed its aircraft body. Its description promised a dive, but there was no actual patrol/confirmation/terminal aircraft state. FPV already had physical flight, finite endurance, visible-target tracking and scene collision.

The three-cost loitering card now spends up to60 seconds physically flying to, and reversing through, a front-line orbit. It ignores individual infantry; it searches visible ground vehicles/emplacements within420, preferring gun emplacements, then armor, then other vehicles. Candidate scans are0.2s apart with one-pass ranking rather than candidate-array sorting. Once a candidate is chosen, every simulation step checks continuing visibility, range and survival. It requires two uninterrupted seconds of confirmation before committing. Smoke/loss/death/retreat resets that confirmation.

The aircraft itself then dives at260px/s, showing its real pitch and retaining an interceptable aircraft hitbox until impact. A shared terminal-flight function preserves existing FPV trajectory and collision behavior. Hidden targets only leave their last visible coordinates; walls/buildings/ground stop the aircraft. No remote projectile, no headquarters damage, no return card or extra opponent kill for self-consumption. Endurance still expires while selected or commanded.

FPV remains1cost/24HP/24seconds, immediate visible-target acquisition, narrow14radius and216 nominal anti-armor damage. Loiter stays3cost/40HP but now has140 base impact damage,44radius, armor×1.25/infantry×0.7: delayed area attack on a prepared battery instead of a more expensive duplicate of cheap immediate tank hunting. Cost/rarity/collection IDs/copy limits/ownership/decks/approved flavor text are unchanged. This is not a statistical claim of competitive balance across all decks.

AI buys loiter support for observed guns/armor, not infantry-only or hidden-gun situations. Its local orders say continue search/rearward orbit/orbit here, not hover. Retreat completes at the real destination near either map edge and resumes bounded flight. A committed dive cannot be canceled by a watch/retreat snap.

A regression additionally exposed a second visual explosion when already-detonated one-way debris hit the ground. Both FPV and loiter now mark those wrecks `spentWarhead`; they retain their fall/cover but only kick up dust on landing. Ordinary shot-down aircraft/crash behavior is unchanged.

Also corrected the stale description on the five-person `airborne_insertion` card: the rapid-landing buff belongs to the dedicated rapid unit, not this full squad. No insertion mechanics changed in this patch.

## Verification

-17 new engine cases pass: mirrored physical patrol/late heavy target/2s confirmation/target priority, smoke reset, last-known terminal aim, building interception, real SAM interception before and during dive, paid60s expiry/discard/HQ safety, local orders, edge retreat, AI known-versus-hidden choice and no second spent-warhead explosion for both FPV/loiter.
-26 existing FPV/air-transport checks pass after extracting the shared dive routine.25 selection checks pass. Additional v135 battlefield, v162 wreck-art and v163 prone-art regressions pass with the configured canvas dependency. An initial invocation without that dependency path failed to load canvas; rerun with the existing runtime path passed.
-170 historical gameplay checks pass, including three full matches: seed13 red at600s,916:1000; seed71 blue335.2s,1000:0; seed102 blue291.3s,1000:0. Two old loiter assertions were updated to test the new continuous aircraft behavior rather than require its superseded instant-projectile/fixed-altitude path; the old extra-explosion assertion failure led to the spent-warhead fix, not a relaxed expectation.
-Production renderer exercised720 frames, normal visibility on both sides, no unit mutation. Main owner inspected individual normal-view confirmation, both-direction dive and impact captures at `/var/folders/mt/w9779b795sddhd14ddd3ty9r0000gn/T/greyline-v164-loiter-V5L7su`. No visibility/alpha override, no invented art or composited body parts. An attempted contact-sheet copy rendered blank in the native canvas harness; removed that diagnostic output and reviewed the actual intact frame PNGs instead.
-TypeScript and Pages build pass; existing >500kB bundle advisory remains. No new runtime images/downloads, and no browser-FPS improvement claim. Exact deployed-byte check follows publication.

## Limits

Reuses the existing authored aircraft art; this is physical flight/pitch, not new banking/turn artwork. Orbit reversals still mirror in a2D plane rather than use a fully painted banked turn. No claim that every unit/card has been made unique. Moving crawl/reload, legacy HE/air-effect frames, dust overlap, map-layer seams and real-device performance remain outside this scoped change. Existing unrelated untracked files are preserved. Background continuation does not reopen the user's browser.
