# Open Questions — Phase 1: Create the Story

All the product / core-value questions are resolved (see `approach.md`, Chapter 2 — ordering, captions, and the first-open wow), and the P1 "will break or cost money" items are resolved (Chapter 4 — rate limiting, don't-trust-the-client). What remains is the lower-severity production-readiness list. (Resolved questions move to `approach.md` and are removed from here.)

## Production readiness — remaining (from the eng review)

**P2 — realistic breakage**
1. **Lost work on refresh.** Stateless + story-in-memory means an accidental refresh nukes uploads and the generated story. At least warn-on-unload or a local draft.

**P3 — production hygiene**
2. **Health-check endpoint** (`/health` or `/api/health`) for Render/container readiness.
3. **Story-line input** — length cap + basic prompt-injection hygiene (it goes straight into the prompt).
4. **CI** to run the specified tests; the quality eval needs a baseline/rubric that doesn't exist yet.
5. **Client-side error capture** and a defined log destination/retention in production.
6. **Security headers** (CSP, etc.).
