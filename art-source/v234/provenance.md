# v234 stealth bomber

Generated with the built-in ImageGen tool, 2026-10-09. Original is retained as
`stealth-bomber-original.png`.

Prompt summary: redraw the v233 flying-wing bomber as deliberate military pixel
art matching the existing battlefield; transparent background, restrained greys,
crisp clusters, intended 208×84 display size, no smooth metal or antialiasing.
References: v233 aircraft sprite and the v233 local battlefield capture.

`scripts/prepare-stealth-art-v234.mjs` fits the original uniformly using nearest
sampling and hard alpha. The runtime sprite is already 208×84 world pixels and
is copied without further scaling. Existing infantry remains at its native
128×128 raster and 1:1 world scale.
