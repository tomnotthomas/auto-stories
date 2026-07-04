import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './common/all-exceptions.filter';
import { HealthController } from './health/health.controller';

@Module({
  imports: [
    // Secrets (GOOGLE_CLOUD_API_KEY, MODEL, …) live in the repo-root .env; the
    // API process runs from apps/api, so reach up two levels. Real env vars
    // (Render) still win.
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env', '.env'],
    }),
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
