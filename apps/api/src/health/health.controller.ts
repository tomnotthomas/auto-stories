import { Controller, Get, VERSION_NEUTRAL } from '@nestjs/common';
import type { HealthResponse } from '@auto-stories/api-types';

/**
 * Liveness probe for the host (Render). Lives at a bare `/healthz` — outside
 * the `/api` prefix and unversioned (VERSION_NEUTRAL) — and does not call the
 * model. See openapi/paths/healthz.yaml.
 */
@Controller({ path: 'healthz', version: VERSION_NEUTRAL })
export class HealthController {
  @Get()
  check(): HealthResponse {
    return { status: 'ok' };
  }
}
