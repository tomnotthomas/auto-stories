import { Controller, Get, Req } from '@nestjs/common';
import type { Request } from 'express';
import type { Limits } from '@auto-stories/api-types';
import { FairUseService } from './fair-use.service';

/**
 * GET /api/v1/limits — what this caller has left under the fair-use guardrails
 * (openapi/paths/limits.yaml).
 *
 * Deliberately NOT behind {@link FairUseGuard}: reading how much you have left
 * must never cost some of it, and a client that polls this on every visit to
 * the picker would otherwise lock itself out (decision 7.36).
 */
@Controller('limits')
export class LimitsController {
  constructor(private readonly fairUse: FairUseService) {}

  @Get()
  limits(@Req() request: Request): Limits {
    // Same IP resolution as the guard, so what we report is what we enforce.
    return this.fairUse.limitsFor(request.ip ?? 'unknown');
  }
}
