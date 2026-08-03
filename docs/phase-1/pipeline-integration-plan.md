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

## B. Resolve the exact venue for places you can buy something

**Wanted:** for a restaurant, café, bar, shop, shopping centre, casino — anywhere
with a transaction — name the *actual* venue instead of the model guessing a
plausible one. Two deliberately separate stages: the vision pass only decides
"there is a buyable venue here"; a **separate lookup** finds the real name.

A landmark needs no lookup — the model already knows the Eiffel Tower. This is
for the long tail of ordinary cafés and shops, which is exactly where a guess is
worthless and a real name is worth copying into Instagram.

**Out of scope: events.** A concert is a place *and a date*, which is a different
lookup against a different kind of source.

### The original design does not work, and here is the evidence

The plan was: read the photo's EXIF GPS, query venues within ~100 m. **EXIF GPS
does not survive a mobile web upload**, on either platform, by design:

- **iOS** — WebKit bug 257534, *"Uploading photos on iOS strips Exif GPS location
  data"*, resolved **CONFIGURATION CHANGED**: stripping since iOS 16.4 is
  intentional. From iOS 17 the photo picker offers the user a per-upload location
  toggle, which we can neither trigger nor detect.
- **Android** — scoped storage hides location by default; unredacted EXIF needs
  `ACCESS_MEDIA_LOCATION` + `setRequireOriginal()`, which a web page cannot do.

Non-GPS EXIF (timestamps, camera settings) does survive; location specifically
does not. Since this product is built around the mobile photo picker, a
coordinate-first design would work only on desktop uploads.

### First: where does the name actually come from?

Worth being blunt, because the answer bounds the whole feature. A photo of five
croissants and a coffee on a table **cannot be resolved to a place**. It could be
any of a million cafés. No amount of lookup fixes that — there is nothing to look
up.

The name has to be legible somewhere. Three cases:

| Evidence | Resolvable? |
| --- | --- |
| A name **visible in the photo** — shopfront, signage, cup logo, menu, napkin, receipt | **Yes.** The vision model reads it; the lookup confirms it exists |
| The **user's own story line names it** — "croissants at Blé Sucré" | **Yes**, and this is the strongest and cheapest signal |
| Neither — food on a table, a generic interior | **No. Emit nothing.** |

So the feature is narrower than "every commercial photo gets its venue". It fires
on shopfronts, signage, branded cups, menus, and anything the user says — and
stays silent on the generic food shot, which is probably most café photos.

That silence is the point. Today the model is asked for a place name with no
evidence and no way to decline, so it produces a plausible invention and the app
shows it as fact. A lookup makes "never invent a place" **enforceable** instead of
merely requested: no match, no suggestion.

### What replaces it: resolve the model's reading, not its coordinates

The model already emits a `query` — the exact text to search in Instagram —
and today **nothing checks it**, so a plausible invention ships as fact.

1. **Vision pass** flags a buyable venue and produces its best reading of what and
   where (it has the photo and the user's own story line, which often names the
   place or the neighbourhood).
2. **Lookup** resolves that against a real places database. Keep the canonical
   name only when something actually matches; otherwise drop the suggestion
   rather than pass a guess off as a place.

This keeps both stages and the whole point — *a name that exists* — without
depending on data the platform will not give us.

**Optional accuracy boost:** if the user opts into `navigator.geolocation`, bias
the search to their area. That is a real improvement for a story made at or near
the place, and it degrades to an unbiased text search otherwise. Enrichment, not
a dependency.

### The API — Overpass, with Photon as the shape-matched alternative

Confirmed from each provider's own documentation:

| Provider | Free tier | Card | Key | Caching |
| --- | --- | --- | --- | --- |
| **Overpass (OSM)** | **10,000 queries/day** | no | **none** | allowed (ODbL) |
| **Photon (OSM)** | "reasonable limit", no number published | no | **none** | allowed (ODbL) |
| Geoapify | 3,000 credits/day, 5 req/s | no | yes | attribution required |
| Google Places | 5,000/month | **required** | yes | **banned** except place ID |
| Foursquare | 500/month (its own pages disagree) | unconfirmed | yes | — |
| Mapbox | 50,000/month | unconfirmed | yes | **temporary use only** |

**Overpass**, verified live and keyless, returns named venues with the full tag
set (`amenity`, `cuisine`, `shop`, `brand`, `opening_hours`) and handles
buildings-as-ways, so a shopping centre or casino resolves where point-only
providers miss it.

Three reasons beyond the quota:
- **No caching ban.** ODbL lets the venue name be stored in a saved story. Google
  forbids storing anything but the place ID; Mapbox forbids it outright — which
  disqualifies both for a product that persists stories.
- **Free and paid are the same code.** Outgrow the public instance and you
  self-host Overpass or Photon (Apache-2.0). No migration, no vendor.
- **Richest signal for the handshake** — the model's category hint can be matched
  against real OSM tags rather than an opaque provider taxonomy.

Practical: descriptive `User-Agent` (both block anonymous traffic), retry to the
other service on 429, cache on rounded coordinates + category, and show
`© OpenStreetMap contributors` once in the credits.

### Location sharing is opt-in
Whatever the source, asking for the user's position is a different privacy
posture from anything the app does today — nothing about *where* they were
currently leaves our stack.

- Offer the trade in their terms: share location and get the **real names** of
  places, ready to copy into Instagram; decline and everything else is unchanged.
- One decision per story, remembered, reversible.
- Say plainly that coordinates leave the device, not the photo.
- Declining costs only the names. No nagging, no worse story.
- Round coordinates to ~4 decimals (≈11 m — ample for a venue query) and never
  log them next to a user id.

### Unconfirmed, and worth testing before committing
- The iOS 17+ picker's location toggle **default state**. Needs a real device.
- Android Chrome's specific `<input type=file>` behaviour — platform redaction is
  confirmed, Chrome's handling is not.
- Photon has no published rate limit at all.
- What share of OSM venues carry a `name` tag. OSM has ~1.6M `amenity=restaurant`
  objects; an indicative third-party sample found OSM had **fewer** venues than a
  commercial set but a **higher** hit rate on the ones it had (72% vs 60%
  confirmed to exist). Coverage is dense in urban Europe, patchier elsewhere.
