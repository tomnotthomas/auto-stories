# Auto Stories — Phase 2 · Story design plan

Makes the finished story frames read as designed (not "text on a photo") and turns the hand-off into a guided post. All client-side canvas + model metadata — no server render, no image bucket (holds [decisions 7.10](../decisions.md#710-in-app-customization-is-out-readability-auto-styling-is-in-phase-2-as-metadata-only)). The motion/reveal layer is deferred (see end).

## Problem
- Frames read as generic "text on a photo"; captions size inconsistently (too big / too small).
- The set looks like a camera roll, not one piece — each photo is raw, colours vary frame to frame.
- Hand-off is a bare export: the user decides what stickers to add and where.

## Part A — Story art direction (the look)
The look comes from type, layout, and palette — not from a filter on the photos.

- **Curated palette per story, not auto-derived.** One set — white text, near-black text, one restrained accent — applied to every frame. ([7.13](../decisions.md#713-story-frames-look-designed-via-a-curated-static-look-not-a-filter))
- **Neutral photo cohesion, lightest touch.** Consistent gentle contrast + a whisper of grain across all frames; skip aggressive auto-white-balance; cap the correction so a match can't break a photo. Frames read as one set. ([7.13](../decisions.md#713-story-frames-look-designed-via-a-curated-static-look-not-a-filter))
- **Self-hosted display type.** Bundle 1–2 curated display faces; draw captions in them on the canvas (`FontFace` loaded before render). Replaces the generic system-font fallback. Licensing settled before shipping (per spec).
- **Composition-aware placement.** The model already sees the photos, so it places the caption in negative space, off faces. Extends the existing `position` metadata; no new vision pass.
- **Authored band fallback.** When a photo has no clean space, a deliberate band in the story palette, committed per frame — reads as a cover-bar, not a fired fallback. ([7.13](../decisions.md#713-story-frames-look-designed-via-a-curated-static-look-not-a-filter))
- **Content-aware type fit.** Auto-fit the caption to a safe band: short caption → big, long caption → smaller, never overflowing. Replaces the s/m/l bucket × drag-scale guess.

**Render path.** All of the above runs in the canvas frame-renderer (1080×1920) — client-side, on the phone. The in-app preview mirrors the look via a CSS filter so it shows before export.

## Part B — Guided stickers ("Malen nach Zahlen")
The app can't post Instagram's stickers via API (hand-off). So it does not bake a flat sticker — it guides the user to place Instagram's own.

- Per frame, the model optionally emits element suggestions: `{ type, query, position }` — e.g. Location, GIF (search term), Poll / Question, Time, Mention.
- **In-app:** a placeholder marker (dashed outline + label) at the position — "GIF: search 'cake'", "Location here".
- **Export stays clean** (no baked marker); the placeholders become a guided post checklist at hand-off — "Add a Location sticker, place it bottom-left."
- Removes both decisions (what + where). Sibling of the music-search-term suggestion; extends the suggest-don't-bake pattern to stickers. ([7.14](../decisions.md#714-guided-stickers-the-ai-marks-what--where-the-user-places-instagrams-own))
- Sparse and optional — not every frame gets one.

## AI contract (metadata only, holds 7.10)
- Story-level `palette` (chosen from a small curated set, not free colour).
- Per-frame `position` reused for negative-space placement.
- Per-frame optional `stickers: [{ type, query, position }]`.
- Client composites everything (canvas + preview). No server render, no bucket.

## Build order
1. Content-aware type fit + self-hosted display type — biggest "not generic" lever, smallest surface.
2. Curated palette + neutral cohesion (canvas grade + grain).
3. Composition-aware placement + authored band.
4. Guided sticker placeholders (in-app markers + hand-off checklist).

Each step is its own PR.

## Deferred — the motion / reveal layer (not now)
Streaming "reading your photos" loading screen, caption entrance animation, Ken Burns push on photos, auto-play trailer. Parked as a separate later plan. The exported PNG can't carry motion, so this fixes in-app *feel*, not the shared artifact — a different problem from "the frame looks generic." ([7.15](../decisions.md#715-ship-the-static-look--guided-stickers-first-defer-the-motionreveal-layer))

## Constraints held
Web-only; client-side canvas (runs on the phone); hand-off, no API; Tailwind + Material for app chrome; metadata-only styling (7.10) — no server render, no image bucket.
