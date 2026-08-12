# Asset manifest

## Traditional Hwatu faces

- **Source:** The V2 reference image supplied by the project owner, stored at `apps/mobile/assets/cards/source/traditional-hwatu-reference.jpg`.
- **Treatment:** The 48 printed card faces were measured and separated into individual mobile assets by `scripts/extract-hwatu-assets.py`. The script applies only crop, resampling, color/contrast normalization, and sharpening; it does not alter the depicted motifs.
- **UI treatment:** Month numbers remain app-owned overlays so they stay readable at every rendered card size.
- **Approval status:** User-supplied visual reference, incorporated for this project at the user's request.
- **Last reviewed:** 2026-08-12.

## V2 bonus cards and card back

- **Source:** Original raster assets generated with the built-in OpenAI image-generation workflow, using the supplied traditional deck as the style reference.
- **Files:** `bonus-2pi-a.png`, `bonus-2pi-b.png`, and `card-back.png` under `apps/mobile/assets/cards/faces/`; full-size generated sources are retained under `apps/mobile/assets/cards/source/`.
- **Art direction:** Flat vermilion, black, and warm-ivory Korean screen-print language; no modern poker-joker imagery.
- **Generation prompts:** Two separate prompts requested a double-pi service card marked `쌍피`—one with a peony/taegeuk motif and one with magpies/red sun/pine—and a third requested a symmetric traditional card back.
- **Last reviewed:** 2026-08-12.

## UI symbols and typography

The MVP uses platform system fonts and a small set of Unicode symbols already present in V1. No third-party font, sound, photo, or commercial game-art bundle is shipped.
