# Auto Stories — Spec · Phase 2: Get it onto Instagram

Phase 2 takes the finished story from [Phase 1](../phase-1/spec.md) and gets it posted. Built only once Phase 1 produces a story worth posting.

## Goal
Move a finished story from the app onto the user's Instagram Story with the least friction, without needing Instagram API approval.

## Scope

**In scope:**
- **Build the finished frames** — render each frame (photo + placed caption) into a shareable image.
- **Save to camera roll, in order** — write the frames to the phone's photo library so they're ready and nothing is lost.
- **Hand off to Instagram** — open Instagram's native Story composer; the user taps "Select Multiple," picks the frames (up to 10, posted as sequential cards), and shares. Human-in-the-loop by design.
- **Music suggestions** — the app reads the story's vibe and tells the user what to search for in Instagram's music tab (mood, genre, example tracks), so adding music there is effortless. Just generated text.

**Out of scope:**
- **Automatic / direct posting via the Instagram API** — needs a Business account + Facebook Page + Meta App Review; too heavy. Hand-off instead.
- Music (audio), animated GIFs, interaction stickers — the user adds these in Instagram.

## Why hand-off, not API
Publishing programmatically requires a Business/Creator account, a linked Facebook Page, and Meta App Review (weeks). Personal accounts are excluded. The hand-off needs none of that and keeps the user in control of the final post. (Full reasoning in `approach.md`.)
