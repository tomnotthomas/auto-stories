import { Test, TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type { GenerateResponse } from '@auto-stories/api-types';
import { AppModule } from './../src/app.module';
import { configureApp, type AppSetupOptions } from './../src/app.setup';
import type { JobState } from './../src/job/job.service';
import { GENAI } from './../src/story/story.constants';

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]).toString(
  'base64',
);

const photos = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `p${i + 1}`, b64: JPEG }));

describe('App (e2e)', () => {
  let app: NestExpressApplication;
  let generateContent: jest.Mock;

  async function boot(options?: AppSetupOptions): Promise<void> {
    generateContent = jest.fn().mockResolvedValue({
      text: JSON.stringify({
        // The model names one Look for the story and writes each frame's words
        // (decision 7.24); it no longer emits any geometry.
        look: 'magazine-masthead',
        frames: [
          { photoId: 'p1', order: 1, headline: 'First' },
          { photoId: 'p2', order: 2, headline: 'Second' },
          { photoId: 'p3', order: 3, headline: 'Third' },
        ],
      }),
    });

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      // Never hit the real model in tests; swap the GenAI client for a fake.
      .overrideProvider(GENAI)
      .useValue({ models: { generateContent } })
      .compile();

    app = moduleFixture.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    configureApp(app, options);
    await app.init();
  }

  afterEach(async () => {
    await app.close();
  });

  /**
   * Enqueue a generation and return its job id. Generation is async since
   * architecture 6.1: the route answers 202 straight away so a 30-photo run
   * can't hold the request open past Render's timeout.
   */
  async function enqueue(body: object): Promise<string> {
    const res = await request(app.getHttpServer())
      .post('/api/v1/generate')
      .send(body)
      .expect(202);

    expect(typeof res.body.jobId).toBe('string');
    return res.body.jobId as string;
  }

  /** Poll the status route until the job reaches a terminal state. */
  async function settle(jobId: string): Promise<JobState> {
    for (let attempt = 0; attempt < 100; attempt++) {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/jobs/${jobId}`)
        .expect(200);
      const state = res.body as JobState;
      if (state.status === 'done' || state.status === 'failed') return state;
      await new Promise((resolve) => setTimeout(resolve, 10));
    }
    throw new Error(`Job ${jobId} never settled.`);
  }

  /** Run a story end to end and assert it succeeded, returning the story. */
  async function generate(body: object): Promise<GenerateResponse> {
    const state = await settle(await enqueue(body));
    if (state.status !== 'done') {
      throw new Error(`Expected the job to finish, got ${state.status}.`);
    }
    return state.result;
  }

  describe('ops + generate', () => {
    beforeEach(() => boot());

    it('GET /healthz reports a healthy status', () => {
      return request(app.getHttpServer())
        .get('/healthz')
        .expect(200)
        .expect({ status: 'ok' });
    });

    it('does not expose /healthz under the /api/v1 prefix', () => {
      return request(app.getHttpServer()).get('/api/v1/healthz').expect(404);
    });

    it('POST /api/v1/generate accepts the work and returns a job id', async () => {
      const jobId = await enqueue({
        story: 'beach day with the crew',
        tone: 'chill',
        photos: photos(3),
      });

      // The job is readable straight away, before it has finished.
      const res = await request(app.getHttpServer())
        .get(`/api/v1/jobs/${jobId}`)
        .expect(200);
      expect(['queued', 'processing', 'done']).toContain(res.body.status);
    });

    it('finishes the job with an ordered story, each frame with its words', async () => {
      const story = await generate({
        story: 'beach day with the crew',
        tone: 'chill',
        photos: photos(3),
      });

      expect(story.frames).toHaveLength(3);
      expect(story.frames.map((frame) => frame.photoId)).toEqual([
        'p1',
        'p2',
        'p3',
      ]);
      expect(story.frames.map((frame) => frame.order)).toEqual([1, 2, 3]);
      expect(story.frames[0]).toMatchObject({
        photoId: 'p1',
        order: 1,
        headline: 'First',
      });
      expect(story.partial).toBe(false);
    });

    it('carries the story-level Look the model chose', async () => {
      const story = await generate({
        story: 'beach day with the crew',
        photos: photos(3),
      });

      expect(story.look).toBe('magazine-masthead');
    });

    it('404s an unknown job id', () => {
      return request(app.getHttpServer())
        .get('/api/v1/jobs/not-a-real-job')
        .expect(404);
    });

    it('rejects fewer than 3 photos with invalid_request (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/generate')
        .send({ story: 'too few', photos: photos(2) })
        .expect(400);

      expect(res.body.error.code).toBe('invalid_request');
    });

    it('accepts a full 30-photo dump', async () => {
      await enqueue({ story: 'a whole day at the lake', photos: photos(30) });
    });

    it('accepts a mustInclude list (hand-added photo during refine)', async () => {
      await generate({
        story: 'add one more',
        photos: photos(4),
        mustInclude: ['p4'],
      });

      expect(generateContent).toHaveBeenCalledTimes(1);
    });

    it('rejects more than 30 photos with invalid_request (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/generate')
        .send({ story: 'too many', photos: photos(31) })
        .expect(400);

      expect(res.body.error.code).toBe('invalid_request');
      expect(generateContent).not.toHaveBeenCalled();
    });

    it('rejects an unknown field with invalid_request (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/generate')
        .send({ story: 'sneaky', photos: photos(3), surprise: true })
        .expect(400);

      expect(res.body.error.code).toBe('invalid_request');
    });

    it('rejects a non-image photo with invalid_request (400)', async () => {
      const bad = photos(3);
      bad[1].b64 = Buffer.from([0, 1, 2, 3]).toString('base64');

      const res = await request(app.getHttpServer())
        .post('/api/v1/generate')
        .send({ story: 'not an image', photos: bad })
        .expect(400);

      expect(res.body.error.code).toBe('invalid_request');
      expect(generateContent).not.toHaveBeenCalled();
    });
  });

  describe('body-size cap', () => {
    beforeEach(() => boot({ jsonLimit: '10b' }));

    it('rejects an oversized body with payload_too_large (413)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/generate')
        .send({ story: 'way too big for the cap', photos: photos(3) })
        .expect(413);

      expect(res.body.error.code).toBe('payload_too_large');
    });
  });

  describe('fair-use guardrails', () => {
    // Config is read at module init, so set env before boot() and restore after.
    const original = {
      perHour: process.env.RATE_LIMIT_PER_HOUR,
      dailyCap: process.env.DAILY_GENERATION_CAP,
    };

    afterEach(() => {
      restoreEnv('RATE_LIMIT_PER_HOUR', original.perHour);
      restoreEnv('DAILY_GENERATION_CAP', original.dailyCap);
    });

    const story = () => ({
      story: 'beach day with the crew',
      photos: photos(3),
    });

    // The hourly IP limit is enforced by the guard, before the handler runs, so
    // a flooding client is still turned away synchronously.
    it('returns rate_limited (429) once an IP exceeds the hourly limit', async () => {
      process.env.RATE_LIMIT_PER_HOUR = '1';
      process.env.DAILY_GENERATION_CAP = '1000';
      await boot();

      await enqueue(story());

      const res = await request(app.getHttpServer())
        .post('/api/v1/generate')
        .send(story())
        .expect(429);
      expect(res.body.error.code).toBe('rate_limited');
    });

    // The daily budget is spent when the job RUNS, not when it is accepted, so a
    // queued job that never runs never spends it. Exhaustion therefore surfaces
    // as a failed job rather than a rejected request.
    it('fails the job with quota_exhausted once the daily budget is spent', async () => {
      process.env.RATE_LIMIT_PER_HOUR = '1000';
      process.env.DAILY_GENERATION_CAP = '1';
      await boot();

      await generate(story());

      const state = await settle(await enqueue(story()));
      expect(state.status).toBe('failed');
      if (state.status !== 'failed') throw new Error('expected a failed job');
      expect(state.error.code).toBe('quota_exhausted');
      // The model is only called for the job that stayed within budget.
      expect(generateContent).toHaveBeenCalledTimes(1);
    });
  });
});

/** Restore an env var to a prior value, deleting it if it was unset. */
function restoreEnv(key: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[key];
  } else {
    process.env[key] = value;
  }
}
