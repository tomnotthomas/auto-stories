# NestJS coding conventions

Applies to `apps/api` (NestJS v11). The rules that bind on every change are summarised in `CLAUDE.md`; this file is the full version.

There is no official LLM context file for NestJS. Follow `docs.nestjs.com` where this file is silent, so the app stays idiomatic and a new dev onboards fast.

## Scaffold with the CLI

Use `nest generate` for modules, controllers, services, guards, and filters. It produces the conventional structure with less hand-written code. (`ng generate` plays the same role in `apps/web`.)

## Modules and providers

- One responsibility per module and per provider.
- Singletons via DI. Inject dependencies; don't construct them inside a service.
- Group by feature, not by layer: `story/`, `job/`, `fair-use/`, `health/`, with shared pieces in `common/`.

## Input validation

- Every request body is a DTO in a `dto/` folder beside its controller, validated with `class-validator`.
- The global `ValidationPipe` is configured once in `app.setup.ts` with `whitelist`, `forbidNonWhitelisted`, and `transform` on — the server is the authority, so unknown fields are stripped and rejected rather than ignored.

## Configuration

- Read config through `@nestjs/config`'s `ConfigService`. Never read `process.env` directly in a service.
- Helpers for parsing and defaulting live in `common/config.util.ts`.

## Errors

- Throw `ApiException` (`common/api-exception.ts`); the global filter in `common/all-exceptions.filter.ts` turns it into the response shape.
- The filter is registered as an `APP_FILTER` provider in `AppModule` so it can use DI — not via `useGlobalFilters` in the bootstrap.

## Routing and versioning

- Every endpoint is versioned in the path: `/api/v1/…`.
- The prefix and URI versioning are set once in `app.setup.ts` (`setGlobalPrefix('api')` + `enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })`). Controllers don't repeat the prefix.
- `/healthz` is the one exception — a bare, unversioned probe.

## Shared runtime setup

`configureApp()` in `app.setup.ts` holds the runtime configuration used by both the production bootstrap and the e2e tests, so the two can't drift. Add global pipes, parsers, and app-level settings there rather than in `main.ts`.

## The API contract

Contract-first: the shape goes in `openapi/` before any controller or DTO is written. See `docs/collaboration/api-contract.md` — it applies to both apps, not just this one.

## Testing

See `docs/collaboration/testing.md` — co-located `*.spec.ts`, `Test.createTestingModule`, ≥85% coverage.
