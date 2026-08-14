# CLAUDE.md

<!-- Keep this file under 200 lines. Long files reduce adherence.
     Per line, ask: would removing this cause a mistake? If not, cut it.
     Rules and detail belong in the linked documents, not here. -->

## Project
Auto Stories — a responsive web app (Angular frontend + NestJS backend, deployable in a container) that turns a pile of photos into a well-ordered, well-captioned Instagram Story. The valuable/hard part is the AI that assembles the story; Instagram posting is done by hand-off, not via API.

## Key documentation
Read the relevant one before writing code. They are the rules, not summaries of them.

- **[API contract](docs/collaboration/api-contract.md)** — **start here for any change to data between the apps.** Write the shape in `openapi/` first, generate the types, then build both sides.
- **[Building and running](README.md)** — definitive guide for running targets: commands, ports, env, workspaces.
- **[Testing](docs/collaboration/testing.md)** — TDD workflow, how to run each suite, component harness rules. Mandatory.
- **[Angular coding](docs/collaboration/angular-coding.md)** — style guide for `apps/web`: signals, control flow, Tailwind + Material.
- **[NestJS coding](docs/collaboration/nestjs-coding.md)** — style guide for `apps/api`: modules, DTOs, config, errors, versioning.
- **[Commit guidelines](docs/collaboration/git-conventions.md)** — format for commit messages, PR titles, branch names, and PR bodies.

## Context and history
- **[Decisions](docs/decisions.md)** — why things are the way they are, one entry per problem: Problem → Options → Decision → Why.
- **[Approach](docs/APPROACH.md)** — reviewer-facing summary of what and why.
- **[Phase specs](docs/phase-1/spec.md)** — what each phase builds. Phase 1 (pick + intent → generate → refine) is the built slice; phases 2 and 3 are specced, not built. Architecture and eng plans sit beside each spec.
- **[Open questions](docs/phase-2/open-questions.md)** — tracked per phase in `docs/phase-N/open-questions.md`, so you only face the ones relevant to what you're building. Phase 1's are closed; phases 2 and 3 are open.

## Writing rules — everything you write
Applies to all of it: code comments, commit messages, PR titles and bodies, docs, and replies in the terminal. One goal — anyone onboarding this codebase should understand it on the first read, without extra effort.

- **Simple language.** Plain words over jargon. Write for someone who has not seen this code before.
- **Short.** Say it in as few words as it takes, then stop. Cut anything that doesn't change what the reader does or knows.
- **Objective.** Never write subjective justifications ("feels wrong", "no wow", "this is good/bad"). State the concrete reason.
- **If the reasoning is subjective or unclear, ASK** — then write the concrete reason given. Do not invent a justification.
- **No duplication.** Say it once, where it belongs. Spec = what; decisions = why.
- **Comments say why, not what.** The code already says what it does. A comment earns its place by explaining a choice that isn't obvious.
- **`docs/decisions.md` is auto-maintained:** whenever the user shares a decision or reasoning while we work, append it in the Problem→Options→Decision→Why structure, without being asked.
