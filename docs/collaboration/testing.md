# Testing

TDD is mandatory. The rules that bind on every change are summarised in `CLAUDE.md`; this file is the full version.

## The loop

1. Write the failing test first.
2. Write the code that makes it pass.
3. Refactor with the test green.

Two rules hold without exception:

- **All tests pass before a task is finished.** A task is not "done" while any test is red.
- **Never delete or skip a test to make things pass.** Fix the code. If an expectation is genuinely wrong, correct the test and say so in the PR — don't remove coverage to get a green run.

## Running tests

```bash
npm test                              # every workspace (api: Jest, web: Vitest)
npm run test -w @auto-stories/api     # backend only
npm run test:cov -w @auto-stories/api # backend with coverage
npm run test -w web                   # frontend only
```

## Frontend (`apps/web`)

**Test behaviour, not looks.** Assert what the component *does* — interactions, state, emitted outputs, rendered content. Never assert styling: colours, spacing, or class names.

**Drive components through Angular Material / CDK component harnesses**, not raw DOM queries. Harnesses are simple to write, read, and maintain, and they survive DOM and markup changes.

Reuse Material's built-in harnesses — `MatButtonHarness`, `MatInputHarness`, and friends — rather than re-deriving them.

### Writing a component's own harness

When a component needs its own `ComponentHarness`, keep it clean:

- One harness per component.
- Locators are named `static with()` / getter methods that express intent: `getSubmitButton()`, not a raw selector scattered through the tests.
- **No assertions inside the harness.** The harness exposes state; the test asserts on it.

### Environment

`apps/web` needs Node ≥22.22.3 (see `.nvmrc`; run `nvm use`). The runner is Vitest, not Jest.

## Backend (`apps/api`)

- Co-locate `*.spec.ts` next to the unit under test.
- Build the module under test with `@nestjs/testing`'s `Test.createTestingModule`.
- Coverage floor: **≥85%**.
