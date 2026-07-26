import {
  Controller,
  Get,
  type MessageEvent,
  NotFoundException,
  Param,
  Sse,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { JobService, type JobState } from './job.service';

/** How often to send an SSE comment so Render's proxy won't idle-close a quiet stream. */
const DEFAULT_HEARTBEAT_MS = 15_000;

const isTerminal = (state: JobState): boolean =>
  state.status === 'done' || state.status === 'failed';

/**
 * Exposes an async generation job: a status endpoint (polling fallback) and an
 * SSE stream that pushes each state and the terminal result (architecture 6.3).
 * Both live under /api/v1/jobs. An unknown or evicted id is a 404, which the
 * client reads as "this story expired — generate again".
 */
@Controller('jobs')
export class JobController {
  /** Overridable in tests. */
  heartbeatMs = DEFAULT_HEARTBEAT_MS;

  constructor(private readonly jobs: JobService) {}

  @Get(':id')
  status(@Param('id') id: string): JobState {
    const state = this.jobs.get(id);
    if (!state) throw new NotFoundException('Unknown or expired job.');
    return state;
  }

  @Sse(':id/events')
  events(@Param('id') id: string): Observable<MessageEvent> {
    const state$ = this.jobs.stream(id);
    if (!state$) throw new NotFoundException('Unknown or expired job.');

    // Explicit construction (over an rxjs merge/takeWhile chain) so the
    // heartbeat and the terminal-completion cleanup are obvious and co-located.
    return new Observable<MessageEvent>((subscriber) => {
      const heartbeat = setInterval(
        () => subscriber.next({ type: 'heartbeat', data: '' }),
        this.heartbeatMs,
      );
      const sub = state$.subscribe((state) => {
        subscriber.next({ data: state });
        if (isTerminal(state)) {
          clearInterval(heartbeat);
          subscriber.complete();
        }
      });
      return () => {
        clearInterval(heartbeat);
        sub.unsubscribe();
      };
    });
  }
}
