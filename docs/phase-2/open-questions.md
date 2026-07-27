# Open Questions — Phase 2: Get it onto Instagram

1. ~~**Do we put music in the stories?**~~ **Resolved:** music-as-audio is out of scope (Instagram-licensed, needs video + licensing). Instead the app generates **music suggestions** (mood/genre/search terms) so the user adds it easily in Instagram.

2. ~~**Does one Gemini call handle 30 images well, or do we need a pipeline?**~~ **Resolved: one call.** `gemini-flash-latest` accepts up to 3,600 images per request for image input (Google docs, checked 2026-07-27), so 30 is well within limits; the only binding constraint is the 50mb request body, which 30 downscaled proxies fit ([decisions 6.4](../decisions.md#64-photo-proxy-size-at-30-photos--no-change-needed)). The describe-then-decide pipeline is **dropped** ([decisions 6.5](../decisions.md#65-stories-up-to-30-photos-stay-a-single-call--pipeline-dropped)); it's the recorded fallback only if the single-call eval later shows quality degrading at 20–30 photos.
