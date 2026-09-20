# v159 — grounded prone grenade-launcher loading

## Delivered scope

- Eight newly generated whole-body prone cels for grenadiers; actual discharge drives one loading cycle. No command/climbing cels, wall-clock loops, rifle magazine replacement, body-part assembly or per-cel anatomical resizing.
- One shared settled-body/occupied-hands guard pauses unfinished launcher work through motion, posture changes, casualties, digging, treatment and carrying. Firing also checks remaining launcher work, so expired ordinary cooldown cannot provide a free loaded round. A completed rifle reload while retreating remains unchanged.
- Existing 1.2s-per-height posture transitions and 10s stance commitments retain precedence. Grenadier prone transition endpoint now uses the same ready image as settled idle/loading. Ballistic muzzle data follows the measured new painted muzzle.
- Standing/kneeling cels, damage/range/rate/card economy/flavor/collection remain unchanged. Rocket operators are not assigned grenade-launcher art.

## Artwork and honest limitations

- Exactly one built-in imagegen request via one asset-only agent. Unchanged RGBA original: `public/art/prone-launcher-v159.png`, 1448×1086, SHA256 `958c810a0e2aa534e3ca8b4516324aba5310be27d4d2ceb1098f9e59c8b7cef4`. Exact arguments/prompt: `public/art/prone-launcher-v159.prompt.json`.
- Source QA correctly rejected **direct equal-grid integration**: irregular baselines/gutters, last aimed pose not identical to the first, close-barrel stage incomplete, recoil subtle. Main owner inspected original personally. All eight whole figures are complete, separated and above their actual ground line; measured crop rectangles and hip/ground anchors resolve registration without repainting anatomy.
- Baker uses one .12 scale for every new cel. The resulting eight silhouettes share baseline95; heights21–24px, all limbs/barrels inside 128×96 with generous horizontal margins. Hand/pouch/round stages remain distinct; cel6 is a closing hand pose with barrel still open, followed by a closed aimed cel7, not a finely sampled hinge animation. Final aim is similar, not pixel-identical to the initial pose. No claim of eight perfectly registered raw source frames.
- Runtime loads only `grenade-launcher-frames-v159.png` (136,321 bytes), replacing the 105,740-byte v152 packed atlas. Eight additional prepared canvases; no per-render cropping/component extraction. Original large art is not requested by production load.

## Verification

- 28 focused tests passed (v147, v152, v153, v154, v159), including actual injured/recovered launcher, stance interruption past cooldown, both sides, role isolation, 1,760 specialist-origin comparisons, and existing moving rifle reload.
- All 170 historical gameplay checks passed again after final art/muzzle integration. Full matches: seed13 red at600s810:1000; seed71 blue335.2s1000:0; seed102 blue291.3s1000:0.
- Production load/render diagnostics: 1,140 frames, both sides × standing/kneeling/prone, eight cycle indices per actual discharge, no renderer state mutation and every expected prepared image actually drawn. Does not override enemy visibility. Main owner inspected packed cels, lowering seam and two battle captures.
- Final QA output `/var/folders/mt/w9779b795sddhd14ddd3ty9r0000gn/T/greyline-v159-prone-launcher-5bEPLk` (`report.json`, `prone-cels.png`, both-facing battle frames).
- TypeScript and Pages build passed. Existing >500kB JS advisory remains. No browser FPS or low-end-device performance claim. Background task: no browser preview or interaction testing.

## Remaining goal work

This closes the v152 prone-grenadier gap only. Moving rifle reload art, dedicated rocket/other specialist loading, broader repetitive unit roles and final whole-goal visual/gameplay audit remain incomplete. The previously documented v56 sound-report expectation failure was not changed or retested by this scoped work; not a claim that every historical suite is green.
