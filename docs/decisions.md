# Approach

How this project was thought through, in chapters, so a reader can jump to the part they care about. (the `phase-*/spec.md` files = *what* we build; this = *how* I got there.)

## Contents
1. [Figuring out what to build](#chapter-1--figuring-out-what-to-build)
2. [How the core value is created](#chapter-2--how-the-core-value-is-created)
3. [Locking the Phase 1 architecture](#chapter-3--locking-the-phase-1-architecture)
4. [Production readiness](#chapter-4--production-readiness)
5. [Design system](#chapter-5--design-system)
6. [Phase 2 — longer stories without timing out](#chapter-6--phase-2-longer-stories-without-timing-out)
7. [Phase 2 — getting the story onto Instagram](#chapter-7--phase-2-getting-the-story-onto-instagram)
8. [Lessons learned](#chapter-8--lessons-learned)

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

### 2.4 How many photos can the user bring in?
- **Problem:** The pick was capped at 10 photos. A day out easily produces 30+ shots, so a 10-cap forces the user to hand-pick the best ones *before* the app ever sees them — which is exactly the work the app is supposed to do (choose the good photos out of a real dump). At 10, there's nothing left to choose from.
- **Options:** keep the 10 cap; raise the cap so the user dumps a whole batch and the AI does the selecting.
- **Decision:** Raise the pick to **30 photos**. The user dumps the day; the AI decides which ones make the story (it already receives every photo and selects — 3.3).
- **Why:** A 10-photo limit is a pre-filter the *user* does, which defeats the point — the app's core value is picking and ordering the best shots for you. 30 lets the user hand over a real camera-roll batch and actually get that. 30 is still cheap for the model: each photo is sent as a small ~1024px proxy (3.4), and the server re-checks the count so a crafted client can't exceed it (4.2). Supersedes the "~10" count in [3.4](#34-how-many-photos-and-what-size) (the photo *size* rule there is unchanged).

### 2.5 How long should the generated story be?
- **Problem:** Stories came out too short — the model often cut a good 10-photo day down to 3–4 frames, dropping shots the user wanted. The prompt only said "short, coherent" with no target, so the model trimmed to the bone. How many frames should a story aim for?
- **Options:** no target (let the model decide — stays short); keep every good photo (longest possible); target the length that keeps viewers watching to the end.
- **Decision:** Aim for **5–7 frames, up to ~10** when the day genuinely has that many distinct moments. Cut only near-duplicate, blurry, or redundant shots — not good photos just because there are many. Put the **strongest photo first**.
- **Why:** This is set by how people actually watch Stories, not by taste. The case-study numbers:
  - Stories with **3–7 frames get the best engagement**, and viewer retention starts to fall once a story runs past ~5–7 frames ([usevisuals](https://usevisuals.com/blog/instagram-stories-best-practices)).
  - The average Story **completion rate is ~70%**; very short sequences (under 4 frames) do slightly better — but cutting to 3 throws away real moments, so **5–7 is the balance** between telling the whole day and still being watched to the end ([socialinsider](https://www.socialinsider.io/social-media-benchmarks/instagram-stories-benchmarks)).
  - The **first frame decides the rest: ~23.8% of viewers leave after frame one**, and those who reach frame two are far more likely to finish the whole story ([socialinsider](https://www.socialinsider.io/social-media-benchmarks/instagram-stories-benchmarks)). So the strongest photo leads (this is the same hook-first order as 2.1), and each frame makes one clear point.
- So the fix for "too short" is *not* "as long as possible" — a 15-frame story loses viewers. It's raising the floor to the engagement sweet spot (5–7). "No target" was rejected because it's what made stories too short; "keep every good photo" was rejected because past ~7 frames people stop watching.
- **Escape hatch:** when the user still wants a specific extra beat the AI didn't pick, refine lets them **add one photo and caption just that photo**, without a full rebuild that would reset their edits.

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
- **Why:** I don't want to pay to host a demo. Render is the only one of these with a genuine free tier and no credit card, and it runs our Docker image directly (the same one anyone runs via compose). The only cost is a cold start (~30-50s to wake after 15 min idle), fine for a demo. This is a demo cost call, not a production one — in production the cold start would be unacceptable and I'd move to an always-on paid tier. Hosting doesn't affect story quality, so for the demo I picked the free, simplest option.

### 3.7 Latency UX
- **Problem:** Generation is one call that takes a few seconds; the wait shouldn't feel broken.
- **Options:** single spinner; staged loader copy; stream/progressively reveal frames.
- **Decision:** For Phases 1–2, one call with a staged preloader that names each step ("reading photos… ordering… writing captions…"). Streaming (revealing frames as they generate) is deferred to Phase 3 as an optional polish.
- **Why:** The wait is only a few seconds, and a single structured call can't reveal frames mid-flight without reworking the call. Weighing that added complexity against the small gain on a short wait, streaming isn't worth it now — the easy route saves time. A staged preloader makes the wait feel purposeful with no extra engineering.

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
- **Why:** On mobile, that input opens the OS **native photo picker** (multi-select, Recents-first) — the same grid a native app shows, with no library-scan permission on our side, so "manual upload" is really one tap + a few selections. On desktop the same input is click-to-browse. Recents-first is what makes Phase 3's "make a story from last week" quick. This is why the web pivot (3.9) doesn't hurt the flow: the only phase where auto-scan would have helped is Phase 3, and the native picker's Recents view covers it.

### 3.12 API versioning
- **Problem:** Production-like and meant to scale — the API contract will change, and existing clients shouldn't break when it does.
- **Options:** URI path (`/api/v1/…`); custom header (`X-API-Version: 1`); media-type (`Accept: application/json;version=1`).
- **Decision:** URI-path versioning (`/api/v1/generate`).
- **Why:** Most visible and testable — a reviewer can hit `/api/v1/generate` in a browser, and a `v2` ships alongside `v1` without breaking `v1` clients. The header and media-type styles can't be called or debugged without setting a header. NestJS supports all three as a one-line config, so this isn't a lock-in.
- **In the OpenAPI spec:** the version lives in the path (`/api/v1/generate`), kept as full paths (not hoisted into `servers[].url`) so `/healthz` can stay **unversioned** — it's a liveness/ops endpoint, not part of the product contract. Two version numbers, distinct on purpose: the URL major (`v1`) bumps only on a breaking change; `info.version` (semver) bumps on every spec change. A breaking change adds `/api/v2/…` (new path files, eventually a separate document tracked as `auto-stories@v2` in `redocly.yaml`) while `v1` keeps serving old clients.

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

### 3.14 Contract-first API, authored as a modular OpenAPI spec
- **Problem:** Frontend and backend need to agree on the request/response shapes before either is built, and the API description shouldn't become one unreadable file as routes are added.
- **Options for the contract:** infer it as we code each side; generate OpenAPI from NestJS decorators at runtime (backend must exist first); hand-write an OpenAPI spec as the source of truth first. **For file layout:** one monolithic `openapi.yaml`; split across files with `$ref` and bundle to flatten.
- **Decision:** Write the OpenAPI 3.1 spec first as the source of truth (`/openapi`, at the repo root — it belongs to neither app), and author it **modularly**: root file wires it together, one file per path (`paths/`), one per schema (`components/schemas/`), reusable error responses in `components/responses/`. Tooling: Redocly (lint + bundle), openapi-typescript (generate shared TS types both apps import), Prism (mock server from the examples), Scalar (rendered reference for onboarding).
- **Why:** Contract-first lets both sides be built in parallel — the frontend develops against the Prism mock while the backend is still being written, and generated types make a contract change break compilation on both sides instead of failing at runtime. Generating from decorators was rejected because it needs the backend to exist first, defeating the parallelism. Modular files mean you open the one route or schema you're changing instead of scanning thousands of lines, and reusable responses stop every route re-declaring the same error shapes; `redocly bundle` still produces a single flat file when a tool needs one. Verified equivalence: bundling, linting, type generation, and the Prism mock all work on the split spec, and the generated types are unchanged except for the reusable responses now being named.

### 3.15 Sharing the generated types between the apps
- **Problem:** The generated types need to be imported by both apps from one place, without each reaching into a relative generated path.
- **Options:** import the generated file by relative path from each app; publish a versioned npm package; a local workspace package both apps depend on.
- **Decision:** npm-workspaces monorepo (`packages/*`, `apps/*`) with a `@auto-stories/api-types` package. The generator writes `src/gen/` (do-not-edit); `src/index.ts` re-exports it as the stable public surface. Both apps depend via `"@auto-stories/api-types": "*"` (workspace symlink — nothing to publish).
- **Why:** Zero release overhead and no version skew — both apps build against the same types. `index.ts` is the one place to touch if the generator is ever swapped. Verified: a consumer import resolves and omitting a required field (e.g. `photos`) is a compile error.

### 3.16 Generator: kubb (real types in a folder)
- **Problem:** The first generator (openapi-typescript) emits one nested blob (`components["schemas"][…]`), so usable types needed a hand-written alias barrel. It also pins peer `typescript@^5`, conflicting with the app's TS 6 under `npm ci`.
- **Options:** openapi-typescript + manual barrel; kubb; openapi-generator (JVM); orval / swagger-typescript-api.
- **Decision:** **kubb** (`@kubb/plugin-ts`) — generates real named types, one file per schema, into `src/gen/models/`. `openapi-generator` is the documented break-glass fallback if kubb stalls (solo maintainer).
- **Why:** Real per-file types with no manual materialization or barrel; npm-native (no JVM). No lock-in — it reads the standard spec and emits plain `.ts`, so any generator is a drop-in swap contained to the `api-types` package. Bonus: kubb has no `typescript` peer, so it also removed the earlier TS-5/TS-6 conflict — the monorepo now runs a single TypeScript 6.

### 3.17 How the frontend moves between the flow's screens
- **Problem:** Phase 1 has a sequence of screens (first-open example → pick + story → generating → payoff/refine → error). How does the app navigate between them?
- **Options:** Angular Router with a route per screen; a single stateful shell component that swaps the child screen on a `phase` signal in the story service.
- **Decision:** A single stateful shell driven by a `phase` signal (`example | create | generating | story | error`) held in the signal-based story service — no per-screen routes.
- **Why:** Phase 1 is one linear, in-memory flow with a single story (3.8). Routes would add URL/deep-link/refresh semantics the flow doesn't want: a refresh mid-flow should not land on a bare `/generating`, and refresh-persistence is deliberately Phase 2 (4.6). A `phase` signal keeps the whole flow's state in the one service (matching 3.8), lets the always-dark story surface (5.4) wrap the shell once, and makes transitions plain signal writes the components already depend on. Routing becomes worth it only when screens need to be independently addressable — not in Phase 1.

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
- **Why:** Zero extra cost, matches the free-tier host (3.6). Render's free logs are **ephemeral** — short retention, lost on restart/spin-down, no alerting — acceptable for a demo. Production upgrade: Render **Log Streams** forward stdout to an external aggregator (retention, search, alerts) and **Sentry** for error tracking (the 4.10 upgrade). Same log lines, no app rewrite.

### 4.13 CI runs only the area that changed
- **Problem:** The CI ran every job on every push — the API-contract checks fired even for a change that only touched the Angular frontend scaffold. That burns GitHub Actions minutes (and the free budget) on work that can't have broken. Refines [4.9](#49-cicd).
- **Options:** keep one workflow that always runs everything; path-scope each job so only the changed area runs.
- **Decision:** Path-scope the workflow. A lightweight `changes` job (`dorny/paths-filter`) detects which area changed and gates three independent jobs: **contract** (`openapi/**`, `packages/api-types/**`), **backend** (`apps/api/**`), **frontend** (`apps/web/**`). A shared root change (deps, the workflow itself) runs all three. A contract change runs only the contract job — the shared type package is deliberately not listed under the apps.
- **Why:** CI exists to develop fast with AI and is a must-have for production, so it has to stay cheap enough to run on every push. Each area is isolated: change the package → test the package; change the frontend → test the frontend; change the backend → test the backend. If a change to one area could break another, that coupling is the real problem to fix — it shouldn't be papered over by always running everything. Isolated jobs also point the failure at the area that broke. Skipped jobs still report as passing, so branch protection keeps working. E2E (frontend + backend together) is the one deliberately cross-cutting job, added later.

### 4.14 One container that serves both apps, verified in CI
- **Problem:** [3.6](#36-deploy) and [4.9](#49-cicd) committed to one container (NestJS serving the Angular build) built in CI — but not *how* one process serves both, nor how CI proves the image actually runs.
- **Decision:**
  - The API mounts **`@nestjs/serve-static`** at the built web root (`WEB_ROOT`), excluding `/api/*` and `/healthz`; every other path falls back to `index.html` so client-side routes survive a hard refresh. It mounts only when the build is present, so API-only local dev is unchanged.
  - **Multi-stage Dockerfile:** stage 1 installs from the lockfile, builds both apps, prunes dev deps; stage 2 is a slim runtime running one non-root Node process with a `/healthz` HEALTHCHECK. Secrets are injected at runtime (`--env-file`), never baked into a layer.
  - **CI gains a `docker` job** (gated on any app/dep/container-file change): build the image, run it, and smoke-test that `/healthz` answers and the web app is returned at `/`.
- **Why:** A green unit suite doesn't prove the deployable artifact boots and serves — the smoke test does, so a broken image fails the PR, not the deploy. One process/one origin keeps the CSP tight (4.11) and matches how Render runs it (3.6). Runtime-only secrets keep keys out of the image. Non-obvious: serve-static binds to the HTTP adapter only when the app starts via `NestFactory` (the `compile()`-first test path silently no-ops it), so the test uses the real bootstrap path.

### 4.15 Landing page is a workspace app served at `/`; product app moves to `/app`
- **Problem:** The marketing landing page existed as an orphan folder (`landing/`) wired into nothing — not a workspace, not served. It needed to be a first-class app in the repo and reachable at the site root.
- **Decision:**
  - Promoted it to a workspace app, **`apps/landing`** (sibling of `api`/`web`), with a `package.json` so `npm` and the CI `apps/**` docker filter pick it up.
  - **URL layout in the one container:** landing at **`/`** (`LANDING_ROOT`), the Angular product flow at **`/app`** (built with `--base-href /app/`), `/api/*` and `/healthz` underneath. Two `serve-static` mounts: `/app` registered first, the `/` landing host last as the catch-all, each excluding the others' prefixes.
  - The landing **build stays a local authoring step** (`build.py` needs `python3` + an external Pretext file, neither in the image); the container ships the committed, self-contained `index.html`.
  - CTA buttons point to `/app/example` and `/app/create` — the `/app` SPA fallback serves them today and future client-side routes light them up. The docker smoke test now asserts landing at `/` and `<app-root>` at `/app`.
- **Why:** The landing is the front door, so it owns `/`; the app moves to `/app` rather than the reverse because the funnel is landing → CTA → app. API calls are absolute (`/api/v1/...`), so the base-href move doesn't touch them. Shipping the committed `index.html` avoids putting a Python toolchain and an out-of-repo asset into the build.
- **Follow-up — the `/app/create` CTA now lands on the picker (was: both CTAs opened the example).** As predicted above, the SPA served `/app/create` but the app ignored it: with no router (3.8), it always booted `phase = 'example'`, so both landing CTAs opened the demo. Rather than add a router (3.8 keeps that out of Phase 1), the shell reads the entry path **once** at bootstrap — `App` passes `document.location.pathname` to `StoryService.startFromPath`, which starts on the picker for `…/create` and otherwise leaves the default example. This "lights up" the deep-link with a single signal write and no URL/refresh semantics, exactly the seam 3.8 left open for when a screen needs to be addressable.

### 4.16 Repo front door: project README, root scripts, pinned Node
- **Problem:** Someone cloning the repo landed on a bare `README.md`, not on how to run Auto Stories. The only run instructions were comments in `docker-compose.yml`/`Dockerfile`. Local dev was undocumented: it needs the API (`:3000`) and web (`:4200`, which proxies `/api`) started separately, discoverable only from `angular.json` + `proxy.conf.json`. Root `package.json` had only `typecheck` + `openapi:*`; no `dev`/`build`/`test`/`lint`.
- **Options:** (README) add a separate DEVELOPING.md; or make the README itself the project front door. (dev script) document a two-terminal flow with no new dep; or add `concurrently` for a single `npm run dev`.
- **Decision:**
  - **README** = the Auto Stories project README (live URL, one-command Docker run, local dev + the proxy, layout, command table, docs links).
  - **Root scripts** fan out to workspaces: `test`/`lint`/`typecheck` via `--workspaces --if-present`; `build` explicit to `@auto-stories/api` + `web` (skips `apps/landing`'s `python3 build.py`, which the image also skips); `dev` runs both dev servers via `concurrently`.
  - **Node pinned** to `>=22.22.3` (`engines` + `.nvmrc`), plus `.editorconfig` and a one-line `.env.example` note that only `GOOGLE_CLOUD_API_KEY` is needed.
- **Why:** The docs and app were strong but the entry point pointed at the wrong thing — the file a developer opens first should describe the project and how to run it. `npm run dev`/`test`/`build` from the root remove the need to learn each workspace's script names. The Node floor is not cosmetic: the Angular CLI (v22) rejects Node below **22.22.3**, so `npm test`/`build` fail on an older 22.x; CI passes only because `setup-node@22` resolves to the latest 22.x. Pinning the real floor makes local dev match CI instead of failing with a version error. `build` targets the two compiled apps because the landing ships as a committed `index.html` (see [4.15](#415-landing-page-is-a-workspace-app-served-at--product-app-moves-to-app)).

---

# Chapter 5 — Design system

### 5.1 Color direction — "Golden Hour"
- **Problem:** The M3 theme needs source colors before any screen can be designed. The palette sets the app's whole feel.
- **Options:** "Golden Hour" (warm coral-amber primary, cream/warm-charcoal neutrals, plum tertiary); "Instagram Lineage" (vibrant magenta→orange, IG-adjacent); "Editorial Calm" (muted terracotta + sage, magazine restraint).
- **Decision:** Golden Hour. Source colors: primary `#F0603A`, tertiary `#B5476B`.
- **Why:** Two concrete constraints from the Phase 1 spec force it. (1) Photos are the hero ("native, low-production feel") — a warm off-white surface (`#fff8f6`) lets photos read; pure white (Instagram Lineage) competes with them for brightness. (2) The app hands off *to* Instagram, it isn't Instagram — coral-amber sits in the warm family (still reads "for Stories") but is distinct from IG's magenta core, so it's ownable, not borrowed. Warm-vs-cool within those constraints is a taste call; warm also fits "private memory journal" (nostalgia register). Editorial Calm is warm too but too muted for a first-open wow.

### 5.2 One color source: the SCSS theme; everything else reads `--mat-sys-*` tokens
- **Problem:** A design palette that only lives in mockups drifts from the app. The colors must not exist as a hand-maintained list of hex values anywhere — that duplicates the theme and rots.
- **Options:** hand-author a palette CSS/hex list and reuse it in mockups; OR generate the M3 tonal palettes once into the SCSS theme and have both the app and the mockups consume the `--mat-sys-*` CSS custom properties that `mat.theme()` compiles out.
- **Decision:** The only place colors are defined is the generated SCSS: source colors → tonal palettes (`apps/web/src/_theme-colors.scss`, via Material's own color utilities, the engine behind `ng generate @angular/material:theme-color`) → `mat.theme()` in `material-theme.scss`. Nothing hand-lists hexes. The mockups import `tokens.css`, which is *compiled from that same SCSS theme* (not typed by hand), so they style with `var(--mat-sys-primary)` etc. — the exact variables the app uses.
- **Why:** One source of truth. A raw named-color CSS file duplicated from the theme isn't properly done — it silently drifts the moment the source colors change. Compiling the theme to tokens means a mockup can't promise a color the app can't render (verified: `--mat-sys-primary: light-dark(#ae310e, #ffb4a1)`). Theme ships light + dark (`color-scheme: light dark`) for free. M3 behavior to note: the *primary role* is tone 40/80, not the source swatch — the bright coral surfaces as containers/accents, which is how Material guarantees AA contrast.

### 5.3 Payoff screen (step 3) — refine only, no hand-off in Phase 1
- **Problem:** The finished-story screen had two unlabeled primary-looking buttons ("Refine story" + an arrow FAB for next-frame) — unclear what the arrow did. It also raised "where do I save the story?", and the flow must stay ≤3 steps for conversion (1.1).
- **Options:** (1) Refine only, story ends on screen; (2) a two-action bar — `Refine` + the Share/Download hand-off; (3) Refine-first, then a "Done" that opens an export sheet.
- **Decision:** Option 1 — refine only. (Briefly leaned Option 2 with a Share button, then reversed after re-reading the spec.)
- **Why:** The Phase 1 spec is explicit: review & refine happens **in place** and **"nothing leaves the app"**; **posting / hand-off to Instagram is Phase 2**. A Share/Download button on the Phase-1 payoff leaks Phase 2 into Phase 1, so it's cut. Step 3 = the finished story with refine in place (tap a caption to edit, drag/resize it, regenerate, swap/drop a photo); the single primary is **Refine story**. Frame nav = tap the photo (Stories convention), which removes the mystery arrow. Not a dead-end: the hand-off is the Phase 2 deliverable, not a missing Phase 1 feature.
- **Hand-off, when it lands in Phase 2, is device-adaptive** (this is a responsive web app, not phone-only): **Share** on mobile web (Web Share API → Photos / Instagram) and **Download** on desktop web. "Save to phone" was rejected as wrong on desktop.
- **Also:** the payoff uses the **cinematic (full-bleed)** treatment, photo as hero (5.1). The "gallery" (quiet, centered) alternative was cut — centering shrinks the photo too much. Step 2 (pick + "What's the story?" + tone) also uses the cinematic treatment: a full-bleed photo hero + a filmstrip of the picked photos (sized so they're actually legible, and horizontally scrollable to hold 3–10) over a Material sheet with the story field, tone chips, and "Create my story".

### 5.4 The first-open example is not a step — 2-step flow, no stepper
- **Problem:** The mockups showed a 3-dot stepper implying 3 steps, but the user only *does* 2 things. Is the first-open example a step? And does the flow need a progress indicator?
- **Decision:** The interactive example is a **demo, not a step**. The user's task flow is **2 steps**: ① pick + "What's the story?" + tone → ② payoff/refine. This matches the spec's "User Flow (2 steps)". **No stepper** — a 2-step flow is too short for a progress indicator, and it added visual noise + inconsistency (story-frame segments on the viewer screens vs. onboarding dots on step 1). Cut it.
- **Why:** The "3-step" figure (1.1, and CLAUDE.md Key decisions) counts the payoff-first example as the first "step" for the onboarding-conversion stat; but the example costs the user zero effort, so as a *task* it isn't a step. Counting it in a visible stepper misleads. (CLAUDE.md still says "3-step, payoff-first"; reconcile there if it causes confusion — the stat stands, the visible stepper does not.)
- **Also — story screens are always dark/cinematic.** The creation + viewer surfaces (both steps + the example) use the **dark** theme tokens regardless of the app's light/dark setting, like Instagram's story creation. This makes the coral primary pop and keeps the flow visually consistent. Photo picking is an **auto-sizing grid** that fills the top and holds 3–10 (fewer = bigger tiles), with an Add tile — not a horizontal scroller.

### 5.5 Caption editing is its own visible surface; small screen fixes
- **Problem:** The payoff said "tap a caption to edit," which isn't discoverable, and there was no screen showing *how* text is moved/resized/rewritten (a core in-scope refine feature). Plus two nits: the first-open "Example" badge looked out of place, and the step-1 picker had a shadow line + a redundant count pill + a back button sitting on the photos.
- **Decision:**
  - You edit a caption by **tapping the text itself** (no "Edit text" button), taught by a first-time **coach mark** that points at the caption. Tapping opens the **caption editor**: the text is edited **directly in the frame** (cursor in the caption — no duplicate text field), the selection box + corner handles resize it, and a "drag to move" tag repositions it. The Material sheet holds only the extras: **text size, Regenerate, legibility-background toggle**. This makes the spec's "AI text overlay, user-placed — drag/resize" concrete (1.5).
  - The **first-open example is editable too** — same coach mark — so the wow teaches the core interaction (you can change the text/placement), not just shows a pretty story.
  - Removed: the first-open **"Example" badge** (demo is signalled in the subtext), the payoff's unlabeled **regenerate circle-icon** (regenerate lives labeled inside Refine), and the story-field **"52" character counter** (read as a mystery number). Step-1 picker: dropped the panel's top shadow, moved the count onto the **Add** tile ("8 / 10"), moved the **back button off the photos** into a slim dark app bar, and made the **status bar dark** to match the screen.
  - **Which text is editable is made unmistakable:** a quick hallway test showed "tap the text" was ambiguous with 3 texts on screen (CTA button, a decorative kicker, the caption). Fix: drop the kicker, and render the caption as a distinct **text layer** — its legibility-background panel + a dashed border + a small pencil badge — so it reads as an editable object, unlike the solid CTA button or plain UI text. The coach points at it ("Tap to edit & move").
- **Why:** Editing must be obvious but not add chrome — direct manipulation (tap the thing, coach the first time) beats a button, and a caption shouldn't appear twice (frame + sheet). Affordance beats instruction: an object that *looks* editable removes the "which text?" guesswork. The removed elements were mystery icons/numbers or out-of-place chrome that fail the "don't make me think" test.
- **Note (button color):** on the always-dark story surfaces (5.4), Material renders the Golden Hour primary as its lighter dark-mode tone, so the CTA coral looks paler than in light mode — it's the same brand color, its dark shade, and it's consistent across Try / Create / Refine. Open option: use the vivid source coral for hero CTAs instead (a deliberate brand override outside the token roles).

### 5.6 Consistent CTA position; the story field is capped and wraps
- **Problem:** The primary button sat at slightly different heights per screen (example 32px, "Say it" 18px, payoff 28px from the bottom), so it appeared to jump between screens. And it was unclear whether the "What's the story?" field has a max length or scrolls horizontally.
- **Decision:**
  - Pin **every primary CTA to the same 24px from the bottom** so it never shifts across the flow.
  - The story field has a soft **max ~150 characters** and is **multi-line: it wraps and grows vertically (2–3 lines), never scrolls horizontally.** A character counter shows **only near the limit**, not always.
- **Why:** A fixed CTA position reads as stable and simple (no jump between steps — a small thing users notice). The line is one guided sentence (2.2); a cap keeps the prompt focused (better, less generic captions) and the UI tidy. Horizontal scroll hides typed text and fails legibility, so wrap-and-grow is the correct behavior; an always-on counter is noise (the "52" problem, 5.5), so it only appears when it matters.

### 5.7 Waiting screen is engaging; error states are specific
- **Problem:** The generate call can take a moment (and has a hard timeout, 4.3), so a bare spinner feels stuck. And every failure must show a specific message, not stall (4.3).
- **Decision:**
  - **Generating screen:** the user's own photos cycle behind (ken-burns) while it narrates the *real* work — "read your photos → finding the story order → writing the captions" — with an indeterminate bar and an honest "a few seconds" note. Kept the button-colour = Material dark-shade coral (5.3 note; user confirmed).
  - **Error states, each specific:** **At capacity** (free-tier daily cap / per-IP rate limit hit → "we're at capacity, try again," honest shared-tier note); **Timeout** ("that took too long, your photos are safe," Try again / back to picker); **Dropped photo** — resilient success, not an error: a flagged photo is dropped, the story is still built from the rest (≥3), shown as a non-blocking snackbar on the finished story.
  - **Signup nudge deferred** — the spec lists it as a light Phase-1 nudge after ~2 generations, but the user chose to leave it out of the mockups for now.
- **Why:** The wait is where the app proves it's doing the hard, valuable work (ordering + captions), so showing that (with the user's photos) turns dead time into anticipation. Specific error copy + a clear next action (retry) keeps the user oriented and never guessing (4.3, "don't make me think").

### 5.8 Mockups use real sample photos; no horizontal scroll; wait screen pared down
- **Problem:** The mockups used gradient placeholders, so it was impossible to judge how the design actually reads — text legibility over real photos, how a photo grid looks, how the story frames feel. The comparison board also scrolled horizontally for the longer sections, and the generating screen had an unclear title ("Maya turns one") and an unreadable, out-of-place "hang tight" line.
- **Decision:**
  - **Every place a real photo will appear uses a real sample photo** (themed sample images wired through the shared photo classes, so all screens — picker grid, story frames, generating, dropped-photo — show real imagery). Placeholders are for layout only; the look is judged on real content.
  - **No horizontal scroll anywhere in the mockups/board — vertical scrolling only.** The board wraps cards to new rows instead of a horizontal scroller (matches the app rule that content wraps/grows, never scrolls sideways — same reasoning as the story field, 5.6).
  - **Generating screen pared down:** the user's photos cycle behind + the three real steps; removed the story-title eyebrow and the time-note line (unreadable over the photo, and the steps already convey progress).
  - Consistent **primary-button position extended to the error screens** (single "Try again" pinned at 24px; secondary actions/notes moved into the content above), and fixed a snackbar overlapping the caption on the dropped-photo screen.
- **Why:** You can't evaluate legibility, hierarchy, or "does this feel good" against fake gradients — real photos are the honest test (and text-over-photo is the whole product). Horizontal scroll hides content and is disorienting; wrapping keeps everything on one vertical axis. A wait screen earns attention with the user's real photos + honest steps, not chrome that can't be read.

### 5.9 Failure states get personality; the wait visibly progresses
- **Problem:** The error copy ("at capacity", "that took too long") was flat and didn't say clearly what happened; the generating screen looked static (a frozen checkmark, nothing moving below); and the sample photos read as culturally-specific food rather than broadly relatable.
- **Decision:**
  - Error screens carry a **playful animal that actually moves** — a hand-built **inline animated SVG** (SMIL) rather than a stock photo (reads cheap) or a GIF (public GIF APIs were blocked, and an SVG referenced via `<img>` won't animate). The **sloth** sways, does a lazy wave and blinks (capacity: "we're maxed out — take it slow like this guy"); the **dog** wags its tail, tilts and blinks (timeout: "didn't come back in time, even the dog got bored — your photos are safe"). Clarity first (what happened + the next step), humour second.
  - **Dropped-photo notice = a dismissible top banner** in the story's headroom, kept clear of the caption — not a bottom snackbar (which crowded/covered the caption text).
  - The **generating screen animates through the real steps** — read photos → find the story order → write captions — each checking off in sequence (looping), so progress is visible, not frozen. It also **types a caption out live** (typewriter) to preview the payoff, turning the wait into a teaser of the result rather than dead time.
  - Sample imagery is **neutral and broadly appealing** (summer / outdoors / friends), so the mockups read for anyone, not one cuisine or culture.
- **Why:** A failure is where goodwill drains fastest; a warm, specific message plus a charming image keeps the user oriented and forgiving instead of annoyed — while never hiding what actually happened (fair-use cap / timeout, 4.1/4.3). A wait that visibly advances reassures the app is working; static progress reads as stuck. Neutral imagery keeps the demo universal — it should land for any viewer, not just one who shares the reference.

### 5.10 On wider screens, show the app inside a phone frame
- **Problem:** The shell only capped the flow's width (a 430px column) but let it fill the full viewport height, and every screen used `h-dvh`. On a laptop the phone UI stretched to the browser's full height and looked distorted; the aspect ratio didn't match any real device.
- **Options:** (1) keep the full-height column; (2) constrain to a fixed phone-shaped device frame on wider screens, full-bleed on phones.
- **Decision:** Option 2 — from the `sm` breakpoint up, render the flow inside a fixed phone-shaped frame (~9/19.5, centered, rounded bezel); on a phone it stays full-bleed.
- **Why:** The app is both created and consumed on a phone — these are Instagram Stories, and Instagram users are mostly on phones. Previewing it in a phone frame is the honest view of the product; a full-height desktop strip is a shape no real user ever sees.

### 5.11 Refine surfaces: tap-to-edit captions, a thumbnail filmstrip for the rest
- **Problem:** The payoff has to expose five refine actions — edit a caption, move/resize it, regenerate it, reorder the story, drop/add a photo, rebuild the whole story — without adding chrome that buries the finished story.
- **Options:** (1) one toolbar with a button per action; (2) split by object — direct-manipulate the caption in the frame, put frame-level actions in a filmstrip; (3) a separate full-screen editor.
- **Decision:** Option 2. "Refine story" enters a refine mode. The caption is edited in place (tap it → editor: text, drag-move, size, legibility, per-caption Regenerate). Frame-level actions live in a horizontal **filmstrip** of thumbnails: drag to reorder, tap to jump, "×" to drop (hidden below the 3-frame minimum), an Add tile to pick more. A single "Regenerate" rebuilds the whole story; adding a photo appends it as a new captioned frame (5.16 — originally the same rebuild).
- **Why:** Each action attaches to the object it changes — captions on the caption, frame order/membership on the frames — so there's no legend to read. The filmstrip is the one place that shows the whole narrative at once, which is what reorder and drop operate on. Dropping a photo also removes it from the pool, so a rebuild can't bring it back (a drop the user has to redo would read as a bug).

### 5.12 Refine, second pass: a dedicated manage screen, editor clear of the sheet, real paging
- **Problem:** First build of refine had three faults on the payoff: (1) opening the caption editor left the underlying caption showing through as doubled/ghost text; (2) the reorder/drop filmstrip floated directly over the photo, so it read as messy and the reorder/delete affordances weren't clear; (3) frame paging wasn't discoverable — tap zones existed but nothing said so, and there was no swipe.
- **Decision:**
  - **Editor mirrors the mockup (refine-text.html).** The underlying caption is hidden while editing; the editor lifts the caption into the upper area so it clears the bottom sheet and stays readable; the sheet carries a "Text size" label and Regenerate/Legibility as two equal pill buttons. The final lower-third placement is kept unless the user actually drags (editing text alone never moves it).
  - **Frame management gets its own surface.** "Reorder & remove" opens a dedicated screen on a solid `surface` background (not over the photo): each frame is a row (drag handle, thumbnail, caption, delete) with an Add row. The refine bar itself is a solid bottom sheet (Reorder & remove / Regenerate / Done), off the photo.
  - **Paging is real and taught.** Tap zones work in refine too, a swipe left/right pages the story, and a one-time hint ("Tap or swipe the photo to move through the story") shows until first use.
  - The coach mark gently bobs (reduced-motion aware), as in the mockup.
- **Why:** Ghost text and controls-on-the-photo failed the "don't make me think" bar — direct manipulation only works if the thing you touch is the only copy and the management controls sit on their own clean surface. A caption you can't see under the sheet can't be edited, so it lifts. Paging that gives no signal reads as broken, so it's both shown (hint) and offered two ways (tap + swipe).

### 5.13 Desktop upload is click-to-browse only (no drag-drop / paste)
- **Problem:** The spec listed desktop upload as drag-drop / click-to-browse / paste — three ways in.
- **Options:** (1) build all three; (2) keep only the file-input click-to-browse.
- **Decision:** Option 2 — one file input, click-to-browse on desktop and the native picker on mobile. Drag-drop and paste are cut.
- **Why:** The file input already covers desktop upload; drag-drop and paste add code without letting the user do anything they couldn't already, so they're not worth building for the MVP.

### 5.14 Picker tiles are square, columns follow the count (fixes the 1–2 photo state)
- **Problem:** The step-1 grid used `auto-rows-fr` inside a `flex-1` area, so the tiles stretched to fill all vertical space. With 1 photo that meant one full-height row: a lone 1/3-width, full-height photo sliver next to an equally tall "Add" tile, with a dead third column. It only looked right once ~3 photos filled a row.
- **Options:** (1) keep filling the height, accept the stretched aspect ratio; (2) fixed square tiles, fixed 3 columns; (3) square tiles with the column count following the photo count so the first row always fills.
- **Decision:** Option 3 — square tiles (`aspect-square`), packed from the top (`content-start`), scrolling on overflow; columns = 2 when there's 1 photo, else 3, so the Add tile always completes a full edge-to-edge row. Supersedes 5.4's "fills the top, fewer = bigger tiles."
- **Why:** Square tiles are the standard photo-picker look and read correctly at any count, including the transient 1–2 photo state while the user is still selecting. Following the count keeps the first row full (no lone tall button, no empty column) and makes a single photo a bigger tile — the "fewer = bigger" intent without the aspect distortion that caused the original bug. Fixed 3 columns (option 2) leaves the empty third column at 1 photo.

### 5.15 Caption gestures are touch-native: grab-offset drag + two-finger pinch
- **Problem:** Editing the caption worked with a mouse but not with a thumb. Two faults on a phone: (1) starting a drag snapped the caption's center to the finger, so it jumped on grab and felt like it was being yanked; (2) size could only be changed with the bottom-sheet slider — a pinch with two fingers did nothing, and the corner dots on the selection box implied a resize handle that wasn't wired up.
- **Options:** (1) leave size on the slider only, just fix the drag jump; (2) add corner-handle drag-to-resize; (3) add a two-finger pinch-to-scale in place, keep the slider as the desktop/accessible path, and fix the drag to preserve the grab offset.
- **Decision:** Option 3.
  - **Drag preserves the grab offset.** On finger-down the offset between the finger and the caption center is recorded; on move the caption keeps that offset, so it stays under the finger where it was grabbed instead of jumping.
  - **Two fingers pinch to scale.** Pointers are tracked; with two down, scale = scale-at-pinch-start × (current finger distance ÷ start distance), clamped to the slider's 0.6–1.8 range and emitted live. One finger drags, two fingers scale — no mixed mode.
  - **The slider stays** as the resize control for mouse/desktop and for assistive tech (pinch has no keyboard/AT equivalent).
  - **The decorative corner dots are removed;** the selection border stays and the coach pill reads "Drag to move · pinch to resize", so the affordance matches what the gesture does.
  - **Gesture math is extracted to pure functions** (`draggedPosition`, `pinchedScale`) and unit-tested; the pointer handlers are thin glue. jsdom returns zero-size rects and stubs pointer capture, so the gesture can't be driven through the DOM in unit tests — the math is tested directly and the live gesture is verified in the browser.
- **Why:** The app is made and used on a phone, so the caption editor has to feel right under a thumb; Instagram's text tool is the reference — drag from wherever you grab, pinch to size. Snapping the center to the finger is what made the drag read as buggy. Pinch is the expected way to resize on touch; keeping the slider means desktop and assistive-tech users still have a control, and clamping to the same 0.6–1.8 range keeps both paths consistent. Corner dots that don't resize are a false affordance, so they go.

### 5.16 "Add photo" in refine appends one captioned frame, not a full rebuild
- **Problem:** In refine, adding a photo re-ran the whole story (5.11), which reset every caption placement the user had already set. And now that the story targets 5–7 frames (2.5), a plain regenerate might not even include the photo the user just added — the model, aiming for 5–7, drops it.
- **Options:** keep the full rebuild; append the added photo as a new frame, captioned in the context of the story, leaving the existing frames untouched.
- **Decision:** Append. Each added photo becomes a new frame at the end with an AI caption; existing frames, captions, and placements stay exactly as they were. The photo id is sent to the model as a `mustInclude` field so it is always captioned, even past the 5–7 target. If generation fails, the photo is still appended with an empty caption for the user to type or regenerate — it never silently disappears.
- **Why:** A rebuild that throws away the user's refine work is a bad surprise; appending is the least-destructive way to extend a story past the AI's pick. `mustInclude` is what makes it reliable — without it the model would routinely drop a hand-added photo, which is exactly the one the user wants kept. This is the escape hatch named in 2.5, and it supersedes the "adding a photo triggers the same rebuild" note in 5.11.

### 5.17 Delete the `design/` folder — the built app is the design reference
- **Problem:** The `design/` folder held static HTML mockups, a palette, and a theme preview from before the app existed. Now that the flow is built, the same design lives in two places that can drift.
- **Options:** keep the mockups/theme preview as reference; delete the folder.
- **Decision:** Delete `design/`.
- **Why:** The design is now implemented in the running app — the color theme is the SCSS Material theme (`--mat-sys-*` tokens, 5.2) and the UI is standard Material components, so opening the app shows the real design and theme. The mockups and the separate theme preview duplicate that, add clutter, and can go out of sync with the code. There is no second theme to keep.

### 5.18 One-finger drag stopped after a few pixels on a real phone — touch-action on the textarea
- **Problem:** After 5.15 shipped, resizing (pinch) worked but dragging with one finger moved the caption a short distance and then stopped; the user had to lift and re-grab repeatedly. Reproduced with real touch emulation (Playwright CDP `Input.dispatchTouchEvent` on a mobile context): a 120×140px drag delivered only 2 `pointermove` events, then Chrome fired `pointercancel` + `lostpointercapture` and the caption moved ~10px before dying.
- **Cause:** The caption box has `touch-action: none`, but `setPointerCapture` was called on `event.target` — the `<textarea>` that fills the box. A `<textarea>` is a form control that starts its own touch scroll/selection, which overrode the ancestor box's `touch-action`; a few pixels into the drag Chrome decided the touch was a pan, cancelled the pointer, and the drag ended.
- **Options:** (1) `event.preventDefault()` in the move handler; (2) make the caption non-editable while dragging (separate drag mode); (3) put `touch-action: none` directly on the textarea and capture the pointer on the stable box element.
- **Decision:** Option 3. `touch-none` is set on the textarea itself (tap-to-type is unaffected — `touch-action` governs pan/zoom gestures, not focus or typing), and `setPointerCapture` now targets the box (`event.currentTarget`), with the capture element tracked so release happens on the same node.
- **Why:** The textarea was the one hit target inside the box still offering the browser a native touch gesture to steal; setting `touch-action: none` on it removes that, so no `pointercancel` and the one drag runs to completion. Capturing on the box keeps capture on a stable, `touch-action:none` element rather than whatever child was touched. preventDefault (option 1) fights passive-listener rules and is less idiomatic than `touch-action`; a separate drag mode (option 2) is a bigger change for no extra benefit.
- **Testing:** This is a `touch-action`/`pointercancel` regression that jsdom can't model (no real layout, no touch gestures), so it isn't unit-testable; the existing gesture-math unit tests stay green (99 pass). The fix is proven with a real-touch browser harness — before: 2 moves then `pointercancel`, ~10px; after: all 24 moves delivered, 0 `pointercancel`, the full 120×140px. Pinch and tap-to-type re-verified on real touch.

### 5.19 Caption lives in one fixed always-visible band, not the lower third
- **Problem:** The default caption placement was the lower third (`yPct 78`), which the refine bar and the edit sheet sit over, so the caption was partly hidden in most frames. To compensate, the editor lifted the caption to `yPct 34` on open and the view reverted to `78` on close, so tapping a caption moved it up and Done moved it back even when the user never dragged it.
- **Options:** (1) keep the lower-third default and lift on open; (2) keep the lower-third default but slide the whole photo up while a sheet is open; (3) place the caption in one fixed band that clears the top and bottom bars, open the editor at the stored position, and clamp the drag to that band.
- **Decision:** Option 3. Default `yPct 46`; the editor opens at the caption's stored `yPct` (no lift); the drag band is `yPct 14–58`, above the top edit bar and above the bottom sheet.
- **Why:** WYSIWYG — the caption is always visible and stays exactly where it is shown, so it never jumps on open or snaps back on Done. The lift was the source of the jump, and the lower-third default was the source of the occlusion; both go. Option 2 keeps the classic lower third but still moves the caption on every edit.

### 5.20 The story viewer preloads neighbour frames so the photo and progress bar stay in sync
- **Problem:** The viewer rendered the full-resolution original (`URL.createObjectURL(file)`, up to several MB) in a single `<img>` whose `src` swapped on each tap. Decoding the new photo took time while the progress bar (CSS only) flipped instantly, so the bar ran ahead of the still-decoding photo and fast taps queued decodes.
- **Options:** (1) downscale a screen-sized preview for the viewer; (2) keep the full-res original but keep the current ± 1 frames mounted so they are already decoded; (3) both.
- **Decision:** Option 2. Render the current frame and its immediate neighbours as stacked layers, kept mounted with `opacity-0` (not `display:none`, which can skip decode). Only the current layer is opaque and the swap has no transition. At most 3 photos are mounted.
- **Why:** A neighbour is already decoded before it becomes current, so paging swaps a ready image and the photo and the highlighted segment advance in the same paint — no lag, no bar/photo mismatch. Keeping the full-res original avoids a second image pipeline; the originals stay for a future export. Downscaling (option 1) is deferred until the export path exists.

# Chapter 6 — Phase 2: longer stories without timing out

The value in [2.4](#24-how-many-photos-can-the-user-bring-in) is the AI picking the best frames from a real camera-roll dump. Phase 1 decided **30** photos for that but ships **10** (commit `c5525bf`, "cap the photo pick back for a stable deploy"): a single synchronous request has the vision model process every photo while the browser holds the connection open, and at 30 that runtime competes with Render's request timeout and drops on cold start. Phase 2 removes that constraint so 30 can ship for real.

### 6.1 Restore the 30-photo cap by generating as an async job
- **Problem:** At 30 photos the model's runtime on one request is long enough to hit Render's proxy/idle request timeout and to drop if the free container cold-starts or the mobile connection closes. The synchronous request/response that worked for 10 photos (3.3) doesn't survive 30.
- **Options:** keep 10, synchronous; send 30 but stay synchronous and hope it fits the timeout; send 30 and process it as an async background job.
- **Decision:** 30, as an async job. `POST /api/v1/generate` enqueues the work and returns **`202 { jobId }`** immediately; a background worker runs the Gemini call; the finished frames are delivered when ready (6.3).
- **Why:** It decouples the HTTP request from the model's runtime, so generation time no longer competes with the request timeout or with keeping a mobile connection open. This is what lets the 30-cap value decided in 2.4 actually ship — the synchronous path is why it was pulled back to 10.

### 6.2 In-memory queue, single worker — not Redis/BullMQ yet
- **Problem:** The job has to live somewhere between enqueue and completion, with its status readable while it runs.
- **Options:** a durable external queue (Redis + BullMQ); an in-process in-memory queue plus a job map.
- **Decision:** In-memory queue with **one worker (concurrency 1)** in the single NestJS container; job state (`queued → processing → done | failed`, plus result or typed error) held in an in-memory map keyed by `jobId`.
- **Why:** The free tier runs exactly one container, so there is nothing to coordinate across instances and an in-process queue matches the deployment (3.6). Concurrency 1 serializes jobs, which bounds memory (30 downscaled images per job, 4.5) and protects the shared free Gemini key — the same intent as the daily budget cap (4.1). **Accepted limit:** a spin-down or restart mid-job loses that job; acceptable at this stage. **Production upgrade, no API change:** swap the map/queue for Redis + BullMQ for durability across restarts and instances.

### 6.3 Deliver the result over Server-Sent Events, not polling or a webhook
- **Problem:** The client needs to learn the job finished and receive the frames (or a typed error).
- **Options:** the client polls `GET /jobs/:id` on an interval; a webhook; a Server-Sent Events stream.
- **Decision:** **SSE.** The client opens an `EventSource` on `GET /api/v1/jobs/:id/events`; the server pushes status transitions and the final result. On connect the server first replays the current status, so a dropped connection (e.g. a cold start) recovers. A plain `GET /jobs/:id` stays as a polling fallback.
- **Why:** A webhook is server→server — it POSTs to a public URL, which a browser client does not have, so it cannot deliver to the Angular app; SSE is the browser-native push (`EventSource`). Against polling, SSE delivers the result the moment it is ready instead of on the next poll tick, and removes the repeated poll requests from the backend, for marginally more code. A bidirectional WebSocket is not needed — the flow is one-directional, server→client.

### 6.4 Photo proxy size at 30 photos — no change needed
- **Problem:** Would 30 downscaled proxies in one POST body exceed the request body cap?
- **Options:** raise the body cap; downscale each proxy harder to fit; leave it as-is.
- **Decision:** Leave it. The body cap is already **`50mb`** (`apps/api/src/app.setup.ts`), sized for 30 proxies (~1MB each, base64-inflated). 30 photos fit — no downscaling change and no cap change. (Corrects an earlier assumption that 30 wouldn't fit the cap that 10 fit under; the cap was never 10-sized.)
- **Why:** The 1024px/JPEG80 proxy (3.4) is unchanged and 30 of them are within the existing, already-validated limit. Downscaling harder would only buy upload speed — a real but separate lever — so revisit it only if 30-photo uploads feel slow in practice, not to "fit the cap".

### 6.5 Stories up to 30 photos stay a single call — pipeline dropped
- **Problem:** A 30-photo story needs every candidate judged on the same bar, then selected, ordered, and captioned. The open worry was whether one Gemini call can hold 30 images at once, or whether it needs to be split.
- **Options:** (a) send all N in one call; (b) parallel batches scored against a fixed rubric (drifts — no batch sees the others); (c) sequential batches carrying a running shortlist (calibrates, but slower and more complex); (d) a **describe-then-decide pipeline** — `ceil(N/10)` describe-and-rate calls (≤10 images each) → one text "decide" call that ranks, selects, orders, and captions.
- **Decision:** Option (a) — **one call for all N up to 30.** The describe-then-decide pipeline (d) is **dropped, not built.** `N ≤ 30` stays the Phase 1 single call, unchanged.
- **Why:** The ≤10 "sweet spot" was a quality *assumption*, not a model limit. `gemini-flash-latest` accepts **up to 3,600 images per request** for image input (Google's image-understanding docs, checked 2026-07-27); the only binding constraint at 30 is the 50mb request body, which 30 downscaled proxies already fit (6.4). So there is no hard reason to split, and the measure-first eval (`apps/api/scripts/eval-single-call`, batches of 12/20/30) is the go/no-go: the single call holds selection/order/caption quality across the range. Adding four model calls of pipeline complexity on top of a call that already works is the thing to avoid. (The ≤3-image figure sometimes quoted is for Gemini Flash **Image** generation, not image input — it does not apply here.)
- **Revisit trigger:** if the single-call eval later shows selection or captions visibly degrade at 20–30 photos, the fallback on record is the describe-then-decide pipeline (d), with EXIF `takenAt` as an ordering hint and an optional caption pass that re-sends the 5–7 finalists' images. Not built unless that regression shows up. (Reverses the earlier eng-review lean toward building it; Flash's image-input limit removed the premise. 2026-07-27.)

# Chapter 7 — Phase 2: getting the story onto Instagram

Phase 1 leaves the finished frames in the app; this chapter is how they reach an Instagram Story. Instagram gives an app no clean, sanctioned way to post a multi-card story in one shot, so this is a chain of narrowing options — each section heading is the conclusion. The research is Meta's [Sharing to Stories](https://developers.facebook.com/docs/instagram-platform/sharing-to-stories/) and [Sharing to Feed](https://developers.facebook.com/docs/instagram-platform/sharing-to-feed/) docs.

**Phasing (7.11):** only the **web** hand-off and **auto-styling** (7.10) ship in **Phase 2**; the whole **native** path (7.2–7.3, 7.5–7.9) is deferred to **Phase 3**, gated on Phase 2 evidence. The sections below are the worked-out reasoning for both — the phase split is [7.11](#711-phase-2-ships-web-only-native-app-and-per-card-hand-off-move-to-phase-3).

### 7.1 There is no one-tap "post all my cards" — Instagram takes one card at a time
- **Problem:** The wanted experience is one button that opens Instagram with all 5–7 cards loaded, ready to post.
- **Options:** (a) Meta's **Sharing to Stories SDK**; (b) Instagram's in-app **Select Multiple** from the gallery; (c) auto-post via the **Content Publishing API**; (d) a **click bot** that scripts the app.
- **Decision:** No option loads a batch of cards into the composer. The SDK passes **exactly one background per call** (no batch). Select Multiple is Instagram's own UI — an outside app cannot pre-select images into it; the user taps each one. The API needs a Business account + Facebook Page + App Review (1.3) and doesn't use the interactive composer. A click bot is **rejected outright**: automating a personal account breaks Instagram's Terms, risks the user's account being locked/banned, and needs harvested credentials or an on-device accessibility bot. So posting is inherently one card / a manual step at a time; the design picks *which* manual shape (7.2).
- **Why:** These are platform limits, not gaps in our build. Naming them stops the one-tap idea being re-raised, and rules out the two "automatic" routes (API, bot) on cost and on terms/safety respectively.

### 7.2 Delivery: per-card SDK deep link (background image + caption sticker)
- **Problem:** Given one-card-at-a-time (7.1), pick the hand-off that feels most automatic and keeps the caption adjustable in Instagram.
- **Options:** (a) **Select Multiple** — save flat frames to Photos, user multi-selects all in one Instagram trip, caption baked flat; (b) **per-card SDK** — `instagram-stories://share` opens the composer with that card's photo pre-loaded and the caption as a movable sticker, one hand-off per card.
- **Decision:** **Per-card SDK — for the native app.** Each card passes a **background image** (the photo, 9:16) + a **sticker image** (the caption). In Instagram the photo is pre-loaded and the caption is a **movable/resizable sticker**; the user adds music/text there and posts, returns to the app, does the next card. (This is the **app** path, the promoted way to post; the free **browser** path keeps Select Multiple — 7.8 — since a browser can't reach the SDK.)
- **Why:** Select Multiple is one trip but still **manual multi-selection inside Instagram** (we can't pre-load it, 7.1) and bakes the caption flat (fixed, not movable). The SDK makes each card a clean pre-loaded hand-off and keeps the caption adjustable — the thing the flat path loses. **Caption placement:** the sticker is rendered as a **full-canvas transparent PNG with the caption at the position set in Phase 1**, so it lands correctly placed yet stays movable. The caption's *words* aren't re-typeable in Instagram (it's a graphic) — re-wording is done in our app before hand-off. **Accepted cost:** 5–7 cards = 5–7 app↔Instagram hand-offs (the "ping-pong"); the app guides it as a one-tap-per-card rhythm (progress rail, hook card first), so a user who stops early still posted a coherent opening.

### 7.3 Package as a native app via Capacitor
- **Problem:** The SDK (7.2) is native-only — iOS writes the image to the **UIPasteboard** then opens `instagram-stories://share`; Android builds the `ADD_TO_STORY` **intent**. A browser/PWA can do neither. So posting requires a native app; how do we build one without throwing away the Angular app?
- **Options:** responsive web / PWA (no SDK — can't post); **Capacitor** wrapper; **React Native / Flutter** (rewrite the UI); **full native** Swift + Kotlin (two UIs).
- **Decision:** **Capacitor.** Wrap the existing Angular app in an iOS/Android shell, reuse 100% of the UI, and add **one custom Sharing-to-Stories plugin** (pasteboard + scheme on iOS, intent on Android). Register a **Facebook App ID** (mandatory since Jan 2023).
- **Why:** The SDK is the only native-only dependency, and Capacitor unlocks it while keeping one codebase — React Native/Flutter/full-native all mean rebuilding the UI already shipped. **Accepted cost:** the native release tax — Apple Developer ($99/yr) + App Store review, Google Play ($25) + review, a Mac for iOS builds, and an ongoing store build/release pipeline. This reverses an earlier lean toward a PWA: the PWA was cheaper but can't reach the SDK, so the store tax is the price of the per-card hand-off (7.2).

### 7.4 Music is added in Instagram, guided by suggestions — never baked by us
- **Problem:** The user wants music on the story.
- **Options:** (a) our app bakes an audio track into the hand-off; (b) the user adds Instagram's Music sticker after the card is loaded; we supply the search terms.
- **Decision:** (b). Cards are handed over silent; the user adds music **inside Instagram, per card**, and the app suggests exact search terms (mood / genre / example tracks) read from the story's vibe.
- **Why:** Instagram music is a **licensed catalog** addable only via the in-app Music sticker — no API, web or native SDK, injects a track, and the Sharing-to-Stories parameters carry **no audio field**. The only self-baked route is a **video with our own track**, which needs music rights and can be **muted by Instagram's audio-matching**. Music is therefore inherently an in-Instagram step; with the per-card SDK the user is already in the composer per card, so adding it there is natural — our leverage is making the search instant.

### 7.5 The QR is a "get the app" CTA, not a story-transfer bridge (no persistence)
- **Problem:** A desktop user built a story in the browser but can't post from desktop. Do we carry that exact story to their phone?
- **Options:** (a) **server-persist** the story under a short-TTL id and have the phone fetch it — true cross-device continuity, but needs blob storage + a full-res re-upload; (b) **no persistence** — the QR just converts the user to the app, where they build fresh.
- **Decision:** (b), **no persistence.** Once the web user reaches the payoff (a finished story, images downloadable), show a QR (desktop) / button (mobile): **"Post straight to Instagram — get the app"** → opens the app store / TestFlight (7.6). The story does **not** transfer; the user builds it in the app, where their photos already live. **No server storage, no id, no full-res re-upload.** On mobile web the manual Select-Multiple post still works with no app at all.
- **Why:** Cross-device story transfer needs blob storage, a persistence layer, and a full-res re-upload — too much for this stage, and it would hold users' photos server-side (a step up from "photos never leave the browser"). Dropping it removes a whole subsystem. The QR's job is **conversion, not continuity** — a "try our app" CTA fired at peak intent, right after the user has seen a finished story; a descriptive label lifts scan rate ~37% vs a bare code. **Accepted limitation:** a desktop-built story isn't continued on the phone — desktop is build + download + app CTA, and real posting happens on the phone (mobile-web Select-Multiple, or the app fresh). Revisit persistence-backed continuity when accounts arrive (Phase 3).

### 7.6 Distribution before the stores: TestFlight (iOS) + APK / Play testing (Android)
- **Problem:** A native app (7.3) isn't in the App Store / Play Store on day one — how do early users install it, and what's the friction per platform?
- **Options / facts:** **iOS has no free sideloading** — the pre-store channels are **TestFlight** (public link, up to 10k testers, a lightweight Beta App Review, needs the $99/yr Apple account, builds expire after 90 days) or **Ad Hoc** (100 UDID-registered devices/year). **Android** allows a **direct APK** install (host it, user allows "install unknown apps"; no review) or **Play testing tracks** (internal/closed/open, open giving a public opt-in link).
- **Decision:** Early rollout via **TestFlight (iOS)** and **direct APK / Play open testing (Android)**; public store listings later. The free web path (7.8) covers anyone who won't complete an install.
- **Why:** iOS gives no zero-gate install, so TestFlight is the only public pre-store route and it carries a real account + beta-review + 90-day-expiry cost; Android's APK is effectively frictionless by comparison. The asymmetry — easy on Android, gated on iOS — is exactly why the no-install web path stays primary (7.8) until the stores lower the iOS install cost.

### 7.7 The finalize flow (app path): a resumable burn-down, tuned for completion
- **Problem:** The per-card hand-off (7.2) is 5–7 app↔Instagram round-trips — above the step count where completion falls off sharply — and each trip is a forced interruption. Without a designed flow, users abandon a half-posted story. (Evidence-based; research summary in [phase-2/open-questions.md Q8](phase-2/open-questions.md).)
- **Options:** (a) a bare "next card" loop with a manual "mark as posted" tap (what every scheduler does); (b) a designed, resumable burn-down with endowed progress, optimistic advance, and a completion payoff.
- **Decision:** (b). One screen: an **endowed-progress meter that opens with "Story built ✓" already filled** (never "0 of N"); a list of cards where the **single active card is the only anchor** and carries the one "Add to story" button; **optimistic return-detection** — signal is the Capacitor **App `resume` event** (Instagram gives no success callback, so `resume` fires whether the user posted *or* cancelled); mark the card Shared, advance, and keep a **visible per-card `Shared · Undo`** state until the user leaves the finalize screen (not a fading toast), re-tap idempotent — so a card cancelled inside Instagram is always correctable (D2; eng review 2026-07-31); **goal-gradient** copy near the end ("2 left", "last one"); a **completion state that leads straight into the music search terms** (7.4). Progress **persists locally and resumes on the same device** (IndexedDB on web, native storage in the app — **no server store**, 7.5), so leaving for Instagram and coming back lands on the next unposted card, never a restart. Ordering: **hook card first and a strong card last, weakest in the middle**.
- **Why (concrete numbers):** endowed progress raised loyalty-card completion **34% vs 19%** (Nunes & Drèze 2006) → open the meter pre-filled. Save-and-resume cut abandonment **~25%** (Jobvite) and this flow *guarantees* interruption → resume is mandatory. Goal-gradient motivation rises **~20%** near the goal (Kivetz 2006) → foreground what's left. Optimistic advance removes the manual "mark as posted" tap ×5–7 that schedulers force (D2), with Undo as the safety net. Peak-end (Kahneman 1993) rewards a strong ending; a strong opening insures an early quitter still shipped the hook → strong first and last. The simpler web path (7.8) shares the endowed-progress framing, the completion→music payoff, and the ordering, but is one trip (Select Multiple), so it needs no per-card advance.

### 7.8 Web tries it free through download; the native app is the promoted way to post
- **Problem:** How do the browser and the native app relate, given no persistence (7.5) and no forced install?
- **Options:** (a) force install to post; (b) app-only; (c) the browser delivers the whole build for free, and the app is the **promoted destination** for posting.
- **Decision:** (c). The **browser works with no install** through generate → refine → **download the images** (and on mobile web, Select Multiple posts with no app). The **native app is actively promoted** — via the "get the app" CTA / QR (7.5) fired the moment the user has just seen their finished story — as the way to post card-by-card with the movable caption sticker and the guided burn-down (7.7). The app is the destination we convert to, **not** a deferred footnote; install is offered, never forced; nothing is persisted server-side.
- **Why:** Letting the browser reach the payoff with zero install friction captures users a hard gate would lose (Google: an install interstitial made **69%** abandon the page; +**17%** mobile-web actives when it was removed), and pitching the app **right after** the user sees value converts best (contextual prompts **60–70% vs <30%** cold). So the app stays front-and-centre as the conversion goal while the browser still delivers the core, so no one is blocked. This **adjusts** the earlier "optional upgrade / install deferred" framing: the app is the promoted product, not an afterthought — the browser is the free on-ramp to it. **Trade-off:** the web path posts flat baked captions (or, on desktop, just downloads); the movable sticker + guided per-card flow is the app's draw.

### 7.9 Rollout: Google Play first, free, to learn before investing in iOS
- **Problem:** The native app could go to both stores, but iOS is slower and riskier to reach the public (Guideline 4.2 thin-wrapper risk, $99/yr, multi-cycle review), while Google Play reaches production faster and more leniently. Where do we launch first, and how do we price it?
- **Options:** (a) both stores at once; (b) **Google Play first, free**, gather usage data, then decide what to build next and whether iOS is worth it.
- **Decision:** (b). Ship the native app on **Google Play first, free**, and use it to learn what users actually want (which features land, whether the per-card hand-off works, retention) before spending on the iOS App Store or on more features. The **web stays the free no-install on-ramp everywhere** (7.8); iOS users get the web path (plus TestFlight if committed, 7.6) until the data justifies the App Store push.
- **Why:** Play is the cheaper, faster, lower-risk channel to real users, so it's the better place to gather signal first; free removes a conversion barrier while the goal is **learning, not revenue**. Deferring iOS avoids paying the 4.2 review risk and the $99 before we know the app earns it. Matches the web-first, learn-before-investing posture (7.8) and the "measure conversion by path" trigger (open-questions Q7). **Note:** a new personal Play account still clears the **12-tester / 14-day closed-test gate** (7.6) before production, so "Play first" is fast but not instant.

### 7.10 In-app customization is out; readability auto-styling is in Phase 2 as metadata only
- **Problem:** Should we let the user customize the look of the story (font colour, background, stickers) to make it more engaging and readable — given Instagram's own editor already offers all of that for free after hand-off?
- **Options:** (a) build an **in-app customization editor** (colours/fonts/stickers, manual placement); (b) **AI auto-styling for readability** — the generator picks a legible, vibe-matched caption treatment; (c) nothing, rely entirely on Instagram.
- **Decision:** **No editor (a is out); auto-styling (b) is in — Phase 2, metadata only.** **Contrast + scrim are computed deterministically on-device** (sample luminance under the caption box on the full-res original → black/white text + a scrim below a WCAG-ish threshold — a pure, testable function, *not* model-generated, since the model only saw the downscaled proxy; recomputed when the caption is dragged). The model contributes only the **subjective font/vibe** as **styling metadata** on the JSON it already returns; the client composites **on-device**. Manual fine-tuning still happens in Instagram. **Hard guardrail:** metadata only — any variant needing **server-side rendering, images pushed back through the container, or a bucket** is deferred to a later phase. (Contrast-computation call from the 2026-07-31 eng review.)
- **Why:** Instagram's Story editor (free, familiar, Meta-maintained) is the real competitor for manual customization; rebuilding it in-app is redundant and loses to Meta, and the product's moat is the **AI curation** (select / order / caption), not styling. But an unreadable baked caption is a **generation-quality defect**, not a missing feature — so a legible-by-default treatment belongs in generation. It fits Phase 2 because it rides the **existing metadata channel** (no architecture change): the app already composites captions from metadata, so styling attributes are just more of the same JSON. Server-rendering high-res frames back through the container would change the architecture, which is why that variant is deferred. **Validation gate** (open-questions Q10): review 5–10 real stories for unreadable captions and let the defect rate size the feature. **Heuristic recorded:** a feature that rides the existing metadata channel with no architecture change can be scoped into the current phase — don't defer cheap wins on a false "it needs a bucket" assumption.

### 7.11 Phase 2 ships web-only; native app and per-card hand-off move to Phase 3
- **Problem:** The Instagram plan (7.1–7.9) put a large native build — Capacitor shell, a two-codebase Sharing-to-Stories plugin, a Facebook App ID, two store accounts, and the per-card burn-down UX — on Phase 2's critical path. An outside-voice review (2026-07-31) flagged that native makes multi-card *higher*-friction than the free web Select-Multiple trip (N hand-offs vs one), with no evidence the web path loses users.
- **Options:** (a) build web + native together in Phase 2 as planned; (b) ship **web-only** in Phase 2 and **defer the whole native path to Phase 3**, gated on Phase 2 evidence.
- **Decision:** (b). **Phase 2 = web-only** — the web finalize path (render flat frames → download / mobile Select Multiple) plus deterministic **auto-styling** (7.10). The **native app and everything that depends on it** — per-card SDK hand-off (7.2), Capacitor (7.3), QR "get the app" (7.5), distribution (7.6), burn-down finalize UX (7.7), rollout (7.9) — **moves to [Phase 3](phase-3/spec.md)**, built only once Phase 2 data shows the web hand-off actually loses users. The reasoning in 7.1–7.9 stands; only the phase changes. Music suggestions (7.4) are also cut for now.
- **Why:** Native is two native codebases + a Meta App ID + two store accounts to build a flow *measurably higher-friction* for multi-card than what the web already does for free, so committing before evidence spends the innovation token on an unvalidated bet (boring by default; keep the native decision earned and reversible). Auto-styling is the cheap win that rides the existing metadata channel, so it ships now. **Gate metric (open-questions Q11):** the share of Phase 2 users who abandon at the web Select-Multiple hand-off — that's the signal that justifies building native. (Adopts the outside-voice recommendation from the 2026-07-31 eng review.)

### 7.12 Caption render fixes: clamp placement to the visible band, modern font; leave generation retry alone
- **Problem:** Three caption-render defects on the payoff screen (captions run off the left/right edge; bottom-anchored captions sit under the action bar; the `caveat` font renders as Comic Sans/cursive), plus a report that "start generation" fails intermittently.
- **Options (placement):** (a) clamp the caption at the display layer; (b) rewrite the overlay to force horizontal centring; (c) map the AI's zone placement into the same visible band the editor drag already clamps to.
- **Options (generation):** (a) raise the per-IP hourly limit; (b) add an upstream retry; (c) change nothing.
- **Decision:** **Placement = (c).** The caption box is `w-[78%]`, so its centre must sit within ~[40, 60] horizontally to stay on-frame; `ZONE_TO_PLACEMENT` x is now 42/50/58 (was 28/50/72) and bottom y is 56 (was 84, inside the editor's 14–58 band). The editor drag X clamp is tightened to 40–60 to match. **Font:** `caveat` maps to a modern rounded sans (`ui-rounded`), never cursive. **Generation = (c): change nothing.** The failure is transient and succeeds on a user retry.
- **Why:** The editor already defined a visible band (DRAG_MIN/MAX) that keeps a dragged caption on-frame and clear of both bars; the AI's initial zone placement wasn't obeying it, so aligning the zone map to that same band fixes overflow and button-overlap with one consistent rule (and keeps the exported PNG and the preview in agreement). `caveat` was the only cursive stack, which read as dated. The rate limit was not the cause — the observed failure cleared on retry, so it is a transient upstream (503/timeout) that self-heals; adding a retry or raising the limit would spend effort on a path that already recovers. **Trade-off:** horizontal drag is now a small nudge and "bottom" captions sit mid-low in the exported frame (the band's ceiling), the cost of guaranteeing captions never leave the frame or hide behind the controls. (Placement/font fixes + generation call from the 2026-08-01 session.)

### 7.13 Story frames look designed via a curated static look, not a filter
- **Problem:** Generated frames read as generic — "text on a photo." Captions size inconsistently, and the six frames look like a raw camera roll (colour varies frame to frame), so the story isn't share-worthy.
- **Options:** (a) a dominant photo **filter** / signature grade stamped on every story; (b) auto-**extract** a palette + treatment from each photo; (c) a **curated static look**: the design lives in type + layout + palette, and the photos get only neutral cohesion.
- **Decision:** (c). One **curated palette per story** (white text, near-black text, one restrained accent — not free colour, not auto-derived), applied to every frame. **Neutral photo cohesion, lightest touch** — consistent gentle contrast + a whisper of grain across all frames, capped so a match can't break a photo; **skip aggressive auto-white-balance**. Add **self-hosted display type**, **composition-aware caption placement** (model drops text into negative space, off faces), an **authored band** in the palette when a photo has no clean space, and **content-aware type fit**. All client-side canvas + model metadata; holds [7.10](#710-in-app-customization-is-out-readability-auto-styling-is-in-phase-2-as-metadata-only). (Plan: [story-design-plan.md](phase-2/story-design-plan.md).)
- **Why:** A dominant filter makes every story look the same and dates fast; auto-extracted palettes/treatments come out muddy and *inconsistent frame to frame*, which breaks the cohesion that makes a set read as one piece. The 2026-current move is honest photos with the personality carried by **type and layout**, so the "look" is pulled off the pixels and onto the type system. Neutral matching (like a colorist matching shots) is an *unseen* detail that unifies without imposing a style; capping it keeps an invisible fix from becoming a visible mistake. The band reads as a magazine cover-bar, so a busy photo still looks authored, not failed. (Emil-Kowalski-lens review + user calls, 2026-08-01 session.)

### 7.14 Guided stickers: the AI marks what + where, the user places Instagram's own
- **Problem:** The hand-off is a bare export. The user has to decide *what* Instagram stickers to add and *where* — and we can't post stickers via the API anyway (hand-off, [7.1](#71-there-is-no-one-tap-post-all-my-cards--instagram-takes-one-card-at-a-time)). Baking flat stickers loses Instagram's real, interactive ones (location, poll, GIF, music).
- **Options:** (a) bake flat sticker graphics into the frame; (b) nothing — leave stickers entirely to the user; (c) **"Malen nach Zahlen" (paint-by-numbers)** — the model marks a spot and a suggestion, the user places Instagram's own sticker there.
- **Decision:** (c). Per frame, the model optionally emits `{ type, query, position }` (Location, GIF search term, Poll / Question, Time, Mention). **In-app:** a placeholder marker (dashed outline + label, e.g. "GIF: search 'cake'") at the position. **Export stays clean**; the placeholders become a guided post checklist at hand-off. Sparse and optional. (Plan: [story-design-plan.md](phase-2/story-design-plan.md).)
- **Why:** It removes both user decisions (what + where) while keeping Instagram's real interactive stickers, which are richer than anything we can bake and which the API can't post for us. It is the same **suggest-don't-bake** pattern already chosen for music ([7.4](#74-music-is-added-in-instagram-guided-by-suggestions--never-baked-by-us)) — extended to stickers — so it rides the existing metadata channel with no new architecture, and turns the hand-off from a chore into a guided flow across the app and Instagram. **Note:** this extends the earlier "interaction stickers are out" line — we still never *bake* them, we *guide* their placement.

### 7.15 Ship the static look + guided stickers first; defer the motion/reveal layer
- **Problem:** The app "doesn't kick." Two different fixes are in play: the frame *looking* generic (a static, shareable-artifact problem) and the app *feeling* flat (a motion / in-app-playback problem — a dramatized reveal, streaming the model's reading of the photos, caption entrance, Ken Burns).
- **Options:** (a) build the motion/reveal layer first; (b) build the static look (7.13) + guided stickers (7.14) first, defer motion.
- **Decision:** (b). Build the static look and guided stickers now; **park the motion/reveal layer** as a separate later plan.
- **Why:** The exported PNG can't carry motion, so the motion layer only improves in-app *feel*, not the shared artifact — a different problem from "the frame looks generic." A share-worthy frame is the prerequisite (no point premiering a boring story), so the static look ships first. The reveal/streaming idea is kept (it's a strong later bet), just sequenced after.

### 7.16 Caption display face: a self-hosted modern grotesque (Bricolage Grotesque, OFL)
- **Problem:** Captions rendered in a generic system font (`system-ui` / Roboto), the biggest driver of "the frame looks generic." The four style-slot fonts were unbundled generic-family fallbacks.
- **Options:** warm display **serif** (e.g. Fraunces); modern **grotesque** (e.g. Bricolage / Space Grotesk); bold **impact** (e.g. Anton / Archivo Black).
- **Decision:** modern grotesque — **Bricolage Grotesque**, self-hosted (OFL, bundled woff2), used as the default caption face. Swappable (one file + a family name).
- **Why:** the user picked the grotesque personality; Bricolage has genuine display character (avoids the "generic clean sans" trap) and reads current. OFL is free to self-host and embed. The frames are canvas, so a bundled face doesn't touch the Tailwind/Material rule. Serif/impact remain available for a later tone mapping.

### 7.17 Guided stickers scoped down to one high-confidence tag; name-not-handle, never auto-assert
- **Problem:** The guided-sticker idea (7.14) grew into a cue subsystem (draggable/dismissible markers, per-type motion, a per-frame hand-off checklist, EXIF-GPS geocoding) — a lot of surface for a secondary feature, and it risked turning "takes mental load off" into homework. Auto-tagging a place also needs the exact Instagram handle, which we can't reliably resolve.
- **Options:** (a) build the full cue subsystem; (b) ship a minimal v1 — one high-confidence suggestion, editable, skippable; (c) auto-assert an `@handle` the model guesses.
- **Decision:** (b), and **never (c)**. v1 = **one high-confidence suggestion on the hero frame**, editable and skippable. For places/accounts, hand the user the **name** and let Instagram's search resolve the tag — **never auto-assert an `@handle`**. Confidence sets the tone; always one-tap editable. **Sequence it after** the art-direction frames (7.13). Drag/motion cues and multi-suggestion are later enhancements.
- **Why:** a share-worthy frame is the prerequisite (no point premiering a boring story), so the static look ships first. A confidently-wrong tag erodes trust more than no tag, and the magic is *rare* (it only fires with a strong signal like GPS or a named place), so the elaborate version is high-effort for a narrow hit rate. "Name, not handle" sidesteps the resolution problem and the risk — Instagram does the exact match. (Emil-lens review + user calls, 2026-08-01.)

### 7.18 Re-expand guided suggestions into the full "sparks" engine (supersedes 7.17)
- **Problem:** 7.17 scoped guided stickers down to one hero-frame tag with no drag/motion/multi-suggestion. With the art-direction frames (7.13, 7.16) now shipped, that minimum under-delivers the interaction the feature was meant to add.
- **Options:** (a) keep the 7.17 minimum; (b) build the fuller engine — per-frame 0–2 suggestions of any type, shown as interactive in-app "sparks", plus a hand-off checklist; (c) auto-assert `@handles` / bake stickers.
- **Decision:** (b), **never (c)**. Per frame the model emits 0–2 `{ type, query, position?, confidence }` (validated, capped, defaulted server-side). In-app: a dot at the spot that **blooms** on tap into the element's ghost with a one-tap **Copy**; flick or button to **dismiss**; a **Done** check. Music is story-level → a docked pill (no dot). After posting, a **hand-off checklist** lists every kept suggestion with Copy + Done. The 7.17 guardrails **stand**: name-not-handle, confidence-gated, always editable/skippable, and **nothing is baked into the export** ([7.10](#710-in-app-customization-is-out-readability-auto-styling-is-in-phase-2-render-only)). Drag-to-reposition is dropped — a spark is a guide whose exact spot does not transfer to Instagram, so moving it adds gesture load for no hand-off value.
- **Why:** the art-direction prerequisite from 7.17 is met, so the interaction can grow. The suggestions ride the existing per-frame metadata channel (no new architecture) and stay **sparse and optional** (most frames get none), so the "sometimes nothing" case is preserved. Metadata-only keeps the export clean and the whole thing on the free web path. Copy-term accuracy is the top risk, mitigated exactly as 7.17 set out (name-not-handle, confidence tone, editable). (Session 2026-08-01.)

### 7.19 Captions vary per photo, not a uniform terseness
- **Problem:** The "let the photo breathe" rule (7.18 era) over-corrected: the model now put three or four words on nearly every frame, so the result read as a row of identical short labels rather than a story. A viewer couldn't tell, in the first moment, how a given frame fit the storyline.
- **Options:** (a) keep the uniformly-short rule; (b) instruct the model to vary caption length per photo based on the image; (c) enforce length bands per frame position in code.
- **Decision:** (b). The prompt now tells the model to read each image and vary the caption: self-explanatory photos get a word or none (still breathe); a frame that needs context — where it is, who/what it shows, how it advances the story — earns a fuller line (a short sentence), sized down so it stays under the image. Across the story the captions should have rhythm, never a uniform row of labels. No contract change — it's prompt guidance; the client's length-based type fit already sizes short vs long text.
- **Why:** the decision of how much text a frame needs depends on the *picture*, which only the multimodal model can judge — a fixed code rule can't tell a self-explanatory shot from one that needs a line. Varying it is what makes the sequence read as a real story understood at a glance, which the uniform version lost. (Emil-lens review + user call, 2026-08-02.)

### 7.20 Reveal the add-ons before the hand-off, in a card that grows in place (supersedes the post-share tray, #89)
- **Problem:** The post-share tray (#89) rose *after* posting. But on mobile the OS share sheet takes over the screen the instant Post fires, and the user goes straight to Instagram — they never look back at our tab, so the tray (and the add-ons) went unseen. It also read as homework: equal cards, tiny unreadable photo thumbs, an oversized truncated term, and multi-line "open Instagram → Select Multiple → pick these N / the pin shows where each goes" copy.
- **Options:** (a) keep the after-post tray; (b) show the add-ons *before* handing off, in a compact card that grows in place from the action button, leading with one hero add-on; (c) rely on detecting the return from Instagram.
- **Decision:** (b), **never (c)**. When the story has add-ons, tapping Post no longer hands off — a card grows in place where the button was, presenting the add-ons; its own **Save & open Instagram** button does the actual render + hand-off (so the card is seen first, then the user leaves). With no add-ons, Post hands off directly (one tap). The card leads with a **single hero** add-on (the place — the one the user can't re-derive from memory), the exact term **fully readable** (no truncation), the rest as quiet rows; **no photo thumb, no counter, no instructions**. Motion: it grows from the button origin (bottom), never from scale(0), reduced-motion-safe.
- **Why:** the only moment we can guarantee the add-ons are seen is *before* we leave, while the user is still on our screen. A card at the button — the locus of attention, where the thumb just was — is seen where a bottom-edge tray fired at the same instant is not. Leading with one confident suggestion is legible at a glance where a list of equal cards is homework. The name-not-handle / metadata-only / editable-or-skippable guardrails ([7.10](#710-in-app-customization-is-out-readability-auto-styling-is-in-phase-2-render-only), 7.17–7.18) stand. (Emil-lens review + user calls, 2026-08-02.)

### 7.21 Per-frame typography by a layout agent (a type system, not templates)
- **Problem:** Frames read as basic/uniform. The goal is each frame looking designer-made and personal, better than default Instagram, with no two frames (or stories) alike. A fixed set of looks is just a prettier monotony; free-for-all model output is unreliable.
- **Options:** (a) hand-tuned templates; (b) let the model freely pick fonts/positions per frame; (c) a **layout agent**: a dedicated art-direction pass that composes bespoke typography from a curated **type system** under hard guardrails.
- **Decision:** (c). A small pipeline runs after the story is assembled: read the photos + **atmosphere** (optional user input, else infer it) → choose a **story design language** (palette pulled from the photos, type pairing, energy) for consistency → compose **each frame bespoke** → guardrails → **self-critique/revise once**. It emits a **layout spec** (`elements[]`: role label/title/deck, text, font, weight, case, tracking, leading, size, align, free x/y + edge-anchor, stack) that a **single shared `spec → draw` renderer** draws identically in the DOM preview and the canvas export. Guardrails replace templates: **contrast is computed on-device** (never the model's promise, extends 7.10/`computeReadable`), text stays in a **safe area**, and the **lead move never repeats within a story**. Faces: self-hosted **Bricolage** (display) + **Fraunces** (serif warmth) + **Caveat** (real hand, personal voice). Ties to caption-variation (#90): text amount and layout are one decision. Runs as a per-frame pass, streamed (SSE), because it needs the whole set's mood and room to critique — it can't fold into the single generate call.
- **Why:** the amount and placement of type depend on the *picture* and the *mood*, which only a vision model can judge; a fixed rule can't. A type system + taste-encoded constraints is how a free-composing agent stays reliably good (systems over heroes). Metadata-only keeps the export clean. **Reverses** the earlier "handwriting slot = rounded sans, never script" call — the personal direction wants a real hand. **Sliced roadmap (foundation first):** 1) bundle Fraunces + Caveat; 2) layout-spec type + pure `spec→draw` module; 3) wire it into DOM + canvas; 4) contract + validator for the spec; 5) the agent (flagged, mock-tested; visual quality needs a live key + device to tune); 6) computed-contrast + no-repeat + edit UX. **Risk:** the agent is the least deterministic part; its quality needs live tuning against real photos/model output, not a one-shot spec. (Emil-lens + eng review, 2026-08-02/03.)

### 7.22 The layout agent runs on every story (flag removed)
- **Problem:** The layout agent (7.21) shipped behind `LAYOUT_AGENT_ENABLED` (default off) so unverified, slower behaviour wouldn't turn on for real users the moment it merged. But the agent *is* the product — gating it permanently makes no sense, and judging the look needs it running on real stories.
- **Options:** (a) keep the env flag; (b) always run it in code.
- **Decision:** (b). `StoryGeneratorService` always calls the layout agent after the story is assembled. It stays **best-effort per frame** — a failed or empty frame keeps the caption/style render — so a bad frame degrades gracefully rather than breaking the story. No env flag. The self-critique pass keeps its own flag (`LAYOUT_CRITIQUE_ENABLED`, off) because it doubles the model calls.
- **Why:** the agent is the feature, not an experiment; best-effort means the downside is bounded (worst case = today's caption render), and the whole thing is trivially reversible if the output isn't good. Turned on to dogfood it on the live site. (User call, 2026-08-03.)

### 7.23 Layout agent, live-review round: less, more genuine, and it must be fast
- **Problem:** First live output of the always-on agent (7.22) failed on several fronts, seen by dogfooding the deployed site: it **timed out** (5–10 sequential per-frame calls blew the client budget); frames were **over-decorated** (label + title + deck stacked) and some carried a **"01/04" frame index** (brand chrome); the **handwriting (Caveat) read dated**; and it had **no colour or marks**, though the mockups promised a designer's pop of accent colour and a scribbled line.
- **Decision (a set of small PRs):** (1) **Parallelize** the per-frame passes (Promise.all) so a story is ~one call, not N — the timeout blocker. (2) **Restrain**: cap a layout to 2 elements (usually one), and drop frame-index chrome in `normalizeLayout` + the brief. (3) Swap the hand to **Shantell Sans** (modern, genuine). (4) Add **accent colour + hand underline** to the vocabulary: two boolean flags (`accent`, `underline`) on a layout element — the model marks intent, the **client derives the actual hue from the photo** and guarantees legibility (7.10), and draws the underline as a rough stroke in both renderers. (5) Make on-frame sparks **passive markers**, moving copy/dismiss into the hand-off card (the drag/swipe was inconsistent with the caption and did nothing useful).
- **Why:** the through-line is *less, and more genuine*. The mockups' "designer" feel came from one pop of colour + one scribbled mark, which the spec literally couldn't express (colour was legibility-only) — so it could never appear. Keeping the colour *choice* on the client preserves 7.10 while letting the model paint. Parallel is non-negotiable: sequential made every story error. (Emil-lens live review, 2026-08-03.)

### 7.24 Deterministic Looks replace model-emitted geometry (supersedes 7.21/7.23)
- **Problem:** With the layout agent live, the frames read as personal snapshots rather than designed ones. The cause is structural: the model emits the geometry itself (x/y/size/anchor per element, 7.21), so the composition is only ever as good as a language model's spatial judgement — and it varies frame to frame within one story.
- **Options:** (a) keep tuning the agent's prompt and guardrails; (b) go back to fixed templates; (c) **Looks** — the model picks 1 of 6 hand-crafted design languages and writes the words; deterministic client code owns the composition.
- **Decision:** (c). Six Looks are locked (Quiet Editorial, Film Postcard, Bold Poster, Scrapbook, Minimal, Magazine Masthead), each a full grammar: type pairing, placement, accent usage, marks, scrim. The model's job shrinks to a story-level `look` enum plus per-frame `kicker?`/`headline`/`emphasis?`, and this **folds into the existing pass-1 call** — pass 2 (`composeLayouts`) and its four modules are deleted. The client composes: each Look maps content + on-device photo analysis (quiet-zone map, sampled accent) to a `ResolvedComposition` that the existing shared DOM+canvas renderer draws. The model never emits coordinates again.
- **Why:** placement is a design problem with a right answer per Look, so hand-crafting it once beats asking a model to re-derive it per frame — that is what makes the output look designed and keeps one story internally consistent, while six different Looks keep two stories from looking the same. Templates (b) were rejected earlier for producing identical stories; a Look is a grammar, not a fixed arrangement, so it varies with the photo. Folding into pass 1 removes N per-frame calls, which is what caused the 7.23 timeouts. (2026-08-03.)

### 7.25 One composition owns the frame — nothing else draws on the photo
- **Problem:** With the Looks engine live (7.24), the Look itself composes well, but everything else on the frame ignores it. Seen by dogfooding: the personal caption is missing in the story and only reappears in refine; a location marker sits mid-frame, on the subject (a plate of food), and often on top of the Look's own type; the location can't be moved in refine; and the model writes text without any idea how much will fit. Root cause: **one frame carries three independent placement systems** — the Look composition (photo-aware), the legacy caption + `texts` blocks, and the sparks — and none of them reads the others. `ZONE_TO_PLACEMENT` maps every `bottom-*` zone to `yPct: 56`, the vertical middle, so a marker was never placed by looking at the picture.
- **Options:** (a) nudge the zone table again so the layers collide less; (b) give the composition the whole frame and let nothing else draw; (c) **build the frame as a pipeline** — the layers stay separate but run in order, each seeing what the previous ones put down.
- **Decision:** (c), at **two levels**. The **story level runs once**: order the photos, write the words, choose ONE design language for the whole story (this is the single model call). Nothing at the frame level may change a story-level decision — a frame never picks its own Look. That is what makes a story look like a set, and it is also what makes the frame level safe to run in parallel, since every frame reads the same fixed decisions and none depends on another. The **frame level then runs per image**, all frames at once. Stages: **read the picture** (where is it busy, where are the subjects) → **lay the design** (consistent, restrained, claims its area) → **set the text** (placed on picture *plus* design, not the picture alone) → **place the stickers** (whatever room is genuinely left). Stage 4 covers every Instagram element, not just the location — mention, poll, gif too, placed in confidence order while room remains; music stays story-level with a fixed home. Two rules make it work: each stage **subtracts** from a free-space map it hands on, so a later layer can never overlap an earlier one; and a stage **may decline** — if there is no honest room, a sticker is dropped rather than placed badly. Order follows importance: the design is the constant that makes a story look like a set, so a sticker never pushes it around; stickers are the least important thing and the first to go. Sliced: 1) one text per frame (kill the caption/headline split, refine renders and edits the same composition, delete `texts`/`TextBlock` and the model's `style` placement fields); 2) the pipeline + free-space map, all sticker types placed by stage 4 keeping their on-frame preview (7.23), `position` dropped from `Suggestion`; 3) a per-Look length budget for the model plus a client clamp; 4) saliency only if placement still lands badly; 5) **prepare every frame at once** — `computeReadable()` and the exporter both loop one frame at a time today, so run them concurrently with bounded in-flight work (a 1080×1920 canvas per frame means a naive `Promise.all` over ten frames is ~80 MB). Full plan: `docs/phase-1/frame-harmony-plan.md`.
- **Why:** the layers were never designed together, so re-tuning zone coordinates cannot make them agree — (a) is what produced `yPct: 56`, the vertical middle, in the first place. (b) was the first proposal here and is worse: it collapses the location into the design and loses the ability to drop it independently. A pipeline keeps the pieces separate while making it impossible for one to be blind to another, and gives a natural place to say "there is no room for this" — which is what "less" requires in practice. The story is not fully told on the image, so the type stays small enough not to dominate the photo: the design claims a modest band and the words fit it, rather than the band growing to fit the words. The caption/headline split is a straight correctness bug, not a taste call — a user edit that renders nowhere. (Live review, 2026-08-03.)

# Chapter 8 — Lessons learned

Working notes about *how* I worked on this, kept so I don't repeat the mistakes.

### 6.1 One Claude session at a time, not many in parallel
- **Problem:** Running multiple Claude sessions at once to move faster.
- **Options:** several parallel sessions; a single session.
- **Decision:** Work with one session at a time.
- **Why:** Parallel sessions can edit — or accidentally edit — the same files. Even when they don't, splitting attention across them disperses my focus and I lose the order I need to think clearly. This matters most later on, when concentration is already looser.

### 5.2 End a session before the context grows too large
- **Problem:** Letting one session run until its context window is huge.
- **Options:** keep one long session going; break the work into smaller tasks and stop the session early.
- **Decision:** Break tasks down and end the session before the context gets too big.
- **Why:** Past a point the growing context just wastes tokens and slows the session down a lot, without adding value. Stopping early — or splitting the work — keeps each session fast and cheap.
