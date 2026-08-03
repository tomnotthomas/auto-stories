# Slice 2 — the pipeline, integration plan

Implements the frame-level pipeline from decision 7.25. Slice 1 made the
composition the only thing drawn on a photo; this makes the *stickers* obey it
too, so the layers stop colliding.

## What is broken today

| Symptom | Cause |
| --- | --- |
| The location lands mid-frame, on the subject | `ZONE_TO_SPOT` maps every `bottom-*` zone to `yPct: 56` — the vertical middle. It never looks at the photo. |
| It sits on top of the Look's own type | Sparks are placed with no knowledge of where the composition went. |
| The same place renders twice | Magazine draws the location in its byline **and** the location spark still draws. |
| You cannot move a sticker in refine | `sparks` renders only when `!refining()`. |
| Stickers pile up on a busy frame | Nothing decides there is no room. |

## The shape

```
read the picture   →  a free-space GRID, not three bands
  └─▶ lay the design   →  the Look claims its box, subtracting from the grid
        └─▶ set the text  →  (already inside the design, slice 1)
              └─▶ place the stickers  →  best free cell each, in confidence order,
                                          dropped when nothing is free enough
```

### 1. The free-space map replaces the band score

`quiet-zone.ts` scores three horizontal bands. That is enough to decide "hang the
masthead off the top instead of the bottom", and useless for placing a small tag
in two dimensions.

Add a **grid** alongside it (the band API stays — every Look uses it):

```ts
/** Busyness per cell of a COLS×ROWS grid over the frame, 0 (flat) … 1 (noisy). */
export interface FreeSpace {
  readonly cols: number;   // 4
  readonly rows: number;   // 8
  /** Row-major, length cols*rows. */
  readonly busy: readonly number[];
  /** Cells an earlier stage has claimed. Row-major, same length. */
  readonly taken: readonly boolean[];
}

export function scoreGrid(rgba: Uint8ClampedArray, size: number): FreeSpace;
export function claim(space: FreeSpace, box: Box): FreeSpace;      // pure, returns a new map
export function bestCell(space: FreeSpace, limit: number): Cell | null;
```

4×8 is chosen deliberately: a sticker is roughly an eighth of the frame tall, and
finer cells would place tags at a precision the eye cannot verify while making
the scoring noisy.

### 2. The design claims its box

The crux: **the composition does not know its own pixel height** — that depends on
text measurement, which happens in each renderer. Two ways out:

- **(a) The Look estimates its box.** It knows its own type sizes, its column and
  its part list; lines can be estimated from headline length against a
  characters-per-line figure at that size. Pure, deterministic, no measurement.
- **(b) Measure first, then place.** Accurate, but needs a measuring context,
  makes `composeFrame` impure or async, and gives the two surfaces a chance to
  disagree.

**Take (a).** A sticker only needs to *avoid* the design, not butt against it, so
a conservative over-estimate is the right error. (b) would trade the purity the
whole engine rests on for precision nothing needs.

```ts
export interface Box { readonly xPct: number; readonly yPct: number; readonly wPct: number; readonly hPct: number }

/** Added to Composition: what the design occupies, so later stages can avoid it. */
readonly claimed: readonly Box[];
```

A helper in `look.ts` builds it from the parts, so no Look hand-writes geometry
twice and they cannot drift from what they actually draw.

### 3. Stickers are placed from what is left — but stay out of the export

Sparks are metadata: they preview what the user will add in Instagram, and
**nothing about them is baked into the PNG** (7.10, 7.23). So they must NOT become
`Part`s of the composition — that would draw them into the export.

Instead the composition carries the map onward:

```ts
/** What the design left free, for the stickers to be placed into. */
readonly free: FreeSpace;
/** The design drew the location itself, so no location sticker should. */
readonly consumedLocation: boolean;
```

`sparks.ts` then places each suggestion into `bestCell`, in **confidence order**,
claiming as it goes, and **drops** any that has no cell under the busyness limit.
`ZONE_TO_SPOT` and `SPARK_FALLBACK_ZONE` are deleted.

### 4. Contract

`Suggestion.position` comes out. The model no longer chooses placement for
anything — the last place it still did.

### 5. Refine

Sparks render in refine too, and a sticker can be dragged. The existing
`SparkState.xPct/yPct` already stores a dragged spot and already survives a
regenerate; it is only the render condition and a drag handler that are missing.

## Order of work

1. `quiet-zone.ts` — grid, `claim`, `bestCell`. Pure, heavily unit-tested. No behaviour change yet.
2. `look.ts` — `claimed` + `free` + `consumedLocation` on `Composition`, with the shared box estimator. Every Look gets it for free.
3. `sparks.ts` — place from the map, honour `consumedLocation`, drop what does not fit.
4. Contract — drop `Suggestion.position`; update the prompt and the server normalizer.
5. Refine — render sparks, allow the drag.

