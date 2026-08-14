# Git conventions

The rules that bind on every change are summarised in `CLAUDE.md`. This file is the full version.

## Conventional Commits only

Every commit message is `type(scope): summary`. The scope is optional; use it when the change is confined to one app or doc area.

| Type | Use for |
|---|---|
| `feat` | new behaviour a user can observe |
| `fix` | a defect in existing behaviour |
| `perf` | same behaviour, less work |
| `refactor` | same behaviour, different structure |
| `docs` | specs, decisions, plans, this file |
| `test` | tests only |
| `chore` | tooling, deps, config |

Scopes in use: `web`, `api`, `phase-1`, `phase-2`, `phase-3`, `decisions`.

Real examples from this repo:

```
feat(web): record each picked photo's own aspect
fix(web): print each photo in a box of its own shape
perf(web): the loop writes only what actually changed
docs(decisions): 7.42 per-photo print shape and lane sizes
docs(phase-2): draw the worker that pulls from the queue
```

Write the summary as what the change does, in lower case, no trailing period.

## Small, reviewable commits

- One logical change per commit — something a reviewer can read in a sitting.
- Never batch unrelated changes. A refactor and a bug fix are two commits.
- A commit that only exists to fix the previous commit should be squashed into it before pushing.

## Reviewable PRs

- Keep a PR small enough to review properly. Split large work into a stack of PRs rather than one big one.
- Each PR is one coherent slice with a title in the same Conventional Commit form.
- Merged branches are not reused. Start the next slice from a fresh branch off `origin/main`.

## PR description

**60 words maximum.** Plain language a reviewer understands on the first read.

Say what this PR changes. Nothing else:

- No "Why" essays — reasoning goes in `docs/decisions.md`.
- No benchmark tables, measurements, or screenshots.
- No "Verified" or test-result sections — CI reports that.
- No walking through the diff file by file.

If it doesn't fit in 60 words, the PR is probably too big. Split it.

The word count covers the prose. A `Fixes #123` line and the generated-with trailer don't count.

### Example

PR #132 shipped a 352-word body. The same PR in 47 words:

> Redraws the Phase 2 diagram to show the worker that pulls jobs off the queue, and the `202 { jobId }` returning as its own arrow. Fixes prose naming a function that doesn't exist and a job state that was wrong. Adds decision 6.6. Docs only.

## Branch naming

`type/kebab-name`, using the same type vocabulary as commits:

```
feat/legal-pages
fix/generating-photo-aspect
docs/frame-harmony-plan
```

Worktrees are created with generated names like `worktree-agent-a3fb85c…`. Rename the branch to the `type/kebab-name` form before pushing.

## Authority

Opening a PR is the end of the job. Merging to `main` is the maintainer's call — never self-merge.
