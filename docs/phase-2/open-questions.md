# Open Questions — Phase 2: Get it onto Instagram

1. ~~**Do we put music in the stories?**~~ **Resolved:** music-as-audio is out of scope (Instagram-licensed, needs video + licensing). Instead the app generates **music suggestions** (mood/genre/search terms) so the user adds it easily in Instagram.

2. ~~**Does one Gemini call handle 30 images well, or do we need a pipeline?**~~ **Resolved:** a **describe-then-decide pipeline** ([decisions 6.5](../decisions.md#65-stories-over-10-photos-run-a-describe-then-decide-pipeline)). `ceil(N/10)` describe-and-rate calls (≤10 images each), then one text "decide" call that ranks all N on one bar, selects 5–7, orders (EXIF soft hint), and captions from the descriptions; N ≤ 10 stays the Phase 1 single call. **Still open (sub-point):** if captions written from the descriptions read thin, add a caption pass that re-sends the 5–7 finalists' images.