1 and 2 are additive and can land before 3–5 touch behaviour.

## What could go wrong
- **The estimate is badly wrong for one Look** and its stickers overlap the type. Mitigation: the estimator lives in `look.ts` and is tested against every registered Look — a test asserting the claimed box contains the parts' own geometry catches a Look that lies about itself.
- **Everything gets dropped on a busy photo.** A frame with no stickers is fine and by design, but silently dropping all of them looks like a bug. The limit wants tuning against real photos, and dropping should be visible in the hand-off card rather than nowhere.
- **Grid scoring costs another decode.** It should share the one `createImageBitmap` `computeReadable` already does, not add a second.

---

# Follow-ups from the live review

## A. Folding must not move the composition

**Reported:** folding the action bar slides a bottom-anchored headline down by
~144px. The frame should not recompose because chrome came and went.

**Cause:** the preview reserves space for the bar (`safeBottomPx`) and anchors
the composition above it, so the reservation changing moves the type.

**The tempting fix is wrong.** Holding the reservation constant stops the
movement but bakes in a worse lie: the composition would sit ~208px off the
bottom in the preview while the export puts it at 8% — about 68px at preview
scale. The type would never be shown where it actually lands.

**The real cause is that the preview is not the export's shape.** The frame is
full-bleed on a ~390×844 screen (about 1:2.16); the export is 9:16. `safeBottomPx`
is a patch over that mismatch, not a feature.

### Options

| | What it does | Cost |
| --- | --- | --- |
| **1. Constant reservation** | Reserve the unfolded height always; only the buttons come and go | One line. Nothing moves. But the preview keeps showing the type ~140px higher than the export does — it hides the bug rather than fixing it |
| **2. True 9:16 preview frame** | Render the frame at the export's real aspect ratio, sized to fit above the bar, and keep that box **fixed** whether the bar is shown or not. Folding reveals background around the frame; the frame never resizes | Removes `safeBottomPx` entirely, makes preview == export exact, and nothing can move. Costs full-bleed: there are bands above/below on a tall phone |
| **3. Scale the frame on fold** | Grow the frame into the freed space | Rejected — this moves the composition *more*, which is the complaint |

**Recommendation: 2.** It is the only one where the type is drawn where it will
actually be exported, and "nothing moves" then follows for free rather than being
enforced. The lost full-bleed is real, but a phone is taller than 9:16 anyway, so
the frame is already being cropped — option 2 makes that visible instead of
hiding it behind a crop the user cannot see.

Take 1 only if full-bleed is judged more important than preview fidelity; it is a
one-line change and is trivially reversible.

## B. Resolve the exact venue for places you can buy something

**Wanted:** for a restaurant, café, bar, shop, shopping centre, casino — anywhere
with a transaction — the app should name the *actual* venue rather than the model
guessing a plausible place name.

**Two stages, deliberately separate:**
1. The **vision pass** only decides "there is a buyable venue here, and it looks
   like a `restaurant` / `cafe` / `bar` / `shop`". It does not guess the name.
2. A **separate lookup** resolves the real venue from the photo's EXIF GPS plus
   that category — nearby POIs by coordinate, nearest first.

A landmark or a famous building needs no lookup: the model already knows it. The
lookup is for the long tail of ordinary commercial places, which is exactly where
a guess is worthless and a real name is worth copying into Instagram.

**Out of scope: events.** A concert needs a date as well as a place, which is a
different kind of lookup against a different kind of source.

### It hangs on EXIF GPS
No coordinate, no lookup. EXIF is routinely absent — iOS can strip location on
share, screenshots and re-encodes lose it, some browsers strip on file pick. So
the ladder is: **EXIF present → resolve the real venue; absent → the model's
guess, as today.** Degrading, not failing.

### Location sharing is opt-in
Reading a photo's coordinates and sending them to a third party is a different
privacy posture from anything the app does now — today nothing about *where* the
user was leaves our stack. So it is a choice the user makes, not a default:

- A short, plain notice at the point it pays off, offering the trade in the
  user's terms: share the photos' location and get the **real names** of the
  places, ready to copy into Instagram; decline and everything else works exactly
  as it does now.
- One decision per story, remembered, reversible.
- Say plainly what leaves the device: the coordinates, not the photo.
- Declining must cost nothing except the venue names — no nagging, no degraded
  story.

### API constraint
Free, or a very high free threshold. That is the deciding factor, ahead of data
quality. Under research; every free-tier figure must be confirmed from the
provider's own page, since these numbers go stale and get repeated wrongly.
