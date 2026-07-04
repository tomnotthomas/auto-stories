# Auto Stories — Phase 1 Architecture

How Phase 1 ([spec](spec.md)) is built and deployed: turn a batch of photos + a line of intent into an ordered, captioned story, previewed in-app with draggable captions. Reasoning for the decisions lives in [`approach.md`](../approach.md) (Chapter 2).

> **Decisions made without you (you were on a break) — confirm on return:** app framework (Expo), backend host (serverless function, default Vercel), latency UX (single staged loader), and the data model below. Everything is reversible; flagged again in the last section.

## Decisions at a glance

| # | Decision | Choice | Status |
|---|----------|--------|--------|
| 2.1 | Where AI runs | Thin backend proxy (phone → backend → model) | Locked with you |
| 2.2 | Model | Gemini Flash, free tier, swappable via config | Locked with you |
| 2.3 | Generation shape | Single structured call (pipeline = fallback) | Locked with you |
| 2.4 | Image input | Cap ~10 photos, downscale ~1024px/JPEG80, keep originals | Locked with you |
| 2.5 | App framework | Expo (React Native) | Decided — confirm |
| 2.6 | Backend host | Stateless serverless HTTP function (default Vercel; GCP Cloud Run alt) | Decided — confirm |
| 2.7 | Latency UX | One call + staged loader copy (stream later) | Decided — confirm |
| 2.8 | State | Local React state, no heavy store | Decided — confirm |

## System architecture

![System architecture: phone app → serverless backend → Gemini Flash](diagrams/system-architecture.png)

The phone never holds the API key and never talks to Gemini directly. The backend is stateless — no database in Phase 1; a story lives only in app memory until the user posts it (Phase 2).

## Data flow (one generation)

![Data flow for one generation, from photo pick to rendered story](diagrams/data-flow.png)

## Components

**Mobile app (Expo / React Native)** — one codebase for iOS + Android; rich, boring libraries for the exact jobs Phase 1 needs:
- `expo-image-picker` — select photos.
- `expo-media-library` — read EXIF timestamps for chronological ordering + caption context.
- `expo-image-manipulator` — downscale/compress the proxy sent to the backend.
- Preview screen: renders the ordered photos with an absolutely-positioned, draggable/resizable caption layer (react-native `PanResponder` / Reanimated). No pixel baking in Phase 1.

**Backend (stateless serverless HTTP function, Node/TS)** — one endpoint, `POST /generate`. Its jobs: input validation, prompt construction, the Gemini call, output validation, and logging. It exists so the key is server-side and so retries/validation/observability live in one place (spec-graded: "AI holds up in front of a real user").

**Model (Gemini Flash)** — called via the `@google/genai` SDK with `responseSchema` for guaranteed-shape JSON. `MODEL` is an env var so a stronger model is a one-line swap.

## The generation contract

**Request** `POST /generate`
```json
{
  "intent": "weekend hike with friends, funny tone",
  "photos": [
    { "id": "p1", "b64": "<downscaled jpeg>", "takenAt": "2026-07-04T09:12:00Z" }
  ]
}
```

**Model responseSchema (enforced JSON)**
```json
{
  "frames": [
    { "photoId": "p1", "order": 1, "caption": "..." }
  ]
}
```

The model may **select a subset** and **reorder** — it returns only chosen photos with an explicit `order`. The prompt instructs: use timestamps for chronology, write specific (not generic) captions grounded in what's visible + the intent, and aim for a beginning → middle → payoff arc.

## Data model (app)

```
Photo    { id, uri (full-res original), width, height, takenAt }
Frame    { photoId, order, caption, textPos {x,y}, textScale }
Story    { id, intent, frames: Frame[], createdAt }
```

`textPos` / `textScale` default from the model-agnostic placement rule (lower third + legibility background) and are updated as the user drags/resizes.

## Deployment

