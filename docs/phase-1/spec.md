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
- **Pick photos + state intent** — the user uploads 3–10 photos (3 is the minimum for a story) and adds a line of intent/vibe. Upload is one tap: on mobile the file input opens the **native photo picker** (multi-select, Recents-first); on desktop it's drag-drop / click-to-browse / paste. Voice is fixed to a personal-journal tone.
- **Story assembly (the core value)** — the app chooses which photos to use, orders them into a narrative (beginning → tension/context → payoff), and writes captions that connect them.
- **Fast preview, full-res result** — the app sends a **downscaled copy** of each photo (~1024px long edge, JPEG ~80%, aspect preserved) to the model for a fast response; the returned captions are placed on the **full-resolution originals** the user actually sees. The model reads a small proxy; the story uses the real photos.
- **Hook in the first frame** — strongest visual + text hook up front, so viewers don't tap past.
- **AI text overlay, user-placed** — AI writes each caption; the app drops it in a smart default position (lower third + legibility background) and lets the user drag/resize it. Static emoji count as text.
- **Review & refine** — regenerate, swap/drop a photo, edit or regenerate a caption. Nothing leaves the app.
- **Native, low-production feel.**

**Out of scope (moved to later phases):**
- **Posting / hand-off to Instagram** → Phase 2.
- **Music suggestions** → Phase 2.
- **Connecting an Instagram account, posting cadence, the recurring journal** → Phase 3.

**Out of scope (cut for good — reasons in `approach.md`):**
- Video; music (audio); media editing (filters/contrast); animated GIFs & interaction stickers; automatic posting via the Instagram API.

## User Flow (2 steps)

Value-first: the finished story is the first real output. (≤3-step flows complete ~72% vs ~16% at 7 steps — [source](https://userpilot.com/blog/aha-moment/).)

1. **Express + pick** — The user picks a batch of photos (one tap → native photo picker on mobile; drag-drop on desktop) and adds a line of intent or vibe. This is the custom feel: the user tells the app what they want, it isn't guessed.
2. **Payoff: the story** — The app generates a coherent, ordered, captioned story, then lets the user review & refine in place: regenerate, swap/drop photos, edit or regenerate a caption, and drag/resize the text. **This is the wow moment.** Phase 1 ends here: a finished story on screen.

**Design note:** show a finished example story instead of an empty state on first open.
