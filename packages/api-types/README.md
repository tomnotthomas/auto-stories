# @auto-stories/api-types

Shared TypeScript types for the Auto Stories API, generated from the OpenAPI
contract (`../../openapi/openapi.yaml`) by [kubb](https://kubb.dev) and imported
by **both** apps.

## Why

One source of truth. Regenerating updates these types, and any mismatch breaks
compilation in both the frontend and backend — at build time, not in production.

## Usage

```ts
import type { GenerateRequest, GenerateResponse, ErrorCode } from "@auto-stories/api-types";
```

Both apps depend on it through the workspace — nothing to publish:

```jsonc
"dependencies": { "@auto-stories/api-types": "*" }
```

## Files

- `src/gen/` — **auto-generated** real types, one file per schema
  (`npm run openapi:types` at the repo root). Do not edit.
- `src/index.ts` — stable public surface; re-exports `src/gen`. The one place to
  change if the generator is ever swapped (fallback: `openapi-generator`, see
  approach 3.16).

Regenerate whenever `openapi.yaml` changes; CI fails if `src/gen` drifts.
