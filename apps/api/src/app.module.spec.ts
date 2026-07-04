import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
// Import order matters: the fixtures set WEB_ROOT/LANDING_ROOT before
// app.module.ts reads them.
import { webRoot } from './web-root.fixture';
import { landingRoot } from './landing-root.fixture';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';

// The deployment is a single container where NestJS serves two static hosts and
// the backend routes (see Dockerfile): the marketing landing page at the site
// root, the built Angular app under /app, and /api + /healthz underneath. These
// tests pin that contract. We bootstrap through NestFactory (as production does)
// so ServeStaticModule binds to the real HTTP adapter — the compile()-first test
// path leaves it a no-op.
describe('Single-container web hosting', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    expect(webRoot).toBeDefined();
    expect(landingRoot).toBeDefined();
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

  it('serves the landing page at the site root', async () => {
    const res = await request(app.getHttpServer()).get('/');

    expect(res.status).toBe(200);
    expect(res.text).toContain('landing-root-fixture');
  });

  it('serves the web app index.html for a client-side route under /app', async () => {
    const res = await request(app.getHttpServer()).get('/app/story/new');

    expect(res.status).toBe(200);
    expect(res.text).toContain('Auto Stories');
    expect(res.text).not.toContain('landing-root-fixture');
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
    expect(res.text).not.toContain('landing-root-fixture');
  });
});
