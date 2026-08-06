import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { HealthController } from './health/health.controller';
import { StoryModule } from './story/story.module';

// The deployment ships one container: the Dockerfile copies the built Angular
// app and the pre-built landing page next to the compiled server, so a single
// Node process serves everything. Two static hosts sit under the API routes:
//
//   /            -> the marketing landing page (apps/landing/index.html)
//   /app, /app/* -> the built Angular product flow (SPA fallback to its index)
//   /api/*, /healthz -> owned by NestJS
//
// Each host is mounted only when its build is present, which keeps API-only
// local dev (`npm run start:dev`) untouched. The /app host is registered before
// the '/' catch-all so it wins for its own prefix.
const webRoot = process.env.WEB_ROOT ?? join(__dirname, '..', 'client');
const landingRoot =
  process.env.LANDING_ROOT ?? join(__dirname, '..', 'landing');

const serveStatic = [
  ...(existsSync(webRoot)
    ? [
        ServeStaticModule.forRoot({
          rootPath: webRoot,
          // The Angular app lives under /app; unknown paths beneath it fall back
          // to its index.html so client-side routing survives a hard refresh.
          serveRoot: '/app',
          exclude: ['/api/{*splat}', '/healthz'],
        }),
      ]
    : []),
  ...(existsSync(landingRoot)
    ? [
        ServeStaticModule.forRoot({
          rootPath: landingRoot,
          // The landing page owns the site root. Exclude the sibling hosts so
          // this catch-all never swallows the app or the backend routes.
          exclude: ['/api/{*splat}', '/healthz', '/app', '/app/{*splat}'],
          serveStaticOptions: {
            // Try `<path>.html` before falling through. The legal pages are
            // linked as /privacy and /imprint; without this the '/' catch-all
            // answers those with the landing page itself — a 200 carrying the
            // wrong document, which is worse than a 404.
            extensions: ['html'],
          },
        }),
      ]
    : []),
];

@Module({
  imports: [
    // Secrets (GOOGLE_CLOUD_API_KEY, MODEL, …) live in the repo-root .env; the
    // API process runs from apps/api, so reach up two levels. Real env vars
    // (Render) still win.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
    ...serveStatic,
    StoryModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
