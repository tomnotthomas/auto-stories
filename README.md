# Auto Stories

Turn a pile of photos into a well-ordered, well-captioned Instagram Story. Pick photos, write one line about the day, and one AI call returns which photos to use, their order, and a caption for each — a strong first draft you then refine.

- **Live:** https://auto-stories.onrender.com/ (free tier — the first hit after idle cold-starts for ~30–50s)
- **Reviewer summary:** [`docs/APPROACH.md`](docs/APPROACH.md) — what/why, decisions, tradeoffs, what breaks first.
- **Take-home prompt:** [`docs/CHALLENGE.md`](docs/CHALLENGE.md) — the original challenge this repo answers (Option 2).

## Run it (one command)

```bash
cp .env.example .env      # then set GOOGLE_CLOUD_API_KEY (the only key this app needs)
docker compose up --build
# open http://localhost:3000
```

One container serves everything: the NestJS API under `/api` (+ `/healthz`), the marketing landing page at `/`, and the Angular product flow at `/app`.

## Local development

```bash
npm ci          # install all workspaces from the lockfile
npm run dev      # starts the API (:3000) and the web app (:4200) together
# open http://localhost:4200
```

`npm run dev` runs both dev servers with live reload. The web dev server proxies `/api` → `http://localhost:3000` (see `apps/web/proxy.conf.json`), so the frontend talks to the real backend. The story engine needs `GOOGLE_CLOUD_API_KEY` in `.env` to generate; everything else runs without it.

Requires **Node ≥22.22.3** (the Angular CLI floor — see `.nvmrc`). Run `nvm use` if you use nvm; `npm` warns if your version is too old.

## Common commands

Run from the repo root; each fans out to the workspaces that define the script.

| Command | What it does |
|---|---|
| `npm run dev` | API + web dev servers, live reload |
| `npm test` | All unit tests (backend Jest, frontend Vitest) |
| `npm run lint` | Lint the backend and frontend |
| `npm run typecheck` | Type-check every workspace |
| `npm run build` | Production build of the API and web app |
| `npm run openapi:lint` | Lint the OpenAPI contract |
| `npm run openapi:types` | Regenerate shared API types from the contract |

Per-app scripts still work with the workspace flag, e.g. `npm run test:cov -w @auto-stories/api`.

## Project layout

```
apps/
  api/          NestJS backend — the AI that assembles and captions the story
  web/          Angular product flow (pick → generate → refine)
  landing/      self-contained marketing landing page served at /
packages/
  api-types/    TypeScript types generated from the OpenAPI contract, shared by both apps
openapi/        the API contract (source of truth for api-types)
docs/           specs, architecture, diagrams, and the decision log
design/         mockups and theme
```

The frontend and backend share one contract: types in `packages/api-types` are generated from `openapi/` and imported by both, so the two apps can't drift.

## Docs

- [`docs/decisions.md`](docs/decisions.md) — decision log (Problem → Options → Decision → Why).
- [`docs/phase-1/spec.md`](docs/phase-1/spec.md) — what Phase 1 builds (the built slice); [architecture](docs/phase-1/architecture.md) + diagrams alongside it.
- [`docs/phase-2/spec.md`](docs/phase-2/spec.md), [`docs/phase-3/spec.md`](docs/phase-3/spec.md) — the specced-but-unbuilt roadmap.

## Deployment

Deployed as a single container to Render (see [`render.yaml`](render.yaml)). The same image is built by [`Dockerfile`](Dockerfile) and smoke-tested in CI on every change.
