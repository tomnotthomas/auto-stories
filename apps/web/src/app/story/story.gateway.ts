import { Injectable, InjectionToken, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  ErrorCode,
  ErrorResponse,
  GenerateAccepted,
  GenerateRequest,
  GenerateResponse,
  JobState,
} from '@auto-stories/api-types';

/** URI-path-versioned endpoints served from the same origin as the app (3.12). */
export const GENERATE_URL = '/api/v1/generate';
export const JOBS_URL = '/api/v1/jobs';

/**
 * The result of accepting a generate request: the enqueued job's id, or a
 * synchronous error (400/413/429) the server returned before enqueuing.
 */
export type AcceptOutcome =
  | { readonly ok: true; readonly jobId: string }
  | { readonly ok: false; readonly code: ErrorCode | 'network'; readonly message: string };

/**
 * The terminal result of a generation job — a discriminated union so callers
 * branch on `ok` without try/catch. `code` carries the contract's typed
 * ErrorCode (or `network` for a transport/expiry failure) so the UI can show a
 * specific message (4.3).
 */
export type GenerateOutcome =
  | { readonly ok: true; readonly response: GenerateResponse }
  | { readonly ok: false; readonly code: ErrorCode | 'network'; readonly message: string };

/** Opens an SSE stream. Injected so tests can supply a fake EventSource. */
export type EventSourceFactory = (url: string) => EventSource;
export const EVENT_SOURCE_FACTORY = new InjectionToken<EventSourceFactory>(
  'EVENT_SOURCE_FACTORY',
  { providedIn: 'root', factory: () => (url: string) => new EventSource(url) },
);

const NETWORK_MESSAGE = 'Something went wrong. Please try again.';
const LOST_MESSAGE = 'Lost connection to the story engine. Please try again.';

/** EventSource.CLOSED — a fixed part of the SSE spec; a local constant so the
 * gateway never touches the `EventSource` global (which SSR/test envs may lack). */
const EVENT_SOURCE_CLOSED = 2;

/**
 * HTTP + SSE client for async generation. `generate` enqueues the job and
 * returns its id; `streamStory` opens the SSE stream and resolves once the job
 * reaches a terminal state (architecture 6.1, 6.3). Holds no state.
 */
@Injectable({ providedIn: 'root' })
export class StoryGateway {
  private readonly http = inject(HttpClient);
  private readonly openEvents = inject(EVENT_SOURCE_FACTORY);

  /** Enqueue a generation job; returns its id or a synchronous error outcome. */
  async generate(request: GenerateRequest): Promise<AcceptOutcome> {
    try {
      const { jobId } = await firstValueFrom(
        this.http.post<GenerateAccepted>(GENERATE_URL, request),
      );
      return { ok: true, jobId };
    } catch (err) {
      return this.toError(err);
    }
  }

  /**
   * Open the job's SSE stream and resolve with the finished story or a typed
   * error. `queued`/`processing` states are ignored; the stream is closed once a
   * terminal state (or a fatal connection error, e.g. an expired 404) arrives. A
   * transient reconnect (readyState CONNECTING) is left to EventSource to retry —
   * the server replays the current state on reconnect (6.3).
   */
  streamStory(jobId: string): Promise<GenerateOutcome> {
    return new Promise((resolve) => {
      const source = this.openEvents(`${JOBS_URL}/${jobId}/events`);
      const settle = (outcome: GenerateOutcome): void => {
        source.close();
        resolve(outcome);
      };
      source.onmessage = (event: MessageEvent<string>): void => {
        const state = JSON.parse(event.data) as JobState;
        if (state.status === 'done' && state.result) {
          settle({ ok: true, response: state.result });
        } else if (state.status === 'failed') {
          settle({
            ok: false,
            code: state.error?.code ?? 'network',
            message: state.error?.message ?? NETWORK_MESSAGE,
          });
        }
        // queued / processing → keep waiting for the terminal event.
      };
      source.onerror = (): void => {
        // CLOSED means a fatal error (bad/expired id, non-2xx): the browser will
        // not retry. CONNECTING means a transient drop it is already retrying.
        if (source.readyState === EVENT_SOURCE_CLOSED) {
          settle({ ok: false, code: 'network', message: LOST_MESSAGE });
        }
      };
    });
  }

  /** Map a failed POST to a typed outcome — the server's ErrorCode, else network. */
  private toError(err: unknown): AcceptOutcome {
    if (err instanceof HttpErrorResponse) {
      const body = err.error as ErrorResponse | null;
      if (body?.error?.code) {
        return { ok: false, code: body.error.code, message: body.error.message };
      }
    }
    return { ok: false, code: 'network', message: NETWORK_MESSAGE };
  }
}
