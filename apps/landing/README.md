# Auto Stories — motion landing page

A self-contained, scroll-driven landing page. The scroll *is* the story: a pile of
real photos assembles in 3D into a phone that plays the four real product screens
(pick → generating → payoff → refine), then resolves into the CTA. Golden Hour
palette, Roboto, pure CSS 3D + a rAF scroll engine, `prefers-reduced-motion` fallback.

## Build
`page.html` is the authored source (markup + CSS + JS with asset markers).
`build.py` inlines the font, photos, and the Pretext text engine to produce two
zero-network-dependency outputs:

    python3 build.py     # -> index.html  (standalone doc, open directly / serve via NestJS)
                         # -> artifact.html (body-only, for claude.ai Artifacts)

Inlined assets live in `assets/roboto-inline.css` and `assets/photos.css` (committed,
so the build needs no network). Regenerate photos with `sips` / the font via the
Google Fonts API — see the earlier steps if the sources change.

## Preview
    python3 -m http.server 8731 --bind 127.0.0.1
    open http://127.0.0.1:8731/index.html
