import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
// Import order matters: the fixture sets WEB_ROOT before app.module.ts reads it.
import { webRoot } from './web-root.fixture';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

// The deployment is a single container where NestJS also serves the built
// Angular app (see Dockerfile). These tests pin that contract: static files for
// the web app, and the backend routes still reachable underneath. We bootstrap
// through NestFactory (as production does) so ServeStaticModule binds to the
// real HTTP adapter — the compile()-first test path leaves it a no-op.
describe('Single-container web hosting', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    expect(webRoot).toBeDefined();
    app = await NestFactory.create<NestExpressApplication>(AppModule, {
      bodyParser: false,
      logger: false,
    });
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('serves index.html for a client-side route', async () => {
    const res = await request(app.getHttpServer()).get('/story/new');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Auto Stories');
  });

  it('still routes the backend health probe', async () => {
    await request(app.getHttpServer())
      .get('/healthz')
      .expect(200)
      .expect({ status: 'ok' });
  });

  it('returns 404 for an unknown /api route instead of index.html', async () => {
    const res = await request(app.getHttpServer()).get('/api/v1/nope');

    expect(res.status).toBe(404);
    expect(res.text).not.toContain('Auto Stories');
  });
});
