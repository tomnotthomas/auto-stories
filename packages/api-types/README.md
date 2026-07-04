# @auto-stories/api-types

Shared TypeScript types for the Auto Stories API, generated from the OpenAPI
contract (`../../openapi/openapi.yaml`) and imported by **both** apps.

## Why

One source of truth. When the contract changes, regenerating updates these types,
and any mismatch breaks compilation in both the frontend and backend — the error
shows up at build time, not in production.

## Usage

```ts
import type { GenerateRequest, GenerateResponse, ErrorCode } from "@auto-stories/api-types";

async function generate(body: GenerateRequest): Promise<GenerateResponse> { /* … */ }
```

Both apps depend on it through the workspace, so there is nothing to publish:

```jsonc
// apps/web/package.json and apps/api/package.json
"dependencies": { "@auto-stories/api-types": "*" }
```

## Files

- `src/generated.ts` — **auto-generated** from the spec (`npm run openapi:types`
  at the repo root). Do not edit.
- `src/index.ts` — hand-written stable surface: flat aliases (`GenerateRequest`,
  `Frame`, …) plus the raw `components` / `operations` / `paths` for advanced use
  (e.g. a typed fetch client via `openapi-fetch`).

Regenerate whenever `openapi.yaml` changes; CI should fail if `generated.ts`
drifts from the spec.
