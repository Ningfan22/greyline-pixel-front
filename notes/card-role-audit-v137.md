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
