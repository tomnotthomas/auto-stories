# Frame harmony — build the frame as a pipeline (live review, 2026-08-03)

Follows the Looks engine P1 (#109). The Look composes well on its own; everything
*else* on the frame does not know the Look exists.

## The problem, plainly
Three things draw on the photo **at the same time**, and none can see the others.

| Layer | Placed by | Looks at the photo? | Sees the other layers? |
| --- | --- | --- | --- |
| The design (the Look) | quiet-zone bands | yes | no |
| The text (caption / `texts`) | `zoneToPlacement(style.position)` | no | no |
| The location + other sparks | `zoneToPlacement(suggestion.position)` | no | no |

`ZONE_TO_PLACEMENT` sends every `bottom-*` zone to `yPct: 56` — the vertical
middle. That is why a location lands mid-frame, on the subject, and on top of the
type. Nothing ever looked at the picture; that table was tuned to clear the
action bar, not to find empty space.

## The fix: a pipeline, at two levels

The pipeline has a **story level that runs once** and a **frame level that runs
per image**. The split is what makes a story look like a set rather than five
unrelated pictures.

```
STORY LEVEL — once, before any image is touched
  1. order the photos into a narrative
  2. write the words for each frame
  3. choose the design language — ONE Look, held across every frame
     (all three are the single model call)

FRAME LEVEL — only after the above is fixed, then all frames at once
  4..7 (below), per image, 3–4 in flight
```

**Nothing at the frame level may change a story-level decision.** The Look is
chosen once and held; a frame never picks its own. That is the guarantee of
consistency, and it is also what makes the frame level safe to parallelise —
every frame is reading the same fixed decisions, so no frame depends on another.

### The frame level
Build the frame in stages. **Each stage sees everything the stages before it put
down**, and hands the next stage an updated map of what is still free.

```
photo (+ the story's fixed words and Look)
  └─▶ 4. read the picture      → where is it busy? where are the subjects?
        └─▶ 5. lay the design  → the story's Look, restrained. Claims its area.
              └─▶ 6. set the text → placed on picture + design, not on the picture alone
                    └─▶ 7. place the stickers → whatever room is genuinely left
```

Stage 4 is **every Instagram element**, not just the location: location, mention,
poll, gif — and music, which is story-level and has no anchor, so it keeps its
fixed home. They are placed in confidence order while room remains, and the ones
that do not fit are dropped.

Two rules make the pipeline work:

- **Each stage subtracts.** A stage takes the free-space map, uses some of it, and
  passes on what remains. A later stage can never overlap an earlier one.
- **A stage may decline.** If there is no honest room left, the location is not
  placed — it is dropped. Nothing is better than a collision.

## Why the order is this order
- The **design** goes first because it is the constant. It is what makes two
  frames in one story look like a set, so it should not be pushed around by a
  place name.
- The **text** goes second because it is the variable part, and it needs to fit
  *inside* the design, not just somewhere on the photo.
- The **stickers** go last because they are the least important thing on the
  frame, and the first thing that should be dropped when room runs out.

## What "restrained" means for the design
The story is not fully told on the image. The type is a caption on a photo, not a
poster, so it should stay small enough not to dominate the picture while still
reading as designed. Concretely: the design claims a modest band, and the words
fit that band; the band does not grow to fit the words.

## The defects this pipeline removes

### 1. View and refine show different words (a correctness bug)
- View renders `frame.composition`, built from **`headline`**.
- Refine renders the legacy caption layer, built from **`caption`**.
- `setCaption()` writes `caption`, so **editing a caption in refine changes nothing in the story**.
- Cause: `story.html` makes the two mutually exclusive.

### 2. The location renders twice
Since P1 a `location` suggestion feeds Magazine's byline row *and* still draws as
an on-frame spark marker.

### 3. The location cannot be moved
Sparks render only when `!refining()`, so refine offers no way to move one.

### 4. The model writes text without knowing how much fits
It chooses `headline`, `caption`, `texts[]`, `style.position` and
`suggestion.position` with no signal about the design, and no length limit. It
also still emits placement, which 7.24 said it never would again.

## Slices

### Slice 1 — one text per frame
- Drop the caption/headline split. `headline` is the frame's words.
- Refine renders the **same** composition as view and edits `headline`.
- Delete `texts` / `TextBlock` and the model's `style` placement fields. Keep `letterbox` (non-9:16 fill), moved onto the frame.

### Slice 2 — the pipeline itself
- Give the composition a **free-space map** it subtracts from, rather than a band score it reads once.
- The design claims its area; the text is fitted into it; the stickers are placed into what is left, by the same quiet-zone logic — never by a fixed zone.
- **All sticker types go through stage 4**, not just the location: location, mention, poll, gif. They keep their on-frame preview (7.23) — they are placed properly, not moved off the photo. Music stays story-level with its fixed home.
- Place them in confidence order while room remains; drop the ones that do not fit. `Suggestion.confidence` already exists for this.
- A location the Look draws itself (Magazine byline, Scrapbook tape tag, Poster pill) is consumed by the design and must **not** also draw as a sticker — that is today's double-location bug.
- Drop `position` from `Suggestion` in the contract; stage 4 decides placement.

### Slice 3 — tell the model how much fits
- The model needs a **length budget**, not layout. Each Look declares one per field (e.g. Magazine kicker ≤ 24 chars, headline ≤ 42; Poster headline ≤ 18).
- The Look is picked in the same call that writes the words, so the budget cannot be tailored to it in that prompt. State all six budgets in the prompt **and** clamp on the client, because the model will still miss.
- Extend the content-aware type fit (5ccf7a8) per Look instead of globally.

### Slice 4 — know a face from a plate of food
- The P1 detector scores three bands by luminance variance + edge density. It moves the masthead off a busy bottom, but it cannot tell a subject from clutter.
- Saliency (Looks plan P4) is what fixes "it goes to the food". Bring it forward if slices 1–3 do not settle it.

### Slice 5 — prepare every frame at once
Once the model has returned, each frame's preparation is independent work. Today
both passes run one frame at a time:

| Where | Today | Should be |
| --- | --- | --- |
| `story.service.ts:315` `computeReadable()` | `for (const frame …)` with `await createImageBitmap` inside — decode + analyse one photo at a time | all frames in flight together |
| `story-exporter.service.ts:26` | `for (let i = 0 …)` with `await renderFrame` — one PNG at a time | same |

- **Only the frame level parallelises.** The story level (order, words, Look) is
  decided once, up front, and every frame reads the same fixed result. Parallelising
  that would let frames disagree about the design language, which is the whole
  thing the Look exists to prevent.
- Run the pipeline per frame concurrently; the stages stay ordered *within* a
  frame, but frames do not wait on each other.
- **Bound the concurrency** (3–4 in flight), do not use a naive `Promise.all`.
  Export builds a 1080×1920 canvas per frame — ten at once is ~80 MB of canvas,
  which mobile Safari will not survive. Decode has the same shape at smaller scale.
- Keep the existing per-frame `try/catch`: one frame failing must not take the
  story down, which is already the behaviour and must survive the change.

## Sequencing
1 → 2 → 3, then 4 only if needed. Slices 1 and 2 both touch the contract, so they
land as one contract change or strictly in that order, so the deployed contract
never half-migrates.

Slice 5 is independent of the rest — it changes how many frames run at once, not
what a frame does — so it can land at any point. Doing it **after** slice 2 is
better: the pipeline is more work per frame, so the parallel win is larger, and
there is no point optimising a layout that is about to be replaced.

## Open question
Is the *design* (rules, accent tab, byline furniture) separate from the *text*
(kicker, headline), or are they one stack? P1 built them as one stack. The
pipeline reads more naturally if the design defines a slot and the words flow
into it — that is the assumption above, and it needs confirming before slice 2.
