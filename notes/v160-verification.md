# v160 — three tank roles, not three copies of armor-first targeting

## Evidence and delivered behavior

Before this change, all three `modelOf(id)==='tank'` cards used the same armor-first sorting branch. Cost, reload, damage, speed, health and artwork differed, but their main-gun decisions did not.

- Light tank: visible/eligible anti-armor operators and AT guns, then light vehicles (card base HP≤430), then MG/mortar operators, then other infantry/guns, then distant heavy armor. Mixed-team rifle guards are not treated as launchers. No extra anti-armor damage or range.
- MBT: preserves armor-first finishing behavior and independently aimed coax fire.
- Heavy tank: visible/eligible emplacements, then infantry groups containing at least3 within32 of the aim candidate, then armor, then scattered infantry. Within a group, counts and mean horizontal spread prefer its centre. Formation preference does not imply all blast victims are exposed or guaranteed hit.
- Light/heavy variants override their specialty for armor within220, and ordinary eligible targets remain fallbacks when the preferred role is absent or unshootable.
- All candidates still pass existing vision, range, target eligibility and firing-height/cover tests. No new movement privilege, hidden-target access, splash damage, AP damage or numerical stat boost. Coax selectors are unchanged.
- AI values visible composition. In urgent counter selection, role preference is a per-option tie-break after threat urgency and counter strength, granted only to affordable suitable tanks. This scalar ordering remains transitive with mixed tank/launcher hands; it must not wait for an unaffordable favourite or override air/armor urgency. Hidden heavy armor does not affect choice.
- Three card rules/details now explain the live distinction. Costs, collectible IDs, ownership, copy limits, rarity, approved flavor and art preserved.

## Verification

- 25 focused tests passed (v155 insertion, v158 mobile mortar, v160 tank doctrine). Seven new checks include mirrored real projectile choice/impact, clustered HE damage, close AP self-defense, actual launcher versus guard, blocked/hidden fallback, contact-line restraint, MBT finishing/coax and AI observed-role/5-point-budget choices.
- 170 historical gameplay checks passed. Full matches remain seed13 red600s810:1000; seed71 blue335.2s1000:0; seed102 blue291.3s1000:0. These unchanged matches do not establish balance for every new tank combination.
- 96 controlled first-round trials:8seeds ×2sides ×3tanks ×2layouts. Enemy weapons disabled to isolate choice/impact, real card HP and real projectiles retained. Every expected target was selected and actually damaged.384 production-render frames, rendering cannot mutate units; no visibility override. Main owner inspected the three-role plate.
- QA output: `/var/folders/mt/w9779b795sddhd14ddd3ty9r0000gn/T/greyline-v160-tank-roles-CCFmxY` (`report.json`, `three-tank-roles.png`).
- Concentration ranking uses a sorted sliding window and prefix sums, not an all-pairs scan. Checked against brute-force count/spread for203 synthetic infantry. Warm non-browser microbenchmark:47.4µs/call on this host over3000 calls. Not a browser FPS/low-end-device claim.
- TypeScript and Pages build passed; existing >500kB bundle advisory remains. No browser handoff/testing for this background continuation.

## Limits and remaining work

This is a verified targeting/AI role split, not a new tank movement doctrine or a complete116-card balance pass. Moving reload and other specialist animation gaps, broader effect/ruin quality, card-role overlaps and full requirement-by-requirement completion audit remain. Previously documented v56 sound-report test failure is not changed; no claim that all historical suites are green.
