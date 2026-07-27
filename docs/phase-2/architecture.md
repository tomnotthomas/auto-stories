# Auto Stories — Phase 2 Architecture: async generation

How Phase 2 raises the pick to **30 photos** without hitting Render's request timeout. Generation moves from one synchronous HTTP call to an **async job**: the request enqueues work and returns immediately; the finished story is pushed back over **Server-Sent Events (SSE)**. Reasoning lives in [`decisions.md`](../decisions.md) (Chapter 6). This builds on the Phase 1 architecture ([phase-1/architecture.md](../phase-1/architecture.md)) and changes only the transport — the model call itself is unchanged.

## Decisions at a glance

| # | Decision | Choice |
|---|----------|--------|
| 6.1 | Long generations | Async job — `POST /generate` returns `202 { jobId }`, work runs in the background |
| 6.2 | Queue | In-memory, one worker (concurrency 1); fits the single free-tier container; jobs lost on restart are accepted |
| 6.3 | Result delivery | SSE (`GET /jobs/:id/events`), not polling or a webhook (a webhook can't reach a browser) |
| 6.4 | Photo size | Unchanged — 30 photos already fit the `50mb` body cap; no extra downscaling |
| 6.5 | Story from up to 30 photos | **One call.** Flash accepts far more than 30 images/request; ship 30 on the single call. Describe-then-decide pipeline dropped — fallback only if a quality eval shows degradation |

## System architecture

![Phase 2 system architecture: Angular web app → NestJS backend (in-memory queue) → multimodal AI model; POST enqueues a job, the story is pushed back over SSE](diagrams/system-architecture.png)

The browser never holds the API key (Phase 1, 3.1). The server stays stateless apart from the **in-memory job map**, which lives only for a job's lifetime — no database.

## Job lifecycle

```
POST /api/v1/generate ──▶ JobService.enqueue()  ──▶ 202 { jobId }   (returns immediately)
                              │  Map<jobId, BehaviorSubject<JobState>>
                              │  FIFO, one worker at a time (concurrency 1)
                              ▼
             consumeDailyBudget() ▶ StoryGeneratorService.generate() ▶ update state
                              │
GET /api/v1/jobs/:id/events (SSE) ◀── BehaviorSubject replays current state on (re)connect
   state:  queued ─▶ processing ─▶ done { result } | failed { error }
   stream completes on a terminal state; ~15s heartbeat comment keeps it open through Render's proxy
   unknown id (evicted / container spun down) ─▶ 404 ─▶ client shows "expired, generate again"
```

Concurrency 1 serialises jobs, which bounds memory (up to 30 downscaled proxies per job) and protects the shared free Gemini key — the same intent as the daily budget cap (Phase 1, 4.1). The budget is reserved when the job actually runs, not at enqueue, so a queued job that never runs never spends it.

## The generation contract

**Request** `POST /api/v1/generate` — unchanged body (story + tone + up to 30 photos), new response:
```json
{ "jobId": "b1f2…" }        // 202 Accepted
```

**Result stream** `GET /api/v1/jobs/:id/events` (SSE, `text/event-stream`) — pushes each state; the terminal event carries the `GenerateResponse` (`frames` + `partial`) or a typed `ErrorResponse`.

**Status** `GET /api/v1/jobs/:id` — the same `JobState` as JSON, for a polling fallback and debugging. Both job routes `404` on an unknown id.

## Failure modes

| Path | Failure | Handling | User sees |
|------|---------|----------|-----------|
| SSE connection | Render proxy idle-closes a quiet stream | ~15s heartbeat comment | nothing (transparent) |
| SSE reconnect | job evicted / container spun down mid-job | job routes `404` | "This story expired — generate again" |
| Job worker | model call throws (timeout / quota / safety) | caught → `failed { error }` pushed over SSE | existing typed error copy (Phase 1, 4.3) |
| Enqueue | daily budget spent | `consumeDailyBudget` throws in the worker → `failed` | "At capacity today" |
| Client | tab closed mid-job | job runs to completion, evicted after a short TTL | n/a |

## Deployment / ops

Nothing new to deploy: the queue and SSE live inside the one NestJS container (Phase 1, 3.6). SSE keeps a connection open, so the container stays awake for the duration of a job (no mid-job spin-down under active use). Free-tier logs stay stdout/stderr (Phase 1, 4.12). Production upgrade path (not built): swap the in-memory job map for **Redis + BullMQ** for durability across restarts and instances — the SSE contract is unchanged.

## Not built here (deferred fallback)

- **Describe-then-decide pipeline** (`decisions.md` 6.5) — **dropped**, kept on record only as the fallback if the single-call quality eval (`apps/api/scripts/eval-single-call`) later shows selection/captions degrade at 20–30 photos.
- **EXIF `takenAt`** and **budget re-accounting** — would land with that pipeline, not before.
