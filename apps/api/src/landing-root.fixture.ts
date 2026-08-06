import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/**
 * Test-only fixture: stands up a throwaway "landing build" and points
 * LANDING_ROOT at it BEFORE app.module.ts is imported (that module reads
 * LANDING_ROOT at load time to decide whether to mount the landing host at the
 * site root). Import this ahead of AppModule so the env is in place first. Not a
 * `.spec` file, so Jest never runs it directly.
 *
 * The marker text is deliberately distinct from the web fixture's "Auto Stories"
 * so the tests can prove which of the two static hosts answered a request.
 */
export const landingRoot = mkdtempSync(join(tmpdir(), 'landing-root-'));
writeFileSync(
  join(landingRoot, 'index.html'),
  '<!doctype html><title>Landing</title><body data-page="landing-root-fixture">',
);
// The legal pages ship as siblings of index.html (apps/landing/build.py emits
// them). Each carries its own marker so a test can prove the right file — not
// the landing index — answered the request.
writeFileSync(
  join(landingRoot, 'privacy.html'),
  '<!doctype html><title>Datenschutz</title><body data-page="privacy-fixture">',
);
writeFileSync(
  join(landingRoot, 'imprint.html'),
  '<!doctype html><title>Impressum</title><body data-page="imprint-fixture">',
);
process.env.LANDING_ROOT = landingRoot;
