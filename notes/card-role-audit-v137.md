# Card-role audit — v137

This is a targeted audit of reported overlaps, not a claim that all 116 cards have distinct mechanics. IDs and ownership are preserved; approved flavor text is unchanged.

| Group | Verified distinction | Status |
| --- | --- | --- |
| Combat medic / medic team / field hospital | Cheap two-person rescue; mobile three-person stronger rescue; unarmed fixed hospital with setup and longer healing reach | Implemented in v135, engine regressions retained |
| Ground anti-armor / airborne anti-armor | One RPG + three escorts versus two launchers + two escorts with insertion and shorter rocket reach | Implemented and shot-tested in v136 |
| Engineers / mechanics / assault sappers / armored mine clearer | Cheap fragile close mine clearance; actual vehicle repair; blast-resistant clearance; armored longer-reach faster clearance | Behaviors exist; v137 corrects card-face rules that still described removed low walls and hid mechanics' repair role |
| Supply / forage | Paid draw-two versus free draw-one cycle | Implemented v135; finite piles remain finite |
| Flare / illumination round | Cheaper narrow longer light versus wider shorter light | Implemented v135 |
| Ambush squad / rangers | Same 1.8× prepared opening-shot mechanic, different cost, observation, grenades and squad size | Still overlaps. v137 fixes false “double damage” text, **not** a new mechanic |
| Sniper / precision marksmen | Mostly range, damage, cost and health changes | Still needs a meaningful role split; do not market numeric upgrades as a resolved duplicate |
| Recon jump / pathfinders | Both scout-trait insertions; different weapon/range and ambush | Landing-zone language is not a separate implemented beacon system; needs design and battle verification |
| Machinegun squad / light MG / heavy MG | Member-specific gunner and rifle escorts already work | Need side-by-side tactical trials; do not equate changed squad size alone with a new playstyle |
| Glider assault | Elite insertion uses existing airborne machinery | Visual/arrival differentiation still needs work; current description overstates distinct transport behavior |

Next differentiation should change an actual decision (spotting versus shooting, prepared defense versus mobile escort, safe insertion versus risky immediate contact). It must be tested in the engine, not only renamed on the card face. Existing collections must not lose copies when roles change.

## Follow-up in v138

The sniper/precision overlap is now implemented as dual rifles versus a rifle/observer pair. See `v138-verification.md` for loss-of-observer behavior, targeting, real shot/reload tests and remaining overlaps. Other unresolved rows above have not been silently marked complete.

## Follow-up in v139

Ambush/ranger overlap now has an actual defensive-concealment versus mobile-recon split. Concealment has preparation, exposure memory and real spotting counters; it never fades friendly art. Pathfinders now establish stationary landing guidance, while recon jump supplies cheaper forward sight without guidance. AI uses safe known friendly beacons and inserts pathfinders behind the nearest known enemy front. See `v139-verification.md` and the real shot/drop/AI tests. MG side-by-side trials and glider transport differentiation remain open.

## Follow-up in v140

Machinegun roles now have actual different firing/movement decisions: the five-person base squad retains continuous fire and four escorts; the two-person light team fires four-round bursts and may bound at most 24px during the pause under nearby actual friendly fire; the three-person heavy team needs 2.4s stationary low-posture setup and uses eight-round bursts plus stronger real near-miss pressure. Movement restarts setup, normal stance commitments still apply, and no imaginary through-cover suppression aura was introduced. Real gunner magazines/reload times, dedicated painted heavy-gun cels and AI selection were verified. See `v140-verification.md`. Glider arrival differentiation, other unreviewed cards and gameplay balance are still open.

## Follow-up in v141

Glider assault now actually flies in an unarmed 180-HP transport, rolls to a stop and unloads four existing elite soldiers sequentially. It needs a clear runway and descent; AA can destroy the occupied hull in flight, and rifles can kill it during unloading. Remaining passengers are then lost. An empty intact hull remains as cover, with no fuel explosion, rotor sound or return card. This differs from guide-accelerated parachutists and hovering/rappelling helicopter insertion. Collectible ID, cost, rarity, copies and flavor are preserved. The runtime transport is not a new collectible.

Generated art has two closed-flight cels, a touchdown cel, one clean open-door cel and two separately painted wreck silhouettes. The generation did **not** deliver a clean high-frame-count opening sequence: two later opening cels have unwanted damage and are excluded from healthy unloading. See `v141-verification.md` for exact limits, physical map changes and tests. This completes this targeted transport role split, not the wider 116-card balance/duplication audit.

## Follow-up in v155

Touchdown no longer grants the rapid card's eight-second sprint to all parachutists/rope passengers. Recon jump lands into stationary observation and needs an explicit order to leave; pathfinders retain guidance; rapid insertion alone fills its fast landing/advance role among these direct drops; airborne AT retains its launcher role. AI reserve/recon drops stay on the friendly side of observed contacts, and urgent airborne AT selection preserves its validated landing guide. These are actual engine decisions, with ten new tests documented in `v155-verification.md`, not just renamed card text. Wider card balance and unfinished artwork remain open.

## Follow-up in v158

Foot mortar crews now sustain at least two own rounds at a position before responding to a mature sound fix; one squadmate's first shell cannot trigger their relocation. The mortar carrier instead uses its first real shot to plan a bounded rearward change of firing position, keeps its hull facing the enemy, waits for recoil and a stable stop, respects hold/local withdrawal and retains normal sight/range requirements. The AI prefers mobile artillery against observed guns/fresh own sound reports, and denser foot mortar fire against infantry alone. Same card IDs, copy limits, prices, combat stats and flavor. See `v158-verification.md` for paired delayed-strike trials and the explicitly retained old sound-report test failure. Other unreviewed vehicle/card roles and broader balance remain open.
