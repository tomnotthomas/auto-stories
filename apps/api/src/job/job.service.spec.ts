import { firstValueFrom } from 'rxjs';
import type { GenerateResponse } from '@auto-stories/api-types';
import { ApiErrors } from '../common/api-exception';
import { DEFAULT_STYLE } from '../story/caption-style';
import { JobService } from './job.service';

/** A promise plus its resolve/reject, so a test can control when work settles. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const STORY: GenerateResponse = {
  frames: [
    {
      photoId: 'p1',
      order: 1,
      caption: 'A day at the lake.',
      style: DEFAULT_STYLE,
    },
  ],
  partial: false,
};

/** Let queued microtasks + the current macrotask turn run. */
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('JobService', () => {
  let service: JobService;

  beforeEach(() => {
    service = new JobService();
  });

  it('returns an id and starts a job in the queued state', () => {
    const id = service.enqueue(() => new Promise<GenerateResponse>(() => {}));
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
    expect(service.get(id)).toEqual({ status: 'queued' });
  });

  it('runs the work and settles to done with the result', async () => {
    const id = service.enqueue(() => Promise.resolve(STORY));
    await tick();
    expect(service.get(id)).toEqual({ status: 'done', result: STORY });
  });

  it('processes one job at a time (concurrency 1)', async () => {
    const first = deferred<GenerateResponse>();
    const second = deferred<GenerateResponse>();
    const id1 = service.enqueue(() => first.promise);
    const id2 = service.enqueue(() => second.promise);

    await tick();
    expect(service.get(id1)).toEqual({ status: 'processing' });
    expect(service.get(id2)).toEqual({ status: 'queued' }); // waits its turn

    first.resolve(STORY);
    await tick();
    expect(service.get(id1)).toEqual({ status: 'done', result: STORY });
    expect(service.get(id2)).toEqual({ status: 'processing' });

    second.resolve(STORY);
    await tick();
    expect(service.get(id2)).toEqual({ status: 'done', result: STORY });
  });

  it('maps a thrown ApiException to a typed failed state', async () => {
    const id = service.enqueue(() => Promise.reject(ApiErrors.timeout()));
    await tick();
    const state = service.get(id);
    expect(state?.status).toBe('failed');
    expect(state).toMatchObject({
      status: 'failed',
      error: { code: 'timeout' },
    });
  });

  it('maps an unknown thrown error to upstream_error', async () => {
    const id = service.enqueue(() => Promise.reject(new Error('boom')));
    await tick();
    expect(service.get(id)).toMatchObject({
      status: 'failed',
      error: { code: 'upstream_error' },
    });
  });

  it('replays the current state to a late subscriber (BehaviorSubject)', async () => {
    const id = service.enqueue(() => Promise.resolve(STORY));
    await tick();
    const stream = service.stream(id);
    expect(stream).toBeDefined();
    // Subscribing after completion still yields the terminal state.
    await expect(firstValueFrom(stream!)).resolves.toEqual({
      status: 'done',
      result: STORY,
    });
  });

  it('returns undefined for an unknown id', () => {
    expect(service.get('nope')).toBeUndefined();
    expect(service.stream('nope')).toBeUndefined();
  });

  it('evicts a terminal job after its TTL', async () => {
    service.ttlMs = 5;
    const id = service.enqueue(() => Promise.resolve(STORY));
    await tick();
    expect(service.get(id)).toBeDefined();
    await new Promise((r) => setTimeout(r, 20));
    expect(service.get(id)).toBeUndefined();
  });
});
