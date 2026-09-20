# v169 — covered grenade-team role

This slice addresses one actual overlap: assault grenadiers formerly used the
same cluster-throw decision as ordinary assault infantry, with one extra grenade.
It does not claim the whole roster, animation or performance goal is complete.

## Delivered

- Assault grenadiers keep 3 cost, 4 members, 200 total HP, their existing rifles,
  close-assault bonus and 3 hand grenades per soldier. IDs, owned copies, rarity,
  decks, economy, artwork and approved flavor text are unchanged.
- A settled member may throw only under actual recent same-squad rifle fire
  within 120 horizontal / 32 lane distance. The covering member must be healthy,
  settled, have at least 3 rounds, not be reloading/busy/withdrawing, and have a
  current legal firing ray to the observed target. Shared readiness was extracted
  unchanged from the veteran reload drill; veteran behavior is unchanged.
- At most one same-squad throw or grenade flight. The next member waits for the
  previous grenade to resolve; remaining members continue their ordinary rifle
  decisions. No artificial suppression or unlimited ammunition is granted.
- Targets remain observed and 70–220 away. A lone actual MG/mortar/rocket operator
  or unarmored emplacement is eligible, not its rifle escorts or a vehicle.
  Nearby soft enemies can still form a cluster. Known heavy operators are favored
  for selection; AI buying recognizes observed operators, not hidden inventory.
- Friendly proximity still forbids a landing within 55 of a living friendly
  ground unit. New specialist throws trace the real 70px arc against soil and
  scenery before winding up. Only contact within 8px of the intended landing
  point is accepted; live grenades retain normal physical collision.
- Wind-up uses existing 8-cel standing / 16-cel crouching and prone artwork,
  actual 1.1s action, timed release, and consumption at release. No forced stance,
  command gesture, new atlas or additional image download.
- Ordinary assault retains cluster throws and its one-off contact smoke;
  launcher grenadiers retain their separate longer-range weapon/receiver drill.
  An isolated assault grenadier cannot invent cover; it still uses its rifle.

## Verification

- 47 focused checks passed: v169 (8), v136 (9), v149 (8), v151 (7),
  v152 (5), v168 (10). Includes actual both-side firing and grenade flight,
  all standing/low cels, no overlapping throws, exact grenade accounting,
  real grenade damage after previous rifle rounds resolve, smoke/roof/friendly
  safety, retreat, unavailable cover, operator-vs-escort and paid AI selection.
- Generic v136/v149 single-soldier animation fixtures now use ordinary assault
  instead of the newly team-gated card. Their timing, origin, consumption and
  exact posture assertions remain intact. New tests explicitly verify the
  specialist with a full squad, plus its single-survivor restriction.
- Initial new-fixture errors were corrected: a reload needs the real tactical
  reload state (a deadline alone can mean receiver work), and withdrawal uses
  the supported squad order rather than an invalid global order string. No
  gameplay assertions were loosened to accept those errors.
- Native production-render QA: 1,440 frames, 396 actual throw-frame image checks,
  six side/posture drills, no unit-state mutation from rendering, normal sight
  only. First selected throw covers all 8/16 cels, with six real covering shots
  per fixture. Fixture high HP and frozen enemy fire isolate animation.
- Separate 12 actual-HP close encounters: 3 seeds × 2 sides × ordinary assault
  / specialist against a machinegun squad, 30 seconds each. No HP override,
  refills, frozen enemy fire or forced visibility. Ordinary assault spent 3
  grenades with 3 concurrent throwers and 25–26 rifle shots. Specialists spent
  1–2 grenades, never exceeded 1 thrower, and fired 40–52 rifle shots. Specialists
  had 2–3 healthy survivors vs ordinary assault's 5; seed71 retained one enemy
  survivor against specialists. This shows a different resource/fire pattern,
  NOT better balance, higher win rate or universal superiority.
- QA output: `/var/folders/mt/w9779b795sddhd14ddd3ty9r0000gn/T/greyline-v169-grenades-voYeLF`.
  Owner inspected 0-crouch-9, 1-prone-26 and encounter-assault_grenadiers-71-0.
- TypeScript and Pages production build passed. JS 824.44kB / gzip279.99kB;
  existing >500kB build advisory remains. No FPS or speedup claim is made.
- All 170 foundational gameplay checks passed, including three complete seeded
  games: seed13 red victory at337.3s (0:1000), seed71 blue at392.0s (1000:0),
  seed102 blue at287.0s (1000:0). These retain v168's results; they are regression
  coverage, not evidence that the newly specialized card is balanced in all decks.

## Limitations

This is a close-contact specialty, not a new automatic charge into grenade range.
Smoke or a blocked covering rifle ray can stop planned throws even when a lob
might pass; the squad falls back to its existing rifles/movement decisions.
No new movement, terrain, explosions, packs, UI layout or generated art was added.
Wider roster uniqueness, long-match balance, remaining artwork and performance
remain part of the active goal. Background work did not open a browser or claim
device-level browser QA.
