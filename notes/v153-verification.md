# v153 — 枪口标定与稳定的脚底接地

## Scope and cause

- Specialist art already had measured weapon landmarks, but engine aiming and soil collision still used ordinary rifle muzzle geometry. For example, the kneeling grenadier's physical origin was almost 10px lower than its visible launcher. A renderer-only projectile offset could not fix the false obstruction decisions.
- Shared pure weapon-pose data now drives authored art registration, moving-body composition and physical muzzle origins. Grenade launchers, rocket launchers, sniper rifles, light/heavy machine guns and medic legacy bodies retain their actual landmarks. Rifle escorts and precision observers retain their existing geometry.
- Standing-shot forecasts preserve the member's actual weapon and clear current transition state. AI no longer treats every standing infantry barrel as exactly 47px high. Real posture transitions and the existing posture lock still gate firing.
- Removed the time-driven translation of the entire idle soldier. It moved planted boots and the visible barrel up/down; breathing must live in authored body frames instead.
- Hit-body dimensions, damage, costs, collection, currency, card identities, approved flavor and source artwork are unchanged. No new generated images or enlarged runtime atlas in this update.

## Verification

- 178 focused regression tests (v135–v153), all passed; 170 historical gameplay checks, all passed, including three complete match simulations.
- New muzzle/art comparison: 1,760 cases spanning 11 specialist units, both facings, standing/crouching/prone/hunker/run, stationary/moving states and eight gait phases. Prepared sprite and physical weapon origins agree; reads do not mutate units.
- Real engine trials on both sides: grenadiers, rocket launchers, snipers and LMGs fire when their visible barrel clears a close soil bank, but cannot fire from a buried barrel. Projectiles start at the measured origin. Taller banks still block fire.
- Specialist stance planner rises once when only its own standing muzzle clears terrain, completes the 1.2s transition before firing, then holds its committed posture. Transition forecasts remain continuous without altering hit-body geometry.
- Production renderer diagnostic: 1,080 frames, both sides and three settled postures, six unit types per scene. Time-only sweeps retain the same foot transform; renderer reads do not mutate units. Inspected kneeling blue and prone red origin overlays at actual barrel tips.
- Diagnostic artifacts: `/var/folders/mt/w9779b795sddhd14ddd3ty9r0000gn/T/greyline-v153-origins-1yHQgs`. Origin crosses are test overlays only, not shipped decoration.
- Warm local non-browser microbenchmark: 300,000 mixed muzzle-height/offset pairs, approximately 0.198µs per pair on this host. This is not a browser FPS or low-end-device claim.
- TypeScript check and Pages production build passed. The existing large-chunk advisory remains; this is not a claim that bundle-size optimization is complete.

## Boundaries

No claim that all remaining animation reports are resolved. Prone grenade-launcher loading and moving reloads still need suitable authored frames. Broader unit differentiation and visual-quality audits remain ongoing. This is a background continuation: no browser interaction QA or preview handoff.
