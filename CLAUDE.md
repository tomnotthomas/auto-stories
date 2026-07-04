# CLAUDE.md

Guidance for working in this repo. Keep this file under 200 lines.

## Project
Auto Stories — a mobile app (React Native, iOS + Android) that turns a pile of photos into a well-ordered, well-captioned Instagram Story. This is a take-home project. The valuable/hard part is the AI that assembles the story; Instagram posting is done by hand-off, not via API.

## Docs — what each file is for
- **`docs/phase-1/spec.md`** — *What* we build, **Phase 1: Create the Story** (the hard core: pick + intent → generate → refine). The product spec, not the reasoning.
- **`docs/phase-2/spec.md`** — Phase 2: get the story onto Instagram (hand-off posting, music suggestions).
- **`docs/phase-3/spec.md`** — Phase 3: the recurring journal (cadence, auto-surface photos).
- Each `docs/phase-N/` folder holds all docs for that phase (spec now; design/eng plans later).
- **`docs/approach.md`** — *How I decided.* A decision log, one entry per problem faced, structured **Problem → Options → Decision → Why**. This reflects the user's way of thinking. It must NOT duplicate spec content.
- **`docs/phase-N/open-questions.md`** — Open questions and resolutions, scoped to that phase (so you only face the questions relevant to what you're building now).

## Writing rules for these docs
- **Concise and plain.** Short bullets. A reader should get each line immediately. No filler, no marketing tone.
- **Objective only.** Never write subjective justifications ("feels wrong", "no wow", "kills the first impression", "this is good/bad"). State the concrete reason.
- **If reasoning is subjective or unclear, ASK the user to explain — then write the concrete reason they give.** Do not invent a justification.
- **No duplication between spec and approach.** Spec = what; approach = why.
- **approach.md is auto-maintained:** whenever the user shares a decision or reasoning while we work, append it to `docs/approach.md` in the Problem→Options→Decision→Why structure, without being asked.

## Key product decisions (see docs/approach.md for full reasoning)
- 3-step, payoff-first flow (not 6 steps): 3-step onboarding completes ~72% vs ~16% at 7 steps.
- User picks photos + states intent (no fully automatic generation).
- No auto-posting via Instagram API (needs business account + Meta app review). Post by hand-off: build frames → save to camera roll → user multi-selects in Instagram.
- AI writes captions; user drags/resizes text placement.
- Music, GIFs, interaction stickers are out; the app only suggests music search terms.

## Git conventions
- **Conventional Commits only.** Every commit message uses the `type: summary` form (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`, etc.).
- **Small, reviewable commits.** Each commit is one logical change a reviewer can read in a sitting. Never batch unrelated changes.
- **Reviewable PRs.** Keep pull requests small enough to review properly; split large work into multiple PRs rather than one big one.

## Open items
Tracked per phase in `docs/phase-N/open-questions.md`. The two that most affect building now (both Phase 1): how the story is ordered, and how the AI gets enough context for good captions.
