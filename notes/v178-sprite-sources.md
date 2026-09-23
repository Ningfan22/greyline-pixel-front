# v178 soldier rig sources

Generated with the built-in image generation tool. Original outputs are preserved.

- `public/art/soldier-parts-v178.png`: four appearance families, ten reusable body/kit parts each; 1983×793 transparent source.
- `public/art/soldier-equipment-v178.png`: twelve weapons and tools; 2172×724 transparent source.

These are source atlases, not independent full-body animation cels. The runtime samples parts once to fixed anatomical dimensions, articulates them with fixed-length bones, and resolves every completed sprite to the same binary-alpha one-world-pixel grid. No per-pose body fitting or identity replacement.

## Body parts prompt

```
Use case: stylized-concept
Asset type: production modular pixel-art soldier sprite atlas for a 2D side-view military game.
Create ONE transparent sprite parts sheet in a strict 10-column by 4-row grid, landscape 5:2 aspect ratio (prefer 2560x1024). All cells are 256px square with wide transparent gutters. No text, no grid lines. Each cell contains ONE isolated part, centered, NO duplicates or complete soldiers.
All pieces are true sharp pixel art with detailed fabric folds, tiny camouflage blocks, warm skin, dark 1-pixel outline, realistic adult anatomy (not chibi). Consistent pixel density and lighting throughout. Orthographic RIGHT-facing side view, no perspective or isometric angles.
Each row is one fixed character identity with matching clothes:
row 1 green/olive combat uniform and helmet, green tactical vest;
row 2 sandy tan/yellow marine combat uniform and tan helmet/vest;
row 3 dark navy/charcoal police uniform and dark helmet/body armor;
row 4 irregular militia brown field jacket and muted olive trousers, brown cap (no helmet).
The TEN columns in EVERY row are:
1. isolated head wearing the appropriate helmet/cap, face looking right, neck at bottom; nominal 14px wide x 14px tall.
2. isolated sleeveless torso with detailed vest and pouches, neck at top, waist at bottom, NO head NO arms NO backpack NO gun; nominal 15px wide x 23px tall.
3. isolated upper arm / sleeve pointing vertically down, shoulder at top, elbow at bottom; nominal 7px wide x 13px tall.
4. isolated forearm pointing vertically down, elbow at top, gloved gripping hand at bottom; nominal 6px wide x 14px tall.
5. isolated upper leg/thigh pointing down, hip at top, knee at bottom; nominal 8px wide x 18px tall.
6. isolated lower leg/shin pointing down, knee at top, ankle at bottom, NO boot; nominal 7px wide x 17px tall.
7. isolated boot, toe pointing right, flat sole; nominal 12px wide x 6px tall.
8. isolated black/steel assault rifle, side view barrel pointing right, no arms; nominal 36px wide x 9px tall.
9. isolated compact worn canvas backpack matching row uniform, side profile; nominal 10px wide x 18px tall.
10. isolated pelvis/hip belt and short trouser seat, NO legs, belt at top; nominal 13px wide x 8px tall.
Render all pieces on the SAME logical pixel grid, nominal sizes above multiplied by SIX on the sheet, with square 6x6 pixel blocks, no antialiasing, transparent background throughout. Each piece centered in its cell, never touching another cell. Naturalistic tactile detailed pixel art, consistent scale between rows. These pieces will articulate around joints in-game so shoulders/waists and limb ends must be clean rounded overlapping joints, no white edges. Do not draw whole humans, poses, labels, weapons with hands attached, shadows or checkerboard backgrounds.
```

## Equipment prompt

```
Use case: stylized-concept
Asset type: transparent production pixel-art equipment atlas for a side-view modern military game.
Create one wide 3:1 landscape transparent sheet, a STRICT 6-column by 2-row equal cell grid. Exactly twelve separate objects, one per cell, generously spaced, centered, NO text and NO visible grid.
Naturalistic detailed military pixel art: tiny square pixels, dark clean outline, olive metal, black steel, worn wood, sharp silhouette, no soft blur, no isometric perspective. Every weapon barrel points RIGHT in pure orthographic side view. NO people, heads, arms, hands, ground, backgrounds, muzzle flashes.
Top row left-to-right:
1 compact light machine gun with short bipod and box magazine;
2 heavy machine gun on a LOW tripod, long barrel pointing right;
3 shoulder-fired anti-tank rocket launcher tube with warhead, rightward;
4 shoulder-fired surface-to-air missile launcher tube with targeting sight, rightward;
5 long scoped precision rifle, scope and bipod;
6 standalone short grenade launcher with fat barrel and stock.
Bottom row left-to-right:
1 portable infantry mortar with baseplate and folded bipod, firing tube tilted up-right 60 degrees above ground;
2 flamethrower nozzle/gun, rightward with short hose attachment at rear;
3 flamethrower twin-cylinder backpack tank set (vertical);
4 olive canvas combat medic bag with a small pale rectangular medical patch, no text;
5 short folding entrenching shovel, handle upward and spade blade down;
6 rugged steel wrench vertical.
All objects fit inside their cells without overlap and use a genuinely transparent background, no checkerboard. The sheet is for articulating sprites; objects should be cleanly isolated. Matching compact realistic pixel treatment across all twelve objects.
```
