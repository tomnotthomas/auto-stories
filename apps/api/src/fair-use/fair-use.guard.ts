import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { FairUseService } from './fair-use.service';

/**
 * Counts each request to a guarded route against its source IP's hourly limit
 * (approach 4.1), before the handler runs. A flooding client is turned away
 * with rate_limited (429) prior to any validation or model work.
 */
@Injectable()
export class FairUseGuard implements CanActivate {
  constructor(private readonly fairUse: FairUseService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    // `trust proxy` (app.setup) makes req.ip the real client behind Render's
    // proxy; fall back to a shared bucket if it is somehow absent.
    this.fairUse.enforceIp(request.ip ?? 'unknown');
    return true;
  }
}
