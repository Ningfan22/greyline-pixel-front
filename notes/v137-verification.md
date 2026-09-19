# v137 — shop consistency and safe pack settlement

## Shipped scope

- Reveal delays are scoped to the current purchase and cancelled on restart, collect and unmount. Already-queued callbacks carry a generation guard. Repeated purchase events during tearing are ignored.
- A ten-pack with 50 rare cards now receives an ace, not just ten-packs containing commons. The guaranteed ace is selected from below-cap ace cards when any remain. Full cards retain the requested 5/10/20/50 gold refunds.
- Pack functions reject insufficient or non-finite balances before drawing or saving. Prices, starter collection, mock ad reward, saved decks and existing ownership are unchanged.
- Owned shop cards and already-flipped result cards open the existing split card/details layout. On narrow screens it stacks without horizontal cropping. The mobile sizing rule now follows the later desktop override that previously defeated it.
- Single-card clicks reveal one; the table and an accessible button reveal all. Hidden front text is not exposed to assistive technology before reveal. Five-card spacing and shop controls shrink within the available panel width.
- The existing canvas animation is retained. Keyboard skip and unavailable-context completion are fixed; reduced-motion preference now skips it rather than making it almost three times slower.
- Card descriptions for mechanics, cheap engineers, armored mine clearance and ambush damage match current engine behavior. No approved flavor text or card IDs changed. See `card-role-audit-v137.md` for unresolved overlaps.

## New generated animation — NOT shipped

The built-in image generator produced a 1536×1024 RGBA, 8×4, 32-cel atlas, but it failed acceptance: insufficient gutters, approximately 10px horizontal/40px vertical body drift, and detached strips crossing the last-row crop boundaries. Do not wire it into the game or claim the generated animation is complete. The temporary atlas player was removed, so production has no missing asset reference or unresolved placeholder.

Rejected original retained outside the project at `/tmp/greyline-atlas-8wyKb7/greyline-opening-atlas.png`; exact final prompt `prompt-revision-4.txt` and measured QC `qa-final.json` in the same directory. Existing purchase art is unchanged.

## Verification

- 10 new shop checks cover all-rare pity, natural rarity, available-ace selection, all rarity refunds, copy limits, funds validation, starter/ad invariants, 100 seeded ten-pack settlements, stale callbacks and repeated flip-all cancellation.
- v135/v136 battle regression checks are rerun alongside them; ground poses, level building pads, finite battle decks, contact lines, grenade timing, rocket roles and cover clearance remain covered.
- Browser: desktop owned-card detail opens with left card/right description. At 390×844, shop controls and dialog content fit their containers; measured scrollWidth equals clientWidth.
- Browser: single pack has five backs; clicking one leaves four; clicking its front opens full detail. Clicking flip-all and immediately buying again leaves all five new backs untouched after the next animation. Ten-pack displays 50 backs and supports staggered reveal.

This release is not a new battle-AI overhaul, and does not resolve all unit-role overlaps or deliver the requested generated pack animation.
