# v171 — stale contact expiry and quiet-front push

This slice fixes the two 600s draw root causes recorded in v170's "Known
limits": seed 13's surviving armor permanently stopped at a remembered contact
line after the enemy disappeared, and seed 71's AI wiping the enemy yet never
marching on the base. Both matches now end in a real victory.

## Delivered

- `CONTACT_STALE_S = 60` and `contactIsStale(time, c)` in `game/world.ts`.
  Expiry is purely time-based — hidden enemy motion, death or removal must
  never clear or update a record (that would leak information), so a snapshot
  older than 60s simply stops being trusted as a hard barrier. The threshold
  exceeds the 30s memory contract enforced by the v168 tests.
- `contactSafeX` (`game/engine.ts`) skips stale contacts in its movement
  barrier loop. Units probe forward past an expired snapshot and either
  reacquire the threat (a fresh report re-blocks the line) or clear the
  sector through the existing confirmation path.
- `unclearedFront` (AI commander) filters out stale contacts, so an expired
  report no longer counts as an uncleared front when choosing a stance.
- AI quiet-front forced push in `updateAI`: `frontQuiet` is true only when
  there is no visible foe AND no fresh remembered contact. While quiet, the
  staging window can no longer refresh into a permanent `hold` — survivors
  (including a lone scout squad, which counts as zero cohorts and otherwise
  made `staging` true every frame) switch to `rush` and advance on the enemy
  base. A fresh uncleared contact still keeps the AI holding.

## Verification

- New `tests/v171-stale-contact-push.test.mjs` — 4/4 passed:
  1. A contact older than `CONTACT_STALE_S` releases the movement block while
     a fresh snapshot still holds the line.
  2. AI switches to `rush` when the front is quiet (no visible foe, no fresh
     contact).
  3. AI keeps `hold` while a fresh remembered contact is uncleared, even with
     no visible enemy.
  4. AI rushes once the only remembered contact goes stale, even if the enemy
     was never confirmed cleared.
- `tests/v168-contact-memory.test.mjs` — 10/10 passed (no regression: fresh
  contacts still block at 30s, hidden motion/death still cannot clear a
  record, observed defeat still releases the line).
- `tests/engine.test.mjs` — all 170 foundational gameplay checks passed,
  including the three seeded full matches:
  - seed 13: blue victory at 372.5s (1000:0) — was a 600s draw.
  - seed 71: blue victory at 242.4s (1000:0) — was a 600s draw.
  - seed 102: red victory at 207.0s (0:1000) — unchanged, no regression.
- TypeScript `tsc --noEmit`: zero errors in `game/` (the 86 reported errors
  are all in `output/v23-qa/engine-working-before.ts`, a standalone v23 QA
  snapshot whose relative imports do not resolve in that directory; it is
  untouched by this slice and was already failing before it).

## Known limits / next work

The 60s stale window is a fixed trust horizon, not a learned one: a patient
defender who stays hidden for 60s can still bait a probe, and a unit probing
past an expired snapshot may walk into an ambush it would have avoided with
permanent memory. The trade-off is deliberate — permanent memory is what
produced the seed 13 deadlock — but a future slice could scale the window
with unit type or re-confirm faster with scouts. No animation, rendering,
card, pricing or save-format changes were made here.
