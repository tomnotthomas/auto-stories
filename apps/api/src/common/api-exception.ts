import { HttpException, HttpStatus } from '@nestjs/common';
import type { ErrorCode } from '@auto-stories/api-types';

/**
 * HTTP status carried by each machine-readable outcome. Mirrors the status
 * codes the OpenAPI contract pairs with every ErrorCode (see openapi/paths).
 */
const STATUS_BY_CODE: Record<ErrorCode, HttpStatus> = {
  invalid_request: HttpStatus.BAD_REQUEST, // 400
  payload_too_large: HttpStatus.PAYLOAD_TOO_LARGE, // 413
  empty_result: HttpStatus.UNPROCESSABLE_ENTITY, // 422
  rate_limited: HttpStatus.TOO_MANY_REQUESTS, // 429
  quota_exhausted: HttpStatus.SERVICE_UNAVAILABLE, // 503
  upstream_error: HttpStatus.SERVICE_UNAVAILABLE, // 503
  safety_blocked: HttpStatus.UNPROCESSABLE_ENTITY, // 422
  timeout: HttpStatus.GATEWAY_TIMEOUT, // 504
};

/**
 * Default user-facing copy per outcome, matching the messages in
 * openapi/components/responses/*.yaml. Overridable per-throw.
 */
export const DEFAULT_MESSAGE: Record<ErrorCode, string> = {
  invalid_request:
    "That request wasn't valid — check your photos and try again.",
  payload_too_large: 'That upload was too large — try fewer or smaller photos.',
  empty_result: "Couldn't shape a story — try different photos.",
  rate_limited: "That's your stories for today — everyone gets a turn.",
  quota_exhausted: "Today's free stories are all used up.",
  upstream_error: 'The story engine is unavailable — retry in a moment.',
  safety_blocked: "Couldn't use some photos — try different ones.",
  timeout: 'The story engine took too long — try again.',
};

/**
 * The one exception type the app throws. It binds a stable {@link ErrorCode}
 * to its HTTP status so the global filter can render the ErrorResponse shape
 * without re-deriving either.
 */
export class ApiException extends HttpException {
  constructor(
    readonly code: ErrorCode,
    message?: string,
    /** When the caller may try again, for refusals that pass on their own
     * (decision 7.36). ISO-8601; absent when there is no known recovery time. */
    readonly retryAt?: string,
  ) {
    super(message ?? DEFAULT_MESSAGE[code], STATUS_BY_CODE[code]);
  }
}

/** Factory helpers so call sites read as intent, not construction. */
export const ApiErrors = {
  invalidRequest: (message?: string) =>
    new ApiException('invalid_request', message),
  payloadTooLarge: (message?: string) =>
    new ApiException('payload_too_large', message),
  emptyResult: (message?: string) => new ApiException('empty_result', message),
  rateLimited: (message?: string, retryAt?: string) =>
    new ApiException('rate_limited', message, retryAt),
  quotaExhausted: (message?: string, retryAt?: string) =>
    new ApiException('quota_exhausted', message, retryAt),
  upstreamError: (message?: string) =>
    new ApiException('upstream_error', message),
  timeout: (message?: string) => new ApiException('timeout', message),
};
