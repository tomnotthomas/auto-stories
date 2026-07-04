import {
  INestApplication,
  ValidationPipe,
  VersioningType,
} from '@nestjs/common';

/**
 * Applies the runtime configuration shared by production bootstrap (main.ts)
 * and the e2e tests, so the two never drift. The global exception filter is
 * registered as an APP_FILTER provider in AppModule (DI-friendly), not here.
 */
export function configureApp(app: INestApplication): void {
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
}
