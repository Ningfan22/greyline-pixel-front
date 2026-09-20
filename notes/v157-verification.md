# v157 — Retired gesture downloads; moving-reload artwork rejected

## Shipped scope

- `loadArt` no longer requests or decodes the four retired command sheets. Their combined original transfer size is 702,866 bytes (about 703 KB). Existing public files are retained for older builds; this is four fewer startup requests, not a measured FPS improvement.
- The legacy `signals4` field remains an empty array. Both live body selectors already exclude command gestures; this change does not claim a new fix to stance, traversal, explosions or card roles. Required posture, reload, treatment, tool-work and weapon artwork remains loaded.
- No card, economy, collection, approved flavor text, simulation timing or combat-stat change.

## Image generation and rejected integration

Two built-in image-generation requests produced complementary 4×4 candidates for upright moving rifle reloads. The owner inspected both originals. Neither establishes a reliable four-phase gait, A does not visibly complete stowing/reaching for a magazine, and B does not clearly distinguish a detached magazine from halfway insertion. Both also contain faint gutter residue and differ in figure scale. No frames were cropped, repainted, composited or installed in the game.

Unchanged originals, exact prompts and the row-by-row review are preserved outside the runtime checkout:

- `/Users/bytedance/Documents/ChatGPT/Desktop/greyline-moving-reload-iuEIgW/sheet-a.original.png`
- `/Users/bytedance/Documents/ChatGPT/Desktop/greyline-moving-reload-iuEIgW/sheet-b.original.png`
- `/Users/bytedance/Documents/ChatGPT/Desktop/greyline-moving-reload-iuEIgW/requests.json`
- `/Users/bytedance/Documents/ChatGPT/Desktop/greyline-moving-reload-iuEIgW/QA.md`

A SHA-256: `2e128b3f93f600c626d6b01138d8c706b5a4a8b769083160e1d613f70662c460`.
B SHA-256: `4b1073d06cef03391c078c8ee19c43cbdc812eed051ab831a9aeae4406f05629`.

The unintegrated moving-reload selector and its proposed tests were removed rather than shipping unused code or pretending helper tests prove animation quality. No retries or CLI generation. Moving reload remains incomplete; the existing stationary drills and normal moving gait are unchanged. Do not reuse these candidates as approved animation.

## Verification

- 21 focused tests passed: two new checks forbid every retired command-image request while loading the actual production artwork, and exercise both live selectors with legacy signal flags; nineteen existing posture/bank/excavation checks also pass.
- Production-renderer regression: 1,180 frames, 288 bank-body checks and 470 shovel-body observations. Inspected the two-sided, three-height bank contact sheet and prone-to-knee construction capture. Output: `/var/folders/mt/w9779b795sddhd14ddd3ty9r0000gn/T/greyline-v156-ground-work-6OtdKa`.
- TypeScript and Pages build passed; active JS `index-cGFQLqHm.js`, stylesheet unchanged `index-DOysgTK1.css`. Existing greater-than-500kB bundle advisory remains. No browser FPS or before/after timing claim.

This background continuation does not open or replace the user's browser. Broader animation, card-role and device-performance work remains active.
