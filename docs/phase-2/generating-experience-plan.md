# Auto Stories — Phase 2 · The generating experience

The 20–40s wait becomes the app's introduction to what it does: the user's own photos on a light
table, the model's choices caught and written on as they land, the kept pile becoming the story.
Reverses [decision 3.7](../decisions.md#37-latency-ux); the reasoning is
[7.29](../decisions.md#729-the-wait-shows-the-work-and-the-user-can-pull-a-photo-out-of-it-reverses-37).

Code: `apps/web/src/app/features/generating/` — `lane-engine.ts` (state + geometry, no DOM),
`frame-type.ts` (a frame's words, set), `generating.ts` (rendering, gesture, sequencing).

## What is on screen

- **The lane.** Prints drift up through the middle, overlapping and scattered, with depth from
  scale, blur and opacity. Four stay in flight; the loop tops them up itself, never the sequencer
  (the sequencer is blocked while a print is being read).
- **The seen pile.** A print that reaches the top is tossed onto a dim greyscale pile at the top
  edge. Tally: "N looked at".
- **The kept pile.** Prints stack fanned at the bottom, newest in front. Tally: "N kept · N yours".
- **The catch.** When the story lands, the lane eases to a stop, the rest of the table blurs and
  recedes, and the model's first choice comes forward and is written on.
- **The ending.** The kept prints flatten into the story's own progress bars while the first frame
  opens full-bleed. The loading screen becomes the story screen.

## The gesture

Grab any drifting print (pointer events, pointer capture, one print at a time, `touch-action: none`).
The lane drops to `vTarget 0.2` and the table softens (`focusTarget 0.45`); the print lifts to
`scale 0.425` and tilts `clamp(dx × 0.05, ±11°)`.

| Release                                           | Result                                    |
| ------------------------------------------------- | ----------------------------------------- |
| below `H − 262`, **or** flick down > `0.11 px/ms` | kept as the user's pick (white dot badge) |
| above `laneTop + 96`, **or** flick up             | passed onto the seen pile                 |
| anywhere between                                  | springs back to the lane, 220ms           |

Past either pile the drag damps at `0.4×` rather than hitting a wall, and the pile it would drop
into lights up while armed. `navigator.vibrate?.(8)` on a keep. `0.11 px/ms` is the flick threshold
the rest of the app already uses ([7.28](../decisions.md#728-swipe-the-actions-away-and-never-move-the-composition)).

Picks are recorded on `StoryService.userPicks`. After the story lands, a pick the model did not use
is appended through the existing add-a-photo path (`GenerationService.captionNewPhotos(ids)`).

## The type — four separated beats, none overlapping

The one moment in the app that earns the time. ~2.4s for a typical headline.

| Beat                              | Value                                                                   |
| --------------------------------- | ----------------------------------------------------------------------- |
| stillness after the print settles | 240ms of nothing                                                        |
| scrim (the paper)                 | 380ms, opacity 460ms `--ease-out`                                       |
| hairline rule draws itself        | `scaleX 0→1`, origin left, 520ms `--ease-move`, then 240ms              |
| small-caps kicker tracks in       | `.40em → .19em` over 900ms; 420ms (560ms when it is the agreement line) |
| words land                        | 78ms apart, each out of `blur(10px)` + `translateY(.18em) scale(1.04)`  |
| the line tightens under them      | `letter-spacing .06em → -.03em` over 1100ms                             |
| between lines / dwell             | 300ms / 1150ms                                                          |

Headline: 34px / 1.06 leading, in the story's own display face. Split into at most two lines, at the
point where the two halves come out closest in length.

**No clip-path wipe.** A wipe is one uniform gesture over the whole line; it reads as a shape moving
over text rather than text being set ([7.29](../decisions.md#729-the-wait-shows-the-work-and-the-user-can-pull-a-photo-out-of-it-reverses-37)).

**The kicker never invents a reason.** It is the model's own `Frame.kicker` when it wrote one;
otherwise the frame's place in the story ("opens the story" / "next beat" / "closes it"); and
"you called it" when the model chose a photo the user had already pulled down. A `silent` frame is
left silent — no rule, no kicker, no words.

## Motion values

```
--ease-out:  cubic-bezier(0.23, 1, 0.32, 1)   enter / exit
--ease-move: cubic-bezier(0.32, 0.72, 0, 1)   travel
```

Exit is always faster than enter. Everything below is expressed against a 390×844 surface and scales
with the measured one (`geometryFor(w, h)`).

|                           |                                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| drift                     | `215 px/s`, decaying `1 / (1 + elapsed / 19000)`                                                                              |
| lane speed / rack focus   | one eased value each; slowing τ=105ms, speeding up τ=190ms                                                                    |
| depth                     | `scale 0.365 × (1 − 0.24t) × (1 − 0.07·focus)`, `blur 5.5t² + 12·focus`, `opacity (1 − 1.05t^1.8)(1 − 0.86·focus)` where `t = | y − focal | / range` |
| sway                      | `sin(y × 0.0062 + phase) × 15px`                                                                                              |
| scales                    | drift `0.365`, grabbed `0.425`, held `0.94`, laid `0.235`, seen `0.112`                                                       |
| lane stops before a catch | `vTarget 0` then 300ms — it eases, never cuts                                                                                 |
| print comes forward       | 760ms `--ease-move`, overshooting to `×1.022` at 74%                                                                          |
| toss onto the seen pile   | 520ms (400ms when flicked), rotation overshoots `×1.5` at 62%                                                                 |
| kept pile refan           | 600ms `--ease-move`                                                                                                           |
| a landing nudges the pile | 2.5–3px, 420ms, 14ms stagger                                                                                                  |
| segment bars              | 640ms `--ease-move`, 40ms stagger; first frame opens over 700ms                                                               |

## Escape hatches and quiet states

- A tap that catches no print, during a hold, runs the rest of that beat 4× faster.
- The invitation ("drag a photo down to keep it") appears once at 2.4s, and only if the user has not
  already touched a print.
- When the photo pool is spent and the model is still working, the screen goes quiet with
  "still looking…" rather than dealing photos the user has already seen.
- Reduced motion keeps the gesture and the reveal and drops only the movement — no drift, no depth
  blur, no travel; opacity fades at 240–300ms.

## Rendering

- Discrete state (which beat, which pile, the tallies) is Angular signals and bindings.
- Continuous state (transform, opacity, filter, ~60×/s) is written straight to the print elements
  from the loop, so a frame of motion is not a change-detection pass.
- The overshoots are Web Animations keyframes. A finished `fill: forwards` animation keeps owning
  the properties it animated, so every move cancels what was on the element first.

## Scope boundary (slice 1)

One round trip: `GenerationService.requestStory()` hands the result back and the screen holds it
until the reveal is over, then `applyOutcome()` lands it. No `generateContentStream`, no new
endpoints, no contract change.

Because every frame arrives at once, only the **first** choice is read out in full; the rest land on
the kept pile with their words already set. Reading all six out would tell the whole story before the
user is let into it, and would add ~25s to a wait we are trying to make worth sitting through.

## Next

- **Stream the frames.** With `generateContentStream` each choice arrives as the model makes it, so
  every frame gets its own catch spread across the real wait — which is what the beat structure was
  designed for.
- **Send the user's picks up with the request** instead of appending them afterwards, once a pick
  made during generation can still reach the call.
- **Reveal the frame's real composition.** The catch sets the words in the generating screen's own
  type; the story screen then re-sets them under the story's Look. Rendering the composition itself
  during the catch would remove the last seam in the hand-over.
