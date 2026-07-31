# Auto Stories — Spec · Phase 3: The Recurring Journal

Phase 3 turns one-off story creation into an ongoing life journal on a cadence. Built last, once creating ([Phase 1](../phase-1/spec.md)) and posting ([Phase 2](../phase-2/spec.md)) are solid.

## Goal
Make the app something the user comes back to — it documents their life on a rhythm instead of waiting to be opened.

## Scope

**In scope:**
- **Cadence + reminders** — the user sets a frequency (every 2 days / weekly / monthly); the app sends email/push reminders to make a story for that period.
- **One-tap re-upload on the nudge** — the reminder returns the user to the upload step. A web app can't auto-scan a photo library, but on mobile the file input opens the **native photo picker** (multi-select, Recents-first), so grabbing the period's photos is a tap and a few selections — not a chore. This replaces the native "auto-surface" idea.
- **Accounts + persistence** — save the user's cadence and past stories (Phase 1's server is stateless; Phase 3 adds light persistence + auth).
- **Native app + per-card Instagram hand-off (deferred from Phase 2).** Package the Angular app with **Capacitor** and add a **Sharing to Stories** SDK plugin so posting is per-card and pre-loaded (background photo + movable caption sticker), wrapped in the resumable **"burn-down"** finalize UX (endowed progress; optimistic-mark on the Capacitor `resume` event + persistent Undo; goal-gradient). Adds the **QR "get the app"** desktop CTA and **Google Play–first** distribution. **Gated:** build only once Phase 2 web data shows the Select-Multiple hand-off actually loses users — the native path is higher-friction for multi-card, so it must be earned. Reasoning already worked out in [decisions Chapter 7](../decisions.md#chapter-7--phase-2-getting-the-story-onto-instagram) (7.2–7.9); phase split in [7.11](../decisions.md#711-phase-2-ships-web-only-native-app-and-per-card-hand-off-move-to-phase-3).

**Optional (deferred from Phase 1):**
- **Learn the user's voice** — over time, fine-tune caption tone from the captions the user edits/regenerates in the refine step (first-party signal, no extra access needed). Optional. (Reading the user's Instagram to learn voice was dropped — it needs Instagram access we don't have, the same wall as posting.)
- **Stream the story as it generates** — reveal frames one-by-one while the AI writes, instead of the staged preloader. Deferred here because it needs a reworked (streaming) generation call, and on Phase 1's few-second wait the gain didn't justify the complexity. Revisit only if it's worth it.

**Guiding principle:** the app documents life on a rhythm — it nudges, the user taps and picks the period's photos from the native picker (Recents-first makes "last week" fast).

## Open questions
See [`open-questions.md`](open-questions.md) in this folder — notably how cadence works given posting is a manual hand-off (Phase 2).
