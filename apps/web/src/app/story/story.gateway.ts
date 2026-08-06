import { Injectable, InjectionToken, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import type {
  ErrorCode,
  Frame,
  ErrorResponse,
  GenerateAccepted,
  GenerateRequest,
  GenerateResponse,
  JobState,
  Limits,
} from '@auto-stories/api-types';

/** URI-path-versioned endpoints served from the same origin as the app (3.12). */
export const GENERATE_URL = '/api/v1/generate';
export const JOBS_URL = '/api/v1/jobs';
export const LIMITS_URL = '/api/v1/limits';

/**
 * The result of accepting a generate request: the enqueued job's id, or a
 * synchronous error (400/413/429) the server returned before enqueuing.
 */
export type AcceptOutcome =
  | { readonly ok: true; readonly jobId: string }
  | {
      readonly ok: false;
      readonly code: ErrorCode | 'network';
      readonly message: string;
      /** When the refusal lifts, for the limits that pass on their own (7.36). */
      readonly retryAt?: string;
    };

/**
 * The terminal result of a generation job — a discriminated union so callers
 * branch on `ok` without try/catch. `code` carries the contract's typed
 * ErrorCode (or `network` for a transport/expiry failure) so the UI can show a
 * specific message (4.3).
 */
export type GenerateOutcome =
  | { readonly ok: true; readonly response: GenerateResponse }
  | {
      readonly ok: false;
      readonly code: ErrorCode | 'network';
      readonly message: string;
      readonly retryAt?: string;
    };

/** Opens an SSE stream. Injected so tests can supply a fake EventSource. */
export type EventSourceFactory = (url: string) => EventSource;
export const EVENT_SOURCE_FACTORY = new InjectionToken<EventSourceFactory>('EVENT_SOURCE_FACTORY', {
  providedIn: 'root',
  factory: () => (url: string) => new EventSource(url),
});

const NETWORK_MESSAGE = 'Something went wrong. Please try again.';
const LOST_MESSAGE = 'Lost connection to the story engine. Please try again.';
const TIMEOUT_MESSAGE = 'The story engine timed out — retry.';

/** EventSource.CLOSED — a fixed part of the SSE spec; a local constant so the
 * gateway never touches the `EventSource` global (which SSR/test envs may lack). */
const EVENT_SOURCE_CLOSED = 2;

/**
 * Longest a client waits on the SSE stream before giving up. Bounds the wait so
 * a stuck job (or a server that never settles) can't spin forever. Covers a
 * free-tier cold start (~30-50s) + queue wait + the model call (~25s) + margin.
 */
const DEFAULT_MAX_WAIT_MS = 120_000;

/**
 * HTTP + SSE client for async generation. `generate` enqueues the job and
 * returns its id; `streamStory` opens the SSE stream and resolves once the job
 * reaches a terminal state (architecture 6.1, 6.3). Holds no state.
 */
@Injectable({ providedIn: 'root' })
export class StoryGateway {
  /** Longest to wait on the SSE stream before giving up. Overridable in tests. */
  maxWaitMs = DEFAULT_MAX_WAIT_MS;

  private readonly http = inject(HttpClient);
  private readonly openEvents = inject(EVENT_SOURCE_FACTORY);

  /**
   * What this caller has left under the fair-use guardrails (7.36), so the
   * picker can say so before the user does the work. Returns null when it
   * cannot be read — the picker then says nothing, which is the same as today.
   */
  async limits(): Promise<Limits | null> {
    try {
      return await firstValueFrom(this.http.get<Limits>(LIMITS_URL));
    } catch {
      return null;
    }
  }

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
   * error. The stream is closed once a terminal state (or a fatal connection
   * error, e.g. an expired 404) arrives. A transient reconnect (readyState
   * CONNECTING) is left to EventSource to retry — the server replays the current
   * state on reconnect (6.3).
   *
   * `onFrames` is called with the frames the model has written so far, each time
   * the server reports more (decision 7.30), so the generating screen can show a
   * choice as it is made instead of all of them at the end. It is advisory: the
   * resolved outcome is still the authoritative story.
   */
  streamStory(
    jobId: string,
    onFrames?: (frames: readonly Frame[]) => void,
  ): Promise<GenerateOutcome> {
    return new Promise((resolve) => {
      const source = this.openEvents(`${JOBS_URL}/${jobId}/events`);
      let timer: ReturnType<typeof setTimeout>;
      let reported = 0;
      const settle = (outcome: GenerateOutcome): void => {
        clearTimeout(timer);
        source.close();
        resolve(outcome);
      };
      // Backstop: the server bounds its own model call, but if no terminal
      // state ever reaches us (a wedged stream, a black-holed reconnect the
      // browser keeps retrying) the promise would hang forever. Give up after
      // maxWaitMs with a typed timeout the UI shows as a retry (4.3).
      timer = setTimeout(
        () => settle({ ok: false, code: 'timeout', message: TIMEOUT_MESSAGE }),
        this.maxWaitMs,
      );
      source.onmessage = (event: MessageEvent<string>): void => {
        const state = JSON.parse(event.data) as JobState;
        if (state.status === 'done' && state.result) {
          settle({ ok: true, response: state.result });
        } else if (state.status === 'processing') {
          // Cumulative: each event carries the whole list known at that moment,
          // so the caller is told only when it has actually grown.
          const frames = state.frames ?? [];
          if (frames.length > reported) {
            reported = frames.length;
            onFrames?.(frames);
          }
        } else if (state.status === 'failed') {
          settle({
            ok: false,
            code: state.error?.code ?? 'network',
            message: state.error?.message ?? NETWORK_MESSAGE,
            ...(state.error?.retryAt ? { retryAt: state.error.retryAt } : {}),
          });
        }
        // queued → keep waiting for the terminal event.
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
        return {
          ok: false,
          code: body.error.code,
          message: body.error.message,
          ...(body.error.retryAt ? { retryAt: body.error.retryAt } : {}),
        };
      }
    }
    return { ok: false, code: 'network', message: NETWORK_MESSAGE };
  }
}
