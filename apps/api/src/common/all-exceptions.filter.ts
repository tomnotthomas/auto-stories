import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import type { ErrorCode, ErrorResponse } from '@auto-stories/api-types';
import { ApiException, DEFAULT_MESSAGE } from './api-exception';

/**
 * Framework-thrown HttpExceptions (e.g. the ValidationPipe's 400, express's
 * 413) don't carry an ErrorCode, so map their status onto one.
 */
const CODE_BY_STATUS: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'invalid_request',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'payload_too_large',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'empty_result',
  [HttpStatus.TOO_MANY_REQUESTS]: 'rate_limited',
  [HttpStatus.GATEWAY_TIMEOUT]: 'timeout',
};

/**
 * Renders every unhandled exception as the contract's ErrorResponse shape
 * ({ error: { code, message } }) so the client can branch on `code` without
 * parsing prose. Unknown/non-HTTP failures are logged and surfaced as a safe
 * generic upstream_error — the raw cause never reaches the client.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();

    let status: number = HttpStatus.SERVICE_UNAVAILABLE;
    let code: ErrorCode = 'upstream_error';
    let message: string = DEFAULT_MESSAGE.upstream_error;

    if (exception instanceof ApiException) {
      status = exception.getStatus();
      code = exception.code;
      message = extractMessage(exception) ?? DEFAULT_MESSAGE[code];
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      code =
        CODE_BY_STATUS[status] ??
        (status >= HttpStatus.INTERNAL_SERVER_ERROR
          ? 'upstream_error'
          : 'invalid_request');
      message = extractMessage(exception) ?? DEFAULT_MESSAGE[code];
    } else {
      // Unknown/non-HTTP error: log the real cause, surface a safe generic.
      this.logger.error(
        exception instanceof Error
          ? (exception.stack ?? exception.message)
          : String(exception),
      );
    }

    const body: ErrorResponse = { error: { code, message } };
    res.status(status).json(body);
  }
}

/** Pull a user-safe string out of an HttpException's response payload. */
function extractMessage(exception: HttpException): string | undefined {
  const response = exception.getResponse();
  if (typeof response === 'string') return response;
  if (response && typeof response === 'object') {
    const raw = (response as { message?: unknown }).message;
    if (typeof raw === 'string') return raw;
    if (Array.isArray(raw)) return raw.join('; ');
  }
  return undefined;
}
