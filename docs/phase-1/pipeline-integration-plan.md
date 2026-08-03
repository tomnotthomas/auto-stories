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

## A. Swipe the actions away, and never move the composition

**Reported:** folding the action bar slides a bottom-anchored headline down by
~144px. The frame must not recompose because chrome came and went. And the
gesture should be a **swipe**, not a button.

**The layout, for the record** (I got this wrong first time and proposed
restructuring the frame around it):

```html
<img class="absolute inset-0 h-full w-full object-cover">   <!-- full-bleed photo -->
<div class="absolute inset-x-4 bottom-6 z-20 …">            <!-- actions: pure overlay -->
```

There is no bar *area*. The photo fills the screen and the three actions float on
top of it over the existing bottom gradient. Nothing sits behind them and nothing
is reserved for them in the page layout.

**So the movement has one cause and one fix.** `safeBottomPx` was made to depend
on whether the actions are shown. It must not. The offset the composition hangs
at is **constant** — it keeps the type clear of where the actions *can* appear —
and dismissing them changes nothing but the overlay's presence.

There is a separate, pre-existing fidelity gap worth noting but NOT fixing here:
the preview is a full-bleed `object-cover` crop of a ~1:2.16 screen while the
export is 9:16, so the two crop the photograph differently. That is its own
problem, it is not what was reported, and restructuring the frame to solve it
would cost the full-bleed look deliberately chosen for the story view.

### The gesture
- **Swipe down** on the action cluster to dismiss it.
- **Swipe up** from the bottom edge to bring it back — the same place it left
  from, which is what makes it findable without a permanent control on the photo.
- A first-run hint, once, like the existing paging hint: the return gesture is
  the one thing a user cannot discover by accident.
- Keep the tap zones off the bottom strip while the actions are hidden, so a
  swipe-up is not swallowed by paging.

This replaces the labelled toggle built in the first pass. The toggle was chosen
to guarantee a visible way back, which was sound reasoning, but it costs ~48px of
permanent chrome on the photo — and a photo-first view is the whole point of
being able to dismiss the actions at all.
