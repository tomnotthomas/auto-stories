# Open Questions — Phase 1: Create the Story

Grouped by kind. Product questions shape the core value; the production-readiness
list came out of the engineering review and covers what would break in production.
(Resolved questions move to `approach.md` and are removed from here.)

## Product / core value
1. **What hooks the user on first open?** What moment in creating the first story makes a first-time user want to stay and come back?
2. **Should we show a quick demo video on first open?** A short clip showing how fast a story is made, to hook the user before they do anything.

## Production readiness — must address before it's robust (from the eng review)

**P1 — will break or cost money in production**
3. **Rate limiting / abuse.** `/api/v1/generate` is public (no accounts in Phase 1) and there's no throttle. One shared free-tier key = ~1,500 Gemini calls/day; anyone with the URL can exhaust it (app down for everyone + cost). Need a per-IP rate limit + a global daily budget guard.
4. **Don't trust the client.** Downscale, the 10-photo cap, and type/size checks all run client-side. The server must enforce a max request body size, re-check photo count/size, and reject oversized/non-image payloads.

**P2 — realistic breakage**
5. **Gemini failure modes beyond the current table.** How do we handle 429 / daily-quota exhausted (what the user sees), safety-filter refusals (a flagged image failing the whole batch), and an explicit upstream call timeout (a hung Gemini call blocking the request)?
6. **Double-submit.** Disable Generate while a call is in flight so a double-click can't fire two Gemini calls (double cost + UI race).
7. **Mobile memory.** Ten large HEIC images through `heic2any` + canvas downscale can crash a low-end phone tab. Process sequentially / add a guardrail.
8. **Lost work on refresh.** Stateless + story-in-memory means an accidental refresh nukes uploads and the generated story. At least warn-on-unload or a sessionStorage draft.

**P3 — production hygiene**
9. **Health-check endpoint** (`/health` or `/api/health`) for Render/container readiness.
10. **Story-line input** — length cap + basic prompt-injection hygiene (it goes straight into the prompt).
11. **CI** to run the specified tests; the quality eval needs a baseline/rubric that doesn't exist yet.
12. **Client-side error capture** and a defined log destination/retention in production.
13. **Security headers** (CSP, etc.).
