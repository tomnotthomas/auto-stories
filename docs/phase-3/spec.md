# Auto Stories — Spec · Phase 3: The Recurring Journal

Phase 3 turns one-off story creation into an ongoing life journal on a cadence. Built last, once creating ([Phase 1](../phase-1/spec.md)) and posting ([Phase 2](../phase-2/spec.md)) are solid.

## Goal
Make the app something the user comes back to — it documents their life on a rhythm instead of waiting to be opened.

## Scope

**In scope:**
- **Connect the account / streamline posting** — reduce the posting friction from Phase 2 for repeat use.
- **Posting cadence** — the user sets a frequency (every 2 days / weekly / monthly).
- **Auto-surface candidate photos** — on each cycle, the app pulls photos from that time window (e.g. last week if weekly) and nudges the user: "here's last week — make a story." The user still picks and reviews.
- **Persist preferences** — remember the user's settings so nothing is re-entered each time.

**Guiding principle:** sourcing candidates from the current time window (not the whole library) keeps it a living journal.

## Open questions
See [`open-questions.md`](open-questions.md) in this folder — notably how cadence works given posting is a manual hand-off (Phase 2).
