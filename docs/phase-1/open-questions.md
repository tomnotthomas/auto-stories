# Open Questions — Phase 1: Create the Story

1. **How do we put the story in the right order?** The hard part — turning a pile of photos into a well-sequenced story. What signals decide the order (time, content, arc)?
2. **How does the AI get enough context for good captions?** A good caption references what actually happened, but the AI only sees pixels + a one-line intent. What extra context do we give it (more questions, EXIF time/place, etc.) so captions feel true, not generic?
3. **What hooks the user on first open?** What moment in creating the first story makes a first-time user want to stay and come back?
4. **Should we show a quick demo video on first open?** A short clip showing how fast a story is made, to hook the user before they do anything.
5. ~~**Where does the text go on the frame?**~~ **Resolved:** no AI/vision placement. AI writes the caption, app drops it in a smart default (lower third + legibility background), user drags/resizes on the final preview.
6. ~~**How much do we compress the images sent to the model?**~~ **Resolved:** downscale each photo to ~1024px long edge, JPEG ~80%, aspect preserved; send that proxy to the model, keep full-res originals on device for display and posting. 1024px is enough for the model to get the gist and keeps the upload fast; below ~512px faces and in-photo text blur and captions get less accurate.
