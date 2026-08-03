# The Looks — catalogue

Six was not enough range, and only one was built, so every story wore the same
corporate masthead (7.27). This is the full set: **thirty-two distinct design
languages**, grouped by how loudly they speak. The model picks one per story and
holds it; the client composes deterministically (7.24).

## The palette everything is built from
Bundled faces only — nothing new is downloaded:

| Token | Family | Weights |
| --- | --- | --- |
| `FRAUNCES` | Fraunces (serif) | 400, 700 |
| `BRICOLAGE` | Bricolage Grotesque (display sans, variable) | 400–800 |
| `SHANTELL` | Shantell Sans (hand) | 400, 700 |
| `SYSTEM` | system-ui sans | 300, 400, 600 |
| `MONO` | ui-monospace | 400, 700 |

Twenty Looks from five families means **the difference has to come from
composition** — scale, case, tracking, placement, marks, panels, borders,
rotation, photo treatment — not from buying more typefaces. That is the correct
constraint: a design system with five voices and twenty sentences.

Geometry is authored in the mockups' container-query units throughout: `…WPct`
is a percentage of frame WIDTH, `…HPct` of frame HEIGHT.

---

## A. Restrained — the photo dominates (5)

| id | Character | Type | Composition | Accent / marks |
| --- | --- | --- | --- | --- |
| `quiet-editorial` | The photo does the talking | Fraunces 400 | Letter-spaced kicker over one modest line, lower-left, right inset 12cqw so it never runs full width | none |
| `minimal` | Apple-Memories calm | SYSTEM 300 | Top-left, huge negative space, 9cqw hairline rule, spaced uppercase place | none |
| `gallery-label` | A museum wall label | Fraunces 400 small | A small off-white **panel** bottom-left; title and place set inside it, tiny | none; the panel is the graphic |
| `corner-note` | Almost nothing | MONO 400, very small | One line, top-right, nothing else on the frame | none |
| `footer-rule` | A caption under a plate | SYSTEM 400 small caps | One hairline across the full width low down, text centred beneath it | rule only |

## B. Editorial — structured and designed (4)

| id | Character | Type | Composition | Accent / marks |
| --- | --- | --- | --- | --- |
| `magazine-masthead` | National-Geographic spread | Bricolage kicker + Fraunces 700 headline | Accent tab, hairline, big headline, byline row | accent tab + accent underline on the emphasis |
| `broadsheet` | Front page | Fraunces 700, centred | Small-caps kicker, **double rule** above and below the headline | rules only |
| `contents-page` | A magazine index | Big Bricolage numeral + Fraunces line | Oversized accent frame-numeral left, text set against it | numeral in accent |
| `pull-quote` | A quoted line | Fraunces 700, centred, large | Oversized quote glyphs above and below | glyphs in accent |

## C. Loud — graphic and shouting (4)

| id | Character | Type | Composition | Accent / marks |
| --- | --- | --- | --- | --- |
| `bold-poster` | Hype | Bricolage 800 caps, 15cqw | Oversized, edge-to-edge, low | **accent block** behind one word; outlined pill for place |
| `split-block` | Album cover | Bricolage 700 | A solid **accent panel** across the bottom third, text reversed out of it | the panel is the accent |
| `ticker` | Breaking news | Bricolage 700 caps, tracked | A full-width accent **bar** with the words inside it | the bar |
| `stencil-caps` | Screen-printed | Bricolage 800 caps, **outlined** (stroked, no fill) | Huge, centred | stroke in accent |

## D. Warm — nostalgic keepsake (4)

| id | Character | Type | Composition | Accent / marks | Photo |
| --- | --- | --- | --- | --- | --- |
| `film-postcard` | 35mm keepsake | Fraunces 400 centred low | Thin print **border**, rotated date **stamp** in the corner | stamp in warm amber | warm wash |
| `polaroid` | Instant print | Shantell 400 | A thick white **margin** across the bottom; the words are written *in* the margin, not on the photo | none | slight lift |
| `super-8` | Home movie | MONO 400 small | Rounded inner **border**, timecode top-left | none | sepia + vignette |
| `faded-album` | An old album page | Fraunces 400 centred | Cream overlay, dotted rule under the line | none | faded |

