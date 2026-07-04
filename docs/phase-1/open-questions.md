# Open Questions — Phase 1: Create the Story

All the product / core-value questions are resolved (see `approach.md`, Chapter 2 — ordering, captions, and the first-open wow), and the P1 "will break or cost money" items are resolved (Chapter 4 — rate limiting, don't-trust-the-client). What remains is the lower-severity production-readiness list. (Resolved questions move to `approach.md` and are removed from here.)

## Production readiness — remaining (from the eng review)

All P1/P2 breakage items are resolved (Chapter 4) or sequenced to a later phase (lost-work-on-refresh → Phase 2). What's left is P3 hygiene.

**P3 — production hygiene**
1. **Health-check endpoint** (`/health` or `/api/health`) for Render/container readiness.
2. **Story-line input** — length cap + basic prompt-injection hygiene (it goes straight into the prompt).
3. **CI** to run the specified tests; the quality eval needs a baseline/rubric that doesn't exist yet.
4. **Client-side error capture** and a defined log destination/retention in production.
5. **Security headers** (CSP, etc.).
