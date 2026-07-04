/**
 * @auto-stories/api-types — the shared, typed API contract.
 *
 * Generated from `openapi/openapi.yaml` (the source of truth) and imported by
 * both the Angular frontend and the NestJS backend, so a contract change breaks
 * compilation on both sides instead of failing at runtime.
 *
 * `./generated` is auto-generated (do not edit). This file is the hand-written,
 * stable public surface: flat aliases for the model types you actually use.
 */
import type { components, operations, paths } from "./generated.js";

// Raw generated shapes, re-exported for advanced use (e.g. a typed fetch client).
export type { components, operations, paths };

// --- Model types (request/response bodies) ---------------------------------

/** Optional tone chip that colors the captions. */
export type Tone = components["schemas"]["Tone"];

/** One downscaled photo proxy sent to the model. */
export type Photo = components["schemas"]["Photo"];

/** Body of `POST /api/v1/generate`. */
export type GenerateRequest = components["schemas"]["GenerateRequest"];

/** One chosen photo in narrative order, with its caption. */
export type Frame = components["schemas"]["Frame"];

/** Success body of `POST /api/v1/generate`. */
export type GenerateResponse = components["schemas"]["GenerateResponse"];

/** Stable machine-readable error outcome. */
export type ErrorCode = components["schemas"]["ErrorCode"];

/** Body of every non-2xx response. */
export type ErrorResponse = components["schemas"]["ErrorResponse"];

/** Body of `GET /healthz`. */
export type HealthResponse = components["schemas"]["HealthResponse"];
