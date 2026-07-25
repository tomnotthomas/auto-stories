# CLAUDE.md

Guidance for working in this repo. Keep this file under 200 lines.

## Project
Auto Stories — a responsive web app (Angular frontend + NestJS backend, deployable in a container) that turns a pile of photos into a well-ordered, well-captioned Instagram Story. The valuable/hard part is the AI that assembles the story; Instagram posting is done by hand-off, not via API.

## Docs — what each file is for
- **`docs/phase-1/spec.md`** — *What* we build, **Phase 1: Create the Story** (the hard core: pick + intent → generate → refine). The product spec, not the reasoning.
- **`docs/phase-2/spec.md`** — Phase 2: get the story onto Instagram (hand-off posting, music suggestions).
- **`docs/phase-3/spec.md`** — Phase 3: the recurring journal (cadence, auto-surface photos).
- Each `docs/phase-N/` folder holds all docs for that phase (spec now; design/eng plans later).
- **`docs/decisions.md`** — *How I decided.* A decision log, one entry per problem faced, structured **Problem → Options → Decision → Why**. This reflects the user's way of thinking. It must NOT duplicate spec content. (**`docs/APPROACH.md`** is the separate reviewer-facing summary.)
- **`docs/phase-N/open-questions.md`** — Open questions and resolutions, scoped to that phase (so you only face the questions relevant to what you're building now).

## Writing rules for these docs
- **Concise and plain.** Short bullets. A reader should get each line immediately. No filler, no marketing tone.
- **Objective only.** Never write subjective justifications ("feels wrong", "no wow", "kills the first impression", "this is good/bad"). State the concrete reason.
- **If reasoning is subjective or unclear, ASK the user to explain — then write the concrete reason they give.** Do not invent a justification.
- **No duplication between spec and approach.** Spec = what; approach = why.
- **decisions.md is auto-maintained:** whenever the user shares a decision or reasoning while we work, append it to `docs/decisions.md` in the Problem→Options→Decision→Why structure, without being asked.

## Key product decisions (see docs/decisions.md for full reasoning)
- 3-step, payoff-first flow (not 6 steps): 3-step onboarding completes ~72% vs ~16% at 7 steps.
- User picks photos + states intent (no fully automatic generation).
- No auto-posting via Instagram API (needs business account + Meta app review). Post by hand-off: build frames → download / Web Share to phone → user multi-selects in Instagram.
- Upload is one tap: on mobile the file input opens the OS native photo picker (multi-select, Recents-first); on desktop, click-to-browse. Web can't auto-scan the library, so every phase brings the user to this same picker.
- AI writes captions; user drags/resizes text placement.
- Music, GIFs, interaction stickers are out; the app only suggests music search terms.
- API uses NestJS URI-path versioning as standard — every endpoint is versioned in the path (`/api/v1/…`).

## Git conventions
- **Conventional Commits only.** Every commit message uses the `type: summary` form (`feat:`, `fix:`, `docs:`, `refactor:`, `chore:`, `test:`, etc.).
- **Small, reviewable commits.** Each commit is one logical change a reviewer can read in a sitting. Never batch unrelated changes.
- **Reviewable PRs.** Keep pull requests small enough to review properly; split large work into multiple PRs rather than one big one.

## Coding conventions
Follow each framework's own current guidance so the app stays idiomatic and a new dev onboards fast.

**Scaffold with the CLIs.** Prefer `ng generate` (Angular) and `nest generate` (NestJS) to create components, services, modules, etc. — standardized, conventional structure with less hand-written code.

**Angular (v22+)** — official rules: `angular.dev/assets/context/best-practices.md`.
- Standalone components — do NOT set `standalone: true` or `OnPush`; both are defaults.
- Signals for state, `computed()` for derived; never `mutate` (use `set`/`update`).
- `input()`/`output()` functions, not decorators; `inject()`, not constructor injection.
- Native control flow (`@if`/`@for`/`@switch`), not `*ngIf`/`*ngFor`/`*ngSwitch`.
- Host bindings in the `host` object (not `@HostBinding`/`@HostListener`); `class` bindings, not `ngClass`/`ngStyle`.
- Signal Forms for new forms; small single-responsibility components; strict TS, no `any`; must pass AXE / WCAG-AA.

**Styling — Tailwind only.** Style with **Tailwind** utility classes and **standard Angular Material** components — nothing else.
- **No component CSS files.** Do not add `.css`/`.scss` files or set `styleUrls`/`styleUrl` on a component.
- **No inline CSS.** No `styles`/`styles: []` in `@Component`, and no `style="…"` attributes in templates.
- **No custom components.** Use Material components as shipped; don't hand-roll or restyle bespoke variants. Tailwind classes on the markup cover layout/spacing; Material covers the controls.

## Testing — TDD (mandatory)
Every change is test-driven: write the failing test first, then the code that makes it pass.
- **All tests must pass before a task is finished.** A task is not "done" while any test is red.
- **Never delete or skip a test to make things pass.** Fix the code (or, if the expectation is genuinely wrong, correct the test and say so) — don't remove coverage to get a green run.
- **Frontend — test behavior, not looks.** Assert component *functionality* (interactions, state, emitted outputs, rendered content), never styling (colors, spacing, classes). Drive components through **Angular Material / CDK component harnesses** — chosen because they're simple to write, maintain, and read, and they survive DOM/markup changes — instead of querying the DOM directly.
- **Clean harnesses.** When a component needs its own `ComponentHarness`, keep it clean: one harness per component, locators as named `static with()`/getter methods that express intent (`getSubmitButton()`, not raw selectors scattered in tests), no assertions inside the harness (it exposes state; tests assert). Reuse Material's built-in harnesses (`MatButtonHarness`, `MatInputHarness`, …) rather than re-deriving them.
- **Backend** — co-located `*.spec.ts` with `@nestjs/testing`'s `Test.createTestingModule` (see below).

**NestJS (v11)** — no official LLM file; follow `docs.nestjs.com`.
- One responsibility per module/provider; singletons via DI (`providedIn`-style).
- Validate input with DTOs + `class-validator` and a global `ValidationPipe`.
- Config via `@nestjs/config`; error handling via exception filters; version routes in the path (`/api/v1`, see Key decisions).
- Co-locate `*.spec.ts`; test with `@nestjs/testing`'s `Test.createTestingModule`.

## Open items
Tracked per phase in `docs/phase-N/open-questions.md`. The two that most affect building now (both Phase 1): how the story is ordered, and how the AI gets enough context for good captions.
