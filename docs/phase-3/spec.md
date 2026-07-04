# Auto Stories — Spec · Phase 3: The Recurring Journal

Phase 3 turns one-off story creation into an ongoing life journal on a cadence. Built last, once creating ([Phase 1](../phase-1/spec.md)) and posting ([Phase 2](../phase-2/spec.md)) are solid.

## Goal
Make the app something the user comes back to — it documents their life on a rhythm instead of waiting to be opened.

## Scope

**In scope:**
- **Cadence + reminders** — the user sets a frequency (every 2 days / weekly / monthly); the app sends email/push reminders to make a story for that period.
- **One-tap re-upload on the nudge** — the reminder returns the user to the upload step. A web app can't auto-scan a photo library, but on mobile the file input opens the **native photo picker** (multi-select, Recents-first), so grabbing the period's photos is a tap and a few selections — not a chore. This replaces the native "auto-surface" idea.
- **Accounts + persistence** — save the user's cadence and past stories (Phase 1's server is stateless; Phase 3 adds light persistence + auth).
- **Streamlined re-posting** — reduce Phase 2's hand-off friction for repeat use.

**Guiding principle:** the app documents life on a rhythm — it nudges, the user taps and picks the period's photos from the native picker (Recents-first makes "last week" fast).

## Open questions
See [`open-questions.md`](open-questions.md) in this folder — notably how cadence works given posting is a manual hand-off (Phase 2).
