import { Test, TestingModule } from '@nestjs/testing';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import { AppModule } from './../src/app.module';
import { configureApp, type AppSetupOptions } from './../src/app.setup';
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
        frames: [
          { photoId: 'p1', order: 1, caption: 'first' },
          { photoId: 'p2', order: 2, caption: 'second' },
          { photoId: 'p3', order: 3, caption: 'third' },
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

    it('POST /api/v1/generate returns an ordered, captioned story', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/generate')
        .send({
          story: 'beach day with the crew',
          tone: 'chill',
          photos: photos(3),
        })
        .expect(200);

      expect(res.body.frames).toHaveLength(3);
      expect(res.body.frames[0]).toEqual({
        photoId: 'p1',
        order: 1,
        caption: 'first',
      });
      expect(res.body.partial).toBe(false);
    });

    it('rejects fewer than 3 photos with invalid_request (400)', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/generate')
        .send({ story: 'too few', photos: photos(2) })
        .expect(400);

      expect(res.body.error.code).toBe('invalid_request');
    });

    it('accepts a full 30-photo dump', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/generate')
        .send({ story: 'a whole day at the lake', photos: photos(30) })
        .expect(200);
    });

    it('accepts a mustInclude list (hand-added photo during refine)', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/generate')
        .send({ story: 'add one more', photos: photos(4), mustInclude: ['p4'] })
        .expect(200);
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

    it('returns rate_limited (429) once an IP exceeds the hourly limit', async () => {
      process.env.RATE_LIMIT_PER_HOUR = '1';
      process.env.DAILY_GENERATION_CAP = '1000';
      await boot();

      await request(app.getHttpServer())
        .post('/api/v1/generate')
        .send(story())
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/api/v1/generate')
        .send(story())
        .expect(429);
      expect(res.body.error.code).toBe('rate_limited');
    });

    it('returns quota_exhausted (503) once the daily budget is spent', async () => {
      process.env.RATE_LIMIT_PER_HOUR = '1000';
      process.env.DAILY_GENERATION_CAP = '1';
      await boot();

      await request(app.getHttpServer())
        .post('/api/v1/generate')
        .send(story())
        .expect(200);

      const res = await request(app.getHttpServer())
        .post('/api/v1/generate')
        .send(story())
        .expect(503);
      expect(res.body.error.code).toBe('quota_exhausted');
      // The model is only called for the request that stayed within budget.
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