## E. Personal — made by hand (3)

| id | Character | Type | Composition | Accent / marks |
| --- | --- | --- | --- | --- |
| `scrapbook` | A journal page | Shantell 700, whole stack **tilted** | Taped location tag | **hand-drawn underline** on the emphasis |
| `marker` | Highlighted by hand | Shantell 700 | Words sitting on a **highlighter** swipe | highlighter block in accent |
| `sticker-sheet` | Instagram stickers | Bricolage 700 | Each line in its own rounded filled **chip**, stacked and slightly offset | chips in accent |

## F. Cinematic — quiet, placement does the work (5)

| id | Character | Type | Composition |
| --- | --- | --- | --- |
| `typewriter` | A field note | mono, small, tight | Low and left, a short rule above the line |
| `title-card` | A film title card | Bricolage 400 caps, wide tracking | Centred **mid-frame**, a hairline above and below |
| `subtitle` | Film subtitles | system sans, small | Centred at the very bottom, no furniture at all |
| `edge-caps` | A spine, a footer | Bricolage 600 caps, tiny, very wide tracking | One line running the full width along the bottom edge |
| `letterbox` | Cinema | Fraunces 400, centred | A dark opaque **panel** across the bottom, type centred inside |

## G. Graphic bands and cards (6)

| id | Character | Type | Composition |
| --- | --- | --- | --- |
| `duotone-band` | A translucent colour band | Bricolage 700 | A semi-transparent accent **panel**, words reversed out |
| `chapter` | A chapter opener | Bricolage kicker + Fraunces | A short accent rule, generous space |
| `dateline` | A wire-service dateline | mono caps + Fraunces | ALL-CAPS dateline, headline running on beneath |
| `caption-card` | A neat caption box | system sans | A small `paper` **panel** bottom-centre, dark ink |
| `zine` | Photocopied punk | Bricolage 800 caps | Tilted, raw, **accent-block** on the emphasis |
| `index-card` | A recipe card | Shantell 400 | A `paper` **panel** with a hairline through it, dark ink |
| `postcard-back` | The back of a postcard | Shantell + mono | A hand line plus a rotated **stamp** tag |

(`zine`, `index-card` and `postcard-back` are built with the handmade group; they
are listed here because that is where they sit in the range.)

---

## What the composition model must gain

The current model has text parts, rules, rows, a scrim and an anchor. These
Looks need more. Every addition below is used by at least two Looks — nothing is
built for a single case.

| Capability | Needed by |
| --- | --- |
| `PanelPart` — a filled block behind or around text | gallery-label, split-block, ticker, polaroid, faded-album |
| `TagPart` — a small label: pill, tape, stamp or chip | bold-poster, scrapbook, film-postcard, super-8, sticker-sheet |
| `rotationDeg` on the composition, and on a part | scrapbook, film-postcard, sticker-sheet |
| `Mark: accent-block` | bold-poster |
| `Mark: hand-underline` (a rough stroke, not a bar) | scrapbook |
| `Mark: highlighter` | marker |
| `textStroke` — outlined type | stencil-caps |
| `border` — an inset frame on the photo | film-postcard, super-8 |
| `photoTreatment` — a CSS/canvas filter for the image | film-postcard, super-8, faded-album, polaroid |
| Rules with their own width and count (double rule) | broadsheet, footer-rule, minimal |

## Rules that hold across all twenty
- **Every Look composes silently** — no words means no furniture, no scrim (7.26).
- **Every Look keeps its type inside the frame** and off the busiest band it can avoid (7.24).
- **Colour stays a device decision** (7.10): a part declares `ink` or `accent`, never a literal.
- **At most one mark per frame.** The mockups piled up three; the engine varies to about one (7.23).
- **Both surfaces or neither.** A capability that the canvas export cannot draw does not ship, or the preview and the PNG drift.
