/**
 * Single-call quality eval — the "measure-first" step for decision 6.5.
 *
 * Runs the EXISTING production generation path (StoryGeneratorService: one
 * Gemini call, buildPrompt + responseSchema + shapeFrames) over batches of
 * 12 / 20 / 30 sample photos and prints the selection, order, and captions for
 * human review. Flash accepts far more than 30 images per request, so the
 * single call is the shipped path and the describe-then-decide pipeline is
 * dropped (6.5); this eval is how we confirm the single call keeps selecting
 * and captioning well at 30 — and the tripwire that would revive the pipeline
 * if it ever degrades. NOT a CI test — it calls the real model.
 *
 * Run (needs a Gemini key in the repo-root .env, same as the server):
 *   npm run eval:single -w @auto-stories/api
 * Options (env): EVAL_FIXTURES_DIR (default ./sample-story-photos),
 *   EVAL_STORY (the story line), EVAL_BATCHES (default "12,20,30").
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { NestFactory } from '@nestjs/core';
import type { Photo } from '@auto-stories/api-types';
import { AppModule } from '../src/app.module';
import { StoryGeneratorService } from '../src/story/story-generator.service';

const FIXTURES_DIR = process.env.EVAL_FIXTURES_DIR
  ? resolve(process.env.EVAL_FIXTURES_DIR)
  : resolve(__dirname, '..', '..', '..', 'sample-story-photos');

const STORY_LINE =
  process.env.EVAL_STORY ??
  'A summer Saturday with friends — beach in the morning, a backyard cookout, then the sunset.';

const BATCH_SIZES = (process.env.EVAL_BATCHES ?? '12,20,30')
  .split(',')
  .map((n) => Number(n.trim()))
  .filter((n) => Number.isInteger(n) && n >= 3);

function jpegFixtures(): string[] {
  return readdirSync(FIXTURES_DIR)
    .filter((file) => /\.jpe?g$/i.test(file))
    .sort();
}

function loadPhotos(files: string[], limit: number): Photo[] {
  return files.slice(0, limit).map((file, index) => ({
    id: `p${index + 1}`,
    b64: readFileSync(join(FIXTURES_DIR, file)).toString('base64'),
  }));
}

async function main(): Promise<void> {
  const files = jpegFixtures();
  console.log(`Fixtures: ${files.length} jpg(s) in ${FIXTURES_DIR}`);
  if (files.length < 3) {
    console.error('Need at least 3 sample photos. Set EVAL_FIXTURES_DIR.');
    process.exitCode = 1;
    return;
  }

  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['error'],
  });
  const generator = app.get(StoryGeneratorService);

  try {
    for (const size of BATCH_SIZES) {
      const photos = loadPhotos(files, size);
      console.log(`\n==================  ${photos.length} photos  ==================`);
      const startedAt = Date.now();
      try {
        const { frames, partial } = await generator.generate({
          story: STORY_LINE,
          photos,
        });
        const seconds = ((Date.now() - startedAt) / 1000).toFixed(1);
        console.log(
          `selected ${frames.length}/${photos.length} in ${seconds}s${partial ? ' (partial)' : ''}`,
        );
        for (const frame of [...frames].sort((a, b) => a.order - b.order)) {
          console.log(`  ${frame.order}. [${frame.photoId}]  ${frame.caption}`);
        }
        console.log(
          'Rubric — strongest hook first? sensible order? specific (not generic) captions? near-dupes/blurry dropped?',
        );
      } catch (err) {
        console.error(
          `FAILED at ${size} photos:`,
          err instanceof Error ? err.message : err,
        );
      }
    }
  } finally {
    await app.close();
  }
}

void main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
