import { NotFoundException, type MessageEvent } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { GenerateResponse } from '@auto-stories/api-types';
import { JobController } from './job.controller';
import { JobService } from './job.service';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const STORY: GenerateResponse = {
  frames: [{ photoId: 'p1', order: 1, caption: 'A day at the lake.' }],
  partial: false,
};

const tick = () => new Promise((r) => setTimeout(r, 0));
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Collect SSE events until the stream completes. */
function collectUntilComplete(obs: {
  subscribe: (o: {
    next: (e: MessageEvent) => void;
    complete: () => void;
  }) => void;
}): Promise<MessageEvent[]> {
  return new Promise((resolve) => {
    const events: MessageEvent[] = [];
    obs.subscribe({
      next: (e) => events.push(e),
      complete: () => resolve(events),
    });
  });
}

describe('JobController', () => {
  let controller: JobController;
  let jobs: JobService;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [JobController],
      providers: [JobService],
    }).compile();
    controller = moduleRef.get(JobController);
    jobs = moduleRef.get(JobService);
  });

  describe('status', () => {
    it('returns the current job state', async () => {
      const id = jobs.enqueue(() => Promise.resolve(STORY));
      await tick();
      expect(controller.status(id)).toEqual({ status: 'done', result: STORY });
    });

    it('throws 404 for an unknown id', () => {
      expect(() => controller.status('nope')).toThrow(NotFoundException);
    });
  });

  describe('events (SSE)', () => {
    it('replays the terminal state to a late subscriber and completes', async () => {
      const id = jobs.enqueue(() => Promise.resolve(STORY));
      await tick();
      const events = await collectUntilComplete(controller.events(id));
      expect(events).toEqual([{ data: { status: 'done', result: STORY } }]);
    });

    it('streams processing then the terminal state', async () => {
      const work = deferred<GenerateResponse>();
      const id = jobs.enqueue(() => work.promise);
      await tick(); // now processing
      const collected = collectUntilComplete(controller.events(id));
      work.resolve(STORY);
      const events = await collected;
      expect(events).toEqual([
        { data: { status: 'processing' } },
        { data: { status: 'done', result: STORY } },
      ]);
    });

    it('emits heartbeats to keep the connection alive', async () => {
      controller.heartbeatMs = 5;
      const id = jobs.enqueue(() => new Promise<GenerateResponse>(() => {}));
      await tick();
      const events: MessageEvent[] = [];
      const sub = controller.events(id).subscribe((e) => events.push(e));
      await delay(20);
      sub.unsubscribe();
      expect(events.some((e) => e.type === 'heartbeat')).toBe(true);
    });

    it('throws 404 for an unknown id', () => {
      expect(() => controller.events('nope')).toThrow(NotFoundException);
    });
  });
});
