import type { ExecutionContext } from '@nestjs/common';
import { FairUseGuard } from './fair-use.guard';
import { FairUseService } from './fair-use.service';

/** Minimal ExecutionContext exposing a request with the given ip. */
function contextForIp(ip?: string): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ ip }) }),
  } as unknown as ExecutionContext;
}

describe('FairUseGuard', () => {
  let enforceIp: jest.Mock;
  let guard: FairUseGuard;

  beforeEach(() => {
    enforceIp = jest.fn();
    guard = new FairUseGuard({ enforceIp } as unknown as FairUseService);
  });

  it('enforces the request IP and allows it through', () => {
    expect(guard.canActivate(contextForIp('9.9.9.9'))).toBe(true);
    expect(enforceIp).toHaveBeenCalledWith('9.9.9.9');
  });

  it('falls back to a shared bucket when the IP is absent', () => {
    guard.canActivate(contextForIp(undefined));
    expect(enforceIp).toHaveBeenCalledWith('unknown');
  });

  it('propagates the rate_limited error the service throws', () => {
    const boom = new Error('rate_limited');
    enforceIp.mockImplementation(() => {
      throw boom;
    });
    expect(() => guard.canActivate(contextForIp('9.9.9.9'))).toThrow(boom);
  });
});
