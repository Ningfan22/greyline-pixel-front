# v155 — 空降分工与 AI 落点

## Changes

- Removed the universal eight-second sprint from parachute and rope touchdown. Only a card with the rapid infantry ability receives it, starting at touchdown rather than during descent. Ground rapid deployment remains unchanged. The first shot ends the existing 1.8× advance boost; retreat does not receive it.
- Recon jump now watches its landing position without autonomously pursuing. An explicit player squad order can move it, and an order already given during descent is preserved. It shares ordinary 850-range observation, but supplies neither a landing guide nor a sprint. Pathfinders retain their existing guide/watch role; airborne AT retains its launcher role.
- AI rapid reserves and recon insertions select the friendly side of all currently observed ground contacts. Ground-footprint relocation is checked again after clamping/search; no legal friendly landing band means withholding that insertion. An exposed emergency sector prefers a valid rapid reserve over ordinary infantry, but can choose ground infantry when the drop band is blocked.
- Recon can establish forward observation from its own line when no enemy is visible. Hidden contacts do not affect the chosen landing. This is not omniscient scouting.
- Urgent anti-armor/air selection retains the validated target coordinate from normal card scoring instead of dropping it. This preserves a selected friendly guide for airborne AT.
- Card rules/details describe those differences. Cost, health, collection IDs/copy limits, rarity, economy and approved humor are unchanged. Manual player landing selection is unchanged.

## Verification

- Ten new engine tests cover both armies' parachute/rope touchdown, role-specific sprint timing, order preservation, stationary recon observation/manual movement, measured 1.8× movement, unchanged retreat, first-shot termination, emergency card selection, blocked landing bands, obstacle relocation, hidden-contact independence and urgent AT guidance.
- Final focused suite: 193 tests passed (v135–v155). Historical engine suite: 170 gameplay checks passed. Full-match regressions settle: seed13 red at600s (810:1000), seed71 blue at335.2s (1000:0), seed102 blue at291.3s (1000:0). These are regression outcomes, not balance guarantees.
- TypeScript check and Pages production build passed. Active build: `index-DT0-FHgu.js`; unchanged stylesheet: `index-DOysgTK1.css`. The existing greater-than-500kB bundle advisory is not a build failure or a performance improvement claim.

## Limits

This is a tactical-role and AI update, not newly generated artwork or a visual fix for every screenshot. It does not add moving-reload or prone-launcher loading art, change stance timing, or complete the wider 116-card overlap/balance audit. No browser interaction testing or FPS claim. Existing large-bundle advisory remains to be addressed separately. The active goal is not complete.
