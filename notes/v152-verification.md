# v152 — 榴弹支援组：真实低弧开火许可与独立武器动作

## Scope

- Grenadiers already fired grenade ammunition with a 70px parabola, but targeting and final launch permission incorrectly checked a straight ray. Both now follow the same parabola as live unguided rounds. Soil, ascent scenery, roofs and descending obstructions still collide normally. No mortar privileges or new smoke/hidden-target privilege.
- Preserved the barrel-to-muzzle soil check, actual visibility, range, damage, rate, costs, card identity, collection, currency, caps and approved flavor. Only the explanatory rule/detail changed.
- Grenadiers have their own compact break-action launcher, not the RPG role. Stationary standing/kneeling loading follows the actual discharged-round cooldown, including supply/recon rate scaling. Rendering cannot restart or advance that clock.
- Own whole-body stand/knee/prone transitions use the existing 1.2s segment/10s posture gate. Moving poses retain the established authored-leg specialist composition, not a newly generated locomotion cycle.

## Built-in imagegen and asset registration

Two distinct assets, one built-in call each, no retries, CLI, or painted-in code replacements:

- `public/art/grenade-launcher-v152.png` (unchanged original 1774×887) and `public/art/grenade-launcher-v152.prompt.json` (exact submitted prompt).
- `public/art/grenade-launcher-stance-v152.png` (unchanged original 2172×724) and `public/art/grenade-launcher-stance-v152.prompt.json` (exact submitted prompt).
- Runtime: `public/art/grenade-launcher-frames-v152.png`, 2048×192, 105,740 bytes. It packs 26 selected authored whole bodies into 32 timeline slots; knee/prone seam holds are repeats, **not extra unique artwork**.
- First sheet: selected 16 complete standing/kneeling cels. Rejected prone loading because several barrels penetrate the foot/ground baseline.
- Second sheet: selected four upper and six lower transition bodies; excluded the crowded final right-edge pose. Original alpha connected components separate neighboring figures in overlapping rectangular crops. One fixed scale per anatomical row; planted-foot anchors, not per-cel size fitting.
- Production load decodes the 106KB prepared atlas, not the 2,521,715 bytes of original images or component extraction. Sources remain versioned for reproducibility.

## Verification

- 173 focused regression tests (v135–v152), all passed.
- 170 historical gameplay checks, all passed. Includes full matches: seed13 draw at600s (1000:1000), seed71 blue at267.5s, seed102 blue at309.5s.
- New real engine tests: both sides fire over a 34px bank and actually damage the target; rockets still fail the straight ray; high soil/roof/descent obstructions block the grenade; smoke, hidden targets and a blocked muzzle do not gain permission. A discharged round runs one complete drill and yields to movement, transition, casualty and authored work.
- Production renderer: 1,720 frames, both sides, standing/kneeling cycles, prone firing, all six directed posture transitions. All selected source images actually drawn; render reads leave unit state unchanged. Eight cycle cels observed in each upright/kneeling drill. Ground baseline95 in every packed cel; adjacent transition height steps ≤7px; no cropped limbs/barrels.
- Inspected original sheets, packed contact sheet and production battle captures. QA artifacts: `/var/folders/mt/w9779b795sddhd14ddd3ty9r0000gn/T/greyline-v152-grenadiers-Th874m`.
- Non-browser warm microbenchmark: 20,000 grenade path checks on seed152 terrain/scenery, 2.27µs/check on this host. This is not a browser FPS or low-end-device performance claim.

## Deliberately incomplete

Prone loading is not newly animated; it keeps a complete grounded launcher aim body instead of shipping the invalid loading cels. Moving reloads and broader unit/effect quality remain ongoing goal work. No claim that this bounded update resolves every screenshot report. Background continuation: no browser preview or browser interaction QA.
