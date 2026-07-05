import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { json } from 'express';

/** ~1MB proxies × 30 photos, base64-inflated, with headroom. */
const DEFAULT_JSON_LIMIT = '50mb';

export interface AppSetupOptions {
  /** Max JSON body before a 413 (e.g. '20mb'). */
  jsonLimit?: string;
}

/**
 * Applies the runtime configuration shared by production bootstrap (main.ts)
 * and the e2e tests, so the two never drift. The global exception filter is
 * registered as an APP_FILTER provider in AppModule (DI-friendly), not here.
 *
 * The app must be created with `{ bodyParser: false }` so the JSON parser
 * registered here (with our size cap) is the only one.
 */
export function configureApp(
  app: NestExpressApplication,
  options: AppSetupOptions = {},
): void {
  // Behind Render's proxy, trust the first hop so req.ip is the real client
  // address the per-IP fair-use limit (FairUseGuard) keys on.
  app.set('trust proxy', 1);

  // Every endpoint is versioned under /api/v1, except the bare /healthz probe.
  app.setGlobalPrefix('api', { exclude: ['healthz'] });
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  // The server is the authority: strip unknown fields, reject them outright,
  // and coerce payloads into their DTO types.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Cap the request body: an oversized upload is rejected with 413 before we
  // touch it (spec 4.2), instead of the express default 100kb. The app is
  // created with `{ bodyParser: false }`, so this is the only JSON parser.
  app.use(json({ limit: options.jsonLimit ?? DEFAULT_JSON_LIMIT }));
}
