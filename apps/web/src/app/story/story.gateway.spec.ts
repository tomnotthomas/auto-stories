import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import type { GenerateRequest } from '@auto-stories/api-types';

import { GENERATE_URL, StoryGateway } from './story.gateway';

const request: GenerateRequest = {
  story: 'A day at the lake',
  photos: [{ id: 'p1', b64: 'AAAA' }],
};

describe('StoryGateway', () => {
  let gateway: StoryGateway;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    gateway = TestBed.inject(StoryGateway);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('POSTs the request and returns the story on success', async () => {
    const pending = gateway.generate(request);

    const req = http.expectOne(GENERATE_URL);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(request);
    req.flush({ frames: [{ photoId: 'p1', order: 1, caption: 'By the water' }] });

    const outcome = await pending;
    expect(outcome).toEqual({
      ok: true,
      response: { frames: [{ photoId: 'p1', order: 1, caption: 'By the water' }] },
    });
  });

  it('maps a typed error response to its code and message', async () => {
    const pending = gateway.generate(request);

    http
      .expectOne(GENERATE_URL)
      .flush(
        { error: { code: 'rate_limited', message: 'Slow down and retry shortly.' } },
        { status: 429, statusText: 'Too Many Requests' },
      );

    expect(await pending).toEqual({
      ok: false,
      code: 'rate_limited',
      message: 'Slow down and retry shortly.',
    });
  });

  it('maps an unexpected failure to a network error', async () => {
    const pending = gateway.generate(request);

    http.expectOne(GENERATE_URL).error(new ProgressEvent('error'));

    const outcome = await pending;
    expect(outcome.ok).toBe(false);
    expect(outcome).toMatchObject({ ok: false, code: 'network' });
  });
});
