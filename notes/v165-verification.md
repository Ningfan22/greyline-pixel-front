# v165 — separate authored HE, grenade and air-burst sequences

## Scope and implementation

Replaced the remaining production HE/grenade/air paths that cut and keyed the old touching-plume sheets. Each now uses its own sixteen complete, isolated, painted drawings. HE is a low ochre dust crown with a brief core; grenade is compact pale gray dust; airborne flak is a centered radial charcoal puff without a ground base. Fuel/wreck and earth/artillery keep their existing v145 paintings and exact registered pixels.

Five prepacked 576×640 RGBA sheets supply 144×160 cels. The loader no longer downloads `explosions-v12.png`, `explosions-v13.png`, `fuel-blast-v145.png` or `earth-blast-v145.png`. Their combined 6,250,470 runtime download bytes are replaced by 867,170 bytes: 5,383,300 fewer bytes (86.1%) for these explosion assets, not for the entire game. Compatibility fields reference the same new canvases rather than decoding the legacy sheets. Original source art is retained. Penetration still uses the existing v9 spark sequence.

Only asset loading/selection and the authored air origin changed. Damage, collision, explosion lifetime, terrain destruction and card rules are unchanged. Existing quarter-step blend caching remains; this patch does not claim a browser-frame-rate improvement.

## Generation and registration

Mode: built-in imagegen, three calls, no retries/variants/CLI generation. Exact prompts and submitted arguments: [blasts-v165.prompts.json](../public/art/blasts-v165.prompts.json).

Originals saved unchanged:

- [HE](../public/art/he-blast-v165.png), SHA256 `47ae785e7827ef7e54fd0498a43d10e249278d30abaeeb0345d87bf700a7c585`.
- [Grenade](../public/art/grenade-blast-v165.png), SHA256 `0d3c3c92f418afa79b305e96d99dd59707643bdac8a86b66e4ac1e38f2ab8e63`.
- [Air burst](../public/art/air-blast-v165.png), SHA256 `5595f2a91e028697438ad0ebef62c150b1516bb0a96f66a363116e0142214fa8`.

Requested 2048-square sheets arrived as 1254-square RGBA. Main owner inspected all originals. The generated ground contact points were not perfectly registered and the requested wide cell margins were not fully obeyed. The baker uses measured complete-effect bounds with four extra source pixels, a shared 0.4 scale, and fixed destination ground/air origins. It does not individually resize frames, recolor smoke, erase neutral paint, fabricate body parts, or simulate extra drawings with seeds. Soft alpha is preserved. Faint source gutter specks outside the measured complete cels are not packed.

The source air cel15 increased visual mass after cel14. All sixteen drawings are retained, but the chronological tail is reordered to `…11,15,12,13,14`; no synthesized shrinking/fading substitute frame. Packed late-frame alpha mass now decreases monotonically after the peak. The grenade source is more columnar than requested, but remains much smaller than HE at actual game size and visibly distinct. Small colored source fringes are not manually repainted.

Reproduce packing with `scripts/bake-v165-blasts.mjs`, using the project's TypeScript loader and existing native canvas dependency.

## Checks

- 15 focused tests pass: new v165 packing/production-loader tests plus v145 effects and v161 smoke. They verify all 48 new cels are nonempty/distinct; transparent frame gutters and quarter blends; no post-peak alpha-mass regrowth; correct family/air origin; caller drawing state; real loader requests; and exact pixel identity for all32 retained fuel/earth cels. The early grenade heat assertion counted only orange/red and missed ivory flashes; its metric was corrected to include pale flash pixels, not by modifying the paintings.
- 847 production-render lifecycle frames cover HE, grenade, air, artillery, wreck, crash and penetration, without mutating units. This is an age-stepped visual check, not a full match.
- An additional1,680 production-render combat frames cover four maps, seven simulated seconds each, using actual engine explosion entry points plus autonomous infantry/tank fire, ordinary player visibility and terrain. No omniscient visibility or render-alpha override. All six scripted effect kinds occur; penetration occurs from actual shooting. Unit positions/health remain finite, and rendering never mutates combat state.
- Main owner inspected before/after cycles, early and late normal-scale captures, and mixed combat on all four maps. No top-of-sheet fire strip appears in reviewed captures. The before fixture showed old HE shrinking then re-expanding; it did not reproduce the exact user-supplied sky strip, so this is not a claim of reproducing every original screenshot.
- Final QA output: `/var/folders/mt/w9779b795sddhd14ddd3ty9r0000gn/T/greyline-v165-final-BhAj78`; includes report, cycles and individual PNG captures. Before output: `/var/folders/mt/w9779b795sddhd14ddd3ty9r0000gn/T/greyline-v165-before-orpLyP`.
- Native-canvas mixed-scene draw p95 ranges1.89–7.18ms; maxima41–122ms remain. These are desktop diagnostic timings, not browser/mobile FPS. No claim that runtime stalls are solved.
- TypeScript and Pages production build pass. Existing >500kB bundle advisory remains. v165 visible in both menus and battle header. Exact deployment-byte checks follow publication.

## Remaining work

Moving crawl/reload, broader unit/card-role differentiation, residual map-layer seams and real-device performance remain open. This patch does not claim that every infantry animation, floating building corner or duplicate unit has been resolved. Existing unrelated untracked files are preserved; background continuation does not reopen the user's browser.
