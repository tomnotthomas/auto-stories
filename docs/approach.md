# Approach

How this project was thought through, in chapters, so a reader can jump to the part they care about. (the `phase-*/spec.md` files = *what* we build; this = *how* I got there.)

## Contents
1. [Figuring out what to build](#chapter-1--figuring-out-what-to-build)
2. [How the core value is created](#chapter-2--how-the-core-value-is-created)
3. [Locking the Phase 1 architecture](#chapter-3--locking-the-phase-1-architecture)
4. [Production readiness](#chapter-4--production-readiness)

---

# Chapter 1 — Figuring out what to build

The problems I hit while shaping the product, the options, and what I picked.

### 1.1 Too many steps before the user sees value
- **Problem:** My first flow had 6 steps before any result (connect, persona, frequency, candidates, generate, review). Nothing pays off on first open.
- **Options:** keep the 6-step flow; auto-generate a story instantly; reverse the flow so the story comes first and config comes last; start with a single-photo caption.
- **Decision:** Reverse the flow into 3 steps, payoff before config.
- **Why:** ~72% of users finish a 3-step onboarding vs ~16% at 7 steps ([source](https://userpilot.com/blog/aha-moment/)). The single-photo idea was dropped because one description isn't a story.

### 1.2 How much to automate the story
- **Problem:** Should the app pick photos and generate a story on its own, or should the user give input first?
- **Options:** fully automatic (app scans the library, picks images, generates); user picks photos + states intent.
- **Decision:** The user picks the photos and states intent.
- **Why:** On first use the user doesn't trust the app yet, hasn't said what they want the story to express, and an app auto-accessing the whole photo library and picking images feels invasive.

### 1.3 Can we post to Instagram automatically?
- **Problem:** The idea assumes posting Stories. Is that possible via the API?
- **Options:** use the Instagram publishing API; don't post automatically.
- **Decision:** No auto-posting.
- **Why:** It needs a business account + Facebook Page + Meta app review (weeks) — too heavy for an MVP.

### 1.4 If not automatic, how does the story reach Instagram?
- **Problem:** Without API posting, how does a finished multi-frame story get onto Instagram?
- **Options:** render one video and share it (Instagram auto-splits); per-frame deep link; save frames to the camera roll and multi-select in Instagram.
- **Decision:** Save frames → open Instagram → user multi-selects and posts.
- **Why:** A single video becomes a reel, not a story. A per-frame deep link is too many steps for a multi-frame story. Multi-select posts all frames at once and keeps me in control.

### 1.5 Where does the text go, and who places it?
- **Problem:** Captions go on the frame, but I don't want text covering the photo or landing in a bad spot.
- **Options:** app bakes text in a fixed spot; AI analyzes the image and places the text; user places the text.
- **Decision:** AI writes the text; the user drags/resizes it.
- **Why:** Letting AI find the best spot needs image analysis — overkill for an MVP. Placing it myself avoids bad positions and gives a custom feel.

### 1.6 Music and native extras
- **Problem:** Stories usually have music, GIFs, and stickers. Can the app add them?
- **Options:** build them into the app; leave them to Instagram; suggest them.
- **Decision:** No audio/GIFs/stickers in the app; the app suggests music (what to search for); the user adds the rest in Instagram.
- **Why:** Instagram's music is licensed and only works inside Instagram; animated/interactive elements can't bake into a still frame.

### 1.7 One product or two?
- **Problem:** The app was trying to serve both private memory-keeping and business growth/selling with one flow.
- **Options:** support both via a persona toggle; pick one for the MVP.
- **Decision:** Private memory journal only.
- **Why:** Journaling and business growth are different products (different voice, cadence, success metrics). A limited MVP should do one well; the private journal is the truer wedge.

### 1.8 Photos or also videos?
- **Problem:** Assumptions said both photos and videos, but the whole text-baking + posting model is built around still frames.
- **Options:** support video in v1; photos only.
- **Decision:** Photos only for v1.
- **Why:** Baking text onto video and handling it through the frame/multi-select model is heavier work, not needed to prove the core value.

### 1.9 Build it all at once, or in phases?
- **Problem:** The graded/hardest part is the story creation (which photo first, and the captions that connect them). Posting and the recurring journal are plumbing that don't show that off.
- **Options:** build the whole app; phase it and build the core first.
- **Decision:** Phase it. Phase 1 = create the story (pick + intent → generate → refine). Phase 2 = post via hand-off. Phase 3 = the recurring journal.
- **Why:** Get the hard part great first; only extend once the app reliably produces a story worth posting. Spec split into `phase-1/spec.md`, `phase-2/spec.md`, `phase-3/spec.md`.

### 1.10 How I organize the work
- **Problem:** Facing every feature and open question at once is overwhelming; hard to tell what matters now vs later.
- **Options:** one big spec + one question list; break the work into phases, each with its own scoped deliverables and docs.
- **Decision:** Break the project into phases, and give each phase its own folder with a scoped spec and its own open questions.
- **Why:** Compartmentalizing lets me focus on the current phase and ignore future concerns until they're relevant.

### 1.11 Minimum number of photos
- **Problem:** How few photos can still make a story?
- **Options:** allow 1–2 with a nudge; require a minimum of 3.
- **Decision:** Require at least 3 photos (Generate stays disabled below 3).
- **Why:** A story is a sequence with a beginning, a middle, and a payoff, so it needs at least 3 frames; 1–2 photos is a post, not a story. This is an assumption about what counts as a story.

---

# Chapter 2 — How the core value is created

The decisions that make the generated story *good*: which photo leads, how the photos are ordered, and how the captions are written. This is the graded core, so it comes before the architecture that delivers it. These resolve the open questions in [`phase-1/open-questions.md`](phase-1/open-questions.md).

### 2.1 How is the story ordered?
- **Problem:** Turning a pile of photos into a well-sequenced story. What signal decides the order — time, content, or the story the user wants?
- **Options:** chronological-first (order by EXIF `takenAt`, content breaks ties); narrative-first (the user says what the story is; the model orders the photos into an arc from content, timestamps optional); let the user pick a mode (Story flow vs Timeline).
- **Decision:** Narrative-first. The user's one line — **"What's the story?"** — plus the images drive the order into an arc: strongest hook first → build → payoff. Timestamps are an optional soft hint only. Manual drag-to-reorder stays as the refine escape hatch.
- **Why:** Chronological-first breaks silently when EXIF is stripped (common on screenshots and messaging-app uploads) and the user can't tell why it's wrong. Strict time order also tells a worse story — the chronologically-first photo is often the most boring, when a Story needs the most attention-grabbing photo first to hook the viewer. Order is already emergent from the single call (3.3), so this is a prompt-design choice, not a new pipeline. The mode-picker (option C) was cut: it adds a choice most users won't touch, Timeline reproduces the boring-first-photo problem, and Story flow feels more custom — the better fit for the MVP. (A Timeline mode is a possible later add, not now.)
- **Also:** the step-1 field is renamed from the vague "intent/vibe" to **"What's the story?"** — one plain line about what happened and the feeling, which drives both ordering and captions.

### 2.2 How does the AI get enough context for good captions?
- **Problem:** A good caption references what actually happened (names, occasion, place, tone), but the model only sees pixels + the one "What's the story?" line. Is that enough, or does it write generic captions?
- **Options:** rely on pixels + the one line; add a couple of typed questions up front; keep one **guided** line ("What's the story?") with an example placeholder + one **optional tone chip**.
- **Decision:** One guided "What's the story?" line with an example placeholder that coaxes specifics (names/occasion/place), plus one optional tone chip (Funny / Heartfelt / Hype / Chill). No multi-question form.
- **Why:** We don't want to ask the user too many questions, and we don't want a generic result. More questions add friction before the payoff (against 1.1) and tend to collect generic answers ("fun") that just duplicate the story line. A guided line trains a specific answer at zero added friction, and one tone chip adds the undertone free text usually omits in a single tap. One question — "What's the story?" — with an undertone is enough customization for a nice story.
- **Later (Phase 3, optional):** learn the user's voice from the captions they edit/regenerate in the refine step (first-party signal). Reading their Instagram to learn voice was considered and dropped — it needs Instagram access we don't have (same wall as posting).

### 2.3 The first wow — how do we hook the user on first open?
- **Problem:** Cutting the flow 7→3 (1.1) keeps the user in; now we need the first *wow* in the first seconds, before they do any work.
- **Options:** an empty uploader (blank state); a passive demo video; an interactive example — show a finished Story first, then lead to "Try it with your photos."
- **Decision:** Interactive example-first. On first open, show a finished, swipeable example Story (real output, not a clip) with one CTA — **"Try it with your photos"** → straight to upload. No demo video.
- **Why:** A blank canvas is silent churn; pre-filled examples get users to value faster (Notion templates, Sprout Social's fake-data demo) ([appcues](https://www.appcues.com/blog/aha-moment-examples), [chameleon](https://www.chameleon.io/blog/successful-user-onboarding)). Interactive demos beat passive video — Grammarly shows the product working live rather than a clip ([appcues](https://www.appcues.com/blog/shortening-your-time-to-wow)) — and users who hit an interactive demo are ~80% more likely to complete the next steps ([userpilot](https://userpilot.com/blog/saas-signup-flow/)). An interactive example lets the user feel the platform, see exactly what to expect, and gauge how well it works — cutting the uncertainty a video can't. It's cheap (bundle sample photos + one pre-generated story) and matches the value-first flow (1.1) and the narrative-first reveal (2.1).

---

# Chapter 3 — Locking the Phase 1 architecture

The technical decisions for building Phase 1 (create the story).

### 3.1 Where does the AI run?
- **Problem:** The app needs to send photos to a vision model and get a story back. Where does that call happen?
- **Options:** run a model on-device; call a hosted model API directly from the phone; call it through a backend I control.
- **Decision:** A server-side API route holds the key; the browser calls it, never the model directly.
- **Why:** Keeping the key server-side means users never bring their own key (zero-friction first use), and the server is the deployable/containerized artifact the brief asks for. It's also the one place for validation, retries, and logging. (Not on-device inference — that would exclude weaker devices.)

### 3.2 Which model?
- **Problem:** Need a vision model with good quality-to-price, ideally free for an assignment.
- **Options:** Claude, OpenAI, or Google Gemini.
- **Decision:** Gemini Flash on the free tier, with the model as a swappable config value.
- **Why:** Gemini is the only major provider with vision on the free tier (~1,500 requests/day — plenty for personal use), and it's fast and cheap. Recognizing photos, ordering them, and writing captions is low-risk, so the free model is fine. If quality disappoints, I swap in a stronger model via config with no app changes.

### 3.3 Single call or a multi-step pipeline?
- **Problem:** How do photos + intent become {which photos, what order, a caption each}?
- **Options:** one structured call that returns everything; a pipeline (describe → order → caption).
- **Decision:** A single structured call.
- **Why:** The model reasoning over all photos at once gives better narrative coherence (a pipeline that orders from text descriptions throws away the images at the step that matters most). One round trip also means lower latency. The swappable model is my quality dial; a pipeline is a documented last resort if a strong model still can't hold quality.

### 3.4 How many photos, and what size?
- **Problem:** Cameras differ (a new phone shoots huge images); sending everything is slow and costly.
- **Options:** send originals as-is; cap the count and downscale before sending.
- **Decision:** Cap the pick at ~10 photos; downscale each to **~1024px long edge, JPEG ~80%, aspect preserved** before sending; keep the full-res originals on the device.
- **Why:** Google recommends ≤10 images for good image *understanding*, which also matches a Story's natural length. 1024px is ~2 of Gemini's 768px tiles (~500 tokens/image), so ten photos is trivial against the free-tier budget — the real saving is upload speed, the biggest lever on how fast the story appears. It's also enough detail for the model to get the gist (below ~512px, faces and in-photo text blur and captions get less accurate). Downscaling normalizes every camera to one size. The originals stay on device: the model reads a small proxy, but captions are placed on the real photos the user sees and later posts (Phase 2).

> Decisions 3.5–3.8 were made while I was on a break; confirm or override them. Full architecture in [`phase-1/architecture.md`](phase-1/architecture.md).

### 3.5 Stack
- **Problem:** Need a maintainable frontend, a server that hides the key, and a structure a new developer can onboard into fast (scaling likely means more developers).
- **Options:** frontend — Next.js / plain React (Vite) / Angular; backend — a minimal Express server / NestJS.
- **Decision:** Angular frontend + NestJS backend.
- **Why:** Both enforce a fixed structure, so the codebase stays consistent and a new developer onboards fast. Express and plain React are unopinionated — each codebase differs; Angular fixes the frontend layout (and ships CDK test harnesses), NestJS fixes a modules/controllers/providers layout. They share the same building blocks (modules, DI, decorators). The server hides the Gemini key and serves the built app from one origin.

### 3.6 Deploy
- **Problem:** The brief wants a live URL and code that runs in a fresh Linux container.
- **Options:** Vercel (serverless, not our container); Railway (no free tier — trial credit then paid); Render (real free tier, no card); Fly (free tier gone).
- **Decision:** One Docker container — NestJS serves the built Angular app + `/api/v1/generate` — with a `docker-compose.yml`, hosted **free on Render**.
- **Why:** I don't want to pay for a take-home. Render is the only one of these with a genuine free tier and no credit card, and it runs our Docker image directly (the same one reviewers run via compose). The only cost is a cold start (~30-50s to wake after 15 min idle), fine for a demo. This is a take-home cost call, not a production one — in production the cold start would be unacceptable and I'd move to an always-on paid tier. Hosting doesn't affect the graded outcome (story quality), so for the take-home I picked the free, simplest option.

### 3.7 Latency UX
- **Problem:** Generation is one call that takes a few seconds; the wait shouldn't feel broken.
- **Options:** single spinner; staged loader copy; stream/progressively reveal frames.
- **Decision:** For Phases 1–2, one call with a staged preloader that names each step ("reading photos… ordering… writing captions…"). Streaming (revealing frames as they generate) is deferred to Phase 3 as an optional polish.
- **Why:** The wait is only a few seconds, and a single structured call can't reveal frames mid-flight without reworking the call. Weighing that added complexity against the small gain on a short wait, streaming isn't worth it now — the easy route saves time for a take-home. A staged preloader makes the wait feel purposeful with no extra engineering.

### 3.8 App state
- **Problem:** Where does the in-progress story live in the app?
- **Options:** a heavy store (NgRx); a small Angular service with signals.
- **Decision:** A small Angular service holding the story in signals, no NgRx.
- **Why:** Phase 1 is a single linear flow (pick → generate → refine) with one story in memory. NgRx would be premature; a signal-based service is enough and simpler.

### 3.10 Component library
- **Problem:** Want to build the UI fast without hand-rolling components.
- **Options:** Angular Material; PrimeNG; hand-rolled.
- **Decision:** Angular Material.
- **Why:** Official, modern, well-documented, and easy — fits the standardized-structure goal. Bonus: it ships CDK component harnesses, exactly the reliable component-testing tool I want.

### 3.11 How does the user get photos in?
- **Problem:** Going to a web app, the user has to upload photos themselves — there's no camera-roll access like a native app. Uploading has to be frictionless, and it's the first step of every phase (and every recurring cycle in Phase 3).
- **Options:** a plain file-browser dialog; a custom uploader UI; a standard `<input type="file" accept="image/*" multiple>`.
- **Decision:** A standard multi-select file input, styled as one big "Add photos" target.
- **Why:** On mobile, that input opens the OS **native photo picker** (multi-select, Recents-first) — the same grid a native app shows, with no library-scan permission on our side, so "manual upload" is really one tap + a few selections. On desktop it also takes drag-drop / click-to-browse / paste. Recents-first is what makes Phase 3's "make a story from last week" quick. This is why the web pivot (3.9) doesn't hurt the flow: the only phase where auto-scan would have helped is Phase 3, and the native picker's Recents view covers it.

### 3.12 API versioning
- **Problem:** Production-like and meant to scale — the API contract will change, and existing clients shouldn't break when it does.
- **Options:** URI path (`/api/v1/…`); custom header (`X-API-Version: 1`); media-type (`Accept: application/json;version=1`).
- **Decision:** URI-path versioning (`/api/v1/generate`).
- **Why:** Most visible and testable — a reviewer can hit `/api/v1/generate` in a browser, and a `v2` ships alongside `v1` without breaking `v1` clients. The header and media-type styles can't be called or debugged without setting a header. NestJS supports all three as a one-line config, so this isn't a lock-in.

### 3.13 Keeping generated code on the newest framework version
- **Problem:** LLMs are trained on a mix of Angular versions, so generated code blends old and new patterns (NgModules instead of standalone, no signals). I only want the newest.
- **Options:** rely on the model's defaults; pin each framework's own current guidance in `CLAUDE.md` so every session follows it.
- **Decision:** Pin the newest guidance in `CLAUDE.md`. Angular → its official, team-maintained `best-practices.md` (v22+). NestJS → no official file, so reference the live official docs (`docs.nestjs.com`, v11) with the key rules inline. Also prefer `ng generate` / `nest generate` so scaffolding is standardized, not hand-written.
- **Why:** The official Angular file is updated with the framework, so it forces current patterns (standalone, signals, `inject()`) and stops the model mixing in old syntax. NestJS has no such file — a community one exists (well-starred, updated early 2026) but it's an unofficial snapshot that can lag, so pointing at the live docs guarantees currency without vendoring something that goes stale.

### 3.14 How we test
- **Problem:** How do we test, and — especially for the volatile frontend UI — what do we actually assert on?
- **Options:** write tests after the code (or skip them); TDD (test first). For frontend, either query the rendered DOM directly, assert on styles/classes, or drive components through Angular Material / CDK component harnesses.
- **Decision:** TDD everywhere — write the failing test first, then the code that passes it. Frontend tests assert component **functionality** (interactions, state, emitted outputs, rendered content) through **Angular Material / CDK component harnesses**, never colors or styling. All tests must pass before a task is finished; a test is never deleted or skipped to get a green run.
- **Why:** Component harnesses are simple to write and maintain — they address a component by role, not by CSS selector or markup, so they don't break when styling or DOM structure changes. That same volatility is why we don't test colors: styling churns constantly, so asserting on it produces brittle tests that fail on cosmetic edits. TDD keeps every change covered and makes "done" mean "green." Never deleting a test keeps coverage honest — a passing suite then means the code works, not that the evidence was removed.

### 3.15 Styling — Tailwind, not Bootstrap
- **Problem:** On top of Angular Material we need a utility layer for layout, spacing, and the bits Material doesn't cover.
- **Options:** Bootstrap utility classes; Tailwind utility classes.
- **Decision:** Tailwind. Markup carries only Tailwind utility classes plus standard Material components — no per-component `.css`/`.scss` files and no inline `styles`.
- **Why:** Tailwind's utilities are finer-grained and composable, so you can style much more freely and precisely than with Bootstrap's fixed utility set. Keeping all styling in Tailwind classes on the markup (no component stylesheets, no inline styles) means one styling system and nothing custom to maintain.

### 3.9 Native mobile app or web app? (came late)
- **Problem:** I'd been designing a native mobile app. Re-reading the brief, Option 2 says "deployable web app," reviewers run the code "in a fresh Linux container," and a live URL is wanted.
- **Options:** native mobile app; responsive web app.
- **Decision:** Responsive web app. This reframes 3.1, 3.5, and 3.6 above.
- **Why:** A native app can't run in a Linux container or be opened at a URL by reviewers, so it fails the brief. A responsive web app deploys to a URL, runs in a container, needs no install, and keeps the whole Phase 1 core unchanged. What changes is the shell (upload instead of camera roll; download / Web Share instead of a native Instagram deep-link); the AI story generation — the graded part — does not.

---

# Chapter 4 — Production readiness

Resolving the production-readiness gaps the engineering review surfaced — what would break or cost money in production. Each entry maps to an item in [`phase-1/open-questions.md`](phase-1/open-questions.md).

### 4.1 Rate limiting & abuse
- **Problem:** `/api/v1/generate` is public with no accounts, backed by one shared Gemini free-tier key (~1,500 calls/day). Anyone who finds the URL can drain the quota — the app goes down for everyone, and it costs. The endpoint can't be hidden: it's served from the same container as the app and the browser calls it directly, so it's public by design.
- **Options:** a per-user cap (needs accounts we don't have); a client-side "N free then sign up" counter; a server-side global daily budget cap + per-IP rate limit; combine.
- **Decision:** Split the two concerns.
  - **Hard defense (Phase 1):** a server-side **global daily budget cap** (stop calling Gemini past ~1,200/day — headroom under the 1,500 free tier — and show "at capacity, try later") **+ a per-IP rate limit** (~a few/hour). This protects the shared key's availability and cost.
  - **Soft conversion nudge (Phase 1 → Phase 3):** after ~2 generations, prompt "sign up to make more." In Phase 1 it's a friendly client-side nudge; the enforceable per-account limit arrives with accounts in Phase 3.
- **Why:** Without accounts, "2 per user" can't be enforced — a client counter resets with incognito or cleared storage, so it's a monetization gate, not an abuse shield. The global cap + per-IP throttle are what actually stop the free key being drained, and they're cheap (rate-limit middleware + a daily counter). The signup nudge is the growth mechanic, well-timed right after the user has hit the wow twice; its hard version lands naturally when Phase 3 adds accounts. The numbers (1,200/day, a few/IP/hour, 2 free) are tunable starting values.

### 4.2 Don't trust the client
- **Problem:** Downscaling, the 10-photo cap, and type/size checks all run client-side for speed. A crafted client can skip all of them and POST anything to `/api/v1/generate` — a huge body, non-image bytes, or 100 photos.
- **Options:** trust the client's checks; re-validate everything server-side.
- **Decision:** Re-validate server-side. The server enforces a **max request body size**, re-checks the **photo count** (≤10) and **per-image size**, and accepts only **standard image types** (JPEG / PNG / WebP / HEIC) — anything else is rejected before the Gemini call. The client keeps its downscale + checks for a fast happy path.
- **Why:** Client-side checks are a UX convenience, not a security boundary — they're bypassable. Server-side validation is the real gate: it stops oversized payloads (memory/cost/DoS), non-image content, and over-count requests from ever reaching the model. Standard image types cover every real upload, so restricting to them costs honest users nothing.

### 4.3 Gemini failure modes
- **Problem:** Beyond the handled cases (invalid JSON, unknown ids, empty), three failures aren't covered: quota/429, safety-filter refusals (a flagged image), and a hung upstream call.
- **Options:** typed errors + timeout + honest messages (Sol. 1); + graceful degradation & bounded retries (Sol. 2); + model fallback (Sol. 3).
- **Decision:** Solution 1 + the safety-degradation slice of Solution 2.
  - **Hard timeout** on the Gemini call (~25s) so a hung call returns a `timeout` outcome and never blocks the request.
  - **Typed error set** → the client: `quota_exhausted`, `rate_limited`, `safety_blocked`, `timeout`, `upstream_error`, each mapped to a specific message + action.
  - **Safety-block degradation:** if Gemini flags an image, drop it and re-call with the rest → return a **partial story**; hard-fail only if fewer than 3 usable photos remain (min-photo rule).
- **Why:** Timeout + typed messages are cheap correctness — no silent failures, no hung requests. Dropping a flagged photo and continuing is the one high-value resilience add: one bad image no longer kills the whole story, and it reuses the "drop unknown photoId" pattern we already have. The rest is deliberately skipped — a circuit breaker is redundant with the 4.1 global cap, bounded retries add little (the existing 2× network retry covers transient hiccups), and model fallback (Solution 3) costs money against the free-tier decision (3.6). Fallback stays a future config option, not built.

### 4.4 Double-submit
- **Problem:** A double-click (or a slow tap) on Generate could fire two Gemini calls — double cost and a UI race over which result wins.
- **Options:** disable the button only; a request-in-flight guard in the service; + a server idempotency key.
- **Decision:** A `generating` signal in the story service — set true on submit, false when the call settles. The Generate button is disabled while it's true, **and** the submit handler early-returns if already generating (so a rapid or programmatic re-fire is a no-op too). A server idempotency key is noted as optional, not needed for Phase 1's single linear flow.
- **Why:** The disabled button is the visible guard; the service-level guard closes the gap where button state can lag a fast double-fire. That's the standard, complete fix for one in-flight request. An idempotency key only earns its keep once there are concurrent clients or automatic retries.

### 4.5 Mobile memory (large-image processing)
- **Problem:** Ten large images (HEIC especially) decoded + downscaled all at once via `heic2any` + canvas can spike memory and crash a low-end phone tab.
- **Options:** process all images in parallel (fast, memory-heavy); process sequentially (one at a time, flat peak memory).
- **Decision:** Process images **sequentially** — decode → downscale → release each before starting the next — so peak memory stays flat regardless of how many were added.
- **Why:** The story only needs the small proxies before the call, so there's no reason to hold ten full decodes in memory at once. One-at-a-time keeps a cheap phone from OOM-crashing, at a small cost in total processing time (still seconds). Robustness on weak devices beats shaving a second on strong ones.

### 4.6 Lost work on refresh (deferred to Phase 2)
- **Problem:** Stateless + story-in-memory means an accidental refresh nukes the uploads and the generated story.
- **Options:** warn-on-unload only; a sessionStorage draft; an IndexedDB draft (state + images); server + accounts (cross-device).
- **Decision:** Persist a local draft — **story state + downscaled proxies** — to **IndexedDB**, restored on next open in the same browser, plus a `beforeunload` warning. **Sequenced to Phase 2**, not Phase 1. Cross-device sync needs accounts → Phase 3.
- **Why:** sessionStorage is the wrong tool (≈5 MB, strings only, dies on tab close); IndexedDB stores blobs, has large quota, and survives both refresh and accidental close. Persisting state + proxies restores the preview instantly at low cost (full-res originals re-added if needed). It's Phase 2 because losing a draft is robustness/polish, not the graded story-generation core — Phase 1 proves the value, Phase 2 hardens the session. Cross-device genuinely can't work without server-side accounts, so it lands with Phase 3.

> Decisions 4.7–4.11 are baseline engineering hygiene — standard, low-controversy things a stable MVP needs from day one, so they're all Phase 1.

### 4.7 Health-check endpoint
- **Problem:** Render (and any monitor) needs to know the app is up; without it, a dead container isn't detectable.
- **Decision:** `GET /healthz` returns 200 + minimal JSON (`status`, `model`) — a shallow **liveness** check (process is up), no auth, and no Gemini call.
- **Why:** Standard readiness probe. Shallow on purpose — a deep check that called Gemini would burn free-tier quota on every ping.

### 4.8 Story-line input hardening
- **Problem:** The "What's the story?" text goes straight into the prompt — unbounded length and prompt-injection risk.
- **Decision:** Server caps the length (~300 chars), trims, and rejects empty; the prompt **delimits the user text as data, not instructions**. Tone is a fixed enum (chips), so it has no injection surface.
- **Why:** Cheap hygiene. Low stakes for a journal, so basic bounding + delimiting is enough — no heavy content filtering.

### 4.9 CI/CD
- **Problem:** Tests and builds need to run automatically, and deploys should be repeatable.
- **Decision:** **GitHub Actions** on every PR/push — install → lint → typecheck → unit/component/contract tests → build the Angular app + Docker image. `main` deploys to Render (its git integration auto-deploys the same image).
- **Why:** Standard pipeline; catches regressions before merge and makes deploys push-button. The tests already specified (Chapter 3) only pay off if CI runs them.

### 4.10 Client-side error capture
- **Problem:** Server errors are logged, but client-side failures (upload, decode, render) are invisible and can show a blank crash.
- **Decision:** A global Angular `ErrorHandler` + `window.unhandledrejection` hook POSTs errors to a server log endpoint, and the UI shows a "something went wrong — retry" fallback instead of a white screen.
- **Why:** Makes client breakage visible (pairs with the server's structured logs) and keeps a failure recoverable. A hosted tool (Sentry) is a later upgrade, not needed for the MVP.

### 4.11 Security headers
- **Problem:** A public web app with no security headers is exposed to clickjacking, MIME-sniffing, and mixed-content issues.
- **Decision:** Apply **`helmet`** on NestJS — CSP, `X-Content-Type-Options`, frame-ancestors, `Referrer-Policy`, HSTS. CSP stays simple because the app and API share one origin (`default-src 'self'`, plus `img-src 'self' data: blob:` for the photos).
- **Why:** One middleware covers the standard header set; same-origin keeps the CSP tight without special-casing external hosts.

### 4.12 Observability — where logs live on Render
- **Problem:** We log structured per-request lines (4.3) and client errors (4.10), but never said where they go in production or how you'd actually watch them. Render is the host.
- **Options:** structured logs to stdout, read in Render's log tab (free); add a hosted aggregator / log drain now (Logtail, Datadog, Papertrail) for retention + alerts; add Sentry for error tracking now.
- **Decision:** MVP logs structured JSON (Pino) to **stdout/stderr**; Render captures the container's stdout into its **Logs** tab (live tail, searchable) — no agent, no extra service. Client errors POST to the server and land in the same stream. Retention and alerting are a documented upgrade path, not built.
- **Why:** Zero extra cost, matches the free-tier host (3.6). Render's free logs are **ephemeral** — short retention, lost on restart/spin-down, no alerting — acceptable for a take-home/demo. Production upgrade: Render **Log Streams** forward stdout to an external aggregator (retention, search, alerts) and **Sentry** for error tracking (the 4.10 upgrade). Same log lines, no app rewrite.
