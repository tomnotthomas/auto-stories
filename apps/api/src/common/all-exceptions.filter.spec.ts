import {
  ArgumentsHost,
  BadRequestException,
  HttpException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { AllExceptionsFilter } from './all-exceptions.filter';
import { ApiErrors, DEFAULT_MESSAGE } from './api-exception';

function mockHost(): {
  host: ArgumentsHost;
  status: jest.Mock;
  json: jest.Mock;
} {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const host = {
    switchToHttp: () => ({
      getResponse: () => ({ status }),
      getRequest: () => ({ url: '/api/v1/generate', method: 'POST' }),
    }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  it('renders an ApiException with its code, status, and message', () => {
    const { host, status, json } = mockHost();

    filter.catch(ApiErrors.emptyResult(), host);

    expect(status).toHaveBeenCalledWith(422);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'empty_result',
        message: expect.any(String),
      },
    });
  });

  it('maps a timeout ApiException to 504', () => {
    const { host, status, json } = mockHost();

    filter.catch(ApiErrors.timeout('slow'), host);

    expect(status).toHaveBeenCalledWith(504);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'timeout', message: 'slow' },
    });
  });

  it('maps a validation BadRequestException to invalid_request (400)', () => {
    const { host, status, json } = mockHost();

    filter.catch(
      new BadRequestException(['photos must contain at least 3']),
      host,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'invalid_request',
        message: expect.stringContaining('photos must contain at least 3'),
      },
    });
  });

  it('maps a PayloadTooLargeException to payload_too_large (413)', () => {
    const { host, status, json } = mockHost();

    filter.catch(new PayloadTooLargeException(), host);

    expect(status).toHaveBeenCalledWith(413);
    expect(json.mock.calls[0][0].error.code).toBe('payload_too_large');
  });

  it('falls back to the default message when an ApiException carries none', () => {
    const { host, json } = mockHost();

    filter.catch(ApiErrors.rateLimited(), host);

    expect(json.mock.calls[0][0].error).toEqual({
      code: 'rate_limited',
      message: DEFAULT_MESSAGE.rate_limited,
    });
  });

  it('passes on when the caller may try again, for a refusal that has a time', () => {
    const { host, json } = mockHost();
    const retryAt = '2026-08-06T15:00:00.000Z';

    filter.catch(ApiErrors.rateLimited(undefined, retryAt), host);

    expect(json.mock.calls[0][0].error.retryAt).toBe(retryAt);
  });

  it('leaves retryAt off a failure with no known recovery time', () => {
    const { host, json } = mockHost();

    filter.catch(ApiErrors.upstreamError(), host);

    expect(json.mock.calls[0][0].error).not.toHaveProperty('retryAt');
  });

  it('maps a generic 4xx HttpException with a string body to invalid_request', () => {
    const { host, status, json } = mockHost();

    filter.catch(new HttpException('teapot', 418), host);

    expect(status).toHaveBeenCalledWith(418);
    expect(json).toHaveBeenCalledWith({
      error: { code: 'invalid_request', message: 'teapot' },
    });
  });

  it('uses the default message when the HttpException body has no usable message', () => {
    const { host, json } = mockHost();

    // getResponse() is an object without a string/array `message` field.
    filter.catch(new HttpException({ statusCode: 400 }, 400), host);

    expect(json).toHaveBeenCalledWith({
      error: { code: 'invalid_request', message: expect.any(String) },
    });
  });

  it('maps a 5xx HttpException to upstream_error', () => {
    const { host, status, json } = mockHost();

    filter.catch(new HttpException('boom', 500), host);

    expect(status).toHaveBeenCalledWith(500);
    expect(json.mock.calls[0][0].error.code).toBe('upstream_error');
  });

  it('handles a non-Error thrown value without leaking it', () => {
    const { host, status, json } = mockHost();
    jest
      .spyOn(
        (filter as unknown as { logger: { error: (m: unknown) => void } })
          .logger,
        'error',
      )
      .mockImplementation(() => undefined);

    filter.catch('just a string', host);

    expect(status).toHaveBeenCalledWith(503);
    expect(json.mock.calls[0][0].error.code).toBe('upstream_error');
  });

  it('maps an http-errors-style 413 (body-parser) to payload_too_large', () => {
    const { host, status, json } = mockHost();

    // express's body-parser throws a plain Error with a numeric status.
    const tooLarge = Object.assign(new Error('request entity too large'), {
      status: 413,
      statusCode: 413,
    });
    filter.catch(tooLarge, host);

    expect(status).toHaveBeenCalledWith(413);
    expect(json.mock.calls[0][0].error.code).toBe('payload_too_large');
  });

  it('maps an http-errors-style 5xx to upstream_error', () => {
    const { host, status, json } = mockHost();

    filter.catch(
      Object.assign(new Error('bad gateway'), { status: 502 }),
      host,
    );

    expect(status).toHaveBeenCalledWith(502);
    expect(json.mock.calls[0][0].error.code).toBe('upstream_error');
  });

  it('maps an unknown error to a safe upstream_error (503) and logs it', () => {
    const { host, status, json } = mockHost();
    const logSpy = jest
      .spyOn(
        (filter as unknown as { logger: { error: (m: unknown) => void } })
          .logger,
        'error',
      )
      .mockImplementation(() => undefined);

    filter.catch(new Error('gemini exploded'), host);

    expect(status).toHaveBeenCalledWith(503);
    expect(json.mock.calls[0][0].error.code).toBe('upstream_error');
    // The raw cause is logged, never surfaced to the client.
    expect(json.mock.calls[0][0].error.message).not.toContain(
      'gemini exploded',
    );
    expect(logSpy).toHaveBeenCalled();
  });
});
