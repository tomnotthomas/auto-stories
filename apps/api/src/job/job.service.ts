import { Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { BehaviorSubject, type Observable } from 'rxjs';
import type { ErrorResponse, GenerateResponse } from '@auto-stories/api-types';
import { ApiException, DEFAULT_MESSAGE } from '../common/api-exception';

/** The work a job runs: the existing synchronous generation, deferred. */
export type JobWork = () => Promise<GenerateResponse>;

/**
 * A job's lifecycle state. `done`/`failed` are terminal; the per-job stream
 * completes once one is reached.
 */
export type JobState =
  | { status: 'queued' }
  | { status: 'processing' }
  | { status: 'done'; result: GenerateResponse }
  | { status: 'failed'; error: ErrorResponse['error'] };

/**
 * Runs story generation as a background job so a long (30-photo) request can't
 * hit Render's request timeout (architecture 6.1). Deliberately in-memory and
 * single-worker (concurrency 1): the app ships as one container, so a
 * process-local FIFO is the whole surface — it bounds memory (one batch of
 * proxies in flight) and protects the shared Gemini key, the same intent as the
 * daily budget cap (4.1). A job lost to a restart is accepted (6.2); the
 * production upgrade is Redis + BullMQ behind the same interface.
 *
 * Each job is a {@link BehaviorSubject} so a late or reconnecting SSE subscriber
 * immediately gets the current state (6.3). Terminal jobs are evicted after a
 * short TTL to bound memory.
 */
@Injectable()
export class JobService {
  /** How long a terminal job stays readable before eviction. */
  ttlMs = 60_000;

  private readonly jobs = new Map<string, BehaviorSubject<JobState>>();
  private readonly pending: { id: string; work: JobWork }[] = [];
  private draining = false;

  /** Register work, return its job id, and kick the worker. Returns at once. */
  enqueue(work: JobWork): string {
    const id = randomUUID();
    this.jobs.set(id, new BehaviorSubject<JobState>({ status: 'queued' }));
    this.pending.push({ id, work });
    // Defer so the caller observes `queued` before the worker flips it.
    queueMicrotask(() => void this.drain());
    return id;
  }

  /** The job's state stream, or undefined if the id is unknown/evicted. */
  stream(id: string): Observable<JobState> | undefined {
    return this.jobs.get(id)?.asObservable();
  }

  /** The job's current state, or undefined if the id is unknown/evicted. */
  get(id: string): JobState | undefined {
    return this.jobs.get(id)?.value;
  }

  /** Drain the queue one job at a time; re-entrancy-guarded for concurrency 1. */
  private async drain(): Promise<void> {
    if (this.draining) return;
    this.draining = true;
    try {
      let next: { id: string; work: JobWork } | undefined;
      while ((next = this.pending.shift())) {
        const subject = this.jobs.get(next.id);
        if (!subject) continue; // evicted before it ran (shouldn't happen)
        subject.next({ status: 'processing' });
        try {
          const result = await next.work();
          this.settle(next.id, subject, { status: 'done', result });
        } catch (err) {
          this.settle(next.id, subject, {
            status: 'failed',
            error: toError(err),
          });
        }
      }
    } finally {
      this.draining = false;
    }
  }

  /**
   * Emit the terminal state and schedule eviction. The subject is deliberately
   * NOT completed: it stays open holding the terminal value so a reconnecting
   * SSE subscriber replays it (6.3). The SSE endpoint ends its own HTTP stream
   * on the terminal state; the subject is dropped by the TTL eviction.
   */
  private settle(
    id: string,
    subject: BehaviorSubject<JobState>,
    state: JobState,
  ): void {
    subject.next(state);
    setTimeout(() => this.jobs.delete(id), this.ttlMs).unref?.();
  }
}

/** Map a thrown value to the typed error the client already understands (4.3). */
function toError(err: unknown): ErrorResponse['error'] {
  if (err instanceof ApiException) {
    return { code: err.code, message: err.message };
  }
  return {
    code: 'upstream_error',
    message: DEFAULT_MESSAGE.upstream_error,
  };
}
