# v163 — prone idle posture stays grounded

## Reproduced defects and fix

Three new regression cases failed against v162 before the patch:

- A stationary prone rifleman's idle decoration returned legacy radio/crawl actions3/12. Production-loaded art measured 23–25px tall versus the settled prone body's17px; it jumped between different poses without going through the ten-second stance gate.
- Scouts and the sniper-team observer separately chose the old raised radio body for1.2s of every4.4s. For scouts the action also bypassed the normal specialist weapon image. Removed this periodic override; observation gameplay remains unchanged.
- A prone blast/trace glance mirrored the entire soldier and rifle instantly while real facing remained unchanged. Prone visual glances now retain real facing. Actual simulation-directed turns and upright/knee glances are unchanged.

Idle observation now uses eight newly painted, grounded prone cels (0.6s each,4.8s loop, offset by unit identity). They yield to movement, aiming/fire, reload, grenades, treatment, digging, hauling, posture transitions, terrain motion, injury, surrender and descent. Healthy stationary bodies cannot borrow crawl/rope cels. Real crawling still selects its movement cels; it was not disabled to make an idle test pass.

No simulation, AI, damage, muzzle/collision data, stance cooldown, cards, economy, rarity or approved copy changed. No claim to fix every remaining animation jump: the old two-cel moving crawl still needs a richer authored cycle, and standing turns/moving rifle reload remain open.

## Art and review

One built-in imagegen call by an asset-only agent, no retries or CLI. Reference: final prone drawing in `public/art/infantry-stance-v142.png`. Original saved unchanged at `public/art/prone-watch-v163.png`; exact submitted request at `public/art/prone-watch-v163.prompt.json`. Packed game asset: `public/art/prone-watch-frames-v163.png`. Baker: `scripts/bake-v163-prone-watch.mjs`.

Original1536×1024 RGBA has genuine partial alpha and64.95% fully transparent pixels. Requested2×4 equal cells were not honored: the first three row bottoms cross nominal boundaries by9–19px, and there are faint gutter pixels. Therefore the baker uses measured whole-figure crops, one shared0.095 scale and registered row baselines, not equal slicing, anatomy fitting, repainting or body-part assembly. Eight final96-square cels have strong-alpha bottom y95 and height16–17px; their unused top/side margins are clear. Source subtle head/cloth changes and partial alpha are retained. This is eight subtle drawings, not60 unique painted frames per second or a full radio drill. There is small texture variation and the loop is understated at gameplay scale.

Main owner inspected original, runtime strip, before-fix legacy pose plate, both-facing production battle captures and a cycle contact sheet. Source SHA256 `adcaa93553853255d269cc009e18204f9a56a33cf800929aef4a0aea7169d002`. Packed17513-byte runtime SHA256 `ea185a8f525baa5ec94db5dd1172735d6fc5a880f6d710659f41a2472659043f`.

## Verification

- 97 focused tests pass across v135/142/143/144/148/149/150/154/156/157 and five new v163 cases. Includes eight distinct pixel hashes, fixed contact/height, no old stationary crawl selection, full-body flip exclusion, busy-action precedence and render-read purity. Existing unit tests requiring command-image downloads to remain absent also pass with actual art loading.
- Eight v147 weapon-stance checks also pass; specialist weapon art remains separate from ordinary rifle observation.
- 170 historical gameplay checks pass after the selector fix. Full matches unchanged from v162: seed13 red600s916:1000; seed71 blue335.2s1000:0; seed102 blue291.3s1000:0. Later art-only wiring is covered by the focused and renderer checks.
- Production-renderer diagnostic:720 frames /4,320 expected body draws, six unit types and both facings, all eight new cels exercised; no unit mutation. Uses actual friendly visibility/known terrain without a visibility override. Specialist scouts retain their own19px weapon body; ordinary prone idle remains16–17px. Final QA: `/var/folders/mt/w9779b795sddhd14ddd3ty9r0000gn/T/greyline-v163-idle-Q0LASW`.
- TypeScript and Pages production build pass. Active JS820.90kB/gzip279.02kB; existing >500kB bundle advisory remains. Exact deployed-byte checks follow this note. One small packed asset and eight shared cached canvases are added; no per-frame asset creation or body compositing, and no browser-FPS improvement claim.

## Remaining scope

Not a whole-goal completion. Moving crawl, moving rifle reload, specialist work, broader roster differentiation, legacy HE/air effects, overlapping dust, map-layer seams and device performance still need work. The existing v56 sound-report discrepancy and older superseded decorative-pose expectations are not certified by this scoped run. No user-facing browser handoff in this background continuation.
