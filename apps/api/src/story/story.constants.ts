/** DI token for the shared GoogleGenAI client (provided in StoryModule). */
export const GENAI = Symbol('GENAI');

/** Gemini Flash by default; `MODEL` env swaps it (architecture 3.2). */
export const DEFAULT_MODEL = 'gemini-flash-latest';

/** Hard cap on the model call so a request never hangs (architecture 3.x). */
export const DEFAULT_TIMEOUT_MS = 25_000;

/** A story needs at least this many photos (spec: 3 minimum). */
export const MIN_PHOTOS = 3;

/** Proxies are downscaled JPEGs, so every inline image is sent as this type. */
export const PROXY_MIME_TYPE = 'image/jpeg';
