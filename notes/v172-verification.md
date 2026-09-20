# v172 — stalemate break for terrain-blocked firefights

This slice fixes the last remaining 600s draw recorded in
`notes/v171-verification.md`: seed 7, where a lone blue scout squad (hp 0.27,
nearly dry) sat in a crater at x=820 under cover 0.90, invulnerable to 15 red
units because the crater lip intercepted every round (`terrainIntercept`).
The red units could not advance (target lock / blockedContact held the
movement gate shut) and the scout did not run dry until t=605 — five seconds
after the 600s draw deadline.

## Root cause

Two distinct stalemate modes, both invisible to the v171 fixes:

1. **Ineffective fire with a valid target.** The unit *can* acquire the
   target (`firingHeight` returns non-null) but terrain intercepts the
   projectiles. The unit burns its clock shooting at an unwinnable angle.
2. **Blocked contact with no target.** The crater lip blocks the firing ray
   entirely, so `firingHeight` returns null and the unit has no `target`.
   It does have a `threat` (ground contact), which triggers `blockedContact`
   — a drill that searches for a nearby firing position. When no position
   exists and the unit is inside the 140px standoff, the drill gives up and
   the unit freezes. This is the mode that actually trapped seed 7: the red
   lead at x=961 was 141px from the scout, just 1px inside the standoff, so
   `available = 141 - 140 = 1 ≤ 4` and no `firingGoal` was ever set.

## Delivered

- `STALEMATE_BREAK_S = 35` and `STALEMATE_CLOSE_GAP = 30` constants in
  `game/engine.ts`.
- Five new `Unit` fields: `stalemateTargetUid`, `stalemateTargetHp`,
  `stalemateSince`, `stalemateStartX`, `stalemateCloseUntil`.
- **Stalemate detection** (two branches, after `fireCoax`, before the firing
  gate):
  - *Target branch:* the unit has a valid target within 62% of weapon range
    but the target's hp has not dropped by ≥0.01 in 35s. When the distance
    exceeds 30px the unit is flagged `stalemated`.
  - *Blocked-contact branch:* the unit has a `threat` but no `target`
    (`blockedContact` is true) and this has persisted for 35s. Same 30px
    distance check before flagging.
  - In both branches `stalemateCloseUntil = s.time + 2` keeps the reduced
    `contactSafeX` gap alive while the unit maneuvers.
- **Firing gate** now includes `!stalemated` — a stalemated unit stops
  wasting ammunition and chooses the movement branch instead.
- **Movement gate** relaxed in two places:
  - `(!target || breachRun)` → `(!target || breachRun || stalemated)`
  - `!blockedContact` → `(!blockedContact || stalemated)`
- **`contactSafeX`** uses a 30px gap (instead of 105px infantry / 150px
  vehicle) while `stalemateCloseUntil` is active, so the maneuvering unit can
  close to point-blank range where the flatter trajectory clears the terrain
  lip. The 2-second window prevents oscillation when the unit stops to try
  firing from the new angle.

## Military rationale

When fire cannot dislodge a dug-in defender from a defilade position, the
doctrinal answer is fire-and-movement: suppress while a element maneuvers to
an oblique angle that defeats the terrain cover. The 35-second threshold
matches the time a real squad leader would wait before concluding that
direct fire is ineffective and ordering a bound.

## Verification

- TypeScript `tsc --noEmit`: zero errors in `game/`.
- `tests/engine.test.mjs` — all 170 foundational gameplay checks passed,
  including the three seeded full matches:
  - seed 1: red victory at 401.4s (0:1000) — was fixed by v171, no regression.
  - seed 7: **red victory at 371.6s (0:1000) — was a 600s draw, now fixed.**
  - seed 84: blue victory at 262.0s (1000:0) — was fixed by v171, no regression.
- Diagnostic trace (seed 7): at t=300 the blue scout is still alive at
  x=820 (hp 17, cover 0.90); by t=350 blue has zero units — the red
  stalemate break maneuvered close enough to clear the crater lip and
  destroyed the scout. Red then rushed the base, winning at 371.6s.

### Combined v171+v172 regression run (all five known draw seeds)

A single `MATCH_SEEDS='1,7,13,71,84'` run of `tests/engine.test.mjs` after
both slices were merged, confirming no cross-slice regression:

- seed 1: red victory at 401.4s (0:1000)
- seed 7: red victory at 371.6s (0:1000)
- seed 13: blue victory at 253.5s (1000:0)
- seed 71: blue victory at 214.7s (1000:0)
- seed 84: blue victory at 262.0s (1000:0)

All 170 gameplay checks passed in the same run. Every previously recorded
600s draw seed now ends in a real victory; seeds 13 and 71 also finish
faster than in the v171-only run (253.5s vs 372.5s, 214.7s vs 242.4s),
consistent with the stalemate break shortening late-game holds.

## Known limits

- If a stalemated unit closes to 30px and the terrain *still* blocks the
  shot (e.g. an unusually deep crater), the unit will hold at 30px and
  continue the stalemate. In practice the 30px gap is close enough that the
  trajectory is nearly flat and clears most crater lips; seed 7 confirms
  this. A future slice could add a "pass through" maneuver if the 30px
  attempt also fails.
- The detection is per-unit, not per-squad. Two squads in the same
  stalemate will each independently start their 35s clock, so the break is
  not coordinated. This is acceptable for the current draw cases but could
  be refined with a squad-level signal.
