# Approach

How this project was thought through, in chapters, so a reader can jump to the part they care about. (the `phase-*/spec.md` files = *what* we build; this = *how* I got there.)

## Contents
1. [Figuring out what to build](#chapter-1--figuring-out-what-to-build)
2. [Locking the Phase 1 architecture](#chapter-2--locking-the-phase-1-architecture)

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

---

# Chapter 2 — Locking the Phase 1 architecture

The technical decisions for building Phase 1 (create the story).

### 2.1 Where does the AI run?
- **Problem:** The app needs to send photos to a vision model and get a story back. Where does that call happen?
- **Options:** run a model on-device; call a hosted model API directly from the phone; call it through a backend I control.
- **Decision:** A thin backend proxy (phone → my backend → model API).
- **Why:** On-device models would exclude older and Android phones, and I want it platform-agnostic. A backend keeps the API key off the phone (a key shipped in an app can be extracted) and gives one place for retries, validating the model's output, and logging failures.

### 2.2 Which model?
- **Problem:** Need a vision model with good quality-to-price, ideally free for an assignment.
- **Options:** Claude, OpenAI, or Google Gemini.
- **Decision:** Gemini Flash on the free tier, with the model as a swappable config value.
- **Why:** Gemini is the only major provider with vision on the free tier (~1,500 requests/day — plenty for personal use), and it's fast and cheap. Recognizing photos, ordering them, and writing captions is low-risk, so the free model is fine. If quality disappoints, I swap in a stronger model via config with no app changes.

### 2.3 Single call or a multi-step pipeline?
- **Problem:** How do photos + intent become {which photos, what order, a caption each}?
- **Options:** one structured call that returns everything; a pipeline (describe → order → caption).
- **Decision:** A single structured call.
- **Why:** The model reasoning over all photos at once gives better narrative coherence (a pipeline that orders from text descriptions throws away the images at the step that matters most). One round trip also means lower latency. The swappable model is my quality dial; a pipeline is a documented last resort if a strong model still can't hold quality.

### 2.4 How many photos, and what size?
- **Problem:** Cameras differ (a new phone shoots huge images); sending everything is slow and costly.
- **Options:** send originals as-is; cap the count and downscale before sending.
- **Decision:** Cap the pick at ~10 photos; downscale each to **~1024px long edge, JPEG ~80%, aspect preserved** before sending; keep the full-res originals on the device.
- **Why:** Google recommends ≤10 images for good image *understanding*, which also matches a Story's natural length. 1024px is ~2 of Gemini's 768px tiles (~500 tokens/image), so ten photos is trivial against the free-tier budget — the real saving is upload speed, the biggest lever on how fast the story appears. It's also enough detail for the model to get the gist (below ~512px, faces and in-photo text blur and captions get less accurate). Downscaling normalizes every camera to one size. The originals stay on device: the model reads a small proxy, but captions are placed on the real photos the user sees and later posts (Phase 2).

> Decisions 2.5–2.8 were made while I was on a break; confirm or override them. Full architecture in [`phase-1/architecture.md`](phase-1/architecture.md).

### 2.5 App framework
- **Problem:** Need one mobile app for iOS and Android with photo picking, EXIF, and image resizing.
- **Options:** bare React Native; Expo (React Native).
- **Decision:** Expo.
- **Why:** One codebase for both platforms, and the exact libraries Phase 1 needs are first-party and boring (`expo-image-picker`, `expo-media-library`, `expo-image-manipulator`). Fastest path to a running app; EAS handles builds.

### 2.6 Backend host
- **Problem:** The thin backend (2.1) needs somewhere to run.
- **Options:** always-on server; a stateless serverless HTTP function (Vercel, or Google Cloud Run).
- **Decision:** A stateless serverless function, one `/generate` endpoint; default Vercel.
- **Why:** No state to keep in Phase 1, so scale-to-zero serverless is cheapest and simplest to deploy. Vercel is fastest to ship; Cloud Run is the alternative if I want the backend in the same Google ecosystem as Gemini. Reversible — it's just one HTTP endpoint.

### 2.7 Latency UX
- **Problem:** Generation is one call that takes a few seconds; the wait shouldn't feel broken.
- **Options:** single spinner; staged loader copy; stream/progressively reveal frames.
- **Decision:** One call with a staged loader ("reading photos… ordering… writing captions…"); streaming is a later enhancement.
- **Why:** A single structured call can't reveal frames mid-flight without added complexity. Staged copy makes the wait feel purposeful for a few-second Flash response, with no extra engineering.

### 2.8 App state
- **Problem:** Where does the in-progress story live in the app?
- **Options:** a state library (Redux/Zustand); local React state.
- **Decision:** Local React state, no heavy store.
- **Why:** Phase 1 is a single linear flow (pick → generate → refine) with one story in memory. A global store would be premature; local state is enough and simpler.
