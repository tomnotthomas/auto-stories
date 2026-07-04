# Golden Hour — color system

The Angular Material **M3 theme** for Auto Stories. Generated from two source colors with Material's own color utilities (the engine behind `ng generate @angular/material:theme-color`), so the app theme and every mockup share one source of truth.

## Source colors
| Role | Hex | Notes |
|------|-----|-------|
| Primary source | #F0603A | coral-amber, ~hue 33° |
| Tertiary source | #B5476B | plum accent |

Secondary, neutral, neutral-variant and error are derived from the primary hue at MD3 TonalSpot chroma. Neutral chroma is low so surfaces read as **warm cream** (light) and **warm near-black** (dark), keeping the user's photos the hero.

> M3 note: the *primary role* is tone 40 (light) / 80 (dark), not the source swatch. The source coral is ~tone 60; it surfaces as containers/accents. This is how Angular Material guarantees AA contrast.

## Tonal palettes
**primary**

`0` #000000 · `10` #3c0800 · `20` #611300 · `25` #741800 · `30` #891e00 · `35` #9d2501 · `40` #ae310e · `50` #d04925 · `60` #f3623c · `70` #ff8b6c · `80` #ffb4a1 · `90` #ffdbd2 · `95` #ffede9 · `98` #fff8f6 · `99` #fffbff · `100` #ffffff

**secondary**

`0` #000000 · `10` #2e140e · `20` #462921 · `25` #53332b · `30` #603f36 · `35` #6d4a41 · `40` #7a564c · `50` #956e64 · `60` #b1877c · `70` #cda196 · `80` #ebbcb0 · `90` #ffdbd2 · `95` #ffede9 · `98` #fff8f6 · `99` #fffbff · `100` #ffffff

**tertiary**

`0` #000000 · `10` #3f001a · `20` #64032e · `25` #741239 · `30` #831f45 · `35` #922c50 · `40` #a2385c · `50` #c15075 · `60` #e1698e · `70` #ff85a8 · `80` #ffb1c4 · `90` #ffd9e1 · `95` #ffecef · `98` #fff8f8 · `99` #fffbff · `100` #ffffff

**neutral**

`0` #000000 · `4` #140c0a · `6` #1a110f · `10` #231917 · `12` #271d1b · `17` #322825 · `20` #392e2b · `22` #3d3230 · `24` #423734 · `25` #443936 · `30` #504441 · `35` #5c504d · `40` #685c58 · `50` #827471 · `60` #9d8d8a · `70` #b8a8a4 · `80` #d4c3bf · `87` #e8d6d2 · `90` #f1dfda · `92` #f7e4e0 · `94` #fceae6 · `95` #ffede9 · `96` #fff1ed · `98` #fff8f6 · `99` #fffbff · `100` #ffffff

**neutral-variant**

`0` #000000 · `4` #180b08 · `6` #1e100c · `10` #271814 · `12` #2b1c18 · `17` #372622 · `20` #3d2c28 · `22` #42312c · `24` #473530 · `25` #493733 · `30` #55423e · `35` #624e49 · `40` #6f5a54 · `50` #89726c · `60` #a48b85 · `70` #bfa69f · `80` #dcc1ba · `87` #f0d4cd · `90` #f9dcd5 · `92` #ffe2db · `94` #ffe9e4 · `95` #ffede9 · `96` #fff1ed · `98` #fff8f6 · `99` #fffbff · `100` #ffffff

**error**

`0` #000000 · `10` #410002 · `20` #690005 · `25` #7e0007 · `30` #93000a · `35` #a80710 · `40` #ba1a1a · `50` #de3730 · `60` #ff5449 · `70` #ff897d · `80` #ffb4ab · `90` #ffdad6 · `95` #ffedea · `98` #fff8f7 · `99` #fffbff · `100` #ffffff

## Light scheme roles
| token | hex |
|-------|-----|
| `primary` | #ae310e |
| `on-primary` | #ffffff |
| `primary-container` | #ffdbd2 |
| `on-primary-container` | #891e00 |
| `secondary` | #7a564c |
| `on-secondary` | #ffffff |
| `secondary-container` | #ffdbd2 |
| `on-secondary-container` | #603f36 |
| `tertiary` | #a2385c |
| `on-tertiary` | #ffffff |
| `tertiary-container` | #ffd9e1 |
| `on-tertiary-container` | #831f45 |
| `error` | #ba1a1a |
| `on-error` | #ffffff |
| `error-container` | #ffdad6 |
| `on-error-container` | #93000a |
| `background` | #fff8f6 |
| `on-background` | #231917 |
| `surface` | #fff8f6 |
| `on-surface` | #231917 |
| `surface-variant` | #f9dcd5 |
| `on-surface-variant` | #55423e |
| `outline` | #89726c |
| `outline-variant` | #dcc1ba |
| `surface-dim` | #e8d6d2 |
| `surface-bright` | #fff8f6 |
| `surface-container-lowest` | #ffffff |
| `surface-container-low` | #fff1ed |
| `surface-container` | #fceae6 |
| `surface-container-high` | #f7e4e0 |
| `surface-container-highest` | #f1dfda |
| `inverse-surface` | #392e2b |
| `inverse-on-surface` | #ffede9 |
| `inverse-primary` | #ffb4a1 |
| `shadow` | #000000 |
| `scrim` | #000000 |

## Dark scheme roles
| token | hex |
|-------|-----|
| `primary` | #ffb4a1 |
| `on-primary` | #611300 |
| `primary-container` | #891e00 |
| `on-primary-container` | #ffdbd2 |
| `secondary` | #ebbcb0 |
| `on-secondary` | #462921 |
| `secondary-container` | #603f36 |
| `on-secondary-container` | #ffdbd2 |
| `tertiary` | #ffb1c4 |
| `on-tertiary` | #64032e |
| `tertiary-container` | #831f45 |
| `on-tertiary-container` | #ffd9e1 |
| `error` | #ffb4ab |
| `on-error` | #690005 |
| `error-container` | #93000a |
| `on-error-container` | #ffdad6 |
| `background` | #1a110f |
| `on-background` | #f1dfda |
| `surface` | #1a110f |
| `on-surface` | #f1dfda |
| `surface-variant` | #55423e |
| `on-surface-variant` | #dcc1ba |
| `outline` | #a48b85 |
| `outline-variant` | #55423e |
| `surface-dim` | #1a110f |
| `surface-bright` | #423734 |
| `surface-container-lowest` | #140c0a |
| `surface-container-low` | #231917 |
| `surface-container` | #271d1b |
| `surface-container-high` | #322825 |
| `surface-container-highest` | #3d3230 |
| `inverse-surface` | #f1dfda |
| `inverse-on-surface` | #392e2b |
| `inverse-primary` | #ae310e |
| `shadow` | #000000 |
| `scrim` | #000000 |
