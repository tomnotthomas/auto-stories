# OpenAPI — the frontend/backend contract

`openapi.yaml` is the **source of truth** for the Auto Stories API. The backend
(NestJS) conforms to it; the frontend (Angular) generates a typed client from
it. Building the contract first lets both sides be developed in parallel and
gives a new developer a one-page map of every route.

Spec version: **OpenAPI 3.1**. Reasoning: `../docs/approach.md`; shapes mirror
`../docs/phase-1/architecture.md`.

## Routes

| Method | Path | What |
|--------|------|------|
| `POST` | `/api/v1/generate` | Photos + story line → ordered, captioned story. |
| `GET`  | `/healthz` | Liveness probe (no model call). |

## Scripts (run from repo root)

```bash
npm run openapi:lint      # validate the spec (Redocly)
npm run openapi:preview   # render the reference docs UI (Scalar)
npm run openapi:mock      # run a mock server from the examples (Prism)
npm run openapi:types     # regenerate openapi/generated/types.ts
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
