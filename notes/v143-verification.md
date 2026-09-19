# v143 — real magazine clocks and grounded reload cels

## Changes

- Removed the old per-shot cosmetic `reloadingUntil` clock. An ordinary rifle shot used to restart a whole-body magazine drill during 55% of every firing cooldown, despite a nonempty magazine. Dry magazines, tactical top-ups, sharing and scavenging still use their actual reload clocks and reserve ammunition.
- A shared `magazineReloadActive` predicate separates magazine work from a stale cooldown. Actual magazine replacement still finishes before a new posture transition.
- Eight authored kneeling and eight prone cels follow that real clock. No alternating kneel/crawl, command or rope cels. A receiving soldier's handoff/scavenge flag and a scout's radio decoration cannot cover this stationary drill. Heavy weapons keep their weapon body; the heavy MG retains its dedicated belt animation.
- Whole-body reload, grenade, hit and stance cels own rendering: decorative digging, specialist torsos, idle and breathing cannot overwrite them.
- Fixed a missed lateral path: the formation-lane offset now waits for a committed posture transition, just like forward movement. No movement or retreat is frozen just to display a reload.

## Art and limits

Built-in imagegen, one call. Original 1254×1254 RGBA copied unchanged to `public/art/infantry-reload-v143.png`; exact submitted prompt is `public/art/infantry-reload-v143.prompt.txt`. SHA-256 `7836f8343b4450baca98bf429a299ecefadc49e866e68000a9dd0cc2d3e0990f`. Original alpha preserved. No retry, repaint, or per-frame stretching.

Generated rows did not obey equal grid boundaries. Sixteen measured integer rectangles include two-pixel antialias padding, with fixed .166 knee / .18 prone scales and a registered ground baseline. These are separate calibrated pose groups, not proof of perfectly consistent generated anatomy. Runtime knee heights are 42–43px (stable knee 43px), prone 17px (stable prone 17px); strong-alpha bottoms remain y95. Neighbor rows cannot leak into these crops. Contact-sheet entry/exit inspected.

Some hand/magazine beats are subtle or ambiguous and the first/last drawings are not pixel-identical to the held posture. This is eight timeline cels per pose, not eight equally strong changes or 60 unique drawings per second. Four uniform palettes still share the new anatomy.

## Verification

- 97 focused tests pass. Seven new cases cover real shots without fake reloads on both sides/all three heights; all eight empty-magazine beats and exact reserve refill; receiver/observer priority; tactical top-ups versus stale clocks; heavy-gun weapon ownership; moving retreat; and planted lateral formation motion.
- 170 historical gameplay checks pass, including three full seeded matches: 13 at 403.7s, 71 at 301.2s, 102 at 269.6s. Removing a spurious stance-blocking clock changes deterministic battle outcomes, but no card stats or economy rules were edited.
- Production renderer: 900 frames / 5,400 verified body draw calls, both factions, three heights and six infantry identities/roles with competing digging/handoff flags. Inspected knee/prone contact sheet and in-scene captures. This is local renderer QA, not browser/device FPS measurement.
- Type check and Pages build pass. Existing >500kB bundle warning remains.
- Original prompt is byte-identical to the generation handoff; image checksum matches the untouched original.

## Still open

- Legacy crouch-walk cels measure 52–53px versus the 43px static knee. Move↔stop needs an authored, simulation-owned transition; this release does not claim that height jump is solved.
- Moving reloads retain their gait, so their hand drill is not yet visible. Do not freeze retreat or slide a stationary body to hide that limitation.
- Low grenade/treatment and weapon-specific reload gear still need richer authored work. Several troop identities share anatomy, even when gameplay roles differ.
- Earlier explosion/map/pack/card-role fixes remain unchanged. This release does not claim every screenshot defect or repeated-looking unit is finished. No ownership, rarity, copy limits, collection IDs, card prices or flavor text changed.
