# Open Questions — Phase 1: Create the Story

All the product / core-value questions are resolved (see `approach.md`, Chapter 2 — ordering, captions, and the first-open wow). What remains is the production-readiness list from the engineering review: what would break in production. (Resolved questions move to `approach.md` and are removed from here.)

## Production readiness — must address before it's robust (from the eng review)

**P1 — will break or cost money in production**
1. **Don't trust the client.** Downscale, the 10-photo cap, and type/size checks all run client-side. The server must enforce a max request body size, re-check photo count/size, and reject oversized/non-image payloads.

**P2 — realistic breakage**
2. **Gemini failure modes beyond the current table.** How do we handle 429 / daily-quota exhausted (what the user sees), safety-filter refusals (a flagged image failing the whole batch), and an explicit upstream call timeout (a hung Gemini call blocking the request)?
3. **Double-submit.** Disable Generate while a call is in flight so a double-click can't fire two Gemini calls (double cost + UI race).
4. **Mobile memory.** Ten large HEIC images through `heic2any` + canvas downscale can crash a low-end phone tab. Process sequentially / add a guardrail.
5. **Lost work on refresh.** Stateless + story-in-memory means an accidental refresh nukes uploads and the generated story. At least warn-on-unload or a sessionStorage draft.

**P3 — production hygiene**
6. **Health-check endpoint** (`/health` or `/api/health`) for Render/container readiness.
7. **Story-line input** — length cap + basic prompt-injection hygiene (it goes straight into the prompt).
8. **CI** to run the specified tests; the quality eval needs a baseline/rubric that doesn't exist yet.
9. **Client-side error capture** and a defined log destination/retention in production.
10. **Security headers** (CSP, etc.).
