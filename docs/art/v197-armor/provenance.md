# Greyline v197 vehicle artwork

Created on 2026-10-03 with the built-in imagegen tool. Nine separate AI-generated paintings: a battlefield sprite, matching wreck and illustrated card for each of the TOW missile carrier, light tank, and multiple-launch rocket vehicle. User clarification maps the requested redraw to light_tank and mlrs, not a new self-propelled howitzer.

The original generated PNG files are preserved. Sprite and wreck transparency comes from the generated alpha channel. Served WebP files are format-only lossless conversions (Pillow lossless=True, exact=True); no procedural vehicle drawing, palette replacement, artificial pixelation, repainting or background removal was applied. Sharp straight-RGBA decoding verifies all nine served files against the original generated pixels.

The renderer uniformly crops transparent margin and scales the authored paintings to world size: TOW 150×82, light tank 185×91, MLRS 210×115. Matching wrecks have independent artwork and measured collision profiles. Weapon mouths, ground contact and visible wreck metal are checked by tests/v197-vehicle-art.test.mjs and actual browser rendering in both directions. The existing artillery-v9 cannon artwork and separate soldier rigs are retained; guns now sample directly at display size instead of enlarging an 80×48 intermediate.

[All generation prompts](combined-prompts.txt)

| Painting | Original | Served asset | Generation prompt | Original SHA-256 |
| --- | --- | --- | --- | --- |
| tow-sprite | [PNG original](tow-sprite.png) | [served WebP](tow-sprite.webp) | [prompt](tow-sprite.prompt.txt) | `45240024df6ef79aaee9594f2eda4c4638d8be2bea7a73faefc4453046e0cb9a` |
| tow-wreck | [PNG original](tow-wreck.png) | [served WebP](tow-wreck.webp) | [prompt](tow-wreck.prompt.txt) | `52693ab7dd5dbc23b5f7ca5a56030b8dd67e721ebdc46e6e73d4686eb6e04bd7` |
| tow-card | [PNG original](tow-card-original.png) | [served WebP](tow-card.webp) | [prompt](tow-card.prompt.txt) | `6864b7094216478d470f85026b7b4a29fd5f2e86a25557f289f00e55c18033ad` |
| light-tank-sprite | [PNG original](light-tank-sprite.png) | [served WebP](light-tank-sprite.webp) | [prompt](light-tank-sprite.prompt.txt) | `0dce44d9778a1dd522bd233769d53f04c12ef89fa0f8a89d401c3ab8baae5859` |
| light-tank-wreck | [PNG original](light-tank-wreck.png) | [served WebP](light-tank-wreck.webp) | [prompt](light-tank-wreck.prompt.txt) | `4625744bf953d86dadf7ca65a1b25a92546fd3fb8549d53112bd74d524106d28` |
| light-tank-card | [PNG original](light-tank-card-original.png) | [served WebP](light-tank-card.webp) | [prompt](light-tank-card.prompt.txt) | `eb90b256cd437cb1da448ff6c6ff69b3b675dbf16ee402ae741491e4e3d4bbb6` |
| mlrs-sprite | [PNG original](mlrs-sprite.png) | [served WebP](mlrs-sprite.webp) | [prompt](mlrs-sprite.prompt.txt) | `f930bbed1d1bf75ebe72370af9cb160520865c95936c3f32acc6d16c943c3bfe` |
| mlrs-wreck | [PNG original](mlrs-wreck.png) | [served WebP](mlrs-wreck.webp) | [prompt](mlrs-wreck.prompt.txt) | `0e1c19bc92fdc3feb5a622c5e73d587f2607ac95e20d952aec4f0c93b61cc318` |
| mlrs-card | [PNG original](mlrs-card-original.png) | [served WebP](mlrs-card.webp) | [prompt](mlrs-card.prompt.txt) | `9067f470fce33582526aac00f801583fab6bb94fe8623c727a69f23f68638fa8` |
