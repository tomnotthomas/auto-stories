# OpenAPI — the frontend/backend contract

`openapi.yaml` is the **source of truth** for the Auto Stories API. The backend
(NestJS) conforms to it; the frontend (Angular) generates a typed client from
it. Building the contract first lets both sides be developed in parallel and
gives a new developer a one-page map of every route.

Spec version: **OpenAPI 3.1**. Reasoning: `../docs/approach.md` (3.14); shapes
mirror `../docs/phase-1/architecture.md`.

## Layout

The spec is **modular** so it stays navigable as routes are added — open the one
file you're changing, not a 5,000-line monolith. `redocly bundle` flattens it
into a single file when a tool needs one.

```
openapi/
  openapi.yaml              # root — metadata + $refs to each path
  paths/                    # one file per route
    generate.yaml
    healthz.yaml
  components/
    schemas/                # one file per schema (Photo, Frame, …)
    responses/              # reusable error responses (BadRequest, RateLimited, …)
```

Add a route → new file in `paths/` + a `$ref` from `openapi.yaml`. Reuse an
error response by `$ref`-ing the file in `components/responses/`.

The generated TypeScript types live in the shared workspace package
`packages/api-types` (imported by both apps) — see its README.

## Routes

| Method | Path | What |
|--------|------|------|
| `POST` | `/api/v1/generate` | Photos + story line → ordered, captioned story. |
| `GET`  | `/healthz` | Liveness probe (no model call). |

## Versioning

URI-path versioning (approach 3.12) — the version is in the path, matching
NestJS's `VersioningType.URI`.

- **`/api/v1/…`** is the API **major** version. It only changes on a *breaking*
  change; a `v2` then ships alongside `v1` so old clients keep working.
- **`info.version`** (currently `1.0.0`) is the spec document's own semver —
  bump it on every change (minor for additive fields, etc.). It is not the URL
  version.
- **`/healthz` is intentionally unversioned** — it's an ops/liveness endpoint,
  not part of the product contract. That's why the version stays in each path
  rather than being hoisted into `servers[].url` (which would force `/healthz`
  under `/api/v1` too).

Adding v2 later: add `paths/*.v2.yaml` referenced at `/api/v2/…`; once versions
diverge, split into a second document tracked as `auto-stories@v2` in
`redocly.yaml`.

## Scripts (run from repo root)

```bash
npm run openapi:lint      # validate the spec (Redocly)
npm run openapi:preview   # render the reference docs UI (Scalar)
npm run openapi:mock      # run a mock server from the examples (Prism)
npm run openapi:types     # regenerate packages/api-types/src/generated.ts
npm run openapi:bundle    # flatten $refs into openapi.bundled.yaml
```

## Develop against the mock before the backend exists

`npm run openapi:mock` starts a Prism server that serves the `examples` in this
spec, so the frontend can build against the real contract while the NestJS
backend is still being written:

```bash
npm run openapi:mock         # → http://127.0.0.1:4010
curl -s http://127.0.0.1:4010/healthz
# {"status":"ok"}
```

Prism validates requests against the schema and returns the matching example,
so a contract mismatch surfaces immediately.

## Shared types

`generated/types.ts` is generated from the spec and **committed** so both apps
import one source. Regenerate it (`npm run openapi:types`) whenever `openapi.yaml`
changes — CI should fail if the committed file drifts from the spec. Do not edit
it by hand.
