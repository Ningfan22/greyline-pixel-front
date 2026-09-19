# v140 — machinegun roles, authored HMG drills and near-miss query performance

## Gameplay

- Base MG squad: existing one gunner/four rifle escorts; 100-round belt, 4s reload and sustained fire retained.
- Light MG: one gunner/one escort; 60-round belt and 2.8s reload, four shots at 0.16s intervals then a 0.8s pause. In advance mode only, the gunner may use that pause to bound at most 24px when a healthy stationary friendly infantryman within 180 actually fired during the last 1.5s, the target remains at least 220 ahead and suppression is below 40. No fictional covering-fire bonus, no hold-order override, no bypass of contactSafeX. Rifle escorts retain ordinary weapons.
- Heavy MG: one gunner/two escorts; 150-round belt and 5s reload, eight shots at 0.16s intervals then 0.8s pause. Requires 2.4 stationary seconds, a low posture and completed 1.2s stance transition. Any movement resets setup. The generic standing-peek planner no longer contradicts the tripod stance. Near-miss suppression is 7 rather than 4 only along the real traversed bullet ray; cover, depth and per-bullet dedup still apply.
- MG burst pauses do not trigger the decorative rifle reload branch. Empty belts and tactical reloads still use real reserves. The shared ten-second posture-height cooldown is preserved.
- AI selects base MG when missing a front screen, heavy MG against observed infantry concentrations with its own screen in place, and light MG alongside mobile assault elements. Hidden enemies do not change selection in the dedicated cases.
- Card IDs, collection copies, rarities, costs and approved flavor text are unchanged. Card rules/details explain actual behaviors.

## Generated art

Built-in imagegen, one asset-only generation call, no CLI fallback. Original transparent PNG is `public/art/heavy-mg-v140.png`; exact prompt is `public/art/heavy-mg-v140.prompt.txt`. Original PNG SHA256: be363220e1228d5dc65314d6f8901805ef8d315bc4e4f4c5c2de0cef13ff05ed.

The generated image is 1774×887, not the requested 2048×1024. It contains four subtle firing/aiming cels and four distinct receiver/belt-loading cels, not eight mechanically perfect recoil drawings. Faint alpha-1 noise exists in empty gutters; the solid silhouettes remain within measured cells. Alpha is preserved without repainting/cleanup. Integer cuts are x=0/444/887/1330/1774, y=0/444/887. A shared 0.14 scale and measured contact baseline register all cels into 128×96 canvases without per-cel fitting. All visible bottoms are y=92, heads y=51–52 and x-bounds 45–102. No cell-edge silhouette is sampled. Muzzle offsets are measured, consistent with the existing visual-projectile connection.

New kneeling tripod art yields to movement, standing/prone orders, casualties, hit reactions, grenade/treatment work and incomplete stance transitions. Reload cels follow the actual five-second reload timer. It does not invent a tripod-assembly animation; the setup delay is mechanical and uses existing low-pose transitions. Prone firing and movement retain existing specialist art. This is useful additional authored animation, not a claim of completely unique art for every state/unit.

## Verification

- Nine dedicated tests: magazines/escorts; actual setup and burst timings on both sides; invalid readiness/art states; four-shot light burst; real reserve consumption through all four reload cels; bounded covered movement; spatial/full-scan suppression equivalence at boundaries and walls; 900 ticks of posture/rope-frame checks; AI choices including unseen enemies.
- 61 retained v135–v139 checks cover reported stance/climb, building support, explosion/painted smoke, finite deck, grenades, precision/ambush/airborne roles and shop/pack flows. Historical engine suite: 170 passed including three completed seeded battles. One old mixed-weapon fixture now starts the heavy gun already set up; the new tests separately enforce the setup delay.
- Production renderer: 605 rendered frames, 89,982 unit-frame inspections; no command or unexpected ground rope frames. Inspected large-blast snapshot, three-role lineup and all eight new cels. No explosion top strip in the inspected blast. Natural 30-second battle sampled firing cels; the forced one-round belt test separately traversed all reload cels.
- Simulation tick median 1.24ms, p95 2.36ms in this local 30-second scene. Not a browser FPS measurement.
- Changed near-miss query benchmark: 600 units, 3,000 short rays, five runs. Full-scan median 137.22ms; indexed median 28.34ms (~4.8× faster for this query). This does not imply a 4.8× total-game speedup. Spatial queries retain exact radius/depth/terrain/scenery checks and fallback behavior.
- TypeScript and production Pages build pass; 240 gameplay/regression checks in total. The existing large bundle warning remains. Shop/browser layout is unchanged in this release; its interactions were regression-tested, not newly browser-tested in v140.

## Remaining

Broader goal remains active: glider transport/arrival differentiation, further authored actions, other overlapping card groups and wider playstyle/balance trials. Long-fight browser FPS and all terrain combinations are not certified by these samples.
