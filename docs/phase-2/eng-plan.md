# Auto Stories — Eng Plan · Phase 2 (web): finalize + AI caption styling

How we build the Phase 2 web feature: turn the finished story into images the user posts to Instagram (download / Web Share → Select Multiple), with captions the AI styles and the device keeps readable. Web-only — native is Phase 3 ([decisions 7.11](../decisions.md#711-phase-2-ships-web-only-native-app-and-per-card-hand-off-move-to-phase-3)).

Principles: small, TDD, no new backend infra, no external CDNs, no new heavy deps.

## What the AI decides vs what the device computes
- **AI (metadata on the generate response):** `font, weight, case, align, size, position, letterbox`.
- **Device (deterministic, at render):** `textColor` (black/white) + `scrim` (on/off) — readability, because it's pixel-precise and the model only saw the downscaled proxy ([decisions 7.10](../decisions.md#710-in-app-customization-is-out-readability-auto-styling-is-in-phase-2-as-metadata-only)).
- **User:** the caption words (edit) + drag to reposition (the AI sets the starting point).

## Data contract (`@auto-stories/api-types`)
Add a `style` block to each story frame in the generate response. All fields are fixed enums/buckets (reliable for the model, trivial to validate):

```
style: {
  font:      "inter" | "playfair" | "space-mono" | "caveat"   // bundled, self-hosted
  weight:    "regular" | "bold"
  case:      "normal" | "upper"
  align:     "left" | "center" | "right"
  size:      "s" | "m" | "l"                                    // → clamped px
  position:  "top-left" | "top-center" | "top-right"
           | "bottom-left" | "bottom-center" | "bottom-right"   // 6 zones (off-subject)
  letterbox: "solid" | "blur"                                   // only when photo isn't 9:16
}
```
`caption` and `placement` (drag x/y) stay as they are. `textColor` + `scrim` are NOT in the model output — computed at render.

## Backend (`apps/api`)
1. **Prompt:** instruct the model to return, per caption, one value from each enum above. Still **one call** — just more fields on the existing generate response.
2. **Validator + defaults** (one small pure function, unit-tested): each field checked against its enum; missing/invalid → default `inter / regular / normal / center / m / bottom-center / blur`. This absorbs model flakiness so the client always gets a valid `style`.
3. Extend the response DTO/validation for the new block.

## Frontend (`apps/web`)
Existing to reuse: `story/image.service.ts` (OffscreenCanvas + `convertToBlob` pattern), `story.service.ts` (frames, `placement`, manual `legibility` toggle), `features/story` (the finished-story screen), `features/refine/caption-editor` (DOM caption overlay).

1. **Contrast (on-device)** — new `story/caption-style.ts`: `pickReadable(photo, box) → { light, scrim }`. Sample the photo's luminance under the caption box; return text color + whether a scrim is needed. Pure. **Recompute when the caption is dragged.**
2. **Frame renderer** (the main piece) — new `story/frame-renderer.ts`: `renderFrame(photo, caption, style, placement) → Promise<Blob>`. Draw the photo cover-fit into a **1080×1920** `OffscreenCanvas` (letterbox = solid colour or blurred photo when not 9:16), draw the caption using the AI `style` + computed colour/scrim → PNG. Reuse the `image.service.ts` canvas pattern.
3. **Live preview** — map the `style` block onto the existing DOM caption overlay so what the user sees matches the exported PNG (font/weight/case/align/size/position; legibility from the computed contrast, still overridable via the existing toggle). Carry `style` in `story.service.ts`.
4. **Export** — a **"Post to Instagram"** action on `features/story`: render all frames, then **mobile** `navigator.share({ files })`, **desktop** download each PNG; then one static line: *"Saved. Open Instagram → Story → Select Multiple → pick these."*

## Fonts
Bundle **4 self-hosted** OFL/Apache fonts (no external CDN, project rule): a clean sans (Inter), a serif (Playfair Display), a mono (Space Mono), a script (Caveat). The `font` enum maps to these.

## Tests (TDD, ≥85% backend floor)
- **Backend:** `style` validator — every enum, missing field, garbage value → correct default. Prompt/response wiring covered by the existing generate spec + a case asserting a `style` block comes back well-formed.
- **`caption-style.ts`:** bright / dark / mid photo + the threshold boundary → expected colour + scrim.
- **`frame-renderer.ts`:** output is 1080×1920, returns a PNG blob, caption drawn at the placement (assert via a fake 2D context that records draw calls); letterbox path for a non-9:16 photo.
- **`features/story` (Material/CDK harness):** the "Post to Instagram" button exists; click calls `navigator.share` (mocked) on mobile and download on desktop; the instruction line renders.

## Build order (each ships green)
1. Contract (`api-types`) + backend `style` fields + validator with defaults.
2. `caption-style.ts` (contrast).
3. `frame-renderer.ts`.
4. Live preview styling + export button.
1–3 are independent and pure; 4 wires them together. One feat PR per step (small, reviewable).

## Out of scope (kept simple)
Native app / SDK, burn-down UX, zip archives, model-driven **text colour** (stays computed), animation / stickers / music, cross-device or server persistence.

## Open / to settle while building
- Exact luminance threshold + scrim opacity (tune on real stories — [open-questions Q10](open-questions.md)).
- `size` bucket → px values for 1080×1920.
- Desktop multi-download UX (individual downloads vs a single "download all"); start with individual, revisit only if it's annoying.
