# v148 — medical handwork without crawl/posture substitution

## Cause and scope

The former treatment animation alternated legacy action 13 (hands-and-knees crawling) with action 1 (kneeling). It was not a dedicated medical drill. Repair infantry also reused `tending`, and early-return paths could leave that flag latched after the actual job ended. Generic combat stance selection could request standing every time a treating medic's ten-second lock expired, immediately followed by a kneeling request from the healing branch.

This patch gives medical treatment its own painted body and clock. It does not claim that all animation, card differentiation or battlefield goals are complete.

## Changes

- Three eight-cel medical drills: standing kit preparation, fixed-knee bandage work, prone bandage work. Whole-body owner prevents patrol, specialist torsos and idle decorations from replacing the cels.
- Actual service branches renew `medical`/`repair` and target UID every simulation tick. A job interruption, finished patient/vehicle, or casualty early return clears work immediately. Healing pulses do not reset the animation clock; a different target or task does.
- Stance/crouch-travel transitions retain priority; handwork starts after settling. Medics still obey the existing ten-second stance gate. A committed prone medic/buddy does not rise merely to perform aid.
- Continuing service requests its stance before the generic combat-height selector. Medical treatment and repair face their current target.
- Buddy aid uses its actual 1.5-second deadline, not an unrelated global animation phase. Health amounts, pulse intervals and rescue thresholds are unchanged.
- Removed crawl-frame 13 from nonmedical kit/repair/share/scavenge work and crouched throws. These retain their planted body pending dedicated work/low-throw cels; this is intentionally not presented as new repair/throw artwork.
- Card IDs, costs, collection ownership, copy limits, economy, flavor text and shop behavior are unchanged.

## Artwork and packing

Generated with **built-in imagegen**, three parallel calls, no retries or variants. Originals are unchanged 1774×887 RGBA with genuine alpha. All are available in `public/art/`:

- `medical-standing-v148.png`: SHA256 `d4eead380e459da391fd506a0f14202728faa8dd53a61a8dd62ce268002afb13`
- `medical-kneeling-v148.png`: SHA256 `d7913655b17b9a4234f41903573b1f96d74df8a603959b416e021b87450b3c40`
- `medical-prone-v148.png`: SHA256 `b7846c4d102d7428e8ad1ea03d1a288f53cfb239fe4243837e92f6f2a8318347`
- Exact three submitted prompts: `medical-work-v148.prompts.json`

The generated sheets did not maintain consistent scale between postures or baselines between rows. `scripts/bake-v148-medical-work.mjs` calibrates existing RGBA drawings with one fixed anatomical scale per posture and measured contact anchors, then packs them without repainting. No code-generated anatomy or per-cel bounding-box fitting. Safe integer source-cell boundaries preserve original fringe without sampling adjacent figures.

Runtime downloads only `medical-work-frames-v148.png`, **73,787 bytes**, 1024×288, SHA256 `37376e48629a399989e79095b16999fc29261e305539ed817e977ebd57d3e77f`. Original assets and exact prompts remain in source, not required by the live runtime.

Strong-alpha contact baseline is y=95 for all 24 cels. Painted standing height is 63–64px; kneeling 43px; prone 19–21px. The latter includes a small authored forward reach, not a stance-class switch. All cels were visually inspected before integration.

## Verification

- **142 focused checks** pass (v135–v148), including 12 new medical selection, task-clock, interruption, fixed-stance, approach, repair and exact-RGBA packing tests.
- Actual engine fixtures: a standing medic waits for its ten-second lock, lowers once, then works on one knee; continuous crouched/prone treatment remains in the committed posture for 25 seconds. Approaching a casualty retains locomotion until in range. Finished repair clears work.
- **170 historical gameplay checks pass**, including three complete seeded matches. Seed 13: timed draw at 600.0s, bases 1000:1000; seed 71: side 0 at 267.5s; seed 102: side 0 at 309.5s. These outcomes differ from v146/v147; this patch changes support behavior, so no claim of identical balance/results is made.
- Production-renderer fixture: **870 frames / 3,480 body-selection assertions**, both sides, all three postures, medic/medical team/field hospital/buddy aid. All selected painted medical bodies were actually drawn, without decorative substitution. Entry height differs by no more than 8px from established normal bodies.
- Local QA directory: `greyline-v148-medical-MBdwsk` in the task temp directory. Contact sheet plus both-side battlefield stills inspected. This is a production-renderer fixture, not browser/device testing or a frame-rate benchmark.
- TypeScript check and Pages production build pass. Existing large-chunk warning remains: JS about 811.08KB raw / 275.84KB gzip. CSS unchanged.

## Remaining work

Moving reloads, dedicated low-posture throws, and actual repair/tool handwork still need authored animation. Prone aid has subtle torso movement rather than perfectly identical silhouettes. Generic buddy aid currently shares the unbranded medical drill; specialist weapon retention during that short action is not yet authored separately. Broader unit/role variety remains under the active game goal.
