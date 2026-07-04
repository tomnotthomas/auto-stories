# Auto Stories — Spec · Phase 1: Create the Story

**Phase 1 is the hard, valuable core:** turn a pile of photos into a story worth posting — decide which photo goes first, second, third, and write the text that ties them together. Getting it onto Instagram and the recurring journal come after this is good. See [Phase 2](../phase-2/spec.md) and [Phase 3](../phase-3/spec.md).

## Idea: Automated Instagram Stories

Making Instagram stories takes too much effort — choosing text and a narrative drains the fun out of what should be simple. The fun part is taking the photos; the tedious part is turning them into a coherent story. This turns a photo dump into an organized, well-structured story.

## Assumptions

- **"Mini app" = MVP that builds the hardest / most valuable part first.** Ship the core value first; layer secondary features on top only if time remains.
- **Responsive web app.** A deployable web app (per the take-home brief), responsive so it gives the best experience on whatever device it's opened on — laptop, tablet, or phone. No install; the user just visits the URL and uploads photos.
- **Photos only.** Videos are out of scope for v1. Media editing (filters, contrast) is not the job — assembling the story is.
- **One product: a private memory journal.** For personal memory-keeping, not business growth or selling.
- **Hooked from the first open.** A first-time tester must be hooked from the start, with the fastest path to a result. The "would you open it twice?" bar.

## Scope

**The hard part, and the whole point of Phase 1:** given a batch of photos, decide **which photo goes first, second, third**, and **write the captions that tie them into a story**. Everything else waits.

**In scope:**
- **Pick photos + say what the story is** — the user uploads 3–10 photos (3 is the minimum for a story) and answers one guided line: **"What's the story?"** with an example placeholder that coaxes specifics (e.g. *"Maya's 1st birthday at the lake house, all the cousins came"*), plus one **optional tone chip** (Funny / Heartfelt / Hype / Chill). This one line + tone is the whole context — no multi-question form. Upload is one tap: on mobile the file input opens the **native photo picker** (multi-select, Recents-first); on desktop it's drag-drop / click-to-browse / paste.
- **Ordering — narrative-first (the core value)** — the app chooses which photos to use and orders them into an arc — strongest hook first → build → payoff — driven by the story line + what's visible, **not** photo timestamps (timestamps are a soft hint only, so missing EXIF is a non-event). The user can drag to reorder in refine.
- **Captions — grounded in the story line + tone** — captions reference the specifics the user gave (names/occasion/place) and match the chosen tone, so they feel true, not generic. The model reads the images for what's visible and ties them together.
- **Fast preview, full-res result** — the app sends a **downscaled copy** of each photo (~1024px long edge, JPEG ~80%, aspect preserved) to the model for a fast response; the returned captions are placed on the **full-resolution originals** the user actually sees. The model reads a small proxy; the story uses the real photos.
- **Hook in the first frame** — strongest visual + text hook up front, so viewers don't tap past.
- **AI text overlay, user-placed** — AI writes each caption; the app drops it in a smart default position (lower third + legibility background) and lets the user drag/resize it. Static emoji count as text.
- **Review & refine** — regenerate, swap/drop a photo, edit or regenerate a caption. Nothing leaves the app.
- **First-open wow (interactive demo)** — first open shows a finished, swipeable **example** Story (real output, not a video), with one CTA — **"Try it with your photos"** → straight to upload. This is the first wow and sets expectations. No blank state, no demo video (see approach 2.3).
- **Fair-use guardrails** — the shared free tier is protected server-side: a **global daily cap** + a **per-IP rate limit**; when either is hit, the user sees *"at capacity, try later."* Separately, after ~2 free generations the app nudges *"sign up to make more"* — a friendly nudge in Phase 1, enforced per-account once accounts exist in Phase 3 (see approach 4.1).
- **Native, low-production feel.**

**Out of scope (moved to later phases):**
- **Posting / hand-off to Instagram** → Phase 2.
- **Music suggestions** → Phase 2.
- **Connecting an Instagram account, posting cadence, the recurring journal** → Phase 3.

**Out of scope (cut for good — reasons in `approach.md`):**
- Video; music (audio); media editing (filters/contrast); animated GIFs & interaction stickers; automatic posting via the Instagram API.

## User Flow (2 steps)

Value-first: the finished story is the first real output. (≤3-step flows complete ~72% vs ~16% at 7 steps — [source](https://userpilot.com/blog/aha-moment/).)

1. **What's the story? + pick** — The user picks a batch of photos (one tap → native photo picker on mobile; drag-drop on desktop) and answers one line: what's the story (what happened, or the feeling they want). This is the custom feel and the ordering signal: the user tells the app what the story is, it isn't guessed.
2. **Payoff: the story** — The app generates a coherent, ordered, captioned story, then lets the user review & refine in place: regenerate, swap/drop photos, edit or regenerate a caption, and drag/resize the text. **This is the wow moment.** Phase 1 ends here: a finished story on screen.

**Design note:** the finished example Story on first open *is* the demo — interactive, not a video — and its "Try it with your photos" CTA is the entry to step 1.
