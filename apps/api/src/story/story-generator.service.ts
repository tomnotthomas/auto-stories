import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiError,
  type GenerateContentResponse,
  type GoogleGenAI,
  type Part,
} from '@google/genai';
import type {
  Frame,
  GenerateRequest,
  GenerateResponse,
  Photo,
  Tone,
} from '@auto-stories/api-types';
import { ApiException, ApiErrors } from '../common/api-exception';
import { positiveInt } from '../common/config.util';
import { FairUseService } from '../fair-use/fair-use.service';
import { normalizeLook } from './caption-style';
import { completeFrames } from './partial-frames';
import { buildPrompt } from './prompt.builder';
import { shapeFrames } from './story.mapper';
import { STORY_RESPONSE_SCHEMA } from './story.schema';
import {
  DEFAULT_MODEL,
  DEFAULT_TIMEOUT_MS,
  GENAI,
  MIN_PHOTOS,
  PROXY_MIME_TYPE,
} from './story.constants';

/** Told every frame written so far, each time the model finishes another. */
export type FrameReporter = (frames: Frame[]) => void;

/**
 * Turns a validated request into an ordered, captioned story via Gemini.
 * ONE structured call with a responseSchema (architecture 3.3) — the model
 * picks the story's Look and writes the words, and deterministic client code
 * composes every frame from that (decision 7.24), so there is no second
 * geometry pass. The non-deterministic output is defended by shapeFrames and
 * normalizeLook. On a safety block the flagged photo is dropped and the call
 * retried with the rest.
 *
 * The call is **streamed** (decision 7.30): still one call and one schema, but
 * the response is read as it is written, so each frame can be reported the
 * moment the model finishes it. What is reported is advisory — the returned
 * story is the full parse of the finished response, exactly as before.
 */
@Injectable()
export class StoryGeneratorService {
  private readonly logger = new Logger(StoryGeneratorService.name);
  private readonly model: string;
  private readonly timeoutMs: number;

  constructor(
    @Inject(GENAI) private readonly genai: GoogleGenAI,
    private readonly fairUse: FairUseService,
    config: ConfigService,
  ) {
    this.model = config.get<string>('MODEL', DEFAULT_MODEL);
    // Coerced, not just typed — see positiveInt. Read raw, a configured
    // GENERATION_TIMEOUT_MS arrives as a string and AbortSignal.timeout throws
    // TypeError before the model is ever called, failing every generation.
    this.timeoutMs = positiveInt(
      config.get('GENERATION_TIMEOUT_MS'),
      DEFAULT_TIMEOUT_MS,
    );
  }

  /**
   * @param report Called with every frame written so far, each time the model
   * finishes another one. Optional — without it the call is identical, just
   * read from a stream.
   */
  async generate(
    request: GenerateRequest,
    report?: FrameReporter,
  ): Promise<GenerateResponse> {
    const validIds = new Set(request.photos.map((photo) => photo.id));
    let photos = request.photos;
    let safetyDropped = false;

    // The loop lets us drop a safety-flagged photo and retry with the rest.
    for (;;) {
      const response = await this.call(
        request.story,
        photos,
        request.tone,
        request.mustInclude,
        request.atmosphere,
        validIds,
        report,
      );

      if (response.promptFeedback?.blockReason) {
        // The API doesn't say which photo tripped safety, so drop one and
        // retry — best effort. Give up if we can't keep the 3-photo minimum.
        if (photos.length <= MIN_PHOTOS) {
          throw ApiErrors.emptyResult();
        }
        this.logger.warn(
          `Model blocked a prompt (${response.promptFeedback.blockReason}); dropping a photo and retrying.`,
        );
        photos = photos.slice(0, -1);
        safetyDropped = true;
        continue;
      }

      const parsed = parseStory(response.text);
      const frames = shapeFrames(parsed.frames, validIds);
      if (frames.length === 0) {
        throw ApiErrors.emptyResult();
      }

      return {
        frames,
        // One Look for the whole story; an unknown or missing one falls back so
        // the client always has a renderer for it (decision 7.24).
        look: normalizeLook(parsed.look),
        // Curating a subset of the batch is the whole job (the user dumps 30,
        // we keep the best 5–7), not a failure — so only a safety-dropped photo
        // makes a story "partial" (4.3, 2.4/2.5).
        partial: safetyDropped,
      };
    }
  }

  /**
   * One streamed call. Accumulates the response text and, whenever another
   * frame's JSON has closed, hands every frame written so far to `report`.
   * Returns the same shape the non-streamed call did, so the caller above is
   * unchanged: the whole text plus any prompt feedback.
   */
  private async call(
    story: string,
    photos: Photo[],
    tone: Tone | undefined,
    mustInclude: string[] | undefined,
    atmosphere: string | undefined,
    validIds: Set<string>,
    report?: FrameReporter,
  ): Promise<Pick<GenerateContentResponse, 'text' | 'promptFeedback'>> {
    const parts: Part[] = [
      { text: buildPrompt(story, tone, mustInclude, atmosphere) },
      ...photos.flatMap((photo): Part[] => [
        { text: photo.id },
        { inlineData: { mimeType: PROXY_MIME_TYPE, data: photo.b64 } },
      ]),
    ];

    // Wait for a slot if the minute is full, then reserve the day's call. Both
    // happen before the request is made, so a refusal costs no quota (7.37).
    const wait = this.fairUse.msUntilCallAllowed();
    if (wait > 0) await sleep(wait);
    this.fairUse.reserveCall();

    try {
      const stream = await this.genai.models.generateContentStream({
        model: this.model,
        contents: [{ role: 'user', parts }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: STORY_RESPONSE_SCHEMA,
          abortSignal: AbortSignal.timeout(this.timeoutMs),
        },
      });

      let text = '';
      let promptFeedback: GenerateContentResponse['promptFeedback'];
      let reported = 0;
      for await (const chunk of stream) {
        text += chunk.text ?? '';
        promptFeedback ??= chunk.promptFeedback;
        if (!report) continue;
        const written = completeFrames(text);
        if (written.length <= reported) continue;
        reported = written.length;
        const frames = shapeFrames(written, validIds);
        if (frames.length > 0) report(frames);
      }
      return { text, promptFeedback };
    } catch (err) {
      throw this.mapError(err);
    }
  }

  /** Map a thrown model/transport error to a typed, user-safe outcome. */
  private mapError(err: unknown): ApiException {
    if (
      err instanceof Error &&
      (err.name === 'TimeoutError' || err.name === 'AbortError')
    ) {
      return ApiErrors.timeout();
    }
    if (err instanceof ApiError) {
      if (err.status === 429) {
        return /quota|resource_exhausted/i.test(err.message)
          ? ApiErrors.quotaExhausted()
          : ApiErrors.rateLimited();
      }
      return ApiErrors.upstreamError();
    }
    this.logger.error(
      err instanceof Error ? (err.stack ?? err.message) : String(err),
    );
    return ApiErrors.upstreamError();
  }
}

/**
 * Pull the `frames` array and the story-level `look` out of the model's JSON
 * text. Defensive: unparseable or non-object output yields both undefined, and
 * the callers (shapeFrames / normalizeLook) turn that into an empty story and
 * the default Look rather than a throw.
 */
function parseStory(text: string | undefined): {
  frames?: unknown;
  look?: unknown;
} {
  if (!text) return {};
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed !== 'object' || parsed === null) return {};
    return parsed;
  } catch {
    return {};
  }
}

/** Hold off for `ms`, so a burst waits for the next minute instead of failing. */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
