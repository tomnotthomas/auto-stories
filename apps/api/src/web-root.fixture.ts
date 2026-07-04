import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Test-only fixture: stands up a throwaway "web build" and points WEB_ROOT at it
 * BEFORE app.module.ts is imported (that module reads WEB_ROOT at load time to
 * decide whether to mount the static host). Import this ahead of AppModule so
 * the env is in place first. Not a `.spec` file, so Jest never runs it directly.
 */
export const webRoot = mkdtempSync(join(tmpdir(), 'web-root-'));
writeFileSync(
  join(webRoot, 'index.html'),
  '<!doctype html><title>Auto Stories</title>',
);
process.env.WEB_ROOT = webRoot;

// The GenAI client fails fast without a key; the story engine isn't exercised
// by the static-hosting tests, so a stub keeps AppModule bootable anywhere.
process.env.GOOGLE_CLOUD_API_KEY ??= 'test-key';
