# Auto Stories — Phase 1 Architecture

How Phase 1 ([spec](spec.md)) is built and deployed: a responsive **web app** where the user uploads photos + a line of intent and gets back an ordered, captioned story, previewed with draggable captions. Reasoning lives in [`approach.md`](../approach.md) (Chapter 2).

## Decisions at a glance

| # | Decision | Choice |
|---|----------|--------|
| 2.1 | Where AI runs | Server-side (Express) holds the key; browser never sees it |
| 2.2 | Model | Gemini Flash, free tier, swappable via config |
| 2.3 | Generation shape | Single structured call (pipeline = fallback) |
| 2.4 | Image input | Cap ~10 photos, downscale ~1024px/JPEG80, keep originals |
| 2.5 | Stack | Angular frontend + Node/Express API (one origin) |
| 2.6 | Deploy | One Docker container (Express serves the build + API) + `docker-compose`; hosted free on Render |
| 2.8 | State | Angular service holding the story in signals |
| 2.10 | Component library | Angular Material (+ CDK harnesses for tests) |

## System architecture

![System architecture: browser → Express API → Gemini Flash](diagrams/system-architecture.png)

The browser never holds the API key. The Express server is stateless — no database in Phase 1; a story lives only in browser memory until the user exports it (Phase 2).

## Data flow (one generation)

![Data flow for one generation, from upload to rendered story](diagrams/data-flow.png)

## Components

**Frontend (Angular + Angular Material, responsive)** — tailored to look great on laptop, tablet, or phone:
- Photo **upload** — `<input type="file" accept="image/*" multiple>`: on mobile this opens the OS **native photo picker** (multi-select, Recents-first — feels native, no library-scan permission needed); on desktop, drag-drop + click-to-browse + paste.
- **EXIF timestamps** read client-side (`exifr`) for chronological ordering + caption context.
- **Downscale** in the browser (canvas / `browser-image-compression`) to the proxy sent to the server.
- Preview: ordered photos with a draggable/resizable caption layer (Angular **CDK drag-drop**). No pixel baking in Phase 1.
- State in a small Angular **service (signals)**.

**Backend (Node/Express, `POST /api/generate`)** — also serves the built Angular app from the same origin. Server-side, so the Gemini key stays hidden and users never bring their own key. Jobs: input validation, prompt construction, the Gemini call, output validation, logging.

**Model (Gemini Flash)** — called via the `@google/genai` SDK with `responseSchema` for guaranteed-shape JSON. `MODEL` is an env var, so a stronger model is a one-line swap.

## The generation contract

**Request** `POST /api/generate`
```json
{ "intent": "weekend hike, funny tone",
  "photos": [ { "id": "p1", "b64": "<downscaled jpeg>", "takenAt": "2026-07-04T09:12:00Z" } ] }
```

**Model responseSchema (enforced JSON)**
```json
{ "frames": [ { "photoId": "p1", "order": 1, "caption": "..." } ] }
```

The model may **select a subset** and **reorder**, returning only chosen photos with an explicit `order`. The prompt: use timestamps for chronology, write specific (not generic) captions grounded in what's visible + the intent, aim for a beginning → middle → payoff arc.

## Data model (client)

```
Photo  { id, objectURL (full-res upload), width, height, takenAt }
Frame  { photoId, order, caption, textPos {x,y}, textScale }
Story  { id, intent, frames: Frame[], createdAt }
```

## Deployment

- **App:** one Node/Express server serves the built Angular app (`dist/`) and the `/api/generate` endpoint. Provide a **`docker-compose.yml`** so reviewers can `docker compose up` in a fresh Linux container, and host the same image **free on Render** (spins down when idle; ~30-50s cold start on first hit) for a live URL — both required by the brief.
- **Secrets:** `GEMINI_API_KEY` and `MODEL` are server-side env vars only. The browser bundle contains no key.

## Edge cases & failure modes

| Case | Handling | User sees |
|------|----------|-----------|
| No photos uploaded | Disable Generate | Greyed button + hint |
| 1–2 photos | Allow, nudge | "Add a few moments for a fuller story" |
| >10 uploaded | Enforce cap at upload | "Up to 10 photos per story" |
| HEIC upload (iPhone) | Convert client-side (`heic2any`) before downscale/preview | Transparent; else "couldn't read this photo" |
| Huge / non-image file | Validate type + size at upload | "Please upload images under N MB" |
| Network fail / timeout | Retry w/ backoff (2×), then stop | "Couldn't reach the story engine — retry" |
| Model returns invalid JSON | `responseSchema` + parse guard; 1 stricter retry | Error copy if still bad |
| Model returns unknown photoId | Server drops unknown ids, keeps valid frames | Story with valid frames only |
| Model returns 0 usable frames | Typed empty result | "Couldn't shape a story — try different photos" |
| Generic / weak captions | Prompt forces specificity; Regenerate + inline edit | Regenerate + edit |
| Slow generation | Staged loader | "Reading photos… ordering… writing captions…" |

## Observability

The Express server logs per request: `requestId`, `model`, photo count, `latencyMs`, token usage, outcome (`ok` / `invalid_json` / `empty` / `upstream_error`). Makes "the model was wrong" visible instead of silent.

## Testing strategy

Model is non-deterministic, so test **plumbing deterministically**, **quality separately**:
- **Unit** — downscale util, prompt builder, response validator (schema, unknown ids, duplicate order, empty caption).
- **Component** — Angular components via **CDK component harnesses** (upload, preview, caption drag/edit).
- **Contract** — Express `/api/generate` against mock Gemini responses (valid / malformed / hallucinated id / empty) → each maps to the right outcome.
- **E2E** — Cypress/Playwright: upload → generate → render against a stubbed API.
- **Quality eval** — fixed sample photo sets + intents → real model → rubric-score ordering + caption specificity. Run on model/prompt change.

## How this extends to Phase 2 & 3

- **Phase 2 (get it onto Instagram)** — render each `Frame` (original + positioned caption) into a 1080×1920 image the user **downloads** (or shares via the Web Share API on mobile), then posts from their phone. No server change. Adds a music-suggestion field to the same response.
- **Phase 3 (recurring journal)** — email/push reminders on a cadence; a web app can't auto-scan a photo library, so the user re-uploads when nudged — one tap into the same native photo picker (Recents-first makes grabbing the period's photos quick). Adds light persistence + accounts.

The architecture is a straight line (browser → one API route → model), so Phases 2–3 bolt on without a redesign.

## Open decisions to confirm

1. **Latency UX** — staged loader now; streaming later?
2. **1–2 photo stories** — allow with a nudge, or require a minimum (e.g. 3)?