**Backend** — deploy the single function to **Vercel** (`vercel deploy`): free tier, scales to zero, one HTTPS URL, env vars for `GEMINI_API_KEY` and `MODEL`. (Alternative, same-ecosystem-as-Gemini option: **Google Cloud Run** — containerize the Node app, `gcloud run deploy`. Pick one; reversible.) The app reads the backend URL from its own config/env.

**Mobile app** — Expo. Local dev in **Expo Go**; shareable builds via **EAS Build** (iOS + Android). For the take-home, a dev build / Expo Go demo is enough; TestFlight + Android APK via EAS if a wider test is wanted.

**Config / secrets**
```
Backend env:  GEMINI_API_KEY   (secret, backend only)
              MODEL            (e.g. gemini-flash-latest)
App config:   BACKEND_URL      (the deployed function URL)
```

## Edge cases & failure modes

| Case | Handling | User sees |
|------|----------|-----------|
| Photo permission denied | Detect on pick; deep-link to Settings | "Allow photo access to build a story" + button |
| 0 photos selected | Disable Generate | Greyed button + hint |
| 1–2 photos | Allow, but nudge | "Pick a few moments for a fuller story" |
| >10 selected | Enforce cap in picker | "Up to 10 photos per story" |
| Network fail / timeout | Retry w/ backoff (2×), then stop | "Couldn't reach the story engine — retry" |
| Model returns invalid JSON | `responseSchema` + parse guard; 1 stricter-prompt retry | Falls through to error copy if still bad |
| Model returns unknown photoId | Backend drops unknown ids, keeps valid frames | Story with valid frames only |
| Model returns 0 usable frames | Backend returns typed empty result | "Couldn't shape a story from these — try different photos" |
| Generic / weak captions | Prompt forces specificity; user can Regenerate or edit | Regenerate + inline edit |
| Slow generation | Staged loader (see latency) | "Reading photos… ordering… writing captions…" |

## Observability

Backend logs per request: `requestId`, `model`, photo count, `latencyMs`, token usage, and an outcome (`ok` / `invalid_json` / `empty` / `upstream_error`). This is what makes "the model was wrong" visible instead of silent — the graded failure surface.

## Testing strategy

Because the model is non-deterministic, test the **plumbing deterministically** and the **quality separately**:
- **Unit** — downscale util (dimensions/quality), prompt builder, response validator (schema, unknown ids, duplicate order, empty caption).
- **Contract** — backend against recorded/mock Gemini responses: valid, malformed JSON, hallucinated photoId, empty frames → each maps to the right outcome above.
- **E2E** — app flow pick → generate → render against a stubbed backend (deterministic frames).
- **Quality eval (the graded part)** — a small harness: fixed sample photo sets + intents → run real model → eye/rubric-score ordering and caption specificity. Run when changing model or prompt.

## How this extends to Phase 2 & 3

- **Phase 2 (post to Instagram)** — adds a client-side renderer that bakes each `Frame` (original photo + positioned caption) into a 1080×1920 image, saves to camera roll, opens Instagram. **No backend change** — the app already holds originals + captions + placement. Also adds a music-suggestion field to the generation response (cheap, same call).
- **Phase 3 (recurring journal)** — adds local notifications (cadence) and a media-library query for "photos in the last window," feeding the same `/generate` endpoint. May add light persistence for cadence/preferences; the generation core is unchanged.

The architecture is deliberately a straight line (app → one endpoint → model) so Phases 2–3 bolt on without a redesign.

## Diagram sources

The diagrams above are generated. Each has an editable source under [`diagrams/`](diagrams/): `*.mmd` (mermaid source, the source of truth), `*.svg` (crisp vector), `*.png` (embedded above), and `*.excalidraw` (open at excalidraw.com to edit, then re-render). Edit the `.mmd` and re-render rather than hand-editing the images.

## Open decisions to confirm

1. **Backend host** — Vercel (simplest) vs Google Cloud Run (one ecosystem with Gemini/keys). Defaulted to Vercel.
2. **Latency UX** — staged loader now; add streaming/progressive frame reveal later? Defaulted to loader.
3. **1–2 photo stories** — allow with a nudge, or require a minimum (e.g. 3)? Defaulted to allow.
