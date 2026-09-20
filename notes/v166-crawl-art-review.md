# Low crawl artwork — rejected, not shipped

One built-in imagegen call, using `public/art/infantry-stance-v142.png` as a style/anatomy reference. No retries, variants, CLI, background repainting, body compositing or synthetic replacement frames. Asset-only agent and main owner inspected the unchanged result. The original1536×1024 RGBA contains12 figures, but most repeat the same tucked near-leg/aiming-arm posture instead of an alternating crawl. Fixed origins/safe margins also fail; a rifle touches a cell boundary. Registration could address vertical drift, but cannot invent missing convincing limb progression. It was rejected rather than certifying a nominal cel count as animation quality.

Saved outside runtime assets at `/Users/bytedance/Documents/ChatGPT/Desktop/greyline-crawl-v166-1q77rr/`:

- `greyline-crawl-v166-original.png`, SHA256 `f71bae16b7073f988a6ea58acc068022592bce61d8699ff1f8bdf1d3f61e6c34`.
- `args.json` — exact submitted prompt and arguments.
- `prompt.txt` — full prompt text.
- `inspection.md` — per-cell bounds and inspection evidence.

The trial distance-driven twelve-cel selector/loader was removed in this turn, including its two new draft files. Production infantry art and behavior remain byte-identical to v165. In that unpublished test draft,22/24 checks passed: one failure correctly exposed scouts retaining their legacy sniper model; another exposed that formation-lane travel contributes to the gait clock as well as forward travel. Neither was disguised as an art-quality pass. Any later implementation must preserve actual specialist weapons and account for actual lane displacement.

No preview/browser was opened. Moving crawl and moving reload still need acceptable whole-body artwork. v166 shipping changes are only the separately verified building-footing correction; see `v166-verification.md`. This experiment does not complete the infantry-animation requirement.
