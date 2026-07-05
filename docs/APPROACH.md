# APPROACH

**Auto Stories** — turn a pile of photos into a well-ordered, well-captioned Instagram Story.

- **Live:** https://auto-stories.onrender.com/ (free tier — first hit after idle cold-starts ~30–50s)
- **Problem:** Option 2 — the mini-app I'd actually use.

**Docs (the detail behind this summary):**
- [`docs/decisions.md`](docs/decisions.md) — full decision log (Problem → Options → Decision → Why).
- Specs: [phase-1](docs/phase-1/spec.md) (built), [phase-2](docs/phase-2/spec.md), [phase-3](docs/phase-3/spec.md); open questions per phase.
- [Architecture](docs/phase-1/architecture.md) + [diagrams](docs/phase-1/diagrams/); API contract in [`openapi/`](openapi/).
- Design: [`design/mockups/design-board.html`](design/mockups/design-board.html) — every screen on one board.

## What I built & why

- I've no patience for Stories; mine are picture dumps. My girlfriend spends hours on one — ordering, writing, placing text.
- Auto Stories: pick photos + one line ("What's the story?") → AI returns which photos, what order, a caption each.
- Not a locked post — a strong first draft you refine (edit/move text, reorder, regenerate).
- Option 2's hard part is real to me: a good narrative call, in front of a user, on weird inputs, failing gracefully.

## Key decisions & tradeoffs

How I worked:
- **Phased, core first.** Phase 1 = create the story; 2 = posting; 3 = journal. Built and polished Phase 1 only.
- **Spec + architecture before code.** Wrote what/how up front, so I didn't re-align mid-build.

Three biggest calls (full reasoning in [`docs/decisions.md`](docs/decisions.md)):
- **Payoff-first flow, 6 steps → 2.** Example Story on open, then pick + one line → refine. Less config, far higher completion.
- **Narrative-first order, one model call.** Not chronological (EXIF stripped; oldest photo = boring). One structured Gemini call returns photos + order + captions. Better coherence, lower latency; no mid-stream reveal.
- **Free Gemini + one container on free Render.** Swappable model. Accept a shared quota + cold start — take-home calls, not production.

## Intentionally left out

- Auth + database (app is stateless by design).
- All of Phase 2 and Phase 3.
- Draft persistence, auto-posting via Instagram API, video, >10 photos, in-app music/GIFs/stickers.
- Did invest in hosting + prod hygiene (rate limits, server-side validation, typed errors, health check, security headers, CI smoke test) — "deploy it" was asked.

## What breaks first under pressure

- **Shared Gemini quota.** One free key (~1.5k/day). A global cap + per-IP limit soften it, but the key is the hard ceiling.
- **In-process limits don't survive scaling.** Container is stateless (scales fine), but the budget/rate counters live in memory → N replicas = N× the cap. Fix: move to Redis.
- **Cold start** (~30–50s after idle) — fine for a demo, not production.
- **Mobile memory** on large HEIC batches — mitigated by sequential decode → downscale → release.
- **Model quality** on valid-but-mediocre output — swappable model + refine are the backstops. (Flagged photo dropped, story rebuilt from ≥3; hung call hits a 25s timeout; each failure maps to a typed error.)

## What's next

- Roadmap is already specced: [Phase 2](docs/phase-2/spec.md) (hand-off posting + music search) and [Phase 3](docs/phase-3/spec.md) (recurring journal).
- Not yet in specs: accounts + DB (per-user limits, cross-device sync), move limit state to Redis, a paid always-on tier.
