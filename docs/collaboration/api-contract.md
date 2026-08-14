# The API contract — contract-first, always

**Anything that changes data between the frontend and the backend starts here.** Write the shape in `openapi/` first, generate the types, then build both sides against them. Never define a shape in a controller or a component and back-fill the spec afterwards.

`openapi/` is the source of truth. It belongs to neither app and sits at the repo root.

Reasoning: `docs/decisions.md` §3.14 (contract-first), §3.15 (shared types package), §3.16 (kubb generator).

## The order of work

1. **Edit the spec.** One file per path in `openapi/paths/`, one per schema in `openapi/components/schemas/`, reusable errors in `openapi/components/responses/`. Open the one file you're changing, not a monolith.
2. **Lint it.** `npm run openapi:lint`
3. **Generate the types.** `npm run openapi:types` — kubb writes `packages/api-types/src/gen/`.
4. **Commit the regenerated output.** `src/gen/` is checked in. CI regenerates and fails the build if your commit is out of sync.
5. **Now build both sides**, importing from `@auto-stories/api-types`.

## Rules

- **`packages/api-types/src/gen/` is do-not-edit.** It is generated. `src/index.ts` re-exports it as the stable public surface — that's the only hand-written file in the package.
- **Both apps import `@auto-stories/api-types`.** Never reach into a relative path inside `packages/` or redeclare a request/response shape locally. A contract change should break compilation on both sides — that's the point.
- **Contract, backend, and web land in the same PR.** Otherwise the deployed contract half-migrates. If the change is large, it is still one PR for the contract plus both sides, not three.
- **Every route is versioned in the path** (`/api/v1/…`), kept as full paths so `/healthz` can stay unversioned. See `docs/collaboration/nestjs-coding.md`.
- **Two version numbers, on purpose.** The URL major (`v1`) bumps only on a breaking change; `info.version` (semver) bumps on every spec change.

## Why the frontend doesn't have to wait

With the contract written first, the web app develops against the Prism mock (`npm run openapi:mock`) while the backend is still being written. That parallelism is the reason the spec comes first, and it's why generating OpenAPI from NestJS decorators was rejected — that needs the backend to exist.

## Tooling

| Command | Does |
|---|---|
| `npm run openapi:lint` | Redocly lint |
| `npm run openapi:types` | kubb → `packages/api-types/src/gen/` |
| `npm run openapi:bundle` | flatten to a single file when a tool needs one |
| `npm run openapi:mock` | Prism mock server from the spec's examples |
| `npm run openapi:preview` | Scalar rendered reference |

## What CI enforces

The `contract` job runs on any change to `openapi/**` or `packages/api-types/**`. It lints the spec, regenerates the types, and **fails if `git status` is dirty** — meaning you didn't commit the regenerated output. It then typechecks the generated package.
