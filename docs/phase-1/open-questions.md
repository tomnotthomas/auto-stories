# Open Questions — Phase 1: Create the Story

All the product / core-value questions are resolved (see `approach.md`, Chapter 2 — ordering, captions, and the first-open wow), and the P1 "will break or cost money" items are resolved (Chapter 4 — rate limiting, don't-trust-the-client). What remains is the lower-severity production-readiness list. (Resolved questions move to `approach.md` and are removed from here.)

## Production readiness — remaining (from the eng review)

**P2 — realistic breakage**
1. **Mobile memory.** Ten large HEIC images through `heic2any` + canvas downscale can crash a low-end phone tab. Process sequentially / add a guardrail.
2. **Lost work on refresh.** Stateless + story-in-memory means an accidental refresh nukes uploads and the generated story. At least warn-on-unload or a sessionStorage draft.

**P3 — production hygiene**
3. **Health-check endpoint** (`/health` or `/api/health`) for Render/container readiness.
4. **Story-line input** — length cap + basic prompt-injection hygiene (it goes straight into the prompt).
5. **CI** to run the specified tests; the quality eval needs a baseline/rubric that doesn't exist yet.
6. **Client-side error capture** and a defined log destination/retention in production.
7. **Security headers** (CSP, etc.).
