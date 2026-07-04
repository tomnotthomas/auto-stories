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
// app next to the compiled server, so a single Node process serves both the API
// and the web app. Mount the static host only when that build is present, which
// keeps API-only local dev (`npm run start:dev`) untouched.
const webRoot = process.env.WEB_ROOT ?? join(__dirname, '..', 'client');
const serveStatic = existsSync(webRoot)
  ? [
      ServeStaticModule.forRoot({
        rootPath: webRoot,
        // Nest owns the backend routes; everything else falls back to the SPA's
        // index.html so client-side routing works on a hard refresh.
        exclude: ['/api/{*splat}', '/healthz'],
      }),
    ]
  : [];

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
