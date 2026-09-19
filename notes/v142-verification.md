# v142 — simulation-owned, painted posture transitions

## Changes

- Stand↔knee and knee↔prone each take 1.2 seconds through eight painted cels. Stand↔prone traverses both segments in 2.4 seconds. The existing ten-second cross-height commitment remains intact.
- Engine owns the start, source, destination and progress. Rendering is a pure reader, including when a soldier was off-screen. Grounded movement, primary/secondary fire, hand-grenade initiation and heavy-gun readiness wait for the drill; terrain fall/landing and casualty handling still run. Actual magazine replacement finishes before another stance change begins.
- Hit geometry interpolates through the knee-height waypoint. No immediate prone-sized target while the body still looks upright.
- Patrol, specialist weapon, heavy-gun, digging and idle layers cannot replace a transition cel. Whole-body breathing translation also yields. The settled rifleman body uses the corresponding endpoint so the last cel cannot snap back to a differently scaled old body.
- Kneeling/hunkered firing and aiming no longer alternate with legacy action 13, which is a hands-and-knees crawl. Decorative magazine/engineer fuss no longer inserts this crawl while idle. Prone firing similarly holds its aimed body instead of flickering weapon layers.
- A precision observer cannot grant a settled observation bonus while physically lowering/rising.

## Art provenance and limitations

Built-in imagegen, exactly one call by the asset-only agent. Original 1254×1254 RGBA PNG is copied unchanged to `public/art/infantry-stance-v142.png`. Exact submitted arguments: `public/art/infantry-stance-v142.prompt.json`. SHA-256 `be26b71d708081677b783e03cfd4484d0cf183c153a208f5ffddb6c283746243`.

The generated layout did not obey uniform square tiles or common source baselines. Measured integer figure bounds plus connected-figure extraction prevent neighboring rifles/feet leaking through; manual registration uses a single 0.21 anatomical scale, never per-pose stretching. The source stays unchanged, including its alpha. Runtime endpoint 8 deliberately reuses endpoint 7 to make the shared knee hold identical.

Measured strong-alpha display heights: 63,59,54,48,48,46,43,43,43,36,30,23,20,19,17,17 pixels. All boot/knee/elbow baselines are y95. All silhouettes remain within x15..82 of a 96px canvas, and adjacent height steps are at most seven pixels. These are sixteen timeline cels, **not** sixteen equally distinct motion drawings or a claim of 60 unique drawings per second. Several kneeling/prone drawings are similar. Uniform palettes still apply; the underlying new transition anatomy is shared by the four identity sets.

## Verification

- 90 focused tests pass, including ten new posture cases: all six ordered chains, no render mutation, overlay/work priority, aiming stability, decorative-crawl exclusion, casualty/descent precedence, both-side movement/shooting resumption, smooth hit geometry, off-screen clock independence, and an active standing reload completing first.
- Full historical suite: 170 gameplay checks pass, including three complete seeded battles (13,71,102), final results at 391.9s/381.4s/234.7s. Fixed-fire ballistic fixtures now explicitly start already settled/aimed; movement fixtures allow the real rise time. Damage/range/cover/withdrawal assertions are retained. This is an intentional readiness-latency change, not a production exemption to satisfy old instantaneous-fire assertions.
- Production renderer QA: 976 rendered frames, 83,721 soldier-frame checks, 9,660 live transition observations. All six directions across riflemen, machinegun/heavy gun, launcher, marine and police bodies; captured draw calls prove the selected transition texture actually reaches the canvas despite a competing digging flag. A separate live battle exercises real hits, orders, reloads and shooting.
- Inspected decoded contact sheet, transition midpoint and live-battle captures. QA output `/var/folders/mt/w9779b795sddhd14ddd3ty9r0000gn/T/greyline-v142-motion-I3BH9O`.
- Local Napi renderer fixture: tick median 3.647ms/p95 9.278ms, draw median 4.161ms/p95 6.012ms. Not a browser/device-wide FPS promise or a controlled before/after speedup claim.
- Type check and Pages build pass. Existing large-bundle warning remains.

## Still open

Low-posture ordinary reload/treatment and move↔stop drills still reuse older work/gait cels and need their own richer art. Weapon-specific gear handoffs need further scrutiny. Existing explosion/map/pack fixes and differentiated card roles remain unchanged in this release; this is not a claim that every repeated-looking unit or every animation has been finished. No card ownership, rarity, cost, copy limit, collection ID or flavor text changed.
