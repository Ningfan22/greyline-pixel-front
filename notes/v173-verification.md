# v173 — wreck-blocked base engagement and overrun prevention

This slice fixes the seed-10 stalemate discovered during the v172 regression
scan: blue units overran the red base, got clamped at the map edge (x=55),
and a destroyed red sam_vehicle wreck blocked the base firing trajectory —
trapping the units in a permanent idle loop with no target and no movement.

## Root cause

Three conditions combined to produce the deadlock:

1. **Units overran the enemy base.** Blue (side=1) pushes right-to-left;
   the red base sits at x=70. Infantry and vehicle movement both clamp to
   `[55, W-55]`, so units that reached the base kept sliding past it and
   pinned against the x=55 edge clamp.
2. **A wreck blocked the base shot.** A destroyed red sam_vehicle spawned a
   wreck at x≈55 with a 180px-wide hull obstacle part (normalized
   `[0.027, 0.715, 0.852, 0.125]`). Its collision box spanned roughly
   x=-35 to x=145, intercepting every round fired at the base from any
   position within that footprint.
3. **`baseInRange` required a clear trajectory.** The base-engagement check
   called `firingHeight(s, u, baseX, …)` unconditionally. With the wreck
   intercepting the ray, `firingHeight` returned null, `baseInRange` was
   false, and the unit fell through to the movement branch — which could
   not move because of the edge clamp. Permanent stalemate.

## Delivered

- **Close-range base engagement exemption** (`baseInRange`, `game/engine.ts`):
  when the unit is within 60px of the enemy base, the `firingHeight` obstacle
  check is skipped. Assault troops that have closed to point-blank range can
  engage the structure directly; nearby wrecks, rubble, and low obstacles no
  longer block the shot. The 60px window is wide enough to cover the 35px
  stop line (below) with margin for muzzle offset and stance variation.

- **Base stop line** (`contactSafeX`, `game/engine.ts`): ground units halt
  35px short of the enemy base instead of overrunning it. The stop is applied
  as a forward-movement limit only — retreat and repositioning are unaffected.
  This keeps the base within the 60px exemption window so the unit can always
  fire from the stop line, and prevents the edge-clamp trap that started the
  seed-10 deadlock.

- **Withdraw standby timeout** (`continueHeavyWithdrawal`, `game/engine.ts`):
  a heavy-weapons squad pinned in `withdrawStandby` for more than 30 seconds
  clears its withdrawal state and resumes the advance. Previously, side-level
  vision (`visibleToSide`) kept the threat "seen" via a distant spotter even
  when the squad itself could not engage it, so the standby condition never
  expired. The 30s threshold matches the v172 stalemate-break window.

## Military rationale

Infantry and vehicles that have closed to within 60px of an enemy structure
are already inside hand-grenade and satchel-charge range. Requiring a clear
ballistic trajectory at that distance is unrealistic — the squad would
simply engage the building directly with direct-fire weapons, demolitions,
or by shooting through gaps in the rubble. The base stop line reflects the
doctrinal practice of halting short of the objective to consolidate before
the final assault, rather than piling onto the position and losing
cohesion.

## Verification

- TypeScript `tsc --noEmit`: zero errors in `game/`.
- `tests/engine.test.mjs` — all 170 foundational gameplay checks passed.
- Seed 10: **blue victory at 496.6s (382:0) — was a 600s draw, now fixed.**
- Seeds 1-20 regression: all finish with decisive results, no draws:
  - seed 1: red victory at 401.4s (0:1000)
  - seed 2: blue victory at 356.2s (1000:0)
  - seed 3: blue victory at 410.8s (1000:0)
  - seed 4: red victory at 571.1s (0:1000)
  - seed 5: blue victory at 272.4s (1000:0)
  - seed 6: blue victory at 330.5s (1000:0)
  - seed 7: red victory at 371.6s (0:1000)
  - seed 8: red victory at 106.3s (0:1000)
  - seed 9: red victory at 99.5s (0:1000)
  - seed 10: blue victory at 496.6s (382:0)
  - seed 11: red victory at 133.7s (0:1000)
  - seed 12: blue victory at 249.7s (1000:0)
  - seed 13: blue victory at 253.5s (1000:0)
  - seed 14: blue victory at 280.9s (1000:0)
  - seed 15: blue victory at 422.0s (1000:0)
  - seed 16: blue victory at 248.8s (1000:0)
  - seed 17: blue victory at 213.2s (1000:0)
  - seed 18: blue victory at 163.7s (1000:0)
  - seed 19: red victory at 206.2s (0:1000)
  - seed 20: blue victory at 469.6s (1000:0)

### Extended scan (seeds 21-60)

A broader regression run covering seeds 21-60 (40 seeds) confirms no new
stalemates or draws:

- All 40 seeds finish with decisive results (0 or 1, no draws).
- 170 gameplay checks passed in the same run.
- Three seeds (29, 32, 46) reach the 600.0s deadline but resolve as
  legitimate HP-comparison victories (red 1000 vs blue 238/140/572), not
  draws — the game's time-limit HP rule is working as designed.

### Known draw seeds (71, 84) — no regression

- seed 71: blue victory at 214.7s (1000:0) — unchanged from v172.
- seed 84: blue victory at 262.0s (1000:0) — unchanged from v172.

## Known limits

- The 60px exemption is a fixed distance, not scaled to weapon type. A
  long-range howitzer at 55px would also skip the obstacle check, though in
  practice howitzers rarely close to that distance and the v172 stalemate
  break would handle any edge case.
- The base stop line (35px) is a single value for all unit types. Vehicles
  with a wider turn radius may need a slightly longer stop, but the 60px
  exemption window provides enough margin.
- The withdraw standby timeout (30s) is a fixed threshold. A squad under
  genuine artillery fire might resume the advance prematurely, but the
  withdrawal logic re-evaluates on next contact and will re-withdraw if the
  threat is still active.
