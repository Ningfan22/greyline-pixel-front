# v139 — ambush / airborne roles and painted pack tearing

## Behavior

- Ambush squads need three stationary low-posture seconds to conceal themselves from enemies. Ordinary sight detects them within 180, scouts/ready precision observers within 520, and illumination/recon counters them subject to actual vision. Firing, damage or detection exposes them for eight seconds before preparation can restart. Friendly art is never faded. Prepared ambushers hold fire beyond 300 unless explicitly ordered to attack/rush; the existing 1.8× prepared shot remains real projectile damage. Rangers retain mobile long-range scouting and grenades, without this concealment.
- Pathfinders land into a local watch order and establish a 220px guide zone after a two-second stationary setup. Friendly parachutes inside descend 35% faster; a live guide on landing removes 30 suppression, restores 12 morale (capped) and readies the weapon. Movement, casualties, suppression, retreat, treatment, jam or blackout disable guidance immediately. Explicit squad attack/retreat orders release watch. Recon jump has actual 850 sight but does not guide insertions. Pathfinders have actual 760 sight.
- AI prefers safe ready friendly guides for follow-up drops, ignores jammed guides, and places a new pathfinder team behind the nearest known enemy front rather than between separated hostile groups. Tests include a hidden enemy that must not affect the choice.
- Card IDs, ownership/copy caps, costs, rarities and approved flavor text are preserved. Role rules/details are updated.

## Authored pack asset

- Built-in image generation, one call by an asset-only worker. Original alpha-preserving PNG copied to `public/art/pack-tear-v139.png`; exact prompt is `public/art/pack-tear-v139.prompt.txt`. No CLI fallback, resampling, repainting or alpha cleanup.
- Actual source is 1254×1254, sixteen cels; requested 2048 resolution and requested per-cell margins were not fully delivered. The raw QC is retained in `pack-tear-v139-original-qc.txt`, including faint alpha in gutters. All solid silhouettes fit the measured integer cel bounds. Production uses rounded 313/314px cuts rather than pretending this is a regular 512px atlas.
- Production accepts the usable authored art with a padded 640×480 landscape player. The entire source rectangle—not only opaque bounds—stays inside the canvas throughout lift/tear/settle. Each of sixteen tear cels plays at 24fps; whole-packet lift and settle follow requestAnimationFrame. This is not a claim of 60 distinct painted drawings. No hands or procedural pouch/card-back substitute remains in the animation.
- Real five-card backs appear after tearing; individual/table reveal behavior and ten-pack settlement remain in the existing components. Early skip, reduced motion, asset errors/timeouts and unmount cannot repeat settlement or strand the user in the animation. The purchase artwork is unchanged.

## Verification

- Ten new gameplay tests cover real concealment, counter-spotting, exposure stability, preparation resets, actual 18-damage opening shot, attack override, pathfinder setup/orders, invalid guide states, real descent/recovery and AI placement. Three pack tests cover all sixteen alpha silhouettes, distinct cels, the entire animation's canvas bounds and clear rendered top/side gutters.
- Existing focused v135/v136/v137/v138 suites: 48 checks, covering reported stance/climb, building-pad, explosion/painted-smoke, finite-deck, grenade, precision-role and shop regressions. Historical engine suite: 170 checks, including three complete seeded matches.
- Production renderer: 604 rendered frames, 102,293 unit-frame checks with no unexpected climb frames. Inspected large-blast and late-battle snapshots plus all sixteen pack cels. No explosion top strip or square smoke in inspected samples. CPU simulation median 1.46ms / p95 2.49ms on this machine, not a browser FPS measurement.
- Browser at 1280×720: authored tear visibly fits, five backs appear, one click flips one, table click flips the remainder. Coins and pack counter reflect exactly one settlement per purchase. At 390×844 the animation and result fit the narrow content area; quick skip succeeds. Restored normal viewport. New ambush card detail fits left-card/right-description layout. No browser error/warning logs during these checks.
- TypeScript and production Pages build pass. The existing large JavaScript chunk warning remains. Reduced-motion and image-error/timeout cleanup were source-reviewed, not artificially induced in the browser.

## Remaining work

This is a tested incremental release, not completion of the broader goal. Machinegun/light-MG/heavy-MG tactical trials, glider arrival differentiation, additional authored soldier actions and broader performance/playstyle trials remain open. New role values also need playtesting, not just correctness tests.
