# v162 — complete painted tank wrecks, no black-polygon damage

## Delivered

- Removed the old procedural wreck damage painter and the renderer's random strong darkening, scale, offset and tilt. It drew opaque black polygons into formerly transparent sky and hid surviving armor detail. A previous heavy-tank blast variant contained 3,161 opaque pixels outside the original silhouette and 15,892 almost-black opaque pixels (original: 2,694). The new fallback returns the existing authored wreck unchanged, without generating damage canvases.
- Three complete painted states for each of light, main battle and heavy tanks: penetration damage, displaced blast-damaged turret, burned-out hull. Nine paintings, not seeded rearrangements of one wreck. Other vehicles retain their existing authored wreck; they do not yet all have cause-specific alternatives. Glider keeps its previous separately painted states.
- All three states of each tank use the same scale and registered wheel baseline. Track support matches the live tank footprint. No independent fitting of turret/hull pieces. Rotation follows actual terrain contact only.
- Cause-specific cover contours are derived from the same packed alpha, with empty sky excluded. Four-pixel cells require at least 10/16 pixels at alpha 160 or above; contiguous cells merge into 23–47 rectangles. This is conservative coarse collision geometry, not exact per-pixel physics. Ground-level loose debris is excluded. Mirroring and sloped terrain contact are covered by tests.
- Updated glider runway clearance to consider combined obstruction height instead of individual contour-band height. The existing runway regression caught this integration issue; it was fixed without weakening the test.

## Art provenance and limitations

Three built-in imagegen calls, one per tank model, by an asset-only agent. No retry or external generation CLI. Originals and exact request JSON are preserved as `public/art/{light-tank,main-battle-tank,heavy-tank}-wrecks-v162.{png,prompt.json}`. Runtime loads only `public/art/tank-wreck-frames-v162.png` (494,581 bytes, 1152×576), not the originals. Reproducible registration/packing and collider extraction: `scripts/bake-v162-tank-wrecks.mjs`.

Each original is 1254-square RGBA with genuine transparency. They are not valid equal-third sheets: baselines and row spacing differ, and faint gutter pixels exist. Measured whole-state bounds and shared per-model scale produce isolated 384×192 frames, track center x192 and ground y184. All outer three-pixel borders are clear. Main owner inspected all originals, packed atlas, nine-state plate, other vehicle plate and actual production-render battlefield captures (both facings, forest/mountain/desert terrain).

Generation limitations remain: the penetration wounds are broader than requested; some stowage survives heavy burning; heavy-tank roof collapse is weak; the main tank turret/gun proportions differ slightly from the live reference. These are not claimed as physically exact historical vehicles or final art perfection. There is only one painting per model/cause, so identical causes still repeat.

SHA-256: light original `1445ca02a768bd8c699117f1fc4bf3f793c34074136792e1395a6333a1de1cf0`; main original `ca37a384debda717cc9dd7712e50c115b24e69d29591cc6c87e19816623c74b5`; heavy original `b4d5027c42cd8a54ab598893625ba23b472a55eb6d41b85be5f0d47590827b2f`; packed runtime `d965a74b17c1afba15e8c01bf07f54066c59955bd1e87383caf5a2b3a2ef3523`.

## Verification

- 22 focused tests pass: five new v162 checks, ten existing v141 glider checks, seven v160 tank-doctrine checks. Covers unchanged fallback references/no procedural canvas allocation, authored overrides, border alpha, nine distinct images, collider support in actual opaque pixels, real ray obstruction/clear sky, mirrors, slopes and live/wreck track-span consistency.
- 170 historical gameplay checks pass. Full match outcomes: seed13 red600s916:1000; seed71 blue335.2s1000:0; seed102 blue291.3s1000:0. Seed13 differs from v161's 810:1000 because the new solid wreck geometry affects combat; no card numerical stats changed. This is not a whole-roster balance proof.
- `scripts/qa-v162-wrecks.mjs` rendered 960 frames across four maps and both facings using the production renderer and real vision/known scenery. Rendering does not mutate wreck state, and collider values stay finite. Final review output: `/var/folders/mt/w9779b795sddhd14ddd3ty9r0000gn/T/greyline-v162-wrecks-OPTfWZ`.
- Napi CPU render median1.20ms/p953.38ms/max99.09ms in that workload. Not browser FPS, not a comparative speedup claim; cold spikes remain. Removing the previous painter avoids its hundreds of temporary canvases and per-cause synthetic variants, but complete game memory was not profiled.
- TypeScript and Pages production build pass after the runway integration fix. Active JS820.61kB/gzip278.96kB; existing >500kB bundle advisory remains. Deployed-byte verification is performed after this note is committed.

## Still open

This is a wreck-art/geometry patch, not completion of the overall goal. Remaining work includes moving rifle reload, specialist actions, legacy HE/air effects, overlapping dust density, map-layer seams and the rest of the unit-role audit. Prior posture/grounding/command-frame fixes remain in place but are not re-certified by the wreck tests. The separately documented pre-existing v56 sound-report test failure remains; not every historical suite is claimed green. No browser handoff in this background continuation.
