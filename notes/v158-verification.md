# v158 — Sustained foot mortars versus mobile firing positions

## Actual role distinction

- The mortar carrier now plans a 48–96px rearward bound after a real shell, without consulting enemy sound reports. It retains an 80px margin inside its unbuffed firing range and stays within the friendly map edge. A target behind it does not induce backing toward that target. Insufficient room means staying put, not moving out of range.
- Existing barrel recoil finishes before the bound; tracks move the hull while it remains aimed forward. Movement is bounded by the actual remaining distance, and the gun needs 0.55s stationary settling before firing. Automatic and explicit local movement both obey this firing gate. A hold order cancels an unfinished bound without leaving the weapon permanently blocked; a selected withdrawal supersedes the automatic plan.
- If backing out loses sight, it waits at the new site during its reload. After reload it may seek a new firing line normally; the settle clock does not create a move/pause loop. No new blind-fire or through-cover permission, damage resistance, free ammunition or reload acceleration.
- A foot mortar member must actually discharge at least two own shells from a position before reacting to a mature enemy sound fix. Moving resets this count. This avoids treating two neighboring crew members' first shots as two rounds fired by the current operator. Foot crews retain their existing longer displacement/cooldown and hold behavior.
- AI scores mobile mortars against visible indirect fire or fresh reports received by its own side. Hidden guns and stale reports do not grant the preference; infantry-only contact favors the denser foot team. Existing missing-screen/urgent-counter rules remain in force.
- Both cards keep their IDs, prices, stats, collection counts, rarity and approved flavor. Only rule descriptions change. The card-face short rule remains within its existing 15-character limit. No new artwork or claim of completed moving-reload animation.

## Verification

- Four initial behavioral reproductions failed before implementation (first-shot bound, interrupted hold, edge bound and settle/fire sequencing).
- Eight new tests pass, covering both sides, real projectiles and origin retention, recoil, bounded movement, stop/resume, map/range limits, full foot crews, continuous travel, loss of sight, explicit commands and five actual AI-choice scenarios. Combined with machinegun/insertion regressions: 27 passed.
- Paired engine trials: eight seeds × two sides × hold/mobile = 32 scenarios. A real enemy `precision_rocket` card targets a fresh actual sound report. Held carriers took 1304.332 aggregate damage; mobile carriers took 437.726. All retained actual repeated shell fire. Some mobile trials still took a full hit, so this is evidence of a tactical tradeoff against these delayed narrow strikes, not invulnerability or a general balance proof.
- 840 production-renderer frames and an inspected hold-versus-scoot plate. The final diagnostic does not overwrite visibility state. Output: `/var/folders/mt/w9779b795sddhd14ddd3ty9r0000gn/T/greyline-v158-mortar-tbgQBU`.
- Historical v56 shoot-and-scoot checks: six pass; the assertion requiring two simultaneously mature old/new reports at 18s fails. It also fails identically in an isolated unmodified `dc1f2f0` archive (`/tmp/greyline-v158-baseline-XvwWBj`), before these changes. The old test and report mechanics have not been weakened to hide it.
- Historical engine suite: 170 passed, including card conservation, card-face text limits, sight-based AI, vehicle firing/retreat and three full matches. Seeds13/71/102 still end at600s (red810:1000),335.2s (blue1000:0),291.3s (blue1000:0). These matches are regression coverage, not proof of overall balance.
- TypeScript and Pages build passed. Active JS: `index-CFDTQLuv.js`; stylesheet unchanged: `index-DOysgTK1.css`. Existing greater-than-500kB bundle advisory remains. No browser FPS claim.

This is a targeted card-role change. Wider duplicate-role/balance review, unfinished infantry animation assets, casualty art and browser/device performance remain open. Background continuation leaves the user's existing browser untouched.
