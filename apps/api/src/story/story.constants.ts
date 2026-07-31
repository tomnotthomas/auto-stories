/** DI token for the shared GoogleGenAI client (provided in StoryModule). */
export const GENAI = Symbol('GENAI');

/** Gemini Flash by default; `MODEL` env swaps it (architecture 3.2). */
export const DEFAULT_MODEL = 'gemini-flash-latest';

/**
 * Hard cap on the model call so a job never hangs (architecture 3.x). Generation
 * runs as an async background job (Chapter 6), not inside the HTTP request, so it
 * isn't bound by Render's request timeout — the client watches progress over SSE.
 * 60s gives a single call over up to 30 images (now with per-caption style) real
 * headroom; 25s was too tight and tripped the abort. `GENERATION_TIMEOUT_MS`
 * overrides it without a redeploy.
 */
export const DEFAULT_TIMEOUT_MS = 60_000;

/** A story needs at least this many photos (spec: 3 minimum). */
export const MIN_PHOTOS = 3;

/** Proxies are downscaled JPEGs, so every inline image is sent as this type. */
export const PROXY_MIME_TYPE = 'image/jpeg';
