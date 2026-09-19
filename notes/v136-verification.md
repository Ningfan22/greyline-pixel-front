# v136 — grounded actions and actual unit roles

## Changes

- Target selection, cover relocation and actual firing use the current muzzle and posture. A hypothetical standing ray is used only when planning a legal stance change. Ten-second stance commitment remains intact.
- The first half of a small-arms shot clears nearby scenery **including wrecks**. The aiming check and travelling projectile now share this rule. Soil always remains solid; distant cover still intercepts. Heavy ordnance retains its collision rules.
- Generated eight dedicated standing-grenade cels. The saved original is `public/art/standing-grenade-v136.png`; the exact generation prompt is `public/art/standing-grenade-v136.prompt.txt`. The fifth cel crosses the nominal grid boundary, so measured gutters preserve the complete hand without importing it into cel six. All figures retain the same body scale and planted boot registration.
- A hand throw takes 1.1 seconds. Release occurs after cel five (0.6875 seconds), from hand height, once only. The soldier stops moving and rifle firing until follow-through is complete. Incapacitation during preparation cancels the throw. Targets must be a compact observed cluster without friendlies at the intended blast location. Kneeling/prone throws retain their grounded fallback cels; these low-posture actions are not newly painted eight-frame sequences.
- Airborne anti-armor is now two real rocket operators and two rifle escorts, with matching weapon silhouettes and ammunition. Rockets only target vehicles; the escorts handle infantry. Shorter launcher range than the ground RPG squad gives the insertion a distinct flank role. Card ids, owned copies, decks and approved flavor text are unchanged.
- Assault sappers now receive 50% less **blast** damage. They are not immune to rifle fire or gas, and the erroneous outgoing anti-armor multiplier is removed. Their role is blast-resistant mine clearance, distinct from cheap clearance engineers and vehicle-repair mechanics. Card rules explain that trade-off.

## Verification

- All 170 historical gameplay checks passed, including full matches with seeds 13, 71 and 102 (418.7s, 292.1s, 363.0s). The five old failures were investigated: outdated instant-stance assertions now check the ten-second contract, regroup checks both crouched progress and later upright speed, and bounded reposition allows its full acquisition time. No test was disabled.
- 29 dedicated v135/v136 regression checks passed. Coverage includes grenade release/interruptions, both directions, friendly safety, low-posture commitment, cover clearance versus soil, real airborne rocket impacts, blast-only sapper protection, all 48 explosion cels, and generated reload/grenade registration.
- Production renderer, 44-unit staged battle: 240 rendered frames / 31,840 unit states, no unexpected rope frame. Local tick median 1.05ms and p95 2.14ms; this is a staged simulation measurement, not a universal browser FPS claim.
- Generated grenade source and decoded contact sheet visually inspected. A separate production-renderer throw replay checks all eight cels in actual battle rendering.
- Production TypeScript check passed. Local browser loads v136 and successfully deploys infantry, RPG infantry and a tank.

## Still open in the larger goal

- Audit the rest of the 116-card roster for overlapping tactical roles and descriptions; this release does not claim to solve every duplicate.
- Dedicated low-posture reload/throw cels and the generated transparent card-pack tear animation remain separate art work.
- Larger-scale/browser performance profiling and additional AI matchups remain useful follow-up, beyond the controlled regressions here.
