import type { ErrorCode } from '@auto-stories/api-types';
import { ApiErrors, ApiException, DEFAULT_MESSAGE } from './api-exception';

describe('ApiException', () => {
  it('uses the default message for a code when none is given', () => {
    const ex = new ApiException('empty_result');
    expect(ex.message).toBe(DEFAULT_MESSAGE.empty_result);
    expect(ex.code).toBe('empty_result');
  });

  it('prefers an explicit message over the default', () => {
    const ex = new ApiException('empty_result', 'nothing usable');
    expect(ex.message).toBe('nothing usable');
  });

  it.each<[keyof typeof ApiErrors, ErrorCode, number]>([
    ['invalidRequest', 'invalid_request', 400],
    ['payloadTooLarge', 'payload_too_large', 413],
    ['emptyResult', 'empty_result', 422],
    ['rateLimited', 'rate_limited', 429],
    ['quotaExhausted', 'quota_exhausted', 503],
    ['upstreamError', 'upstream_error', 503],
    ['timeout', 'timeout', 504],
  ])('%s → code %s, status %d', (factory, code, status) => {
    const ex = ApiErrors[factory]();
    expect(ex.code).toBe(code);
    expect(ex.getStatus()).toBe(status);
    expect(ex.message).toBe(DEFAULT_MESSAGE[code]);
  });
});
