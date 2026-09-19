# v141 — real glider transport and physical landing fields

## Delivered behavior

- Existing four-cost glider assault card deploys one unarmed 180-HP runtime transport from its own map edge, not four parachutists. Flies at 360 world units/s, descends over the final 450, rolls 90 units over 1.2s, waits 1.05s for the door, then unloads one soldier every .45s. Soldiers keep the existing four-member 240-HP elite role and one shared squad.
- AA can destroy the occupied aircraft. After touchdown it is a ground target, including for ordinary rifles. Only people who already left survive destruction; no phantom cargo or return card. The empty hull becomes permanent cover without being scored as a kill.
- Actual terrain/scenery, hull wrecks, live walls, nose and tail sweep points constrain the approach. Pre-existing unsafe descents reject the card before charging; a later physical obstruction can crash it. Terrain accidents do not award enemy kills.
- No rotor sound, hover order, return order, fuel fire or automatic landing explosion. Crash adds dust. Wreck art uses two independently painted damage silhouettes; healthy abandoned hull stays intact.
- `glider_transport` is an internal runtime prototype, excluded from collection totals, packs, deck building, shop lists, copy limits and direct play. Still 116 collectible species; existing owned copies and flavor text are retained.

## Maps and art

- Procedural layouts include a visible 660-unit landing clearing between houses. Dense village/desert layouts may replace one central house site with the field; other houses retain their flat foundation pads. No invisible collision exceptions. Classic authored layout seeds remain unchanged; an old dense replay may need obstacle destruction before a glider can land.
- Built-in imagegen, one original transparent PNG, stored unchanged as `public/art/glider-v141.png`; exact prompt is adjacent. SHA-256: `29e20a6bf2bcf453cff43153365ef3beba7d4de79e493d92bab8c874460d815b`.
- Actual sheet is 1448×1086, not the requested 2048×1536. Integer y cuts 0/272/543/815/1086 and fixed registration avoid fractional neighboring-row leakage. Display frames are 256×100 with strong-alpha bounds inside x22..233 and baseline y91.
- Two generated later door cels contain unwanted damage; healthy unloading holds the clean first open-door cel. Flight/touchdown differences are subtle. This is **not** a claim of a fully authored eight-step door animation.

## Verification

- Ten new engine tests: collection separation and 500 pack draws; both-side real travel/roll/door timing and sequential cargo; invalid-play conservation; actual AA kill; grounded ordinary-rifle kill during partial unloading; late wall collision; frame-state selection; 32 seeded maps with legal landing sites; actual delivery on all four map families from both sides; preservation of all three village house styles on 100 seeds.
- Production renderer QA: 1,440 frames, 6,309 soldier-frame checks, all four maps show approach/roll/unload/empty states. Large artillery explosions sampled at four ages on every map. Inspected decoded atlas, village unloading, jungle empty hull, desert blast and mountain late smoke; no neighboring top strip in inspected images.
- 400 map seeds / 1,100 house foundations checked across their full 220-unit footprint: all level, including overlapping pads. Original posture, reload, finite-deck, shop, concealment, guidance and machinegun tests retained.
- QA fixture tick median .028ms / p95 .156ms is a **light insertion fixture**, not a performance claim about a large battle. No new broad performance claim is made.
- 80 focused regressions passed. Historical suite initially passed 169/170: the remaining test caught loss of the third village house style. After preserving the style cycle, the two house-geometry cases and three complete seeded matches passed again. Type check and Pages build succeeded; build retains its existing large-bundle warning.

## Remaining work

Broader card-role/balance trials, richer healthy door frames, and varied high-density battle art remain ongoing. This release is a targeted transport distinction and regression check, not a claim that every card or animation has been perfected.
