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
