import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import type { GenerateRequest, GenerateResponse } from '@auto-stories/api-types';

import {
  EVENT_SOURCE_FACTORY,
  GENERATE_URL,
  JOBS_URL,
  StoryGateway,
} from './story.gateway';

const request: GenerateRequest = {
  story: 'A day at the lake',
  photos: [{ id: 'p1', b64: 'AAAA' }],
};

const STORY: GenerateResponse = {
  frames: [{ photoId: 'p1', order: 1, caption: 'By the water' }],
  partial: false,
};

/** Minimal EventSource stand-in a test can drive. */
class FakeEventSource {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSED = 2;
  readyState = FakeEventSource.OPEN;
  onmessage: ((e: MessageEvent<string>) => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;
  constructor(readonly url: string) {}
  close(): void {
    this.closed = true;
    this.readyState = FakeEventSource.CLOSED;
  }
  emit(state: unknown): void {
    this.onmessage?.({ data: JSON.stringify(state) } as MessageEvent<string>);
  }
  fail(readyState = FakeEventSource.CLOSED): void {
    this.readyState = readyState;
    this.onerror?.();
  }
}

describe('StoryGateway', () => {
  let gateway: StoryGateway;
  let http: HttpTestingController;
  let sources: FakeEventSource[];

  beforeEach(() => {
    sources = [];
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: EVENT_SOURCE_FACTORY,
          useValue: (url: string) => {
            const source = new FakeEventSource(url);
            sources.push(source);
            return source as unknown as EventSource;
          },
        },
      ],
    });
    gateway = TestBed.inject(StoryGateway);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  describe('generate (enqueue)', () => {
    it('POSTs the request and returns the jobId on 202', async () => {
      const pending = gateway.generate(request);

      const req = http.expectOne(GENERATE_URL);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(request);
      req.flush({ jobId: 'job-123' });

      expect(await pending).toEqual({ ok: true, jobId: 'job-123' });
    });

    it('maps a typed error response to its code and message', async () => {
      const pending = gateway.generate(request);
      http.expectOne(GENERATE_URL).flush(
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
      expect(await pending).toMatchObject({ ok: false, code: 'network' });
    });
  });

  describe('streamStory (SSE)', () => {
    it('opens the job events stream and resolves with the story on done', async () => {
      const pending = gateway.streamStory('job-123');
      const source = sources[0];
      expect(source.url).toBe(`${JOBS_URL}/job-123/events`);

      source.emit({ status: 'processing' }); // ignored
      source.emit({ status: 'done', result: STORY });

      expect(await pending).toEqual({ ok: true, response: STORY });
      expect(source.closed).toBe(true);
    });

    it('resolves with a typed error on a failed state', async () => {
      const pending = gateway.streamStory('job-123');
      sources[0].emit({
        status: 'failed',
        error: { code: 'timeout', message: 'The story engine timed out — retry.' },
      });
      expect(await pending).toEqual({
        ok: false,
        code: 'timeout',
        message: 'The story engine timed out — retry.',
      });
    });

    it('treats a fatal (CLOSED) connection error as a network failure', async () => {
      const pending = gateway.streamStory('job-123');
      sources[0].fail(FakeEventSource.CLOSED);
      expect(await pending).toMatchObject({ ok: false, code: 'network' });
    });

    it('ignores a transient (CONNECTING) error and waits for reconnect', async () => {
      const pending = gateway.streamStory('job-123');
      const source = sources[0];
      source.fail(FakeEventSource.CONNECTING); // retrying — must not settle
      source.emit({ status: 'done', result: STORY });
      expect(await pending).toEqual({ ok: true, response: STORY });
    });

    it('times out with a typed error when no terminal state arrives in maxWaitMs', async () => {
      vi.useFakeTimers();
      try {
        const pending = gateway.streamStory('job-123');
        const source = sources[0];

        // Stream stays open (heartbeats, still processing) but never settles.
        await vi.advanceTimersByTimeAsync(gateway.maxWaitMs);

        expect(await pending).toEqual({
          ok: false,
          code: 'timeout',
          message: 'The story engine timed out — retry.',
        });
        expect(source.closed).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });

    it('does not time out once a terminal state has already arrived', async () => {
      vi.useFakeTimers();
      try {
        const pending = gateway.streamStory('job-123');
        sources[0].emit({ status: 'done', result: STORY });

        // Advancing past the deadline must not overwrite the settled result.
        await vi.advanceTimersByTimeAsync(gateway.maxWaitMs + 1_000);

        expect(await pending).toEqual({ ok: true, response: STORY });
      } finally {
        vi.useRealTimers();
      }
    });
  });
});
