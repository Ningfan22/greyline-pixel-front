# v138 — a real shooter/observer pair

## Changed behavior

- `sniper` remains two independent rifles, 42 combined base damage per cycle. `sniper_team` now deploys one 52-base-damage rifle and one non-firing ground observer. Existing card IDs, collection copies, rarity, cost and approved flavor text are preserved.
- The precision rifle uses a five-round magazine with a real reload, not the generic 30-round assault-rifle magazine. Its 650 range becomes 880 only with its own live, capable observer within 120. Observation requires a 0.65-second halt. Casualty, surrender, movement, heavy suppression, traversal, casualty treatment, retreat or separation remove the paired benefit.
- The observer follows behind the rifle with a 60/8 movement deadband, holds if orphaned, and still respects player fallback, casualty aid and enemy contact lines. It never takes the air-observer navigation path. It uses existing grounded art, not signal/climb frames. Radio indicators follow actual posture height.
- A ready observer supplies extended vision, existing local artillery spotting, and the existing +25% short-range marksman designation bonus. Smoke, terrain, weather and sensor blindness remain relevant; this is not omniscient targeting.
- Precision rifles prioritize visible, shootable heavy-weapon operators, then enemy rifles of the sniper class, then ordinary infantry. Machine-gun rifle escorts do not receive operator priority. Existing nearby guard protection still applies.
- AI values the precision pair against visible weapon teams. Only a surviving observer is counted as an existing recon asset; the surviving rifle alone cannot suppress a needed scout purchase.

## Verification

- Nine new battle tests: member-specific weapons and actual firing; 18 invalid observer states; 800px firing versus smoke/blindness/loss; operator selection on both sides; following/contact-line safety; orphan holding and explicit retreat; artillery/overwatch role separation; 24 seconds of stance-lock/no-climb checks; five-shot exhaustion/reload and actual 52/65 projectile damage.
- v135/v136/v137 focused regression suite: 35 checks retained. Historical engine suite: **170 checks passed**, including three complete seeded matches.
- Production TypeScript and Pages build pass. Existing large-bundle warning remains; no new dependency or asset payload added.
- Production renderer: 360 rendered frames, 45,360 unit-frame inspections. No unexpected climb frames. Manually inspected large-blast and late-contact snapshots; no atlas-top strip visible. CPU simulation sample median 0.94ms / p95 1.87ms on this machine; these are not browser FPS measurements.
- Browser: v138 visible; locked precision card opens with left card/right description. New longer description fits; no browser error logs.

## Still open

This resolves the sniper/precision pair overlap from the v137 audit, not every card overlap. Ambush/ranger roles, recon-jump/pathfinder roles, light/heavy MG trials and glider arrival differentiation remain. The requested new generated pack-tear animation also remains unfinished; the rejected v137 atlas was not shipped. Further authored individual actions and broader battlefield trials remain part of the active goal.
